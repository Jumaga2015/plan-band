import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, PluginOptions, SessionUsage, Settings } from 'claude-code'

const NOW = Date.parse('2026-10-17T08:00:00Z')

const USAGE: SessionUsage = {
  startedAt: NOW,
  context: { window: 200000, percent: 23 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 28, resetsAt: '2026-10-17T10:14:00Z' },
    { kind: 'seven_day', percentUsed: 52, resetsAt: '2026-10-20T14:00:00Z' },
    { kind: 'spend_limit', percentUsed: 75 }
  ],
  cost: { usd: 0.42 }
}

const SURFACES = ['terminal', 'desktop'] as const

// Draws the band once on each surface, with the Claude Code `language` setting given.
// With `cleared`, the band gets its figures from a measurement alone, as after a
// `/clear`, which fires no `session.start`.
const bands = async ($: Engine, on: On, language: string | undefined, cleared = false) => {
  on('settings.read', async () => ({ value: { language } as Settings }))
  on('session.usage', async () => ({ value: USAGE }))
  on('clock.now', async () => ({ value: NOW }))
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('session.measure', async (_, e) => ({ changed: e.changed }))

  if (cleared) {
    const { context, rateLimits, cost } = USAGE
    await $.session.measure({ context, rateLimits, cost, changed: ['rateLimits'] })
  } else {
    await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  }

  const texts: string[] = []
  for (const surface of SURFACES) {
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
    texts.push(JSON.stringify(await ui.drawn()))
  }
  return texts
}

// Counts the word as a whole string of the drawn tree.
const count = (text: string, word: string) => text.split(JSON.stringify(word)).length - 1

const cases: [string, PluginOptions | undefined, string | undefined, string][] = [
  ['auto follows the language setting', undefined, 'es', 'Gasto'],
  ['auto reads a language name with accents', undefined, 'Español', 'Gasto'],
  ['auto is English without a language setting', undefined, undefined, 'Spend'],
  ['auto is English for an unsupported language', undefined, 'japanese', 'Spend'],
  ['the plugin option wins over the setting', { language: 'en' }, 'es', 'Spend'],
  ['the plugin option takes a region code', { language: 'fr-FR' }, 'es', 'Dépenses']
]

for (const [name, options, setting, spend] of cases) {
  test(name, options ? { options } : {}, async ($, on) => {
    for (const text of await bands($, on, setting)) {
      expect(count(text, spend)).toBe(1)
      expect(count(text, '5h')).toBe(1)
      expect(count(text, '7d')).toBe(1)
    }
  })
}

test('the band keeps the language after a /clear', async ($, on) => {
  for (const text of await bands($, on, 'es', true)) {
    expect(count(text, 'Gasto')).toBe(1)
  }
})
