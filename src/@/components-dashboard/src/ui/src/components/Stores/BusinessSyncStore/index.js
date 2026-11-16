import React, { useEffect, useRef, useState } from 'react'
import {
  useLanguage,
  useUtils,
  DashboardBusinessList as BusinessListController
} from '../../../../../index'
import { ArrowLeft, ChevronRight, Store, X } from '../../Shared/Icon'
import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  Pagination,
  SearchField,
  Skeleton
} from '../../Shared/Product'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { BusinessSyncStoreDetail } from '../BusinessSyncStoreDetail'
import './sync-store.css'

// redesign stores 3.D, D5: the store picker of the integration-sync panel as Product. It draws what the
// DashboardBusinessList controller gives (`businessList`, `pagination`, `searchValue`) and fetches nothing. The detail of a store
// lives INSIDE this panel (no SideBar, no Modal): side by side with the list from 1100px, and replacing it, with «Back», below.
const SPLIT_FROM = 1100 // px, the same threshold as before
const PARENT_SIDEBAR = 550 // the width the legacy container makes room for beside the list (until it is migrated)
const SEARCH_DEBOUNCE_MS = 750 // the wait of the SearchBar of today (`lazyLoad`)
const PAGE_SIZES = [10, 25, 50]
const SKELETON_ROWS = 5

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11) and keep their direction in RTL
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const BusinessSyncStoreUI = (props) => {
  const {
    searchValue,
    onSearch,
    businessList,
    pagination,
    getPageBusinesses,
    handleParentSidebarMove,
    onDetailChange
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const { width } = useWindowSize()
  const wide = width >= SPLIT_FROM

  const [selectedBusiness, setSelectedBusiness] = useState(null)

  // ---- the stores that were on screen, to give the focus back to the one that was open ----
  const rows = useRef({})
  const backButton = useRef(null)
  const focusDetail = useRef(false)
  const [restoreFocus, setRestoreFocus] = useState(null)
  useEffect(() => {
    if (restoreFocus == null || selectedBusiness) return
    rows.current[restoreFocus]?.focus()
    setRestoreFocus(null)
  }, [restoreFocus, selectedBusiness])
  // below the split the list is gone when the detail opens: the focus goes to «Back», not to the body
  useEffect(() => {
    if (!selectedBusiness || !focusDetail.current) return
    focusDetail.current = false
    backButton.current?.focus()
  }, [selectedBusiness])

  const handleClickBusiness = (business) => {
    focusDetail.current = !wide
    setSelectedBusiness(business)
    if (wide) {
      handleParentSidebarMove?.(PARENT_SIDEBAR)
    }
  }

  const handleCloseBusinessDetail = () => {
    handleParentSidebarMove?.(0)
    setRestoreFocus(selectedBusiness?.id ?? null)
    setSelectedBusiness(null)
  }

  // ---- search: typed here, sent after a wait (at once on Enter or on clear). A value set from outside shows unless the user is typing.
  const [searchText, setSearchText] = useState(searchValue || '')
  const searchTimer = useRef(null)
  const searchInput = useRef(null)
  useEffect(() => {
    if (!searchValue) {
      setSearchText('')
      return
    }
    if (typeof document !== 'undefined' && document.activeElement !== searchInput.current) setSearchText(searchValue)
  }, [searchValue])
  useEffect(() => () => clearTimeout(searchTimer.current), [])
  const sendSearch = (text) => {
    clearTimeout(searchTimer.current)
    onSearch?.(text)
  }
  const typeSearch = (text) => {
    setSearchText(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => onSearch?.(text), SEARCH_DEBOUNCE_MS)
  }

  // ---- pages: the same calls as before. The page size keeps the first store in view: ceil(from / size), as before.
  const handleChangePage = (page) => {
    getPageBusinesses(pagination.pageSize, page)
  }
  const handleChangePageSize = (pageSize, keepPage) => {
    const expectedPage = pagination?.from > 0 ? Math.ceil(pagination.from / pageSize) : keepPage
    getPageBusinesses(pageSize, expectedPage)
  }

  const loading = !!businessList?.loading
  const businesses = businessList?.businesses || []
  const showList = wide || !selectedBusiness
  const split = wide && !!selectedBusiness

  // review r1 #2: the parent panel doubles only for the side-by-side layout, told from the same width that decides it (the
  // docked assistant included), never from a media query of its own. Said on every change, not at mount.
  const splitTold = useRef(false)
  useEffect(() => {
    if (split === splitTold.current) return
    splitTold.current = split
    onDetailChange?.(split)
  }, [split])

  const list = loading
    ? (
      <ul className='bss-list' aria-busy='true'>
        <li className='odc-sr-only'>{t('LOADING', 'Loading')}</li>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <li className='bss-item bss-skeleton' key={index}>
            <Skeleton shape='box' size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' />
            <Skeleton size='40%' />
          </li>
        ))}
      </ul>
      )
    : businesses.length > 0
      ? (
        <ul className='bss-list' aria-label={t('STORES', 'Stores')}>
          {businesses.map((business, index) => {
            const active = selectedBusiness?.id === business?.id
            return (
              <li className='bss-item' key={business?.id ?? index}>
                <button
                  type='button'
                  className='bss-store'
                  aria-current={active ? 'true' : undefined}
                  ref={node => { rows.current[business?.id] = node }}
                  onClick={() => handleClickBusiness(business)}
                >
                  <Avatar kind='business' size='lg' name={business?.name} src={business?.logo ? optimizeImage(business.logo) : undefined} />
                  <span className='bss-name'>{business?.name}</span>
                  <ChevronRight className='odc-icon odc-icon-flip bss-chevron' aria-hidden='true' />
                </button>
              </li>
            )
          })}
        </ul>
        )
      : <EmptyState icon={Store} title={t('NO_RESULTS_FOUND', 'No results found')} />

  return (
    <div className='odc-root bss' data-split={split ? '' : undefined}>
      {showList && (
        <div className='bss-pane'>
          <SearchField
            className='bss-search'
            value={searchText}
            onChange={typeSearch}
            onClear={() => sendSearch('')}
            onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
            inputRef={searchInput}
            label={t('SEARCH', 'Search')}
            placeholder={t('SEARCH', 'Search')}
            clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          />
          {list}
          {pagination?.total > 0 && (
            <Pagination
              className='bss-pagination'
              page={pagination.currentPage}
              pageSize={pagination.pageSize}
              total={pagination.total}
              pageSizeOptions={PAGE_SIZES}
              onPageChange={handleChangePage}
              onPageSizeChange={handleChangePageSize}
              busy={loading}
              label={t('PAGINATION', 'Pagination')}
              previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
              nextLabel={t('NEXT_PAGE', 'Next page')}
              pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
              pageLabel={t('PAGE', 'Page')}
              rangeLabel={(from, to, total, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figure)}
              pageStatusLabel={(current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
            />
          )}
        </div>
      )}
      {selectedBusiness && (
        <div className='bss-pane bss-detail'>
          <div className='bss-detail-bar'>
            {wide
              ? <IconButton icon={X} size='sm' label={t('CLOSE', 'Close')} onClick={handleCloseBusinessDetail} />
              : <Button ref={backButton} variant='ghost' size='sm' icon={ArrowLeft} className='bss-back' onClick={handleCloseBusinessDetail}>{t('BACK', 'Back')}</Button>}
          </div>
          <BusinessSyncStoreDetail key={selectedBusiness.id} business={selectedBusiness} />
        </div>
      )}
    </div>
  )
}

export const BusinessSyncStore = (props) => {
  const businessBrandBUSIDetailProps = {
    ...props,
    UIComponent: BusinessSyncStoreUI,
    asDashboard: true,
    isSearchByBusinessName: true
  }
  return <BusinessListController {...businessBrandBUSIDetailProps} />
}
