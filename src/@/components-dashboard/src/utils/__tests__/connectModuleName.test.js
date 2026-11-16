// the Connect module (a product area) is named «Connect», not the verb «connect».
// It was translated as a verb («Se connecter», «Connettiti»…); the button verb lives in CONNECT and stays translated.
// the fix never reached the screen. Catalog keys are unprefixed and the sync publishes them as DASHBOARD_<KEY>;
// asking t() for DASHBOARD_CONNECT strips the prefix it already carries and reads DASHBOARD_CONNECT, which is CONNECT, the verb. The
// module name now lives in CONNECT_MODULE.
import { describe, expect, it } from 'vitest'
import catalog from '../../../../../../i18n/translations.json'
import { getDashboardNavSections } from '../dashboardNavigation'

const LOCALES = ['ar', 'bg', 'da', 'de', 'el', 'en', 'es', 'fr', 'it', 'nl', 'pt', 'tr']

// The dictionary the API serves after `i18n:sync:live`: every catalog key with the app prefix.
const published = (locale) => Object.fromEntries(
  Object.entries(catalog).map(([key, entry]) => [`DASHBOARD_${key}`, entry[locale]])
)

// The lookup of LanguageContext's t() (contexts/LanguageContext/index.js), with app_internal_name 'dashboard'.
const runtimeT = (dictionary) => (key, fallback = null) => {
  const prefix = 'DASHBOARD_'
  let originalKey = key
  if (!key.startsWith(prefix)) key = `${prefix}${key}`
  else originalKey = key.substring(prefix.length)
  return dictionary[key] ?? dictionary[originalKey] ?? fallback ?? key
}

describe('Connect module name ()', () => {
  it.each(LOCALES)('CONNECT_MODULE.%s is the product name «Connect»', (locale) => {
    expect(catalog.CONNECT_MODULE[locale]).toBe('Connect')
  })

  it('CONNECT, the button verb, keeps its translations', () => {
    expect(catalog.CONNECT.fr).toBe('Se connecter')
    expect(catalog.CONNECT.it).toBe('Connettiti')
    expect(catalog.CONNECT.de).toBe('Verbinden')
  })

  it.each(['de', 'ar', 'fr'])('the sidebar and ⌘K section reads «Connect» with the %s dictionary the API serves', (locale) => {
    const t = runtimeT(published(locale))
    const sections = getDashboardNavSections({ t, user: { level: 0 }, configs: {} })
    expect(sections.connect.title).toBe('Connect')
  })

  it('reads «Connect» before the sync too (the key is not live yet)', () => {
    const t = runtimeT({ DASHBOARD_CONNECT: 'Verbinden' })
    expect(t('CONNECT_MODULE', 'Connect')).toBe('Connect')
  })
})
