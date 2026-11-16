import React, { useEffect, useRef, useState } from 'react'
import { Link, useHistory } from 'react-router-dom'
import { GoogleActionsStores as GoogleActionsStoresController, useApi, useLanguage, useSession, useUtils } from '../../../../../index'
import { canOpenStoreSection, getSectionAccess } from '../../../../../utils/businessDetailSections'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useGoogleActionsVisibility } from '../../../hooks/useGoogleActionsVisibility'
import {
  GOOGLE_ACTIONS_REASON_SECTIONS,
  GOOGLE_ACTIONS_REASON_TABS,
  GOOGLE_ACTIONS_STATES,
  GOOGLE_ACTIONS_STATE_FAMILIES,
  getGoogleActionsBadgeLabels,
  getGoogleActionsState,
  getGoogleActionsStateLabels,
  toGoogleActionsUtc
} from '../../../../../utils/googleActions'
import { CircleAlert, LockKeyhole, Menu as MenuIcon, RefreshCw, Search } from '../../Shared/Icon'
import {
  Avatar,
  Button,
  DataTable,
  EmptyState,
  IconButton,
  PageHeader,
  Pagination,
  RecordPanel,
  SearchField,
  SplitView,
  StatusBadge,
  Tabs,
  useSplitView
} from '../../Shared/Product'
import { BusinessOrderWithGoogle } from '../../Stores/BusinessOrderWithGoogle'
import './order-with-google-page.css'

// , part 3 of 4: Connect › Order with Google (`/connect/order-with-google`), on the frame of Connect › POS & menu sync: the
// store count, Refresh, the Active and Inactive tabs, a name search and the stores by id (logo, name and city). Above them the
// project's counters by Google state, each one a filter. Each row shows the store's state on Google (short), the link Google opens,
// when it was checked. A row opens the store in a panel beside the list (as POS & menu sync, `?id=`) with its «Order with Google»
// section, to activate or deactivate it without leaving the page; «Fix» goes to the store section that fixes why it is not sent. Every state
// comes from the API (`google_actions_status`): the counters, the filter and the rows read the same rule. The sidebar entry comes in
// part 4; until then the page is reached by its address, and it shows nothing for a project without Google. Prefix: odc-gap-*.

const SEARCH_DELAY_MS = 750
const SKELETON_ROWS = 10
const PAGE_SIZES = [10, 25, 50]

// «Showing _from_–_to_ of _total_» with each number in its own node (as BuilderProductsList)
const fill = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

/** The address of a section (and tab) of the store editor. */
const storeSectionUrl = (store, section, tab) => `/stores/list?id=${store.id}&section=${section}${tab ? `&tab=${tab}` : ''}`

/** The section of the store a row opens: the one that fixes why it is not sent, else «Order with Google». */
export const getGoogleActionsRowSection = (state, reason) =>
  (state === 'skipped' && GOOGLE_ACTIONS_REASON_SECTIONS[reason]) || 'google_actions'

// The panel of one store: its name and city, and its «Order with Google» section. A section that fixes a reason opens in Stores.
const StorePanel = ({ store, onClose, onChange, canOpenSection }) => {
  const [, t] = useLanguage()
  const history = useHistory()
  const phone = useSplitView().mode === 'full'
  return (
    <RecordPanel
      title={store.name || t('BUSINESS', 'Business')}
      subtitle={store.city?.name || undefined}
      closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
      onClose={onClose}
    >
      <BusinessOrderWithGoogle
        key={store.id}
        business={store}
        embedded
        onChange={onChange}
        canOpenSection={canOpenSection}
        onOpenSection={(section, tab) => history.push(storeSectionUrl(store, section, tab))}
      />
    </RecordPanel>
  )
}

const OrderWithGoogleUI = (props) => {
  const {
    statusState,
    refreshStatus,
    storesState,
    pagination,
    filter,
    searchValue,
    activeState,
    handleChangeActiveState,
    handleChangeFilter,
    handleChangeSearch,
    handleChangePage,
    handleChangePageSize
  } = props

  const [, t] = useLanguage()
  const [{ getTimeAgo, optimizeImage }] = useUtils()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [{ user } = {}] = useSession() || []
  const [ordering] = useApi() || []
  // A store section opens only for whoever the store editor opens it for (its menu's role rules, as Stores › Schedule)
  const sectionAccess = getSectionAccess({ user, project: ordering?.project })
  const canOpenSection = (section, tab) => canOpenStoreSection({ section, tab }, sectionAccess)
  const [query, setQuery] = useState(searchValue)
  const searchTimer = useRef(null)
  // The store open in the panel: by its row, or by `?id=` until the list brings it
  const [openId, setOpenId] = useState(() => {
    if (typeof window === 'undefined') return null
    const id = Number(new URLSearchParams(window.location.search).get('id'))
    return Number.isFinite(id) && id > 0 ? id : null
  })
  const [openRow, setOpenRow] = useState(null)

  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const changeQuery = (value) => {
    setQuery(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => handleChangeSearch(value), SEARCH_DELAY_MS)
  }
  const clearQuery = () => {
    clearTimeout(searchTimer.current)
    setQuery('')
    handleChangeSearch('')
  }
  const refresh = () => {
    refreshStatus()
    handleChangePage(pagination.currentPage)
  }
  const openStore = (store) => {
    setOpenId(store.id)
    setOpenRow(store)
    addQueryToUrl({ id: store.id })
  }
  const closeStore = () => {
    setOpenId(null)
    setOpenRow(null)
    removeQueryToUrl(['id'])
  }
  // The row of the list wins (it has the state after a reload); the one that was clicked stays when a page change takes it away
  const listedRow = openId != null ? storesState.stores.find(store => store.id === openId) : undefined
  const shownStore = listedRow || openRow

  const stateLabels = getGoogleActionsStateLabels(t)
  // The row's badge: a short state, and for a store not sent the short reason
  const badgeLabels = getGoogleActionsBadgeLabels(t)
  const reasonBadges = {
    disabled: t('GOOGLE_ACTIONS_BADGE_DISABLED', 'Store disabled'),
    no_name: t('GOOGLE_ACTIONS_BADGE_NO_NAME', 'No name'),
    no_url: t('GOOGLE_ACTIONS_BADGE_NO_URL', 'No https link'),
    no_location: t('GOOGLE_ACTIONS_BADGE_NO_LOCATION', 'No location'),
    no_service: t('GOOGLE_ACTIONS_BADGE_NO_SERVICE', 'No delivery or pickup'),
    no_lead_time: t('GOOGLE_ACTIONS_BADGE_NO_LEAD_TIME', 'No delivery or pickup time'),
    no_schedule: t('GOOGLE_ACTIONS_BADGE_NO_SCHEDULE', 'No hours'),
    no_currency: t('GOOGLE_ACTIONS_BADGE_NO_CURRENCY', 'No currency')
  }
  const counts = statusState.data?.counts || {}
  const total = pagination.total
  // A store turned off keeps its last link and check on its row; they mean nothing once it is not activated
  const activeGoogle = (store) => getGoogleActionsState(store.google_actions || {}) !== 'not_activated' ? store.google_actions : null
  const rowSection = (store) => getGoogleActionsRowSection(getGoogleActionsState(store.google_actions || {}), store.google_actions?.status_reason)

  const header = (
    <PageHeader
      leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
      title={t('ORDER_WITH_GOOGLE', 'Order with Google')}
      count={statusState.visible && !storesState.loading ? total : undefined}
      countLabel={statusState.visible && !storesState.loading
        ? (total === 1 ? t('POS_MENU_STORE_COUNT_ONE', '1 store') : t('POS_MENU_STORE_COUNT_OTHER', '_count_ stores').replace('_count_', () => String(total)))
        : undefined}
      description={t('GOOGLE_ACTIONS_PAGE_DESCRIPTION', 'Stores that show an “Order online” button on Google Search and Maps. Google receives the list every day.')}
      actions={statusState.visible
        ? (
          <Button icon={RefreshCw} onClick={refresh} busy={statusState.loading || storesState.loading} title={t('REFRESH', 'Refresh')}>
            <span data-collapse-label=''>{t('REFRESH', 'Refresh')}</span>
          </Button>
          )
        : undefined}
    />
  )

  if (!statusState.loading && !statusState.visible) {
    return (
      <div className='odc-root odc-gap'>
        {header}
        <EmptyState
          icon={LockKeyhole}
          titleAs='h2'
          title={t('GOOGLE_ACTIONS_NOT_AVAILABLE', 'Order with Google is not available for this project yet.')}
        />
      </div>
    )
  }

  const columns = [
    { id: 'id', header: t('ID', 'ID'), skeleton: { lines: 1 }, cell: store => <bdi dir='ltr' className='odc-figure'>{store.id}</bdi> },
    {
      id: 'business',
      header: t('BUSINESS', 'Business'),
      rowHeader: true,
      wrap: true,
      skeleton: { lines: 2, lead: 'business' },
      cell: store => {
        const city = store.city?.name
        return (
          <span className='odc-gap-store'>
            <Avatar kind='business' name={store.name || ''} src={store.logo ? optimizeImage(store.logo, 'h_50,c_limit') : undefined} />
            <span className='odc-gap-store-text'>
              <span className='odc-gap-name' dir='auto' title={store.name}>{store.name}</span>
              {city && <span className='odc-gap-sub' dir='auto' title={city}>{city}</span>}
            </span>
          </span>
        )
      }
    },
    {
      id: 'state',
      header: t('GOOGLE_ACTIONS_STATE', 'Google'),
      skeleton: { lines: 1, lead: 'dot' },
      cell: store => {
        const state = getGoogleActionsState(store.google_actions || {})
        if (state === 'not_activated') return <span className='odc-gap-muted'>{stateLabels.not_activated}</span>
        const label = (state === 'skipped' && reasonBadges[store.google_actions?.status_reason]) || badgeLabels[state]
        return <StatusBadge family={GOOGLE_ACTIONS_STATE_FAMILIES[state]} label={label} />
      }
    },
    {
      id: 'link',
      header: t('GOOGLE_ACTIONS_LINK', 'Link Google opens'),
      wrap: true,
      hideBelow: 720,
      skeleton: { lines: 1 },
      cell: store => activeGoogle(store)?.sent_url
        ? (
          <a className='odc-gap-link' href={store.google_actions.sent_url} target='_blank' rel='noopener noreferrer' onClick={(e) => e.stopPropagation()}>
            {store.google_actions.sent_url.replace(/^https:\/\//, '')}
          </a>
          )
        : <span className='odc-gap-muted' aria-hidden='true'>—</span>
    },
    {
      id: 'checked',
      header: t('GOOGLE_ACTIONS_CHECKED', 'Checked'),
      hideBelow: 560,
      skeleton: { lines: 1 },
      cell: store => {
        const checkedAt = toGoogleActionsUtc(activeGoogle(store)?.checked_at)
        return checkedAt ? getTimeAgo(checkedAt) : <span className='odc-gap-muted' aria-hidden='true'>—</span>
      }
    },
    {
      id: 'action',
      header: t('ACTIONS', 'Actions'),
      locked: true,
      skeleton: { lines: 1 },
      cell: store => {
        const state = getGoogleActionsState(store.google_actions || {})
        const section = rowSection(store)
        const tab = section === 'google_actions' ? undefined : GOOGLE_ACTIONS_REASON_TABS[store.google_actions?.status_reason]
        // A store not sent goes to the section (and tab) that fixes it, for whoever can open it; any other row opens the panel
        if (section !== 'google_actions' && canOpenSection(section, tab)) {
          return (
            <Link className='odc-btn' data-variant='secondary' data-size='sm' to={storeSectionUrl(store, section, tab)} onClick={(e) => e.stopPropagation()}>
              {t('GOOGLE_ACTIONS_FIX', 'Fix')}
            </Link>
          )
        }
        return (
          <Button size='sm' variant='secondary' onClick={(e) => { e.stopPropagation(); openStore(store) }}>
            {state === 'not_activated' ? t('GOOGLE_ACTIONS_ACTIVATE_STORE', 'Activate') : t('OPEN', 'Open')}
          </Button>
        )
      }
    }
  ]

  const renderBody = () => {
    if (storesState.error && !storesState.loading) {
      return (
        <EmptyState
          tone='error'
          icon={CircleAlert}
          titleAs='h2'
          title={t('GOOGLE_ACTIONS_STORES_ERROR', 'The stores could not be loaded.')}
          action={<Button variant='primary' onClick={() => handleChangePage(pagination.currentPage)}>{t('TRY_AGAIN', 'Try again')}</Button>}
        />
      )
    }
    if (!storesState.loading && !storesState.stores.length) {
      return (
        <EmptyState
          icon={Search}
          titleAs='h2'
          title={t('GOOGLE_ACTIONS_NO_STORES', 'No store matches')}
          action={filter || searchValue
            ? <Button onClick={() => { if (filter) handleChangeFilter(filter); clearQuery() }}>{t('CLEAR_FILTERS', 'Clear filters')}</Button>
            : null}
        />
      )
    }
    return (
      <>
        <DataTable
          label={t('ORDER_WITH_GOOGLE', 'Order with Google')}
          columns={columns}
          rows={storesState.loading ? [] : storesState.stores}
          getRowId={store => store.id}
          onOpenRow={openStore}
          activeRowId={shownStore?.id}
          loading={storesState.loading}
          loadingLabel={t('LOADING', 'Loading')}
          skeletonRows={SKELETON_ROWS}
        />
        {!storesState.loading && pagination.totalPages > 0 && (
          <Pagination
            page={pagination.currentPage}
            pageSize={pagination.pageSize}
            total={pagination.total}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={handleChangePage}
            onPageSizeChange={handleChangePageSize}
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            showPageInput
            pageLabel={t('PAGE', 'Page')}
            pageOfLabel={(totalPages, figureOf) => fill(t('PAGE_OF_TOTAL', 'of _total_'), { total: figureOf(totalPages) })}
            rangeLabel={(from, to, totalRows, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(totalRows) })}
            pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
          />
        )}
      </>
    )
  }

  const listView = (
    <div className='odc-root odc-gap'>
      {header}
      <ul className='odc-gap-counts' aria-label={t('GOOGLE_ACTIONS_COUNTS', 'Stores by state')}>
        {GOOGLE_ACTIONS_STATES.map(state => (
          <li key={state}>
            <button
              type='button'
              className='odc-gap-count'
              data-state={state}
              aria-pressed={filter === state}
              onClick={() => handleChangeFilter(state)}
            >
              <span className='odc-gap-count-label'>{stateLabels[state]}</span>
              <span className='odc-gap-count-value odc-figure'>{statusState.loading ? '…' : (counts[state] || 0).toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className='odc-gap-bar'>
        <Tabs
          label={t('POS_MENU_STATUS_TABS', 'Store status')}
          value={activeState ? 'active' : 'inactive'}
          onValueChange={value => handleChangeActiveState(value === 'active')}
          items={[
            { value: 'active', label: t('ACTIVE', 'Active') },
            { value: 'inactive', label: t('INACTIVE', 'Inactive') }
          ]}
        />
        <div className='odc-gap-search'>
          <SearchField
            value={query}
            onChange={changeQuery}
            onClear={clearQuery}
            label={t('SEARCH', 'Search')}
            placeholder={t('SEARCH', 'Search')}
            clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          />
        </div>
      </div>
      {renderBody()}
    </div>
  )

  return (
    <SplitView
      list={listView}
      panel={shownStore ? <StorePanel store={shownStore} onClose={closeStore} canOpenSection={canOpenSection} onChange={() => handleChangePage(pagination.currentPage)} /> : null}
      open={!!shownStore}
      panelLabel={shownStore?.name || t('BUSINESS', 'Business')}
      resizeLabel={t('POS_MENU_RESIZE_PANEL', 'Resize store panel')}
      storageKey='order-with-google-panel'
      onClose={closeStore}
    />
  )
}

// `?state=` (the Home's «Stores Google is not showing» sends `skipped`) opens the list on that state; it is read once and goes
const readStateFromAddress = () => {
  if (typeof window === 'undefined') return null
  const state = new URLSearchParams(window.location.search).get('state')
  if (state === null) return null
  removeQueryToUrl(['state'])
  return GOOGLE_ACTIONS_STATES.includes(state) ? state : null
}

export const OrderWithGoogle = (props) => {
  const visibility = useGoogleActionsVisibility()
  const [defaultFilter] = useState(readStateFromAddress)
  return (
    <GoogleActionsStoresController
      {...props}
      defaultFilter={defaultFilter}
      statusState={{ loading: visibility.loading, data: visibility.status, visible: visibility.visible }}
      refreshStatus={visibility.refresh}
      UIComponent={OrderWithGoogleUI}
    />
  )
}
