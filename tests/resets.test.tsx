import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionUsage, Settings } from 'claude-code'

// Times in local time, as the band shows them, so the tests hold in any time zone.
// Saturday 17 October 2026, 8:00.
const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime()
const NOW = local(17, 8)
const iso = (at: number) => new Date(at).toISOString()

// Draws the band with the 5-hour limit resetting at `fiveHour` and the 7-day one
// on Tuesday 20 at 16:00, plus a spend limit, which has no reset.
const band = async ($: Engine, on: On, language: string, fiveHour = local(17, 10, 14)) => {
  const usage: SessionUsage = {
    startedAt: NOW,
    context: { window: 200000, percent: 23 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 28, resetsAt: iso(fiveHour) },
      { kind: 'seven_day', percentUsed: 52, resetsAt: iso(local(20, 16)) },
      { kind: 'spend_limit', percentUsed: 10 }
    ],
    cost: { usd: 0.42 }
  }
  on('settings.read', async () => ({ value: { language } as Settings }))
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

// A card's item as drawn: the limit's name dimmed, then its reset in its color
// (the 5-hour limit is 72% free, green; the 7-day one 48%, orange).
const item = (name: string, date: string, color: string) =>
  `{"type":"Text","props":{"dimColor":true},"children":["${name} "]},{"type":"Text","props":{"color":"${color}"},"children":["${date}"]}`

const GREEN = 'green'
const ORANGE = '#ff8700'

test('the limits share one tooltip, hidden until the pointer is over them', async ($, on) => {
  const text = await band($, on, 'es')
  // The limits are one keyed segment; its card hangs from its right edge.
  const limits = text.indexOf('"props":{"key":"limits"}')
  expect(limits).toBeGreaterThan(-1)
  expect(text.indexOf('"display":"none"},"hover":{"display":"flex"}', limits)).toBeGreaterThan(limits)
  expect(text).not.toContain('"scope"')
})

test('a limit with no reset has no date in the tooltip', async ($, on) => {
  const text = await band($, on, 'es')
  expect(text).not.toContain('"children":["Gasto "]')
})

test('the reset shows today, or the weekday and date', async ($, on) => {
  const text = await band($, on, 'es')
  expect(text).toContain(item('5h', 'hoy 10:14', GREEN))
  expect(text).toContain(item('7d', 'mar 20 oct 16:00', ORANGE))
})

test('a reset after midnight shows tomorrow', async ($, on) => {
  const text = await band($, on, 'es', local(18, 1, 30))
  expect(text).toContain(item('5h', 'mañana 1:30', GREEN))
})

test('English uses its own date order and a 12-hour clock', async ($, on) => {
  const text = await band($, on, 'en')
  expect(text).toContain(item('5h', 'today 10:14 AM', GREEN))
  expect(text).toContain(item('7d', 'Tue Oct 20 4:00 PM', ORANGE))
})

test('German writes the day with a period', async ($, on) => {
  const text = await band($, on, 'de')
  expect(text).toContain(item('7d', 'Di 20. Okt 16:00', ORANGE))
})
