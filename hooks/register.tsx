import { atom, read, update } from 'claude-code'
import type { Register, RenderChildren, SessionUsage } from 'claude-code'

import type { Lang, PlanLimit, Usage } from '../types'

const usage = atom({ plugin: 'plan-band', key: 'usage' } as const, { limits: [] } as Usage)

type Words = Record<string, string>

const LABELS: Record<Lang, Words> = {
  en: { five_hour: '5h', seven_day: 'Week', cache: 'cache', expired: 'expired', read: 'read', wrote: 'written', fresh: 'new' },
  es: { five_hour: '5h', seven_day: 'Semana', cache: 'caché', expired: 'caducada', read: 'leído', wrote: 'escrito', fresh: 'nuevo' },
  fr: { five_hour: '5h', seven_day: 'Semaine', cache: 'cache', expired: 'expirée', read: 'lu', wrote: 'écrit', fresh: 'nouveau' },
  de: { five_hour: '5h', seven_day: 'Woche', cache: 'Cache', expired: 'abgelaufen', read: 'gelesen', wrote: 'geschrieben', fresh: 'neu' },
  pt: { five_hour: '5h', seven_day: 'Semana', cache: 'cache', expired: 'expirado', read: 'lido', wrote: 'escrito', fresh: 'novo' },
  it: { five_hour: '5h', seven_day: 'Settimana', cache: 'cache', expired: 'scaduta', read: 'letto', wrote: 'scritto', fresh: 'nuovo' }
}

// Codes and names the free-text `language` setting of Claude Code can hold.
const NAMES: Record<string, Lang> = {
  english: 'en', ingles: 'en',
  spanish: 'es', espanol: 'es', castellano: 'es',
  french: 'fr', francais: 'fr',
  german: 'de', deutsch: 'de',
  portuguese: 'pt', portugues: 'pt',
  italian: 'it', italiano: 'it'
}

const toLang = (value: unknown): Lang | undefined => {
  if (typeof value !== 'string') return undefined
  const v = value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const code = v.split(/[-_.\s]/)[0] ?? ''
  if (code in LABELS) return code as Lang
  return NAMES[v] ?? NAMES[code]
}

// Short names for the rows `/context` lists; any other row keeps its first word.
const SHORT: Record<string, string> = {
  'system prompt': 'sys',
  'system tools': 'tools',
  'mcp tools': 'mcp',
  'custom agents': 'agents',
  'memory files': 'mem',
  messages: 'msgs'
}

const short = (name: string) => {
  const n = name.toLowerCase()
  return SHORT[n] ?? n.split(' ')[0] ?? n
}

const BAR = 4
const PIES = ['○', '◔', '◑', '◕', '●']
const ROWS = 4
const MINUTE = 60000

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

const bar = (filled: number) => {
  const n = Math.round((clamp(filled) / 100) * BAR)
  return '▰'.repeat(n) + '▱'.repeat(BAR - n)
}

const pie = (free: number) => PIES[Math.min(4, Math.round((clamp(free) / 100) * 4))]

// Orange as a raw color (xterm 208): terminals with fewer colors draw the nearest.
const ORANGE = '#ff8700'

const toneFree = (free: number) => (free > 50 ? 'green' : free > 20 ? ORANGE : 'red')
const toneUsed = (used: number) => (used < 60 ? 'green' : used < 85 ? ORANGE : 'red')

const span = (mins: number) => {
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${m}m` : `${m}m`
}

const until = (iso: string | undefined, now: number) =>
  iso ? span(Math.max(0, Math.round((Date.parse(iso) - now) / MINUTE))) : ''

const tokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

const share = (n: number, window: number) => {
  const p = (n / window) * 100
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`
}

// One item of a tooltip: its name, its value and the value's color.
type Item = [name: string, value: string, color?: string]

type Detail = Pick<Usage, 'rows' | 'window' | 'cache'>

const keep = (prev: Usage): Detail => ({ rows: prev.rows, window: prev.window, cache: prev.cache })

const pick = (limits: PlanLimit[], contextPercent: number | undefined, costUsd: number | undefined, detail: Detail): Usage => ({
  limits,
  contextPercent,
  costUsd,
  ...detail
})

// The breakdown of the context window and the cache use of the last response.
// Estimated locally, so a failure only leaves the band without the hover card.
const details = async (fetch: () => Promise<SessionUsage>, now: number): Promise<Detail | undefined> => {
  try {
    const b = (await fetch()).context.breakdown
    if (!b) return undefined

    const api = b.apiUsage
    const total = api ? api.input_tokens + api.cache_read_input_tokens + api.cache_creation_input_tokens : 0

    return {
      rows: b.categories.filter(c => c.kind === 'used' && c.tokens > 0).map(c => ({ name: c.name, tokens: c.tokens })),
      window: b.rawMaxTokens,
      cache: api && total > 0
        ? {
            hitPercent: clamp((api.cache_read_input_tokens / total) * 100),
            readTokens: api.cache_read_input_tokens,
            writeTokens: api.cache_creation_input_tokens,
            freshTokens: api.input_tokens,
            at: now
          }
        : undefined
    }
  } catch {
    return undefined
  }
}

export const register: Register = (on, options) => {
  // Resolved at the first draw and kept by the module: `/clear` fires no
  // `session.start`, and a change of the plugin option reloads the module.
  let lang: Lang | undefined

  // The countdowns are worked out when the band is drawn, and a repaint reuses
  // the drawing: redraw it each minute so they move with no new measurement.
  // Started once, with the first measurement, when the band has data to draw.
  let ticking = false

  on('session.start', async ($, e, next) => {
    const u = await $.session.usage()
    await update($, usage, prev => pick(u.rateLimits, u.context.percent, u.cost?.usd, keep(prev)))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    // A response moves the context or the cost; only then is the breakdown new.
    const moved = e.changed.includes('context') || e.changed.includes('cost')
    const now = await $.clock.now()
    const detail = moved ? await details(() => $.session.usage({ breakdown: 'summary' }), now) : undefined
    await update($, usage, prev => pick(e.rateLimits, e.context.percent, e.cost?.usd, detail ?? keep(prev)))

    if (!ticking) {
      ticking = true
      $.clock.every(MINUTE, () => $.ui.invalidate('ui.render'))
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const u = await read($, usage)
    const hasData = u.limits.length > 0 || u.contextPercent !== undefined
    if (e.props.hasSurvey || !hasData) {
      return next(e)
    }

    lang ??= toLang(options.language) ?? toLang((await $.settings.read()).language) ?? 'en'
    const labels = LABELS[lang]
    const now = await $.clock.now()
    const { Box, Text } = $.ui.resolve(e)
    const sep = <Text dimColor>{'  ·  '}</Text>
    const parts: RenderChildren[] = []

    for (const l of u.limits) {
      const free = clamp(100 - l.percentUsed)
      const color = toneFree(free)
      const reset = until(l.resetsAt, now)
      parts.push(
        <Text>
          <Text color={color}>{pie(free)} </Text>
          <Text dimColor>{labels[l.kind] ?? l.kind} </Text>
          <Text color={color}>{bar(free)} {free}%</Text>
          {reset ? <Text dimColor> →{reset}</Text> : null}
        </Text>
      )
    }

    if (u.costUsd !== undefined) {
      parts.push(<Text dimColor>${u.costUsd.toFixed(2)}</Text>)
    }

    // A segment with a tooltip: the pointer over it reveals a card that covers
    // the line from the segment's right edge to the left, over what comes
    // before. The two tooltips come last, so nothing is painted over them.
    // Each item is drawn as the band draws its segments: the name dimmed, the
    // value in its color, and the band's separator between them.
    const tip = (key: string, label: RenderChildren, items: Item[]) => (
      <Box key={key}>
        {label}
        {items.length > 0 ? (
          <Box position="absolute" top={0} right={0} display="none" hover={{ display: 'flex' }}>
            <Text>
              {' '}
              {items.flatMap(([name, value, color], i) => {
                const item = (
                  <Text>
                    <Text dimColor>{`${name} `}</Text>
                    <Text color={color}>{value}</Text>
                  </Text>
                )
                return i === 0 ? [item] : [sep, item]
              })}
              {' '}
            </Text>
          </Box>
        ) : null}
      </Box>
    )

    const { window, rows, cache } = u

    if (u.contextPercent !== undefined) {
      const used = clamp(u.contextPercent)
      const color = toneUsed(used)
      const top = window && rows ? [...rows].sort((a, b) => b.tokens - a.tokens).slice(0, ROWS) : []
      parts.push(
        tip(
          'ctx',
          <Text>
            <Text dimColor>ctx </Text>
            <Text color={color}>{bar(used)} {used}%</Text>
          </Text>,
          window ? top.map((r): Item => [short(r.name), share(r.tokens, window)]) : []
        )
      )
    }

    if (cache) {
      const ttl = options.cacheTtl === '5m' ? 5 : 60
      const left = Math.round((cache.at + ttl * MINUTE - now) / MINUTE)
      const color = left > 0 ? toneFree(cache.hitPercent) : 'inactive'
      parts.push(
        tip(
          'cache',
          <Text>
            <Text color={color}>{`${labels.cache} ${cache.hitPercent}%`}</Text>
            {left > 0 ? <Text dimColor>{` →${span(left)}`}</Text> : <Text dimColor>{` ${labels.expired}`}</Text>}
          </Text>,
          [
            [labels.read, tokens(cache.readTokens), color],
            [labels.wrote, tokens(cache.writeTokens)],
            [labels.fresh, tokens(cache.freshTokens)]
          ]
        )
      )
    }

    return (
      <Box>
        {parts.flatMap((p, i) => (i === 0 ? [p] : [sep, p]))}
      </Box>
    )
  })
}
