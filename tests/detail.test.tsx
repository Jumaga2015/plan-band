import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, PluginOptions, SessionContextBreakdown, SessionUsage, Settings } from 'claude-code'

const START = Date.parse('2026-10-17T08:00:00Z')
const WINDOW = 200000
const MINUTE = 60000

const row = (name: string, tokens: number, kind: 'used' | 'free') => ({ name, tokens, color: 'text', isDeferred: false, kind })

// 16k of system prompt, 10k of tools, 18k of messages; the last response read 90k
// from the cache, wrote 4k and paid 1k, so the cache served 95% of it.
const BREAKDOWN = {
  categories: [
    row('System prompt', 16000, 'used'),
    row('System tools', 10000, 'used'),
    row('Messages', 18000, 'used'),
    row('Free space', 150000, 'free')
  ],
  rawMaxTokens: WINDOW,
  apiUsage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 90000, cache_creation_input_tokens: 4000 }
} as unknown as SessionContextBreakdown

const usage = (hasBreakdown: boolean): SessionUsage => ({
  startedAt: START,
  context: { window: WINDOW, percent: 23, ...(hasBreakdown ? { breakdown: BREAKDOWN } : {}) },
  rateLimits: [],
  cost: { usd: 0.42 }
})

// Measures a response at START with the breakdown given, then draws the band
// `minutes` later. With `then`, a second measurement follows, with no breakdown.
const draw = async ($: Engine, on: On, hasBreakdown: boolean, minutes: number, then?: 'rateLimits') => {
  let clock = START
  on('settings.read', async () => ({ value: { language: 'es' } as Settings }))
  on('session.usage', async () => ({ value: usage(hasBreakdown) }))
  on('clock.now', async () => ({ value: clock }))
  on('session.measure', async (_, e) => ({ changed: e.changed }))

  const { context, rateLimits, cost } = usage(false)
  await $.session.measure({ context, rateLimits, cost, changed: ['cost'] })
  if (then) {
    await $.session.measure({ context, rateLimits, cost, changed: [then] })
  }

  clock = START + minutes * MINUTE
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
  return JSON.stringify(await ui.drawn())
}

const ttl = (cacheTtl: string): { options: PluginOptions } => ({ options: { cacheTtl } })

test('the band shows the cache hit and the time until it expires', async ($, on) => {
  const text = await draw($, on, true, 6)
  expect(text).toContain('"caché 95%"')
  expect(text).toContain('" →54m"')
})

test('the cache counts down from the 5m option', ttl('5m'), async ($, on) => {
  const text = await draw($, on, true, 4)
  expect(text).toContain('" →1m"')
})

test('the cache shows as expired once its lifetime is over', ttl('5m'), async ($, on) => {
  const text = await draw($, on, true, 6)
  expect(text).toContain('" caducada"')
  expect(text).not.toContain('→')
})

test('ctx and the cache each have a tooltip of their own', async ($, on) => {
  const text = await draw($, on, true, 0)
  // Each tooltip is drawn as the band is: the name dimmed, then the value.
  const item = (name: string, value: string) =>
    `{"type":"Text","props":{"dimColor":true},"children":["${name} "]},{"type":"Text"`
    + `${value === '90k' ? ',"props":{"color":"green"}' : ''},"children":["${value}"]}`
  for (const [name, value] of [['msgs', '9%'], ['sys', '8%'], ['tools', '5%'], ['leído', '90k'], ['escrito', '4k'], ['nuevo', '1k']]) {
    expect(text).toContain(item(name, value))
  }
  expect(text).not.toContain('backgroundColor')
})

test('the band keeps the cache after a measurement that is not a response', async ($, on) => {
  const text = await draw($, on, true, 6, 'rateLimits')
  expect(text).toContain('"caché 95%"')
})

test('the band shows no cache without a breakdown', async ($, on) => {
  const text = await draw($, on, false, 0)
  expect(text).not.toContain('caché')
  expect(text).toContain('ctx')
})
