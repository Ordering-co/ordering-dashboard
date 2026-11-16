import React, { useEffect, useRef, useState } from 'react'

import { useApi, useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { learnOptionsValues } from '../../../utils'
import { settleFocusOn } from '../../../utils/listFocus'
import { Download, Menu as MenuIcon, Store } from '../../Shared/Icon'
import { LearnDropDown } from '../../Shared/LearnDropDown'
import { Button, EmptyState, FilterBar, IconButton, PageHeader, SearchField, SplitView, Tabs } from '../../Shared/Product'
import { StorePicker } from '../AnalyticsKit/StorePicker'
import { BusinessReviewDetails } from '../BusinessReviewDetails'
import { BusinessReviewList } from '../BusinessReviewList'
import { ProductReviewDetails } from '../ProductReviewDetails'
import { ReviewProductsListing } from '../ReviewProductsListing'
import { UserReviewDetails } from '../UserReviewDetails'
import { UsersReviewList } from '../UsersReviewList'
import { ReviewsExport } from '../ReviewsDirectory/ReviewsExport'
import {
  useReviewsQuery,
  writeFirstTab,
  writeProduct,
  writeProducts,
  writeRecord,
  writeStore,
  writeTab
} from '../ReviewsDirectory/useReviewsQuery'
import '../ReviewsDirectory/reviews-page.css'

// redesign reviews FD2 (D1, D2, D6, D7, D9; RV-01, RV-07, RV-10, RV-11, RV-15): /intelligence/reviews is a header (title, Learn, Export
// CSV), the five tabs, the search, and the list of the tab beside the panel of the record that is open, in a split view (as
// /users/customers and /orders). The controllers of `main` own the data (the lists D1 and the panels C); this owns what the person sees of
// it: the tab, the address (?tab, ?id, ?business, ?category, ?product), the record that is open, the search and the focus.

const SEARCH_WAIT_MS = 750 // the wait of main's lazy search box between typing and asking

const USER_TABS = { drivers: [4], customers: [3], professionals: [8] }

// The name the panel is called by, from the row of the list when there is one
const nameOfRow = (tab, row, t) => {
  if (tab === 'business' || tab === 'products') return row?.name || (tab === 'business' ? t('BUSINESS', 'Business') : t('PRODUCT', 'Product'))
  const person = [row?.name, row?.lastname].filter(Boolean).join(' ')
  return person || t('USER', 'User')
}

export const ReviewsListing = (props) => {
  const { isUseQuery } = props

  const initial = useReviewsQuery()
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [ordering] = useApi()

  const [tab, setTab] = useState(initial.tab ?? 'business')
  // The lists take the page and the size of the URL only on the first load; the first change the person makes ends that (as main)
  const firstRender = useRef(true)
  const frameRef = useRef(null)

  // ---- the record that is open: a row, or just an id (the panel loads it); a product has its category too ----
  const [open, setOpen] = useState(() => {
    if ((initial.tab ?? 'business') === 'products') {
      return initial.business != null && initial.category != null && initial.product != null
        ? { id: initial.product, categoryId: initial.category, row: null }
        : null
    }
    return initial.id != null ? { id: initial.id, row: null } : null
  })
  const [expanded, setExpanded] = useState(false)
  const openId = useRef(open?.id ?? null)
  openId.current = open?.id ?? null

  // ---- the business of Products: `storeId` drives the list; `store` ({ id, name }) is what the pill says ----
  const [storeId, setStoreId] = useState(() => ((initial.tab ?? 'business') === 'products' ? initial.business : null))
  const [store, setStore] = useState(null)
  const [restoring, setRestoring] = useState(storeId != null)
  const lookup = useRef(0) // a business chosen meanwhile wins over the answer about the one in the URL

  // ---- the search: one box for every tab, asked 750 ms after the last key ----
  const [searchText, setSearchText] = useState('')
  const [searchValue, setSearchValue] = useState(null)

  const [exportOpen, setExportOpen] = useState(false)

  // The first load adds `tab` and nothing else (RV-15)
  useEffect(() => {
    if (initial.tab == null) writeFirstTab(tab)
  }, [])

  // RV-11: the business of the URL has no name yet; it is asked once (a GET), and the pill says «Loading» meanwhile
  useEffect(() => {
    if (storeId == null) return undefined
    const token = ++lookup.current
    let current = true
    const settle = (name) => {
      if (!current || lookup.current !== token) return
      setStore({ id: storeId, name: name || `#${storeId}` })
      setRestoring(false)
    }
    ;(async () => {
      try {
        const { content } = await ordering.businesses(storeId).select(['name']).get()
        settle(content?.error ? null : content?.result?.name)
      } catch (error) {
        settle(null)
      }
    })()
    return () => { current = false }
  }, [])

  useEffect(() => {
    if (searchText === (searchValue ?? '')) return undefined
    const timer = setTimeout(() => setSearchValue(searchText), SEARCH_WAIT_MS)
    return () => clearTimeout(timer)
  }, [searchText])

  // ---- the record ----
  const closePanel = (options) => {
    const focus = options?.focus !== false
    if (openId.current == null) return
    const closedId = openId.current
    openId.current = null
    setOpen(null)
    setExpanded(false)
    if (tab === 'products') writeProduct(null)
    else writeRecord(null)
    if (focus) settleFocusOn(() => frameRef.current, closedId)
  }

  const openRow = (row) => {
    if (tab === 'products') {
      const categoryId = row.category?.id ?? null
      setOpen({ id: row.id, categoryId, row })
      writeProduct(row.id, categoryId)
      return
    }
    setOpen({ id: row.id, row })
    writeRecord(row.id)
  }

  const changeTab = (next) => {
    if (next === tab) return
    firstRender.current = false
    openId.current = null
    setOpen(null)
    setExpanded(false)
    setExportOpen(false)
    writeTab(next, storeId)
    setTab(next)
  }

  // RV-01: «Product reviews» of a business: Products, with that business and its products
  const openProducts = (business) => {
    if (!business?.id) return
    firstRender.current = false
    lookup.current++
    openId.current = null
    setOpen(null)
    setExpanded(false)
    setStoreId(business.id)
    setStore({ id: business.id, name: business.name || `#${business.id}` })
    setRestoring(false)
    setTab('products')
    writeProducts(business.id)
  }

  const chooseStore = (choice) => {
    if (choice?.id == null) return
    firstRender.current = false
    lookup.current++
    openId.current = null
    setOpen(null)
    setExpanded(false)
    setStoreId(choice.id)
    setStore({ id: choice.id, name: choice.name || `#${choice.id}` })
    setRestoring(false)
    writeStore(choice.id)
  }

  // ---- what the lists receive ----
  const page = isUseQuery && firstRender.current
  const paginationSettings = {
    initialPage: page ? initial.page : 1,
    pageSize: page ? initial.pageSize : 10,
    controlType: 'pages'
  }
  const listProps = {
    parentSearchValue: searchValue,
    isUseQuery,
    paginationSettings,
    activeId: open?.id,
    onOpenRow: openRow
  }
  const canExport = tab === 'business' || tab === 'drivers'

  let list
  if (tab === 'business') {
    list = <BusinessReviewList {...listProps} />
  } else if (USER_TABS[tab]) {
    list = <UsersReviewList key={tab} {...listProps} defaultUserTypesSelected={USER_TABS[tab]} />
  } else if (storeId != null) {
    list = (
      <ReviewProductsListing
        key={storeId}
        parentSearchValue={searchValue}
        businessId={storeId}
        isUseQuery={isUseQuery}
        defaultPage={paginationSettings.initialPage}
        defaultPageSize={paginationSettings.pageSize}
        firstRender={firstRender.current}
        activeId={open?.id}
        onOpenRow={openRow}
      />
    )
  } else {
    list = (
      <EmptyState
        className='odc-rv-empty'
        icon={Store}
        title={t('REVIEWS_CHOOSE_BUSINESS', 'Choose a business to see its product reviews')}
      />
    )
  }

  const learn = <LearnDropDown learnOptions={learnOptionsValues(['reviews_manager', 'reviews_details'], t)} />

  const listView = (
    <div ref={frameRef} className='odc-root odc-rv-frame'>
      <PageHeader
        className='odc-rv-pagehead'
        leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
        title={t('REVIEWS_MANAGER', 'Reviews manager')}
        learn={learn}
        actions={canExport
          ? (
            <Button
              className='odc-rv-export-button'
              icon={Download}
              title={t('REVIEWS_EXPORT_CSV', 'Export CSV')}
              onClick={() => setExportOpen(true)}
            >
              <span data-collapse-label=''>{t('REVIEWS_EXPORT_CSV', 'Export CSV')}</span>
            </Button>
            )
          : undefined}
      />
      <Tabs
        wrap
        label={t('REVIEWS_TABS', 'Reviews of')}
        value={tab}
        onValueChange={changeTab}
        items={[
          { value: 'business', label: t('BUSINESS', 'Business') },
          { value: 'drivers', label: t('DRIVERS', 'Drivers') },
          { value: 'customers', label: t('CUSTOMERS', 'Customers') },
          { value: 'professionals', label: t('PROFESSIONALS', 'Professionals') },
          { value: 'products', label: t('PRODUCTS', 'Products') }
        ]}
      />
      <FilterBar
        flush
        className='odc-rv-bar'
        label={t('FILTERS', 'Filters')}
        search={(
          <SearchField
            value={searchText}
            onChange={setSearchText}
            label={t('SEARCH', 'Search')}
            placeholder={t('SEARCH', 'Search')}
            clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          />
        )}
        filters={tab === 'products'
          ? (
            <StorePicker
              business={{ selected: store, select: chooseStore, restoring }}
              includeInactive
              defaultOpen={storeId == null}
            />
            )
          : undefined}
      />
      {list}
    </div>
  )

  let panel = null
  if (open) {
    if (tab === 'business') {
      panel = (
        <BusinessReviewDetails
          key={open.id}
          business={open.row}
          businessId={open.id}
          onClose={closePanel}
          expanded={expanded}
          onExpandedChange={setExpanded}
          onOpenProducts={openProducts}
        />
      )
    } else if (tab === 'products') {
      panel = (
        <ProductReviewDetails
          key={open.id}
          businessId={storeId}
          product={open.row}
          productId={open.id}
          categoryId={open.categoryId}
          onClose={closePanel}
        />
      )
    } else {
      panel = (
        <UserReviewDetails
          key={`${tab}-${open.id}`}
          userId={open.id}
          user={open.row}
          onClose={closePanel}
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      )
    }
  }

  return (
    <>
      <SplitView
        className='odc-rv-split'
        list={listView}
        panel={panel}
        open={Boolean(open)}
        expanded={expanded && tab !== 'products'}
        panelLabel={nameOfRow(tab, open?.row, t)}
        resizeLabel={t('REVIEWS_RESIZE_PANEL', 'Resize the reviews panel')}
        storageKey='od.reviews.panel'
        onClose={closePanel}
      />
      <ReviewsExport open={exportOpen && canExport} onOpenChange={setExportOpen} tab={tab} />
    </>
  )
}
