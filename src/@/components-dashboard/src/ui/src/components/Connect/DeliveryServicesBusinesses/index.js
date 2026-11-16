import React, { useMemo, useState } from 'react'
import { useLanguage, useUtils } from '../../../../../index'
import { Button, SelectableList } from '../../Shared/Product'
import './delivery-service-businesses.css'

const PAGE_SIZES = [10, 25, 50]

const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

// the Businesses section of the delivery provider panel on P/SelectableList, in place of main's
// SearchBar, grey buttons, empty logo box, legacy checkboxes and Pagination. Same data and handlers as main: the stores come
// whole and are filtered and paginated here; «Select all» / «Select none» and each row call the controller; Save (or Add)
// sends the same change.
export const DeliveryServiceBusinesses = (props) => {
  const {
    deliveryServiceState,
    handleSelectBusiness,
    actionState,
    handleSelectAllBusiness,
    selectedBusinessIds = [],
    businessesLoading,
    businesses = [],
    changesState = {},
    handleUpdateDeliveryGroup,
    handleAddDeliveryService
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const [searchValue, setSearchValue] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const filtered = useMemo(() => {
    const needle = searchValue.trim().toLowerCase()
    return needle ? businesses.filter(business => business?.name?.toLowerCase().includes(needle)) : businesses
  }, [businesses, searchValue])
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)

  const saving = Boolean(actionState?.loading)
  const count = selectedBusinessIds?.length ?? 0

  const onSubmit = () => {
    if (deliveryServiceState.deliveryService) {
      handleUpdateDeliveryGroup({ business: changesState.business })
    } else {
      handleAddDeliveryService()
    }
  }

  return (
    <div className='dsp-businesses'>
      <SelectableList
        label={t('STORES', 'Stores')}
        items={pageItems.map(business => ({
          id: business.id,
          name: business.name,
          photo: business.logo ? optimizeImage(business.logo, 'h_50,c_limit') : undefined
        }))}
        avatars='business'
        selectedIds={selectedBusinessIds}
        onToggle={handleSelectBusiness}
        locked={saving}
        loading={Boolean(businessesLoading)}
        loadingLabel={t('LOADING', 'Loading')}
        emptyTitle={t('STAFF_STORES_NO_MATCH', 'No stores match this search')}
        onSearch={(text) => {
          // a new search starts at its first page, as main
          setSearchValue(text)
          setPage(1)
        }}
        searchLabel={t('STAFF_STORES_SEARCH', 'Search stores')}
        clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
        onSelectAll={() => handleSelectAllBusiness(true)}
        selectAllLabel={t('SELECT_ALL', 'Select all')}
        onSelectNone={() => handleSelectAllBusiness(false)}
        selectNoneLabel={t('SELECT_NONE', 'Select none')}
        pagination={{
          page,
          pageSize,
          total: filtered.length,
          pageSizeOptions: PAGE_SIZES,
          onPageChange: setPage,
          onPageSizeChange: (size, nextPage) => {
            setPageSize(size)
            setPage(nextPage)
          },
          label: t('PAGINATION', 'Pagination'),
          previousLabel: t('PREVIOUS_PAGE', 'Previous page'),
          nextLabel: t('NEXT_PAGE', 'Next page'),
          pageSizeLabel: t('ITEMS_PER_PAGE', 'Items per page'),
          rangeLabel: (from, to, total, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(total) }),
          pageStatusLabel: (current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))
        }}
      />
      {/* redesign D-12 (owner, 2026-10-19): the total of the selection, all pages, announced politely */}
      <p className='dsp-businesses-count' role='status'>
        {count === 1
          ? t('STORES_N_SELECTED_ONE', '_count_ store selected').replace('_count_', '1')
          : t('STORES_N_SELECTED_OTHER', '_count_ stores selected').replace('_count_', String(count))}
      </p>
      <Button
        variant='primary'
        disabled={!changesState?.business}
        busy={saving}
        onClick={onSubmit}
      >
        {deliveryServiceState.deliveryService ? t('SAVE', 'Save') : t('ADD', 'Add')}
      </Button>
    </div>
  )
}
