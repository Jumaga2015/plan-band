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

// The band as the Spanish tests draw it, one line of 74 cells:
//   5h ■■■■□→2h14m · 7d ■■□□□→3d6h · $0.42 · ctx ■■■■□→154k · caché ■■■■■→1h0m
// The cost goes first (66 cells); then the segments lose their figure one by
// one: the cache (61), ctx (56), the 7-day limit (51) and the 5-hour one, which
// leaves every segment short (45); then the cache goes (31) and the context (19).
const WHOLE = 74
const NO_COST = 66
const CACHE_SHORT = 61
const CTX_SHORT = 56
const SEVEN_SHORT = 51
const SHORT = 45
const NO_CACHE = 31
const LIMITS = 19

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

// Each step holds from just under the width of the one before down to its own.
for (const columns of [NO_COST - 1, CACHE_SHORT]) {
  test(`the cache loses its figure first, and the others keep theirs (${columns} cells)`, async ($, on) => {
    const { text } = await band($, on, columns)
    expect(has.cost(text)).toBe(false)
    expect(has.ctx(text) && has.cache(text) && has.limits(text)).toBe(true)
    expect(text).not.toContain('"→1h0m"')
    expect(text).toContain('"→154k"')
    expect(text).toContain('"→","3d6h"')
    expect(text).toContain('"→","2h14m"')
  })
}

for (const columns of [CACHE_SHORT - 1, CTX_SHORT]) {
  test(`ctx loses its figure next, and the limits keep theirs (${columns} cells)`, async ($, on) => {
    const { text } = await band($, on, columns)
    expect(text).not.toContain('"→154k"')
    expect(text).toContain('"→","3d6h"')
    expect(text).toContain('"→","2h14m"')
  })
}

for (const columns of [CTX_SHORT - 1, SEVEN_SHORT]) {
  test(`the limits lose their figure from the last to the first (${columns} cells)`, async ($, on) => {
    const { text } = await band($, on, columns)
    expect(text).not.toContain('"→","3d6h"')
    expect(text).toContain('"→","2h14m"')
  })
}

test('the segments lose their figure after the arrow, keeping name and bar', async ($, on) => {
  const { text } = await band($, on, SEVEN_SHORT - 1)
  expect(has.cost(text)).toBe(false)
  expect(has.ctx(text) && has.cache(text) && has.limits(text)).toBe(true)
  expect(has.arrows(text)).toBe(false)
  expect(text).toContain('"■■■■□"')
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
