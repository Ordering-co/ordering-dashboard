import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import {
  useLanguage,
  useUtils,
  useSession,
  useConfig,
  useEvent,
  DashboardBusinessList as BusinessListController
} from '../../../../../index'
import { Avatar, Button, SearchField, Skeleton } from '../../Shared/Product'
import { canRegisterStores } from '../../../../../utils/storeAdd'
import './business-select-header.css'

// redesign the selector is built on Product pieces (SearchField, Skeleton, Avatar, Button) with the public API it had:
// the same props in (close, isOpen, changeBusinessState, handleOpenAddBusiness, defaultPageSize, ...) and the same choice out.
// the list is a search and a scrolling region that loads the next page near its end (no pager).
const SEARCH_DEBOUNCE_MS = 750 // the wait of `SearchBar lazyLoad` it had: each change of the search is a request
const DEFAULT_PAGE_SIZE = 20 // fills the scroll region (about 7.5 rows) and leaves room to scroll
const LOAD_MORE_SKELETONS = 3 // rows under the ones already there while the next page loads
const FIRST_LOAD_SKELETONS_MAX = 8 // what the region shows of a first load or a search
const LOAD_MORE_THRESHOLD = 48 // scroll distance to the end (about one row, in CSS pixels) that asks for the next page

const SkeletonRows = ({ count }) => [...Array(count).keys()].map(i => (
  <div key={i} className='odc-bsh-skeleton-row' data-slot='business-option-skeleton'>
    <Skeleton shape='box' size='var(--od-x-control-height-lg)' block='var(--od-x-control-height-lg)' />
    <div className='odc-bsh-skeleton-text'>
      <Skeleton size='60%' />
      <Skeleton size='35%' />
    </div>
  </div>
))

const BusinessessListingUI = (props) => {
  const {
    businessList,
    pagination,
    searchValue,
    onSearch,
    loadMoreBusinesses,
    isOpen,
    close,
    changeBusinessState
  } = props
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [{ configs }] = useConfig()
  // bugs E (D26, ): «Add new store» follows the one rule of the dashboard
  const allowBusinessRegister = canRegisterStores(user, configs)
  const [events] = useEvent()
  // the one link of the dashboard, /stores/add, for every consumer (Products had its own add modal)
  const openAddBusiness = () => {
    close && close()
    events.emit('go_to_page', { page: 'business_add' })
  }
  const [{ optimizeImage }] = useUtils()
  const dropdownReference = useRef()
  const openerReference = useRef(null)
  const popupId = useId()
  const searchInput = useRef(null)
  const searchTimer = useRef(null)
  const listReference = useRef(null)
  const [searchText, setSearchText] = useState(searchValue ? String(searchValue) : '')

  // The keyboard code and the callers find the search by `input[name="search"]` (SearchField does not forward a name to its input)
  const attachSearchInput = useCallback(node => {
    searchInput.current = node
    if (node) node.name = 'search'
  }, [])

  // Incremental loading. «Loading more» is tracked here, not inferred from the rows: a new search also loads with the old rows present.
  const businesses = businessList.businesses || []
  const total = pagination?.total ?? 0
  const hasMore = Number.isFinite(pagination?.to) ? pagination.to < total : (pagination?.currentPage ?? 0) < (pagination?.totalPages ?? 0)
  const [loadingMore, setLoadingMore] = useState(false)
  const requesting = useRef(false) // a request made in this tick, before the controller reports loading
  const autoLoadedAt = useRef(-1) // the row count at which the list already loaded by itself (a failed load must not loop)
  const requestMore = () => {
    if (!loadMoreBusinesses || !hasMore || businessList.loading || requesting.current) return
    requesting.current = true
    setLoadingMore(true)
    loadMoreBusinesses()
  }
  useEffect(() => {
    requesting.current = false
    if (!businessList.loading) setLoadingMore(false)
  }, [businessList.loading, businessList.businesses, pagination?.to])
  // A page that does not fill the region leaves no scroll to ask for the next one: load it, once per row count
  useEffect(() => {
    const list = listReference.current
    if (!list || businessList.loading || !hasMore || !loadMoreBusinesses) return
    if (list.clientHeight > 0 && list.scrollHeight <= list.clientHeight && autoLoadedAt.current !== businesses.length) {
      autoLoadedAt.current = businesses.length
      requestMore()
    }
  }, [businessList.loading, businessList.businesses, hasMore])
  const handleListScroll = (e) => {
    const list = e.currentTarget
    if (list.scrollHeight - list.scrollTop - list.clientHeight <= LOAD_MORE_THRESHOLD) requestMore()
  }

  // What the person types is shown at once and sent to the server after the pause SearchBar's `lazyLoad` had.
  const typeSearch = (value) => {
    setLoadingMore(false)
    autoLoadedAt.current = -1
    setSearchText(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => onSearch(value), SEARCH_DEBOUNCE_MS)
  }
  // «Clear»: no wait, and what was pending is dropped
  const clearSearch = () => {
    setLoadingMore(false)
    autoLoadedAt.current = -1
    clearTimeout(searchTimer.current)
    onSearch('')
  }
  // A search set from outside is shown, never while the person is typing (as SearchBar did)
  useEffect(() => {
    if (!searchValue) {
      setSearchText('')
      return
    }
    if (document.activeElement !== searchInput.current) setSearchText(String(searchValue))
  }, [searchValue])
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  // redesign W1-7 (T1-7-4, W1-QC1-03): the trigger that opened the selector is whatever had the focus when it mounted
  // (Appointments has two: the header button and the empty-state one). The component is shared and its callers are not
  // edited, so it links that trigger to itself and gives the focus back to it, or to the control beside it if it went away.
  useLayoutEffect(() => {
    const active = document.activeElement
    const opener = active && active !== document.body && !dropdownReference.current?.contains(active) ? active : null
    openerReference.current = opener
    const added = []
    if (opener) {
      for (const [name, value] of [['aria-controls', popupId], ['aria-expanded', 'true']]) {
        if (!opener.hasAttribute(name)) {
          opener.setAttribute(name, value)
          added.push(name)
        }
      }
    }
    return () => {
      const container = dropdownReference.current
      const hadFocus = !!container?.contains(document.activeElement)
      const previous = container?.previousElementSibling
      added.forEach(name => opener?.removeAttribute(name))
      if (!hadFocus) return
      // redesign bugs F (live check L-3): opened by the page (/stores/products without a store) nothing had the focus, and
      // Escape left it on <body>; then the trigger of the surroundings (`aria-haspopup="dialog"`, up to three levels out) takes it
      let fallback = previous?.matches?.('button, a[href], [tabindex]') ? previous : null
      if (!opener && !fallback) {
        for (let node = container?.parentElement, level = 0; node && level < 3 && !fallback; node = node.parentElement, level++) {
          fallback = [...node.querySelectorAll('[aria-haspopup="dialog"]')].find(element => !container.contains(element)) || null
        }
      }
      // after the commit: the opener may be leaving in the same one (the empty-state button goes with the choice)
      Promise.resolve().then(() => {
        const target = opener?.isConnected ? opener : fallback?.isConnected ? fallback : null
        target?.focus()
      })
    }
  }, [])

  // W1-QC1-03: the search takes the focus on open. Not on a tap on a touch screen: that would raise the on-screen keyboard over the list.
  useEffect(() => {
    const opener = openerReference.current
    let touch = false
    let keyboardOpened = !!opener
    try { touch = !!window.matchMedia?.('(pointer: coarse)').matches } catch (e) {}
    try { keyboardOpened = !!opener && opener.matches(':focus-visible') } catch (e) {}
    if (touch && !keyboardOpened) return
    dropdownReference.current?.querySelector('input[name="search"]')?.focus()
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const items = [...dropdownReference.current.querySelectorAll('input[name="search"], button[data-slot="business-option"]')]
    const index = items.indexOf(document.activeElement)
    if (index === -1) return
    const onOption = document.activeElement.tagName === 'BUTTON'
    let next
    if (e.key === 'ArrowDown') next = Math.min(index + 1, items.length - 1)
    else if (e.key === 'ArrowUp') next = Math.max(index - 1, 0)
    else if (!onOption) return
    else next = e.key === 'Home' ? Math.min(1, items.length - 1) : items.length - 1
    e.preventDefault()
    items[next]?.focus()
    // the last option in view is the end of the list: the next page (the scroll the focus causes asks for it too, once)
    if (next === items.length - 1 && items[next]?.tagName === 'BUTTON') requestMore()
  }

  const closeSelect = (e) => {
    if (isOpen) {
      const outsideDropdown = !dropdownReference.current?.contains(e.target)
      if (outsideDropdown) {
        close()
      }
    }
  }

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('mouseup', closeSelect)
    return () => document.removeEventListener('mouseup', closeSelect)
  }, [isOpen])

  return (
    <div
      ref={dropdownReference}
      id={popupId}
      className='odc-root odc-bsh'
      role='group'
      aria-label={t('SELECT_BUSINESS', 'Select business')}
      onKeyDown={handleKeyDown}
    >
      <div className='odc-bsh-content'>
        <div className='odc-bsh-search'>
          <SearchField
            value={searchText}
            onChange={typeSearch}
            onClear={clearSearch}
            inputRef={attachSearchInput}
            label={t('SEARCH', 'Search')}
            placeholder={t('SEARCH', 'Search')}
            clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          />
        </div>
        <div
          ref={listReference}
          className='odc-bsh-list'
          aria-busy={businessList.loading || undefined}
          onScroll={handleListScroll}
        >
          <span className='odc-sr-only' role='status' aria-live='polite'>{businessList.loading ? t('LOADING', 'Loading') : ''}</span>
          {businessList.loading && !loadingMore
            ? <SkeletonRows count={Math.min(pagination?.pageSize || FIRST_LOAD_SKELETONS_MAX, FIRST_LOAD_SKELETONS_MAX)} />
            : (
              <>
                {businesses.map(business => (
                  <button
                    key={business.id}
                    type='button'
                    className='odc-bsh-option'
                    data-slot='business-option'
                    onClick={() => changeBusinessState(business)}
                  >
                    <Avatar
                      kind='business'
                      className='odc-bsh-logo'
                      name={business?.name || ''}
                      src={business?.logo ? optimizeImage(business.logo, 'h_50,c_limit') : undefined}
                    />
                    <span className='odc-bsh-text'>
                      <span className='odc-bsh-name'>{business?.name}</span>
                      <span className='odc-bsh-city'>{business?.city?.name}</span>
                    </span>
                  </button>
                ))}
                {businessList.loading && <SkeletonRows count={LOAD_MORE_SKELETONS} />}
              </>
              )}
        </div>

        {!businessList.loading && pagination?.total === 0 && allowBusinessRegister && (
          <Button
            variant='primary'
            size='lg'
            className='odc-bsh-add'
            onClick={openAddBusiness}
          >
            {t('ADD_NEW_STORE', 'Add new store')}
          </Button>
        )}
      </div>
    </div>
  )
}

export const BusinessSelectHeader = (props) => {
  const businessListingProps = {
    ...props,
    UIComponent: BusinessessListingUI,
    asDashboard: true,
    loadMorePageSize: props.defaultPageSize ?? DEFAULT_PAGE_SIZE,
    paginationSettings: {
      pageSize: props.defaultPageSize ?? DEFAULT_PAGE_SIZE
    },
    isSearchByBusinessName: true,
    isSearchByBusinessEmail: true,
    isSearchByBusinessPhone: true,
    propsToFetch: props.defaultPropsToFetch ?? ['name', 'slug', 'logo', 'city']
  }
  return (
    <BusinessListController {...businessListingProps} />
  )
}
