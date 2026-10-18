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
const mount = async ($: Engine, on: On, hasBreakdown: boolean, minutes: number, then?: 'rateLimits') => {
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
  return ui
}

const draw = async ($: Engine, on: On, hasBreakdown: boolean, minutes: number, then?: 'rateLimits') =>
  JSON.stringify(await (await mount($, on, hasBreakdown, minutes, then)).drawn())

const ttl = (cacheTtl: string): { options: PluginOptions } => ({ options: { cacheTtl } })

// The cache's bar as drawn: the lifetime it has left, in the countdown's color.
const lifetime = (color: string, bar: string) => `{"type":"Text","props":{"color":"${color}"},"children":["${bar}"]}`
const FULL = lifetime('green', '▰▰▰▰')

test('the band shows the cache lifetime left and the time until it expires', async ($, on) => {
  const text = await draw($, on, true, 6)
  expect(text).toContain('"caché "')
  expect(text).toContain(FULL)
  expect(text).toContain('"→54m"')
  // The hit is in the detail only.
  expect(text).not.toContain('95%')
})

test('the cache bar empties as its lifetime passes, in the countdown color', async ($, on) => {
  expect(await draw($, on, true, 30)).toContain(lifetime('green', '▰▰▱▱'))
})

test('the cache bar is red, with one mark, under a sixth of its lifetime', async ($, on) => {
  expect(await draw($, on, true, 52)).toContain(lifetime('red', '▰▱▱▱'))
})

test('the cache counts down from the 5m option', ttl('5m'), async ($, on) => {
  const text = await draw($, on, true, 4)
  expect(text).toContain('"→1m"')
})

// The countdown as drawn: its color, then the time left.
const countdown = (color: string, left: string) => `{"type":"Text","props":{"color":"${color}"},"children":["→${left}"]}`

test('the cache countdown is green while more than half its lifetime is left', async ($, on) => {
  expect(await draw($, on, true, 30)).toContain(countdown('green', '30m'))
})

test('the cache countdown turns orange under half its lifetime', async ($, on) => {
  expect(await draw($, on, true, 35)).toContain(countdown('#ff8700', '25m'))
})

test('the cache countdown turns red under a sixth of its lifetime', async ($, on) => {
  expect(await draw($, on, true, 52)).toContain(countdown('red', '8m'))
})

test('the 5m countdown scales the same thresholds', ttl('5m'), async ($, on) => {
  expect(await draw($, on, true, 3)).toContain(countdown('#ff8700', '2m'))
})

test('the cache shows as expired once its lifetime is over', ttl('5m'), async ($, on) => {
  const text = await draw($, on, true, 6)
  expect(text).toContain('" caducada"')
  expect(text).toContain(lifetime('inactive', '▱▱▱▱'))
  // No countdown: the one arrow left is ctx's.
  expect(text).not.toMatch(/"→\d+m"/)
})

// A detail's item as drawn: the name dimmed, then the value.
const item = (name: string, value: string) =>
  `{"type":"Text","props":{"dimColor":true},"children":["${name} "]},{"type":"Text","children":["${value}"]}`

const CTX = [['msgs', '9%'], ['sys', '8%'], ['tools', '5%']]
const CACHE = [['leído', '90k'], ['escrito', '4k'], ['nuevo', '1k']]

// ctx's figures: 23% used, so a bar of 77% free and 154k of 200k tokens left.
const CTX_BAR = '{"type":"Text","props":{"color":"green"},"children":["▰▰▰▱"]}'
const CTX_USED = '"ctx "]},{"type":"Text","props":{"color":"green"},"children":["23%"]}'

test('ctx shows a bar of what is free and the tokens left, with no percentage', async ($, on) => {
  const text = await draw($, on, true, 0)
  expect(text).toContain(CTX_BAR)
  expect(text).toContain('"→154k"')
  expect(text).not.toContain('23%')
})

test('a press on ctx swaps its figures for its used share and biggest rows, and only those', async ($, on) => {
  const ui = await mount($, on, true, 0)
  await ui.press({ key: 'ctx' })
  const text = JSON.stringify(await ui.drawn())
  expect(text).toContain(CTX_USED)
  for (const [name, value] of CTX) expect(text).toContain(item(name!, value!))
  expect(text).not.toContain('"→154k"')
  // The cache, not pressed, keeps its figures.
  expect(text).toContain(FULL)
  expect(text).not.toContain('leído')
  expect(text).not.toContain('"display":"none"')
})

test('a press on the cache swaps its figures for its use, and a second press back', async ($, on) => {
  const ui = await mount($, on, true, 0)
  await ui.press({ key: 'cache' })
  const text = JSON.stringify(await ui.drawn())
  for (const [name, value] of CACHE) expect(text).toContain(item(name!, value!))
  // The hit in its color first, the unit of the counts last.
  expect(text).toContain('"caché "]},{"type":"Text","props":{"color":"green"},"children":["95%"]}')
  expect(text).toContain('" tokens"')
  expect(text).not.toContain(FULL)
  expect(text).toContain('"→154k"')

  await ui.press({ key: 'cache' })
  const back = JSON.stringify(await ui.drawn())
  expect(back).toContain(FULL)
  expect(back).not.toContain('leído')
})

test('the band shows no detail until a press', async ($, on) => {
  const text = await draw($, on, true, 0)
  for (const [name] of [...CTX, ...CACHE]) expect(text).not.toContain(`"${name} "`)
})

test('without a breakdown, a press on ctx shows its used share alone', async ($, on) => {
  const ui = await mount($, on, false, 0)
  await ui.press({ key: 'ctx' })
  const text = JSON.stringify(await ui.drawn())
  expect(text).toContain(`${CTX_USED}]}`)
  expect(text).not.toContain('msgs')
})

test('the band keeps the cache after a measurement that is not a response', async ($, on) => {
  const text = await draw($, on, true, 6, 'rateLimits')
  expect(text).toContain(FULL)
})

test('the band shows no cache without a breakdown', async ($, on) => {
  const text = await draw($, on, false, 0)
  expect(text).not.toContain('caché')
  expect(text).toContain('ctx')
})
