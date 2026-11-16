import { orderingAssets } from './assets'
import { publicAssetUrl } from '../utils/publicAssetUrl'

export const createDashboardLogoDefaults = () => ({
  logotype: publicAssetUrl(orderingAssets.logos.light),
  logotypeInvert: publicAssetUrl(orderingAssets.logos.onDark),
  isotype: publicAssetUrl(orderingAssets.symbols.light),
  isotypeInvert: publicAssetUrl(orderingAssets.symbols.dark),
  logoPdf: publicAssetUrl(orderingAssets.logos.print)
})

// Switch only the governed default. Explicit theme images remain authoritative.
export const getDashboardThemeLogo = theme => {
  const logo = theme?.images?.logos?.logotype
  const isGovernedDefault = [orderingAssets.logos.light, publicAssetUrl(orderingAssets.logos.light)].includes(logo)
  return isGovernedDefault && theme?.ordering?.mode === 'dark'
    ? publicAssetUrl(orderingAssets.logos.dark)
    : logo
}
