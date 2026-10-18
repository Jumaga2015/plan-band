import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionUsage, Settings } from 'claude-code'

// Times in local time, as the band shows them, so the tests hold in any time zone.
// Saturday 17 October 2026, 8:00.
const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime()
const NOW = local(17, 8)
const iso = (at: number) => new Date(at).toISOString()

// Draws the band with the 5-hour limit resetting at `fiveHour` and the 7-day one
// on Tuesday 20 at 16:00, plus a spend limit, which has no reset. The limits
// named in `pressed` are pressed first, so they show their reset.
const band = async ($: Engine, on: On, language: string, pressed: string[], fiveHour = local(17, 10, 14)) => {
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
  for (const kind of pressed) {
    await ui.press({ key: `limit:${kind}` })
  }
  return { ui, text: JSON.stringify(await ui.drawn()) }
}

// A limit's detail as drawn: its name dimmed, the free percentage in its color,
// then the date it resets, dimmed (the 5-hour limit is 72% free, green; the
// 7-day one 48%, orange).
const item = (name: string, date: string, color: string) =>
  `{"type":"Text","props":{"dimColor":true},"children":["${name} "]},`
  + `{"type":"Text","props":{"color":"${color}"},"children":["${color === GREEN ? 72 : 48}%"]},`
  + `{"type":"Text","props":{"dimColor":true},"children":[" →${date}"]}`

const GREEN = 'green'
const ORANGE = '#ff8700'

test('a limit shows its bar and countdown, with no percentage', async ($, on) => {
  const { text } = await band($, on, 'es', [])
  expect(text).toContain('{"type":"Text","props":{"color":"green"},"children":["▰▰▰▱"]}')
  expect(text).toContain('"→","2h14m"')
  expect(text).not.toContain('72%')
})

test('each limit swaps its figures for its reset on its own press', async ($, on) => {
  const { text } = await band($, on, 'es', ['five_hour'])
  expect(text).toContain(item('5h', 'hoy 10:14', GREEN))
  expect(text).not.toContain('"→","2h14m"')
  // The 7-day limit, not pressed, keeps its figures.
  expect(text).not.toContain('mar 20 oct')
  expect(text).toContain('"→","3d8h"')
  expect(text).not.toContain('"display":"none"')
})

test('a second press brings the figures back', async ($, on) => {
  const { ui } = await band($, on, 'es', ['five_hour'])
  await ui.press({ key: 'limit:five_hour' })
  const text = JSON.stringify(await ui.drawn())
  expect(text).not.toContain('hoy 10:14')
  expect(text).toContain('"→","2h14m"')
})

test('a limit with no reset shows only its percentage when pressed', async ($, on) => {
  const { text } = await band($, on, 'es', ['spend_limit'])
  expect(text).toContain(
    '{"type":"Text","props":{"dimColor":true},"children":["Gasto "]},{"type":"Text","props":{"color":"green"},"children":["90%"]}]}'
  )
})

test('the reset shows today, or the weekday and date', async ($, on) => {
  const { text } = await band($, on, 'es', ['five_hour', 'seven_day'])
  expect(text).toContain(item('5h', 'hoy 10:14', GREEN))
  expect(text).toContain(item('7d', 'mar 20 oct 16:00', ORANGE))
})

test('a reset after midnight shows tomorrow', async ($, on) => {
  const { text } = await band($, on, 'es', ['five_hour'], local(18, 1, 30))
  expect(text).toContain(item('5h', 'mañana 1:30', GREEN))
})

test('English uses its own date order and a 12-hour clock', async ($, on) => {
  const { text } = await band($, on, 'en', ['five_hour', 'seven_day'])
  expect(text).toContain(item('5h', 'today 10:14 AM', GREEN))
  expect(text).toContain(item('7d', 'Tue Oct 20 4:00 PM', ORANGE))
})

test('the date drops the commas and periods Intl writes', async ($, on) => {
  const { text } = await band($, on, 'de', ['seven_day'])
  expect(text).toContain(item('7d', 'Di 20 Okt 16:00', ORANGE))
})

test('Portuguese drops the de between day and month', async ($, on) => {
  const { text } = await band($, on, 'pt', ['five_hour', 'seven_day'])
  expect(text).toContain(item('5h', 'hoje 10:14', GREEN))
  expect(text).toContain(item('7d', 'ter 20 out 16:00', ORANGE))
})
