import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { hasActiveDialogLayer } from '../UI/dialog-layer'
import { useOverlayLayer } from './Dialog'
import { cx } from './classNames'
import { tokenPx } from './positioning'
import { useProductDir } from './useProductDir'
import { focusableIn } from '../../../utils/listFocus'
import { BREAKPOINT_PHONE, BREAKPOINT_SPLIT, BREAKPOINT_SPLIT_NARROW_UNTIL, maxWidth, minWidth } from '../../../../../utils/breakpoints' // redesign W0-5 (T0-17)
import './product.css'
import './dialog.css'
import './split-view.css'

// Breakpoints (C8): split from 1280, overlay from 768, full below. Between 1280 and
// 1359 the panel is the narrow one. A media query cannot take a variable, so these
// are read from utils/breakpoints.js, and split-view.css repeats them.
const SPLIT_FROM = BREAKPOINT_SPLIT
const OVERLAY_FROM = BREAKPOINT_PHONE
const NARROW_UNTIL = BREAKPOINT_SPLIT_NARROW_UNTIL

// Popups that own their Escape and are not in the dialog layer registry (menus, popovers, listboxes). Dialogs,
// sheets and the overlay panel are registered layers: `hasActiveDialogLayer()` knows them.
const POPUP_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

const hasOpenLayer = panel => {
  if (hasActiveDialogLayer()) return true
  return [...document.querySelectorAll(POPUP_SELECTOR)].some(node => (
    !panel?.contains(node) &&
    !node.hasAttribute('data-ending-style') &&
    !node.closest('[hidden], [aria-hidden="true"], [inert]')
  ))
}

// redesign F6c (Q2-02): where a typed Escape belongs to the field and not to the panel. A text field, a textarea or a
// contenteditable keeps what is typed (the first Escape only takes the focus out of it); a select trigger owns the
// Escape that closes its own list. Everything else in the panel (buttons, links, the tab strip) still closes it.
// redesign F6d (P4-01): a select trigger only owns the Escape while its list is open. Closed (right after choosing a
// status or a driver the focus comes back to it) it is a button: Escape closes the panel, through the guard, as in main.
const NON_TEXT_INPUTS = ['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']
const EDITABLE_SELECTOR = '[contenteditable]:not([contenteditable="false"]), [role="textbox"]'
const TRIGGER_SELECTOR = 'select, [role="combobox"], [aria-haspopup="listbox"]'

const isTextField = node => {
  if (!(node instanceof Element)) return false
  if (node.tagName === 'TEXTAREA') return true
  if (node.tagName === 'INPUT') return !NON_TEXT_INPUTS.includes((node.getAttribute('type') || 'text').toLowerCase())
  return !!node.closest(EDITABLE_SELECTOR)
}

const isOpenSelectTrigger = node => {
  const trigger = node instanceof Element ? node.closest(TRIGGER_SELECTOR) : null
  return !!trigger && trigger.getAttribute('aria-expanded') === 'true'
}

// Whether the Escape typed on `node` is the field's and not the panel's.
const ownsEscape = node => isTextField(node) || isOpenSelectTrigger(node)

const DEFAULT_CONTEXT = {
  mode: 'split',
  open: false,
  expanded: false,
  onClose: () => {},
  requestClose: () => {},
  registerCloseGuard: () => () => {},
  guardPlaceChange: proceed => { proceed?.(); return true },
  getEscapedField: () => null
}
const SplitViewContext = createContext(null)

/**
 * What the panel content needs to adapt to where it sits: `mode` is the viewport mode
 * (`split`, `overlay` or `full`) even when the panel is `expanded`, so the content can
 * draw "Back" in `full` and "Close" elsewhere. Outside a SplitView it answers a closed
 * split, so shared content can render on its own.
 */
export const useSplitView = () => useContext(SplitViewContext) || DEFAULT_CONTEXT

// Moves the focus out of a field of the panel to the panel itself (what is typed stays), so the next Escape is the
// panel's. A select trigger with its list open keeps its focus: its own list took the Escape. `escapedRef` keeps the
// field that lost the focus (redesign F6d, Q3-09), for the content to give it back if the close is refused.
const leaveField = (field, panelNode, escapedRef) => {
  if (isTextField(field)) {
    field.blur?.()
    if (panelNode && panelNode.isConnected && !panelNode.contains(document.activeElement)) {
      panelNode.focus({ preventScroll: true })
    }
    if (escapedRef) escapedRef.current = { field, panel: panelNode }
  }
}

const queryOf = (kind, px) => (kind === 'min' ? minWidth(px) : maxWidth(px))

const matchesWidth = (kind, px) => {
  if (typeof window === 'undefined') return kind === 'min'
  if (typeof window.matchMedia === 'function') return window.matchMedia(queryOf(kind, px)).matches
  return kind === 'min' ? window.innerWidth >= px : window.innerWidth <= px
}

const useWidthQuery = (kind, px) => {
  const subscribe = useCallback(onChange => {
    if (typeof window === 'undefined') return () => {}
    if (typeof window.matchMedia !== 'function') {
      window.addEventListener('resize', onChange)
      return () => window.removeEventListener('resize', onChange)
    }
    const list = window.matchMedia(queryOf(kind, px))
    if (list.addEventListener) {
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    }
    list.addListener(onChange)
    return () => list.removeListener(onChange)
  }, [kind, px])
  return useSyncExternalStore(subscribe, () => matchesWidth(kind, px), () => kind === 'min')
}

const readStored = key => {
  if (!key) return null
  try {
    const value = Number.parseFloat(window.localStorage.getItem(key))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

const writeStored = (key, value) => {
  if (!key) return
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // Private mode or a full quota: the width just does not persist.
  }
}

// redesign tramo A r4 (W0-QA2-04): the control that has the focus inside the panel can be taken out of the page by the panel itself: the
// loading skeleton of the order is replaced by the real panel, and its «Close» button (the only control it has, the one the first Tab
// reaches) is gone; the focus used to fall to <body>. When that happens the focus goes to the control with the same name in what is there
// now (the real «Close»), else to the panel (`tabIndex -1`), never to <body>. A focus that is somewhere else (a dialog, a menu) is left alone.
const useKeepFocusInPanel = (getPanel, active) => {
  useEffect(() => {
    if (!active) return undefined
    let last = null
    let watched = null
    let observer = null
    const onMutation = () => {
      if (!last || last.node.isConnected) return
      const gone = last
      last = null
      const focused = document.activeElement
      if (focused && focused !== document.body) return
      const panel = watched
      if (!panel?.isConnected) return
      const twin = gone.label
        ? Array.from(panel.querySelectorAll(gone.tag)).find(node => node.getAttribute('aria-label') === gone.label && !node.disabled)
        : null
      ;(twin ?? panel).focus({ preventScroll: true })
    }
    // the overlay's popup lives in a portal, a tick after `open`: the panel is looked for when the focus lands in it
    const onFocusIn = event => {
      const panel = getPanel()
      const target = event.target
      if (!panel || !(target instanceof Element)) return
      // redesign tramo A r5 (W0-PA3-04): a focus that went out of the panel is forgotten; the control we remembered no longer has it
      if (!panel.contains(target)) {
        last = null
        return
      }
      if (watched !== panel) {
        observer?.disconnect()
        watched = panel
        observer = new MutationObserver(onMutation)
        observer.observe(panel, { childList: true, subtree: true })
      }
      last = target === panel ? null : { node: target, tag: target.tagName, label: target.getAttribute('aria-label') }
    }
    // redesign tramo A r5 (W0-PA3-04): the focus is only given back to the twin if the control that left HAD it when it left. If the user
    // took it away first (a click on an empty zone of the page: focus to <body> with the control still in the page), it is forgotten.
    // A control that is taken out of the page while it has the focus is gone by the time this microtask runs, so it is still remembered.
    const onFocusOut = event => {
      const node = event.target
      if (!last || last.node !== node) return
      queueMicrotask(() => {
        if (last && last.node === node && node.isConnected) last = null
      })
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      observer?.disconnect()
    }
  }, [active])
}

/**
 * The modal presentation of the panel (768 to 1279px): a Base UI Dialog that joins the
 * legacy dialog layers through `useOverlayLayer`, like Sheet. The scrim, the focus
 * trap, the inert page and the return of the focus come from there.
 */
// redesign tramo A r3 (W0-QA1-05): the focus opens on the panel itself, as the `aside` of the split and full modes does
// (their panel, `tabIndex -1`, takes it). The default (the first tabbable) landed on the Close button of the loading
// skeleton, and when the real panel replaced the skeleton that button left the page and the focus fell to <body>.
const OverlayPanel = ({ open, onClose, panelLabel, dir, escapedRef, children }) => {
  const { layer, popupRef, lastFocusedRef, portalStyle, finalFocus, onOpenChangeComplete } = useOverlayLayer(open)
  useKeepFocusInPanel(() => popupRef.current, open && layer.ready) // redesign tramo A r4 (W0-QA2-04)

  const handleOpenChange = (nextOpen, details) => {
    if (nextOpen || !open) return
    if (!layer.isActive || details.reason !== 'escape-key') {
      details.cancel()
      return
    }
    // redesign F6c (Q2-02): an Escape typed in a field of the panel is the field's, not the panel's
    const field = details.event?.target
    if (popupRef.current?.contains(field) && ownsEscape(field)) {
      details.cancel()
      leaveField(field, popupRef.current, escapedRef)
      return
    }
    onClose?.()
  }

  if (!layer.ready) return null

  return (
    <DialogPrimitive.Root
      open={open}
      modal={layer.isActive}
      disablePointerDismissal
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <DialogPrimitive.Portal container={layer.host} className='odc-root odc-overlay-portal' style={portalStyle} dir={dir}>
        <DialogPrimitive.Backdrop
          className='odc-overlay-backdrop'
          onClick={() => {
            if (layer.isActive) onClose?.()
          }}
        />
        <DialogPrimitive.Popup
          ref={popupRef}
          className='odc-split-overlay'
          aria-label={panelLabel}
          dir={dir}
          initialFocus={layer.isActive ? () => popupRef.current ?? true : false}
          finalFocus={finalFocus}
          onFocusCapture={event => { lastFocusedRef.current = event.target }}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Split view of a list and its detail panel (C8). The mode follows the window:
 *
 *  - `split` (from 1280px): the list narrows and the panel sits at the end, beside it,
 *    resizable with a separator. The panel is a non-modal `aside`.
 *  - `overlay` (768 to 1279px): the panel is a modal sheet over the list.
 *  - `full` (below 768px): the panel takes the whole view and the list hides; it stays
 *    mounted (`hidden` + `inert`) so its state and scroll survive.
 *
 * `expanded` is "open as a page": in any mode from 768px the list hides and the panel
 * fills the width, while `useSplitView().mode` keeps telling the content its real mode.
 *
 * `panelLabel` (the panel's name) and `resizeLabel` (the separator's name) are required;
 * the wrapper has no text of its own. With `storageKey` the chosen width is kept in
 * localStorage (a failing storage never breaks it). Opening in `split` or `full` moves
 * the focus into the panel; closing returns it to what had it when the panel opened.
 * While the panel is open inline, Escape anywhere in the page calls `onClose` (as the old panel did),
 * unless something already handled it (`defaultPrevented`), the text is being composed, or another layer is
 * open on top (a dialog, sheet, menu or popover): that layer takes the Escape and the panel stays.
 * An Escape typed in a text field, textarea, contenteditable or select trigger with its list open belongs to that field:
 * the panel stays and, for a text field, the focus moves to the panel (what was typed is kept), so the next Escape closes.
 * A closed select trigger is a button for this: Escape closes (redesign F6d, P4-01). `useSplitView().getEscapedField()`
 * answers the field the first Escape took the focus from, until the focus lands elsewhere in the panel.
 * The content can guard the close (`useSplitView().registerCloseGuard`, `requestClose`) to ask before it drops unsaved work.
 * Its «Open as page» toggle can go through the same guards with `useSplitView().guardPlaceChange(proceed)` (owner decision 22): they
 * are asked only while the panel sits in the overlay, where the change moves (and remounts) it.
 */
export const SplitView = ({
  list,
  panel,
  open = false,
  onClose,
  panelLabel,
  resizeLabel,
  expanded = false,
  storageKey,
  className
}) => {
  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (panelLabel == null) throw new Error('SplitView needs a panelLabel')
  if (resizeLabel == null) throw new Error('SplitView needs a resizeLabel')
  const dir = useProductDir()
  const rtl = dir === 'rtl'

  const isSplit = useWidthQuery('min', SPLIT_FROM)
  const isOverlay = useWidthQuery('min', OVERLAY_FROM)
  const isNarrow = useWidthQuery('max', NARROW_UNTIL)
  const mode = isSplit ? 'split' : isOverlay ? 'overlay' : 'full'

  // R1-07: where the panel sits (the aside or the dialog) is decided when it opens, by the rule below, and kept
  // while it stays open: the dialog is a portal, another place in the React tree, so changing place unmounts the panel and loses what
  // was typed in it. (Rendering it once through a portal into a moved host fixed that, but took the panel's menus and popovers out of
  // the dialog's floating tree: a click on a menu closed the overlay.) So a window that crosses 1280 with the panel open does not move
  // it: opened inline and the window shrinks to overlay width, it stays in the aside drawn as the full-width `panel` view; opened in
  // the overlay and the window grows or shrinks, it stays in the dialog. A change of `expanded` decides the place again. Closing
  // forgets it. `useSplitView().mode` is still the window's real mode.
  const placeRef = useRef(null)
  const placedExpandedRef = useRef(expanded)
  if (!open) placeRef.current = null
  else if (placeRef.current == null || placedExpandedRef.current !== expanded) {
    placeRef.current = mode === 'overlay' && !expanded ? 'overlay' : 'inline'
  }
  placedExpandedRef.current = expanded
  const overlayOpen = open && placeRef.current === 'overlay'
  const inlineOpen = open && !overlayOpen
  const view = !open ? 'list' : overlayOpen ? 'overlay' : (mode === 'split' && !expanded ? 'split' : 'panel')
  const listHidden = view === 'panel'

  const rootRef = useRef(null)
  const listRef = useRef(null)
  const asideRef = useRef(null)

  // ── Width: measured from the tokens in this scope, never from literals ──
  const [metrics, setMetrics] = useState(null)
  const [chosen, setChosen] = useState(() => readStored(storageKey))
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)
  const splitting = view === 'split'

  useLayoutEffect(() => {
    if (!splitting) return
    const scope = rootRef.current
    setMetrics({
      min: tokenPx('--od-x-panel-narrow', scope),
      max: tokenPx('--od-x-dialog-lg', scope),
      step: tokenPx('--od-space-4', scope),
      wide: tokenPx('--od-x-panel', scope)
    })
  }, [splitting])

  const resizable = splitting && metrics && metrics.max > metrics.min
  const clamp = value => (metrics ? Math.min(metrics.max, Math.max(metrics.min, value)) : value)
  const current = metrics ? clamp(chosen ?? (isNarrow ? metrics.min : metrics.wide)) : 0

  const setWidth = (next, persist) => {
    const width = Math.round(clamp(next))
    setChosen(width)
    if (persist) writeStored(storageKey, width)
    return width
  }

  const onSeparatorKeyDown = event => {
    // Arrows move the separator the way they point: towards the start grows the panel
    // (it sits at the end) in LTR, and shrinks it in RTL.
    const towardsStart = rtl ? -1 : 1
    let next
    if (event.key === 'ArrowLeft') next = current + towardsStart * metrics.step
    else if (event.key === 'ArrowRight') next = current - towardsStart * metrics.step
    else if (event.key === 'Home') next = metrics.min
    else if (event.key === 'End') next = metrics.max
    else return
    event.preventDefault()
    setWidth(next, true)
  }

  const onPointerDown = event => {
    if (event.button > 0) return
    drag.current = { id: event.pointerId, x: event.clientX, width: current, last: current }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragging(true)
  }

  const onPointerMove = event => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    const delta = event.clientX - state.x
    state.last = setWidth(state.width + (rtl ? delta : -delta), false)
  }

  const endDrag = event => {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    drag.current = null
    setDragging(false)
    writeStored(storageKey, state.last)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  // ── Hidden list: kept mounted, out of the tab order and the accessibility tree ──
  useLayoutEffect(() => {
    listRef.current?.toggleAttribute('inert', listHidden)
  }, [listHidden])

  // ── Focus: into the inline panel on open, back to the opener on close ──
  const openerRef = useRef(null)
  const wasInlineRef = useRef(false)
  if (inlineOpen && !wasInlineRef.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement
  }
  // F1: the opener is the row that opened the panel, and it was never updated: open A, move to B (the panel
  // never closes), close, and the focus went back to A. A click on a row of the list (`data-row-id`, as DataTable and the phone cards
  // carry it) while the panel is open makes that row the opener. Only a row: a click on a filter or the search is not an opener.
  const onListClickCapture = event => {
    if (!wasInlineRef.current || !(event.target instanceof Element)) return
    const row = event.target.closest('[data-row-id]')
    if (row && listRef.current?.contains(row)) openerRef.current = focusableIn(row)
  }
  useLayoutEffect(() => {
    const was = wasInlineRef.current
    wasInlineRef.current = inlineOpen
    if (inlineOpen && !was) {
      const aside = asideRef.current
      if (aside && !aside.contains(document.activeElement)) aside.focus({ preventScroll: true })
    } else if (!inlineOpen && was) {
      const opener = openerRef.current
      openerRef.current = null
      const active = document.activeElement
      if ((!active || active === document.body) && opener?.isConnected) opener.focus()
    }
  }, [inlineOpen])

  useKeepFocusInPanel(() => asideRef.current, inlineOpen) // redesign tramo A r4 (W0-QA2-04)

  // Escape closes the inline panel from anywhere in the page (parity audit 2, B7). A layer that is open on top
  // (dialog, sheet, menu, popover) may close itself in the very same keydown and be gone by the time this
  // listener runs, so the capture listener notes it first and the bubble listener decides.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // redesign F6c (Q2-02): the content can guard the way out (unsaved changes). A guard gets `proceed` (the real close) and
  // answers true when it takes over, to ask first and call `proceed` itself. Escape, the scrim and the content's own close
  // button all go through `requestClose`.
  const guards = useRef(new Set())
  const registerCloseGuard = useCallback(guard => {
    guards.current.add(guard)
    return () => { guards.current.delete(guard) }
  }, [])
  // redesign F6d (Q3-09): the field the first Escape took the focus from. It is forgotten as soon as the focus lands
  // on something else inside the panel; the discard dialog (outside the panel) does not count.
  const escapedRef = useRef(null)
  const getEscapedField = useCallback(() => {
    const escaped = escapedRef.current
    return escaped?.field?.isConnected ? escaped.field : null
  }, [])
  useEffect(() => {
    if (!open) return undefined
    const onFocusIn = event => {
      const escaped = escapedRef.current
      if (!escaped) return
      const target = event.target
      if (escaped.panel?.contains(target) && target !== escaped.panel) escapedRef.current = null
    }
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      escapedRef.current = null
    }
  }, [open])
  // review of (422): it answers whether it closed (true) or a guard took over to ask first (false), for a caller that
  // closes the panel to show something else and must not act later on an answer the user may never give.
  const requestClose = useCallback(() => {
    const proceed = () => onCloseRef.current?.()
    for (const guard of [...guards.current]) {
      if (guard(proceed)) return false
    }
    proceed()
    return true
  }, [])

  // Owner decision 22 B (2026-10-21, RV-3): «Open as page» from the overlay moves the panel (the dialog → the aside), which remounts
  // it and drops what was typed. The content's own toggle calls this with the change as `proceed`: in the overlay it goes through
  // the close guards first (the D-81 question: ask before losing unsaved work), anywhere else the place stays and it proceeds at once.
  // Opt-in: a toggle that does not call it changes `expanded` as before. Same answer as `requestClose`.
  const overlayOpenRef = useRef(false)
  overlayOpenRef.current = overlayOpen
  const guardPlaceChange = useCallback(proceed => {
    if (overlayOpenRef.current) {
      for (const guard of [...guards.current]) {
        if (guard(proceed)) return false
      }
    }
    proceed?.()
    return true
  }, [])

  useEffect(() => {
    if (!inlineOpen) return undefined
    const layered = new WeakSet()
    const onCapture = event => {
      if (event.key === 'Escape' && hasOpenLayer(asideRef.current)) layered.add(event)
    }
    const onKeyDown = event => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || layered.has(event)) return
      const field = event.target
      if (asideRef.current?.contains(field) && ownsEscape(field)) {
        leaveField(field, asideRef.current, escapedRef)
        return
      }
      requestClose()
    }
    document.addEventListener('keydown', onCapture, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onCapture, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [inlineOpen, requestClose])

  const context = useMemo(
    () => ({ mode, open, expanded, onClose, requestClose, registerCloseGuard, guardPlaceChange, getEscapedField }),
    [mode, open, expanded, onClose, requestClose, registerCloseGuard, guardPlaceChange, getEscapedField]
  )

  return (
    <SplitViewContext.Provider value={context}>
      <div
        ref={rootRef}
        className={cx('odc-root odc-split', className)}
        dir={dir}
        data-mode={mode}
        data-view={view}
        data-expanded={expanded ? '' : undefined}
        style={chosen != null && splitting ? { '--odc-panel-size': `${current}px` } : undefined}
      >
        <div ref={listRef} className='odc-split-list' hidden={listHidden} onClickCapture={onListClickCapture}>
          {list}
        </div>
        {resizable && (
          <div
            role='separator'
            aria-orientation='vertical'
            aria-label={resizeLabel}
            aria-valuemin={metrics.min}
            aria-valuemax={metrics.max}
            aria-valuenow={current}
            tabIndex={0}
            className='odc-split-sep'
            data-dragging={dragging ? '' : undefined}
            onKeyDown={onSeparatorKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
          />
        )}
        {inlineOpen && (
          <aside
            ref={asideRef}
            aria-label={panelLabel}
            tabIndex={-1}
            className='odc-split-panel'
          >
            {panel}
          </aside>
        )}
        <OverlayPanel open={overlayOpen} onClose={requestClose} panelLabel={panelLabel} dir={dir} escapedRef={escapedRef}>
          {panel}
        </OverlayPanel>
      </div>
    </SplitViewContext.Provider>
  )
}
