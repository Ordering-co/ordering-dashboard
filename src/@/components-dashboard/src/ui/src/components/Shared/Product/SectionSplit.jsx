import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { hasActiveDialogLayer } from '../UI/dialog-layer'
import { captureSidebarDismissal, ownsCapturedSidebarDismissal, registerSidebar } from '../UI/sidebar-layer'
import { ChevronLeft, X } from '../Icon'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { BREAKPOINT_SPLIT } from '../../../../../utils/breakpoints'
import { Button, IconButton } from './Button'
import { useNestedLeaveGuard } from './LeaveGuard'
import { cx } from './classNames'
import { tokenPx } from './positioning'
import { useProductDir } from './useProductDir'
import './product.css'
import './section-split.css'

// redesign Tiendas 2.B. The list and the detail of one record of a section (a zone, a gateway, a menu…), side by
// side when the section has room for both and stacked when not. The piece owns the mode, the header of the detail (title,
// actions, X or «‹ back»), the guards of the way out, the Escape order (SideBar, then this detail, then the editor panel) and
// the focus in and out of the detail. It has no text of its own.

// Popups that own their Escape and are not in the dialog layer registry (menus, popovers, listboxes).
// same rule as SplitView (Q2-02, P4-01); SplitView does not export it and must not change in this lot
const POPUP_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

const hasOpenLayer = panel => {
  if (hasActiveDialogLayer()) return true
  return [...document.querySelectorAll(POPUP_SELECTOR)].some(node => (
    !panel?.contains(node) &&
    !node.hasAttribute('data-ending-style') &&
    !node.closest('[hidden], [aria-hidden="true"], [inert]')
  ))
}

// same rule as SplitView (Q2-02, P4-01); SplitView does not export it and must not change in this lot
// Where a typed Escape belongs to the field and not to the detail: a text field, a textarea or a contenteditable keeps what is
// typed (the first Escape only takes the focus out of it); a select trigger owns the Escape that closes its own list, while
// that list is open. Everything else in the detail (buttons, links) still closes it.
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

const ownsEscape = node => isTextField(node) || isOpenSelectTrigger(node)

// same rule as SplitView (Q2-02, P4-01); SplitView does not export it and must not change in this lot
// Takes the focus out of a text field to the detail (what is typed stays), so the next Escape is the detail's.
const leaveField = (field, detail) => {
  if (!isTextField(field)) return
  field.blur?.()
  if (detail && detail.isConnected && !detail.contains(document.activeElement)) {
    detail.focus({ preventScroll: true })
  }
}

const isEscape = event => event.key === 'Escape' || event.code === 'Escape'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Focuses `node` and answers whether it took it (a row that is not focusable does not).
const takeFocus = (node, options) => {
  if (!node || !node.isConnected) return false
  node.focus(options)
  return document.activeElement === node
}

const escapeKey = key => {
  const value = String(key)
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&')
}

// review F3-4: the ancestors that clip what the piece shows (any overflow but `visible`, on either axis: `hidden` is a scroll container
// the sticky detail anchors to, and `overflow-x: hidden` alone computes `overflow-y: auto`), up to the page. The visible box of the
// detail is the intersection of all of them with the viewport, so a wrapper that clips without scrolling does not make it taller
// than the screen. The walk stops at a fixed ancestor: nothing above it clips it.
const CLIPPING = /auto|scroll|hidden|clip/
const clippingAncestors = node => {
  const found = []
  for (let element = node.parentElement; element; element = element.parentElement) {
    if (element === document.documentElement || element === document.body || element === document.scrollingElement) break
    const style = window.getComputedStyle(element)
    if (CLIPPING.test(style.overflowY || '') || CLIPPING.test(style.overflowX || '') || CLIPPING.test(style.overflow || '')) found.push(element)
    // a fixed box (the store editor panel) is not clipped by what is above it; the shell's <main> (overflow hidden,
    // 0 px tall) made the detail 0 px when the walk went on
    if (style.position === 'fixed') break
  }
  return found
}

// What the clipping ancestors and the viewport leave visible, vertically.
const visibleBand = ancestors => {
  let top = 0
  let bottom = window.innerHeight
  for (const element of ancestors) {
    const rect = element.getBoundingClientRect()
    const inner = rect.top + element.clientTop
    top = Math.max(top, inner)
    bottom = Math.min(bottom, inner + element.clientHeight)
  }
  return { top, bottom }
}

// review F3-1: a dialog that is closing (the leave question after «Discard») still holds the focus when the detail goes away, and
// then hands it to a control that went with the detail: the focus falls to <body>. Such a focus is not the user's.
const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]'
const RESTORE_FRAMES = 60 // about a second at 60 Hz: the close animation of a dialog, with room

const DEFAULT_CONTEXT = {
  mode: 'split',
  open: false,
  requestClose: () => {},
  requestLeave: proceed => { proceed?.() },
  registerCloseGuard: () => () => {}
}
const SectionSplitContext = createContext(null)

/**
 * What the content of the list and the detail needs from the piece: `mode` (`split` or `stack`), whether a record is `open`,
 * `requestClose()` and `requestLeave(proceed)` (both go through the guards), and `registerCloseGuard(guard)` to ask before
 * unsaved work is dropped; it returns the function that unregisters. Outside a SectionSplit it answers a closed one.
 */
export const useSectionSplit = () => useContext(SectionSplitContext) || DEFAULT_CONTEXT

// The chevron of the back button points to the start of the line, so it flips in RTL like the IconButton ones.
const BackIcon = ({ className }) => <ChevronLeft className={cx(className, 'odc-icon-flip')} />

/**
 * List and detail of a record, side by side or stacked.
 *
 *  - `split`: the dashboard has room (`useWindowSize().width >= splitFrom`, 1280 by default) and the root of the piece, measured
 *    with a ResizeObserver (never a size container), fits a list, the narrow detail and a gap. The detail sits at the end,
 *    sticky at the top of the scroller the piece lives in, with an X.
 *  - `stack`: otherwise. With a record open the detail replaces the list (kept mounted, `hidden` and `inert`) and has a
 *    «‹ backLabel» button.
 *
 * `detailTitle` (the h3 and the name of the detail; required while `open`), `closeLabel` and `backLabel` are required: the piece has no text of
 * its own, and `''` paints empty. `detailKey` is the id of the open record (`'new'` for a new one). A row that carries
 * `data-section-split-key="<detailKey>"` is where the focus returns to if the control that opened the detail left the page.
 * `closeGuard(proceed)` answers `true` when it takes over (asks, then calls `proceed` itself); controls inside register more
 * with `useSectionSplit().registerCloseGuard`. A click on another row must go through `requestLeave(proceed)`, available
 * through the `ref` as well as `{ requestClose, requestLeave }`.
 * `onExtendChange(true|false)` tells the shell to give the section the full width while a record is open.
 * `revealDetail` (opt-in, redesign stores 5.18): stacked, a record that opens is scrolled to the top of its detail.
 */
export const SectionSplit = React.forwardRef(function SectionSplit ({
  open = false,
  detailKey,
  onClose,
  onExtendChange,
  splitFrom = BREAKPOINT_SPLIT,
  detailTitle,
  closeLabel,
  backLabel,
  headerActions,
  footer,
  closeGuard,
  revealDetail = false,
  list,
  detail,
  className
}, ref) {
  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (closeLabel == null) throw new Error('SectionSplit needs a closeLabel')
  if (backLabel == null) throw new Error('SectionSplit needs a backLabel')
  if (open && detailTitle == null) throw new Error('SectionSplit needs a detailTitle')

  const dir = useProductDir()
  const titleId = useId()
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const detailRef = useRef(null)

  // ── Mode: the room of the dashboard and the measured root ──
  const { width: windowWidth } = useWindowSize()
  const room = windowWidth ?? (typeof window !== 'undefined' ? window.innerWidth : splitFrom)
  const [rootWidth, setRootWidth] = useState(null) // null until measured: the room alone decides
  const [minSplit, setMinSplit] = useState(0) // 0 until the tokens read: a scope without them cannot say it does not fit

  useLayoutEffect(() => {
    const node = rootRef.current
    if (!node) return undefined
    const sizes = ['--od-x-search', '--od-x-panel-narrow', '--od-space-4'].map(name => tokenPx(name, node))
    setMinSplit(sizes.every(size => Number.isFinite(size) && size > 0) ? sizes.reduce((sum, size) => sum + size, 0) : 0)
    const measure = width => setRootWidth(Number.isFinite(width) ? width : null)
    measure(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => measure(node.getBoundingClientRect().width)
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }
    const observer = new ResizeObserver(entries => {
      measure(entries[0]?.contentRect?.width ?? node.getBoundingClientRect().width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const fits = rootWidth == null || rootWidth >= minSplit
  const mode = room >= splitFrom && fits ? 'split' : 'stack'
  const view = !open ? 'list' : mode === 'split' ? 'split' : 'detail'
  const listHidden = view === 'detail'

  // Hidden list: kept mounted, out of the tab order and the accessibility tree. Before the focus effects below, which need it back.
  useLayoutEffect(() => {
    listRef.current?.toggleAttribute('inert', listHidden)
  }, [listHidden])

  // ── The shell gives the section the full width while a record is open ──
  const onExtendRef = useRef(onExtendChange)
  onExtendRef.current = onExtendChange
  const extendedRef = useRef(false)
  useLayoutEffect(() => {
    if (open && !extendedRef.current) {
      extendedRef.current = true
      onExtendRef.current?.(true)
    } else if (!open && extendedRef.current) {
      extendedRef.current = false
      onExtendRef.current?.(false)
    }
  }, [open])
  useLayoutEffect(() => () => {
    if (!extendedRef.current) return
    extendedRef.current = false
    onExtendRef.current?.(false)
  }, [])

  // ── Guards of the way out ──
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const closeGuardRef = useRef(closeGuard)
  closeGuardRef.current = closeGuard
  const guards = useRef(new Set())
  const registerCloseGuard = useCallback(guard => {
    guards.current.add(guard)
    return () => { guards.current.delete(guard) }
  }, [])
  // The closeGuard prop first, then the registered ones in order. The first that answers true takes over (it asks, then calls
  // `proceed` itself) and nothing else runs; if none does, `proceed` runs.
  // `onCancel` (optional) is handed to the guards with `proceed`: the leave-guard host (P/LeaveGuard) passes it so a guard that keeps
  // the user can say so.
  const requestLeave = useCallback((proceed, onCancel) => {
    const prop = closeGuardRef.current
    if (prop && prop(proceed, onCancel)) return
    for (const guard of [...guards.current]) {
      if (guard(proceed, onCancel)) return
    }
    proceed?.()
  }, [])
  const requestClose = useCallback(() => requestLeave(() => onCloseRef.current?.()), [requestLeave])

  // redesign stores 2.A + 2.B (): every way out of the surrounding leave-guard host (a section change, the
  // Overview, another store, closing the editor) asks this piece first; the host asks about its own forms only once it lets go.
  // review F3-2/F3-3: only the piece's own `closeGuard` answers here. The forms of the detail use `useLeaveGuard`, which registers
  // them in the host too: the host asks about them itself, once and with its `onCancel`. Asking them here as well would ask twice
  // (their dirty state is only read again after a render) and drop the host's `onCancel`.
  const requestLeaveFromHost = useCallback((proceed, onCancel) => {
    const prop = closeGuardRef.current
    if (prop && prop(proceed, onCancel)) return
    proceed?.()
  }, [])
  useNestedLeaveGuard(requestLeaveFromHost)

  useImperativeHandle(ref, () => ({ requestClose, requestLeave }), [requestClose, requestLeave])

  // ── Focus: into the detail on open, back to the row on close ──
  const openerRef = useRef(null)
  const lastKeyRef = useRef(detailKey)
  const restoreFrame = useRef(0) // a wait for a closing dialog to let the focus go (review F3-1)
  const previous = useRef({ open: false, key: detailKey, mode })
  useLayoutEffect(() => {
    const was = previous.current
    previous.current = { open, key: detailKey, mode }
    const detailNode = detailRef.current
    const listNode = listRef.current
    const rootNode = rootRef.current
    const active = document.activeElement
    const onBody = !active || active === document.body
    const inDetail = !!detailNode && detailNode.contains(active)
    const remember = () => {
      if (!onBody && !inDetail) openerRef.current = active
    }
    const focusDetail = () => takeFocus(detailNode, mode === 'split' ? { preventScroll: true } : undefined)

    if (open) lastKeyRef.current = detailKey

    if (open && !was.open) {
      remember()
      focusDetail()
    } else if (open && detailKey !== was.key) {
      remember()
      if (mode === 'stack' || inDetail || onBody) focusDetail()
    } else if (open && mode === 'stack' && was.mode === 'split') {
      // the list is hidden now: a focus that was in it (or that fell to <body> with it) goes to the detail
      if (onBody || listNode?.contains(active)) focusDetail()
    } else if (!open && was.open) {
      const opener = openerRef.current
      openerRef.current = null
      const key = lastKeyRef.current
      const restore = () => {
        if (opener && opener.isConnected && listNode?.contains(opener) && takeFocus(opener)) return
        const row = listNode?.querySelector(`[data-section-split-key="${escapeKey(key)}"]`)
        if (row) {
          if (takeFocus(row)) return
          const control = row.querySelector(FOCUSABLE)
          if (control && takeFocus(control)) return
        }
        takeFocus(listNode)
      }
      // review F3-1: the focus is in a dialog that is closing (the leave question). Wait for it to let go: if it drops the focus
      // to <body>, the row gets it; if it lands somewhere real (the user, or the dialog's own return), it stays there.
      if (active?.closest?.(DIALOG_SELECTOR)) {
        let frames = 0
        const watch = () => {
          restoreFrame.current = 0
          const now = document.activeElement
          if (!now || now === document.body) {
            restore()
            return
          }
          if (!now.closest?.(DIALOG_SELECTOR) || ++frames > RESTORE_FRAMES) return
          restoreFrame.current = window.requestAnimationFrame(watch)
        }
        restoreFrame.current = window.requestAnimationFrame(watch)
        return
      }
      // Whatever the user did meanwhile, a focus that is outside the piece or already on a control of the list is theirs.
      if (!onBody && (!rootNode?.contains(active) || listNode?.contains(active))) return
      restore()
    }
  }, [open, detailKey, mode])

  // redesign stores 5.18 (R5.8-02 of 5.8): OPT-IN `revealDetail`. Stacked, the detail replaces the list where the user was,
  // often low in a long list, and the focus alone left its header (title, «‹ back», tabs) above the screen. Each time a record opens or
  // another one replaces it, the top of the detail is brought into view (a frame later, once the hidden list is out of the flow).
  // Side by side the detail is sticky in view and nothing scrolls. A change of mode alone does not scroll.
  const modeRef = useRef(mode)
  modeRef.current = mode
  useEffect(() => {
    if (!revealDetail || !open || modeRef.current !== 'stack') return undefined
    const frame = window.requestAnimationFrame(() => {
      if (modeRef.current === 'stack') detailRef.current?.scrollIntoView?.({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [revealDetail, open, detailKey])

  // The wait for a closing dialog ends when the detail opens again or the piece goes away.
  useEffect(() => {
    if (!open || !restoreFrame.current) return undefined
    window.cancelAnimationFrame(restoreFrame.current)
    restoreFrame.current = 0
    return undefined
  }, [open])
  useEffect(() => () => {
    if (restoreFrame.current) window.cancelAnimationFrame(restoreFrame.current)
  }, [])

  // ── Escape: SideBar, then this detail, then the editor panel ──
  useEffect(() => {
    if (!open) return undefined
    const unregister = registerSidebar(detailRef)
    const layered = new WeakSet()
    // A layer that is open on top (dialog, menu, popover) may close itself in the very same keydown and be gone by the time the
    // bubble listener runs, so the capture listener notes it first and the bubble listener decides.
    const onCapture = event => {
      captureSidebarDismissal(event, hasActiveDialogLayer())
      if (isEscape(event) && hasOpenLayer(detailRef.current)) layered.add(event)
    }
    const onKeyDown = event => {
      if (!isEscape(event) || event.defaultPrevented || event.isComposing || layered.has(event)) return
      if (!ownsCapturedSidebarDismissal(event, detailRef)) return
      const field = event.target
      if (detailRef.current?.contains(field) && ownsEscape(field)) {
        leaveField(field, detailRef.current)
        return
      }
      requestClose()
    }
    document.addEventListener('keydown', onCapture, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      unregister()
      document.removeEventListener('keydown', onCapture, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, requestClose])

  // ── Sticky detail: its height is what the clipping ancestors and the viewport show below the top of the root (a measured value) ──
  // review F3-4/F3-8: measured again on any scroll of the page or an ancestor (a capture listener on the document), on resize, and
  // when the root or the nearest clipping ancestor changes size (a header that wraps, a banner that appears).
  const stickyActive = open && mode === 'split'
  useLayoutEffect(() => {
    const node = rootRef.current
    if (!stickyActive || !node) return undefined
    const ancestors = clippingAncestors(node)
    let frame = 0
    const measure = () => {
      frame = 0
      const { top, bottom } = visibleBand(ancestors)
      const max = Math.max(0, bottom - Math.max(top, node.getBoundingClientRect().top))
      node.style.setProperty('--odc-section-split-max', `${Math.floor(max)}px`)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }
    measure()
    document.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(node)
    if (ancestors[0]) observer?.observe(ancestors[0])
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      document.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      observer?.disconnect()
      node.style.removeProperty('--odc-section-split-max')
    }
  }, [stickyActive])

  const context = useMemo(
    () => ({ mode, open, requestClose, requestLeave, registerCloseGuard }),
    [mode, open, requestClose, requestLeave, registerCloseGuard]
  )

  return (
    <SectionSplitContext.Provider value={context}>
      <div
        ref={rootRef}
        className={cx('odc-root odc-section-split', className)}
        dir={dir}
        data-mode={mode}
        data-view={view}
      >
        <div ref={listRef} className='odc-section-split-list' tabIndex={-1} hidden={listHidden}>
          {list}
        </div>
        {open && (
          <section
            ref={detailRef}
            className='odc-section-split-detail'
            tabIndex={-1}
            aria-labelledby={titleId}
            data-key={String(detailKey)}
          >
            {mode === 'stack' && (
              <div className='odc-section-split-back'>
                <Button variant='ghost' size='sm' icon={BackIcon} onClick={requestClose}>{backLabel}</Button>
              </div>
            )}
            <header className='odc-section-split-head'>
              <h3 id={titleId} className='odc-section-split-title'>{detailTitle}</h3>
              {headerActions && <div className='odc-section-split-actions'>{headerActions}</div>}
              {mode === 'split' && <IconButton icon={X} label={closeLabel} onClick={requestClose} />}
            </header>
            <div className='odc-section-split-body'>{detail}</div>
            {footer && <div className='odc-section-split-foot'>{footer}</div>}
          </section>
        )}
      </div>
    </SectionSplitContext.Provider>
  )
})
