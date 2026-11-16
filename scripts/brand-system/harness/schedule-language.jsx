// Narrow local hooks for the schedule fixture; no SDK, storage, or service effects.
import {
  useConfig as useBaseConfig,
  useLanguage as useBaseLanguage,
  useSession as useBaseSession,
  useUtils as useBaseUtils
} from './language'

export { Schedule } from '../../../src/@/components-dashboard/src/components/Schedule'

const isScheduleSurface = () => ['schedules', 'schedule-consumers'].includes(new URLSearchParams(window.location.search).get('surface'))
const formatLocalDate = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const useLanguage = () => useBaseLanguage()
export const useSession = () => useBaseSession()
export const useConfig = () => {
  const base = useBaseConfig()
  if (!isScheduleSurface()) return base
  const override = globalThis.__OD_SCHEDULE_CONSUMER_CONFIG__
  if (override) return override
  const query = new URLSearchParams(window.location.search)
  const is12Hours = query.get('hour') === '12'
  return [{
    configs: {
      general_hour_format: { value: is12Hours ? 'hh:mm A' : 'HH:mm' },
      ...(query.get('surface') === 'schedule-consumers' ? { allow_driver_manager_update_driver_schedule: { value: '0' } } : {})
    }
  }]
}
export const useUtils = () => {
  const base = useBaseUtils()
  if (!isScheduleSurface()) return base
  return [{
    ...base[0],
    parseDate: (date, options) => {
      globalThis.__OD_SCHEDULE_DATE_CALLS__ = [...(globalThis.__OD_SCHEDULE_DATE_CALLS__ || []), { outputFormat: options?.outputFormat }]
      return formatLocalDate(date)
    }
  }]
}
