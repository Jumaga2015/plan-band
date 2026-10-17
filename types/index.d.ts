export type PlanLimit = { kind: string; percentUsed: number; resetsAt?: string }

export type Usage = {
  limits: PlanLimit[]
  contextPercent?: number
  costUsd?: number
}

export type Lang = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it'

declare module 'claude-code' {
  interface PluginState {
    'plan-band': { usage: Usage; lang: Lang }
  }
}
