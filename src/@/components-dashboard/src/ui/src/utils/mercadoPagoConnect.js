export const MERCADO_PAGO_CONNECT_GATEWAY = 'mercado_pago_checkout_pro'

export const MERCADO_PAGO_PLUGIN_URL = 'https://mercado-pago-checkout-pro.plugins.orderingplus.com'

export const MERCADO_PAGO_ADMIN_ONLY_FIELDS = ['marketplace_fee_percent']

export const isMercadoPagoConnectGateway = (gateway) =>
  gateway === MERCADO_PAGO_CONNECT_GATEWAY

export const isMercadoPagoAdminOnlyField = (gateway, key) =>
  isMercadoPagoConnectGateway(gateway) && MERCADO_PAGO_ADMIN_ONLY_FIELDS.includes(key)

export const filterPaymethodFieldsByRole = (fields, { gateway, userLevel } = {}) => {
  const list = Array.isArray(fields) ? fields : []
  if (userLevel === 0) return list
  return list.filter(field => !isMercadoPagoAdminOnlyField(gateway, field?.key))
}

export const getMercadoPagoSetupUrl = ({ project, businessId } = {}) => {
  if (!project || businessId === undefined || businessId === null) return null
  const params = new URLSearchParams({ business_id: String(businessId) })
  return `${MERCADO_PAGO_PLUGIN_URL}/${encodeURIComponent(project)}/views/setup?${params.toString()}`
}

const POPUP_WIDTH = 560
const POPUP_HEIGHT = 760

export const openMercadoPagoSetupPopup = (url) => {
  if (!url) return null
  const left = Math.max(0, Math.round((window.screen?.width ?? POPUP_WIDTH) / 2 - POPUP_WIDTH / 2))
  const top = Math.max(0, Math.round((window.screen?.height ?? POPUP_HEIGHT) / 2 - POPUP_HEIGHT / 2))
  const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no`
  const popup = window.open(url, 'mercado_pago_setup', features)
  popup?.focus?.()
  return popup ?? null
}
