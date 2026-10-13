/* eslint-env node */
'use strict'

const SOURCE_CODE_TRANSLATIONS_PATH = 'src/@/components-dashboard/src/components/SourceCodeDownloads/sourceCodeTranslations.generated.json'

// Copy only this feature's canonical labels; never invent locale values.
function buildSourceCodeTranslations (catalog, config) {
  const locales = [config.sourceLanguage, ...config.supportedLocales]
  const subset = {}
  for (const key of Object.keys(catalog).filter(key => key.startsWith('SOURCE_CODE_')).sort()) {
    subset[key] = Object.fromEntries(locales.map(locale => [locale, catalog[key][locale] ?? '']))
  }
  return subset
}

module.exports = { buildSourceCodeTranslations, SOURCE_CODE_TRANSLATIONS_PATH }
