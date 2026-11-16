import React, { useContext, useEffect, useId, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTrackedLoadState } from '~/analytics/useTrackedLoadState'
import { useLanguage, useUtils, useConfig, DashboardOrdersList } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { Avatar, Button, Count, EmptyState, InlineNotice, Menu, Pagination, SegmentedControl, Skeleton, Status } from '../../Shared/Product'
import { FilterX, Inbox, TriangleAlert } from '../../Shared/Icon'
import { addQueryToUrl } from '../../../utils'
import { getOrderStatusFamily } from '../../../utils/orderStatusFamily'
import { getOrderStatusPrefix } from '../../../utils/orderStatus'
import { hasActiveFilterValues } from '../OrdersFilterGroup/activeFilters'
import { CHAT_ENDED_STATUSES, scopeQuery } from './conversationScope'
import './conversation-list.css'

/**
 * Conversation list of the /messages inbox (redesign messages B3a; owner decisions 2A, 3A, 6A and 7A).
 *
 * `ConversationList` is the wired component: it runs the `DashboardOrdersList` controller with `ConversationListUI`, the way
 * `OrdersDashboardList` runs it with `OrdersListing`. The host (the inbox) owns the state and hands it in:
 *
 *  - everything the controller reads: `searchValue`, `filterValues` (a non-empty object: the controller does not load without
 *    keys), `driversList`, `franchisesList`, `propsToFetch`, … They go through untouched. `propsToFetch` has to ask for
 *    `id`, `status`, `delivery_type`, `external_id`, `customer`, `business`, `last_direct_message_at`, `unread_direct_count`
 *    and `unread_count` (the fields the rows read);
 *  - `scope` (`'active'` | `'all'`) with `onScopeChange(scope)`, and `sort` (`'last_direct_message_at'` | `'id'`) with
 *    `onSortChange(sort)`. The controller reloads from page 1 by itself when `orderStatus` or `orderBy` change;
 *  - `selectedId`, `onSelect(order, { byUser })` and `autoSelectFirst`: a click calls it with `byUser: true`; once per load,
 *    with nothing selected, `autoSelectFirst` selects the first order with `byUser: false`;
 *  - `onOrdersChange(orders)`: the live orders (status, driver, counts) every time the list changes;
 *  - `unreadResetSignal` (redesign messages R2.2, M-08): `{ orderId, seq }` or null; a new `seq` zeroes the unread counts of that
 *    order in the controller, even when the id is the one of the last signal;
 *  - `showBusiness`: the business name in the second line (a single-store owner does not need it repeated).
 *
 * From the controller it reads `orderList`, `pagination`, `getPageOrders`, `outsideMessages` and `arrival` (redesign messages B2).
 *
 * redesign messages R1 (P-02): with `isUseQuery` the page and its size travel in the URL, as in main: the wired list reads `page` and
 * `pageSize` for its first load and the UI writes them back (`addQueryToUrl`) once the total is known.
 */

const SORTS = ['last_direct_message_at', 'id']

// redesign messages B3a: the same page sizes as the other lists with a pagination foot (tanda P, 10/25/50, as main, so a
// main link with pageSize=25 keeps it).
const PAGE_SIZES = [10, 25, 50]
const SKELETON_ROWS = 6

// redesign messages R1 (P-02): the first page and size of the list, from the query. A value that is not a whole number, or a size the
// pager does not offer, reads as the default (page 1, 10 per page): a hand-edited URL never leaves the pager on a page that does not exist.
const readPaginationSettings = (search, isUseQuery) => {
  const query = new URLSearchParams(search)
  const page = Number(query.get('page'))
  const pageSize = Number(query.get('pageSize'))
  return {
    initialPage: isUseQuery && Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: isUseQuery && PAGE_SIZES.includes(pageSize) ? pageSize : 10,
    controlType: 'pages'
  }
}

// «Showing _from_–_to_ of _total_» with each figure in its own node (decision 11), as OrdersCards does.
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

// 7A: the messages of people count; the status changes that `unread_count` also holds do not. The old field only when the new one is absent.
const getUnread = (order) => Number(order?.unread_direct_count !== undefined ? order?.unread_direct_count : order?.unread_count) || 0

const getCustomerName = (order) => [order?.customer?.name, order?.customer?.lastname].filter(Boolean).join(' ').trim()

const ConversationRow = ({ order, selected, showBusiness, showExternalId, onSelect, t, dictionary, prefix, parseDate, getTimeAgo }) => {
  const number = (showExternalId && !!order?.external_id) ? order.external_id : order.id
  const customerName = getCustomerName(order)
  const unread = getUnread(order)
  const unreadPhrase = unread === 1
    ? t('UNREAD_MESSAGE_ONE', '1 unread message')
    : t('UNREAD_MESSAGES_COUNT', '_count_ unread messages').replace('_count_', String(unread))
  // the same text OrdersCards computes, the Reservation case included
  const statusText = (parseInt(order?.delivery_type, 10) === 9 && parseInt(order?.status, 10) === 13)
    ? (dictionary?.RESERVATION ?? t('RESERVATION', 'Reservation'))
    : getOrderStatusPrefix(order.status, dictionary, prefix)
  const lastMessageAt = order?.last_direct_message_at
  const name = [
    customerName || t('CUSTOMER', 'Customer'),
    `${t('ORDER_NUMBER', 'Order number')} ${number}`,
    ...(unread > 0 ? [unreadPhrase] : [])
  ].join(', ')

  return (
    <li className='odc-conv-item'>
      <button
        type='button'
        className='odc-conv-row'
        aria-label={name}
        aria-current={selected ? 'true' : undefined}
        data-selected={selected ? '' : undefined}
        data-ended={CHAT_ENDED_STATUSES.includes(Number(order?.status)) ? '' : undefined}
        onClick={() => onSelect?.(order, { byUser: true })}
      >
        <Avatar kind='person' size='lg' name={customerName} />
        <span className='odc-conv-body'>
          <span className='odc-conv-line'>
            <span className='odc-conv-name' title={customerName || undefined}>{customerName || t('CUSTOMER', 'Customer')}</span>
            <span className='odc-conv-number'> · #<bdi className='odc-figure'>{number}</bdi></span>
          </span>
          <span className='odc-conv-meta'>
            {showBusiness && !!order?.business?.name && (
              <span className='odc-conv-business' title={order.business.name}>{order.business.name}</span>
            )}
            <Status family={getOrderStatusFamily(order?.status)} label={statusText} wrap />
          </span>
        </span>
        <span className='odc-conv-aside'>
          {lastMessageAt
            // the API writes UTC: both helpers read it as UTC by default (W1-QB1-01); the absolute time is the project's format (decision 13)
            ? <span className='odc-conv-time' title={parseDate(lastMessageAt)}>{getTimeAgo(lastMessageAt)}</span>
            : <span className='odc-conv-time odc-muted'>{t('NO_MESSAGES_YET', 'No messages yet')}</span>}
          {unread > 0 && <Count value={unread} />}
        </span>
      </button>
    </li>
  )
}

const SkeletonRows = () => Array.from({ length: SKELETON_ROWS }, (_, index) => (
  <li className='odc-conv-item' key={index}>
    <div className='odc-conv-row' data-skeleton=''>
      <Skeleton shape='round' size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' />
      <span className='odc-conv-body'>
        <Skeleton size='60%' />
        <Skeleton size='85%' />
      </span>
      <Skeleton size='var(--od-x-sk-total)' />
    </div>
  </li>
))

export const ConversationListUI = (props) => {
  const {
    orderList,
    pagination,
    getPageOrders,
    scope,
    onScopeChange,
    sort,
    onSortChange,
    selectedId,
    onSelect,
    autoSelectFirst,
    onOrdersChange,
    showBusiness,
    searchValue,
    filterValues,
    outsideMessages,
    arrival,
    isUseQuery
  } = props
  const [{ dictionary }, t] = useLanguage()
  const [{ parseDate, getTimeAgo }] = useUtils()
  const [configState] = useConfig()
  const [configFile] = useContext(ConfigFileContext)
  const prefix = configFile?.app_internal_name?.toUpperCase()
  const showExternalId = configState?.configs?.change_order_id?.value === '1'

  const orders = orderList?.orders || []
  const loading = !!orderList?.loading
  const failed = !loading && !!orderList?.error
  const currentScope = scope === 'all' ? 'all' : 'active'
  const currentSort = sort === 'id' ? 'id' : 'last_direct_message_at'

  // redesign messages R1 (P-01): the load of /messages is reported under its own module, as OrdersListing did through
  // getOrdersAnalyticsModule({ isMessagesView: true }) (main's order cards carried it; the inbox replaced them)
  useTrackedLoadState({
    loading: orderList?.loading,
    error: orderList?.error,
    module: 'messages',
    action: 'load_orders',
    once: true
  })

  // redesign messages R1 (P-02): the page and its size go to the URL once the total is known (OrdersCards does the same)
  const totalKnown = pagination?.total != null
  useEffect(() => {
    if (!isUseQuery || !totalKnown || !pagination?.currentPage || !pagination?.pageSize) return
    addQueryToUrl({ page: pagination.currentPage, pageSize: pagination.pageSize })
  }, [isUseQuery, totalKnown, pagination?.currentPage, pagination?.pageSize, pagination?.total])

  // the host reads live order objects (status, driver) instead of the ones it first selected
  useEffect(() => {
    onOrdersChange?.(orderList?.orders)
  }, [orderList?.orders])

  // the first order is selected once per load, and only while nothing is selected
  const autoSelected = useRef(false)
  useEffect(() => {
    if (loading) {
      autoSelected.current = false
      return
    }
    if (!autoSelectFirst || autoSelected.current || selectedId != null || orders.length === 0) return
    autoSelected.current = true
    onSelect?.(orders[0], { byUser: false })
  }, [loading, orderList?.orders, selectedId, autoSelectFirst])

  // when the total drops under the page held, P/Pagination asks for the last valid page, but the controller already steps back by itself:
  // forwarding it would send the same request twice (redesign tramo B r1 fixes, W1-PB1-03)
  const lastPage = pagination?.total != null && pagination?.pageSize > 0 ? Math.max(1, Math.ceil(Number(pagination.total) / pagination.pageSize)) : null
  // redesign messages R1 (Q-03): «Go to first page» removes its own notice, and with it the focused button. The focus goes to the list
  // region at once (the page is not back yet) and to the first row when page 1 is in. `focusFirst` is the pending move: `loadSeen`
  // tells a load that has started from the rows of the page that is still on screen.
  const titleId = useId()
  const listRef = useRef(null)
  const focusFirst = useRef(false)
  const loadSeen = useRef(false)
  const handleFirstPage = () => {
    focusFirst.current = true
    loadSeen.current = loading
    listRef.current?.focus()
    getPageOrders?.(pagination.pageSize, 1)
  }
  useEffect(() => {
    if (!focusFirst.current) return
    if (loading) {
      loadSeen.current = true
      return
    }
    if (!loadSeen.current && Number(pagination?.currentPage) !== 1) return
    focusFirst.current = false
    const first = listRef.current?.querySelector('.odc-conv-row:not([data-skeleton])')
    first?.focus()
  }, [loading, orderList?.orders, pagination?.currentPage])

  const handleChangePage = (page) => {
    if (lastPage != null && pagination.currentPage > lastPage) return
    getPageOrders?.(pagination.pageSize, page)
  }
  const handleChangePageSize = (pageSize, expectedPage) => {
    getPageOrders?.(pageSize, expectedPage)
  }

  const sortLabels = {
    last_direct_message_at: t('NEWEST_MESSAGE', 'Newest message'),
    id: t('ORDER_NUMBER', 'Order number')
  }
  const sortLabel = sortLabels[currentSort]

  // 6A: the open conversation has its own log; only the other orders are announced
  let announcement = ''
  if (arrival && (selectedId == null || String(arrival.orderId) !== String(selectedId))) {
    const arrived = orders.find(order => String(order?.id) === String(arrival.orderId))
    const number = (showExternalId && !!arrived?.external_id) ? arrived.external_id : arrival.orderId
    announcement = t('NEW_MESSAGE_FROM', 'New message from _name_, order _id_')
      .replace('_name_', () => arrival.authorName || t('CUSTOMER', 'Customer'))
      .replace('_id_', () => String(number))
  }

  const narrowed = !!searchValue || hasActiveFilterValues(filterValues)
  const showOutside = Number(outsideMessages) > 0 && Number(pagination?.currentPage) > 1

  let content
  if (loading) {
    content = <ul className='odc-conv-items'><SkeletonRows /></ul>
  } else if (failed) {
    content = (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('ORDERS_LOAD_ERROR_TITLE', 'We couldn’t load the orders')}
        description={t('ORDERS_LOAD_ERROR_TEXT', 'The server didn’t answer. Check your connection and try again.')}
        action={<Button onClick={() => getPageOrders?.(pagination?.pageSize, pagination?.currentPage)}>{t('TRY_AGAIN', 'Try again')}</Button>}
      />
    )
  } else if (orders.length === 0) {
    // redesign messages R1 (Q-04): in «Active» a search only looks at the active conversations, so the empty state says so and
    // offers «All» (the search and the filters stay, they are the host's)
    content = narrowed
      ? currentScope === 'active'
        ? (
          <EmptyState
            icon={FilterX}
            title={t('NO_RESULTS', 'No results')}
            description={t('ONLY_ACTIVE_CONVERSATIONS_SEARCHED', 'Only active conversations are searched. Ended orders are in All.')}
            action={<Button onClick={() => onScopeChange?.('all')}>{t('SHOW_ALL', 'Show all')}</Button>}
          />
          )
        : (
          <EmptyState
            icon={FilterX}
            title={t('NO_RESULTS', 'No results')}
            description={t('TRY_ANOTHER_SEARCH_OR_FILTER', 'Try another search or clear the filters.')}
          />
          )
      : currentScope === 'active'
        ? (
          <EmptyState
            icon={Inbox}
            title={t('NO_ACTIVE_CONVERSATIONS', 'No active conversations')}
            action={<Button onClick={() => onScopeChange?.('all')}>{t('SHOW_ALL', 'Show all')}</Button>}
          />
          )
        : <EmptyState icon={Inbox} title={t('NO_ORDERS', 'No orders')} />
  } else {
    content = (
      <ul className='odc-conv-items'>
        {orders.map(order => (
          <ConversationRow
            key={order.id}
            order={order}
            selected={selectedId != null && String(order.id) === String(selectedId)}
            showBusiness={showBusiness}
            showExternalId={showExternalId}
            onSelect={onSelect}
            t={t}
            dictionary={dictionary}
            prefix={prefix}
            parseDate={parseDate}
            getTimeAgo={getTimeAgo}
          />
        ))}
      </ul>
    )
  }

  return (
    <section className='odc-root odc-conv'>
      <header className='odc-conv-head'>
        <h2 className='odc-conv-title' id={titleId}>{t('CONVERSATIONS', 'Conversations')}</h2>
        <div className='odc-conv-controls'>
          <div className='odc-conv-scope'>
            <SegmentedControl
              label={t('SHOW', 'Show')}
              value={currentScope}
              onValueChange={onScopeChange}
              options={[
                { value: 'active', label: t('ACTIVE', 'Active') },
                { value: 'all', label: t('ALL', 'All') }
              ]}
            />
          </div>
          <Menu
            label={sortLabel}
            triggerVariant='ghost'
            align='end'
            triggerProps={{ 'aria-label': `${t('SORT_BY', 'Sort by')}: ${sortLabel}` }}
            items={SORTS.map(key => ({
              key,
              type: 'radio',
              checked: key === currentSort,
              label: sortLabels[key],
              onSelect: () => onSortChange?.(key)
            }))}
          />
        </div>
      </header>

      {showOutside && (
        <InlineNotice
          tone='info'
          action={<Button size='sm' variant='ghost' onClick={handleFirstPage}>{t('GO_TO_FIRST_PAGE', 'Go to first page')}</Button>}
        >
          {Number(outsideMessages) === 1
            ? t('NEW_MESSAGES_ON_FIRST_PAGE_ONE', '1 new message on the first page')
            : t('NEW_MESSAGES_ON_FIRST_PAGE_OTHER', '_count_ new messages on the first page').replace('_count_', String(outsideMessages))}
        </InlineNotice>
      )}

      {/* 6A: one polite region, always mounted so the first announcement is read */}
      <div className='odc-sr-only odc-conv-live' aria-live='polite'>{announcement}</div>

      <div className='odc-conv-list' ref={listRef} role='region' aria-labelledby={titleId} tabIndex={-1} aria-busy={loading ? 'true' : undefined}>
        {loading && <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>}
        {content}
      </div>

      {pagination?.total != null && !failed && (
        <footer className='odc-conv-foot'>
          <Pagination
            page={pagination.currentPage}
            pageSize={pagination.pageSize}
            total={pagination.total}
            busy={loading}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={handleChangePage}
            onPageSizeChange={handleChangePageSize}
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            rangeLabel={(from, to, total, figure) => total == null ? null : fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figure)}
            pageStatusLabel={(current, total) => total == null ? '' : t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
          />
        </footer>
      )}
    </section>
  )
}

export const ConversationList = (props) => {
  const { scope, sort, unreadResetSignal } = props
  const [configState] = useConfig()
  const isShowSearchFilters = !configState?.configs?.search_box_enabled || configState?.configs?.search_box_enabled?.value === '1'
  const currentSort = sort === 'id' ? 'id' : 'last_direct_message_at'
  const { orderStatus, withMessagesOnly } = scopeQuery(scope)
  // redesign messages R1 (P-02): the first page and size, read once from the query (the controller keeps them after that)
  const { search } = useLocation()
  const paginationSettings = useMemo(() => readPaginationSettings(search, !!props.isUseQuery), [search, props.isUseQuery])

  return (
    <DashboardOrdersList
      {...props}
      scope={scope === 'all' ? 'all' : 'active'}
      sort={currentSort}
      UIComponent={ConversationListUI}
      useDefualtSessionManager
      asDashboard
      orderBy={currentSort}
      orderDirection={currentSort === 'id' ? 'desc' : 'asc'}
      orderStatus={orderStatus}
      withMessagesOnly={withMessagesOnly}
      pullInOnMessage
      isSearchByOrderId={isShowSearchFilters}
      isSearchByCustomerName={isShowSearchFilters}
      isSearchByCustomerEmail={isShowSearchFilters}
      isSearchByCustomerPhone={isShowSearchFilters}
      isSearchByDriverName={isShowSearchFilters}
      isSearchByBusinessName
      paginationSettings={paginationSettings}
      unreadResetSignal={unreadResetSignal ?? null}
      unreadByAuthor // redesign messages R2.2 (M-D12): only messages written by someone else count as unread
    />
  )
}
