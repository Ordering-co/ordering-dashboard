/**
 * Room the docked assistant panel takes on the right of wide screens (left in
 * RTL). The rest of the dashboard reads it from two CSS variables on <html>:
 * `--assistant-offset` (the panel) and `--app-width` (what is left). Fixed
 * lateral panels open next to the assistant with them instead of under it,
 * and useWindowSize subtracts the offset so their breakpoints see the room
 * they really have.
 */
export const ASSISTANT_PANEL_WIDTH = 380

/** Below this window width the assistant floats over the page instead */
export const ASSISTANT_DOCK_MIN_WIDTH = 1200

const INTERCOM_HORIZONTAL_PADDING = 20

let assistantOffset = 0

export const getAssistantOffset = () => assistantOffset

/**
 * Dock (or undock, with 0) the assistant panel
 * @param {Number} width px the panel takes
 */
export const setAssistantOffset = (width) => {
  const next = Math.max(0, Math.round(Number(width) || 0))
  if (next === assistantOffset) return
  assistantOffset = next

  if (typeof document !== 'undefined') {
    const rootStyle = document.documentElement.style
    if (next) {
      rootStyle.setProperty('--assistant-offset', `${next}px`)
      rootStyle.setProperty('--app-width', `calc(100vw - ${next}px)`)
    } else {
      rootStyle.removeProperty('--assistant-offset')
      rootStyle.removeProperty('--app-width')
    }
  }

  if (typeof window !== 'undefined') {
    // Keep the Intercom launcher out of the panel
    if (typeof window.Intercom === 'function' && window.intercomSettings?.alignment !== 'left') {
      window.Intercom('update', { horizontal_padding: INTERCOM_HORIZONTAL_PADDING + next })
    }
    // Width-dependent layouts (useWindowSize, lateral panels) recompute
    window.dispatchEvent(new Event('resize'))
  }
}
