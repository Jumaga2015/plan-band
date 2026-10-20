import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionUsage, Settings } from 'claude-code'

// Saturday 17 October 2026, 8:00, in local time.
const NOW = new Date(2026, 9, 17, 8).getTime()
const MINUTE = 60000
const iso = (minutes: number) => new Date(NOW + minutes * MINUTE).toISOString()

// Draws the band with the 5-hour limit at `used`% and resetting in `resetsIn`
// minutes, and a spend limit, which has no window.
const band = async ($: Engine, on: On, language: string, used: number, resetsIn: number) => {
  const usage: SessionUsage = {
    startedAt: NOW,
    context: { window: 200000, percent: 23 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: used, resetsAt: iso(resetsIn) },
      { kind: 'spend_limit', percentUsed: 10 }
    ],
    cost: { usd: 0.42 }
  }
  on('settings.read', async () => ({ value: { language } as Settings }))
  on('session.usage', async () => ({ value: usage }))
  on('clock.now', async () => ({ value: NOW }))
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })

  return $.ui.mount({
    plugin: 'plan-band',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} }
  })
}

const drawn = async (ui: Awaited<ReturnType<typeof band>>) => JSON.stringify(await ui.drawn())

const press = async (ui: Awaited<ReturnType<typeof band>>, key: string, times: number) => {
  for (let i = 0; i < times; i++) {
    await ui.press({ key })
  }
}

const FIVE_HOUR = 'limit:five_hour'

// The ETA as drawn: "ETA ", then "en" and the time left, in red.
const runsOut = (time: string) =>
  '{"type":"Text","props":{"dimColor":true},"children":["ETA "]},'
  + '{"type":"Text","children":[{"type":"Text","props":{"dimColor":true},"children":["en "]},'
  + `{"type":"Text","props":{"color":"red"},"children":["${time}"]}]}`

test('the second press shows when the limit runs out at the pace so far', async ($, on) => {
  // 80% used after 3 of the 5 hours: the 20% left lasts 45 minutes, not the 2 hours to go.
  const ui = await band($, on, 'es', 80, 120)
  await press(ui, FIVE_HOUR, 2)
  const text = await drawn(ui)
  expect(text).toContain(runsOut('45m'))
  expect(text).not.toContain('80%')
  expect(text).not.toContain('20%')
})

test('the ETA says the limit lasts when it would not run out before it resets', async ($, on) => {
  // 28% used after 3 of the 5 hours: it would take more than the 2 hours to go.
  const ui = await band($, on, 'es', 28, 120)
  await press(ui, FIVE_HOUR, 2)
  expect(await drawn(ui)).toContain('{"type":"Text","props":{"color":"green"},"children":["alcanza"]}')
})

test('the ETA is in the language of the band', async ($, on) => {
  const ui = await band($, on, 'en', 80, 120)
  await press(ui, FIVE_HOUR, 2)
  expect(await drawn(ui)).toContain('"children":["in "]')
})

test('the third press brings the figures back, and the cycle goes on', async ($, on) => {
  const ui = await band($, on, 'es', 80, 120)
  await press(ui, FIVE_HOUR, 3)
  const text = await drawn(ui)
  expect(text).not.toContain('"ETA "')
  expect(text).toContain('"→","2h0m"')

  await press(ui, FIVE_HOUR, 2)
  expect(await drawn(ui)).toContain(runsOut('45m'))
})

test('a limit with too little of its window passed has no ETA', async ($, on) => {
  // 5 minutes into the 5 hours there is no pace to go on: two presses, back to the figures.
  const ui = await band($, on, 'es', 10, 295)
  await press(ui, FIVE_HOUR, 2)
  const text = await drawn(ui)
  expect(text).not.toContain('"ETA "')
  expect(text).toContain('"→"')
})

test('a limit with no window keeps two forms: figures and detail', async ($, on) => {
  const ui = await band($, on, 'es', 80, 120)
  await press(ui, 'limit:spend_limit', 1)
  expect(await drawn(ui)).toContain('"90%"')

  await press(ui, 'limit:spend_limit', 1)
  const text = await drawn(ui)
  expect(text).not.toContain('"ETA "')
  expect(text).not.toContain('"90%"')
})
