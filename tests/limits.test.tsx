import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionUsage, Settings } from 'claude-code'

const NOW = Date.parse('2026-10-17T08:00:00Z')

// Draws the band with one limit of the kind given, in Spanish.
const band = async ($: Engine, on: On, kind: string) => {
  const usage: SessionUsage = {
    startedAt: NOW,
    context: { window: 200000, percent: 23 },
    rateLimits: [{ kind, percentUsed: 30 }],
    cost: { usd: 0.42 }
  }
  on('settings.read', async () => ({ value: { language: 'es' } as Settings }))
  on('session.usage', async () => ({ value: usage }))
  on('clock.now', async () => ({ value: NOW }))
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })

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

// The label of a limit as drawn: dimmed, before its bar.
const label = (text: string) => `{"type":"Text","props":{"dimColor":true},"children":[${JSON.stringify(text)}," "]}`

const cases: [string, string][] = [
  ['five_hour', '5h'],
  ['seven_day', '7d'],
  ['one_hour', '1h'],
  ['thirty_day', '30d'],
  ['30_day', '30d'],
  ['two_weeks', '2w'],
  ['spend_limit', 'Gasto'],
  ['burst_tokens', 'burst tokens']
]

for (const [kind, shown] of cases) {
  test(`the ${kind} limit shows as ${shown}`, async ($, on) => {
    const text = await band($, on, kind)
    expect(text).toContain(label(shown))
  })
}
