import { useSyncExternalStore } from 'react'
import { maxWidthBelow } from '../../../utils/breakpoints'

// redesign drivers-dashboard B4 (promotion from O/DeliveryDashboard, deliveries F2-B3 decision 7): below this width a board
// (/deliveries, /drivers-dashboard) is one column with a List | Map switch. The boards' CSS repeats the number in its @media rules
// (a variable cannot go there); this is the one place JavaScript reads it.
export const BOARD_STACK_BELOW = 1024
const STACKED_QUERY = maxWidthBelow(BOARD_STACK_BELOW)

const subscribeStacked = (onChange) => {
  if (typeof window === 'undefined') return () => {}
  if (typeof window.matchMedia !== 'function') {
    window.addEventListener('resize', onChange)
    return () => window.removeEventListener('resize', onChange)
  }
  const list = window.matchMedia(STACKED_QUERY)
  if (list.addEventListener) {
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }
  list.addListener(onChange)
  return () => list.removeListener(onChange)
}

const getStacked = () => {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia === 'function') return window.matchMedia(STACKED_QUERY).matches
  return window.innerWidth < BOARD_STACK_BELOW
}

export const useBoardStacked = () => useSyncExternalStore(subscribeStacked, getStacked, () => false)
