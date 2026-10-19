import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionContextBreakdown, SessionUsage, Settings } from 'claude-code'

const START = Date.parse('2026-10-17T08:00:00Z')
const WINDOW = 200000

const BREAKDOWN = {
  categories: [{ name: 'Messages', tokens: 18000, color: 'text', isDeferred: false, kind: 'used' }],
  rawMaxTokens: WINDOW,
  apiUsage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 90000, cache_creation_input_tokens: 4000 }
} as unknown as SessionContextBreakdown

// Two limits, the cost, ctx and the cache: four segments with a detail.
const USAGE: SessionUsage = {
  startedAt: START,
  context: { window: WINDOW, percent: 23, breakdown: BREAKDOWN },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 28, resetsAt: new Date(START + 134 * 60000).toISOString() },
    { kind: 'seven_day', percentUsed: 52, resetsAt: new Date(START + 78 * 60 * 60000).toISOString() }
  ],
  cost: { usd: 0.42 }
} as SessionUsage

// Draws the band on each surface, with the Spanish setting.
const bands = async ($: Engine, on: On) => {
  on('settings.read', async () => ({ value: { language: 'es' } as Settings }))
  on('session.usage', async () => ({ value: USAGE }))
  on('clock.now', async () => ({ value: START }))
  on('session.measure', async (_, e) => ({ changed: e.changed }))

  const { rateLimits, cost } = USAGE
  await $.session.measure({ context: { window: WINDOW, percent: 23 }, rateLimits, cost, changed: ['cost'] })

  const texts: Record<string, string> = {}
  for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    const ui = await $.ui.mount({
      plugin: 'plan-band',
      surface,
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
    texts[surface] = JSON.stringify(await ui.drawn())
  }
  return texts
}

const count = (text: string, part: string) => text.split(part).length - 1

// ctx's bar and the 5-hour limit's, as drawn: their color, then their marks.
const GREEN_BAR = '{"type":"Text","props":{"color":"green"},"children":["▰▰▰▱"]}'

test('the terminal draws a button for each segment with a detail, and no card', async ($, on) => {
  const { terminal } = await bands($, on)
  expect(count(terminal!, '"type":"Button"')).toBe(4)
  expect(terminal).not.toContain('"hover"')
  expect(terminal).not.toContain('"position":"absolute"')
})

test('the terminal draws a pressed detail in the band colors: words dim, figures in their color', async ($, on) => {
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
    props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} }
  })
  await ui.press({ key: 'limit:five_hour' })
  const text = JSON.stringify(await ui.drawn())
  expect(text).toContain('{"type":"Text","props":{"dimColor":true},"children":["5h "]}')
  expect(text).toContain('{"type":"Text","props":{"color":"green"},"children":["72%"]}')
  expect(text).not.toContain('"weight"')
})

test('desktop draws no button, which would hide the colors under a native one', async ($, on) => {
  const { desktop } = await bands($, on)
  expect(desktop).not.toContain('"type":"Button"')
  // The bars keep their colors, as on the terminal.
  expect(desktop).toContain(GREEN_BAR)
  expect(desktop).toContain('"color":"#ff8700"')
})

for (const surface of ['desktop', 'vscode']) {
  test(`${surface} draws no card over the band`, async ($, on) => {
    const text = (await bands($, on))[surface]!
    expect(text).not.toContain('"hover"')
    expect(text).not.toContain('"position":"absolute"')
  })
}

test('desktop draws each segment with a detail as a Client of the plugin', async ($, on) => {
  const { desktop } = await bands($, on)
  // The two limits, ctx and the cache; the cost has no detail.
  expect(count(desktop!, '"type":"Client"')).toBe(4)
  expect(desktop).toContain('"module":"hooks/segment.tsx"')
})

test('vscode, with no Client, makes only the name of each segment with a detail a button', async ($, on) => {
  const { vscode } = await bands($, on)
  expect(vscode).not.toContain('"type":"Client"')
  // The two limits, ctx and the cache; the cost has no detail.
  expect(count(vscode!, '"type":"Button"')).toBe(4)
  expect(vscode).toContain('"label":"5h"')
  expect(vscode).toContain('"label":"ctx"')
  // The figures stay outside the buttons, in their colors, so a native button cannot hide them.
  expect(vscode).toContain(GREEN_BAR)
  expect(vscode).toContain('"color":"#ff8700"')
})

test('on vscode a press on the name swaps a segment for its detail, and the next one back', async ($, on) => {
  on('settings.read', async () => ({ value: { language: 'es' } as Settings }))
  on('session.usage', async () => ({ value: USAGE }))
  on('clock.now', async () => ({ value: START }))
  on('session.measure', async (_, e) => ({ changed: e.changed }))
  const { rateLimits, cost } = USAGE
  await $.session.measure({ context: { window: WINDOW, percent: 23 }, rateLimits, cost, changed: ['cost'] })

  const ui = await $.ui.mount({
    plugin: 'plan-band',
    surface: 'vscode',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} }
  })
  expect(JSON.stringify(await ui.drawn())).toContain('"2h14m"')

  await ui.press({ key: 'limit:five_hour' })
  const detail = JSON.stringify(await ui.drawn())
  expect(detail).toContain('{"type":"Text","props":{"color":"green"},"children":["72%"]}')
  expect(detail).not.toContain('"2h14m"')

  await ui.press({ key: 'limit:five_hour' })
  expect(JSON.stringify(await ui.drawn())).toContain('"2h14m"')
})

test('on the desktop a click swaps a segment for its detail, in the band colors, and the next one back', async ($, on) => {
  on('settings.read', async () => ({ value: { language: 'es' } as Settings }))
  on('session.usage', async () => ({ value: USAGE }))
  on('clock.now', async () => ({ value: START }))
  on('session.measure', async (_, e) => ({ changed: e.changed }))
  const { rateLimits, cost } = USAGE
  await $.session.measure({ context: { window: WINDOW, percent: 23 }, rateLimits, cost, changed: ['cost'] })

  const ui = await $.ui.mount({
    plugin: 'plan-band',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} }
  })
  const segment = async () => JSON.stringify(await ui.drawn({ in: 'limit:five_hour' }))
  const click = async () => {
    await ui.pointer({ type: 'down', x: 1, y: 0, button: 'left', in: 'limit:five_hour' })
    await ui.pointer({ type: 'up', x: 1, y: 0, button: 'left', in: 'limit:five_hour' })
  }

  expect(await segment()).toContain('"2h14m"')
  await click()
  const detail = await segment()
  expect(detail).toContain('{"type":"Text","props":{"dimColor":true},"children":["5h "]}')
  expect(detail).toContain('{"type":"Text","props":{"color":"green"},"children":["72%"]}')
  expect(detail).not.toContain('2h14m')
  await click()
  expect(await segment()).toContain('2h14m')
})
