// In-memory boundaries around the actual schedule consumers and save controller.
export { useLanguage, useConfig, useUtils } from './schedule-language'
export { BusinessSchedule } from '../../../src/@/components-dashboard/src/components/BusinessSchedule'
export { Schedule } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Schedule'
export { Modal } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Modal'

const record = (type, value) => {
  globalThis.__OD_SCHEDULE_CONSUMER_EVENTS__ = [...(globalThis.__OD_SCHEDULE_CONSUMER_EVENTS__ || []), { type, value }]
}
const ordering = {
  businesses: id => ({
    save: async (changes, options) => {
      record('business-save', { id, changes, options })
      return { content: { error: false, result: { id, schedule: JSON.parse(changes.schedule) } } }
    }
  })
}
const session = [{ auth: true, loading: false, token: 'synthetic-schedule-token', user: { id: 501, level: 5 } }]
export const useApi = () => [ordering]
export const useSession = () => session
export const ToastType = { Info: 'info', Success: 'success', Error: 'error' }
export const useToast = () => [null, { showToast: (...args) => record('toast', args) }]
