import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// redesign tanda AB (U-1, C-1): the live dictionary of the API carries these keys with the old
// Title Case / wrong English, and it wins over the repo. So the text moves to new keys (as tanda Y did with
// PROMOTION_START_DATE) and the old keys leave the catalog once nothing reads them.
const root = process.cwd()
const catalog = JSON.parse(readFileSync(resolve(root, 'i18n/translations.json'), 'utf8'))
const legacy = JSON.parse(readFileSync(resolve(root, 'dashboard-translations.json'), 'utf8')).translation
const { sourceLanguage, supportedLocales } = JSON.parse(readFileSync(resolve(root, 'i18n/config.json'), 'utf8'))
const locales = [sourceLanguage, ...supportedLocales]

const NEW_KEYS = {
  TEMPORARY_DRIVER: 'Temporary driver',
  USE_ADVANCED_LOGISTICS: 'Use advanced logistics',
  SECOND_LAST_NAME: 'Second last name',
  PURCHASED_ADD_ONS: 'Purchased add-ons',
  ADVANCED_SETTINGS_TITLE: 'Advanced settings',
  VISIT_MY_WEBSITE_LINK: 'Visit my website',
  SALES_CHANNELS_TITLE: 'Sales channels'
}
const OLD_KEYS = ['DRIVER_TEMPORAL', 'USE_ADVANCED_LOGISTIC', 'PURCHASED_ADDONS', 'ADVANCED_SETTINGS', 'VISIT_MY_WEBSITE', 'SALES_CHANNELS']

const readers = key => {
  try {
    return execFileSync('git', ['grep', '-l', '-E', `['"\`]${key}['"\`]`, '--', 'src', ':!**/__tests__/**', ':!**/*.test.*'], { cwd: root, encoding: 'utf8' }).trim()
  } catch (error) {
    if (error.status === 1) return '' // no match
    throw error
  }
}

describe('tanda AB copy keys', () => {
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
