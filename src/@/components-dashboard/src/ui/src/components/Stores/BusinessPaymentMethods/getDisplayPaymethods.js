import { mergePaymethodsWithCatalog } from '../../../../../utils/paymentPluginCatalog'

export const getDisplayPaymethods = ({
  paymethods = [],
  plugins = [],
  excludeGateways = [],
  isTutorialMode = false
} = {}) => {
  return mergePaymethodsWithCatalog({
    paymethods,
    plugins,
    excludeGateways,
    includeCatalog: !isTutorialMode
  })
}
