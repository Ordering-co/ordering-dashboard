export { useLanguage } from './language'
export { verifyDecimals, getCurrenySymbol } from '../../../src/@/components-dashboard/src/ui/src/utils/billFormatting'
export { TaxBillRows } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/TaxBillRows'
export { FeeBillRows } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/FeeBillRows'
export { Alert, Confirm } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Confirm'
export { Modal } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Modal'
export const useUtils = () => [{ parsePrice: value => `$${Number(value).toFixed(2)}`, parseNumber: value => Number(value).toFixed(2) }]
export const useConfig = () => [{ configs: {} }]
export const useOrder = () => [{ options: { type: 1 } }, { removeOffer: () => { throw new Error('Coupon writes outside bill fixture scope') } }]
export const useCustomer = () => [{ user: { id: 901 } }]
export const useValidationFields = () => [{ fields: { checkout: { coupon: { enabled: false } } } }]
// Unmounted provider/refund/coupon branches are outside these populated bill fixtures.
export const RefundToWallet = () => null
export const CouponControl = () => null
export const SingleProductCard = () => null
