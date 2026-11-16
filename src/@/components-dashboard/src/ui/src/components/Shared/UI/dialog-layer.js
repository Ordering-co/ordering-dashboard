import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

export const LEGACY_DIALOG_LAYER = 'legacy-dialog'
export const CONFIRM_DIALOG_LAYER = 'confirm-dialog'

let layerVersion = 0
let layerOrder = 0
let sharedHost = null
let sharedHostUsers = 0
let legacyHostUsers = 0
let legacyBackdropTokens = []
let ownsSharedHost = false
const dialogLayers = []
const layerListeners = new Set()

const notifyLayers = () => {
  layerVersion += 1
  layerListeners.forEach(listener => listener())
}

const subscribeLayers = listener => {
  layerListeners.add(listener)
  return () => layerListeners.delete(listener)
}

const getLayerVersion = () => layerVersion

const acquireHost = (kind, backdropClassName) => {
  let host = document.getElementById('app-modals')
  const created = !host
  if (!host) {
    host = document.createElement('div')
    host.id = 'app-modals'
    host.className = 'popup-component-backdrop popup-backdrop od-ui od-dialog-shared-host'
    document.body.appendChild(host)
  }

  if (sharedHost !== host) {
    sharedHost = host
    sharedHostUsers = 0
    legacyHostUsers = 0
    legacyBackdropTokens = []
    ownsSharedHost = created
  }

  sharedHostUsers += 1
  if (kind === LEGACY_DIALOG_LAYER) {
    if (legacyHostUsers === 0) {
      if (ownsSharedHost) {
        const requestedTokens = backdropClassName?.trim().split(/\s+/).filter(Boolean) || []
        legacyBackdropTokens = requestedTokens.filter(token => !host.classList.contains(token))
        legacyBackdropTokens.forEach(token => host.classList.add(token))
        host.classList.remove('od-dialog-confirm-only-host')
      }
    }
    legacyHostUsers += 1
  } else if (ownsSharedHost && legacyHostUsers === 0) {
    host.classList.add('od-dialog-confirm-only-host')
  }
  return host
}

const releaseHost = (host, kind) => {
  if (sharedHost !== host) return
  sharedHostUsers = Math.max(0, sharedHostUsers - 1)
  if (kind === LEGACY_DIALOG_LAYER) {
    legacyHostUsers = Math.max(0, legacyHostUsers - 1)
    if (legacyHostUsers === 0) {
      if (ownsSharedHost) {
        legacyBackdropTokens.forEach(token => host.classList.remove(token))
        if (sharedHostUsers > 0) host.classList.add('od-dialog-confirm-only-host')
      }
      legacyBackdropTokens = []
    }
  }
  if (sharedHostUsers > 0) return

  if (ownsSharedHost && host.isConnected) host.remove()
  sharedHost = null
  ownsSharedHost = false
}

// redesign F1b (D-11): the host is fixed and full screen, so it takes every pointer event. While every layer in
// it is non-modal (a filter popover) the host lets the pointer through, so a click outside the popover reaches
// what is under it; the popup takes it back through its portal's own `pointer-events`. Any modal layer makes
// the host block again. Only a host this module created is touched.
const syncPointerThrough = () => {
  if (!sharedHost || !ownsSharedHost) return
  const through = dialogLayers.length > 0 && dialogLayers.every(layer => layer.modal === false)
  sharedHost.style.pointerEvents = through ? 'none' : ''
}

// redesign F6h-1 (A2-01): focus containment for modal layers that opt in (`trapFocus`: the Product Dialog,
// ConfirmDialog and Sheet). Base UI's own trap hands the focus back through guard elements on a later tick, so a
// quick Tab slipped past them to <body>, the sidebar and the controls behind. Here the trap is synchronous (a
// capture keydown that wraps Tab at the edges) and the page behind gets the real `inert` attribute, which also
// takes it out of the tab order and out of reach of a click. Both go away when the layer closes. A non-modal
// layer (a popover) never opts in, so the page stays live under it (D-11).
const NON_CONTENT_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'TEMPLATE', 'META'])
const inertApplied = new Set()
let trapListening = false

const trapLayers = () => dialogLayers.filter(layer => layer.trapState?.current)

const hostChildOf = (element, host) => {
  let node = element
  while (node && node.parentElement && node.parentElement !== host) node = node.parentElement
  return node?.parentElement === host ? node : null
}

const syncInert = () => {
  if (typeof document === 'undefined') return
  const trapping = trapLayers()
  const wanted = new Set()
  if (trapping.length > 0) {
    const host = sharedHost || document.getElementById('app-modals')
    const topTrapIndex = dialogLayers.indexOf(trapping[trapping.length - 1])
    const topChild = hostChildOf(dialogLayers[topTrapIndex].popupRef?.current, host)
    Array.from(document.body.children).forEach(child => {
      if (child !== host && !NON_CONTENT_TAGS.has(child.tagName)) wanted.add(child)
    })
    // The layers under the top modal one (a sheet under its confirmation) are page too.
    dialogLayers.slice(0, topTrapIndex).forEach(layer => {
      const child = hostChildOf(layer.popupRef?.current, host)
      if (child && child !== topChild) wanted.add(child)
    })
  }
  inertApplied.forEach(element => {
    if (!wanted.has(element) || !element.isConnected) {
      element.removeAttribute('inert')
      inertApplied.delete(element)
    }
  })
  wanted.forEach(element => {
    if (inertApplied.has(element) || element.hasAttribute('inert')) return
    element.setAttribute('inert', '')
    inertApplied.add(element)
  })
}

const isTabbable = element => {
  if (element.hasAttribute('data-base-ui-focus-guard') || element.disabled) return false
  if (element.tabIndex < 0 || element.closest('[inert], [hidden]')) return false
  if (element.tagName === 'INPUT' && element.type === 'hidden') return false
  if (typeof element.checkVisibility === 'function') return element.checkVisibility({ visibilityProperty: true })
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

const TABBABLE = 'a[href], area[href], button, input, select, textarea, summary, iframe, [contenteditable]:not([contenteditable="false"]), [tabindex]'

const handleTrapKeydown = event => {
  if (event.key !== 'Tab' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
  const top = dialogLayers[dialogLayers.length - 1]
  // A non-modal layer on top (a select list, a popover over the sheet) is left to its own handling.
  if (!top?.trapState?.current) return
  const popup = top.popupRef?.current
  if (!popup?.isConnected) return
  const active = document.activeElement
  const host = sharedHost || document.getElementById('app-modals')
  const tabbables = Array.from(popup.querySelectorAll(TABBABLE)).filter(isTabbable)
  const first = tabbables[0]
  const last = tabbables[tabbables.length - 1]
  const goTo = element => {
    event.preventDefault()
    ;(element || popup).focus()
  }

  if (popup.contains(active)) {
    if (!first) return goTo(null)
    if (event.shiftKey && (active === first || active === popup)) return goTo(last)
    if (!event.shiftKey && active === last) return goTo(first)
    return undefined
  }
  // Focus is outside the popup: on a Base UI guard or on the page behind it comes back in; inside another
  // portal of the host (a select list over this layer) it is not ours to move.
  const onGuard = active?.hasAttribute?.('data-base-ui-focus-guard')
  if (!onGuard && host?.contains(active)) return undefined
  return goTo(event.shiftKey ? last : first)
}

const syncTrapListener = () => {
  if (typeof document === 'undefined') return
  const needed = trapLayers().length > 0
  if (needed && !trapListening) {
    document.addEventListener('keydown', handleTrapKeydown, true)
    trapListening = true
  } else if (!needed && trapListening) {
    document.removeEventListener('keydown', handleTrapKeydown, true)
    trapListening = false
  }
}

const syncTrap = () => {
  syncInert()
  syncTrapListener()
}

const registerLayer = layer => {
  layer.order = ++layerOrder
  dialogLayers.push(layer)
  syncPointerThrough()
  syncTrap()
  notifyLayers()
  return () => {
    const index = dialogLayers.indexOf(layer)
    if (index === -1) return
    dialogLayers.splice(index, 1)
    syncPointerThrough()
    syncTrap()
    notifyLayers()
  }
}

const getActiveLayer = excludedId => {
  for (let index = dialogLayers.length - 1; index >= 0; index--) {
    if (dialogLayers[index].id !== excludedId) return dialogLayers[index]
  }
  return null
}

// Nonmodal surfaces can defer dismissal without joining the modal layer registry.
export const hasActiveDialogLayer = () => Boolean(getActiveLayer())

// `trapFocus` opts a modal layer into the focus trap and the inert page behind it; `engaged` (default `open`) is
// whether it holds them right now. The Product overlays pass `engaged: open`, so both are released the moment the
// overlay starts closing, before the exit transition and before the focus goes back to the opener.
export const useDialogLayer = ({ open, kind, backdropClassName, popupRef, lastFocusedRef, modal = true, trapFocus = false, engaged = open }) => {
  const id = useId()
  const trapState = useRef({ current: false })
  const wantsTrap = Boolean(trapFocus && modal !== false && engaged)
  const [host, setHost] = useState(null)
  const [ready, setReady] = useState(false)
  const layer = useMemo(() => ({ id, kind, popupRef, lastFocusedRef, modal, trapState: trapState.current, order: 0 }), [id, kind, lastFocusedRef, modal, popupRef])
  useLayoutEffect(() => {
    trapState.current.current = wantsTrap
    syncTrap()
    return () => {
      trapState.current.current = false
      syncTrap()
    }
  }, [wantsTrap])
  useSyncExternalStore(subscribeLayers, getLayerVersion, getLayerVersion)

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      setHost(null)
      setReady(false)
      return undefined
    }
    const nextHost = acquireHost(kind, backdropClassName)
    const unregister = registerLayer(layer)
    setHost(nextHost)
    setReady(true)
    return () => {
      unregister()
      releaseHost(nextHost, kind)
    }
  }, [open])

  const isActive = getActiveLayer()?.id === id
  const resolveFinalFocus = useCallback(opener => {
    const remainingLayer = getActiveLayer(id)
    const remainingPopup = remainingLayer?.popupRef.current
    if (remainingPopup?.isConnected) {
      if (opener?.isConnected && remainingPopup.contains(opener)) return opener
      const lastFocused = remainingLayer.lastFocusedRef.current
      if (lastFocused?.isConnected && remainingPopup.contains(lastFocused)) return lastFocused
      return remainingPopup
    }
    return opener?.isConnected ? opener : null
  }, [id])

  return { host, isActive, order: layer.order, ready, resolveFinalFocus }
}
