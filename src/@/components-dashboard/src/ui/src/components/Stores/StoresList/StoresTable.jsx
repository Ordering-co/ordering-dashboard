import React, { useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { useTheme } from 'styled-components'

import { useApi, useConfig, useEvent, useLanguage, useSession, useUtils } from '../../../../../index'
import { canOpenStoreSection, getSectionAccess } from '../../../../../utils/businessDetailSections'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useFeaturedRestriction } from '../../../hooks/useFeaturedRestriction'
import { useStoreWebsiteUrl } from '../../../hooks/useWebsiteUrl'
import { addQueryToUrl } from '../../../utils'
import {
  Avatar,
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  InlineNotice,
  Menu,
  Pagination,
  RecordCardList
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Ellipsis, FilterX, Star, Store, TriangleAlert } from '../../Shared/Icon'
import { StoreRowControllers, StoreRowSwitch } from './StoreRowSwitch'
import { StoresCards } from './StoresCards'
import { OpenNow } from './OpenNow'
import { storeOpenNow } from './storeOpenNow'
import { availableStoreColumns, defaultStoreColumns } from './useStoresColumns'
import './stores-table.css'

// redesign SL-F1 (A2): the list of /stores/list as a Product DataTable (RecordCards under 768px, the cards of today in the card
// view). It draws what the DashboardBusinessList controller gives (`businessList`, `pagination`, `businessIds`) and fetches nothing:
// the controller keeps the selection, the page and the saves. Behaviour of BusinessesList and SingleBusiness is kept (inventory 1.7,
// 1.9): the select-all of the page, the click on a row that opens the editor (not on a control), the optional Business, Featured and
// Ratings columns, the Disabled reason of the Inactive tab, the EatStreet rules, `?page=&pageSize=`, 10 / 25 / 50 per page.

const PAGE_SIZES = [10, 25, 50]
const SKELETON_ROWS = 10 // inventory 1.7: 10 list rows
const DEFAULT_COLUMNS = defaultStoreColumns()

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11) and keep their direction in RTL
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

// The card is a link to `?id=`, as the order cards are: a middle click works; a plain click goes through `onOpen`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

const errorText = (t, error) => {
  const first = (Array.isArray(error) ? error : [error])
    .map(item => (typeof item === 'string' ? item : item?.message))
    .find(Boolean)
  return translateApiMessage(t, first, undefined)
}

const nameLabel = (template, business) => template.replace('_name_', business?.name ?? '')

// The controller gives `['NETWORK_ERROR']` for a request that never got an answer (and a 500 the SDK throws on): its dictionary text,
// «Network error, please reload the page», reads wrong next to a Retry button, so that one is told in the list's own words.
const isNetworkError = (error) => (Array.isArray(error) ? error : [error]).includes('NETWORK_ERROR')

// ---- ⋯: Open, Schedule, Categories & products, Preview ----------------------------------------------------------------------------
// The same destinations the editor has, one click earlier. Schedule opens the store with `?section=schedule`: the editor reads that
// key when the store has loaded (BusinessDetails `query.get('section')`), but through the router's location, which `replaceState`
// does not update; so the router is told too, and the editor sees the section the first time it looks.
const StoreRowMenu = ({ business, handleOpenBusinessDetails }) => {
  const [, t] = useLanguage()
  const [events] = useEvent()
  const history = useHistory()
  const storeUrl = useStoreWebsiteUrl(business.slug)
  const [{ user } = {}] = useSession() || []
  const [ordering] = useApi() || []
  // redesign bugs C: Schedule only for whoever the editor opens it for (its menu's role rules)
  const canOpenSchedule = canOpenStoreSection({ section: 'schedule' }, getSectionAccess({ user, project: ordering?.project }))

  const openSchedule = () => {
    handleOpenBusinessDetails(business)
    addQueryToUrl({ section: 'schedule' })
    if (history?.replace) history.replace(`${window.location.pathname}${window.location.search}${window.location.hash}`)
  }

  const items = [
    { key: 'open', label: t('OPEN', 'Open'), onSelect: () => handleOpenBusinessDetails(business) },
    ...(canOpenSchedule ? [{ key: 'schedule', label: t('SCHEDULE', 'Schedule'), onSelect: openSchedule }] : []),
    {
      key: 'catalog',
      label: t('CATEGORIES_AND_PRODUCTS', 'Categories & products'),
      // a real link, as in main (/stores/products/<slug>), so Cmd / Ctrl / middle click open it in a new tab; a plain
      // click keeps going through the router (Menu prevents the default and calls onSelect)
      ...(business.slug ? { href: `/stores/products/${business.slug}` } : {}),
      onSelect: () => events.emit('go_to_page', { page: 'store', params: { store: business.slug } })
    }
  ]
  if (storeUrl) {
    items.push({ key: 'preview', label: t('PREVIEW', 'Preview'), onSelect: () => window.open(storeUrl, '_blank', 'noopener,noreferrer') })
  }

  return (
    // the menu is portaled: its clicks still bubble through React, and none of them may open the row
    <span className='odc-sl-menu' data-odc-no-open='' data-card-actions='' onClick={event => event.stopPropagation()}>
      <Menu
        icon={Ellipsis}
        label={nameLabel(t('STORES_ROW_ACTIONS', 'Actions for _name_'), business)}
        items={items}
      />
    </span>
  )
}

/**
 * The list view and the card view of the stores. Props are the state of the DashboardBusinessList controller (A3 passes the same
 * names BusinessesListingUI receives).
 *
 * @param {object}   props
 * @param {{loading: boolean, error: *, businesses: Array<object>}} props.businessList
 * @param {{currentPage?: number, pageSize?: number, total?: number, from?: number, to?: number}} props.pagination
 * @param {Function} props.getPageBusinesses          `(pageSize, page)`: page and page-size changes of the foot.
 * @param {Function} props.loadMoreBusinesses         Card view: the infinite scroll.
 * @param {Array<number>} props.businessIds           The selected ids (they live in the controller and outlive filters and pages).
 * @param {Function} props.handleChangeBusinessIds    `(id)`: toggles one id.
 * @param {Function} props.setBusinessIds             `(ids)`: select-all of the page adds / removes the page's ids.
 * @param {boolean}  props.selectedBusinessActiveState true = Active tab; the Disabled reason column shows on false.
 * @param {'list'|'card'} props.viewMethod
 * @param {Function} props.handleOpenBusinessDetails  `(business)`: opens the editor (`?id=`).
 * @param {number|string} [props.detailsBusinessId]   The open store: its row is the active one.
 * @param {Function} props.handleSucessUpdateBusiness Forwarded to the controller of every switch.
 * @param {Function} props.handleSucessRemoveBusiness
 * @param {Function} [props.handleSucessAddBusiness]
 * @param {boolean}  [props.isUseQuery]               List view only: writes `?page=&pageSize=` when the page changes.
 * @param {boolean}  [props.isEatstreetProject]       No City, no Ratings.
 * @param {Function} props.loadBusinesses             Retry of a load that failed.
 * @param {boolean}  [props.allowBusinessRegister]    With the tutorial and no stores, shows «Add your first store». (redesign stores 3.A, P-3: the «Add new store» link under the list is gone.)
 * @param {Array<{id: number, name: string}>} [props.citiesList]  Names of the cities (the store has `city_id`).
 * @param {boolean}  [props.isTutorialMode]           With no stores, «Add your first store» (as BusinessesList).
 * @param {Function} [props.handleOpenAddBusiness]    `()`: that button (goes to /stores/add and the tutorial goes on after it).
 * @param {boolean}  [props.filtered]                 A search, a filter or a type is on: an empty list then says nothing matches, and offers `onClearFilters`.
 * @param {Function} [props.onClearFilters]           `()`: clears the search, the filters and the type.
 * @param {Array<{id: string, visible: boolean}>} [props.columns]  The managed columns in their order (`useStoresColumns`); all of
 *                                                    them by default. redesign stores 3.B: the manager is a tool of the
 *                                                    filter bar now (`StoresColumnsTool`), not a row of the table.
 */
export const StoresTable = ({
  businessList,
  pagination,
  getPageBusinesses,
  loadMoreBusinesses,
  businessIds = [],
  handleChangeBusinessIds,
  setBusinessIds,
  selectedBusinessActiveState,
  viewMethod,
  handleOpenBusinessDetails,
  detailsBusinessId,
  handleSucessUpdateBusiness,
  handleSucessRemoveBusiness,
  handleSucessAddBusiness,
  isUseQuery,
  isEatstreetProject,
  loadBusinesses,
  allowBusinessRegister,
  citiesList,
  isTutorialMode,
  handleOpenAddBusiness,
  filtered,
  onClearFilters,
  columns = DEFAULT_COLUMNS
}) => {
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const theme = useTheme()
  const isPhone = useIsPhone()
  const isRestricted = useFeaturedRestriction()
  const [{ configs }] = useConfig()
  const is12Hours = String(configs?.format_time?.value) === '12'

  const rows = businessList?.businesses || []
  const loading = Boolean(businessList?.loading)
  const error = businessList?.error
  const isList = viewMethod === 'list'
  const handlers = { handleSucessUpdateBusiness, handleSucessRemoveBusiness, handleSucessAddBusiness }

  // ?page= and ?pageSize= follow the page (BusinessesList:133-139), in the list view only
  useEffect(() => {
    if (!isUseQuery || !isList || !pagination?.currentPage || !pagination?.pageSize || !pagination?.total) return
    addQueryToUrl({
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    })
  }, [pagination?.currentPage, pagination?.pageSize, pagination?.total])

  const getCityName = (business) => {
    const found = citiesList?.find(city => city.id === business.city_id)
    return found?.name || business.city?.name || ''
  }

  // ---- selection: the ids of the page on screen, as today ----
  const pageIds = rows.map(business => business.id)
  const allChecked = !loading && pageIds.length > 0 && pageIds.every(id => businessIds.includes(id))
  const toggleAll = () => {
    if (allChecked) setBusinessIds(businessIds.filter(id => !pageIds.includes(id)))
    else setBusinessIds([...new Set([...businessIds, ...pageIds])])
  }
  const selectLabel = (business) => nameLabel(t('STORES_SELECT_ROW', 'Select _name_'), business)

  // ---- the columns the person chose (Store, Today, Featured, Ratings), as ColumnAllowSettingPopover offered them ----
  const available = availableStoreColumns({ isRestricted, isEatstreetProject })
  const labels = {
    business: t('STORE', 'Store'),
    today: t('TODAY', 'Today'),
    featured: t('FEATURED', 'Featured'),
    ratings: t('RATINGS', 'Ratings')
  }

  // ---- the cells (the table and the cards draw the same ones) ----
  const storeCell = (business) => {
    const city = isEatstreetProject ? '' : getCityName(business)
    return (
      <span className='odc-sl-store'>
        <Avatar kind='business' name={business.name || ''} src={business.logo ? optimizeImage(business.logo, 'h_50,c_limit') : undefined} />
        <span className='odc-sl-store-text'>
          <span className='odc-sl-name' dir='auto' title={business.name}>{business.name}</span>
          {city && <span className='odc-sl-sub' dir='auto' title={city}>{city}</span>}
        </span>
      </span>
    )
  }

  const ratingCell = (business) => {
    if (!(business.reviews?.total > 0)) return null
    return (
      <span className='odc-sl-rating'>
        <Star className='odc-icon odc-sl-star' aria-hidden='true' />
        <span className='odc-sr-only'>{t('RATINGS', 'Ratings')}</span>
        <bdi dir='ltr' className='odc-figure'>{business.reviews.total}</bdi>
      </span>
    )
  }

  // redesign stores 3.B: Featured is the second switch of the row; in ink, so it does not read as a second Enabled
  const featuredSwitch = (business, withText = false) => (
    <StoreRowSwitch
      {...handlers}
      business={business}
      field='featured'
      tone='neutral'
      label={nameLabel(t('STORES_FEATURED_STORE', 'Featured _name_'), business)}
    >
      {withText ? t('FEATURED', 'Featured') : undefined}
    </StoreRowSwitch>
  )

  const enabledSwitch = (business, withText = false) => (
    <StoreRowSwitch
      {...handlers}
      business={business}
      field='enabled'
      label={nameLabel(t('STORES_ENABLE_STORE', 'Enable _name_'), business)}
    >
      {/* redesign tanda AB (S-4a): the text beside the switch names the state, as the «Enabled» column; the verb stays in the accessible name */}
      {withText ? t('ENABLED', 'Enabled') : undefined}
    </StoreRowSwitch>
  )

  // The controls of a row: a click on them is theirs, never the row's (the zones `.business_enable_control` and `.featured` of main)
  const control = (node) => <span className='odc-sl-control' data-odc-no-open=''>{node}</span>

  const DEFINITIONS = {
    // (T10, review): a floor so the name stays readable beside the docked editor; the table scrolls sideways instead
    business: { header: labels.business, rowHeader: true, wrap: true, skeleton: { lines: 2, lead: 'business', floor: 'var(--od-x-col-floor-store)' }, cell: storeCell },
    today: { header: labels.today, skeleton: { lines: 1 }, cell: business => <OpenNow business={business} is12Hours={is12Hours} /> },
    featured: { header: labels.featured, skeleton: { lines: 1 }, cell: business => control(featuredSwitch(business)) },
    ratings: { header: labels.ratings, skeleton: { lines: 1 }, cell: ratingCell }
  }
  const tableColumns = [
    ...columns
      .filter(column => column.visible && available.includes(column.id) && DEFINITIONS[column.id])
      .map(({ id }) => ({ id, ...DEFINITIONS[id] })),
    // Disabled reason: the header is there on the Inactive tab (`!selectedBusinessActiveState`); the cell says it for a disabled store
    ...(!selectedBusinessActiveState
      ? [{
          id: 'disabledReason',
          header: t('DISABLED_REASON', 'Disabled reason'),
          wrap: true,
          skeleton: { lines: 1 },
          cell: business => (business.enabled === false ? <span className='odc-sl-reason' dir='auto'>{business.disabled_reason}</span> : null)
        }]
      : []),
    { id: 'enabled', header: t('ENABLED', 'Enabled'), skeleton: { lines: 1 }, cell: business => control(enabledSwitch(business)) },
    // redesign tanda AB (S-3): a figure, aligned to the end (P/DataTable `align: 'end'`)
    { id: 'id', header: t('ID', 'ID'), align: 'end', skeleton: { lines: 1 }, cell: business => <bdi dir='ltr' className='odc-figure'>{business.id}</bdi> },
    {
      id: 'actions',
      header: '',
      srHeader: t('ACTIONS', 'Actions'),
      align: 'end',
      skeleton: { lines: 1 },
      cell: business => <StoreRowMenu business={business} handleOpenBusinessDetails={handleOpenBusinessDetails} />
    }
  ]

  // ---- the states that are not rows ----
  const retry = <Button onClick={() => loadBusinesses?.()}>{t('RETRY', 'Retry')}</Button>
  const loadingLabel = t('STORES_LOADING', 'Loading stores')

  const emptyState = () => {
    if (isTutorialMode && allowBusinessRegister) {
      const image = theme?.images?.tutorials?.businessTutorial1
      return (
        <div className='odc-sl-first'>
          {image && <img src={image} alt='' />}
          <Button variant='primary' onClick={() => handleOpenAddBusiness?.()}>{t('ADD_FIRST_STORE', 'Add your first store')}</Button>
        </div>
      )
    }
    // a search or filters with no result is not a project without stores (as the orders list tells them apart)
    if (filtered) {
      return (
        <EmptyState
          icon={FilterX}
          title={t('STORES_NO_MATCH', 'No stores match your search or filters')}
          action={onClearFilters ? <Button onClick={() => onClearFilters()}>{t('CLEAR_FILTERS', 'Clear filters')}</Button> : undefined}
        />
      )
    }
    return <EmptyState icon={Store} title={t('NO_STORES_TO_SHOW', 'No stores to show')} />
  }

  // A load that failed with nothing to show takes the place of the list (SL-04); one that failed on a page change keeps the rows
  if (error && !loading && rows.length === 0) {
    const network = isNetworkError(error)
    return (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('STORES_LOAD_FAILED', "We couldn't load the stores.")}
        description={network ? undefined : errorText(t, error)}
        action={retry}
      />
    )
  }
  const refreshFailed = error && !loading && rows.length > 0 && (
    <div className='odc-sl-notice'>
      <InlineNotice tone='warning' icon={TriangleAlert} action={retry}>
        {t('STORES_LOAD_FAILED', "We couldn't load the stores.")}
      </InlineNotice>
    </div>
  )

  // ---- the card view: the cards of today ----
  if (!isList) {
    if (!loading && rows.length === 0) return <>{refreshFailed}{emptyState()}</>
    return (
      <>
        {refreshFailed}
        <StoresCards
          {...handlers}
          businessList={businessList}
          pagination={pagination}
          loadMoreBusinesses={loadMoreBusinesses}
          handleOpenBusinessDetails={handleOpenBusinessDetails}
          getCityName={getCityName}
          isEatstreetProject={isEatstreetProject}
          is12Hours={is12Hours}
        />
      </>
    )
  }

  // ---- the foot: the pages ----
  // redesign stores 3.A, P-3: the «Add new store» link that was here is gone; the header button and the empty state keep it
  const foot = (
    <div className='odc-sl-foot'>
      {pagination?.total > 0 && (
        <Pagination
          page={pagination.currentPage}
          pageSize={pagination.pageSize}
          total={pagination.total}
          pageSizeOptions={PAGE_SIZES}
          onPageChange={page => getPageBusinesses(pagination.pageSize, page)}
          onPageSizeChange={(size, page) => getPageBusinesses(size, page)}
          busy={loading}
          showPageInput
          label={t('PAGINATION', 'Pagination')}
          previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
          nextLabel={t('NEXT_PAGE', 'Next page')}
          pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
          pageLabel={t('PAGE', 'Page')}
          pageOfLabel={(total, figure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total }, figure)}
          // after a Disable the rows leave the page but the page is not asked again, so the end of the range is the last
          // row on screen, not page × page size (a full page, and the last page, give the same numbers as before)
          rangeLabel={(from, to, total, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to: !loading && rows.length > 0 ? Math.min(to, from + rows.length - 1) : to, total }, figure)}
          pageStatusLabel={(current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
        />
      )}
    </div>
  )

  // ---- phone: the same data as cards ----
  if (isPhone) {
    const toCard = (business) => {
      const city = isEatstreetProject ? '' : getCityName(business)
      return {
        id: business.id,
        href: hrefFor(business.id),
        label: nameLabel(t('STORES_OPEN_STORE', 'Open _name_'), business),
        title: <span className='odc-sl-name' dir='auto'>{business.name}</span>,
        // no Ratings on EatStreet: the table and main hide it there
        status: isEatstreetProject ? null : ratingCell(business),
        schedule: [
          storeOpenNow(business) ? <OpenNow key='today' business={business} is12Hours={is12Hours} /> : null,
          // main drew the reason at every width; the column does it on a desktop
          business.enabled === false && business.disabled_reason
            ? <span key='reason' className='odc-sl-reason' dir='auto'>{t('DISABLED_REASON', 'Disabled reason')}: {business.disabled_reason}</span>
            : null
        ],
        from: (
          <span className='odc-sl-store'>
            <Avatar kind='business' name={business.name || ''} src={business.logo ? optimizeImage(business.logo, 'h_50,c_limit') : undefined} />
            <span className='odc-sl-sub odc-sl-card-sub' dir='auto'>
              {city}{city ? ' · ' : ''}
              {t('ID', 'ID')} <bdi dir='ltr' className='odc-figure'>{business.id}</bdi>
            </span>
          </span>
        ),
        active: detailsBusinessId != null && Number(detailsBusinessId) === business.id,
        actions: (
          <div className='odc-sl-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
            <Checkbox
              label={selectLabel(business)}
              checked={businessIds.includes(business.id)}
              onCheckedChange={() => handleChangeBusinessIds(business.id)}
            />
            {!isRestricted && featuredSwitch(business, true)}
            {enabledSwitch(business, true)}
            <StoreRowMenu business={business} handleOpenBusinessDetails={handleOpenBusinessDetails} />
          </div>
        ),
        onOpen: () => handleOpenBusinessDetails(business)
      }
    }
    return (
      <StoreRowControllers {...handlers} businesses={loading ? [] : rows}>
        <div className='odc-sl-cards'>
          {refreshFailed}
          <div className='odc-sl-tools' data-cards=''>
            <Checkbox
              checked={allChecked ? true : (pageIds.some(id => businessIds.includes(id)) ? 'mixed' : false)}
              readOnly={loading}
              aria-disabled={loading || undefined}
              onCheckedChange={() => { if (!loading) toggleAll() }}
            >
              {t('SELECT_ALL', 'Select all')}
            </Checkbox>
          </div>
          <RecordCardList
            label={t('STORES_LIST', 'Stores list')}
            items={loading ? [] : rows.map(toCard)}
            loading={loading}
            loadingLabel={loadingLabel}
            skeletonCount={SKELETON_ROWS}
            empty={emptyState()}
          />
          {foot}
        </div>
      </StoreRowControllers>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens ----
  return (
    <StoreRowControllers {...handlers} businesses={loading ? [] : rows}>
      {refreshFailed}
      {/* redesign SL-(R-02): a wrapper without a definite height, so the table is as tall as its rows and the pagination follows them */}
      <div className='odc-sl-table'>
      <DataTable
        label={t('STORES_LIST', 'Stores list')}
        columns={tableColumns}
        rows={rows}
        getRowId={business => business.id}
        selection={{
          selectedIds: businessIds,
          onToggle: id => handleChangeBusinessIds(id),
          onToggleAll: toggleAll,
          allLabel: t('SELECT_ALL', 'Select all'),
          rowLabel: selectLabel
        }}
        onClearSelection={() => setBusinessIds([])}
        activeRowId={detailsBusinessId != null && Number.isFinite(Number(detailsBusinessId)) ? Number(detailsBusinessId) : undefined}
        onOpenRow={business => handleOpenBusinessDetails(business)}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonRows={SKELETON_ROWS}
        scrollLabel={t('STORES_TABLE_SCROLL_REGION', 'Stores table, scrolls sideways')}
        empty={emptyState()}
      />
      </div>
      {foot}
    </StoreRowControllers>
  )
}
