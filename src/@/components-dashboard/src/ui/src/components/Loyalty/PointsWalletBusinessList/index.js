import React, { useState, useEffect, useRef } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useLanguage, useUtils, PointsWalletBusinessList as PointsWalletBusinessListController } from '../../../../../index'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { Modal, SideBar, Alert } from '../../Shared'
import { ChevronRight } from '../../Shared/Icon'
import { Avatar, Checkbox, EmptyState, Pagination, SearchField, Skeleton, Switch } from '../../Shared/Product'
import { PointsWalletBusinessDetail } from '../PointsWalletBusinessDetail'
import './points-wallet-business-list.css'

// the wallet rules per store in Product pieces: P/SearchField (sent after main's 750ms wait), one row per store with its
// P/Avatar, a P/Switch and two P/Checkbox named after the store, and P/Pagination. Same controller props, handlers and detail as main.

const SEARCH_DEBOUNCE_MS = 750 // the wait of `SearchBar lazyLoad` of main: each change of the search is a request
const PAGE_SIZES = [10, 25, 50] // the sizes of main's pagination

const PointsWalletBusinessListUI = (props) => {
  const {
    businessList,
    handleParentSidebarMove,
    pointWallet,
    handleCheckBox,
    handleUpdateWalletBusiness,
    handleUpdateBusinessList,
    handleChangeSwitch,
    isCloseBusinessDetails,
    paginationProps,
    setPaginationProps,
    searchValue,
    handleChangeSearch,
    onDirtyChange
  } = props

  const history = useHistory()
  const location = useLocation()
  const query = new URLSearchParams(location.search)

  const replaceQuery = (mutate) => {
    const next = new URLSearchParams(location.search)
    mutate(next)
    const qs = next.toString()
    history.replace(qs ? `${location.pathname}?${qs}` : location.pathname)
  }
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const { width } = useWindowSize()
  const [alertState, setAlertState] = useState({ open: false, content: [] })

  const [extraOpen, setExtraOpen] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState(null)

  // the search is typed here and sent after a wait, at once when cleared
  const [searchText, setSearchText] = useState(searchValue || '')
  const searchTimer = useRef(null)
  useEffect(() => () => clearTimeout(searchTimer.current), [])
  const typeSearch = (text) => {
    setSearchText(text)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => handleChangeSearch(text), SEARCH_DEBOUNCE_MS)
  }
  const clearSearch = () => {
    clearTimeout(searchTimer.current)
    handleChangeSearch('')
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const handleChangePage = (page) => {
    setPaginationProps(prev => ({ ...prev, currentPage: page }))
  }

  const handleChangePageSize = (pageSize) => {
    setPaginationProps(prev => ({ ...prev, pageSize, currentPage: 1 }))
  }

  const handleClickBusiness = (business, e) => {
    if (e?.target?.closest('.accumulates') || e?.target?.closest('.redeems') || e?.target?.closest('.wallet_enabled')) return
    if (!pointWallet) {
      setAlertState({ open: true, content: [t('YOU_MUST_CREATE_LOYALTY_PLAN', 'You must create a loyalty plan')] })
      return
    }
    if (!business?.wallet_enabled) {
      setAlertState({ open: true, content: t('DISABLED_BUSINESS', 'Disabled business') })
      return
    }
    setSelectedBusiness(business)
    setExtraOpen(true)
    replaceQuery((next) => {
      next.set('business_id', String(business?.id))
    })
    if (width >= 1100) {
      handleParentSidebarMove(550)
    }
  }

  const handleCloseBusinessDetail = () => {
    setExtraOpen(false)
    setSelectedBusiness(null)
    handleParentSidebarMove(0)
    replaceQuery((next) => {
      next.delete('business_id')
    })
  }

  const updateBusinessList = (changes) => {
    const updatedBusiness = { ...selectedBusiness, ...changes }
    setSelectedBusiness(updatedBusiness)
    handleUpdateBusinessList(selectedBusiness?.id, changes)
  }

  const handleUpdateStatus = (businessId, enabled) => {
    if (!enabled) handleCloseBusinessDetail()
    handleChangeSwitch && handleChangeSwitch(businessId, enabled)
  }

  useEffect(() => {
    if (width < 1100) {
      handleParentSidebarMove(0)
    } else {
      if (extraOpen) handleParentSidebarMove(550)
    }
  }, [width, extraOpen])

  useEffect(() => {
    if (!isCloseBusinessDetails) return
    setExtraOpen(false)
    setSelectedBusiness(null)
    replaceQuery((next) => {
      next.delete('business_id')
    })
  }, [isCloseBusinessDetails])

  useEffect(() => {
    if (businessList.loading) return
    const businessId = query.get('business_id')
    if (businessId) {
      const business = businessList.businesses.find(item => item.id === Number(businessId))
      if (business) {
        handleClickBusiness(business)
      }
    }
  }, [businessList])

  const businesses = businessList?.businesses || []
  const totalItems = paginationProps?.totalItems
  const knownTotal = totalItems != null && Number.isFinite(Number(totalItems))
  // a store's own name in each control of its row: «Status, Store A» (existing keys, composed)
  const rowLabel = (key, fallback, business) => `${t(key, fallback)}, ${business?.name ?? ''}`

  return (
    <div className='pwbl'>
      <SearchField
        className='pwbl-search'
        value={searchText}
        onChange={typeSearch}
        onClear={clearSearch}
        label={t('SEARCH', 'Search')}
        placeholder={t('SEARCH', 'Search')}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
      />

      {businessList.loading
        ? (
          <div className='pwbl-loading' role='status' aria-busy='true' aria-label={t('LOADING', 'Loading')}>
            {[...Array(7).keys()].map(i => (
              <div className='pwbl-skeleton-row' key={i}>
                <Skeleton shape='box' size='var(--od-x-control-height)' block='var(--od-x-control-height)' />
                <Skeleton size='40%' />
              </div>
            ))}
          </div>
          )
        : !businessList.error && businesses.length === 0
            ? <EmptyState title={t('NO_BUSINESSES_FOUND', 'No businesses found')} />
            : (
              <div className='pwbl-table-wrap'>
                <table className='pwbl-table'>
                  <thead>
                    <tr>
                      <th className='pwbl-store'>{t('BUSINESSES', 'Businesses')}</th>
                      <th>{t('ORDERS_BOX_STATUS_HEADER', 'Status')}</th>
                      <th>{t('REDEEM', 'Redeem')}</th>
                      <th>{t('ACCUMULATION', 'Accumulation')}</th>
                      <th><span className='odc-sr-only'>{t('ACTIONS', 'Actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {businesses.map((business, i) => {
                      const active = business?.id === selectedBusiness?.id
                      return (
                        <tr
                          key={business?.id ?? i}
                          className='pwbl-row'
                          data-active={active ? '' : undefined}
                          onClick={(e) => handleClickBusiness(business, e)}
                        >
                          <td className='pwbl-store'>
                            {/* the row opens on a click anywhere; this button is its keyboard way in (its click bubbles to the row) */}
                            <button type='button' className='pwbl-open' aria-current={active ? 'true' : undefined}>
                              <Avatar
                                kind='business'
                                size='sm'
                                name={business?.name}
                                src={business?.logo ? optimizeImage(business.logo, 'h_120,c_limit') : undefined}
                              />
                              <span className='pwbl-name'>{business?.name}</span>
                            </button>
                          </td>
                          <td className='pwbl-cell'>
                            {/* the column's name, drawn only where the row becomes a card (below 768px); the control carries its own name */}
                            <span className='pwbl-cell-label' aria-hidden='true'>{t('ORDERS_BOX_STATUS_HEADER', 'Status')}</span>
                            <Switch
                              className='wallet_enabled'
                              checked={Boolean(business?.wallet_enabled)}
                              onCheckedChange={val => handleUpdateStatus(business.id, val)}
                              label={rowLabel('ORDERS_BOX_STATUS_HEADER', 'Status', business)}
                            />
                          </td>
                          <td className='pwbl-cell'>
                            <span className='pwbl-cell-label' aria-hidden='true'>{t('REDEEM', 'Redeem')}</span>
                            <Checkbox
                              className='redeems'
                              checked={Boolean(business?.redeems)}
                              disabled={!business?.wallet_enabled}
                              onCheckedChange={() => handleCheckBox(business.id, 'redeems', !business?.redeems)}
                              label={rowLabel('REDEEM', 'Redeem', business)}
                            />
                          </td>
                          <td className='pwbl-cell'>
                            <span className='pwbl-cell-label' aria-hidden='true'>{t('ACCUMULATION', 'Accumulation')}</span>
                            <Checkbox
                              className='accumulates'
                              checked={Boolean(business?.accumulates)}
                              disabled={!business?.wallet_enabled}
                              onCheckedChange={() => handleCheckBox(business.id, 'accumulates', !business?.accumulates)}
                              label={rowLabel('ACCUMULATION', 'Accumulation', business)}
                            />
                          </td>
                          <td className='pwbl-chevron-cell'>
                            <ChevronRight className='odc-icon pwbl-chevron' aria-hidden='true' />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              )}
      {businesses.length > 0 && (
        <Pagination
          className='pwbl-pagination'
          page={paginationProps.currentPage}
          pageSize={paginationProps.pageSize}
          total={knownTotal ? Number(totalItems) : undefined}
          hasMore={!knownTotal && paginationProps.currentPage < (paginationProps.totalPages ?? 0)}
          itemCount={businesses.length}
          pageSizeOptions={PAGE_SIZES}
          onPageChange={handleChangePage}
          onPageSizeChange={(size) => handleChangePageSize(size)}
          busy={Boolean(businessList.loading)}
          label={t('PAGINATION', 'Pagination')}
          previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
          nextLabel={t('NEXT_PAGE', 'Next page')}
          pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
          // without a total from the API the foot says only the range and the page number
          rangeLabel={(from, to, total) => total == null
            ? `${from}–${to}`
            : t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_')
              .replace('_from_', String(from))
              .replace('_to_', String(to))
              .replace('_total_', String(total))}
          pageStatusLabel={(current, total) => total == null
            ? String(current)
            : t('PAGE_STATUS', 'Page _page_ of _total_')
              .replace('_page_', String(current))
              .replace('_total_', String(total))}
        />
      )}

      {extraOpen && (
        <>
          {width >= 1100
            ? (
            <SideBar
              isBorderShow
              open={extraOpen}
              defaultSideBarWidth={550}
              sidebarId='loyaltyBusinessDetail'
              onClose={handleCloseBusinessDetail}
            >
              <PointsWalletBusinessDetail
                walletData={selectedBusiness}
                handleUpdateWalletBusiness={handleUpdateWalletBusiness}
                handleUpdateBusinessList={updateBusinessList}
                isBusiness
                onDirtyChange={onDirtyChange}
              />
            </SideBar>
              )
            : (
            <Modal
              width='70%'
              height='90vh'
              padding='0'
              open={extraOpen}
              onClose={handleCloseBusinessDetail}
            >
              <PointsWalletBusinessDetail
                walletData={selectedBusiness}
                handleUpdateWalletBusiness={handleUpdateWalletBusiness}
                handleUpdateBusinessList={updateBusinessList}
                isBusiness
                onDirtyChange={onDirtyChange}
              />
            </Modal>
              )}
        </>
      )}
      <Alert
        title={t('POINTS_WALLET', 'Points wallet')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </div>
  )
}

export const PointsWalletBusinessList = (props) => {
  const pointsWalletBusinessListProps = {
    ...props,
    propsToFetch: ['id', 'name', 'logo'],
    UIComponent: PointsWalletBusinessListUI
  }
  return <PointsWalletBusinessListController {...pointsWalletBusinessListProps} />
}
