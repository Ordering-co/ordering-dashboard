import { useMemo } from 'react'
import labels from './sourceCodeTranslations.generated.json'

const hasText = value => typeof value === 'string' && value.trim().length > 0
const supportedLocales = new Set(Object.keys(Object.values(labels)[0] || {}))

export const getSourceCodeLocale = language => {
  const code = typeof language === 'string' ? language : language?.code
  const normalized = String(code || 'en').trim().replaceAll('_', '-').toLowerCase()
  if (supportedLocales.has(normalized)) return normalized
  const base = normalized.split('-')[0]
  return supportedLocales.has(base) ? base : 'en'
}

export const createSourceCodeTranslator = (apiTranslator, language) => {
  const locale = getSourceCodeLocale(language)
  return (key, fallback = null) => {
    const originalKey = typeof key === 'string' && key.startsWith('DASHBOARD_') ? key.slice('DASHBOARD_'.length) : key
    if (!Object.prototype.hasOwnProperty.call(labels, originalKey)) return apiTranslator(key, fallback)
    const entry = labels[originalKey]
    const localFallback = hasText(entry[locale]) ? entry[locale] : hasText(entry.en) ? entry.en : hasText(fallback) ? fallback : key
    // Keep the provider's namespace and API precedence. Only an empty label
    // from that provider is rejected, and only for these owned source keys.
    const translated = apiTranslator(key, localFallback)
    return hasText(translated) ? translated : localFallback
  }
}

export const useSourceCodeTranslator = (apiTranslator, language) => {
  const locale = getSourceCodeLocale(language)
  return useMemo(() => createSourceCodeTranslator(apiTranslator, locale), [apiTranslator, locale])
}
