export { useLanguage } from './language'

export const useConfig = () => [{ configs: { driver_tip_type: { value: '1' }, driver_tip_use_custom: { value: '0' } } }]
export const useSession = () => [{ user: { id: 999999, level: 0 } }]
export const useUtils = () => [{
  getOrderState: () => 'Pending',
  optimizeImage: value => value,
  parseDate: value => String(value ?? ''),
  parseNumber: value => Number(value ?? 0).toFixed(2),
  parsePrice: (value, { currency = '$' } = {}) => `${currency}${Number(value ?? 0).toFixed(2)}`
}]
