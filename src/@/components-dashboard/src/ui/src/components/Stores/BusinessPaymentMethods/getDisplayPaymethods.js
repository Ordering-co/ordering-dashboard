import { mergePaymethodsWithCatalog } from '../../../../../utils/paymentPluginCatalog'

// redesign stores 4.A (decision 11): `canInstall` false leaves out the catalog rows («Install» a payment
// plugin for the whole project), which only level 0 may do. The installed methods are listed either way.
export const getDisplayPaymethods = ({
  paymethods = [],
  plugins = [],
  excludeGateways = [],
  canInstall = true
} = {}) => {
  return mergePaymethodsWithCatalog({
    paymethods,
    plugins,
    excludeGateways,
    includeCatalog: canInstall
  })
}
