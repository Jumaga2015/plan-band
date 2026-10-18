import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionContextBreakdown, SessionUsage, Settings } from 'claude-code'

const START = Date.parse('2026-10-17T08:00:00Z')
const WINDOW = 200000
const MINUTE = 60000

// The last response read 90k from the cache, wrote 4k and paid 1k.
const BREAKDOWN = {
  categories: [{ name: 'Messages', tokens: 18000, color: 'text', isDeferred: false, kind: 'used' }],
  rawMaxTokens: WINDOW,
  apiUsage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 90000, cache_creation_input_tokens: 4000 }
} as unknown as SessionContextBreakdown

const USAGE: SessionUsage = {
  startedAt: START,
  context: { window: WINDOW, percent: 23, breakdown: BREAKDOWN },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 28, resetsAt: new Date(START + 134 * MINUTE).toISOString() },
    { kind: 'seven_day', percentUsed: 52, resetsAt: new Date(START + (3 * 24 + 6) * 60 * MINUTE).toISOString() }
  ],
  cost: { usd: 0.42 }
} as SessionUsage

// The band as the Spanish tests draw it, one line of 70 cells:
//   5h ▰▰▰▱→2h14m · 7d ▰▰▱▱→3d6h · $0.42 · ctx ▰▰▰▱→154k · caché ▰▰▰▰→1h0m
// Level 1 drops the cost (62 cells), level 2 draws every segment short (41),
// level 3 drops the cache (28) and level 4 the context (17).
const WHOLE = 70
const NO_COST = 62
const SHORT = 41
const NO_CACHE = 28
const LIMITS = 17

// Measures a response at START, then draws the band `columns` wide. The
// segments pressed first show their detail.
const band = async ($: Engine, on: On, columns: number, pressed: string[] = []) => {
  on('settings.read', async () => ({ value: { language: 'es' } as Settings }))
  on('session.usage', async () => ({ value: USAGE }))
  on('clock.now', async () => ({ value: START }))
  on('session.measure', async (_, e) => ({ changed: e.changed }))

  const { rateLimits, cost } = USAGE
  await $.session.measure({ context: { window: WINDOW, percent: 23 }, rateLimits, cost, changed: ['cost'] })

  const mount = () =>
    $.ui.mount({
      plugin: 'plan-band',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: {
        hasSurvey: false,
        isWorking: false,
        maxRows: 40,
        bodyColumns: columns,
        scroll: { offset: 0, bodyRows: 40 },
        view: {}
      }
    })

  const ui = await mount()
  for (const key of pressed) {
    await ui.press({ key })
  }
  return { ui, text: JSON.stringify(await ui.drawn()), mount }
}

// What each part of the band is drawn as.
const has = {
  cost: (text: string) => text.includes('"0.42"'),
  ctx: (text: string) => text.includes('"ctx "'),
  cache: (text: string) => text.includes('"caché "'),
  limits: (text: string) => text.includes('"5h"') && text.includes('"7d"'),
  // The figure after the arrow of a limit, of ctx and of the cache.
  arrows: (text: string) => text.includes('"→","2h14m"') || text.includes('"→154k"') || text.includes('"→1h0m"')
}

test('the band is whole when it fits', async ($, on) => {
  const { text } = await band($, on, WHOLE)
  expect(has.cost(text) && has.ctx(text) && has.cache(text) && has.limits(text)).toBe(true)
  expect(text).toContain('"→154k"')
  expect(text).toContain('"→1h0m"')
  expect(text).toContain('"→","2h14m"')
})

test('the cost is the first to go', async ($, on) => {
  const { text } = await band($, on, WHOLE - 1)
  expect(has.cost(text)).toBe(false)
  expect(has.ctx(text) && has.cache(text) && has.limits(text)).toBe(true)
  expect(text).toContain('"→154k"')
  expect(text).toContain('"→1h0m"')
})

test('the segments lose their figure after the arrow, keeping name and bar', async ($, on) => {
  const { text } = await band($, on, NO_COST - 1)
  expect(has.cost(text)).toBe(false)
  expect(has.ctx(text) && has.cache(text) && has.limits(text)).toBe(true)
  expect(has.arrows(text)).toBe(false)
  expect(text).toContain('"▰▰▰▱"')
})

test('the short band fits down to its own width', async ($, on) => {
  const { text } = await band($, on, SHORT)
  expect(has.ctx(text) && has.cache(text) && has.limits(text)).toBe(true)
  expect(has.arrows(text)).toBe(false)
})

test('the cache goes next', async ($, on) => {
  const { text } = await band($, on, SHORT - 1)
  expect(has.cache(text)).toBe(false)
  expect(has.ctx(text) && has.limits(text)).toBe(true)
})

test('the context goes last', async ($, on) => {
  const { text } = await band($, on, NO_CACHE - 1)
  expect(has.ctx(text)).toBe(false)
  expect(has.limits(text)).toBe(true)
})

test('the limits never give way', async ($, on) => {
  const { text } = await band($, on, 5)
  expect(has.limits(text)).toBe(true)
  expect(has.ctx(text) || has.cache(text) || has.cost(text)).toBe(false)
  expect(LIMITS).toBeGreaterThan(5)
})

test('a segment showing its detail stays when the band is narrow', async ($, on) => {
  // Opened on a wide band, then drawn again on a narrow one.
  const wide = await band($, on, WHOLE, ['cache'])
  expect(wide.text).toContain('"leído "')

  const narrow = await wide.mount()
  const text = JSON.stringify(await narrow.drawn())
  expect(has.cache(text)).toBe(true)
  expect(text).toContain('"leído "')
})
