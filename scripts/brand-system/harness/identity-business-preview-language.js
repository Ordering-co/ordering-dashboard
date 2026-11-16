import { useLanguage as useBaseLanguage } from './language'

const configStates = new Map()
const sessionState = [{ user: { id: 81, name: 'Preview owner', photo: null } }]
const orderState = [{ options: { type: 1 }, carts: {} }]
const utilsState = [{
  parsePrice: value => `$${Number(value ?? 0).toFixed(2)}`,
  parseDistance: value => `${Number(value ?? 0).toFixed(1)} mi`,
  optimizeImage: value => value
}]

export const useLanguage = () => useBaseLanguage()
export const useConfig = () => {
  const whiteLabel = new URLSearchParams(window.location.search).get('whiteLabel') === '1'
  if (!configStates.has(whiteLabel)) configStates.set(whiteLabel, [{ configs: { max_product_amount: 100, white_label_module: { value: whiteLabel } } }])
  return configStates.get(whiteLabel)
}
export const useSession = () => sessionState
export const useOrder = () => orderState
export const useUtils = () => utilsState
