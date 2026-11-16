import React, { useEffect, useId, useRef, useState } from 'react'
import { Field as FieldPrimitive } from '@base-ui/react/field'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { Check, ChevronDown, TriangleAlert } from '../Icon'
import { Button } from './Button'
import { useOverlayLayer } from './Dialog'
import { Field, useFieldFrame } from './Field'
import { InlineNotice, SearchField } from './FilterBar'
import { usePopoverTabOut } from './FilterPopover'
import { cx } from './classNames'
import { tokenOffset, tokenPx } from './positioning'
import { useProductDir } from './useProductDir'
import './filter-popover.css'
import './list-popover.css'
import './select.css'

// redesign (K-1 of stores 5.12, R-4 of devices): the form select of Product. A field-like trigger (the DatePicker's
// composition: a native <button role=combobox> framed by Field) opens a non-modal popover in the overlay host with a listbox of
// native buttons, with the row look and the keyboard of ListPopover (without its «All» row: a form value is chosen, not cleared).
// It has no text of its own: every word arrives as a prop, already translated, and a text the case on screen needs throws when it
// is missing ('' paints empty).

const OPTION = '[role="option"]'
const sideOffset = tokenOffset('--od-space-1')
const collisionAvoidance = { side: 'flip', align: 'shift' }

// «café» finds «Café»: NFD, combining marks dropped, case folded (as ListPopover)
const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
// a value may come as a string («3») while the option holds the number: compared as text, the option's own value is returned
const sameValue = (a, b) => a != null && b != null && String(a) === String(b)
const keyOf = option => `option:${String(option.value)}`
const findOption = (options, value) => (value == null ? null : options.find(option => sameValue(option.value, value)) ?? null)
const textOf = option => (typeof option.label === 'string' || typeof option.label === 'number' ? String(option.label) : '')

/** The search field, the listbox and the status line, mounted while the popover is open (the search starts empty on each open). */
const SelectBody = ({
  label,
  listId,
  options,
  value,
  onPick,
  searchable,
  remoteSearch,
  searchValue,
  onSearchChange,
  searchDelay,
  loading,
  loadError,
  onRetry,
  footer,
  close,
  searchLabel,
  clearSearchLabel,
  noResultsLabel,
  loadingLabel,
  errorLabel,
  retryLabel
}) => {
  // a remote search opens with the text the owner holds (`searchValue`), so a list fetched for «ab» still says «ab» on reopen
  const [query, setOwnQuery] = useState(() => (remoteSearch ? String(searchValue ?? '') : ''))
  const [focusedKey, setFocusedKey] = useState(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const typeahead = useRef({ text: '', at: 0 })
  const searchTimer = useRef(null)
  useEffect(() => () => window.clearTimeout(searchTimer.current), [])

  // The field shows every key at once. A remote search reaches the owner after `searchDelay` ms without typing (the legacy search
  // bar waited 750 ms, so a fetch per key never went out); emptying it reaches the owner at once.
  const setQuery = (next) => {
    setOwnQuery(next)
    if (!remoteSearch) return
    window.clearTimeout(searchTimer.current)
    if (!searchDelay || next === '') onSearchChange(next)
    else searchTimer.current = window.setTimeout(() => onSearchChange(next), searchDelay)
  }
  const needle = fold(String(query).trim())
  const matches = option => [textOf(option), ...(option.keywords ?? [])].some(text => fold(text).includes(needle))
  const shown = loadError ? [] : (searchable && !remoteSearch && needle ? options.filter(matches) : options)

  const chosen = findOption(options, value)
  const selectedKey = chosen ? keyOf(chosen) : null
  const enabledKeys = shown.filter(option => !option.disabled).map(keyOf)
  // roving tab stop: the option that last had the focus, else the chosen one, else the first enabled one
  const stopKey = [focusedKey, selectedKey].find(key => key != null && enabledKeys.includes(key)) ?? enabledKeys[0] ?? null

  // one message at a time: the error (its own notice), then «loading», then «no results». A search that finds nothing needs its text;
  // a list that is empty without a search shows `noResultsLabel` when there is one, else nothing.
  const showLoading = !loadError && loading && shown.length === 0
  const searched = searchable && needle !== ''
  const showNoResults = !loadError && !showLoading && shown.length === 0 && (searched || noResultsLabel != null)
  if (loadError && errorLabel == null) throw new Error('Select needs an errorLabel')
  if (loadError && retryLabel == null) throw new Error('Select needs a retryLabel')
  if (showLoading && loadingLabel == null) throw new Error('Select needs a loadingLabel')
  if (showNoResults && noResultsLabel == null) throw new Error('Select needs a noResultsLabel')
  const message = showLoading ? loadingLabel : (showNoResults ? noResultsLabel : '')

  // the chosen option is brought into view two frames after the mount, once the positioner capped the popup (ListPopover R-3)
  useEffect(() => {
    let second
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => {
        listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
      })
    })
    return () => {
      window.cancelAnimationFrame(first)
      window.cancelAnimationFrame(second)
    }
  }, [])

  // The arrows, Home and End move the FOCUS; a pick (Enter, Space, click) chooses. ArrowDown from the search enters the list and
  // ArrowUp from the first option goes back to it. A printable key on an option goes on in the search field; without a search it
  // jumps to the next option whose text starts with what was typed in the last half second (type-ahead).
  const handleKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const rows = Array.from(listRef.current?.querySelectorAll(`${OPTION}:not(:disabled)`) ?? [])
    const index = rows.indexOf(event.target.closest?.(OPTION))
    let target
    if (index >= 0) {
      if (event.key === 'ArrowDown') target = rows[Math.min(index + 1, rows.length - 1)]
      else if (event.key === 'ArrowUp') target = index === 0 ? (searchRef.current ?? rows[0]) : rows[index - 1]
      else if (event.key === 'Home') target = rows[0]
      else if (event.key === 'End') target = rows[rows.length - 1]
      else if (event.key.length === 1 && event.key !== ' ') {
        event.preventDefault()
        if (searchRef.current) {
          setQuery(`${query}${event.key}`)
          searchRef.current.focus()
          return
        }
        const now = Date.now()
        const typed = now - typeahead.current.at < 500 ? `${typeahead.current.text}${event.key}` : event.key
        typeahead.current = { text: typed, at: now }
        const needleTyped = fold(typed)
        const ordered = [...rows.slice(index + (typed.length === 1 ? 1 : 0)), ...rows.slice(0, index + (typed.length === 1 ? 1 : 0))]
        target = ordered.find(row => fold(row.textContent).trim().startsWith(needleTyped))
      }
    } else if (event.key === 'ArrowDown' && event.target === searchRef.current) {
      target = rows[0]
    }
    if (!target) return
    event.preventDefault()
    target.focus()
  }

  return (
    // The body is a Field root of its own: Base UI's field context crosses the portal, and without this scope the search input
    // registered as the control of the SelectField around the trigger (its label named the search and pointed at it).
    <FieldPrimitive.Root className='odc-orders-picker odc-select-body' onKeyDown={handleKeyDown}>
      {searchable && (
        <SearchField
          className='odc-orders-picker-search'
          value={query}
          onChange={setQuery}
          inputRef={searchRef}
          label={`${searchLabel} ${label}`}
          placeholder={searchLabel}
          clearLabel={clearSearchLabel}
        />
      )}
      <div
        ref={listRef}
        id={listId}
        className='odc-orders-picker-list odc-list-popover-list'
        role='listbox'
        aria-label={label}
        aria-busy={loading ? 'true' : undefined}
      >
        {shown.map((option) => {
          const key = keyOf(option)
          const selected = key === selectedKey
          return (
            // Enter and Space press the native button, so a keyboard pick is the same single click as a mouse pick
            <button
              key={key}
              type='button'
              role='option'
              aria-selected={selected ? 'true' : 'false'}
              tabIndex={key === stopKey ? 0 : -1}
              disabled={option.disabled}
              className='odc-list-popover-option odc-select-option'
              onFocus={() => setFocusedKey(key)}
              onClick={() => onPick(option, selected)}
            >
              <span className='odc-list-popover-check' aria-hidden='true'>
                {selected && <Check className='odc-icon' />}
              </span>
              <span className='odc-orders-picker-name'>{option.label}</span>
            </button>
          )
        })}
      </div>
      {/* one live region that is always there, so «loading», «no results» or the error is announced when it appears */}
      <div className='odc-list-popover-status' role='status'>
        {loadError
          ? (
            <InlineNotice
              role={undefined}
              tone='warning'
              icon={TriangleAlert}
              action={<Button variant='ghost' size='sm' onClick={onRetry}>{retryLabel}</Button>}
            >
              {errorLabel}
            </InlineNotice>
            )
          : (message ? <p className='odc-orders-picker-empty'>{message}</p> : null)}
      </div>
      {footer != null && (
        <div className='odc-select-footer'>
          {typeof footer === 'function' ? footer({ close }) : footer}
        </div>
      )}
    </FieldPrimitive.Root>
  )
}

/**
 * The single-choice select of a form. The trigger is a 32px field-like native `<button role="combobox">` (44px hit area on a
 * phone) that shows the label of the chosen option, else `placeholder`; it is named by the field's visible label and its own text.
 * It opens a non-modal popover in the overlay host (Escape closes only it, a press outside closes it and reaches what is under it,
 * Tab from its last stop closes it and goes on to the next control) with a `listbox` of native `<button role="option">`.
 *
 * Keyboard: Enter, Space, ArrowDown or ArrowUp on the trigger opens it with the focus on the search field (when there is one), else
 * on the chosen option, else on the first. In the list ArrowDown / ArrowUp, Home and End move the focus, Enter, Space or a click
 * pick and close it with the focus back on the trigger; typing goes to the search field, or jumps by the first letters without one.
 * The selection does not follow the focus. The list is vertical, so the arrows are the same in RTL; the popover takes the page's
 * direction.
 *
 * `options` are `{ value, label, disabled?, keywords? }`; `label` is what is shown, in the row and in the trigger: a string (the
 * search and type-ahead find it), or a node (a logo and a name) with the name in `keywords`, which is also what else finds it.
 * `value` is compared with the options' values as text (`'3'` chooses `3`) and `onValueChange(option.value, option)` hands back the
 * option's own value, so the owner sends the type it always sent; picking the chosen option only closes. `valueLabel` is shown while
 * `value` is not in `options` yet (a remote list loads); without it such a value shows the placeholder, never the raw value.
 *
 * Search (opt-in, `searchable`): local by default (by `label` and `keywords`, no capitals or accents told apart). With
 * `onSearchChange(text)` the search is remote: the piece does not filter and the owner fetches; `searchValue` is the owner's text,
 * shown when the list opens, and `searchDelay` (ms, 0 by default) waits that long without typing before the owner is told (an
 * emptied search is told at once).
 * `loading` with an empty list shows `loadingLabel`; a search that finds nothing, or an empty list, shows `noResultsLabel`; `loadError`
 * (the list could not be fetched) draws no rows and a warning with `errorLabel` and a `retryLabel` button (`onRetry()`). `footer` is a node, or `({ close }) => node`,
 * under the list (a remote list's pager).
 *
 * Texts: `label` (always: names the trigger when there is no Field around it, the list and the search), `placeholder`; with
 * `searchable`, `searchLabel` and `clearSearchLabel`; `noResultsLabel`, `loadingLabel`, `errorLabel`, `retryLabel` when their case
 * is on screen. Inside a `Field` (see `SelectField`) the field's visible label names the trigger and the hint and error describe it.
 * State is on the trigger: `aria-expanded`, `aria-invalid`, `data-empty`, `data-invalid`, `data-disabled`, `data-open`.
 */
export const Select = ({
  label,
  options = [],
  value,
  valueLabel,
  onValueChange,
  placeholder,
  disabled = false,
  invalid = false,
  searchable = false,
  searchValue,
  onSearchChange,
  searchDelay = 0,
  loading = false,
  loadError = false,
  onRetry,
  footer,
  searchLabel,
  clearSearchLabel,
  noResultsLabel,
  loadingLabel,
  errorLabel,
  retryLabel,
  className,
  ...props
}) => {
  if (label == null) throw new Error('Select needs a label')
  if (searchable && searchLabel == null) throw new Error('Select needs a searchLabel')
  if (searchable && clearSearchLabel == null) throw new Error('Select needs a clearSearchLabel')

  const dir = useProductDir()
  const frame = useFieldFrame()
  const triggerRef = useRef(null)
  const ownLabelId = useId()
  const textId = useId()
  const listId = useId()
  const labelId = frame?.labelId ?? ownLabelId
  const isInvalid = invalid || frame?.invalid === true
  const [open, setOpen] = useState(false)
  const { layer, popupRef, lastFocusedRef, portalStyle, onOpenChangeComplete } = useOverlayLayer(open, { modal: false })
  const close = () => setOpen(false)
  const tabOut = usePopoverTabOut({ getOpener: () => triggerRef.current, close, layer })

  // A value that is not among the options yet (a remote list loads) shows `valueLabel`; without one it shows the placeholder, as the
  // legacy select did: never the raw value («all», an id).
  const chosen = findOption(options, value)
  const known = chosen != null || (value != null && valueLabel != null)
  const text = chosen ? chosen.label : (known ? valueLabel : (placeholder ?? ''))

  const handleOpenChange = (next, details) => {
    if (next) return
    const reason = details?.reason
    if (reason === 'outside-press' && triggerRef.current?.contains(details.event?.target)) {
      details.cancel()
      return
    }
    if (reason === 'escape-key' && !layer.isActive) {
      details.cancel()
      return
    }
    close()
  }

  const toggle = () => {
    tabOut.reset()
    setOpen(current => !current)
  }

  // Escape closes the list when this layer is the top one, also while the focus has not reached the popup yet: in a legacy Modal
  // an Escape pressed right after the list painted was lost (the transition fixture of the brand-system harness, light).
  const closeOnEscape = (event) => {
    if (event.key !== 'Escape' || !open || !layer.isActive) return false
    tabOut.reset()
    close()
    return true
  }

  // ArrowDown and ArrowUp open a closed select (R-4: the arrow reaches the list); Enter and Space are the button's own click
  const handleTriggerKeyDown = (event) => {
    if (closeOnEscape(event)) return
    if (open || disabled || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    tabOut.reset()
    setOpen(true)
  }

  // the search field, else the chosen option, else the first one that can take the focus
  const initialFocus = () => {
    const popup = popupRef.current
    return popup?.querySelector('input[type="search"]') ||
      popup?.querySelector(`${OPTION}[tabindex="0"]`) ||
      true
  }

  const handlePick = (option, alreadyChosen) => {
    if (!alreadyChosen) onValueChange?.(option.value, option)
    tabOut.reset()
    close()
  }

  return (
    <>
      <button
        {...props}
        ref={triggerRef}
        type='button'
        role='combobox'
        className={cx('odc-select-trigger', className)}
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={isInvalid ? 'true' : undefined}
        aria-labelledby={`${labelId} ${textId}`}
        disabled={disabled}
        data-empty={known ? undefined : ''}
        data-invalid={isInvalid ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-open={open ? '' : undefined}
        onClick={toggle}
        onKeyDown={handleTriggerKeyDown}
      >
        {!frame?.labelId && <span id={ownLabelId} className='odc-sr-only'>{label}</span>}
        <span id={textId} className='odc-select-text'>{text}</span>
        <ChevronDown className='odc-icon odc-select-chevron' aria-hidden='true' />
      </button>
      {layer.ready && (
        <PopoverPrimitive.Root open={open} modal={false} onOpenChange={handleOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
          <PopoverPrimitive.Portal container={layer.host} className='odc-root odc-overlay-portal' style={portalStyle} dir={dir}>
            <PopoverPrimitive.Positioner
              anchor={triggerRef}
              side='bottom'
              align='start'
              sideOffset={sideOffset}
              collisionAvoidance={collisionAvoidance}
              collisionPadding={tokenPx('--od-x-viewport-gap')}
              className='odc-orders-popover-positioner'
            >
              <PopoverPrimitive.Popup
                ref={popupRef}
                aria-label={label}
                dir={dir}
                className='odc-orders-popover odc-orders-picker-popup odc-list-popover odc-select-popup'
                initialFocus={initialFocus}
                finalFocus={tabOut.finalFocus}
                onKeyDown={event => { if (!closeOnEscape(event)) tabOut.onKeyDown(event) }}
                onFocusCapture={event => { lastFocusedRef.current = event.target }}
              >
                <SelectBody
                  label={label}
                  listId={listId}
                  options={options}
                  value={value}
                  onPick={handlePick}
                  searchable={searchable}
                  remoteSearch={typeof onSearchChange === 'function'}
                  searchValue={searchValue}
                  onSearchChange={onSearchChange}
                  searchDelay={searchDelay}
                  loading={loading}
                  loadError={loadError}
                  onRetry={onRetry}
                  footer={footer}
                  close={close}
                  searchLabel={searchLabel}
                  clearSearchLabel={clearSearchLabel}
                  noResultsLabel={noResultsLabel}
                  loadingLabel={loadingLabel}
                  errorLabel={errorLabel}
                  retryLabel={retryLabel}
                />
              </PopoverPrimitive.Popup>
            </PopoverPrimitive.Positioner>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      )}
    </>
  )
}

/**
 * `Select` inside a Product `Field`: the visible label (which names the trigger), `hint`, `error` (a string: the trigger is invalid
 * and the message is a `role="alert"`), `required` + `requiredLabel` and `disabled`, like `TextField`. `fieldClassName` goes on the
 * field, `className` and every other prop on the `Select`.
 */
export const SelectField = ({
  label,
  hint,
  error,
  required = false,
  requiredLabel,
  disabled = false,
  fieldClassName,
  ...props
}) => (
  <Field
    label={label}
    hint={hint}
    error={error}
    required={required}
    requiredLabel={requiredLabel}
    disabled={disabled}
    className={fieldClassName}
  >
    <Select label={label} disabled={disabled} {...props} />
  </Field>
)
