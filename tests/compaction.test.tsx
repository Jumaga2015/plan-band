import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionContextBreakdown, SessionUsage, Settings } from 'claude-code'

const START = Date.parse('2026-10-17T08:00:00Z')
const WINDOW = 200000

// 46k tokens in use, a 23% share of the 200k window.
const TOKENS = 46000

const breakdown = (compaction: { isAutoCompactEnabled: boolean; autoCompactThreshold?: number }) =>
  ({
    categories: [{ name: 'Messages', tokens: 18000, color: 'text', isDeferred: false, kind: 'used' }],
    rawMaxTokens: WINDOW,
    apiUsage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 90000, cache_creation_input_tokens: 4000 },
    ...compaction
  }) as unknown as SessionContextBreakdown

const context = { window: WINDOW, percent: 23, tokens: TOKENS }

// Measures a response whose breakdown says how auto-compaction stands, then
// draws the band, with `pressed` pressed first.
const band = async ($: Engine, on: On, compaction: Parameters<typeof breakdown>[0], pressed: string[] = []) => {
  const usage: SessionUsage = {
    startedAt: START,
    context: { ...context, breakdown: breakdown(compaction) },
    rateLimits: [],
    cost: { usd: 0.42 }
  }
  on('settings.read', async () => ({ value: { language: 'es' } as Settings }))
  on('session.usage', async () => ({ value: usage }))
  on('clock.now', async () => ({ value: START }))
  on('session.measure', async (_, e) => ({ changed: e.changed }))

  await $.session.measure({ context, rateLimits: [], cost: usage.cost, changed: ['cost'] })

  const ui = await $.ui.mount({
    plugin: 'plan-band',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 40,
      bodyColumns: 120,
      scroll: { offset: 0, bodyRows: 40 },
      view: {}
    }
  })
  for (const key of pressed) {
    await ui.press({ key })
  }
  return JSON.stringify(await ui.drawn())
}

// ctx's bar as drawn: its color, then its marks.
const bar = (color: string, marks: string) => `{"type":"Text","props":{"color":"${color}"},"children":["${marks}"]}`

test('ctx counts the tokens left up to auto-compaction', async ($, on) => {
  // Compaction at 100k: 54k left, 54% of the way free.
  const text = await band($, on, { isAutoCompactEnabled: true, autoCompactThreshold: 100000 })
  expect(text).toContain('"→54k"')
  expect(text).toContain(bar('green', '▰▰▱▱'))
})

test('ctx turns orange by the share of the way to compaction already used', async ($, on) => {
  // Compaction at 60k: 14k left, 77% of the way used.
  const text = await band($, on, { isAutoCompactEnabled: true, autoCompactThreshold: 60000 })
  expect(text).toContain('"→14k"')
  expect(text).toContain(bar('#ff8700', '▰▱▱▱'))
})

test('ctx counts up to the full window when auto-compaction is off', async ($, on) => {
  const text = await band($, on, { isAutoCompactEnabled: false, autoCompactThreshold: 100000 })
  expect(text).toContain('"→154k"')
  expect(text).toContain(bar('green', '▰▰▰▱'))
})

test('the detail of ctx keeps the share of the window in use', async ($, on) => {
  const text = await band($, on, { isAutoCompactEnabled: true, autoCompactThreshold: 100000 }, ['ctx'])
  expect(text).toContain('"23%"')
  expect(text).not.toContain('"→54k"')
})
