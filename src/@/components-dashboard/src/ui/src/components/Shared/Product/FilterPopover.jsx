import React, { useCallback, useRef, useState } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { Avatar } from './Avatar'
import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { useOverlayLayer } from './Dialog'
import { FilterPill, SearchField, resolveOpener } from './FilterBar'
import { cx } from './classNames'
import { tokenOffset, tokenPx } from './positioning'
import { useProductDir } from './useProductDir'
import './filter-popover.css'

// redesign W0-2a (T0-4): promoted from Orders/OrdersFilterBar. It has no text of its own: «Clear», «Search», «Clear
// search», «Loading...» and «No results found» arrive as props, already translated, and a name that is missing throws.

const sideOffset = tokenOffset('--od-space-1')
// redesign W0-4b (D-25): a pill near the edge of the window keeps its popover inside it: it flips to the other side
// when the first one does not fit and slides along the edge (it never flips the alignment), one viewport gap from it.
const collisionAvoidance = { side: 'flip', align: 'shift' }

// redesign F6c-1 (Q2-03): the rows of a pill list are the Product checkboxes (`role="checkbox"` buttons). The popup
// gives them the keyboard of the C18 selects: ArrowDown / ArrowUp move between rows (ArrowDown from the search
// field enters the list, ArrowUp from the first row goes back to it), Home / End jump to the ends, and only one row
// is in the Tab order (roving tab stop: the one with the focus, else the first one that is checked, else the first).
// Space toggles the row natively (it is a button) and Enter is pressed here (Base UI blocks it on checkboxes). It works on whatever rows the popup holds, so the Status
// list (rendered by OrderStatusSubFilter) gets it without its own code.
const ROW = '[role="checkbox"]:not(:disabled)'
const SEARCH = 'input[type="search"]'
const rowsOf = root => Array.from(root.querySelectorAll(ROW))

/** Keeps one row of the popup in the Tab order. Returns the function that stops it. */
const startRovingRows = (root) => {
  let active = null
  const sync = () => {
    const rows = rowsOf(root)
    if (rows.length === 0) return
    if (!rows.includes(active)) active = rows.find(row => row.getAttribute('aria-checked') === 'true') ?? rows[0]
    rows.forEach(row => { row.tabIndex = row === active ? 0 : -1 })
  }
  const handleFocusIn = (event) => {
    const row = event.target.closest?.(ROW)
    if (!row) return
    active = row
    sync()
  }
  sync()
  const observer = new window.MutationObserver(sync)
  observer.observe(root, { childList: true, subtree: true })
  root.addEventListener('focusin', handleFocusIn)
  return () => {
    observer.disconnect()
    root.removeEventListener('focusin', handleFocusIn)
  }
}

const handleListKeyDown = (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  // Base UI keeps Enter from toggling a checkbox (ARIA practice). Here every row of the list is a choice, and the
  // pill lists promise Enter and Space like the C18 selects: Enter presses the row (Space is the button's own).
  const pressed = event.key === 'Enter' ? event.target.closest?.(ROW) : null
  if (pressed) {
    event.preventDefault()
    pressed.click()
    return
  }
  if (event.defaultPrevented) return
  const root = event.currentTarget
  const rows = rowsOf(root)
  if (rows.length === 0) return
  const row = event.target.closest?.(ROW)
  const search = root.querySelector(SEARCH)
  const index = rows.indexOf(row)
  let target
  if (row) {
    if (event.key === 'ArrowDown') target = rows[Math.min(index + 1, rows.length - 1)]
    else if (event.key === 'ArrowUp') target = index === 0 ? search : rows[index - 1]
    else if (event.key === 'Home') target = rows[0]
    else if (event.key === 'End') target = rows[rows.length - 1]
  } else if (event.key === 'ArrowDown' && search && event.target === search) {
    target = rows[0]
  }
  if (!target) return
  event.preventDefault()
  target.focus()
}

// redesign W0-2 r2 (W0-Q1-05): the Tab stops of a popup, and the first control after the pill. The popup is non-modal
// (product.md › Layering and Escape): Tab out of it closes it and goes on to the next control of the page, never to <body>.
// redesign tramo A (W0-Q2-02): a control only counts if the browser can really focus it, so a «+0 more filters» button that
// is `visibility: hidden` (or any hidden, inert, aria-hidden, disabled, zero-size or overflowed one) is never the target.
const TABBABLE = 'a[href], button, input, select, textarea, summary, [tabindex]'
const HIDDEN_BRANCH = '[inert], [hidden], [data-overflowed], [aria-hidden="true"]'

/** True when the browser would let the user focus `node`: rendered, not `visibility: hidden`, not zero-size. */
const isRendered = (node) => {
  if (typeof node.checkVisibility === 'function') {
    if (!node.checkVisibility({ checkVisibilityCSS: true })) return false
  } else {
    // no `checkVisibility` (jsdom, old engines): walk the branch for `display: none` and `visibility: hidden`
    for (let current = node; current && current.nodeType === 1; current = current.parentElement) {
      const style = window.getComputedStyle(current)
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
    }
  }
  const rects = Array.from(node.getClientRects())
  return rects.length === 0 || rects.some(rect => rect.width > 0 || rect.height > 0) // no layout engine: nothing to measure
}

export const tabbablesOf = root => Array.from(root.querySelectorAll(TABBABLE)).filter(node => (
  node.tabIndex >= 0 &&
  !node.disabled &&
  node.type !== 'hidden' &&
  !node.hasAttribute('data-base-ui-focus-guard') &&
  !node.closest(HIDDEN_BRANCH) &&
  isRendered(node)
))

/** The first control after `opener` in document order (inside its dialog, if it sits in one), or null. */
export const nextStopAfter = (opener, popup) => {
  if (!opener) return null
  const scope = opener.closest('[role="dialog"], [role="alertdialog"]') ?? document
  return tabbablesOf(scope).find(node => (
    !popup.contains(node) &&
    !opener.contains(node) &&
    (opener.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  )) ?? null
}

/**
 * redesign tramo A (W0-Q2-03): the Tab-out rule of every non-modal pill popover (W0-Q1-05), in one place so the pill lists
 * and the Date range popover (and the date picker after them) answer the same. Tab from the last stop of the popup, or
 * Shift+Tab from its first, leaves it: the popover closes and the focus goes to the next visible control after the opener
 * (backwards: to the opener), else to the opener; never to <body>, where Base UI's focus guards would drop it.
 *
 * `getOpener()` gives the node the pill or trigger sits in (it goes through `resolveOpener`, so a parked pill answers with
 * its «+N» button), `close()` closes the popover and `layer` is the overlay layer of `useOverlayLayer`.
 * Returns `onKeyDown` for the popup, `finalFocus` for the popup (it replaces `layer.resolveFinalFocus(...)`) and `reset()`,
 * to call when the trigger toggles the popover, so an old exit never outlives its close.
 */
export const usePopoverTabOut = ({ getOpener, close, layer }) => {
  const exitFocusRef = useRef(null)

  const onKeyDown = (event) => {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return
    const popup = event.currentTarget
    const stops = tabbablesOf(popup)
    const edge = event.shiftKey ? stops[0] : stops[stops.length - 1]
    const leaves = stops.length === 0 || event.target === edge || (event.shiftKey && event.target === popup)
    if (!leaves) return
    const opener = resolveOpener(getOpener())
    event.preventDefault()
    exitFocusRef.current = event.shiftKey ? opener : (nextStopAfter(opener, popup) ?? opener)
    close()
  }

  const finalFocus = () => {
    const exit = exitFocusRef.current
    exitFocusRef.current = null
    const opener = resolveOpener(getOpener())
    // a target that cannot take the focus any more (it was hidden meanwhile) falls back to the opener
    if (exit?.isConnected && (exit === opener || isRendered(exit))) return exit
    return layer.resolveFinalFocus(opener)
  }

  const reset = () => { exitFocusRef.current = null }

  return { onKeyDown, finalFocus, reset }
}

// redesign bi FB2 (D6): a function child is called only while the popup is mounted (the popup mounts its content on open
// and drops it after the exit), never on the renders of a closed pill
const PopupBody = ({ render, close }) => render({ close })

/**
 * A filter pill (Product `FilterPill`) that opens a popover with whatever the
 * filter already used as its picker (a checklist, a MultiSelect, a text field).
 *
 * FilterPill is a plain function component and cannot hand its button to Base UI
 * as a trigger, so the popover is controlled and anchored to the span around the
 * pill. A press on the pill itself is not an outside press (it would close the
 * popover and the click would open it again). Escape and a press elsewhere close
 * it and the focus returns to the pill. `label` names the pill and the popup.
 *
 * A pill that does not fit the bar's row is parked on top of its «+N» button (FilterBar, redesign F1b), so the
 * popover opens under «+N» and the focus goes back to «+N» (`resolveOpener`).
 *
 * While it is open it is an overlay layer (`useOverlayLayer`, like Sheet and the date range), so one
 * Escape closes only the topmost surface: a panel behind the popover is not closed with it, and a
 * surface opened above it is the one that answers (redesign fix-qa C3, B13).
 *
 * Registering the layer makes the shared host `#app-modals` (fixed, full screen, z-index 3000), so the
 * popup has to mount inside that host, with the layer's order, like Sheet and the date range do. In
 * `body` it sat under the host, which took every click: the rows opened and never answered
 * (redesign fix-qa D1).
 *
 * It is a non-modal layer (`modal: false`): while it is the only one in the host, the host lets the pointer
 * through, so a click outside closes the popover and still reaches what was under it, e.g. the next pill
 * (redesign F1b, D-11).
 *
 * redesign bi FB2 (D6, auditor 6): two opt-in props. `defaultOpen` (default `false`) opens the popover when it mounts,
 * and is only read then (the owner remounts the pill to open it later). `children` may be a function
 * `({ close }) => node`, called while the popover is open: `close()` closes it and the focus goes back to the pill the
 * same way as with Escape (`finalFocus`). A node is painted as before.
 */
export const FilterPopover = ({
  icon,
  label,
  value,
  priority,
  children,
  popupClassName,
  className,
  defaultOpen = false
}) => {
  const dir = useProductDir()
  const anchorRef = useRef(null)
  const [open, setOpen] = useState(defaultOpen)
  const { layer, popupRef, lastFocusedRef, portalStyle, onOpenChangeComplete } = useOverlayLayer(open, { modal: false })
  const stopRoving = useRef(null)
  const tabOut = usePopoverTabOut({ getOpener: () => anchorRef.current, close: () => setOpen(false), layer }) // redesign tramo A (W0-Q2-03)
  const attachPopup = useCallback((node) => {
    stopRoving.current?.()
    stopRoving.current = node ? startRovingRows(node) : null
    popupRef.current = node
  }, [popupRef])

  const handleOpenChange = (next, details) => {
    if (!next && details?.reason === 'outside-press' && anchorRef.current?.contains(details.event?.target)) {
      details.cancel()
      return
    }
    if (!next && details?.reason === 'escape-key' && !layer.isActive) {
      details.cancel()
      return
    }
    setOpen(next)
  }

  const handleKeyDown = (event) => {
    tabOut.onKeyDown(event)
    handleListKeyDown(event)
  }

  // redesign bi FB2 (D6): what a function child closes the popover with; no stale Tab exit may outlive it, so the focus
  // goes back to the pill (`finalFocus`), as after Escape
  const close = () => {
    tabOut.reset()
    setOpen(false)
  }

  return (
    <>
      <span ref={anchorRef} className={cx('odc-orders-pill-anchor', className)}>
        <FilterPill
          icon={icon}
          label={label}
          value={value}
          priority={priority}
          expanded={open}
          hasPopup='dialog'
          onClick={() => { tabOut.reset(); setOpen(current => !current) }}
        />
      </span>
      <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
        <PopoverPrimitive.Portal container={layer.host} className='odc-root odc-overlay-portal' style={portalStyle} dir={dir}>
          <PopoverPrimitive.Positioner
            anchor={anchorRef}
            side='bottom'
            align='start'
            sideOffset={sideOffset}
            collisionAvoidance={collisionAvoidance}
            collisionPadding={tokenPx('--od-x-viewport-gap')}
            className='odc-orders-popover-positioner'
          >
            <PopoverPrimitive.Popup
              ref={attachPopup}
              aria-label={label}
              dir={dir}
              className={cx('odc-orders-popover', popupClassName)}
              finalFocus={tabOut.finalFocus}
              onFocusCapture={event => { lastFocusedRef.current = event.target }}
              onKeyDown={handleKeyDown}
            >
              {typeof children === 'function' ? <PopupBody render={children} close={close} /> : children}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  )
}

/**
 * Short text for the ids a filter holds: the names when there are two or fewer,
 * else how many. `nameOf(id)` returns the readable name or nothing; the id is the
 * fallback while a list is still loading. `countText(count)` is the translated
 * «n selected».
 */
export const summarizeIds = (ids, nameOf, countText) => {
  const list = Array.isArray(ids) ? ids : []
  if (list.length === 0) return ''
  if (list.length > 2) return countText(list.length)
  return list.map(id => nameOf(id) ?? String(id)).join(', ')
}

/**
 * The foot of a pill list: «Clear», the same word in every pill, as a link button whose hit area is at least
 * 24×24 (44 below 768px, filter-popover.css). `onClear` empties the filter (redesign F6c-1, Q2-15).
 */
export const PopoverFoot = ({ onClear, clearLabel }) => {
  if (clearLabel == null) throw new Error('PopoverFoot needs a clearLabel') // redesign W0-2 r2 (W0-Q1-01): '' paints empty
  // redesign W0-2 r2 (W0-Q1-04): «Clear» empties the filter and the foot unmounts with the focus on it. The focus moves first
  // to the search field of the popup, else to its first row, so it stays inside the popover and never falls to <body>.
  const handleClear = (event) => {
    const popup = event.currentTarget.closest?.('.odc-orders-popover')
    const target = popup?.querySelector(SEARCH) ?? (popup ? rowsOf(popup)[0] : null)
    target?.focus()
    onClear?.(event)
  }
  return (
    <div className='odc-orders-popover-foot'>
      <Button variant='link' onClick={handleClear}>{clearLabel}</Button>
    </div>
  )
}

// redesign stores 3.A: the same ids, whatever their order (a draft never holds one twice)
const sameIds = (a, b) => a.length === b.length && a.every(id => b.includes(id))

/**
 * Body of a pick-many popover: a search field, the options as Product checkboxes in a list that scrolls
 * (the whole list is already in memory, so there is no pager), and «Clear» once something is picked.
 * It lives inside the popup, so the search text starts empty each time the popover opens.
 *
 * redesign stores 3.A: with `onApply` it keeps a draft of the ids instead of calling `onToggle` on each tick;
 * the draft starts from `selected` each time the popover opens (the body mounts with the popup) and only «Apply» commits it.
 * Without `onApply` nothing of this is drawn or run.
 */
const ChecklistBody = ({
  label,
  items,
  selected,
  onToggle,
  onClear,
  onApply,
  close,
  loading,
  avatars,
  searchLabel,
  clearSearchLabel,
  loadingLabel,
  noResultsLabel,
  clearLabel,
  applyLabel
}) => {
  const [query, setQuery] = useState('')
  const drafting = typeof onApply === 'function'
  const [draft, setDraft] = useState(() => selected)
  const checkedIds = drafting ? draft : selected
  const needle = query.trim().toLocaleLowerCase()
  // `keywords` (redesign F6d-1, P4-04) is what else a row is found by; without it the secondary text is searched.
  // A group's secondary text is «ID 34»: its label must not match («id» would bring every group), so it passes `34`.
  const matches = (item) => [item.name, ...(item.keywords ?? [item.secondary])].some(text => String(text ?? '').toLocaleLowerCase().includes(needle))
  const shown = needle ? items.filter(matches) : items
  // redesign W0-2 r2 (W0-Q1-01): a label that is missing throws; an empty string (an empty translation) paints empty
  if (searchLabel == null) throw new Error('ChecklistPopover needs a searchLabel')
  if (clearSearchLabel == null) throw new Error('ChecklistPopover needs a clearSearchLabel')
  if (drafting && applyLabel == null) throw new Error('ChecklistPopover needs an applyLabel') // redesign stores 3.A
  const empty = shown.length === 0
  if (empty && loading && loadingLabel == null) throw new Error('ChecklistPopover needs a loadingLabel')
  if (empty && !loading && noResultsLabel == null) throw new Error('ChecklistPopover needs a noResultsLabel')
  return (
    <div className='odc-orders-picker'>
      <SearchField
        className='odc-orders-picker-search'
        value={query}
        onChange={setQuery}
        label={`${searchLabel} ${label}`}
        placeholder={searchLabel}
        clearLabel={clearSearchLabel}
      />
      <div className='odc-orders-checklist odc-orders-picker-list' role='group' aria-label={label}>
        {shown.map(item => (
          <Checkbox
            key={item.id}
            checked={checkedIds.includes(item.id)}
            onCheckedChange={() => (drafting
              ? setDraft(current => (current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]))
              : onToggle(item.id))}
          >
            <span className='odc-orders-picker-row'>
              {avatars && <Avatar kind={avatars === 'business' ? 'business' : 'person'} name={item.name} src={item.photo} />}
              <span className='odc-orders-picker-name'>{item.name}</span>
              {item.secondary !== undefined && item.secondary !== null && item.secondary !== '' && (
                <>
                  {' '}
                  <span className='odc-orders-picker-meta odc-num'>{item.secondary}</span>
                </>
              )}
            </span>
          </Checkbox>
        ))}
      </div>
      {empty && (
        <p className='odc-orders-picker-empty' role='status'>
          {loading ? loadingLabel : noResultsLabel}
        </p>
      )}
      {drafting && (
        <div className='odc-orders-picker-apply'>
          <Button
            variant='primary'
            size='sm'
            onClick={() => {
              if (!sameIds(draft, selected)) onApply(draft)
              close?.()
            }}
          >
            {applyLabel}
          </Button>
        </div>
      )}
      {selected.length > 0 && (
        <PopoverFoot
          onClear={drafting ? (event) => { setDraft([]); onClear?.(event) } : onClear}
          clearLabel={clearLabel}
        />
      )}
    </div>
  )
}

/**
 * A filter pill whose popover is the checklist itself (Driver, Driver group): the same pattern as the
 * Status pill, with search. `items` are `{ id, name, photo?, secondary?, keywords? }` (`secondary` is a muted second
 * text after the name, e.g. «ID 34» for a group, and is searchable; `keywords` replaces it as what is searched); `selected` the ids the filter holds;
 * `onToggle(id)` the controller's own handler, `onClear()` empties the filter. `avatars` adds the photo
 * (or initials) before each name; `avatars='business'` draws the logo as a rounded square of 20px (C12, C18).
 * The texts are props, translated by the caller: `searchLabel` («Search», also the placeholder; the field is named
 * «Search» + the pill's label), `clearSearchLabel`, `clearLabel` (the foot, once something is picked),
 * `loadingLabel` (shown while an empty list loads, with its dots if it has them) and `noResultsLabel`. Each one that
 * the case being drawn needs throws when it is missing.
 *
 * redesign stores 3.A: two opt-in props make it a draft list. `onApply(ids)` turns on the draft: a tick
 * toggles the id in a draft that starts from `selected` on each open and does NOT call `onToggle`; a primary «Apply» button
 * under the list (`applyLabel`, translated by the caller; it throws when missing, like the other texts) calls `onApply`
 * once with the drafted ids and closes the popover with the focus back on the pill. If the draft holds the same ids as
 * `selected` (order aside) it only closes. Escape and a press outside close it and drop the draft, calling nothing.
 * «Clear» (drawn when `selected` is not empty) still calls `onClear()` at once and also empties the draft. Without
 * `onApply` the behaviour and the markup are the ones above, unchanged.
 */
export const ChecklistPopover = ({
  icon,
  label,
  value,
  priority,
  items,
  selected,
  onToggle,
  onClear,
  onApply,
  loading,
  avatars,
  searchLabel,
  clearSearchLabel,
  loadingLabel,
  noResultsLabel,
  clearLabel,
  applyLabel
}) => {
  const body = close => (
    <ChecklistBody
      label={label}
      items={items}
      selected={selected}
      onToggle={onToggle}
      onClear={onClear}
      onApply={onApply}
      close={close}
      loading={loading}
      avatars={avatars}
      searchLabel={searchLabel}
      clearSearchLabel={clearSearchLabel}
      loadingLabel={loadingLabel}
      noResultsLabel={noResultsLabel}
      clearLabel={clearLabel}
      applyLabel={applyLabel}
    />
  )
  return (
    <FilterPopover
      icon={icon}
      label={label}
      value={value}
      priority={priority}
      popupClassName='odc-orders-checklist-popup odc-orders-picker-popup'
    >
      {/* only the draft mode needs `close`; the other keeps a node child, exactly as before */}
      {typeof onApply === 'function' ? ({ close }) => body(close) : body()}
    </FilterPopover>
  )
}
