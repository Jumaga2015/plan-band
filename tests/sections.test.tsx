import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, PluginOptions, SessionContextBreakdown, SessionUsage, Settings } from 'claude-code'

const START = Date.parse('2026-10-17T08:00:00Z')
const WINDOW = 200000

const BREAKDOWN = {
  categories: [{ name: 'Messages', tokens: 18000, color: 'text', isDeferred: false, kind: 'used' }],
  rawMaxTokens: WINDOW,
  apiUsage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 90000, cache_creation_input_tokens: 4000 }
} as unknown as SessionContextBreakdown

const USAGE: SessionUsage = {
  startedAt: START,
  context: { window: WINDOW, percent: 23, breakdown: BREAKDOWN },
  rateLimits: [{ kind: 'five_hour', percentUsed: 28, resetsAt: new Date(START + 134 * 60000).toISOString() }],
  cost: { usd: 0.42 }
} as SessionUsage

const draw = async ($: Engine, on: On) => {
  on('settings.read', async () => ({ value: { language: 'es' } as Settings }))
  on('session.usage', async () => ({ value: USAGE }))
  on('clock.now', async () => ({ value: START }))
  on('session.measure', async (_, e) => ({ changed: e.changed }))

  const { rateLimits, cost } = USAGE
  await $.session.measure({ context: { window: WINDOW, percent: 23 }, rateLimits, cost, changed: ['cost'] })

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

const show = (options: PluginOptions): { options: PluginOptions } => ({ options })

// The marks of each section in the drawn tree.
const SECTIONS = { limits: '"5h"', cost: '"0.42"', ctx: '"ctx "', cache: '"caché "' } as const

test('every section shows by default', async ($, on) => {
  const text = await draw($, on)
  for (const mark of Object.values(SECTIONS)) expect(text).toContain(mark)
})

for (const [section, option] of [
  ['limits', 'showLimits'],
  ['cost', 'showCost'],
  ['ctx', 'showCtx'],
  ['cache', 'showCache']
] as const) {
  test(`${option} off hides the ${section} and only that`, show({ [option]: false }), async ($, on) => {
    const text = await draw($, on)
    expect(text).not.toContain(SECTIONS[section])
    for (const [other, mark] of Object.entries(SECTIONS)) {
      if (other !== section) expect(text).toContain(mark)
    }
  })
}

test('a band with every section off yields to the engine', show({
  showLimits: false, showCost: false, showCtx: false, showCache: false
}), async ($, on) => {
  // The test engine has no component of its own to yield to, so the yield
  // shows as the draw finding nothing to implement.
  let error: unknown
  try {
    await draw($, on)
  } catch (e) {
    error = e
  }
  expect(String(error)).toContain('no implementation for ui.render')
})
