import React, { useEffect, useId, useRef, useState } from 'react'

import { CircleAlert } from '../Icon'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { EmptyState, Skeleton } from './Feedback'
import { SearchField } from './FilterBar'
import { Pagination } from './Pagination'
import { cx } from './classNames'
import './product.css'
import './selectable-list.css'

// The wait before the search text reaches the owner; Enter and the clear button send at once
const SEARCH_DEBOUNCE_MS = 500
const SKELETON_ROWS = 5

const need = (value, name) => {
  // redesign W0-2 r2 (W0-Q1-01): missing, not empty
  if (value == null) throw new Error(`SelectableList needs ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`)
}

/**
 * SelectableList (promoted from the catalog block of Users/StaffDirectory/StaffStoresSection). A list of
 * records to tick: an optional search, «Select all» and «Select none», one `Checkbox` row per item (the whole row
 * toggles; with `avatars` = `business` or `person`, an `Avatar` with the photo or the initials), skeleton rows while
 * `loading`, an empty state, an error with Retry, and an optional `Pagination` under it.
 *
 * It owns no data: `items` are `[{ id, name, photo, note }]` (`note`: a translated line next to the row, tied to its checkbox, for a
 * change not saved yet; with `selectedIds` not holding the row it strikes the name out), `selectedIds` what is ticked (it may hold ids on other pages),
 * `onToggle(id, next)` reports a row. `onSearch(text)` gets the typed text after a wait (at once on Enter or clear).
 * `onSelectAll()` and `onSelectNone()` are what the owner decides they mean. `locked` freezes the rows and both bulk
 * buttons (a save in flight) but not the search; `lockedIds` freezes only those rows. `pagination` is the props of `P/Pagination`; it is busy while loading
 * and hidden on an error.
 *
 * No text of its own: `label` names the list, `loadingLabel` the busy status, `emptyTitle` the empty state; with their
 * feature, `searchLabel` and `clearSearchLabel`, `selectAllLabel`, `selectNoneLabel`, and on an error `errorTitle` and
 * `retryLabel`.
 */
export const SelectableList = ({
  label,
  items,
  selectedIds,
  onToggle,
  avatars,
  locked = false,
  lockedIds = [],
  loading = false,
  loadingLabel,
  skeletonRows = SKELETON_ROWS,
  emptyTitle,
  error = false,
  errorTitle,
  retryLabel,
  onRetry,
  onSearch,
  searchLabel,
  clearSearchLabel,
  onSelectAll,
  selectAllLabel,
  onSelectNone,
  selectNoneLabel,
  pagination,
  className
}) => {
  need(label, 'label')
  need(loadingLabel, 'loadingLabel')
  need(emptyTitle, 'emptyTitle')
  if (onSearch) {
    need(searchLabel, 'searchLabel')
    need(clearSearchLabel, 'clearSearchLabel')
  }
  if (onSelectAll) need(selectAllLabel, 'selectAllLabel')
  if (onSelectNone) need(selectNoneLabel, 'selectNoneLabel')
  if (error) {
    need(errorTitle, 'errorTitle')
    if (onRetry) need(retryLabel, 'retryLabel')
  }

  const noteId = useId()
  const list = items || []
  const selected = selectedIds || []

  const [searchText, setSearchText] = useState('')
  const searchTimer = useRef(null)
  const sentSearch = useRef('')
  const latestOnSearch = useRef(onSearch)
  latestOnSearch.current = onSearch
  useEffect(() => () => clearTimeout(searchTimer.current), [])
  const sendSearch = (text) => {
    clearTimeout(searchTimer.current)
    if (text === sentSearch.current) return
    sentSearch.current = text
    latestOnSearch.current?.(text)
  }
  const typeSearch = (text) => {
    setSearchText(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => sendSearch(text), SEARCH_DEBOUNCE_MS)
  }

  let body
  if (loading) {
    body = (
      <div className='odc-selectable-skeleton' role='status' aria-busy='true'>
        <span className='odc-sr-only'>{loadingLabel}</span>
        {Array.from({ length: skeletonRows }, (_, row) => (
          <div key={row} className='odc-selectable-skeleton-row'>
            <Skeleton shape='box' size='var(--od-x-checkbox-box)' block='var(--od-x-checkbox-box)' />
            {avatars && <Skeleton shape={avatars === 'business' ? 'box' : 'round'} size='var(--od-x-avatar)' block='var(--od-x-avatar)' />}
            <Skeleton size='40%' />
          </div>
        ))}
      </div>
    )
  } else if (error) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={errorTitle}
        action={onRetry && <Button onClick={() => onRetry()}>{retryLabel}</Button>}
      />
    )
  } else if (list.length === 0) {
    body = <EmptyState title={emptyTitle} />
  } else {
    body = (
      <ul className='odc-selectable-list' aria-label={label}>
        {list.map((item) => (
          <li key={item.id} className='odc-selectable-row' data-removed={item.note && !selected.includes(item.id) ? 'true' : undefined}>
            <Checkbox
              checked={selected.includes(item.id)}
              disabled={locked || lockedIds.includes(item.id)}
              onCheckedChange={(next) => onToggle?.(item.id, next)}
              aria-describedby={item.note ? `${noteId}-${item.id}` : undefined}
            >
              {avatars && <Avatar kind={avatars} name={item.name} src={item.photo} />}
              <bdi className='odc-selectable-name'>{item.name}</bdi>
            </Checkbox>
            {item.note && <span id={`${noteId}-${item.id}`} className='odc-selectable-note'>{item.note}</span>}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className={cx('odc-root', 'odc-selectable', className)} data-loading={loading ? 'true' : undefined} data-locked={locked ? 'true' : undefined}>
      {onSearch && (
        <SearchField
          className='odc-selectable-search'
          value={searchText}
          onChange={typeSearch}
          onClear={() => sendSearch('')}
          onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
          label={searchLabel}
          placeholder={searchLabel}
          clearLabel={clearSearchLabel}
        />
      )}
      {(onSelectAll || onSelectNone) && (
        <div className='odc-selectable-tools'>
          {onSelectAll && (
            <Button size='sm' disabled={locked || loading || error || list.length === 0} onClick={() => onSelectAll()}>
              {selectAllLabel}
            </Button>
          )}
          {onSelectNone && (
            <Button variant='ghost' size='sm' disabled={locked || selected.length === 0} onClick={() => onSelectNone()}>
              {selectNoneLabel}
            </Button>
          )}
        </div>
      )}
      {body}
      {pagination && !error && pagination.total != null && <Pagination busy={loading} {...pagination} />}
    </div>
  )
}
