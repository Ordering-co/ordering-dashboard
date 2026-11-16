import { useCallback } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { isLegacyUpgradeDestination } from '../../../utils/legacyPlanUpgradeDestinations'
import { useLegacyPlanUpgrade } from '../contexts/LegacyPlanUpgradeContext'
import { useCommandPalette } from '../contexts/CommandPaletteContext'
import { useInfoShare } from '../contexts/InfoShareContext'
import { useWindowSize } from './useWindowSize'
import { requestRouteLeave } from '../utils/routeLeaveGuard'
import { watchPageStart } from '../../../utils/watchPageStart'

// redesign reports FC (D1, D4): /intelligence/reports follows `?id=` itself and keeps the shared period and filters across reports
// redesign invoice R2 (M1): /intelligence/invoice reads `?invoice=` and `?tab=` on every change of location and keeps both kinds mounted, so ⌘K from
// the page itself must not mount it again (it would empty the party, the period, the fees and the notes of both kinds)
// redesign DS-R1-01 (review r1): /connect/delivery-services applies `?id=` and `?tab=` itself on every change of location (its
// effect goes through the draft guard of the open panel), so ⌘K to another provider from the page must not mount it again: the remount
// dropped the draft of the panel (credentials, Businesses, Schedule, zones) and the search without asking
const LIVE_QUERY_PATHS = ['/settings', '/intelligence/reports', '/intelligence/invoice', '/connect/delivery-services']

// redesign stores 1.C, G1-25: /stores/list follows a store (`?id=`, the list) without a remount, which would drop
// the filters, the search, the page and the selection; the editor then reads its section and tab as on a fresh open. Only when
// the destination is ANOTHER store with nothing but `id`/`section`/`tab`, and the page shows nothing but the list and the editor
// (its address, which addQueryToUrl keeps current, has only list and editor keys: no `header` side bar). The same store again,
// any other query of the page (active, header, a tab with no store…) or an open side bar still remounts.
const STORE_KEYS = ['id', 'section', 'tab']
// redesign bugs F row 22 (F5 of 3.A; review R-3): a list filtered by type or searched follows the store too; the remount
// dropped its type, its search and its page
const LIST_KEYS = [...STORE_KEYS, 'active', 'page', 'pageSize', 'type', 'q']
const followsStoreQuery = (pathname, search, currentSearch) => {
  if (pathname !== '/stores/list') return false
  const target = new URLSearchParams(search)
  const current = new URLSearchParams(currentSearch)
  return target.has('id') && [...target.keys()].every(key => STORE_KEYS.includes(key)) &&
    [...current.keys()].every(key => LIST_KEYS.includes(key)) && target.get('id') !== current.get('id')
}

// (part 1): ⌘K to a page left the focus on <body>: the input of the palette unmounts and the opener is discarded on purpose.
// The start of the new page takes it, as the phone drawer does (watchPageStart: the page is lazy, its h1 may paint late). A destination that
// opens a panel or a form focuses inside by itself and keeps it (`onlyIfLost`). One watch at a time: a new choice cancels the previous.
let pageStartWatch = null
const watchNewPage = () => {
  pageStartWatch?.stop()
  let second = 0
  const watch = watchPageStart(null, { onlyIfLost: true })
  const first = requestAnimationFrame(() => { second = requestAnimationFrame(watch.arm) })
  pageStartWatch = {
    stop: () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
      watch.stop()
    }
  }
}

/**
 * Navigate to a current dashboard destination. Consumers decide whether they
 * own a palette (CommandK closes it) or a chat (Mia remains open).
 */
export const useDashboardNavigation = ({ closeCommandPalette = false } = {}) => {
  const history = useHistory()
  const location = useLocation()
  const { setOpen, remountRoute, getReturnFocus, discardReturnFocus } = useCommandPalette()
  const [, { handleMenuCollapse }] = useInfoShare()
  const { width } = useWindowSize()
  const { requestUpgrade } = useLegacyPlanUpgrade()

  return useCallback((path, { remount = false, onNavigate } = {}) => {
    const navigate = () => {
      if (closeCommandPalette) {
        discardReturnFocus()
        setOpen(false)
      }
      if (width && width < 768) handleMenuCollapse(true)
      const [pathname, search = ''] = String(path).split('?')
      const samePage = pathname === location.pathname
      // An open editor with unsaved changes asks before the remount or the move.
      requestRouteLeave(() => {
        onNavigate?.()
        if (samePage && (remount || !(LIVE_QUERY_PATHS.includes(pathname) || followsStoreQuery(pathname, search, window.location.search)))) remountRoute()
        history.push(path)
        if (closeCommandPalette) watchNewPage()
      })
    }
    const returnFocus = closeCommandPalette ? getReturnFocus?.() : undefined
    if (isLegacyUpgradeDestination(path) && requestUpgrade(returnFocus, navigate)) {
      if (closeCommandPalette) {
        // Collapsing the drawer also disables its Tab trap around the modal.
        if (width && width < 768) handleMenuCollapse(true)
        setOpen(false)
      }
      return false
    }
    navigate()
    return true
  }, [closeCommandPalette, discardReturnFocus, getReturnFocus, requestUpgrade, handleMenuCollapse, history, location.pathname, remountRoute, setOpen, width])
}

export { LIVE_QUERY_PATHS }
