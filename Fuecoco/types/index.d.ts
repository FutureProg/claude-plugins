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

export type Startle = { at: number; mark: string }

declare module 'claude-code' {
  interface PluginState {
    fuecoco: {
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
      /** which buddy is out: fuecoco, mimikyu, pumpkaboo or drifloon */
      buddy: string
      /** whether his cry plays */
      sound: boolean
      /** the last sound that played, shown in the pane */
      lastSound: string
    }
  }
}
