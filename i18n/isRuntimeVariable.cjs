'use strict'

/**
 * Keys whose t() fallback is a runtime variable (not a static English string),
 * e.g. t('SIGNUP_DRIVER_EMAIL', contactEmail).
 *
 * These must not be translated via /translate-keys and must not fail
 * i18n:verify / i18n:missing / i18n:sync locale completeness gates.
 */

function isRuntimeVariableRow (row) {
  if (!row) return false
  const note = String(row.note || '')
  if (note.includes('runtime_variable_fallback')) return true
  return !(row.value && String(row.value).trim())
}

function isRuntimeVariableCatalogEntry (entry, sourceLang) {
  if (!entry || typeof entry !== 'object') return false
  const en = entry[sourceLang] != null ? String(entry[sourceLang]).trim() : ''
  return !en
}

module.exports = {
  isRuntimeVariableRow,
  isRuntimeVariableCatalogEntry
}
