import React, { useState, useEffect, useContext, useRef } from 'react'
import moment from 'moment'
import { useLanguage, useUtils, useConfig } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { Avatar, Button, Pagination, SlaBadge, Skeleton, Status } from '../../Shared/Product' // redesign W1-3 (T1-3-4): product pagination and skeleton, no third-party skeleton
import { ArrowRight, Phone } from '../../Shared/Icon' // redesign deliveries F2-B1 (decision 4): Lucide only
import { getOrderEtaMoment, SLA_PARSE_OPTIONS } from '../OrdersTable/orderEta'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { addQueryToUrl, getOrderStatusPrefix as getOrderStatus } from '../../../utils'
import { getOrderStatusFamily } from '../../../utils/orderStatusFamily' // redesign deliveries F2-B1 (decision 4): the family of the status, as the orders table uses it
import { useDeliveryBoard } from '../DeliveryDashboard/DeliveryBoardContext' // redesign deliveries F2-B1 (decision 3): canAssign / requestAssign come from the board
import { OrdersListContainer, WrapperPagination } from './styles'
import './delivery-card.css'

// redesign deliveries F2-B1 (DV-08): how long a card that arrived by socket stays highlighted
const ARRIVAL_MS = 2000

// redesign W1-3 (T1-3-4): the page sizes of the legacy pager, and «of _total_» with the figure in its own node (decision 11).
const PAGE_SIZES = [10, 25, 50]

const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

// redesign tramo B r1 fixes (W1-PB1-02): is there selected text that starts or ends inside the card?
const isSelectingTextIn = (card) => {
  const selection = typeof window !== 'undefined' ? window.getSelection?.() : null
  if (!selection || selection.isCollapsed || selection.toString() === '') return false
  return card.contains(selection.anchorNode) || card.contains(selection.focusNode)
}

export const OrdersCards = (props) => {
  const {
    isMessagesView,

    orderList,
    pagination,
    getPageOrders,
    handleOpenOrderDetail,
    selectedOrderCard,
    handleOrderCardClick,
    handleUpdateDriverLocation,
    isDelivery,
    isUseQuery,
    franchisesList
  } = props
  const [{ dictionary }, t] = useLanguage()
  const { width } = useWindowSize()
  const [{ parseDate, optimizeImage }] = useUtils()
  const [configState] = useConfig()
  const [configFile] = useContext(ConfigFileContext)
  const board = useDeliveryBoard() // redesign deliveries F2-B1 (decision 3): outside the board the context is empty and no card offers «Assign»
  const prefixForVariable = configFile.app_internal_name.toUpperCase()
  const showExternalId = configState?.configs?.change_order_id?.value === '1'
  const cateringTypes = [7, 8]
  const franchiseImages = !franchisesList?.error && franchisesList?.franchises?.reduce((imageKeys, franchise) => {
    imageKeys[franchise.id] = franchise.logo
    return imageKeys
  }, {})
  // redesign deliveries F2-B1 (DV-08): the orders that arrived by socket, for 2 s, and the announcement of the list
  const arrivalRef = useRef({ ids: null, page: null, pageSize: null })
  const arrivalTimer = useRef(null)
  const [newOrderIds, setNewOrderIds] = useState([])
  const [arrivalAnnouncement, setArrivalAnnouncement] = useState('')

  const getOrderNumber = (order) => (showExternalId && !!order?.external_id) ? order.external_id : order.id

  // redesign tramo B r1 fixes (W1-PB1-03): when the total drops under the page held, P/Pagination asks for the last valid page, but
  // DashboardOrdersList already steps back by itself (its effect on the pagination). Forwarding that call sent the same GET twice,
  // where main sent one, so the call that comes while the held page is past the last page is not forwarded.
  const lastPage = pagination?.total != null && pagination?.pageSize > 0 ? Math.max(1, Math.ceil(Number(pagination.total) / pagination.pageSize)) : null
  const handleChangePage = (page) => {
    if (lastPage != null && pagination.currentPage > lastPage) return
    getPageOrders(pagination.pageSize, page)
  }

  // P/Pagination hands over the page that keeps the first item in view: the same one this computed before
  const handleChangePageSize = (pageSize, expectedPage) => {
    getPageOrders(pageSize, expectedPage)
  }

  // redesign W1-3 (T1-3-4): the selection is its own button, a sibling of «View details»; nothing has to be filtered out of the click any more.
  const handleOrderClick = (order) => {
    handleOrderCardClick(order)
    const element = document.getElementById('deliveryDashboard')
    if ((isDelivery || isMessagesView) && width < 993 && element) element.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  // redesign tramo B r1 fixes (W1-QB1-03, W1-PB1-02): the mouse and the touch act on the card, as in main, so its text can be selected
  // and copied; the pressed button (for the keyboard and assistive technology) lets the pointer through and its Enter / Space click
  // bubbles to this same handler. «View details» acts on its own, and the click that ends a drag-selection inside the card is not a
  // selection of the card (a keyboard click has detail 0 and always counts).
  // redesign deliveries F2-B1 (decisions 3 and 5): «Assign» and the call link are card actions too (data-card-action).
  const handleCardClick = (event, order) => {
    if (event.target.closest?.('[data-card-action]')) return
    if (event.detail > 0 && isSelectingTextIn(event.currentTarget)) return
    handleOrderClick(order)
  }

  const getDelayMinutes = (order) => {
    // targetMin = delivery_datetime  + eta_time - now()
    // redesign W0-4a (T0-13, decision 13): the same reference as the table's SLA timer, in the machine format (data, not painted)
    const diffTimeAsSeconds = getOrderEtaMoment(order, parseDate, SLA_PARSE_OPTIONS).diff( // redesign tramo A r2 (W0-PA1-04)
      moment().utc(), 'seconds')
    return Math.ceil(diffTimeAsSeconds / 60)
  }

  const displayDelayedTime = (order) => {
    let tagetedMin = getDelayMinutes(order)
    // get day, hour and minutes
    const sign = tagetedMin >= 0 ? '' : '- '
    tagetedMin = Math.abs(tagetedMin)
    let day = Math.floor(tagetedMin / 1440)
    const restMinOfTargetedMin = tagetedMin - 1440 * day
    let restHours = Math.floor(restMinOfTargetedMin / 60)
    let restMins = restMinOfTargetedMin - 60 * restHours
    // make standard time format
    // redesign W1-3 (T1-3-4): the day suffix had no key (it was the English «day» glued to the number)
    // (T10, decision X-2): lower-case suffix, the number inside the key so a language can place it
    day = day === 0 ? '' : `${(day === 1 ? t('ETA_TIMER_DAY_ONE', '_count_ day') : t('ETA_TIMER_DAYS', '_count_ days')).replace('_count_', day)} `
    restHours = restHours < 10 ? '0' + restHours : restHours
    restMins = restMins < 10 ? '0' + restMins : restMins

    const finalTaget = sign + day + restHours + ':' + restMins
    return finalTaget
  }

  // redesign deliveries F2-B1 (decision 8, DV-02): the SLA badge follows time_status from the server, as /orders and the SLA filter do,
  // so «Late» filters what the cards say. The figure of the delay next to it is computed in the browser and goes neutral, no colour.
  const renderSlaBadge = (order) => {
    switch (order?.time_status) {
      case 'in_time':
        // (T10, decision X-2): the server says in_time, but an open order whose ETA already passed would sit next
        // to a negative timer; no «On time» then. A closed order or an ETA still ahead keeps it.
        if (!['done', 'cancel'].includes(getOrderStatusFamily(order.status)) && getDelayMinutes(order) < 0) return null
        return <SlaBadge level='ok' label={t('ON_TIME', 'On time')} />
      case 'at_risk': return <SlaBadge level='risk' label={t('AT_RISK', 'At risk')} />
      case 'delayed': return <SlaBadge level='late' label={t('DELAYED', 'Delayed')} />
      default: return null
    }
  }

  // redesign deliveries F2-B1 (decision 3): the call control is a link (tel:) drawn with the button classes of Product, because
  // IconButton renders a <button>; it keeps the target size of the Product buttons.
  const renderDriverLine = (order) => {
    const driver = order?.driver
    const person = driver || order?.external_driver
    if (person) {
      const personName = person.name
      const photo = driver?.photo || order?.external_driver?.photo
      const callLabel = `${t('CALL', 'Call')} ${personName}`
      return (
        <>
          <Avatar kind='person' name={personName} src={photo ? optimizeImage(photo, 'h_50,c_limit') : undefined} />
          <span className='odc-dcard-name' title={personName}>{personName}</span>
          {driver?.cellphone && (
            <a
              className='odc-btn odc-dcard-action'
              data-variant='ghost'
              data-size='sm'
              data-icon-only=''
              data-card-action=''
              href={`tel:${String(driver.cellphone).replace(/\s+/g, '')}`}
              aria-label={callLabel}
              title={callLabel}
            >
              <Phone className='odc-icon' aria-hidden='true' />
            </a>
          )}
          {order?.driver_company?.name && <span className='odc-dcard-company' title={order.driver_company.name}>{order.driver_company.name}</span>}
        </>
      )
    }
    if (order?.driver_company?.name) {
      return <span className='odc-dcard-company' title={order.driver_company.name}>{order.driver_company.name}</span>
    }
    // no driver, no external driver, no delivery company: «Unassigned», and «Assign» when the board allows it for this order
    const assignable = !order?.driver_company_id && board.canAssign?.(order)
    return (
      <>
        <span className='odc-dcard-unassigned'>{t('UNASSIGNED', 'Unassigned')}</span>
        {assignable && (
          <Button
            size='sm'
            className='odc-dcard-action'
            data-card-action=''
            aria-label={t('ASSIGN_DRIVER_TO_ORDER', 'Assign a driver to order _id_').replace('_id_', String(getOrderNumber(order)))}
            onClick={() => board.requestAssign?.(order)}
          >
            {t('ASSIGN', 'Assign')}
          </Button>
        )}
      </>
    )
  }

  useEffect(() => {
    if (orderList.loading || !selectedOrderCard) return
    const updatedOrder = orderList?.orders?.find(order => order.id === selectedOrderCard?.id)
    if (updatedOrder) {
      handleUpdateDriverLocation && handleUpdateDriverLocation(updatedOrder)
    }
  }, [orderList?.orders])

  useEffect(() => {
    if (!isUseQuery || !pagination?.currentPage || !pagination?.pageSize || !pagination?.total) return
    addQueryToUrl({
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    })
  }, [pagination?.currentPage, pagination?.pageSize, pagination?.total])

  // redesign deliveries F2-B1 (DV-08): an order that shows up while the page and its size stay the same arrived by socket (the controller
  // puts it in the list). The first load, a reload (filters) and a page change reset the baseline instead of counting. Same rule as OrdersTable.
  useEffect(() => {
    if (orderList?.loading) {
      arrivalRef.current = { ids: null, page: null, pageSize: null }
      return
    }
    const orders = orderList?.orders || []
    const ids = orders.map(order => order.id)
    const previous = arrivalRef.current
    if (previous.ids && previous.page === pagination?.currentPage && previous.pageSize === pagination?.pageSize) {
      const arrived = orders.filter(order => !previous.ids.has(order.id))
      if (arrived.length) {
        setNewOrderIds(arrived.map(order => order.id))
        setArrivalAnnouncement(t('NEW_ORDER_ARRIVED', 'New order _id_').replace('_id_', arrived.map(order => `#${getOrderNumber(order)}`).join(', ')))
        clearTimeout(arrivalTimer.current)
        arrivalTimer.current = setTimeout(() => {
          setNewOrderIds([])
          setArrivalAnnouncement('')
        }, ARRIVAL_MS)
      }
    }
    arrivalRef.current = { ids: new Set(ids), page: pagination?.currentPage, pageSize: pagination?.pageSize }
  }, [orderList?.loading, orderList?.orders, pagination?.currentPage, pagination?.pageSize])

  useEffect(() => () => clearTimeout(arrivalTimer.current), [])

  const etaLabel = t('ETA', 'ETA')

  return (
    <>
      <OrdersListContainer className='odc-delivery-list'>
        {/* redesign deliveries F2-B1 (DV-08): «New order #_number_», read once by the list; it stays mounted through the loads so the announcement is heard */}
        <span className='odc-sr-only' role='status' aria-live='polite' data-arrival-live=''>{arrivalAnnouncement}</span>
        {orderList.loading
          ? (
              [...Array(10).keys()].map(i => (
            <div key={i} className='odc-dcard' data-delivery-card='' data-skeleton='' aria-hidden='true'>
              {/* redesign deliveries F2-B1 (decision 4): the three lines of the real card, so it does not jump when the orders arrive */}
              <div className='odc-dcard-line odc-dcard-l1'>
                <Skeleton size='var(--od-x-sk-tab)' />
                <Skeleton size='var(--od-x-sk-status)' />
                <Skeleton size='var(--od-x-sk-sla)' block='var(--od-x-badge-height)' />
                <Skeleton size='var(--od-x-sk-tab)' align='end' />
              </div>
              <div className='odc-dcard-line odc-dcard-trip'>
                <div className='odc-dcard-route'>
                  <Skeleton shape='box' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
                  <Skeleton size='var(--od-x-sk-meta)' />
                </div>
                <Skeleton size='var(--od-x-sk-order)' align='end' />
              </div>
              <div className='odc-dcard-line odc-dcard-driver'>
                <div className='odc-dcard-who'>
                  <Skeleton shape='round' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
                  <Skeleton size='var(--od-x-sk-meta)' />
                </div>
                <Skeleton size='var(--od-x-sk-tab)' align='end' />
              </div>
            </div>
              ))
            )
          : (
          <>
            {orderList.orders?.map(order => {
              const orderNumber = getOrderNumber(order)
              const cardId = `odc-delivery-card-${order.id}`
              const selected = selectedOrderCard?.id === order.id
              const unreadCount = isMessagesView ? Number(order?.unread_count) || 0 : 0
              const isCatering = cateringTypes.includes(order?.delivery_type)
              const logo = franchiseImages?.[order?.business?.franchise_id] || order.business?.logo
              const destination = order?.customer?.zipcode
              const statusLabel = (parseInt(order?.delivery_type, 10) === 9 && parseInt(order?.status, 10) === 13)
                ? (dictionary?.RESERVATION ?? t('RESERVATION', 'Reservation'))
                : getOrderStatus(order.status, dictionary, prefixForVariable)
              return (
              <div
                key={order.id}
                className='odc-dcard'
                data-delivery-card=''
                data-active={selected ? '' : undefined}
                data-new={newOrderIds.includes(order.id) ? '' : undefined}
                onClick={event => handleCardClick(event, order)}
              >
                {/* redesign W1-3 (T1-3-4): a pressed button covers the card (as DriverSelectButton does) and «View details» sits above it as its sibling: no control inside another.
                    redesign tramo B r1 fixes (W1-QB1-03, W1-QB1-05): the pointer goes through it (the card takes the click); the unread count is part of its name */}
                <button
                  type='button'
                  className='odc-dcard-select'
                  aria-labelledby={`${cardId}-no ${cardId}-status${unreadCount > 0 ? ` ${cardId}-unread` : ''}`}
                  aria-pressed={selected}
                />
                {/* redesign deliveries F2-B1 (decisions 4 and 8; DV-02, DV-10): line 1, identity, status and SLA from the server; the delay figure neutral; no status bar, no «Timer» label */}
                <div className='odc-dcard-line odc-dcard-l1'>
                  <h2 id={`${cardId}-no`} className='odc-dcard-id'>
                    {/* the name keeps «Order number» for assistive technology; the eye reads «#» and the figure, isolated for right-to-left */}
                    <span className='odc-sr-only'>{t('INVOICE_ORDER_NO', 'Order number')}</span>{' '}
                    <span aria-hidden='true'>#</span><bdi className='odc-figure'>{orderNumber}</bdi>
                  </h2>
                  {/* redesign deliveries R1 (finding 5): at 400px the status text ellipsizes before the figure moves, so it carries its full text in title */}
                  <Status
                    id={`${cardId}-status`}
                    family={getOrderStatusFamily(order?.status)}
                    label={statusLabel}
                    title={statusLabel}
                  />
                  {renderSlaBadge(order)}
                  {unreadCount > 0 && (
                    <>
                      {/* redesign tramo B r1 fixes (W1-QB1-05): the pill is for the eye; the name of the card carries «_count_ unread messages» */}
                      <span id={`${cardId}-unread`} hidden>
                        {unreadCount === 1
                          ? t('UNREAD_MESSAGE_ONE', '1 unread message')
                          : t('UNREAD_MESSAGES_COUNT', '_count_ unread messages').replace('_count_', String(unreadCount))}
                      </span>
                      <span className='odc-dcard-unread' aria-hidden='true'>
                        <bdi className='odc-figure'>{order?.unread_count}</bdi>
                      </span>
                    </>
                  )}
                  {/* (tanda Y, X-R6): the timer counts from the ETA to now, so on a closed order it only grew («- 5 days 20:29»)
                      and said nothing about the delay; a closed order has none. Its hour stays on line 2 and its SLA badge stays. */}
                  {!['done', 'cancel'].includes(getOrderStatusFamily(order?.status)) && (
                    <span className='odc-dcard-eta' title={etaLabel}>
                      <span className='odc-sr-only'>{etaLabel}</span>{' '}
                      <bdi className='odc-figure'>{displayDelayedTime(order)}</bdi>
                    </span>
                  )}
                </div>
                {/* line 2: the trip (store, city, → customer destination when the order carries it) and the hour, isolated (DV-03) */}
                <div className='odc-dcard-line odc-dcard-trip'>
                  <div className='odc-dcard-route'>
                    <Avatar kind='business' name={order?.business?.name} src={logo ? optimizeImage(logo, 'h_50,c_limit') : undefined} />
                    {/* isolated like the destination, so in right-to-left a Latin name keeps its start and loses its end */}
                    <bdi className='odc-dcard-store' title={order?.business?.name}>{order?.business?.name}</bdi>
                    {/* redesign deliveries R1 (finding 5): the city and the store ellipsize before the destination; each cut text keeps its full text in title */}
                    {order?.business?.city?.name && <bdi className='odc-dcard-city' title={order.business.city.name}>{order.business.city.name}</bdi>}
                    {destination && (
                      <>
                        <ArrowRight className='odc-icon odc-icon-flip' aria-hidden='true' />
                        <bdi className='odc-dcard-dest' data-destination='' title={destination}>{destination}</bdi>
                      </>
                    )}
                  </div>
                  <div className='odc-dcard-when'>
                    {isCatering && (
                      <span>{t('CREATED_AT', 'Created at')}: <bdi className='odc-figure'>{parseDate(order?.created_at)}</bdi></span>
                    )}
                    <span>
                      {isCatering ? `${t('PLACED_TO', 'Placed to')}: ` : ''}
                      <bdi className='odc-figure'>{order?.delivery_datetime_utc ? parseDate(order?.delivery_datetime_utc) : parseDate(order?.delivery_datetime, { utc: false })}</bdi>
                    </span>
                    {order?.codigoPod && (
                      <span>{t('PODS', 'Pod')}: <bdi className='odc-figure'>{order?.codigoPod}</bdi></span>
                    )}
                  </div>
                </div>
                {/* line 3: the driver (call, company) or «Unassigned» with «Assign» (decision 3), and «View details» at the end */}
                <div className='odc-dcard-line odc-dcard-driver'>
                  <div className='odc-dcard-who'>
                    {renderDriverLine(order)}
                  </div>
                  <Button
                    variant='link'
                    className='odc-dcard-action'
                    data-card-action=''
                    onClick={() => handleOpenOrderDetail(order)}
                  >
                    {t('VIEW_DETAILS', 'View details')}
                  </Button>
                </div>
              </div>
              )
            })}
          </>
            )}
      </OrdersListContainer>
      {pagination && (
        <WrapperPagination>
          {/* redesign W1-3 (T1-3-4): P/Pagination with the same page sizes and the same getPageOrders(pageSize, page) request */}
          <Pagination
            page={pagination.currentPage}
            pageSize={pagination.pageSize}
            total={pagination.total}
            pageSizeOptions={PAGE_SIZES}
            showPageInput
            onPageChange={handleChangePage}
            onPageSizeChange={handleChangePageSize}
            label={t('PAGINATION', 'Pagination')}
            previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
            nextLabel={t('NEXT_PAGE', 'Next page')}
            pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
            pageLabel={t('PAGE', 'Page')}
            // redesign tramo B r1 fixes (W1-PB1-04): while the total is not known (the first load) there is no range to paint, not «Showing 1–10 of »
            rangeLabel={(from, to, total, figure) => total == null ? null : fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figure)}
            pageOfLabel={(totalPages, figure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total: totalPages }, figure)}
            // redesign tramo B r1 fixes (W1-PB1-04): the same for the live region, which read «Page 1 of null» while the total was not known
            pageStatusLabel={(current, total) => total == null ? '' : t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
          />
        </WrapperPagination>
      )}
    </>
  )
}
