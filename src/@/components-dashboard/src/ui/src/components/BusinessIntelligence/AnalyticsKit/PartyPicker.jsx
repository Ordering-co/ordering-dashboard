import React, { useEffect, useId, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { Avatar, Button, FilterPopover, Pagination, SearchField } from '../../Shared/Product'
import { Store, Truck } from '../../Shared/Icon'
import { figure, fillTemplate } from './reportPillParts'
import '../../Shared/Product/radio-group.css'
import './party-picker.css'

// redesign invoice FC1 (D7, auditor 13; R1): the picker of ONE business or ONE driver. A filter pill (`P/FilterPopover`, the one
// of the report pills: «Business» + the name chosen, 32 px, 44 px of area on a phone) that opens a popover with a search field
// and the options as radios of a single choice. Base UI is not imported here (only the registered owners under Shared/Product do):
// the popover, its layer, Escape and the Tab-out are the FilterPopover's. The business list searches on the server
// (`party.setSearch`, after a wait of 400 ms; the report pills' `useServerSearch` waits 500, so the wait is kept here) and pages
// (`party.goToPage`, `P/Pagination`); the driver list is the whole list of `main` and the search is here, without accents or
// capitals. It holds no selection: `party.selected` is the controller's, so the choice survives a change of page of the list
// (D8 of `main`). Choosing calls `party.select({ id, name })` and closes.
//
// redesign business-payments (D-picker): promoted from `InvoiceBuilder` to the kit so a second page can use it. The
// texts and the shape are optional props; without them the render is the one /intelligence/invoice had (same keys, same classes).

// The default size of a page of the list (what /intelligence/invoice has always used); `pageSize` overrides it
const PAGE_SIZE = 10
// The wait before the text typed reaches the server (the same 400 ms as the rest of the page)
const SEARCH_WAIT_MS = 400
// redesign reviews FA2 (D6, D7, auditor 1, 2, 5): the id of the «All» option (no item can have it)
const ALL_ID = Symbol('party-picker-all')

// «José» is found by «jose» and by «JOSE»
const plain = (text) => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

// ArrowDown from the search field enters the list (the radios do not get that from the popover)
const enterChoices = (event) => {
  if (event.key !== 'ArrowDown' || !event.target.matches?.('input[type="search"]')) return
  const first = event.currentTarget.querySelector('[role="radio"][tabindex="0"]') ?? event.currentTarget.querySelector('[role="radio"]')
  if (!first) return
  event.preventDefault()
  first.focus()
}

const PartyList = ({ party, label, errorText, secondary = false, avatars, pageSize = PAGE_SIZE, onPick, serverSearch = false, allOption, emptyAction, onEmptyAction }) => {
  const [, t] = useLanguage()
  const isBusiness = party.kind === 'business'
  // redesign reviews FA2 (D6): `serverSearch` makes any list search the way the business one does (on the server, after the wait)
  const remote = isBusiness || serverSearch
  const [query, setQuery] = useState(remote ? (party.search ?? '') : '')
  const [stop, setStop] = useState(null)
  const listRef = useRef(null)
  const timer = useRef(null)
  const baseId = useId()
  useEffect(() => () => clearTimeout(timer.current), [])

  const send = (text) => {
    clearTimeout(timer.current)
    party.setSearch?.(text.trim())
  }
  const type = (text) => {
    setQuery(text)
    if (!remote) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => send(text), SEARCH_WAIT_MS)
  }

  const needle = plain(query.trim())
  const items = Array.isArray(party.items) ? party.items : []
  const shown = !remote && needle ? items.filter(item => plain(item.name).includes(needle)) : items
  const loading = Boolean(party.loading)
  const selectedId = party.selected?.id
  // redesign reviews FA2 (D6): «All» is the first radio of the list; it is the checked one when nothing is chosen. It is not
  // filtered by the search and takes part in the keyboard like the others (they are all `[role="radio"]` in order)
  const withAll = Boolean(allOption)
  const ids = withAll ? [ALL_ID, ...shown.map(item => item.id)] : shown.map(item => item.id)
  const checkedId = withAll && party.selected == null
    ? ALL_ID
    : (shown.some(item => item.id === selectedId) ? selectedId : undefined)
  const tabId = ids.includes(stop) ? stop : (checkedId ?? ids[0])
  const retry = party.retry ?? (isBusiness && party.goToPage ? () => party.goToPage(party.page || 1) : undefined)
  const searchLabel = `${t('SEARCH', 'Search')} ${label}`

  const handleKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const radios = Array.from(listRef.current?.querySelectorAll('[role="radio"]') ?? [])
    const index = radios.indexOf(event.target.closest?.('[role="radio"]'))
    if (index < 0) return
    const target = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: radios.length - 1 }[event.key]
    if (target === undefined) return
    event.preventDefault()
    if (radios[target]) radios[target].focus()
    else if (event.key === 'ArrowUp') listRef.current.closest('.odc-orders-picker')?.querySelector('input[type="search"]')?.focus()
  }

  // a template with placeholders is filled here, the numbers as figure nodes (decision 11)
  const pageText = (current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))

  return (
    <div className='odc-orders-picker' onKeyDown={enterChoices}>
      <SearchField
        className='odc-orders-picker-search'
        value={query}
        onChange={type}
        onClear={() => { if (remote) send('') }}
        onKeyDown={(event) => { if (event.key === 'Enter' && remote) send(query) }}
        label={searchLabel}
        placeholder={t('SEARCH', 'Search')}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
      />
      {party.error
        ? (
          <div className='odc-iv-picker-error'>
            <p role='alert'>{errorText}</p>
            {retry && <Button variant='secondary' size='sm' onClick={retry}>{t('TRY_AGAIN', 'Try again')}</Button>}
          </div>
          )
        : shown.length > 0 || withAll
          ? (
            <div
              ref={listRef}
              role='radiogroup'
              aria-label={label}
              aria-busy={loading || undefined}
              className='odc-orders-checklist odc-orders-picker-list odc-iv-choices'
              onKeyDown={handleKeyDown}
            >
              {withAll && (
                <button
                  type='button'
                  role='radio'
                  aria-checked={checkedId === ALL_ID}
                  tabIndex={tabId === ALL_ID ? 0 : -1}
                  data-checked={checkedId === ALL_ID ? '' : undefined}
                  className='odc-radio odc-iv-choice'
                  onFocus={() => setStop(ALL_ID)}
                  onClick={() => onPick(null)}
                >
                  <span className='odc-radio-box' aria-hidden='true'>{checkedId === ALL_ID && <span className='odc-radio-dot' />}</span>
                  <span className='odc-radio-text'>
                    <span className='odc-radio-label'>{allOption.label}</span>
                  </span>
                </button>
              )}
              {shown.map(item => {
                const checked = item.id === checkedId
                // `secondary` paints the second line of the option (`item.secondary`, if it has one) and the radio is described by it;
                // the name stays the name (the same pairing as `P/RadioGroup`)
                const note = secondary && item.secondary != null && item.secondary !== '' ? item.secondary : null
                const nameId = note ? `${baseId}-${item.id}-name` : undefined
                const noteId = note ? `${baseId}-${item.id}-note` : undefined
                return (
                  <button
                    key={item.id}
                    type='button'
                    role='radio'
                    aria-checked={checked}
                    aria-labelledby={nameId}
                    aria-describedby={noteId}
                    tabIndex={item.id === tabId ? 0 : -1}
                    data-checked={checked ? '' : undefined}
                    className='odc-radio odc-iv-choice'
                    onFocus={() => setStop(item.id)}
                    onClick={() => onPick({ id: item.id, name: item.name })}
                  >
                    <span className='odc-radio-box' aria-hidden='true'>{checked && <span className='odc-radio-dot' />}</span>
                    {/* the same decorative avatar the checklists of `P/FilterPopover` draw (`avatars='business'`: a 20 px square) */}
                    {avatars && <Avatar kind={avatars === 'business' ? 'business' : 'person'} name={item.name} src={item.photo} />}
                    <span className='odc-radio-text'>
                      <span id={nameId} className='odc-radio-label'>{item.name}</span>
                      {note && <span id={noteId} className='odc-radio-description'>{note}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
            )
          : (
            <p className='odc-orders-picker-empty' role='status'>
              {loading ? t('LOADING', 'Loading') : t('NO_RESULTS_FOUND', 'No results found')}
            </p>
            )}
      {/* redesign reviews FA2 (D6): «All» keeps the group on screen, so the empty state goes under it */}
      {!party.error && withAll && shown.length === 0 && (
        <p className='odc-orders-picker-empty' role='status'>
          {loading ? t('LOADING', 'Loading') : t('NO_RESULTS_FOUND', 'No results found')}
        </p>
      )}
      {/* J2 (D-18, ): the opt-in action of an empty list (StorePicker's «Add new store») */}
      {emptyAction && !party.error && !loading && shown.length === 0 && (
        <div className='odc-iv-picker-empty-action'>
          <Button variant='secondary' size='sm' onClick={onEmptyAction}>{emptyAction.label}</Button>
        </div>
      )}
      {isBusiness && party.totalPages > 1 && (
        <Pagination
          className='odc-iv-picker-pager'
          page={party.page}
          pageSize={pageSize}
          // R4: main's selector jumped straight to a page. The page field needs a total; the party only
          // knows its pages, so the total is their upper bound. The range below says «Page X of Y» and never reads that number.
          total={party.totalPages * pageSize}
          itemCount={shown.length}
          busy={loading}
          onPageChange={party.goToPage}
          showPageInput
          pageLabel={t('PAGE', 'Page')}
          pageOfLabel={(totalPages, figureOf) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total: totalPages }, figureOf)}
          label={t('PAGINATION', 'Pagination')}
          previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
          nextLabel={t('NEXT_PAGE', 'Next page')}
          rangeLabel={() => fillTemplate(t('PAGE_STATUS', 'Page _page_ of _total_'), { page: party.page, total: party.totalPages }, figure)}
          pageStatusLabel={(current) => pageText(current, party.totalPages)}
        />
      )}
    </div>
  )
}

/**
 * `party` is the one of the controller (`kind: 'business' | 'driver'`, `items`, `loading`, `error`, `selected`, `select`; the
 * business one also `page`, `totalPages`, `search`, `setSearch`, `goToPage`; `retry` if the controller has one).
 *
 * Optional props (without them, the render is the one of /intelligence/invoice):
 * @param {string}  [label]        Name of the pill, the group, the list and the search. Default: «Business» / «Driver» by `party.kind`.
 * @param {string}  [placeholder]  What the pill says while nothing is chosen. Default: «Select a business» / «Select a driver».
 * @param {string}  [errorText]    The text of the error of the list. Default: «The list could not be loaded.»
 * @param {'field'|'pill'} [variant]  `'field'` (default): a group with a visible label over a pill of the whole width.
 *                                 `'pill'`: only the inline `FilterPopover` (the pill already says «Business · name»).
 * @param {boolean} [secondary]    Paint `item.secondary` as a muted second line of each option, described by `aria-describedby`.
 * @param {Function} [ListSource] A component. If it comes, the body of the popover is `<ListSource>{(list) => …}</ListSource>` and `list`
 *                                 (items, loading, error, page, totalPages, search, setSearch, goToPage, retry) is merged over `party`
 *                                 for the list, so the list is mounted (and asked for) only while the popover is open; the pill
 *                                 still takes `selected` and `select` from `party`. Without it, `party` carries everything.
 * @param {'business'} [avatars]   With `'business'`, each option draws `item.photo` as a decorative business `Avatar` before the name.
 * @param {number}  [pageSize]     The `pageSize` handed to `Pagination` (default 10).
 * redesign reviews FA2 (D6, D7, auditor 1, 2, 5): three more opt-in props; without them the render and the behaviour are the same.
 * @param {boolean} [serverSearch] The search of a list of ANY `kind` (also `'driver'`) works as the business one: the text goes to
 *                                 `party.setSearch(text)` after the wait (Enter sends it at once, clearing sends `''`), the list is
 *                                 not filtered here and the field starts from `party.search`. The pager is still only the business one.
 * @param {{ label: string }} [allOption] A first radio, `label` («All drivers»), for «no choice»: checked when `party.selected == null`,
 *                                 choosing it calls `party.select(null)` and closes. It is not filtered by the search and takes
 *                                 part in the keyboard (arrows, Home, End, roving tab stop) as the first option.
 * @param {boolean} [defaultOpen]  Handed to `FilterPopover`: the pill is open when it mounts.
 * J2 (D-18, ), opt-in; without it nothing changes:
 * @param {{ label: string, onSelect: Function }} [emptyAction] A button under «No results found» (only when the list came back empty,
 *                                 not while it loads or fails). Choosing it closes the popover and calls `onSelect()`.
 * A `null`/`undefined` text takes its default; `''` paints empty.
 */
export const PartyPicker = ({ party, label: labelProp, placeholder: placeholderProp, errorText: errorTextProp, variant = 'field', secondary = false, ListSource, avatars, pageSize, serverSearch = false, allOption, defaultOpen = false, emptyAction }) => {
  const [, t] = useLanguage()
  const isBusiness = party.kind === 'business'
  const label = labelProp != null ? labelProp : (isBusiness ? t('BUSINESS', 'Business') : t('DRIVER', 'Driver'))
  const placeholder = placeholderProp != null
    ? placeholderProp
    : (isBusiness ? t('INVOICE_MANAGER_SELECT_BUSINESS', 'Select a business') : t('INVOICE_MANAGER_SELECT_DRIVER', 'Select a driver'))
  const errorText = errorTextProp != null ? errorTextProp : t('INVOICE_MANAGER_PARTY_ERROR', 'The list could not be loaded.')

  // The pill says what it is for («Business») and what is chosen (or «Select a business»); its name is both. The list is mounted
  // only while the popover is open, so the search text starts from the controller's each time it opens. Choosing closes it and
  // the focus goes back to the pill (`close` of the FilterPopover).
  // redesign invoice R2 (P6): in the `field` variant it is the main datum of the page, not an optional filter, so it is a field like
  // the period: the label is visible over it (`id` + `aria-labelledby` on the group, as the period's `Field` does) and the pill takes
  // the whole width of the column. (`.odc-iv-pill` is the class of the payment method and order type pills of the invoice form, which
  // stay inline; this one is `.odc-iv-party`.)
  const labelId = useId()
  const popover = (anchorClass) => (
    <FilterPopover
      className={anchorClass}
      icon={isBusiness ? Store : Truck}
      label={label}
      value={party.selected?.name ?? placeholder}
      popupClassName='odc-orders-checklist-popup odc-orders-picker-popup'
      defaultOpen={defaultOpen}
    >
      {({ close }) => {
        const onPick = (choice) => {
          party.select?.(choice)
          close()
        }
        const list = (source) => (
          <PartyList
            party={source}
            label={label}
            errorText={errorText}
            secondary={secondary}
            avatars={avatars}
            pageSize={pageSize}
            onPick={onPick}
            serverSearch={serverSearch}
            allOption={allOption}
            emptyAction={emptyAction}
            onEmptyAction={() => {
              close()
              emptyAction?.onSelect?.()
            }}
          />
        )
        // `ListSource` mounts with the popover (the popup unmounts on close), so what it fetches goes out on each opening
        return ListSource ? <ListSource>{(source) => list({ ...party, ...source })}</ListSource> : list(party)
      }}
    </FilterPopover>
  )

  // `pill`: no group and no visible label (the pill already says «Business · name») and no full width: it sits in a bar with others
  if (variant === 'pill') return popover(undefined)

  return (
    <div className='odc-iv-party' role='group' aria-labelledby={labelId}>
      <span id={labelId} className='odc-iv-party-label'>{label}</span>
      {popover('odc-iv-party-anchor')}
    </div>
  )
}
