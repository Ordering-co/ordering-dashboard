import { BusinessWhiteLabel } from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessWhiteLabel'

const unsupportedBranch = name => () => {
  throw new Error(`Unexpected store editor fixture branch: ${name}`)
}

export { BusinessWhiteLabel }

export const Personalization = unsupportedBranch('barrel Personalization')
export const BusinessDetail = unsupportedBranch('BusinessDetail')
export const BusinessSchedule = unsupportedBranch('BusinessSchedule')
export const BusinessMenu = unsupportedBranch('BusinessMenu')
export const BusinessDeliveryPickupMore = unsupportedBranch('BusinessDeliveryPickupMore')
export const BusinessPaymentMethods = unsupportedBranch('BusinessPaymentMethods')
export const BusinessPreorderDetails = unsupportedBranch('BusinessPreorderDetails')
export const BusinessTaxAndFees = unsupportedBranch('BusinessTaxAndFees')
export const BusinessPromotionList = unsupportedBranch('BusinessPromotionList')
export const BusinessCustomFields = unsupportedBranch('BusinessCustomFields')
export const BusinessWebhooks = unsupportedBranch('BusinessWebhooks')
export const BusinessNotifications = unsupportedBranch('BusinessNotifications')
export const BusinessOrderingChannels = unsupportedBranch('BusinessOrderingChannels')
export const BusinessFrontLayout = unsupportedBranch('BusinessFrontLayout')
export const BusinessPlaceGroupList = unsupportedBranch('BusinessPlaceGroupList')
export const SpoonityApiKey = unsupportedBranch('SpoonityApiKey')
export const BusinessLogs = unsupportedBranch('BusinessLogs')
export const BusinessSalesChannel = unsupportedBranch('BusinessSalesChannel')
export const BusinessQRCodeOptions = unsupportedBranch('BusinessQRCodeOptions')
export const BusinessReservations = unsupportedBranch('BusinessReservations')
export const BusinessConfigs = unsupportedBranch('BusinessConfigs')
export const BusinessMarkups = unsupportedBranch('BusinessMarkups')
export const BusinessFees = unsupportedBranch('BusinessFees')
export const BusinessPaymentAccount = unsupportedBranch('BusinessPaymentAccount')

// BusinessWhiteLabel imports this branch eagerly, but confirmCreate prevents it
// from rendering in this bounded fixture. Fail closed if that contract changes.
export const OrderingWebsite = unsupportedBranch('OrderingWebsite')

export { checkSiteUrl } from '../../../src/@/components-dashboard/src/ui/src/utils/checkSiteUrl'
export { addQueryToUrl, removeQueryToUrl } from '../../../src/@/components-dashboard/src/ui/src/utils/queryString'
