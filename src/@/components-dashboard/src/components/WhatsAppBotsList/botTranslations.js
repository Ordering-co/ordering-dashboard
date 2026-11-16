export const CHATBOT_TRANSLATION_LOCALES = ['en', 'es', 'fr', 'ar']

export const translationPlaceholderToken = (placeholder) => `{{${placeholder}}}`

export const getTranslationCatalogGroups = (catalog) => Array.from(new Set(
  Object.values(catalog || {})
    .map(entry => entry?.group)
    .filter(group => typeof group === 'string' && group.trim() !== '')
))

export const normalizeTranslationCatalog = (result) => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return {}
  return Object.fromEntries(Object.entries(result).filter(([, entry]) => (
    entry &&
    typeof entry === 'object' &&
    typeof entry.default === 'string' &&
    typeof entry.label === 'string' &&
    typeof entry.group === 'string'
  )).map(([key, entry]) => [key, {
    value: typeof entry.value === 'string' ? entry.value : entry.default,
    default: entry.default,
    maxLength: Number.isFinite(entry.maxLength) ? entry.maxLength : null,
    isCustom: entry.isCustom === true,
    label: entry.label,
    group: entry.group,
    placeholders: Array.isArray(entry.placeholders) ? entry.placeholders.map(String) : []
  }]))
}

export const createTranslationDraft = (catalog) => Object.fromEntries(
  Object.entries(catalog || {}).map(([key, entry]) => [key, entry.isCustom ? entry.value : ''])
)

export const buildTranslationPatch = (catalog, draft) => {
  const patch = {}
  Object.entries(catalog || {}).forEach(([key, entry]) => {
    const value = typeof draft?.[key] === 'string' ? draft[key] : ''
    if (entry.isCustom) {
      if (value === entry.value) return
      patch[key] = value === '' ? null : value
      return
    }
    if (value === '' || value === entry.default) return
    patch[key] = value
  })
  return patch
}

export const validateTranslationDraft = (catalog, draft) => {
  const errors = {}
  Object.entries(catalog || {}).forEach(([key, entry]) => {
    const draftValue = typeof draft?.[key] === 'string' ? draft[key] : ''
    const value = draftValue === '' ? entry.default : draftValue
    const missingPlaceholders = entry.placeholders.filter(placeholder => (
      !value.includes(translationPlaceholderToken(placeholder))
    ))
    const overLimit = Number.isFinite(entry.maxLength) && Array.from(value).length > entry.maxLength
    if (missingPlaceholders.length || overLimit) {
      errors[key] = { missingPlaceholders, overLimit }
    }
  })
  return errors
}

export const applyTranslationPatch = (catalog, patch) => Object.fromEntries(
  Object.entries(catalog || {}).map(([key, entry]) => {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) return [key, entry]
    const value = patch[key]
    return [key, value === null
      ? { ...entry, value: entry.default, isCustom: false }
      : { ...entry, value, isCustom: true }]
  })
)
