import { PAYMENT_PLUGIN_CATALOG } from '../../utils/paymentPluginCatalog'

export const getCatalogInstallUrl = (pluginKey) => {
  return PAYMENT_PLUGIN_CATALOG.find(item => item.key === pluginKey)?.installUrl || null
}

export const buildInstallPaymentPluginRequest = ({ pluginKey }) => {
  const installUrl = getCatalogInstallUrl(pluginKey)
  if (!installUrl) {
    return { error: 'UNKNOWN_PAYMENT_PLUGIN' }
  }
  return {
    method: 'POST',
    body: { url: installUrl }
  }
}
