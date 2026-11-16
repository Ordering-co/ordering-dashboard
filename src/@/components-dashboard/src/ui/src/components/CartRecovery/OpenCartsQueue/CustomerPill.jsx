import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, UsersList as UsersListController } from '../../../../../index'
import { Avatar, Button, Checkbox, FilterPopover, PopoverFoot, SearchField } from '../../Shared/Product'
import { UserRound } from '../../Shared/Icon'

// redesign OC-D (M-1): the Customer pill of the open carts bar. The old filter was a MultiSelect in a modal; this one is a
// pill that opens its own popover (a search field and a list of checkboxes) and filters the carts by `user_id`.
// The customers come from the server through the same UsersList controller main's `CartRecovery/CustomerSelector` used (customers
// only, searched by id and by name), so a project with thousands of customers is never loaded whole. The controller is
// only mounted while the popover is open (the popup unmounts on close), so the page makes no /users request until then.

// The wait before the text reaches the controller, so a name typed in a second sends one request, not one per letter
const SEARCH_DEBOUNCE_MS = 300
// One page of this many customers; with more matches the popover asks the user to narrow the search instead of paging
const PAGE_SIZE = 20

const customerName = (user) => [user?.name, user?.lastname].filter(Boolean).join(' ').trim() || String(user?.id)

/**
 * Body of the popover, rendered by the UsersList controller. `selected` are the ids the filter holds and `names` the
 * names learned so far (id → name), both owned by the filter bar; `onChange(ids, learned)` hands the new ids and the
 * names of the customers just picked.
 */
const CustomerPickerUI = (props) => {
  const { label, selected, names, onChange, usersList, paginationProps, getUsers, onSearch } = props
  const [, t] = useLanguage()
  const [query, setQuery] = useState('')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const typeSearch = (text) => {
    setQuery(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onSearch(text.trim() || null), SEARCH_DEBOUNCE_MS)
  }

  const found = (usersList?.users || []).map(user => ({ id: user.id, name: customerName(user), photo: user.photo }))
  // Without a search, a customer already picked that this page does not bring stays in the list, to be unchecked here
  const missing = query.trim()
    ? []
    : selected.filter(id => !found.some(item => item.id === id)).map(id => ({ id, name: names[id] ?? String(id) }))
  const items = [...missing, ...found]

  const toggle = (item) => {
    const picked = selected.includes(item.id)
    onChange(
      picked ? selected.filter(id => id !== item.id) : [...selected, item.id],
      picked ? {} : { [item.id]: item.name }
    )
  }

  const loading = Boolean(usersList?.loading)
  const failed = !loading && Boolean(usersList?.error)
  const empty = items.length === 0
  const searchLabel = t('SEARCH', 'Search')

  return (
    <div className='odc-orders-picker'>
      <SearchField
        className='odc-orders-picker-search'
        value={query}
        onChange={typeSearch}
        label={`${searchLabel} ${label}`}
        placeholder={searchLabel}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
      />
      <div className='odc-orders-checklist odc-orders-picker-list' role='group' aria-label={label}>
        {items.map(item => (
          <Checkbox key={item.id} checked={selected.includes(item.id)} onCheckedChange={() => toggle(item)}>
            <span className='odc-orders-picker-row'>
              <Avatar kind='person' name={item.name} src={item.photo} />
              <span className='odc-orders-picker-name'>{item.name}</span>
            </span>
          </Checkbox>
        ))}
      </div>
      {failed && (
        <p className='odc-orders-picker-empty' role='status'>
          {t('CUSTOMERS_LOAD_ERROR', "We couldn't load the customers.")}
          {' '}
          <Button variant='link' onClick={() => getUsers(1)}>{t('RETRY', 'Retry')}</Button>
        </p>
      )}
      {!failed && empty && (
        <p className='odc-orders-picker-empty' role='status'>
          {loading ? `${t('LOADING', 'Loading')}...` : t('NO_RESULTS_FOUND', 'No results found')}
        </p>
      )}
      {!failed && !empty && paginationProps?.totalPages > 1 && (
        <p className='odc-orders-picker-empty'>
          {t('CUSTOMERS_NARROW_SEARCH', 'More customers match. Type a name to narrow the list.')}
        </p>
      )}
      {selected.length > 0 && <PopoverFoot onClear={() => onChange([], {})} clearLabel={t('CLEAR', 'Clear')} />}
    </div>
  )
}

/**
 * `value` is the words the pill shows (the same as its chips); `selected` the customer ids of the filter; `names` the
 * id → name map the bar keeps, so the pill and the chips read names even when a later search no longer lists the customer;
 * `onChange(ids, learned)` is called once per check, with the names of the customers just picked.
 */
export const CustomerPill = ({ label, value, selected = [], names = {}, onChange, priority = 'secondary' }) => (
  <FilterPopover
    icon={UserRound}
    label={label}
    value={value}
    priority={priority}
    popupClassName='odc-orders-checklist-popup odc-orders-picker-popup'
  >
    <UsersListController
      UIComponent={CustomerPickerUI}
      defaultUserTypesSelected={[3]}
      propsToFetch={['name', 'lastname', 'photo']}
      isSearchByUserId
      isSearchByUserName
      paginationSettings={{ initialPage: 1, pageSize: PAGE_SIZE, controlType: 'pages' }}
      label={label}
      selected={selected}
      names={names}
      onChange={onChange}
    />
  </FilterPopover>
)
