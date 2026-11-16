import { createContext, useContext } from 'react'

/**
 * Opt-in surface of the legacy pickers (MultiSelect, FirstSelect) for the orders filters sheet.
 * A screen wraps its pickers in `SelectSurfaceContext.Provider` (or passes the same keys as props):
 *   placement   'auto' | 'top'  flip the list up when there is no room below, scroll inside the room left
 *   fitTrigger  boolean         list aligned to the trigger's start with the trigger's width, brand rows
 *                               (32px, 44px with a coarse pointer), no pager inside the list
 * Without either, a picker is laid out exactly as before.
 */
export const SelectSurfaceContext = createContext({})

export const useSelectSurface = ({ placement, fitTrigger } = {}) => {
  const surface = useContext(SelectSurfaceContext)
  return {
    placement: placement ?? surface.placement,
    fitTrigger: fitTrigger ?? surface.fitTrigger
  }
}

// Gap = the margin of the upward list (--od-space-2), edge = breathing room kept to the boundary,
// floor = the smallest scrolling area worth showing.
export const PLACEMENT_GAP = 8
export const PLACEMENT_EDGE = 8
export const PLACEMENT_MIN_HEIGHT = 96
export const PLACEMENT_MODES = ['auto', 'top']

const CLIPS = /auto|scroll|hidden|clip|overlay/

/**
 * Vertical bounds a list has to stay inside: the viewport, narrowed by every ancestor that clips or
 * scrolls its content (the body of a sheet, which ends above its footer).
 */
export const getClippingBounds = (element) => {
  let top = 0
  let bottom = window.innerHeight || document.documentElement.clientHeight
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    if (!CLIPS.test(window.getComputedStyle(node).overflowY)) continue
    const rect = node.getBoundingClientRect()
    top = Math.max(top, rect.top)
    bottom = Math.min(bottom, rect.bottom)
  }
  return { top, bottom }
}

/**
 * Pick the side of the trigger with room and, when the list is taller than that room, how tall its
 * options may be (they scroll inside it). `natural` is the list height uncapped, `chrome` what the
 * list has besides its options (the search box). With `fit` the room is measured against the clipping
 * ancestors too, not only the viewport.
 */
export const chooseFloating = ({ trigger, natural, chrome, mode, fit }) => {
  const triggerRect = trigger.getBoundingClientRect()
  const bounds = fit
    ? getClippingBounds(trigger)
    : { top: 0, bottom: window.innerHeight || document.documentElement.clientHeight }
  const room = {
    bottom: bounds.bottom - triggerRect.bottom - PLACEMENT_GAP - PLACEMENT_EDGE,
    top: triggerRect.top - bounds.top - PLACEMENT_GAP - PLACEMENT_EDGE
  }
  const preferred = mode === 'top' ? 'top' : 'bottom'
  const other = preferred === 'top' ? 'bottom' : 'top'
  const side = natural <= room[preferred] || room[preferred] >= room[other] ? preferred : other
  if (natural <= room[side]) return { side, maxHeight: null }
  return { side, maxHeight: Math.max(Math.floor(room[side] - chrome), PLACEMENT_MIN_HEIGHT) }
}
