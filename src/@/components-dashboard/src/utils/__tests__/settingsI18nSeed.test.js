import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SETTINGS_CATEGORY_COPY, SETTINGS_GROUPS, SETTINGS_SPECIAL_SCREENS } from '../settingsIa'
import { seedSettingsI18n } from '../settingsI18nSeed'

// the hub passes these keys to t() from a variable, which the i18n:generate scanner cannot see. Each one
// must be seeded literally in settingsI18nSeed.js and present in the repo catalog with every locale filled.
const catalog = JSON.parse(readFileSync(resolve(process.cwd(), 'i18n/translations.json'), 'utf8'))
const locales = JSON.parse(readFileSync(resolve(process.cwd(), 'i18n/config.json'), 'utf8')).supportedLocales

const collectKeys = (value, keys = new Set()) => {
  if (Array.isArray(value)) value.forEach(item => collectKeys(item, keys))
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([name, item]) => {
      if ((name === 'labelKey' || name === 'descriptionKey') && typeof item === 'string') keys.add(item)
      else collectKeys(item, keys)
    })
  }
  return keys
}

const iaKeys = [...collectKeys([SETTINGS_GROUPS, SETTINGS_CATEGORY_COPY, SETTINGS_SPECIAL_SCREENS])]

const seeded = new Set()
seedSettingsI18n(key => { seeded.add(key) })

describe('settingsI18nSeed', () => {
  it('finds the hub copy keys of settingsIa', () => {
    expect(iaKeys.length).toBeGreaterThan(50)
  })

  it('seeds every labelKey and descriptionKey of settingsIa', () => {
    expect(iaKeys.filter(key => !seeded.has(key) && !catalog[key])).toEqual([])
  })

  it('has every hub copy key in the catalog, in English and in every locale', () => {
    const missing = iaKeys.filter(key => !catalog[key]?.en || locales.some(locale => !catalog[key]?.[locale]))
    expect(missing).toEqual([])
  })
})
