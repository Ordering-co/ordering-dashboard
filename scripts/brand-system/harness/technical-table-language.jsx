import { useLanguage as useBaseLanguage, useUtils as useBaseUtils } from './language'

export { IntegrationLogs } from '../../../src/@/components-dashboard/src/components/IntegrationLogs'

const isTechnicalTables = () => ['technical-tables', 'technical-table-consumers'].includes(new URLSearchParams(window.location.search).get('surface'))

export const useLanguage = () => useBaseLanguage()

export const useUtils = () => {
  const base = useBaseUtils()
  if (!isTechnicalTables()) return base
  return [{
    ...base[0],
    parseDate: (value, options = {}) => {
      globalThis.__OD_TECHNICAL_DATE_CALLS__ = [...(globalThis.__OD_TECHNICAL_DATE_CALLS__ || []), { options, value }]
      return `DATE:${value}:utc=${String(options.utc)}`
    }
  }]
}
