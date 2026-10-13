import { useCallback } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useCommandPalette } from '../contexts/CommandPaletteContext'
import { useInfoShare } from '../contexts/InfoShareContext'
import { useWindowSize } from './useWindowSize'

const LIVE_QUERY_PATHS = ['/settings']

/**
 * Navigate to a current dashboard destination. Consumers decide whether they
 * own a palette (CommandK closes it) or a chat (Mia remains open).
 */
export const useDashboardNavigation = ({ closeCommandPalette = false } = {}) => {
  const history = useHistory()
  const location = useLocation()
  const { setOpen, remountRoute, discardReturnFocus } = useCommandPalette()
  const [, { handleMenuCollapse }] = useInfoShare()
  const { width } = useWindowSize()

  return useCallback((path, { remount = false } = {}) => {
    if (closeCommandPalette) {
      discardReturnFocus()
      setOpen(false)
    }
    if (width && width < 768) handleMenuCollapse(true)
    const [pathname] = String(path).split('?')
    const samePage = pathname === location.pathname
    if (samePage && (remount || !LIVE_QUERY_PATHS.includes(pathname))) remountRoute()
    history.push(path)
  }, [closeCommandPalette, discardReturnFocus, handleMenuCollapse, history, location.pathname, remountRoute, setOpen, width])
}

export { LIVE_QUERY_PATHS }
