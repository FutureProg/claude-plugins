import type { Register } from 'claude-code'

// pre-rotated frames (centre, left, right) per animation step: the wobble, then a pause
const WOBBLE = ['c', 'l', 'l', 'c', 'r', 'r', 'c', 'l', 'l', 'c', 'r', 'r', 'c', 'c', 'c', 'c', 'c', 'c']
const TICK_MS = 110
// desktop: try the sprite inside the SVG (set false to go back to the vector ball)
const DESKTOP_PNG = true

// the ball's row under whatever another mod drew above the prompt, if anything
function stack(Box: any, below: any, mine: any) {
  return below ? (
    <Box flexDirection="column">
      {below}
      {mine}
    </Box>
  ) : (
    mine
  )
}

export const register: Register = on => {
  let timer: { cancel: () => void } | undefined
  let sprite: Record<string, string> | undefined
  let png: string | undefined

  on('prompt.submit', async ($, e, next) => {
    await $.state.set({ plugin: 'pokeball', key: 'phase' } as const, 'working')
    await $.state.set({ plugin: 'pokeball', key: 'frame' } as const, 0)

    timer?.cancel()
    let frame = 0
    timer = $.clock.every(TICK_MS, () => {
      frame += 1
      $.state.set({ plugin: 'pokeball', key: 'frame' } as const, frame)
    })

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    timer?.cancel()
    timer = undefined

    const { value = 0 } = await $.state.get({ plugin: 'pokeball', key: 'caught' } as const)
    await $.state.set({ plugin: 'pokeball', key: 'caught' } as const, value + 1)
    await $.state.set({ plugin: 'pokeball', key: 'phase' } as const, 'caught')
    $.ui.toast(`Gotcha! Task #${value + 1} was caught!`)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // other mods draw here too (Fuecoco's mini band): keep what is below and stack the ball under it
    const below = await next(e)

    if (e.props.hasSurvey) {
      return below
    }

    if (!sprite && e.surface === 'terminal') {
      sprite = {}
      for (const name of ['c', 'l', 'r']) {
        sprite[name] = (await $.fs.read(`${$.plugin.root}/frames/${name}.png`, { as: 'bytes' })).base64
      }
    }

    const { value: phase = 'idle' } = await $.state.get({ plugin: 'pokeball', key: 'phase' } as const)
    const { value: caught = 0 } = await $.state.get({ plugin: 'pokeball', key: 'caught' } as const)

    const isWorking = phase === 'working'
    const msg = isWorking ? 'The ball shakes…' : phase === 'caught' ? 'Gotcha!' : 'A wild task appeared!'

    if (e.surface === 'terminal') {
      const { Box, Text, Image } = $.ui.resolve(e)
      // only the terminal reads the frame: desktop's SVG animates itself, and a redraw per tick makes it blink
      const { value: frame = 0 } = await $.state.get({ plugin: 'pokeball', key: 'frame' } as const)
      const tilt = isWorking ? WOBBLE[frame % WOBBLE.length] : 'c'

      const mine = (
        <Box alignItems="center">
          <Image key="ball" source={{ png: sprite?.[tilt] ?? '' }} columns={6} rows={3} alt="(●)" />
          <Text dimColor>
            {' '}
            {msg} · caught: {caught}
          </Text>
        </Box>
      )

      return stack(Box, below, mine)
    }

    if (e.surface === 'desktop') {
      const { Box, Text, Svg } = $.ui.resolve(e)
      // SMIL rocks the ball about its base: tip left, tip right, rest; the viewBox has room for the swing
      const rock = isWorking
        ? '<animateTransform attributeName="transform" type="rotate" values="0 28 55;-14 28 55;0 28 55;14 28 55;0 28 55;0 28 55" keyTimes="0;.15;.3;.45;.6;1" dur="1.4s" repeatCount="indefinite"/>'
        : ''
      const button = phase === 'caught' ? '#ffd030' : '#f4f4f4'
      const vector =
        `<circle cx="28" cy="28" r="27" fill="#202020"/>` +
        `<path d="M2 28A26 26 0 0 1 54 28Z" fill="#e03030"/>` +
        `<path d="M2 28A26 26 0 0 0 54 28Z" fill="#f4f4f4"/>` +
        `<rect x="1" y="24" width="54" height="8" fill="#202020"/>` +
        `<circle cx="28" cy="28" r="10" fill="#202020"/><circle cx="28" cy="28" r="6" fill="${button}"/>`

      png ??= (await $.fs.read(`${$.plugin.root}/sprite.png`, { as: 'bytes' })).base64
      // both href spellings, so whichever the frame honours draws it
      const uri = `data:image/png;base64,${png}`
      const picture = `<image href="${uri}" xlink:href="${uri}" x="0" y="0" width="56" height="56" style="image-rendering:pixelated" />`

      const source =
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-12 -2 80 60" width="80" height="60"><g>${rock}` +
        (DESKTOP_PNG ? picture : vector) +
        `</g></svg>`

      const mine = (
        <Box>
          <Svg source={source} alt="Pokéball" width={40} height={30} />
          <Text dimColor>
            {' '}
            {msg} · caught: {caught}
          </Text>
        </Box>
      )

      return stack(Box, below, mine)
    }

    return below
  })
}
