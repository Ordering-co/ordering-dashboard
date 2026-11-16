import { IMPORTER_CARDS } from './importerCards'

/**
 * Pure helpers of the Logs tab of the store panel of /connect/importers (redesign IM-B, ). They carry the rules of
 * `Connect/ImportersPanel/ImportRawLogsTab` (main) that need no React: the filter options, the size text, the status family,
 * and the selection arithmetic. No request and no text of its own beyond the keys of main.
 */

// «All» and the four importers, in the order of the cards (IM-05, decision 35: they are the options of a select)
export const SOURCE_FILTERS = [
  // redesign IM-17: main's IMPORTER_LOGS_FILTER_ALL was never in the catalog («All» in English in every locale); ALL is the
  // catalog's «All» in the 12 locales
  { id: 'all', labelKey: 'ALL', labelDefault: 'All' },
  ...IMPORTER_CARDS.map((card) => ({
    id: card.id,
    labelKey: card.titleKey,
    labelDefault: card.titleDefault
  }))
]

export const cardBySource = Object.fromEntries(IMPORTER_CARDS.map((card) => [card.id, card]))

export const formatBytes = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// The family of Product's Status for each status of a log: Ready is done, Too large and Duplicate are warnings, Failed is an error.
// Anything else (a status the service adds later) reads neutral, with its own word.
export const statusFamily = (status) => {
  switch (status) {
    case 'ready':
      return 'done'
    case 'skipped_too_large':
    case 'skipped_duplicate':
      return 'pending'
    case 'failed':
      return 'cancel'
    default:
      return 'progress'
  }
}

export const statusCopy = (status, t) => {
  switch (status) {
    case 'ready':
      return t('IMPORTER_LOGS_STATUS_READY', 'Ready')
    case 'skipped_too_large':
      return t('IMPORTER_LOGS_STATUS_SKIPPED_TOO_LARGE', 'Too large')
    case 'skipped_duplicate':
      return t('IMPORTER_LOGS_STATUS_SKIPPED_DUPLICATE', 'Duplicate')
    case 'failed':
      return t('IMPORTER_LOGS_STATUS_FAILED', 'Failed')
    default:
      return status || '—'
  }
}

// redesign IM-06: the service sends an ISO instant (`2026-07-28T12:00:00Z`). `parseDate` of the project takes a Date as is
// (moment reads a Date before its input formats) and paints it in the project's format and the user's zone. null when there is no
// usable date.
export const logStamp = (createdAt) => {
  if (!createdAt) return null
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? null : date
}

// The selection is only ever of what is visible (main trims it when the filter changes)
export const visibleSelection = (selectedIds, visibleIds) => selectedIds.filter((id) => visibleIds.includes(id))

// true when every visible log is selected, 'mixed' when some, false when none (or there is nothing to select)
export const selectionState = (selectedIds, visibleIds) => {
  if (!visibleIds.length) return false
  const chosen = visibleIds.filter((id) => selectedIds.includes(id)).length
  if (chosen === 0) return false
  return chosen === visibleIds.length ? true : 'mixed'
}
