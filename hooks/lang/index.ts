import { de } from './de'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import { it } from './it'
import { pt } from './pt'

// The languages of the band, by their code. To add one, write its file as the
// others are and list it here: its dates, and the names of the language the
// `language` setting may hold, come from Intl.
export const LANGS = { en, es, fr, de, pt, it }

export type Lang = keyof typeof LANGS

const CODES = Object.keys(LANGS) as Lang[]

// A name without case or accents, to compare it.
const plain = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Each language's name as Intl writes it in every language of the band
// (`spanish`, `espanol`, `spanisch`...), and the aliases its file adds.
// Built at the first lookup.
let names: Map<string, Lang> | undefined

const named = () => {
  if (!names) {
    names = new Map()
    for (const shown of CODES) {
      const display = new Intl.DisplayNames([shown], { type: 'language' })
      for (const code of CODES) {
        const name = display.of(code)
        if (name) names.set(plain(name), code)
      }
    }
    for (const code of CODES) {
      for (const alias of LANGS[code].aliases ?? []) names.set(plain(alias), code)
    }
  }
  return names
}

// The language a value of the free-text `language` setting, or of the plugin
// option, names: a code (`es`, `fr-FR`) or a name (`Español`, `German`).
export const toLang = (value: unknown): Lang | undefined => {
  if (typeof value !== 'string') return undefined
  const v = plain(value)
  const code = v.split(/[-_.\s]/)[0] ?? ''
  if (code in LANGS) return code as Lang
  return named().get(v) ?? named().get(code)
}
