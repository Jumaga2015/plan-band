import { expect, mock, test } from 'claude-code/testing'
import type { SessionContextBreakdown, SessionUsage, Settings } from 'claude-code'

const START = Date.parse('2026-10-17T08:00:00Z')
const WINDOW = 200000
const MINUTE = 60000

// The 5-hour limit resets two hours after START; the last response read 90k
// from the cache, wrote 4k and paid 1k, so the cache served 95% of it.
const BREAKDOWN = {
  categories: [{ name: 'Messages', tokens: 18000, color: 'text', isDeferred: false, kind: 'used' }],
  rawMaxTokens: WINDOW,
  apiUsage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 90000, cache_creation_input_tokens: 4000 }
} as unknown as SessionContextBreakdown

const USAGE: SessionUsage = {
  startedAt: START,
  context: { window: WINDOW, percent: 23, breakdown: BREAKDOWN },
  rateLimits: [{ kind: 'five_hour', percentUsed: 28, resetsAt: new Date(START + 120 * MINUTE).toISOString() }],
  cost: { usd: 0.42 }
} as SessionUsage

test('the countdowns move each minute with no new measurement', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  on('settings.read', async () => ({ value: { language: 'es' } as Settings }))
  on('session.usage', async () => ({ value: USAGE }))
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
  const before = JSON.stringify(await ui.drawn())
  expect(before).toContain('" →1h0m"')
  expect(before).toContain('" →","2h0m"')

  await clock.advance(6 * MINUTE)
  const after = JSON.stringify(await ui.drawn())
  expect(after).toContain('" →54m"')
  expect(after).toContain('" →","1h54m"')
})
