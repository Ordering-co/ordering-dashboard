import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// redesign tanda AG (A3-2, A3-3 and the catalog copy of rubric-3 § 6): the live dictionary of the API carries these keys
// in Title Case or with the wrong word, and it wins over the repo. So the text moves to new keys (as tandas Y, AB and AC did) and the
// old keys leave both catalogs once nothing reads them. Brands has one name, the menu's (BRANDS), and the tab of /purchase/addons
// reads the key of its H1, which the live dictionary does not carry.
const root = process.cwd()
const catalog = JSON.parse(readFileSync(resolve(root, 'i18n/translations.json'), 'utf8'))
const legacy = JSON.parse(readFileSync(resolve(root, 'dashboard-translations.json'), 'utf8')).translation
const { sourceLanguage, supportedLocales } = JSON.parse(readFileSync(resolve(root, 'i18n/config.json'), 'utf8'))
const locales = [sourceLanguage, ...supportedLocales]

const NEW_KEYS = {
  BUSINESS_FEES_TITLE: 'Business fees',
  BUSINESS_PAYMENT_ACCOUNT_TITLE: 'Business payment account',
  DELIVERY_ZONES_TITLE: 'Delivery zones',
  TEMPORARY_SCHEDULE: 'Temporary schedule',
  TEMPORARY_DOMAIN: 'Temporary domain'
}
const OLD_KEYS = ['BUSINESS_FEES', 'BUSINESS_PAYMENT_ACCOUNT', 'DELIVERY_ZONES', 'TEMPORAL_SCHEDULE', 'TEMPORAL_DOMAIN', 'BRAND_MANAGER']

const readers = key => {
  try {
    return execFileSync('git', ['grep', '-l', '-E', `['"\`]${key}['"\`]`, '--', 'src', ':!**/__tests__/**', ':!**/*.test.*'], { cwd: root, encoding: 'utf8' }).trim()
  } catch (error) {
    if (error.status === 1) return '' // no match
    throw error
  }
}

describe('tanda AG copy keys', () => {
  it.each(Object.entries(NEW_KEYS))('%s says «%s» and has every locale', (key, english) => {
    expect(catalog[key]?.en).toBe(english)
    expect(legacy[key]).toBe(english)
    for (const locale of locales) expect(catalog[key]?.[locale], `${key}.${locale}`).toBeTruthy()
  })

  it.each(OLD_KEYS)('%s has no reader left and is gone from both catalogs', key => {
    expect(readers(key)).toBe('')
    expect(catalog[key]).toBeUndefined()
    expect(legacy[key]).toBeUndefined()
  })
})
