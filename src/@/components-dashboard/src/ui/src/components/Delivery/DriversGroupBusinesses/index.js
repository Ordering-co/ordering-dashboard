import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'

import { Avatar, Button, Pagination } from '../../Shared/Product'
import { DriversGroupPickList, DriversGroupPickRow } from '../DriversGroupPickList'
import './drivers-group-businesses.css'

// redesign (AD-5): the rows per page of main's pagination, and the wait main's SearchBar (lazyLoad) gave the API search
const PAGE_SIZES = [10, 25, 50]
const SEARCH_DEBOUNCE_MS = 300

export const DriversGroupBusinesses = (props) => {
  const {
    driversGroupState,
    businesses,
    handleSelectBusiness,
    actionState,
    changesState,
    handleUpdateDriversGroup,
    handleAddDriversGroup,
    handleSelectAllBusiness,
    selectedBusinessIds,
    actionDisabled,
    businessesLoading,
    searchBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    businessesPaginationProps
  } = props

  const [, t] = useLanguage()
  // redesign (AD-4): the field shows what is typed at once; the API search (server side, as main) runs after a pause
  const [search, setSearch] = useState('')
  const searchTimer = useRef(null)
  const searchRef = useRef(searchBusinesses)
  searchRef.current = searchBusinesses
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const onSearch = (value) => {
    setSearch(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => searchRef.current?.(value ?? ''), SEARCH_DEBOUNCE_MS)
  }

  const onSubmit = (event) => {
    event.preventDefault()
    if (actionState?.loading) return // redesign (AD-1): a busy Save does not send twice
    if (driversGroupState.driversGroup) {
      handleUpdateDriversGroup(changesState)
    } else {
      handleAddDriversGroup()
    }
  }

  const count = selectedBusinessIds.length
  const rows = businesses ?? []
  const saving = Boolean(actionState?.loading)
  const pagination = businessesPaginationProps
  const total = pagination?.totalItems ?? null

  return (
    <form
      className='gpb-root'
      data-tour='tour_select_business'
      data-disabled={actionDisabled ? '' : undefined}
      onSubmit={onSubmit}
    >
      <DriversGroupPickList
        legend={t('BUSINESSES', 'Businesses')}
        search={search}
        onSearch={onSearch}
        searchLabel={t('DRIVERS_GROUPS_SEARCH_STORES', 'Search stores')}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
        placeholder={t('SEARCH', 'Search')}
        onSelectAll={() => handleSelectAllBusiness(true)}
        onSelectNone={() => handleSelectAllBusiness(false)}
        selectAllLabel={t('SELECT_ALL', 'Select all')}
        selectNoneLabel={t('SELECT_NONE', 'Select none')}
        // redesign D-12 (owner, 2026-10-19): the total of the selection, all pages, announced politely
        status={(
          <span role='status'>
            {count === 1
              ? t('STORES_N_SELECTED_ONE', '_count_ store selected').replace('_count_', '1')
              : t('STORES_N_SELECTED_OTHER', '_count_ stores selected').replace('_count_', String(count))}
          </span>
        )}
        loading={Boolean(businessesLoading)}
        loadingLabel={t('LOADING', 'Loading')}
        empty={!businessesLoading && rows.length === 0}
        emptyTitle={t('DRIVERS_GROUPS_NO_STORES', 'No stores yet')}
        noMatchTitle={t('DRIVERS_GROUPS_LIST_NO_MATCH', 'Nothing matches your search')}
        footer={pagination?.totalPages > 1 && (
          <Pagination
            page={pagination.currentPage}
            pageSize={pagination.pageSize}
            total={total ?? undefined}
            hasMore={total == null && pagination.currentPage < pagination.totalPages}
            itemCount={rows.length}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={page => handleChangeBusinessPage(page)}
            onPageSizeChange={size => handleChangeBusinessPageSize(size)}
            busy={Boolean(businessesLoading)}
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            rangeLabel={(from, to, all) => all == null
              ? `${from}–${to}`
              : t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_').replace('_from_', String(from)).replace('_to_', String(to)).replace('_total_', String(all))}
            pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
          />
        )}
      >
        {rows.map(business => (
          <DriversGroupPickRow
            key={business.id}
            media={<Avatar kind='business' name={business.name} src={business.logo} />}
            title={business.name}
            checked={selectedBusinessIds.includes(business.id)}
            disabled={saving}
            onCheckedChange={next => handleSelectBusiness(business.id, next)}
          />
        ))}
      </DriversGroupPickList>
      <Button
        variant='primary'
        type='submit'
        disabled={Object.keys(changesState).length === 0}
        busy={saving}
      >
        {driversGroupState.driversGroup ? t('SAVE', 'Save') : t('ADD', 'Add')}
      </Button>
    </form>
  )
}
