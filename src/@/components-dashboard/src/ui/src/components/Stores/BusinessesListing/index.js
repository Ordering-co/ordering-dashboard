import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useLanguage, useEvent, DashboardBusinessList as BusinessListController, useConfig, useSession } from '../../../../../index'
import { getStorageItem, setStorageItem, removeQueryToUrl, addQueryToUrl } from '../../../utils'
import { LISTING_SEARCH_PARAM, sanitizeListingSearch } from '../../../../../utils/commandPaletteHandoff'
import { canRegisterStores } from '../../../../../utils/storeAdd'
import { Button, Dialog } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useListingSearchSeed } from '../../../hooks/useListingSearchSeed'
import { useTheme } from 'styled-components'

import { StoresHeader } from '../StoresList/StoresHeader'
import { StoresFilters } from '../StoresList/StoresFilters'
import { StoresBulkBar, selectAllTarget } from '../StoresList/StoresBulkBar'
import { StoresTable } from '../StoresList/StoresTable'
import { hasActiveFilters } from '../StoresList/storesListModel'
import { StoresColumnsTool, useStoresColumns } from '../StoresList/useStoresColumns'
import { BusinessDetails } from '../BusinessDetails'
import { WizardBusiness } from '../WizardBusiness'

import { BusinessListingContainer } from './styles'
import { BusinessSyncSheet } from '../BusinessSync'
import './businesses-listing.css'

// (T10, decision X-1): from this window width the Overview panel (`base`, 500px) docks beside the list, which makes room
// for it, so the table narrows as in Orders, Customers, Drivers and Groups. Below it, and with a section (`wide`, the strip of the
// list) or `full` (modal), the panel stays over the list as stores-list decision 1 set.
export const EDITOR_DOCK_FROM = 1280

// redesign stores 3.A, P-2: the fields the list asks the API for, which are the controller's own default
// (DashboardBusinessList defaultProps.propsToFetch) plus `schedule` for «open now» (3.B); measured +16 % (10 rows) / +21 % (34 rows),
// analysis §3. The EatStreet backoffice path keeps its own list of fields in the controller and is not touched.
const PROPS_TO_FETCH = ['disabled_reason', 'id', 'alcohol', 'city', 'delivery_price', 'distance', 'delivery_time', 'ribbon', 'enabled', 'featured', 'food', 'groceries', 'header', 'laundry', 'logo', 'minimum', 'name', 'pickup_time', 'slug', 'reviews', 'schedule']

// redesign SL-F1 (A3): the list of /stores/list composes the Product pieces of Stores/StoresList (header, filters, selection bar,
// table / cards) and keeps, mounted where they were and with the same behaviour, the editor (BusinessDetails), the Sync sheet
// (BusinessSyncSheet, redesign stores 3.D), the tutorial (WizardBusiness) and the "no stores" modal.
const BusinessesListingUI = (props) => {
  const {
    businessList,
    pagination,
    searchValue,
    selectedBusinessActiveState,
    handleChangeBusinessActiveState,
    handleChangeBusinessType,
    loadMoreBusinesses,
    handleSucessRemoveBusiness,
    handleSucessAddBusiness,
    handleSucessUpdateBusiness,
    loadBusinesses,
    onSearch,
    onBusinessRedirect,
    getPageBusinesses,
    businessIds,
    handleChangeBusinessIds,
    handleEnableAllBusiness,
    handleDeleteMultiBusinesses,
    setBusinessIds,
    countriesState,
    handleChangeFilterValues,
    filterValues,
    businessTypeSelected,
    inActiveBusinesses,
    citiesList,
    isUseQuery,
    isEatstreetProject,
    isGoogleRedirectPluginActive,
    googleRedirectPluginLoading,
    googleRedirectPluginRoot,
    googleFeedSecondaryIncludedIds,
    googleFeedInclusionListLoading,
    googleFeedSavingBusinessId,
    googleFeedSavingChannel,
    handleGoogleFeedToggle,
    googleFeedExcludedBusinessIds
  } = props

  const location = useLocation()
  const history = useHistory()
  const query = new URLSearchParams(location.search)
  const theme = useTheme()
  const [, t] = useLanguage()
  const [events] = useEvent()
  const [{ configs }] = useConfig()
  const [{ user }] = useSession()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const isPhone = useIsPhone()

  // redesign stores 3.A, P-5: `?q=` from the command palette goes through the list search (name, email and
  // phone), once per navigation; the hook takes `q` out of the address
  const searchSeed = useListingSearchSeed({ enabled: !!isUseQuery })
  useEffect(() => {
    if (searchSeed) onSearch(searchSeed.value)
  }, [searchSeed?.key])

  // redesign stores 3.A, S5: the type on screen is also in the address (`?type=`); null (All types) takes it out
  const handleChangeType = (id) => {
    handleChangeBusinessType(id)
    if (!isUseQuery) return
    if (id === null || id === undefined) removeQueryToUrl(['type'])
    else addQueryToUrl({ type: id })
  }

  // the store of the tutorial is created on /stores/add, which comes back here with it. Opening hours and payment
  // methods are already part of the add, so the tutorial goes on with the category.
  const tutorialBusiness = location.state?.tutorialBusiness
  const [isTutorialMode, setIsTutorialMode] = useState(Boolean(tutorialBusiness))
  const [openTutorialSidebarState, setOpenTutorialSidebarState] = useState(tutorialBusiness ? 'new_category' : null)

  const [viewMethod, setViewMethod] = useState('list')
  // redesign stores 3.B: the columns of the table, chosen from the filter bar (list view, not on a phone, as before)
  const { columns, setColumns } = useStoresColumns()
  const [openBusinessDetails, setOpenBusinessDetails] = useState(false)
  const [editorSize, setEditorSize] = useState(null) // the width state the editor reports (base · wide · full)
  const { width: windowWidth } = useWindowSize()
  const editorDocked = openBusinessDetails && editorSize === 'base' && windowWidth >= EDITOR_DOCK_FROM
  const [isNoBusinessesModal, setNoBusinessesModal] = useState(false)
  const [detailsBusiness, setDetailsBusiness] = useState(tutorialBusiness ?? null)
  const [detailsBusinessId, setDetailsBusinessId] = useState(null)
  const [businessTypes, setBusinessTypes] = useState([])
  const [openSync, setOpenSync] = useState(false)
  // bugs E: the one rule of the dashboard (⌘K, /stores/add, the editor's Duplicate)
  const allowBusinessRegister = canRegisterStores(user, configs)

  const noBusinesses = useMemo(() => {
    return !businessList?.loading &&
      businessList?.businesses?.length === 0 &&
      pagination?.currentPage === 1 &&
      !searchValue &&
      (!filterValues || Object.keys(filterValues).length === 0) &&
      selectedBusinessActiveState &&
      !businessTypeSelected &&
      inActiveBusinesses.businesses?.length === 0
  }, [businessList?.loading, businessList?.businesses, pagination, searchValue, filterValues, selectedBusinessActiveState, businessTypeSelected, inActiveBusinesses])

  // a failed load leaves an empty list (so `noBusinesses` is true), but that is not «no stores»: the tabs and the type
  // pill stay next to the error. `noBusinesses` itself is unchanged (it still gates the tutorial dialog and the column manager); the
  // head gets `noBusinesses && !loadFailed`, so keeps its actions too.
  const loadFailed = Boolean(businessList?.error)

  // a search, a filter or a type is on: an empty list is then «nothing matches», and «Clear filters» of the empty state
  // clears the three (the bar's own «Clear filters» does the same)
  const searching = Boolean(searchValue)
  const hasTypeOn = businessTypeSelected !== null && businessTypeSelected !== undefined
  const filtered = searching || hasActiveFilters(filterValues) || hasTypeOn
  const handleClearFilters = () => {
    if (searching) onSearch?.('')
    if (hasActiveFilters(filterValues)) handleChangeFilterValues?.({})
    if (hasTypeOn) handleChangeType(null)
  }

  // redesign stores 2.A (review F3-R3): the add page takes the editor away, so it asks it first.
  // redesign (D2, Tiendas decision 9 A): «Add new store» always opens the add page, with the Google business search at
  // the top of it (since main's, for every project).
  const handleGotToAdd = () => {
    leaveEditor(() => events.emit('go_to_page', { page: 'business_add' }))
  }

  const handleBackRedirect = () => {
    setOpenBusinessDetails(false)
    setDetailsBusiness(null)
    setDetailsBusinessId(null)
    onBusinessRedirect()
  }

  // redesign stores 2.A (decision 4): opening another store, «Add store» and ⌘K take the editor away, so they ask it
  // first (S/BusinessDetails `leaveGuardRef`): with unsaved changes it asks «Save and continue · Discard · Keep editing», with
  // none it goes at once. `onCancel` runs when the user keeps editing.
  const editorLeaveRef = useRef(null)
  // redesign bugs F row 20 (R-05): where the focus goes when the selection bar goes away (StoresBulkBar's selectAllTarget)
  const listingRef = useRef(null)
  // redesign tanda AB (): docked, the editor starts at the bottom edge of the page header (P/PageHeader of
  // StoresHeader) instead of y = 0, so opening or closing it never moves the header. The list measures that edge and hands it to the
  // editor as `dockTop` (a number of px, null when it is not docked). It is watched while docked: the header grows when its actions
  // load or wrap, the window resizes, and the page may scroll under the fixed panel.
  const [dockTop, setDockTop] = useState(null)
  useLayoutEffect(() => {
    if (!editorDocked) {
      setDockTop(null)
      return undefined
    }
    const head = listingRef.current?.querySelector('.odc-sl-head > .odc-pagehead')
    if (!head) {
      setDockTop(null)
      return undefined
    }
    const measure = () => setDockTop(Math.max(0, Math.round(head.getBoundingClientRect().bottom)))
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(head)
    if (observer && listingRef.current) observer.observe(listingRef.current)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { capture: true, passive: true })
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, { capture: true })
    }
  }, [editorDocked, windowWidth])
  const selectionFocus = () => selectAllTarget(listingRef.current)
  const leaveEditor = (go, onCancel) => {
    const editor = openBusinessDetails ? editorLeaveRef.current : null
    if (editor) editor.requestLeave(go, onCancel)
    else go()
  }

  const handleOpenBusinessDetails = (business) => {
    const go = () => {
      setDetailsBusiness(business)
      setDetailsBusinessId(business.id)
      setOpenBusinessDetails(true)
      onBusinessRedirect(business.id)
    }
    if (openBusinessDetails && String(business.id) !== String(detailsBusinessId)) leaveEditor(go)
    else go()
  }

  // «Add your first store» of the tutorial. The add page brings the created store back (`tutorialBusiness`).
  const handleOpenAddBusiness = () => {
    leaveEditor(() => events.emit('go_to_page', { page: 'business_add', state: { continueTutorial: true } }))
  }

  // the steps read the store they get, so what a step saved (the category the product step needs) has to reach it
  const handleTutorialUpdateBusiness = (business) => {
    setDetailsBusiness(current => ({ ...current, ...business }))
    handleSucessUpdateBusiness(business)
  }

  useEffect(() => {
    // redesign SL-F1 (A3), SL-04: a load that failed looks like an empty list; it must not say "no stores"
    if (businessList?.loading || businessList?.error || !noBusinesses || inActiveBusinesses?.businesses.length !== 0 || inActiveBusinesses.loading) return
    if (businessList?.businesses.length === 0 && inActiveBusinesses?.businesses.length === 0) {
      setNoBusinessesModal(true)
    }
  }, [businessList?.loading, businessList?.error, inActiveBusinesses.loading])

  useEffect(() => {
    const id = query.get('id')
    if (id === null) setOpenBusinessDetails(false)
    else {
      setDetailsBusinessId(id)
      setOpenBusinessDetails(true)
    }
  }, [])

  // redesign stores 1.C, G1-25: the address is also followed while the list is on screen. A navigation of the router
  // (⌘K, Mia: `location.key` is new on each one) to `?id=` opens the editor or moves it to that store, and one without `?id=`
  // closes it. The same store again is left alone: the editor follows `?section=` by itself (S/BusinessDetails). Opening a store
  // from a row writes the address with addQueryToUrl, which does not reach the router, so it never comes through here.
  const followedLocation = useRef(location.key)
  useEffect(() => {
    if (followedLocation.current === location.key) return // the mount: the effect above read the address
    followedLocation.current = location.key
    const params = new URLSearchParams(location.search)
    // the list stays as it was, so the address keeps saying so: the destination brings only the store (`?id=&section=`)
    if (isUseQuery) {
      const kept = {}
      if (!params.has('active')) kept.active = selectedBusinessActiveState
      if (viewMethod === 'list' && !params.has('page') && pagination?.currentPage && pagination?.pageSize && pagination?.total) {
        kept.page = pagination.currentPage
        kept.pageSize = pagination.pageSize
      }
      // redesign bugs F row 22, F5: the type filter stays on screen, so it stays in the address too
      if (!params.has('type') && businessTypeSelected != null) kept.type = businessTypeSelected
      if (Object.keys(kept).length) addQueryToUrl(kept)
    }
    const id = params.get('id')
    // redesign stores 2.A: keeping editing puts the open store back in the address (the editor puts back its section)
    const keepStoreInAddress = () => addQueryToUrl({ id: detailsBusinessId })
    if (id === null) {
      if (!openBusinessDetails) return
      leaveEditor(() => {
        setOpenBusinessDetails(false)
        setDetailsBusiness(null)
        setDetailsBusinessId(null)
      }, keepStoreInAddress)
      return
    }
    if (openBusinessDetails && String(id) === String(detailsBusinessId)) return
    const go = () => {
      // what a remount used to close goes away too, so nothing covers the editor
      if (openSync && params.get('header') !== 'sync') {
        setOpenSync(false)
      }
      setDetailsBusinessId(id)
      setOpenBusinessDetails(true)
    }
    if (openBusinessDetails) leaveEditor(go, keepStoreInAddress)
    else go()
  }, [location.key])

  // the tutorial was picked up above; a reload of this page must not start it again. After the effect above, which
  // has to see this mount as the mount: the address does not change, so there is nothing for it to follow.
  useEffect(() => {
    if (!tutorialBusiness) return
    history.replace({ ...location, state: undefined })
    followedLocation.current = history.location.key
  }, [])

  const handleSetStorage = async () => {
    const preVisited = await getStorageItem('visited', true)
    if (!preVisited?.businesses_page) {
      const visited = {
        ...preVisited,
        businesses_page: true
      }
      await setStorageItem('visited', visited, true)
      setIsTutorialMode(true)
    }
  }

  const handleViewMethod = (method) => {
    setViewMethod(method)
    if (method === 'list') {
      getPageBusinesses(10, 1)
    }
    if (method === 'card') {
      getPageBusinesses(50, 1)
      removeQueryToUrl(['page', 'pageSize'])
    }
  }

  // owner decision 35 (batch AE): a phone has no List / Card switch (its table draws cards in both views). A Card view left from a
  // wider window goes back to List, once: the effect only acts when the window is a phone and the view is still 'card'.
  useEffect(() => {
    if (isPhone && viewMethod === 'card') handleViewMethod('list')
  }, [isPhone, viewMethod])

  const handleCloseSync = () => {
    setOpenSync(false)
    removeQueryToUrl(['header', 'tab'])
  }

  useEffect(() => {
    handleSetStorage()
  }, [])

  useEffect(() => {
    const header = query.get('header')
    if (header === 'sync') {
      setOpenSync(true)
    }
  }, [])

  return (
    <>
      <BusinessListingContainer ref={listingRef} className='odc-stores-listing' data-editor-docked={editorDocked ? '' : undefined} isPhone={isPhone}>
        <StoresHeader
          handleRefreshBusinesses={loadBusinesses}
          handleGotToAdd={handleGotToAdd}
          loading={businessList.loading}
          // a failed load is not a project without stores, so the head keeps Sync, Refresh and Add new store (tabs and view
          // switch as well); the failed list is told by the error that takes the table's place
          noBusinesses={noBusinesses && !loadFailed}
          loadFailed={loadFailed}
          allowBusinessRegister={allowBusinessRegister}
          pagination={pagination}
          selectedBusinessActiveState={selectedBusinessActiveState}
          handleChangeBusinessActiveState={handleChangeBusinessActiveState}
          isUseQuery={isUseQuery}
          viewMethod={viewMethod}
          handleViewMethod={handleViewMethod}
          onOpenMenu={isCollapse ? () => handleMenuCollapse(false) : undefined}
          isPhone={isPhone}
        />
        <StoresFilters
          searchValue={searchValue}
          onSearch={onSearch}
          filterValues={filterValues}
          handleChangeFilterValues={handleChangeFilterValues}
          noBusinesses={noBusinesses}
          loadFailed={loadFailed}
          businessTypes={props.businessTypes}
          businessTypeSelected={businessTypeSelected}
          handleChangeBusinessType={handleChangeType}
          setBusinessTypes={setBusinessTypes}
          citiesList={citiesList}
          // redesign stores 1.C, G1-05: City says «Loading» while GET /countries has not answered
          citiesLoading={Boolean(countriesState?.loading)}
          // not over a load that failed with nothing to show: the error takes the place of the table (review r1 #5)
          tools={viewMethod === 'list' && !isPhone && !noBusinesses && !(businessList?.error && !businessList?.loading && !businessList?.businesses?.length)
            ? <StoresColumnsTool columns={columns} setColumns={setColumns} isEatstreetProject={isEatstreetProject} />
            : undefined}
        />
        <StoresBulkBar
          businessIds={businessIds}
          businessList={businessList}
          setBusinessIds={setBusinessIds}
          handleEnableAllBusiness={handleEnableAllBusiness}
          handleDeleteMultiBusinesses={handleDeleteMultiBusinesses}
          fallbackFocus={selectionFocus}
        />
        <StoresTable
          viewMethod={viewMethod}
          businessList={businessList}
          pagination={pagination}
          detailsBusinessId={detailsBusinessId}
          loadMoreBusinesses={loadMoreBusinesses}
          getPageBusinesses={getPageBusinesses}
          loadBusinesses={loadBusinesses}
          handleSucessRemoveBusiness={handleSucessRemoveBusiness}
          handleSucessAddBusiness={handleSucessAddBusiness}
          handleSucessUpdateBusiness={handleSucessUpdateBusiness}
          handleOpenBusinessDetails={handleOpenBusinessDetails}
          handleOpenAddBusiness={handleOpenAddBusiness}
          isTutorialMode={isTutorialMode}
          businessIds={businessIds}
          setBusinessIds={setBusinessIds}
          handleChangeBusinessIds={handleChangeBusinessIds}
          selectedBusinessActiveState={selectedBusinessActiveState}
          citiesList={citiesList}
          isUseQuery={isUseQuery && viewMethod === 'list'}
          allowBusinessRegister={allowBusinessRegister}
          isEatstreetProject={isEatstreetProject}
          columns={columns}
          filtered={filtered}
          onClearFilters={handleClearFilters}
        />
      </BusinessListingContainer>
      {openBusinessDetails && (
        <BusinessDetails
          open={openBusinessDetails}
          // business={detailsBusiness}
          businessTypes={businessTypes}
          businessId={detailsBusinessId}
          handleSucessAddBusiness={handleSucessAddBusiness}
          handleSucessRemoveBusiness={handleSucessRemoveBusiness}
          handleSucessUpdateBusiness={handleSucessUpdateBusiness}
          setBusinessTypes={setBusinessTypes}
          onClose={() => handleBackRedirect()}
          leaveGuardRef={editorLeaveRef}
          onPanelSizeChange={setEditorSize}
          // redesign tanda AB (): where the docked panel starts (the bottom edge of the page header), null otherwise
          dockTop={editorDocked ? dockTop : null}
          isGoogleRedirectPluginActive={isGoogleRedirectPluginActive}
          googleRedirectPluginLoading={googleRedirectPluginLoading}
          googleRedirectPluginRoot={googleRedirectPluginRoot}
          googleFeedSecondaryIncludedIds={googleFeedSecondaryIncludedIds}
          googleFeedInclusionListLoading={googleFeedInclusionListLoading}
          googleFeedSavingBusinessId={googleFeedSavingBusinessId}
          googleFeedSavingChannel={googleFeedSavingChannel}
          handleGoogleFeedToggle={handleGoogleFeedToggle}
          googleFeedExcludedBusinessIds={googleFeedExcludedBusinessIds}
        />
      )}
      {/* redesign stores 3.D: mounted only while open, so each opening reads ?tab= again, as before */}
      {openSync && (
        <BusinessSyncSheet open={openSync} onClose={handleCloseSync} />
      )}

      <WizardBusiness
        isTutorialMode={isTutorialMode}
        openTutorialSidebarState={openTutorialSidebarState}
        setOpenTutorialSidebarState={setOpenTutorialSidebarState}
        business={detailsBusiness}
        handleSucessUpdateBusiness={handleTutorialUpdateBusiness}
      />
      {/* redesign the «no stores» dialog on Product, same condition, same picture and same action */}
      <Dialog
        open={isNoBusinessesModal && noBusinesses && !businessList?.error}
        onOpenChange={(open) => { if (!open) setNoBusinessesModal(false) }}
        title={t('STORE_ADD_NO_STORES_TITLE', 'You have no stores yet')}
        closeLabel={t('CLOSE', 'Close')}
        size='sm'
        footer={allowBusinessRegister
          ? <Button variant='primary' onClick={() => { setNoBusinessesModal(false); handleGotToAdd() }}>{t('ADD_NEW_STORE', 'Add new store')}</Button>
          : null}
      >
        <img className='odc-stores-empty-picture' src={theme.images.dummies.noBusinesses} alt='' />
      </Dialog>
    </>
  )
}

export const BusinessesListing = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const defaultActive = query.get('active')
  // redesign stores 3.A, S5: `?type=` starts the list filtered by that business type (a number when numeric)
  const typeParam = props.isUseQuery ? query.get('type') : null
  // review F2: 0 or less is not a type id (the controller reads 0 as «no type»), so it starts with none
  const defaultBusinessType = !typeParam ? undefined : (isNaN(typeParam) ? typeParam : (Number(typeParam) > 0 ? Number(typeParam) : undefined))
  // redesign bugs F row 22, F3: `?q=` starts the list searching, so the first request already carries it; the hook of
  // the page keeps serving the ⌘K that comes while the list is on screen (same value again does not ask again)
  const defaultSearchValue = (props.isUseQuery && sanitizeListingSearch(query.get(LISTING_SEARCH_PARAM))) || undefined

  const businessListingProps = {
    ...props,
    UIComponent: BusinessesListingUI,
    asDashboard: true,
    isSearchByBusinessName: true,
    isSearchByBusinessEmail: true,
    isSearchByBusinessPhone: true,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    },
    defaultActive: defaultActive ? defaultActive === 'true' : true,
    defaultBusinessType,
    defaultSearchValue,
    propsToFetch: PROPS_TO_FETCH,
    fetchGoogleRedirectPlugin: true,
    // redesign bugs F row 17: only this page reads the inactive probe (the «no stores» dialog) and the countries (cities)
    fetchInactiveProbe: true,
    fetchCountries: true
  }
  return (
    <BusinessListController {...businessListingProps} />
  )
}
