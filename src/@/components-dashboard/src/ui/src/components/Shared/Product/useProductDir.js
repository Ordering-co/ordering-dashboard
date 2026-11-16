import { useTheme } from 'styled-components'

/**
 * Text direction for Product wrappers. The dashboard sets `theme.rtl` from the
 * language; portals need it explicitly because they render outside the page.
 * Without a ThemeProvider (tests, gallery) the document direction wins.
 */
export const useProductDir = (dir) => {
  const theme = useTheme()
  if (dir) return dir
  if (typeof theme?.rtl === 'boolean') return theme.rtl ? 'rtl' : 'ltr'
  if (typeof document !== 'undefined' && document.documentElement.dir === 'rtl') return 'rtl'
  return 'ltr'
}
