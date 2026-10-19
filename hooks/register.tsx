import { atom, read, update } from 'claude-code'
import type { Register, RenderNode, SessionContextUsage, SessionUsage } from 'claude-code'

import type { PlanLimit, Usage } from '../types'
import { LANGS, toLang } from './lang/index'
import type { Lang } from './lang/index'

const usage = atom({ plugin: 'plan-band', key: 'usage' } as const, { limits: [] } as Usage)

// The segments a press has swapped for their detail, by their key.
const open = atom({ plugin: 'plan-band', key: 'open' } as const, [] as string[])

// A press swaps a segment's figures for its detail, and the next one back.
const toggle = ($: Parameters<typeof update>[0], key: string) =>
  update($, open, keys => (keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key]))

const NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twelve: 12, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, sixty: 60, ninety: 90
}

const UNITS: Record<string, string> = { minute: 'm', hour: 'h', day: 'd', week: 'w' }

// A window's kind as `<count>_<unit>`, in words or digits: `five_hour` is 5h, `30_day` 30d.
const windowLabel = (kind: string) => {
  const m = /^([a-z]+|\d+)_(minute|hour|day|week)s?$/.exec(kind)
  const n = m ? (NUMBERS[m[1]!] ?? (/^\d+$/.test(m[1]!) ? Number(m[1]) : undefined)) : undefined
  return m && n ? `${n}${UNITS[m[2]!]}` : undefined
}

const kindLabel = (kind: string, lang: Lang) =>
  LANGS[lang].kinds[kind] ?? windowLabel(kind) ?? kind.replace(/_/g, ' ')

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
const ROWS = 4
const MINUTE = 60000

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

const bar = (filled: number) => {
  const n = Math.round((clamp(filled) / 100) * BAR)
  return '▰'.repeat(n) + '▱'.repeat(BAR - n)
}

// Orange as a raw color (xterm 208): terminals with fewer colors draw the nearest.
const ORANGE = '#ff8700'

const toneFree = (free: number) => (free > 50 ? 'green' : free > 20 ? ORANGE : 'red')
const toneUsed = (used: number) => (used < 60 ? 'green' : used < 85 ? ORANGE : 'red')
// The cache countdown, by the share of its lifetime left: under a half, under a sixth.
const toneLeft = (left: number, ttl: number) => (left * 2 >= ttl ? 'green' : left * 6 >= ttl ? ORANGE : 'red')

const span = (mins: number) => {
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${m}m` : `${m}m`
}

const until = (iso: string | undefined, now: number) =>
  iso ? span(Math.max(0, Math.round((Date.parse(iso) - now) / MINUTE))) : ''

// Local midnight of a time, in whole days, to tell today and tomorrow apart.
const dayOf = (d: Date) => Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000)

// A local time as Intl writes it in the language, without its commas, periods
// and `de`, to keep it short: `mar 20 oct 16:00`, `Tue Oct 20 4:00 PM`.
const local = (d: Date, lang: Lang, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(lang, options)
    .formatToParts(d)
    .map(p => (p.type !== 'literal' ? p.value.replace(/\.$/, '') : p.value.includes(':') ? ':' : p.value.replace(/[,.]|\bde\b/g, ' ')))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

const TIME = { hour: 'numeric', minute: '2-digit' } as const

// When a limit resets, in local time: `hoy 10:14`, `mañana 1:30`, or `mar 20 oct 16:00`.
const resetDate = (at: number, now: number, lang: Lang) => {
  const d = new Date(at)
  const days = dayOf(d) - dayOf(new Date(now))
  if (days === 0 || days === 1) {
    return `${new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(days, 'day')} ${local(d, lang, TIME)}`
  }
  return local(d, lang, { weekday: 'short', day: 'numeric', month: 'short', ...TIME })
}

const tokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

const share = (n: number, window: number) => {
  const p = (n / window) * 100
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`
}

// One item of a segment's detail: its name, its value and the value's color.
type Item = [name: string, value: string, color?: string]

type Section = 'limits' | 'cost' | 'ctx' | 'cache'

// The plugin option that shows or hides each section.
const SHOW: Record<Section, string> = { limits: 'showLimits', cost: 'showCost', ctx: 'showCtx', cache: 'showCache' }

// A segment of the band in the forms it is drawn: whole, short, and its detail.
// Each form lists what follows the segment's name, so a surface can draw the
// name apart (VS Code makes it the button); the cost has no name, and `lead`
// is the name as it is drawn before the figures.
type Part = {
  section: Section
  key: string
  name?: string
  lead?: RenderNode
  full: RenderNode[]
  short: RenderNode[]
  detail?: RenderNode[]
}

const nodes = (...nodes: (RenderNode | null)[]) => nodes.filter((n): n is RenderNode => n !== null)

// When the band does not fit its width it gives way one level at a time: level
// 1 drops the cost; level 2 draws every segment short, name and bar with no
// figure after them; level 3 drops the cache and level 4 the context. The
// limits never give way.
const GIVES_WAY: Record<Section, number> = { limits: Infinity, cost: 1, cache: 3, ctx: 4 }
const GIVES_WAY_LAST = 4
const SHORT_FROM = 2

// The cells a drawn node takes on a line: the length of its text.
const cells = (node: RenderNode): number =>
  typeof node === 'string' ? node.length : 'children' in node && node.children ? node.children.reduce((n, c) => n + cells(c), 0) : 0

type Detail = Pick<Usage, 'rows' | 'window' | 'cache' | 'compactAt'>

const keep = (prev: Usage): Detail => ({ rows: prev.rows, window: prev.window, cache: prev.cache, compactAt: prev.compactAt })

// The tokens in use: the last response's, or worked out from the percentage
// when only that is known.
const usedTokens = (c: SessionContextUsage) =>
  c.tokens ?? (c.percent !== undefined ? Math.round((c.window * c.percent) / 100) : undefined)

const pick = (limits: PlanLimit[], context: SessionContextUsage, costUsd: number | undefined, detail: Detail): Usage => ({
  limits,
  contextPercent: context.percent,
  contextTokens: usedTokens(context),
  contextWindow: context.window,
  costUsd,
  ...detail
})

// What is left of the context before auto-compaction runs, or before the
// window is full when it is off: the free share of that limit and its tokens.
const contextLeft = (u: Usage) => {
  const limit = u.compactAt ?? u.contextWindow
  const used = u.contextTokens
  return limit && used !== undefined
    ? { percent: clamp(((limit - used) / limit) * 100), tokens: Math.max(0, limit - used) }
    : undefined
}

// The breakdown of the context window and the cache use of the last response.
// Estimated locally, so a failure only leaves the band without the detail.
const details = async (fetch: () => Promise<SessionUsage>, now: number): Promise<Detail | undefined> => {
  try {
    const b = (await fetch()).context.breakdown
    if (!b) return undefined

    const api = b.apiUsage
    const total = api ? api.input_tokens + api.cache_read_input_tokens + api.cache_creation_input_tokens : 0

    return {
      rows: b.categories.filter(c => c.kind === 'used' && c.tokens > 0).map(c => ({ name: c.name, tokens: c.tokens })),
      window: b.rawMaxTokens,
      compactAt: b.isAutoCompactEnabled ? b.autoCompactThreshold : undefined,
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
    await update($, usage, prev => pick(u.rateLimits, u.context, u.cost?.usd, keep(prev)))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    // A response moves the context or the cost; only then is the breakdown new.
    const moved = e.changed.includes('context') || e.changed.includes('cost')
    const now = await $.clock.now()
    const detail = moved ? await details(() => $.session.usage({ breakdown: 'summary' }), now) : undefined
    await update($, usage, prev => pick(e.rateLimits, e.context, e.cost?.usd, detail ?? keep(prev)))

    if (!ticking) {
      ticking = true
      $.clock.every(MINUTE, () => $.ui.invalidate('ui.render'))
    }

    return next(e)
  })

  // A click on a segment, posted by its Client on the desktop.
  on('ui.message', async ($, e, next) => {
    if (e.module.endsWith('segment.tsx') && (e.data as { toggle?: boolean } | null)?.toggle) {
      await toggle($, e.element)
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
    const labels = LANGS[lang]
    const now = await $.clock.now()
    const shown = await read($, open)
    const { Box, Text, Button } = $.ui.resolve(e)
    const sep = <Text dimColor>{' · '}</Text>
    const parts: Part[] = []

    // A detail's words and figures, drawn as the band is, since the detail takes
    // the segment's place: the words dimmed, each figure in its color.
    const word = (text: string) => <Text dimColor>{text}</Text>
    const figure = (text: string, color?: string) => <Text color={color}>{text}</Text>

    // A detail's items: each name and its value, and commas between them, not
    // the band's separator.
    const items = (list: Item[]) =>
      list.flatMap(([name, value, color], i) => {
        const item = (
          <Text>
            {word(`${name} `)}
            {figure(value, color)}
          </Text>
        )
        return i === 0 ? [item] : [word(', '), item]
      })

    // A segment is drawn whole (name, bar and the figure after the arrow), short
    // (name and bar) or as its detail. A press swaps the figures for the detail
    // and the next press back; the band is drawn again, so what follows moves
    // along and nothing overlaps.
    const shows = (section: Section) => options[SHOW[section]] !== false

    // Each limit is a segment of its own: the bar of what is free and the time
    // until it resets; its detail, the free percentage and the local date it resets.
    if (shows('limits')) {
      for (const l of u.limits) {
        const free = clamp(100 - l.percentUsed)
        const color = toneFree(free)
        const name = kindLabel(l.kind, lang)
        const reset = until(l.resetsAt, now)
        const head = <Text color={color}>{bar(free)}</Text>
        parts.push({
          section: 'limits',
          key: `limit:${l.kind}`,
          name,
          lead: <Text dimColor>{name} </Text>,
          short: [head],
          full: nodes(head, reset ? <Text dimColor>→{reset}</Text> : null),
          detail: nodes(
            figure(`${free}%`, color),
            l.resetsAt ? word(` →${resetDate(Date.parse(l.resetsAt), now, lang)}`) : null
          )
        })
      }
    }

    if (shows('cost') && u.costUsd !== undefined) {
      const cost = <Text dimColor>${u.costUsd.toFixed(2)}</Text>
      parts.push({ section: 'cost', key: 'cost', short: [cost], full: [cost] })
    }

    const { window, rows, cache } = u

    // The context: a bar of what is free before auto-compaction runs, or before
    // the window is full when it is off, and the tokens left up to there; its
    // detail, the share of the window in use and the biggest rows.
    if (shows('ctx') && u.contextPercent !== undefined) {
      const used = clamp(u.contextPercent)
      const left = contextLeft(u)
      const color = toneUsed(left ? 100 - left.percent : used)
      const top = window && rows ? [...rows].sort((a, b) => b.tokens - a.tokens).slice(0, ROWS) : []
      const head = <Text color={color}>{bar(left ? left.percent : 100 - used)}</Text>
      parts.push({
        section: 'ctx',
        key: 'ctx',
        name: 'ctx',
        lead: <Text dimColor>ctx </Text>,
        short: [head],
        full: nodes(head, left ? <Text dimColor>{`→${tokens(left.tokens)}`}</Text> : null),
        detail: [
          figure(`${used}%`, color),
          ...(window && top.length > 0 ? [word(', ')] : []),
          ...(window ? items(top.map((r): Item => [short(r.name), share(r.tokens, window)])) : [])
        ]
      })
    }

    // The cache: a bar of the lifetime it has left and the time until it
    // expires, both in the countdown's color; its detail, the share of the
    // last response's prompt it served and the tokens it read and wrote.
    if (shows('cache') && cache) {
      const ttl = options.cacheTtl === '5m' ? 5 : 60
      const left = Math.round((cache.at + ttl * MINUTE - now) / MINUTE)
      const tone = left > 0 ? toneLeft(left, ttl) : 'inactive'
      const hit = left > 0 ? toneFree(cache.hitPercent) : 'inactive'
      const head = <Text color={tone}>{bar(left > 0 ? (left / ttl) * 100 : 0)}</Text>
      parts.push({
        section: 'cache',
        key: 'cache',
        name: labels.cache,
        lead: <Text dimColor>{`${labels.cache} `}</Text>,
        short: [head],
        full: [head, left > 0 ? <Text color={tone}>{`→${span(left)}`}</Text> : <Text dimColor>{` ${labels.expired}`}</Text>],
        detail: [
          figure(`${cache.hitPercent}%`, hit),
          word(', '),
          ...items([
            [labels.read, tokens(cache.readTokens)],
            [labels.wrote, tokens(cache.writeTokens)],
            [labels.fresh, tokens(cache.freshTokens)]
          ]),
          word(` ${labels.tokens}`)
        ]
      })
    }

    if (parts.length === 0) {
      return next(e)
    }

    // The band fits its width by giving way, level by level (see GIVES_WAY).
    // A segment showing its detail is the person's choice: it stays. The click
    // is the terminal's, the desktop's and VS Code's; elsewhere the band has no detail.
    const terminal = e.surface === 'terminal'
    const vscode = e.surface === 'vscode'
    const pressable = terminal || vscode || e.surface === 'desktop'
    const opened = (p: Part) => pressable && p.detail !== undefined && shown.includes(p.key)
    const form = (p: Part, level: number) => (opened(p) ? p.detail! : level >= SHORT_FROM ? p.short : p.full)
    // A segment as one run of text: its name, dimmed, and then its form.
    const whole = (p: Part, rest: RenderNode[]) =>
      p.name === undefined ? rest[0]! : <Text>{[opened(p) ? word(`${p.name} `) : p.lead!, ...rest]}</Text>
    const drawn = (level: number) => parts.filter(p => opened(p) || level < GIVES_WAY[p.section])
    const width = (level: number) =>
      drawn(level).reduce((n, p, i) => n + cells(whole(p, form(p, level))) + (i > 0 ? cells(sep) : 0), 0)

    let level = 0
    while (level < GIVES_WAY_LAST && width(level) > e.props.bodyColumns) {
      level++
    }

    // With no detail to show, the segment is plain text. On the terminal a
    // plain Button is plain text too, pressed to swap the figures for the
    // detail and back. The desktop draws a Button as a native one, over the
    // colors of its text, so there the segment is a Client of the plugin's
    // own (segment.tsx), which draws it as given and posts a click back. VS Code
    // has no Client and draws a Button as a native one too, so only the name is
    // the button there and the figures after it stay outside, in their colors.
    const segments = drawn(level).map(p => {
      const rest = form(p, level)
      const figures = whole(p, rest)
      if (!p.detail || !pressable) {
        return figures
      }
      if (terminal) {
        return (
          <Button key={p.key} plain onPress={() => void toggle($, p.key)}>
            {figures}
          </Button>
        )
      }
      if (vscode) {
        return (
          <Box>
            <Button key={p.key} plain onPress={() => void toggle($, p.key)}>
              {p.name!}
            </Button>
            <Text>{[' ', ...rest]}</Text>
          </Box>
        )
      }
      // Only the desktop gets here (pressable), and its table has a Client.
      const { Client } = $.ui.resolve({ ...e, surface: 'desktop' as const })
      return <Client key={p.key} module="./segment.tsx" props={{ node: figures }} />
    })

    return (
      <Box>
        {segments.flatMap((s, i) => (i === 0 ? [s] : [sep, s]))}
      </Box>
    )
  })
}
