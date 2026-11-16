import React, { useEffect, useRef, useState } from 'react'

import { Check, TriangleAlert } from '../Icon'
import { Button } from './Button'
import { InlineNotice, SearchField } from './FilterBar'
import { FilterPopover } from './FilterPopover'
import './list-popover.css'

// redesign stores 2.D: the pill of a single choice (the «Type» of /stores/list). It has no text of its own:
// «All», «Search», «Clear search», «Loading...», «No results found» and the error texts arrive as props, already
// translated, and a text that the case being drawn needs throws when it is missing ('' paints empty).

const ALL = 'all'
const OPTION = '[role="option"]'

// redesign stores 2.D: «café» finds «Café»: the text is folded with NFD and its combining marks are dropped
const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

// an id may come from the URL as a string («3») while the list holds the number
const sameId = (a, b) => String(a) === String(b)
const keyOf = item => (item ? `item:${item.id}` : ALL)
const findChosen = (items, value) => (value == null ? null : items.find(item => sameId(item.id, value)) ?? null)

/**
 * Body of the popover: the search field and a listbox whose first option is «All». It lives inside the popup, so the
 * search text starts empty each time the popover opens.
 */
const ListBody = ({
  label,
  items,
  value,
  onPick,
  loading,
  error,
  onRetry,
  allLabel,
  searchLabel,
  clearSearchLabel,
  noResultsLabel,
  loadingLabel,
  errorLabel,
  retryLabel
}) => {
  const [query, setQuery] = useState('')
  const [focusedKey, setFocusedKey] = useState(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)

  const needle = fold(query.trim())
  const matches = item => [item.name, ...(item.keywords ?? [])].some(text => fold(text).includes(needle))
  // an error draws no item rows: only «All», which stays pickable, and the notice
  const shown = error ? [] : (needle ? items.filter(matches) : items)
  const rows = [null, ...shown] // «All» is always the first row, also while searching

  // redesign stores 2.D: «All» is chosen only when there is no value; a value that is not in `items` yet
  // (the list is loading) chooses nothing, and the roving stop then falls back to «All»
  const chosen = findChosen(items, value)
  const selectedKey = value == null ? ALL : (chosen ? keyOf(chosen) : null)
  // roving tab stop: the option that last had the focus, else the chosen one, else «All»; only when it is still shown
  const rowKeys = rows.map(keyOf)
  const stopKey = [focusedKey, selectedKey].find(key => key != null && rowKeys.includes(key)) ?? ALL

  // one message at a time: error (its own notice), then loading, then «no results» (only when a search found nothing)
  const showLoading = !error && loading && items.length === 0
  const showNoResults = !error && !showLoading && needle !== '' && shown.length === 0
  if (error && errorLabel == null) throw new Error('ListPopover needs an errorLabel')
  if (error && retryLabel == null) throw new Error('ListPopover needs a retryLabel')
  if (showLoading && loadingLabel == null) throw new Error('ListPopover needs a loadingLabel')
  if (showNoResults && noResultsLabel == null) throw new Error('ListPopover needs a noResultsLabel')
  const message = showLoading ? loadingLabel : (showNoResults ? noResultsLabel : '')

  // redesign stores 2.D, review R-3: on open the chosen option is brought into view, two frames after the
  // mount: the positioner caps the popup at the room it measured (--available-height) only after the first frame, and a
  // scroll done before that left the chosen one below the fold on a low phone (390×560). jsdom has no scrollIntoView.
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

  // redesign stores 2.D: the arrows, Home and End move the FOCUS only; `aria-selected` follows a pick, never
  // the focus. Tab is not handled here: the popover's own Tab-out (usePopoverTabOut) leaves from the last stop. Home and
  // End act on options only, so inside the search field they keep moving the caret. A printable key on an option is
  // type-ahead: it goes to the search field (Space is not one: it picks).
  const handleKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const options = Array.from(listRef.current?.querySelectorAll(OPTION) ?? [])
    const index = options.indexOf(event.target.closest?.(OPTION))
    let target
    if (index >= 0) {
      if (event.key === 'ArrowDown') target = options[Math.min(index + 1, options.length - 1)]
      else if (event.key === 'ArrowUp') target = index === 0 ? searchRef.current : options[index - 1]
      else if (event.key === 'Home') target = options[0]
      else if (event.key === 'End') target = options[options.length - 1]
      else if (event.key.length === 1 && event.key !== ' ') {
        event.preventDefault()
        setQuery(current => current + event.key)
        searchRef.current?.focus()
        return
      }
    } else if (event.key === 'ArrowDown' && event.target === searchRef.current) {
      target = options[0]
    }
    if (!target) return
    event.preventDefault()
    target.focus()
  }

  return (
    <div className='odc-orders-picker' onKeyDown={handleKeyDown}>
      <SearchField
        className='odc-orders-picker-search'
        value={query}
        onChange={setQuery}
        inputRef={searchRef}
        label={`${searchLabel} ${label}`}
        placeholder={searchLabel}
        clearLabel={clearSearchLabel}
      />
      <div ref={listRef} className='odc-orders-picker-list odc-list-popover-list' role='listbox' aria-label={label}>
        {rows.map((item) => {
          const key = keyOf(item)
          const selected = key === selectedKey
          return (
            // Enter and Space press the native button, so a keyboard pick is the same single click as a mouse pick
            <button
              key={key}
              type='button'
              role='option'
              aria-selected={selected ? 'true' : 'false'}
              tabIndex={key === stopKey ? 0 : -1}
              className='odc-list-popover-option'
              onFocus={() => setFocusedKey(key)}
              onClick={() => onPick(item, selected)}
            >
              {/* the slot is on every row so the names start at the same place; only the chosen row draws the mark */}
              <span className='odc-list-popover-check' aria-hidden='true'>
                {selected && <Check className='odc-icon' />}
              </span>
              <span className='odc-orders-picker-name'>{item ? item.name : allLabel}</span>
            </button>
          )
        })}
      </div>
      {/* redesign stores 2.D, review R-5: one live region that is always there, so a reader announces what
          appears in it: «loading», «no results» or the error (also when it arrives with the popover open). The notice
          inside drops its own `status` role: a region mounted with its text is not announced, and two would read twice. */}
      <div className='odc-list-popover-status' role='status'>
        {error
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
    </div>
  )
}

/**
 * A filter pill (Product `FilterPill`) that opens a list of ONE choice with search: the «Type» of /stores/list. Sibling of
 * `ChecklistPopover` (pick-many), in its own file; the shell is `FilterPopover` unchanged (layer, Escape, outside press,
 * focus back to the pill and the Tab-out of `usePopoverTabOut`).
 *
 * `items` are `{ id, name, keywords? }` and do not hold «All»: the piece adds it as the first option, always shown, also
 * while searching. `keywords` is what else an item is found by: the consumer can pass the untranslated API name, so a
 * translated UI still finds a type by its English name. `value` is the chosen id (`null` or `undefined` is «All» and
 * leaves the pill inactive); the pill shows the name of the item whose id equals it (compared as strings, so the URL's
 * «3» matches the id 3). While `value` is not in `items` yet (the list loads) the pill is still active and shows
 * `valueLabel`, else the value itself, and no option is chosen. `onChange(id | null, item | null)` is called with a pick,
 * and the popover closes with the focus back on the pill; picking what is already chosen only closes it.
 *
 * The rows are native buttons with `role="option"` in a `role="listbox"` named by `label`. The chosen row shows a check
 * mark at its start (in a slot every row keeps) and a medium weight. The selection does not follow the focus: ArrowDown /
 * ArrowUp, Home and End move the focus, Enter, Space or a click pick; ArrowDown from the search field enters the list and
 * ArrowUp from the first option goes back to it; typing a character on an option goes on in the search field. One option
 * is in the Tab order (the one that last had the focus, else the chosen one, else «All»). The search matches `name` and
 * `keywords` without telling capitals or accents apart, and starts empty on each open; the chosen option is scrolled
 * into view on open.
 *
 * With `error` the list draws no items: «All» stays pickable and a warning notice with `errorLabel` and a «retry» button
 * (`retryLabel`, `onRetry()`) goes below it.
 *
 * The texts are props, translated by the caller: `label` (names the pill, the popup and the list), `allLabel`,
 * `searchLabel` (also the placeholder; the field is named «Search» + the pill's label), `clearSearchLabel`,
 * `noResultsLabel` (a search found nothing), `loadingLabel` (an empty list loads) and `errorLabel` / `retryLabel`.
 * `allLabel`, `searchLabel` and `clearSearchLabel` are always needed; the others only when their case is on screen. A
 * missing one (`== null`) throws; '' paints empty.
 */
export const ListPopover = ({
  icon,
  label,
  priority,
  items = [],
  value,
  valueLabel,
  onChange,
  loading,
  error,
  onRetry,
  allLabel,
  searchLabel,
  clearSearchLabel,
  noResultsLabel,
  loadingLabel,
  errorLabel,
  retryLabel,
  className,
  defaultOpen
}) => {
  if (allLabel == null) throw new Error('ListPopover needs an allLabel')
  if (searchLabel == null) throw new Error('ListPopover needs a searchLabel')
  if (clearSearchLabel == null) throw new Error('ListPopover needs a clearSearchLabel')

  const chosen = findChosen(items, value)
  // redesign stores 2.D: a value is always shown, even before its name is known (valueLabel, else the value)
  const pillValue = chosen ? chosen.name : (value == null ? null : (valueLabel ?? String(value)))

  return (
    <FilterPopover
      icon={icon}
      label={label}
      value={pillValue}
      priority={priority}
      className={className}
      defaultOpen={defaultOpen}
      popupClassName='odc-orders-picker-popup odc-list-popover'
    >
      {({ close }) => (
        <ListBody
          label={label}
          items={items}
          value={value}
          loading={loading}
          error={error}
          onRetry={onRetry}
          allLabel={allLabel}
          searchLabel={searchLabel}
          clearSearchLabel={clearSearchLabel}
          noResultsLabel={noResultsLabel}
          loadingLabel={loadingLabel}
          errorLabel={errorLabel}
          retryLabel={retryLabel}
          onPick={(item, alreadyChosen) => {
            if (!alreadyChosen) onChange?.(item ? item.id : null, item ?? null)
            close()
          }}
        />
      )}
    </FilterPopover>
  )
}
