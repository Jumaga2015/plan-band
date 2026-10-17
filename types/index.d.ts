export type PlanLimit = { kind: string; percentUsed: number; resetsAt?: string }

// One `used` row of the context breakdown, as `/context` lists it.
export type ContextRow = { name: string; tokens: number }

// What the last response did with the prompt cache, and when it was measured.
export type CacheUse = {
  hitPercent: number
  readTokens: number
  writeTokens: number
  freshTokens: number
  at: number
}

export type Usage = {
  limits: PlanLimit[]
  contextPercent?: number
  costUsd?: number
  rows?: ContextRow[]
  window?: number
  cache?: CacheUse
}

export type Lang = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it'

declare module 'claude-code' {
  interface PluginState {
    'plan-band': { usage: Usage }
  }
}
