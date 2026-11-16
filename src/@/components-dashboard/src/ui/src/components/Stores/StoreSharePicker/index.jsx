import React, { useEffect, useRef } from 'react'
import { useLanguage, useUtils } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, InlineNotice, SelectableList } from '../../Shared/Product'
import { TriangleAlert } from '../../Shared/Icon'
import './store-share-picker.css'

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const PAGE_SIZES = [10, 25, 50]
const SKELETON_ROWS = 10

const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

// redesign stores 2.H: the «Share with» picker of menus and delivery zones, on the StoreSharePicker
// controller. A failure shows: the list that did not load says so and can be retried, and a save that failed says why
// under Save, which is usable again (G3-05).
// redesign the list is P/SelectableList (it was Shared/UI SelectBusinesses), with the same actions: pick,
// select all (the page on screen joins the selection) or none, search, page and page size, and Save with its button.
export const StoreSharePickerUI = (props) => {
  const {
    actionState,
    selectedBusinessIds,
    businessesState,
    handleSelectBusiness,
    handleSelectAllBusiness,
    handleShareBusinesses,
    searchBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    businessesPaginationProps,
    reloadBusinesses
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const saveError = actionState?.result?.error ? actionState.result.result : null
  const saveNoticeRef = useRef(null)

  // The notice sits under Save, at the end of a long list: bring it into view when a save fails.
  useEffect(() => {
    if (actionState?.result?.error) saveNoticeRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [actionState?.result?.error, saveError])

  return (
    <div className='odc-root odc-share-picker'>
      <SelectableList
        label={t('STORES', 'Stores')}
        items={(businessesState.businesses || []).map(business => ({
          id: business.id,
          name: business.name,
          photo: business.logo ? optimizeImage(business.logo, 'h_50,c_limit') : undefined
        }))}
        avatars='business'
        selectedIds={selectedBusinessIds}
        onToggle={handleSelectBusiness}
        locked={actionState.loading} // redesign bugs F the list cannot change under a save in flight
        loading={businessesState.loading}
        loadingLabel={t('LOADING', 'Loading')}
        skeletonRows={SKELETON_ROWS}
        emptyTitle={t('STAFF_STORES_NO_MATCH', 'No stores match this search')}
        error={Boolean(businessesState.error)}
        errorTitle={t('STORES_LOAD_FAILED', 'We couldn\'t load the stores.')}
        retryLabel={t('RETRY', 'Retry')}
        onRetry={() => reloadBusinesses?.()}
        onSearch={(text) => searchBusinesses?.(text)}
        searchLabel={t('STAFF_STORES_SEARCH', 'Search stores')}
        clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
        onSelectAll={() => handleSelectAllBusiness(true)}
        selectAllLabel={t('SELECT_ALL', 'Select all')}
        onSelectNone={() => handleSelectAllBusiness(false)}
        selectNoneLabel={t('SELECT_NONE', 'Select none')}
        pagination={businessesPaginationProps?.totalItems == null
          ? undefined
          : {
              page: businessesPaginationProps.currentPage,
              pageSize: businessesPaginationProps.pageSize,
              total: businessesPaginationProps.totalItems,
              pageSizeOptions: PAGE_SIZES,
              onPageChange: (page) => handleChangeBusinessPage(page),
              onPageSizeChange: (size) => handleChangeBusinessPageSize(size),
              label: t('PAGINATION', 'Pagination'),
              previousLabel: t('PREVIOUS_PAGE', 'Previous page'),
              nextLabel: t('NEXT_PAGE', 'Next page'),
              pageSizeLabel: t('ITEMS_PER_PAGE', 'Items per page'),
              pageLabel: t('PAGE', 'Page'),
              rangeLabel: (from, to, count, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(count) }),
              pageStatusLabel: (current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))
            }}
      />
      <Button
        variant='primary'
        className='odc-share-picker-save'
        disabled={actionState.loading || businessesState.loading}
        onClick={handleShareBusinesses}
      >
        {t('SAVE', 'Save')}
      </Button>
      {actionState?.result?.error && (
        <div ref={saveNoticeRef}>
          <InlineNotice tone='danger' icon={TriangleAlert} role='alert' className='odc-share-picker-notice'>
            {translateApiMessage(t, firstMessage(saveError), t('STORES_CHANGE_FAILED', 'We couldn\'t save the change.'))}
          </InlineNotice>
        </div>
      )}
    </div>
  )
}
