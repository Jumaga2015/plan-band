import { atom, read, update } from 'claude-code'
import type { Register, RenderChildren } from 'claude-code'

import type { Lang, PlanLimit, Usage } from '../types'

const usage = atom({ plugin: 'plan-band', key: 'usage' } as const, { limits: [] } as Usage)

const LABELS: Record<Lang, Record<string, string>> = {
  en: { five_hour: '5h', seven_day: 'Week' },
  es: { five_hour: '5h', seven_day: 'Semana' },
  fr: { five_hour: '5h', seven_day: 'Semaine' },
  de: { five_hour: '5h', seven_day: 'Woche' },
  pt: { five_hour: '5h', seven_day: 'Semana' },
  it: { five_hour: '5h', seven_day: 'Settimana' }
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
const BAR = 4
const PIES = ['○', '◔', '◑', '◕', '●']

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

const bar = (filled: number) => {
  const n = Math.round((clamp(filled) / 100) * BAR)
  return '▰'.repeat(n) + '▱'.repeat(BAR - n)
}

const pie = (free: number) => PIES[Math.min(4, Math.round((clamp(free) / 100) * 4))]

const toneFree = (free: number) => (free > 50 ? 'green' : free > 20 ? 'yellow' : 'red')
const toneUsed = (used: number) => (used < 60 ? 'green' : used < 85 ? 'yellow' : 'red')

const until = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${m}m` : `${m}m`
}

const pick = (limits: PlanLimit[], contextPercent?: number, costUsd?: number): Usage => ({
  limits,
  contextPercent,
  costUsd
})

export const register: Register = (on, options) => {
  // Resolved at the first draw and kept by the module: `/clear` fires no
  // `session.start`, and a change of the plugin option reloads the module.
  let lang: Lang | undefined

  on('session.start', async ($, e, next) => {
    const u = await $.session.usage()
    await update($, usage, () => pick(u.rateLimits, u.context.percent, u.cost?.usd))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, usage, () => pick(e.rateLimits, e.context.percent, e.cost?.usd))

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
          {reset ? <Text dimColor> ↻{reset}</Text> : null}
        </Text>
      )
    }

    if (u.contextPercent !== undefined) {
      const used = clamp(u.contextPercent)
      const color = toneUsed(used)
      parts.push(
        <Text>
          <Text dimColor>ctx </Text>
          <Text color={color}>{bar(used)} {used}%</Text>
        </Text>
      )
    }

    if (u.costUsd !== undefined) {
      parts.push(<Text dimColor>${u.costUsd.toFixed(2)}</Text>)
    }

    return (
      <Box>
        <Text>
          {parts.flatMap((p, i) => (i === 0 ? [p] : [sep, p]))}
        </Text>
      </Box>
    )
  })
}
