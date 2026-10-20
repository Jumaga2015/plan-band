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
  // Tokens in use, and the window they fill.
  contextTokens?: number
  contextWindow?: number
  // The tokens at which auto-compaction runs; absent when it is off.
  compactAt?: number
  costUsd?: number
  rows?: ContextRow[]
  window?: number
  cache?: CacheUse
}

// The words of the band in one language, as its file in `hooks/lang/` holds
// them. The dates, and the names of the language, come from Intl.
export type Strings = {
  // Names of the language that Intl does not give: it already knows each
  // language's name in every language of the band (`spanish`, `español`, `Spanisch`).
  aliases?: string[]
  cache: string
  expired: string
  read: string
  wrote: string
  fresh: string
  tokens: string
  // A limit's ETA: `ETA in 45m` when it runs out at the pace so far, `ETA lasts` when it holds until it resets.
  etaIn: string
  etaOk: string
  // The limit kinds with a name of their own. A window is named from its kind
  // (`five_hour` is 5h, `seven_day` 7d), and anything else shows its kind.
  kinds: Record<string, string>
}

declare module 'claude-code' {
  interface PluginState {
    // `open`: the presses of each segment (`ctx`, `cache`, `limit:<kind>`); the band maps the count to the form shown.
    'plan-band': { usage: Usage; open: Record<string, number> }
  }
}
