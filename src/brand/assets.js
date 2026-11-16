import { metadata } from './ordering.tokens.generated'

// Raw public paths: the existing branding resolver applies publicAssetUrl once.
// Every file is allowlisted and checksum-verified by the release CLI.
const base = `/brand/ordering/${metadata.release}/assets`

export const orderingAssets = Object.freeze({
  logos: Object.freeze({
    light: `${base}/logos/ordering-lockup-color.svg`,
    dark: `${base}/logos/ordering-lockup-color-reversed.svg`,
    onLight: `${base}/logos/ordering-lockup-color-on-white.svg`,
    onDark: `${base}/logos/ordering-lockup-color-on-dark.svg`,
    print: `${base}/logos/png/ordering-lockup-color-512.png`
  }),
  symbols: Object.freeze({
    light: `${base}/logos/ordering-symbol-contained-light.svg`,
    dark: `${base}/logos/ordering-symbol-contained-dark.svg`
  }),
  appIcons: Object.freeze({
    small: `${base}/icons/ordering-app-icon-192.png`,
    large: `${base}/icons/ordering-app-icon-512.png`
  }),
  favicon: `${base}/icons/ordering-favicon-32.png`,
  faviconIco: `${base}/icons/favicon.ico`,
  appleTouchIcon: `${base}/icons/ordering-apple-touch-icon-180.png`
})
