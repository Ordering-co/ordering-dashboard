import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PosMenuBusinessList as BusinessListController, useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { addQueryToUrl, getStorageItem, removeQueryToUrl, setStorageItem } from '../../../utils'
import { settleFocusOn } from '../../../utils/listFocus'
import { Button, IconButton, ListPopover, PageHeader, Pagination, SearchField, SplitView, Tabs } from '../../Shared/Product'
import { CircleHelp, Megaphone, Menu as MenuIcon, RefreshCw } from '../../Shared/Icon'
import { InfoHelpBox } from '../InfoHelpBox'
import { ImporterStorePanel } from '../Importers/ImporterStorePanel'
import { connectKind } from './connectKinds'
import { PosMenuTable } from './PosMenuTable'
import { PosStorePanel } from './PosStorePanel'
import './pos-menu.css'

// redesign PM-D (decisions D1, D6, D7): the shell of /connect/pos-menu. A page header (title, store count, Learn, Refresh), the
// Active / Inactive tabs, the search, the table of stores (PosMenuTable) and its foot, beside the store panel (PosStorePanel) in a
// split view (as /users/business-owners). The controller (PosMenuBusinessList) owns the data and PosMenuBusinessDetails (inside the
// panel) the store; this owns what the person sees of it: the URL (?id, ?section, ?active, ?page, ?pageSize), the store that is open,
// the wait of the search and the focus. No request of its own: every handler is the controller's, with the arguments main used.

const PAGE_SIZES = [10, 25, 50]

// The wait before the search text reaches the controller: each change of it is a request of the list (SearchBar lazyLoad: 750 ms)
const SEARCH_DEBOUNCE_MS = 750

// The help of the header: the same data BusinessesListingHeader gives InfoHelpBox on main
const SUPPORT_ARTICLE_URL = 'https://docs.ordering.co/docs/products/dashboard/help-community-ai-agents/'

// «_total_» → a node: the number becomes an .odc-figure node (decision 11) and keeps its direction in RTL
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

const PosMenuUI = (props) => {
  const {
    businessList,
    integrationsList,
    pagination,
    searchValue,
    selectedBusinessActiveState,
    handleChangeBusinessActiveState,
    handleSucessUpdateBusiness,
    installingPluginRoot,
    handleInstallPosIntegration,
    checkingPluginRoot,
    handleCheckPluginInstall,
    getIntegrations,
    loadBusinesses,
    refreshBusinesses,
    onSearch,
    onBusinessRedirect,
    getPageBusinesses,
    filterValues,
    businessTypeSelected,
    channelFilterSelected,
    handleChangeChannelFilter,
    salesChannelsFilterEnabled,
    inActiveBusinesses,
    citiesList,
    isUseQuery,
    kind
  } = props

  const [, t] = useLanguage()
  // redesign SC-B: the same shell serves /connect/sales-channels; `kind` (from the page, through the controller) picks the
  // words, the table, the panel and the width key. With no kind it is /connect/pos-menu.
  const { kind: kindName, storageKey } = connectKind(kind)
  const isSalesChannel = kindName === 'sales_channel'
  // redesign IM-A: /connect/importers is the same shell with the kind `importer` (its own words, panel and ?id= rule)
  const isImporter = kindName === 'importer'
  const title = isImporter
    ? t('CONNECT_IMPORTERS', 'Importers')
    : isSalesChannel ? t('SALES_CHANNELS_TITLE', 'Sales channels') : t('POS_MENU_SYNC_TITLE', 'POS & menu sync') // and sentence case, new keys (the live catalog overrides POS_MENU_SYNC and SALES_CHANNELS)
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const location = useLocation()
  const urlQuery = new URLSearchParams(location.search)

  const businesses = businessList?.businesses ?? []
  const loading = !!businessList?.loading
  const total = pagination?.total
  const totalKnown = total != null && Number.isFinite(Number(total))

  // main's condition (PosMenu:56-65): the project has no stores at all. The table shows its empty state and neither the tabs nor
  // Refresh are drawn.
  const noBusinesses = useMemo(() => {
    return !businessList?.loading &&
      businessList?.businesses?.length === 0 &&
      pagination?.currentPage === 1 &&
      !searchValue &&
      (!filterValues || Object.keys(filterValues).length === 0) &&
      selectedBusinessActiveState &&
      !businessTypeSelected &&
      inActiveBusinesses?.businesses?.length === 0
  }, [businessList?.loading, businessList?.businesses, pagination, searchValue, filterValues, selectedBusinessActiveState, businessTypeSelected, inActiveBusinesses])

  // ---- the store that is open: a row, or just an id (the panel asks for it, R3). `section` is the ?section= the address brought ----
  const [open, setOpen] = useState(() => {
    const id = urlQuery.get('id')
    return id === null ? null : { id, row: null, section: isImporter ? null : urlQuery.get('section') } // an importer has no ?section=
  })
  const [expanded, setExpanded] = useState(false)
  const [help, setHelp] = useState({ open: false, data: null })
  // main #399: Refresh keeps the page (the last one if the list shrank), reads the integrations again and the open store too
  const [refreshSignal, setRefreshSignal] = useState(0)
  const handleRefresh = () => {
    refreshBusinesses()
    setRefreshSignal(signal => signal + 1)
  }
  const openId = useRef(null)
  openId.current = open?.id ?? null
  const frameRef = useRef(null)

  const listRow = open ? businesses.find(business => String(business.id) === String(open.id)) : undefined
  const shownRow = listRow ?? open?.row ?? null

  const closePanel = () => {
    if (openId.current == null) return // already closed
    const closedId = openId.current
    openId.current = null
    setOpen(null)
    setExpanded(false)
    onBusinessRedirect?.() // clears ?id=, ?section= and the rest, as main
    settleFocusOn(() => frameRef.current, closedId)
  }

  // redesign IM-A (decision D2): an importer opens by ?id= as main did (Importers/index.js:62-104) and asks for no store. The
  // panel waits for the list; once the store is in it the row is kept (as main kept detailsBusiness, so a page change does not close it);
  // if the list is done and the store is not in the page, the panel closes and ?id= goes. pos and sales_channel ask for the store.
  // redesign IM-R1-1 (review r1 #1): the controller's first render is an empty list that is not loading yet. Until the list
  // has answered (it loaded, or it has rows) an unknown ?id= is not a store that is missing: it is a list that has not arrived.
  const listAnswered = useRef(false)
  if (loading || businesses.length) listAnswered.current = true
  useEffect(() => {
    if (!isImporter || !open || loading || !listAnswered.current) return
    if (listRow) {
      if (open.row !== listRow) setOpen(previous => (previous && String(previous.id) === String(listRow.id) ? { ...previous, row: listRow } : previous))
      return
    }
    if (!open.row) {
      // closed on load, not by the person: nothing was open, so the focus is not taken to the list
      openId.current = null
      setOpen(null)
      setExpanded(false)
      onBusinessRedirect?.()
    }
  }, [isImporter, open, loading, listRow])

  const handleOpenBusinessDetails = (business) => {
    setOpen({ id: business.id, row: business, section: null })
    onBusinessRedirect?.(business.id)
  }

  // ?section= is read once, when the page opens from the address (open.section); the panel reports its own changes
  const handleSectionChange = (section) => {
    if (section) {
      addQueryToUrl({ section })
    } else {
      removeQueryToUrl(['section'])
      setOpen(previous => (previous ? { ...previous, section: null } : previous))
    }
  }

  const handleSetStorage = async () => {
    const preVisited = await getStorageItem('visited', true)
    if (!preVisited?.businesses_page) {
      const visited = {
        ...preVisited,
        businesses_page: true
      }
      await setStorageItem('visited', visited, true)
    }
  }

  useEffect(() => {
    handleSetStorage()
  }, [])

  // ---- Active / Inactive (BusinessActiveStateFilter): the tab goes to the controller and to ?active= ----
  const activeTab = selectedBusinessActiveState ? 'active' : 'inactive'
  const handleTab = (next) => {
    if (next === activeTab) return // the tab that is already selected does nothing
    const active = next === 'active'
    handleChangeBusinessActiveState(active)
    addQueryToUrl({ active })
  }

  const urlActive = urlQuery.get('active')
  useEffect(() => {
    if (!isUseQuery) return
    if (urlActive) {
      handleChangeBusinessActiveState(urlActive === 'true')
      return
    }
    addQueryToUrl({ active: 'true' })
  }, [])

  // ---- the URL: ?page and ?pageSize after each load (BusinessesList:120-126) ----
  useEffect(() => {
    if (!isUseQuery || !pagination?.currentPage || !pagination?.pageSize || !pagination?.total) return
    addQueryToUrl({
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    })
  }, [isUseQuery, pagination?.currentPage, pagination?.pageSize, pagination?.total])

  // ---- search: typed here, sent after a wait (at once on Enter or on clear). A value set from outside shows unless the person is typing ----
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
  const clearSearch = () => {
    setSearchText('')
    sendSearch('')
  }

  // ---- header ----
  const countLabel = Number(total) === 1
    ? t('POS_MENU_STORE_COUNT_ONE', '1 store')
    : t('POS_MENU_STORE_COUNT_OTHER', '_count_ stores').replace('_count_', () => String(total))

  const openHelp = () => setHelp({
    open: true,
    data: {
      name: title,
      // redesign IM-01 (D5): main described the sync with a POS here; an importer says what importing a menu is
      description: isImporter
        ? t('IMPORTERS_HELP_DESCRIPTION', 'Open a store and choose where its menu comes from: paste the DoorDash, Uber Eats or Ordering.co store link, or enter your GloriaFood keys. The menu is imported into that store, and the Logs tab keeps the source files of the last imports so you can download them. For more info, please contact our Support team')
        // Sales channels fell to the POS text below; it says what the page does with a marketplace
        : isSalesChannel
          ? t('SALES_CHANNELS_HELP_DESCRIPTION', 'Open a store and connect it to the marketplaces that sell it: enter the store ID that each channel uses and turn the channel on or off. Push the menu of the store to a channel from its card. For more info, please contact our Support team')
          : t('INTEGRATION_DESCRIPTION', 'Connect with any of our available integrations with a few steps. Open the store where you want to connect your POS to our system. Configure the integration settings with your own keys and sync your products and stores to your POS or to our dashboard. For more info, please contact our Support team'),
      more_info: SUPPORT_ARTICLE_URL
    }
  })

  // ---- the Channel filter (/connect/sales-channels): only the sales
  // channels already loaded for the table (integrationsList). Picking one reloads the list from page 1 (handleChangeChannelFilter,
  // as the Type pill of /stores/list does) and the choice is kept in ?channel=.
  const channelItems = (integrationsList?.thirdPartyIntegrations ?? []).map(integration => ({
    id: integration.id,
    name: integration.name || t('SALES_CHANNELS_UNNAMED', 'Sales channel')
  }))
  const handleChannelFilterChange = (channelId) => {
    handleChangeChannelFilter?.(channelId)
    if (!isUseQuery) return
    if (channelId == null) removeQueryToUrl(['channel'])
    else addQueryToUrl({ channel: channelId })
  }
  // a ?channel= no longer in the catalog still filters, so the pill stays to let «All channels» clear it
  const channelFilter = isSalesChannel && salesChannelsFilterEnabled && (channelItems.length > 0 || integrationsList?.loading || integrationsList?.error || channelFilterSelected != null) && (
    <ListPopover
      icon={Megaphone}
      label={t('CHANNEL', 'Channel')}
      items={channelItems}
      value={channelFilterSelected}
      onChange={handleChannelFilterChange}
      loading={Boolean(integrationsList?.loading)}
      error={Boolean(integrationsList?.error)}
      onRetry={getIntegrations}
      allLabel={t('SALES_CHANNELS_FILTER_ALL_CHANNELS', 'All channels')}
      searchLabel={t('SEARCH', 'Search')}
      clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
      noResultsLabel={t('NO_RESULTS_FOUND', 'No results found')}
      loadingLabel={`${t('LOADING', 'Loading')}...`}
      errorLabel={t('SALES_CHANNELS_INTEGRATIONS_ERROR', "The sales channel list couldn't load.")}
      retryLabel={t('RETRY', 'Retry')}
    />
  )

  const listView = (
    <div ref={frameRef} className='odc-root odc-pm-frame'>
      <PageHeader
        className='odc-pm-head'
        title={title}
        count={totalKnown ? Number(total) : undefined}
        countLabel={totalKnown ? countLabel : undefined}
        description={isImporter
          ? (
            <>
              {t('IMPORTERS_DESCRIPTION', "Bring a store's menu from DoorDash, Uber Eats, GloriaFood or another Ordering.co store.")}
              {' '}
              {/* J2 row 38 (connect-importers P6): the CSV importers stay in Stores (/stores/list › Importers); this opens them there */}
              <Link className='odc-btn' data-variant='link' data-size='sm' to='/stores/list?header=importers'>
                {t('IMPORTERS_CSV_LINK', 'Import from a CSV file')}
              </Link>
            </>
            )
          : isSalesChannel
            ? t('SALES_CHANNELS_DESCRIPTION', 'Connect each store to the marketplaces that sell it and send its menu to them.')
            : t('POS_MENU_DESCRIPTION', 'Connect each store to its point-of-sale system and keep its menu in sync.')}
        learn={(
          // redesign PM-T2: under 600px of its own width the header keeps only the icons (data-collapse-label), so the
          // title is not cut in long languages (fr, de, bg at 390); the name stays on the button
          <Button variant='ghost' icon={CircleHelp} onClick={openHelp} title={t('LEARN', 'Learn')}>
            <span data-collapse-label=''>{t('LEARN', 'Learn')}</span>
          </Button>
        )}
        actions={noBusinesses
          ? undefined
          : (
            <Button icon={RefreshCw} busy={loading} onClick={handleRefresh} title={t('REFRESH', 'Refresh')}>
              <span data-collapse-label=''>{t('REFRESH', 'Refresh')}</span>
            </Button>
            )}
        leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
      />
      <div className='odc-pm-bar'>
        {!noBusinesses && (
          <Tabs
            label={t('POS_MENU_STATUS_TABS', 'Store status')}
            value={activeTab}
            onValueChange={handleTab}
            items={[
              { value: 'active', label: t('ACTIVE', 'Active') },
              { value: 'inactive', label: t('INACTIVE', 'Inactive') }
            ]}
          />
        )}
        <div className='odc-pm-search'>
          <SearchField
            value={searchText}
            onChange={typeSearch}
            onClear={() => sendSearch('')}
            onKeyDown={(event) => { if (event.key === 'Enter') sendSearch(searchText) }}
            inputRef={searchInput}
            label={t('SEARCH', 'Search')}
            placeholder={t('SEARCH', 'Search')}
            clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          />
          {channelFilter}
        </div>
      </div>
      <PosMenuTable
        businesses={businesses}
        loading={loading}
        error={businessList?.error}
        integrations={integrationsList?.thirdPartyIntegrations}
        citiesList={citiesList}
        activeState={selectedBusinessActiveState}
        searchValue={searchValue}
        activeBusinessId={open?.id ?? null}
        onOpenBusiness={handleOpenBusinessDetails}
        onClearSearch={clearSearch}
        onRetry={() => loadBusinesses()}
        // main #394: a plugin page a row opened reads the list (and the open store) again when it closes
        onReload={handleRefresh}
        kind={kind}
      />
      {pagination?.total > 0 && !businessList?.error && (
        <div className='odc-pm-foot'>
          <Pagination
            page={pagination.currentPage}
            pageSize={pagination.pageSize}
            total={pagination.total}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={(page) => getPageBusinesses(pagination.pageSize, page)}
            onPageSizeChange={(size) => getPageBusinesses(size, Math.ceil(pagination.from / size) || 1)}
            busy={loading}
            showPageInput
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            pageLabel={t('PAGE', 'Page')}
            pageOfLabel={(totalPages, figureOf) => fill(t('PAGE_OF_TOTAL', 'of _total_'), { total: figureOf(totalPages) })}
            rangeLabel={(from, to, count, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(count) })}
            pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
          />
        </div>
      )}
    </div>
  )

  // an importer's panel needs the row (never null); the POS panel can ask for the store by its id
  const panelOpen = isImporter ? Boolean(open && shownRow) : Boolean(open)
  const panel = panelOpen && (isImporter
    ? (
      <ImporterStorePanel
        key={shownRow.id}
        business={shownRow}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onClose={closePanel}
      />
      )
    : (
      <PosStorePanel
        businessId={open.id}
        business={open.row}
        integrationsList={integrationsList}
        getIntegrations={getIntegrations}
        handleInstallPosIntegration={handleInstallPosIntegration}
        installingPluginRoot={installingPluginRoot}
        checkingPluginRoot={checkingPluginRoot}
        handleCheckPluginInstall={handleCheckPluginInstall}
        refreshSignal={refreshSignal}
        handleSucessUpdateBusiness={handleSucessUpdateBusiness}
        initialSection={open.section}
        onSectionChange={handleSectionChange}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onClose={closePanel}
        kind={kind}
      />
      ))

  return (
    <>
      <SplitView
        className='odc-pm-split'
        list={listView}
        panel={panel}
        open={panelOpen}
        expanded={expanded}
        panelLabel={shownRow?.name || t('BUSINESS', 'Business')}
        resizeLabel={t('POS_MENU_RESIZE_PANEL', 'Resize store panel')}
        storageKey={storageKey}
        onClose={closePanel}
      />
      {help.open && (
        <InfoHelpBox
          open={help.open}
          data={help.data}
          handleOnClose={() => setHelp({ open: false, data: null })}
        />
      )}
    </>
  )
}

export const PosMenu = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const defaultActive = query.get('active')
  // the Channel filter is sales_channel-only (api-core #3629 applies it with the rest of `where`, see
  // PosMenuBusinessList getBusinesses); ?channel= from another kind is never read.
  const salesChannelsFilterEnabled = connectKind(props.kind).kind === 'sales_channel'
  const defaultChannelParam = Number(query.get('channel'))
  const defaultChannel = salesChannelsFilterEnabled && Number.isInteger(defaultChannelParam) && defaultChannelParam >= 1 ? defaultChannelParam : null

  const businessListingProps = {
    ...props,
    UIComponent: PosMenuUI,
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
    defaultChannel,
    salesChannelsFilterEnabled,
    // redesign SC-B: 'pos' unless the page says `kind='sales_channel'` (see connectKinds)
    // redesign IM-A: 'importer' has none (main sent none: the controller does not filter by type)
    integrationType: connectKind(props.kind).integrationType ?? undefined,
    // redesign bugs-d row 57 (IM-09): the importer path reads no integration, so it does not ask for them
    skipIntegrations: connectKind(props.kind).kind === 'importer'
  }
  return (
    <BusinessListController {...businessListingProps} />
  )
}
