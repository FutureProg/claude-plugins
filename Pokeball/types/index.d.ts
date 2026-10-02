export type Phase = 'idle' | 'working' | 'caught'

declare module 'claude-code' {
  interface PluginState {
    pokeball: { phase: Phase; caught: number; frame: number }
  }
}
