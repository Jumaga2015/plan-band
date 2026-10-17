export type PlanLimit = { kind: string; percentUsed: number; resetsAt?: string }

export type Usage = {
  limits: PlanLimit[]
  contextPercent?: number
  costUsd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'plan-band': { usage: Usage }
  }
}
