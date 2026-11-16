import { useEffect, useRef, useState } from 'react'

import { hasActiveDialogLayer } from '../UI/dialog-layer'
import { captureSidebarDismissal, ownsCapturedSidebarDismissal, registerSidebar } from '../UI/sidebar-layer'

// redesign SP-F0 (E0)
// The focus and Escape contract of an editor panel fixed at the end of a page (the store editor, the product editor),
// promoted unchanged from Stores/BusinessDetails (SL-R-04 and SL-F2).
//
//   useEditorPanel({ open, panelRef, onClose, resetKey, modalBelow, modal })
//
// - Opening the panel (and changing `resetKey`, e.g. the id of the record) moves the focus into it (`preventScroll`); closing
//   it gives the focus back to what had it, if that is still in the page.
// - The panel is registered in the sidebar layer registry, and Escape closes it only when it is the layer on top: a legacy
//   SideBar open over it closes first, and an open dialog takes the key (`hasActiveDialogLayer`). At any window width.
// - `onClose` is read through a ref, so a new function on each render does not re-register the listeners.
// - `modalBelow` (px, off by default; redesign bugs Q, ): while the panel is open and the window is `modalBelow` wide or
//   less (`(max-width: Npx)`), the panel covers the screen, so it is a modal one: everything that is in the page next to the panel
//   and its ancestors (the list, the sidebar, the menu) becomes `inert`, and the panel takes `role="dialog"` and
//   `aria-modal="true"`. Wider, or closed, or unmounted: nothing of that is left. Only what is in the page when the mode starts is
//   made inert, so a dialog or a menu that opens later (a portal) is not; `#app-modals` (the shared dialog host) and the portals of
//   Base UI are never touched. A consumer that does not pass it behaves as before.
// - `modal` (boolean, off by default; redesign bugs Q, adjustment): the consumer says the panel covers the page, with no
//   matchMedia. `true` is that same modal mode for as long as the panel is open; going back to `false` clears it. The store editor
//   passes `panelSize === 'full'` (its panel also covers the list between 500px and 999px with a section open), and not for the
//   Overview beside the list. `modalBelow` stays for compatibility; either one turns the mode on.
//
// The panel element needs `tabIndex={-1}` to take the focus. The effects keep their order: focus first, then the registry.
const mediaOf = (query) => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null) || null

// `(max-width: Npx)` as state; false without matchMedia (or with a double that answers nothing)
const useMaxWidth = (px) => {
  const query = px ? `(max-width: ${px}px)` : null
  const [matches, setMatches] = useState(() => !!query && mediaOf(query)?.matches === true)
  useEffect(() => {
    const media = query ? mediaOf(query) : null
    if (!media) {
      setMatches(false)
      return undefined
    }
    const sync = () => setMatches(media.matches === true)
    sync()
    if (media.addEventListener) {
      media.addEventListener('change', sync)
      return () => media.removeEventListener?.('change', sync)
    }
    media.addListener?.(sync)
    return () => media.removeListener?.(sync)
  }, [query])
  return matches
}

// What is in the page and must keep working while a modal panel is open: the shared dialog host, the toast host (its notices are
// still read and reachable) and the Base UI portals; the document head has nothing to make inert
const isLayerHost = (node) => node.id === 'app-modals' || node.id === 'toast-container' || node.hasAttribute('data-base-ui-portal') ||
  /^(HEAD|SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(node.tagName)

export function useEditorPanel ({ open, panelRef, onClose, resetKey, modalBelow, modal = false }) {
  const isNarrow = useMaxWidth(open ? modalBelow : undefined)
  const isModal = isNarrow || modal === true
  // An opener the focus could not go back to because the modal mode still had it inert (that cleanup runs after this one)
  const pendingFocusRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      if (opener && opener !== document.body && opener.isConnected && typeof opener.focus === 'function') {
        opener.focus({ preventScroll: true })
        pendingFocusRef.current = document.activeElement === opener ? null : opener
      }
    }
  }, [open, resetKey])

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    const unregister = registerSidebar(panelRef)
    const captureDismissal = event => captureSidebarDismissal(event, hasActiveDialogLayer())
    const onKeyDown = event => {
      if (!ownsCapturedSidebarDismissal(event, panelRef)) return
      if (event.code === 'Escape') onCloseRef.current && onCloseRef.current()
    }
    document.addEventListener('keydown', captureDismissal, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      unregister()
      document.removeEventListener('keydown', captureDismissal, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    const panel = panelRef.current
    if (!open || !isModal || !panel) return undefined
    const made = new Set()
    for (let node = panel; node.parentElement; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node || sibling.hasAttribute('inert') || isLayerHost(sibling)) continue
        sibling.setAttribute('inert', '')
        made.add(sibling)
      }
    }
    // An element whose inert someone else sets or removes while the mode is on (React on a collapsed sidebar, say) is theirs
    // again: the cleanup leaves it as they left it.
    const claimed = records => records.forEach(record => made.delete(record.target))
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(claimed) : null
    made.forEach(node => observer?.observe(node, { attributes: true, attributeFilter: ['inert'] }))
    const previous = { role: panel.getAttribute('role'), modal: panel.getAttribute('aria-modal') }
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    return () => {
      if (observer) {
        claimed(observer.takeRecords())
        observer.disconnect()
      }
      made.forEach(node => node.removeAttribute('inert'))
      if (previous.role === null) panel.removeAttribute('role')
      else panel.setAttribute('role', previous.role)
      if (previous.modal === null) panel.removeAttribute('aria-modal')
      else panel.setAttribute('aria-modal', previous.modal)
      // The focus cleanup ran first and could not reach an opener that was inert: now it is not
      const opener = pendingFocusRef.current
      pendingFocusRef.current = null
      const idle = !document.activeElement || document.activeElement === document.body
      if (opener && idle && opener.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true })
    }
  }, [open, isModal])
}
