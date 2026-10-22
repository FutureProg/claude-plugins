export type Anim =
  | 'standing'
  | 'happy1'
  | 'moving'
  | 'idle'
  | 'idlehappy'
  | 'idledrowse'
  | 'idlesleep'
  | 'sleep1'
  | 'sleep2'
  | 'sleep3'
  | 'damage'
  | 'disguise'
  | 'h2idle'
  | 'h2idlehappy'
  | 'h2idledrowse'
  | 'h2idlesleep'

export type Startle = { at: number; mark: string }

declare module 'claude-code' {
  interface PluginState {
    pokepal: {
      anim: Anim
      /** the tick the current animation started on (so each one plays from its first frame) */
      since: number
      tick: number
      /** true while Fuecoco follows the session; false after a button press */
      auto: boolean
      startle: Startle | null
      /** what the mood line says ("working", "happy!", ...) */
      status: string
      /** whether the side pane is open, so the band above the prompt knows to step aside */
      paneUp: boolean
      /** false after /pokepal off: no strip, no panel, no sound */
      enabled: boolean
      /** which buddy is out: fuecoco, mimikyu, pumpkaboo or drifloon */
      buddy: string
      /** the desktop strip's fill: light or dark */
      bg: string
      /** whether his cry plays */
      sound: boolean
      /** the last sound that played, shown in the pane */
      lastSound: string
    }
  }
}
