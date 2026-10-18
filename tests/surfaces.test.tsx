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

for (const surface of ['desktop', 'vscode']) {
  test(`${surface} draws no button, which would hide the colors under a native one`, async ($, on) => {
    const text = (await bands($, on))[surface]!
    expect(text).not.toContain('"type":"Button"')
    // The bars keep their colors, as on the terminal.
    expect(text).toContain(GREEN_BAR)
    expect(text).toContain('"color":"#ff8700"')
  })

  test(`${surface} reveals the detail of each segment as a card on hover`, async ($, on) => {
    const text = (await bands($, on))[surface]!
    // A card for each of the two limits, ctx and the cache; none for the cost.
    expect(count(text, '"hover":{"display":"flex"}')).toBe(4)
    expect(count(text, '"display":"none"')).toBe(4)
    expect(count(text, '"position":"absolute"')).toBe(4)
    for (const detail of ['"72%"', '"48%"', '"23%"', '"95%"', '"leído "']) expect(text).toContain(detail)
  })

  test(`${surface} gives the card a background of the theme, inverted`, async ($, on) => {
    const text = (await bands($, on))[surface]!
    expect(count(text, '"backgroundColor":"text"')).toBe(4)
    expect(count(text, '"color":"inverseText"')).toBe(4)
  })

  test(`${surface} draws the card's text in its one inverted color, figures in bold`, async ($, on) => {
    const text = (await bands($, on))[surface]!
    // Each card, from its inverted text to the space that closes it: nothing
    // dimmed or colored.
    for (const card of text.split('"color":"inverseText"').slice(1)) {
      const inside = card.split('" "]}')[0]!
      expect(inside).not.toContain('"dimColor"')
      expect(inside).not.toContain('"color"')
    }
    expect(text).toContain('"props":{"weight":"bold","bold":true},"children":["72%"]}')
  })

  test(`${surface} hangs the cards of ctx and the cache from their right edge`, async ($, on) => {
    const text = (await bands($, on))[surface]!
    expect(count(text, '"right":0')).toBe(2)
    expect(count(text, '"left":0')).toBe(2)
  })
}
