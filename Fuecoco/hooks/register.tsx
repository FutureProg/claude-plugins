import type { Register } from 'claude-code'

import type { Anim } from '../types'

const PANE = 'fuecoco'
const TICK_MS = 50
// desktop only: the strip above the prompt is filled with the page's own background, so it looks transparent
// (the app draws a grey frame around it that this covers); the terminal's strip has no fill at all
const BAND_BG = '#fcfcfb'

// per animation: rendered frames, ms per frame, the terminal's frame-file prefix, and whether it plays once
const ANIMS = {
  standing: { frames: 71, ms: 50, files: 'standing', label: 'Happy Loop' },
  happy1: { frames: 71, ms: 50, files: 'standing', label: 'Happy!', once: true },
  moving: { frames: 26, ms: 50, files: 'moving', label: 'Moving' },
  idle: { frames: 59, ms: 100, files: 'idle', label: 'Idle' },
  idlehappy: { frames: 59, ms: 100, files: 'idlehappy', label: 'Glad' },
  idledrowse: { frames: 59, ms: 100, files: 'idledrowse', label: 'Drowsy' },
  idlesleep: { frames: 59, ms: 100, files: 'idlesleep', label: 'Dozing' },
  sleep1: { frames: 111, ms: 200, files: 'sleep1', label: '★1 Sleep' },
  sleep2: { frames: 125, ms: 200, files: 'sleep2', label: '★2 Sleep' },
  sleep3: { frames: 145, ms: 200, files: 'sleep3', label: '★3 Sleep' },
} as const

// moods follow the session; ticks are 50 ms, so 20 = 1 s
const MOODS = {
  working: { anim: 'moving', text: 'working' },
  tired: { anim: 'idledrowse', text: 'worn out' },
  happy: { anim: 'happy1', text: 'happy!', next: 'glad', after: 72 },
  glad: { anim: 'idlehappy', text: 'glad', next: 'calm', after: 120 },
  calm: { anim: 'idle', text: 'relaxing', next: 'drowsy', after: 1200 },
  drowsy: { anim: 'idledrowse', text: 'drowsy', next: 'dozing', after: 1200 },
  dozing: { anim: 'idlesleep', text: 'dozing off', next: 'asleep1', after: 2400 },
  asleep1: { anim: 'sleep1', text: 'asleep', next: 'asleep2', after: 12000 },
  asleep2: { anim: 'sleep2', text: 'sound asleep', next: 'asleep3', after: 12000 },
  asleep3: { anim: 'sleep3', text: 'dreaming' },
  alert: { anim: 'idle', text: 'waiting for you' },
  flustered: { anim: 'idle', text: 'uh-oh', next: 'calm', after: 100 },
  step: { anim: 'idle', text: 'step done, more to go', next: 'drowsy', after: 1200 },
  oops: { anim: 'idlehappy', text: 'did I do something?', next: 'calm', after: 120 },
  stuck: { anim: 'idledrowse', text: 'hit a wall', next: 'dozing', after: 1200 },
} as const

type Mood = keyof typeof MOODS

// ask a small model how the turn went (costs a few tokens per turn); false uses the word-spotting guess alone
const USE_MODEL_JUDGE = true

const TIRED_AFTER = 2400 // two minutes of one turn
const STARTLE_TICKS = 60 // three seconds

const frames: Record<string, string[]> = {}
const apngs: Record<string, string> = {}
let tick = 0
let mood: Mood = 'calm'
let moodSince = 0
let isAuto = true
let startleAt = 0

async function show($: any, anim: Anim) {
  await $.state.set({ plugin: 'fuecoco', key: 'anim' } as const, anim)
  await $.state.set({ plugin: 'fuecoco', key: 'since' } as const, tick)
}

async function setMood($: any, next: Mood) {
  if (next === mood) return
  mood = next
  moodSince = tick
  await $.state.set({ plugin: 'fuecoco', key: 'status' } as const, MOODS[next].text)

  if (isAuto) await show($, MOODS[next].anim)
}

function startle($: any, mark: string) {
  startleAt = tick

  return $.state.set({ plugin: 'fuecoco', key: 'startle' } as const, { at: tick, mark })
}

async function pick($: any, anim: Anim) {
  isAuto = false
  await $.state.set({ plugin: 'fuecoco', key: 'auto' } as const, false)
  await show($, anim)
}

async function follow($: any) {
  isAuto = true
  await $.state.set({ plugin: 'fuecoco', key: 'auto' } as const, true)
  await show($, MOODS[mood].anim)
}

type Verdict = 'done' | 'progress' | 'stuck'

// the free guess: look for words that sound like a blocker, a question, or a finished job
function guess(text: string): Verdict {
  const t = text.toLowerCase()
  const tail = t.slice(-400)

  if (/\?\s*$/.test(t.trim())) return 'progress'
  if (/(couldn't|could not|unable to|wasn't able|can't|cannot|failed|doesn't work|didn't work|blocked|gave up|give up|not possible)/.test(tail)) return 'stuck'
  if (/(done|fixed|built|works|working|passes|passed|validated|ready|complete|finished|saved|created)/.test(tail)) return 'done'

  return 'progress'
}

async function judge($: any, answer: string, reason: string): Promise<Verdict> {
  if (reason === 'aborted') return 'progress'
  if (reason !== 'answer') return 'stuck'

  const text = answer.trim()
  if (text === '') return 'progress'
  if (!USE_MODEL_JUDGE) return guess(text)

  const r = await $.model.complete({
    model: 'haiku',
    effort: 'low',
    maxTokens: 8,
    timeoutMs: 8000,
    prompt:
      "Label the final message of an AI coding assistant's turn. Reply with exactly one word.\n" +
      'done = it accomplished what the user asked, or a clear goal.\n' +
      'progress = it finished a step fine but more steps remain, or it is asking the user something.\n' +
      'stuck = it could not accomplish the task, hit a blocker, is giving up, or has to change approach.\n\n' +
      `Message:\n<<<\n${text.slice(-1500)}\n>>>`,
  })

  if (r.isAnswered) {
    const word = r.text.trim().toLowerCase()
    if (word.startsWith('done')) return 'done'
    if (word.startsWith('stuck')) return 'stuck'
    if (word.startsWith('progress')) return 'progress'
  }

  return guess(text)
}

// his Scarlet/Violet voice clips, in sounds/ (afplay plays wav); the pane's test button steps through them all
const SOUNDS = ['index', 'glad1', 'glad2', 'glad3', 'sad', 'ex1', 'ex2', 'ex3', 'ex4', 'anger', 'atk', 'spatk', 'env'] as const
const GLAD = ['glad1', 'glad2', 'glad3'] as const
const NEUTRAL = ['ex1', 'ex3', 'ex4'] as const
const FRIENDLY = ['index', 'env', 'glad1', 'glad2', 'glad3', 'ex1', 'ex3', 'ex4'] as const
let nextSound = 0
let failures = 0 // tool failures this turn: they sound only when the turn ends
let lastChimeAt = -10000

// play one clip unless muted, and remember which, for the pane to show
async function cry($: any, name: string) {
  const { value: isOn = true } = await $.state.get({ plugin: 'fuecoco', key: 'sound' } as const)
  if (!isOn) return

  await $.state.set({ plugin: 'fuecoco', key: 'lastSound' } as const, name)

  try {
    await $.audio.play({ asset: `sounds/${name}.wav` })
  } catch {
    // the player is missing or the file is: stay quiet
  }
}

function cheer($: any) {
  return cry($, GLAD[Math.floor(Math.random() * GLAD.length)])
}

// a neutral "hey" for questions and permissions; at most one every ten seconds so it never pesters
function chime($: any) {
  if (tick - lastChimeAt < 200) return Promise.resolve()
  lastChimeAt = tick

  return cry($, NEUTRAL[Math.floor(Math.random() * NEUTRAL.length)])
}

// a poke wakes him if he is sleepy or idle (not while he is busy or waiting for you), with a random friendly sound
async function poke($: any) {
  if (mood !== 'working' && mood !== 'tired' && mood !== 'alert') {
    if (mood === 'calm' || mood === 'drowsy' || mood === 'dozing' || mood === 'asleep1' || mood === 'asleep2' || mood === 'asleep3' || mood === 'step' || mood === 'stuck') {
      await setMood($, 'glad')
    } else if (!isAuto) {
      await show($, MOODS.glad.anim)
    }
  }

  await cry($, FRIENDLY[Math.floor(Math.random() * FRIENDLY.length)])
}

function testSound($: any) {
  const name = SOUNDS[nextSound % SOUNDS.length]
  nextSound += 1

  return cry($, name)
}

// Fuecoco's picture for a render event: the pane's big one, or the mini one above the prompt
async function draw($: any, e: any, isMini: boolean) {
  const { value: anim = 'idle' } = await $.state.get({ plugin: 'fuecoco', key: 'anim' } as const)
  const { value: scare = null } = await $.state.get({ plugin: 'fuecoco', key: 'startle' } as const)
  const spec = ANIMS[anim as Anim]

  if (e.surface === 'terminal') {
    const { Box, Text, Image } = $.ui.resolve(e)

    frames[anim] ??= await Promise.all(
      Array.from({ length: spec.frames }, async (_, i) =>
        (await $.fs.read(`${$.plugin.root}/frames/${spec.files}-${String(i).padStart(3, '0')}.png`, { as: 'bytes' })).base64,
      ),
    )

    // only the terminal reads the tick: a redraw per tick would make desktop's picture blink
    const { value: now = 0 } = await $.state.get({ plugin: 'fuecoco', key: 'tick' } as const)
    const { value: since = 0 } = await $.state.get({ plugin: 'fuecoco', key: 'since' } as const)
    const step = Math.max(0, Math.floor((now - since) / (spec.ms / TICK_MS)))
    const png = frames[anim][('once' in spec ? Math.min(step, spec.frames - 1) : step % spec.frames)]
    const picture = (
      <Image key="fuecoco" source={{ png }} columns={isMini ? 6 : 14} rows={isMini ? 3 : 7} alt="Fuecoco" />
    )

    if (isMini) return picture

    // the mark sits on its own row above his head (blank when there is none, so nothing jumps)
    const isMarked = scare !== null && now - scare.at < STARTLE_TICKS
    return (
      <Box flexDirection="column">
        <Text color={scare !== null && scare.mark === '?' ? 'blue' : 'red'} bold>
          {'         '}
          {isMarked && scare !== null ? scare.mark : ' '}
        </Text>
        <Box>
          <Text>{'  '}</Text>
          {picture}
        </Box>
      </Box>
    )
  }

  if (e.surface === 'desktop') {
    const { Svg } = $.ui.resolve(e)

    apngs[anim] ??= (await $.fs.read(`${$.plugin.root}/anim/${anim}.png`, { as: 'bytes' })).base64

    // an animated PNG (APNG) plays itself inside the SVG; the SVG source is capped at 131072 characters
    const uri = `data:image/png;base64,${apngs[anim]}`
    // a bubble that pops in over his head: red for '!', blue for '?'
    const bubble =
      scare !== null
        ? `<g transform="translate(80 30)"><g><animateTransform attributeName="transform" type="scale" values="0;1.35;1" keyTimes="0;0.6;1" dur="0.35s" fill="freeze"/>` +
          `<circle r="17" fill="${scare.mark === '?' ? '#2f6fe0' : '#e03030'}" stroke="#ffffff" stroke-width="3"/>` +
          `<text y="9" font-size="26" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="Arial,Helvetica,sans-serif">${scare.mark}</text></g></g>`
        : ''
    // a play-once animation restarts only if its source changes, so stamp it with when it started
    const { value: startedAt = 0 } =
      'once' in spec ? await $.state.get({ plugin: 'fuecoco', key: 'since' } as const) : { value: 0 }
    const source =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><!--${startedAt}--><g>` +
      `<image href="${uri}" x="0" y="0" width="128" height="128"/></g>${bubble}</svg>`

    return <Svg source={source} alt="Fuecoco" width={isMini ? 56 : 128} height={isMini ? 56 : 128} />
  }

  return null
}

async function settle($: any, e: any) {
  // you interrupted: he perks up with a question mark
  if (e.isAborted === true || e.reason === 'aborted') {
    failures = 0
    await setMood($, 'oops')
    await startle($, '?')
    void chime($)

    return
  }

  const verdict = await judge($, e.answer, e.reason)

  await setMood($, verdict === 'done' ? 'happy' : verdict === 'stuck' ? 'stuck' : 'step')

  // failures speak up only now, at the end of the turn
  if (verdict === 'done') void cheer($)
  else if (verdict === 'stuck') void cry($, 'sad')
  else if (failures > 0) void cry($, 'ex2')

  failures = 0
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'fuecoco', description: 'Show Fuecoco in a side pane' })
    const opened = await $.ui.open({ id: PANE, title: 'Fuecoco' })
    await $.state.set({ plugin: 'fuecoco', key: 'paneUp' } as const, opened.isPlaced === true)
    await $.state.set({ plugin: 'fuecoco', key: 'sound' } as const, true)
    await $.state.set({ plugin: 'fuecoco', key: 'status' } as const, MOODS[mood].text)
    await $.state.set({ plugin: 'fuecoco', key: 'auto' } as const, true)
    await show($, MOODS[mood].anim)

    // one shared clock: the terminal's frame swap, and the mood timeline
    $.clock.every(TICK_MS, () => {
      tick += 1
      void $.state.set({ plugin: 'fuecoco', key: 'tick' } as const, tick)

      // a startle lasts three seconds, then the mark goes away
      if (startleAt > 0 && tick - startleAt >= STARTLE_TICKS) {
        startleAt = 0
        void $.state.set({ plugin: 'fuecoco', key: 'startle' } as const, null)
      }

      const spec = MOODS[mood]
      if ('next' in spec && tick - moodSince >= spec.after) void setMood($, spec.next)
      else if (mood === 'working' && tick - moodSince >= TIRED_AFTER) void setMood($, 'tired')
    })

    return next(e)
  })

  on('command.run', { command: 'fuecoco' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'Fuecoco' })
    await $.state.set({ plugin: 'fuecoco', key: 'paneUp' } as const, opened.isPlaced === true)

    return { text: 'Fuecoco says hi!' }
  })

  // the mini Fuecoco above the prompt steps aside while the pane is open, and returns when it closes
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const closed = await next(e)
    await $.state.set({ plugin: 'fuecoco', key: 'paneUp' } as const, false)

    return closed
  })

  on('prompt.submit', async ($, e, next) => {
    failures = 0
    if (mood === 'dozing' || mood === 'asleep1' || mood === 'asleep2' || mood === 'asleep3') void cry($, 'env')
    await setMood($, 'working')

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)

    // a subagent's turn is not the main one
    if (e.agentId === undefined) await settle($, e)

    return ran
  })

  // a failed tool, or a question for you, stops him in his tracks; the next tool call sets him walking again
  on('tool.call', async ($, e, next) => {
    if (mood === 'alert' || mood === 'flustered') await setMood($, 'working')

    if (e.tool === 'AskUserQuestion') {
      await setMood($, 'alert')
      await startle($, '?')
      void chime($)
      const answered = await next(e)
      await setMood($, 'working')

      return answered
    }

    const ran = await next(e)

    if (ran.deny === undefined && ran.isError === true) {
      failures += 1
      await setMood($, 'flustered')
      await startle($, '!')
    }

    return ran
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    await setMood($, 'alert')
    await startle($, '?')
    void chime($)

    return next(e)
  })

  // the mini Fuecoco above the prompt, only while the pane is not open
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below

    const { value: isPaneUp = false } = await $.state.get({ plugin: 'fuecoco', key: 'paneUp' } as const)
    if (isPaneUp) return below

    const picture = await draw($, e, true)
    if (picture === null) return below

    const { value: scare = null } = await $.state.get({ plugin: 'fuecoco', key: 'startle' } as const)
    const { Box, Text } = $.ui.resolve(e)
    // on desktop the app draws a grey frame around the strip: stretch past each side to cover it.
    // Negative margins pull the box outward (and shrink what the bar reserves); the padding gives that room back
    // and sits his picture low, so his feet are on the bottom edge. A taller tree needs more rows from the band
    // or it scrolls, so with fewer rows the stretch is trimmed: first the extra top bleed, then all vertical bleed.
    const wide = (e.props.bodyColumns ?? 80) + 3
    const rows = e.props.maxRows ?? 99
    const fit =
      e.surface !== 'desktop'
        ? { width: '100%' }
        : rows >= 7
          ? { marginX: -1, marginTop: -2, marginBottom: -1, paddingTop: 3, paddingBottom: 0, width: wide }
          : rows >= 6
            ? { marginX: -1, marginTop: -1, marginBottom: -1, paddingTop: 2, paddingBottom: 0, width: wide }
            : { marginX: -1, width: wide }

    // the terminal draws no fill; on desktop the page-coloured box also covers the app's grey frame (see `fit`)
    const mark =
      e.surface === 'terminal' && scare !== null ? (
        <Text color={scare.mark === '?' ? 'blue' : 'red'} bold>
          {` ${scare.mark}`}
        </Text>
      ) : null
    const mine =
      e.surface === 'desktop' ? (
        <Box alignItems="center" justifyContent="center" backgroundColor={BAND_BG} {...fit}>
          {picture}
        </Box>
      ) : (
        <Box alignItems="center" justifyContent="center" width="100%">
          {picture}
          {mark}
        </Box>
      )

    return below ? (
      <Box flexDirection="column">
        {below}
        {mine}
      </Box>
    ) : (
      mine
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { value: anim = 'idle' } = await $.state.get({ plugin: 'fuecoco', key: 'anim' } as const)
    const { value: isAutoNow = true } = await $.state.get({ plugin: 'fuecoco', key: 'auto' } as const)
    const { value: scare = null } = await $.state.get({ plugin: 'fuecoco', key: 'startle' } as const)
    const { value: status = '' } = await $.state.get({ plugin: 'fuecoco', key: 'status' } as const)
    const { value: isSoundOn = true } = await $.state.get({ plugin: 'fuecoco', key: 'sound' } as const)
    const { value: lastSound = '' } = await $.state.get({ plugin: 'fuecoco', key: 'lastSound' } as const)
    const spec = ANIMS[anim]

    const picture = await draw($, e, false)
    const { Box, Text, Button } = $.ui.resolve(e)
    const mark = scare !== null ? ` ${scare.mark}` : ''
    const tag = (a: Anim) => (
      <Button key={a} label={ANIMS[a].label} onPress={() => pick($, a)} />
    )

    return (
      <Box flexDirection="column">
        {picture}
        <Text dimColor>
          Fuecoco · {isAutoNow ? status : spec.label}
          {mark}
          {lastSound !== '' ? `  ♪ ${lastSound}` : ''}
        </Text>
        <Box>
          <Button key="poke" label="Poke" onPress={() => poke($)} />
          <Button key="auto" label={isAutoNow ? 'Auto ✓' : 'Auto'} onPress={() => follow($)} />
          <Button
            key="sound"
            label={isSoundOn ? 'Sound ✓' : 'Sound'}
            onPress={() => $.state.set({ plugin: 'fuecoco', key: 'sound' } as const, !isSoundOn)}
          />
          <Button key="cry" label="Cry" onPress={() => cry($, 'index')} />
          <Button key="test" label="♪ Next" onPress={() => testSound($)} />
        </Box>
        <Box>
          {tag('standing')}
          {tag('happy1')}
          {tag('moving')}
        </Box>
        <Box>
          {tag('idle')}
          {tag('idlehappy')}
          {tag('idledrowse')}
          {tag('idlesleep')}
        </Box>
        <Box>
          {tag('sleep1')}
          {tag('sleep2')}
          {tag('sleep3')}
        </Box>
      </Box>
    )
  })
}
