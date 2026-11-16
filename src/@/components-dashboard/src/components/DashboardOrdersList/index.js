import React, { useEffect, useState, useRef } from 'react'
import PropTypes, { string, object, number } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useWebsocket } from '../../contexts/WebsocketContext'
import { useEvent } from '../../contexts/EventContext'
import { useConfig } from '../../contexts/ConfigContext'
import { isOrderStatusRegressionError } from '../../utils'
import moment from 'moment'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { applyInlineOrderStatusToList } from './inlineOrderStatusList'
import { numericSearchText } from './orderSearchInput'
dayjs.extend(utc)
dayjs.extend(timezone)

// Delivery moment used to order the list: the UTC one when the order has it.
const getDeliveryTime = (order) => {
  const value = order?.delivery_datetime_utc || order?.delivery_datetime
  if (!value) return null
  const time = moment(value, moment.ISO_8601).valueOf()
  return Number.isNaN(time) ? null : time
}

/**
 * Places orders the way the list is sorted (in place, like the array sort it wraps).
 * Orders that arrive by socket go through here, so every sortable option of the
 * list has to be known: `id`, `last_direct_message_at` and `delivery_datetime`.
 */
export const sortOrdersByOption = (option, orderDirection, array) => {
  if (option === 'id') {
    if (orderDirection === 'desc') {
      return array.sort((a, b) => b.id - a.id)
    }
    if (orderDirection === 'asc') {
      return array.sort((a, b) => a.id - b.id)
    }
  }
  if (option === 'last_direct_message_at') {
    return array.sort((a, b) => new Date(b.last_direct_message_at) - new Date(a.last_direct_message_at))
  }
  if (option === 'delivery_datetime') {
    const direction = orderDirection === 'desc' ? -1 : 1
    return array.sort((a, b) => {
      const timeA = getDeliveryTime(a)
      const timeB = getDeliveryTime(b)
      // Orders without a usable delivery time go last, whatever the direction.
      if (timeA === null || timeB === null) {
        if (timeA === timeB) return a.id - b.id
        return timeA === null ? 1 : -1
      }
      return (timeA - timeB) * direction || a.id - b.id
    })
  }
  return array
}

// «Select all N» on /orders: the ids of everything the list matches are read page by page.
// 100 per page is the largest page the dashboard already asks of any list endpoint; there is no
// evidence of the orders endpoint's own maximum, so the walk follows the `total_pages` the API
// answers with (a smaller page than asked for only means more requests).
export const MATCHING_ORDER_IDS_PAGE_SIZE = 100
// Safety stop: 100 pages of 100 are 10,000 orders. Past that the walk fails instead of returning a
// partial list, because acting on an incomplete «all» would be worse than not offering it.
export const MAX_MATCHING_ORDER_PAGES = 100

// redesign messages B2 (B2-2): a `message` event for an order that is not in the page pulls it in by id.
// At most 2 of those fetches run at once; the ids waiting keep the latest 10 distinct ones.
export const PULL_IN_MAX_IN_FLIGHT = 2
export const PULL_IN_MAX_QUEUED = 10

export const DashboardOrdersList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    propsToFetch,
    orders,
    isOnlyDelivery,
    driverId,
    customerId,
    businessId,
    franchiseId,
    orderIds,
    deletedOrderIds,
    orderStatus,
    orderBy,
    orderDirection,
    useDefualtSessionManager,
    paginationSettings,
    filterValues,
    searchValue,
    isSearchByOrderId,
    isSearchByCustomerName,
    isSearchByCustomerEmail,
    isSearchByCustomerPhone,
    isSearchByBusinessName,
    isSearchByDriverName,
    orderIdForUnreadCountUpdate,
    driversList,
    allowColumns,
    setAllowColumns,
    withMessagesOnly, // redesign messages B2 (B2-1)
    pullInOnMessage, // redesign messages B2 (B2-2)
    unreadByAuthor, // redesign messages R2.2 (M-D12)
    unreadResetSignal // redesign messages R2.2 (M-08)
  } = props

  const [ordering] = useApi()
  const [events] = useEvent()
  const [configState] = useConfig()
  const [{ user }] = useSession()

  const [orderList, setOrderList] = useState({ loading: !orders, error: null, orders: [] })
  const [pagination, setPagination] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage : 1,
    pageSize: paginationSettings.pageSize ?? 10
  })
  const [session] = useSession()
  const socket = useWebsocket()
  const accessToken = useDefualtSessionManager ? session.token : props.accessToken
  const requestsState = {}
  const [, setActionStatus] = useState({ loading: false, error: null })
  const firstRender = useRef(true)
  const filterDefaultOrderDate = configState?.configs?.filter_default_order_date?.value
  const isRegressionValidationEnabled = configState?.configs?.order_status_regression_validation_enabled?.value === '1'
  const filterDefaultOrderValues = ['today', 'last_seven_days']

  const sortOrdersArray = (option, array) => sortOrdersByOption(option, orderDirection, array)

  // redesign messages B2 (B2-2): state of the opt-in «pull in on message» behaviour.
  const [outsideMessages, setOutsideMessages] = useState(0)
  const [arrival, setArrival] = useState(null)
  const mounted = useRef(true)
  const pullState = useRef({ inFlight: new Set(), queued: [], messages: new Map() })
  // Always the latest render's closure: a fetch that ends later (or a queued id that starts later) must read
  // the where, the page and the sort of NOW, and be dropped when they changed while it was in flight.
  const latest = useRef({})
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  /**
   * Method to change order status from API
   * @param {object} order orders id and new status
   */
  const handleUpdateOrderStatus = async (order) => {
    try {
      setActionStatus({ loading: true, error: null })
      const source = {}
      requestsState.updateOrders = source
      const { content } = await ordering.setAccessToken(accessToken).orders(order?.id).save({ status: order.newStatus, ...(order.reasons && { reasons: order.reasons }) }, {
        cancelToken: source,
        headers: {
          'X-Internal-Product-X': ordering.appInternalName
        }
      })
      if (content.error) {
        const errorMessages = Array.isArray(content.result) ? content.result : [content.result]
        if (isRegressionValidationEnabled && !order.reasons && isOrderStatusRegressionError(content.error_codes)) {
          setActionStatus({ loading: false, error: null })
          return { error: true, regressionRequired: true, result: errorMessages }
        }
        setActionStatus({ loading: false, error: errorMessages })
        return { error: true, result: errorMessages }
      }
      setActionStatus({ loading: false, error: null })
      setOrderList(prevState => ({
        ...prevState,
        orders: applyInlineOrderStatusToList({
          orders: prevState.orders,
          orderId: order?.id,
          newStatus: order?.newStatus,
          visibleStatuses: orderStatus,
          updatedOrder: content.result
        })
      }))
      return { error: false }
    } catch (err) {
      const errorMessages = [err.message]
      setActionStatus({ loading: false, error: errorMessages })
      return { error: true, result: errorMessages }
    }
  }

  /**
   * Method to get orders from API
   * @param {number} page page number
   * @param {string[]} [selectAttributes] attributes to ask for instead of `propsToFetch` (the id walk
   * of «Select all N» asks for `id` only). Same where, same order, same everything else.
   * @param {object[]} [extraConditions] conditions ANDed at the end of the where (redesign messages B2: the
   * pull-in of one order asks with the list's own where plus its id).
   */
  const getOrders = async (pageSize, page, selectAttributes, extraConditions) => {
    let where = []
    const conditions = []
    const options = {
      query: {
        orderBy: (orderDirection === 'desc' ? '-' : '') + orderBy,
        page,
        page_size: pageSize
      }
    }

    const orConditions = [{
      attribute: 'has_items',
      value: {
        condition: '=',
        value: true
      }
    }, {
      attribute: 'cloned_order_id',
      value: {
        condition: '!=',
        value: null
      }
    }]

    const isFilteringByOrderType = filterValues?.deliveryTypes?.length > 0
    if (!isFilteringByOrderType) {
      orConditions.push({
        attribute: 'delivery_type',
        value: {
          condition: '=',
          value: 9
        }
      })
    }

    conditions.push({
      conector: 'OR',
      conditions: orConditions
    })

    if (orderIds) {
      conditions.push({ attribute: 'id', value: orderIds })
    }

    if (Object.keys(filterValues).length === 0) {
      if (orderStatus) {
        conditions.push({ attribute: 'status', value: orderStatus })
      }
    } else {
      if (filterValues.statuses.length > 0) {
        // const checkInnerContain = filterValues.statuses.every((el) => {
        //   return orderStatus.indexOf(el) !== -1
        // })

        // const checkOutContain = orderStatus.every((el) => {
        //   return filterValues.statuses.indexOf(el) !== -1
        // })

        // if (checkInnerContain) conditions.push({ attribute: 'status', value: filterValues.statuses })
        // if (checkOutContain) {
        //   if (orderStatus) {
        //     conditions.push({ attribute: 'status', value: orderStatus })
        //   }
        // }
        const getFilterStatusInOrderStatus = filterValues.statuses.filter(status => orderStatus.includes(status))
        conditions.push({ attribute: 'status', value: getFilterStatusInOrderStatus })
      } else {
        if (orderStatus) {
          conditions.push({ attribute: 'status', value: orderStatus })
        }
      }
    }

    if (isOnlyDelivery) {
      conditions.push(
        {
          attribute: 'delivery_type',
          value: [1, 7]
        }
      )
    }
    if (driverId) {
      conditions.push(
        {
          attribute: 'driver_id',
          value: driverId
        }
      )
    }

    if (customerId) {
      conditions.push(
        {
          attribute: 'customer_id',
          value: customerId
        }
      )
    }

    if (businessId) {
      conditions.push(
        {
          attribute: 'business_id',
          value: businessId
        }
      )
    }

    if (franchiseId) {
      conditions.push({
        attribute: 'ref_business',
        conditions: [{
          attribute: 'franchise_id',
          value: franchiseId
        }]
      })
    }

    if (searchValue) {
      const searchConditions = []
      if (isSearchByOrderId) {
        const orderId = numericSearchText(searchValue)
        if (orderId !== null) {
          searchConditions.push({
            attribute: 'id',
            value: {
              condition: 'ilike',
              value: encodeURIComponent(`%${orderId}%`)
            }
          })
        }
        searchConditions.push(
          {
            attribute: 'external_id',
            value: {
              condition: 'ilike',
              value: encodeURIComponent(`%${searchValue}%`)
            }
          }
        )
      }
      if (isSearchByCustomerName) {
        searchConditions.push(
          {
            attribute: 'customer',
            conditions: [
              {
                attribute: 'name',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${searchValue}%`)
                }
              }
            ]
          }
        )
      }
      if (isSearchByCustomerEmail) {
        searchConditions.push(
          {
            attribute: 'customer',
            conditions: [
              {
                attribute: 'email',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${searchValue}%`)
                }
              }
            ]
          }
        )
      }

      if (isSearchByCustomerPhone) {
        searchConditions.push(
          {
            attribute: 'customer',
            conditions: [
              {
                attribute: 'cellphone',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${searchValue}%`)
                }
              }
            ]
          }
        )
      }

      if (isSearchByBusinessName) {
        searchConditions.push(
          {
            attribute: 'business',
            conditions: [
              {
                attribute: 'name',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${searchValue}%`)
                }
              }
            ]
          }
        )
      }

      if (isSearchByDriverName) {
        searchConditions.push(
          {
            attribute: 'driver',
            conditions: [
              {
                attribute: 'name',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${searchValue}%`)
                }
              }
            ]
          }
        )
      }
      conditions.push({
        conector: 'OR',
        conditions: searchConditions
      })
    }

    if (Object.keys(filterValues).length) {
      const filterConditons = []
      if (filterValues?.orderId) {
        filterConditons.push(
          {
            attribute: 'id',
            value: {
              condition: 'ilike',
              value: encodeURI(`%${filterValues?.orderId}%`)
            }
          }
        )
      }
      if (filterValues?.logisticStatus !== null) {
        filterConditons.push(
          {
            attribute: 'logistic_status',
            value: filterValues?.logisticStatus
          }
        )
      }
      if (filterValues?.assigned !== null) {
        if (filterValues?.assigned === 0) {
          filterConditons.push(
            {
              attribute: 'driver_id',
              value: {
                condition: '>=',
                value: 0
              }
            }
          )
        }
        if (filterValues?.assigned === 1) {
          filterConditons.push(
            {
              attribute: 'driver_id',
              value: null
            }
          )
        }
      }
      if (filterValues?.fraudStatus) {
        filterConditons.push(
          {
            attribute: 'fraud_status',
            value: filterValues?.fraudStatus
          }
        )
      }
      if (filterValues?.externalId) {
        filterConditons.push(
          {
            attribute: 'external_id',
            value: {
              condition: 'ilike',
              value: encodeURIComponent(`%${filterValues?.externalId}%`)
            }
          }
        )
      }
      if (filterValues?.metafield?.length > 0) {
        const metafieldConditions = filterValues?.metafield.map(item => (
          {
            attribute: 'metafields',
            conditions: [
              {
                attribute: 'key',
                value: item?.key
              },
              {
                attribute: 'value',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${item?.value}%`)
                }
              }
            ],
            conector: 'AND'
          }
        ))
        filterConditons.push({
          conector: 'OR',
          conditions: metafieldConditions
        })
      }
      if (filterValues.deliveryFromDatetime !== null || filterDefaultOrderValues.includes(filterDefaultOrderDate)) {
        const now = dayjs()
        let defaultDateFilter
        if (filterDefaultOrderDate === 'today') {
          if (user?.timezone && user?.timezone !== 'UTC') {
            const nowInUserTimezone = now.tz(user?.timezone).startOf('day')
            defaultDateFilter = nowInUserTimezone.utc().format('YYYY-MM-DD HH:mm:ss')
          } else {
            const today = now.format('YYYY-MM-DD')
            defaultDateFilter = dayjs(today).format('YYYY-MM-DD HH:mm:ss')
          }
        }
        if (filterDefaultOrderDate === 'last_seven_days') {
          const last7day = now.subtract('7', 'day').format('YYYY-MM-DD')
          defaultDateFilter = dayjs(last7day).format('YYYY-MM-DD HH:mm:ss')
        }
        filterConditons.push(
          {
            attribute: 'delivery_datetime',
            value: {
              condition: '>=',
              value: encodeURI(filterValues.deliveryFromDatetime || defaultDateFilter)
            }
          }
        )
      }
      if (filterValues.deliveryEndDatetime !== null) {
        filterConditons.push(
          {
            attribute: 'delivery_datetime',
            value: {
              condition: '<=',
              value: filterValues.deliveryEndDatetime
            }
          }
        )
      }
      if (filterValues.businessIds.length !== 0) {
        filterConditons.push(
          {
            attribute: 'business_id',
            value: filterValues.businessIds
          }
        )
      }
      if (filterValues?.countryCode.length !== 0) {
        filterConditons.push(
          {
            attribute: 'country_code',
            value: filterValues?.countryCode
          }
        )
      }
      if (filterValues?.currency.length !== 0) {
        filterConditons.push(
          {
            attribute: 'currency',
            value: filterValues?.currency
          }
        )
      }
      if (filterValues.driverIds.length !== 0) {
        filterConditons.push(
          {
            attribute: 'driver_id',
            value: filterValues.driverIds
          }
        )
      }
      if (filterValues.deliveryTypes.length !== 0) {
        filterConditons.push(
          {
            attribute: 'delivery_type',
            value: filterValues.deliveryTypes
          }
        )
      }
      if (filterValues.groupTypesUnassigned.length !== 0) {
        filterConditons.push(
          {
            attribute: 'driver_group_id',
            value: filterValues.groupTypesUnassigned
          }
        )
      }
      if (filterValues.driverGroupBusinessIds.length !== 0) {
        filterConditons.push(
          {
            attribute: 'driver_group_business',
            conditions: [
              {
                attribute: 'driver_group_id',
                value: {
                  condition: '=',
                  value: filterValues.driverGroupBusinessIds
                }
              }
            ]
          }
        )
      }
      if (filterValues.paymethodIds.length !== 0) {
        filterConditons.push(
          {
            attribute: 'paymethod_id',
            value: filterValues.paymethodIds
          }
        )
      }
      if (filterValues?.cityIds.length !== 0) {
        filterConditons.push(
          {
            attribute: 'business',
            conditions: [
              {
                attribute: 'city_id',
                value: filterValues?.cityIds
              }
            ]
          }
        )
      }
      if (filterValues?.customerName) {
        filterConditons.push(
          {
            attribute: 'customer',
            conditions: [
              {
                attribute: 'name',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${filterValues?.customerName}%`)
                }
              }
            ]
          }
        )
      }
      if (filterValues?.customerLastname) {
        filterConditons.push(
          {
            attribute: 'customer',
            conditions: [
              {
                attribute: 'lastname',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${filterValues?.customerLastname}%`)
                }
              }
            ]
          }
        )
      }
      if (filterValues?.customerCellphone) {
        filterConditons.push(
          {
            attribute: 'customer',
            conditions: [
              {
                attribute: 'cellphone',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${filterValues?.customerCellphone}%`)
                }
              }
            ]
          }
        )
      }
      if (filterValues?.customerEmail) {
        filterConditons.push(
          {
            attribute: 'customer',
            conditions: [
              {
                attribute: 'email',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${filterValues?.customerEmail}%`)
                }
              }
            ]
          }
        )
      }
      if (filterValues.administratorIds.length !== 0) {
        conditions.push(
          {
            attribute: 'agent_id',
            value: filterValues.administratorIds
          }
        )
      }
      if (filterValues?.offerId) {
        filterConditons.push(
          {
            attribute: 'offers',
            conditions: [
              {
                attribute: 'offer_id',
                value: {
                  condition: '=',
                  value: filterValues?.offerId
                }
              }
            ]
          }
        )
      }
      if (filterValues?.coupon) {
        filterConditons.push(
          {
            attribute: 'offers',
            conditions: [
              {
                attribute: 'coupon',
                value: {
                  condition: '=',
                  value: filterValues?.coupon
                }
              }
            ]
          }
        )
      }
      if (filterValues?.timeStatus) {
        filterConditons.push(
          {
            attribute: 'time_status',
            value: filterValues?.timeStatus
          }
        )
      }
      if (filterConditons.length) {
        conditions.push({
          conector: 'AND',
          conditions: filterConditons
        })
      }
    }

    // redesign messages B2 (B2-1): only orders with direct messages, ANDed with everything above. Every path
    // that asks for orders goes through here, so page loads, page changes, reloads and the id walk all carry it.
    if (withMessagesOnly) {
      conditions.push({
        attribute: 'last_direct_message_at',
        value: {
          condition: '!=',
          value: null
        }
      })
    }
    // redesign messages B2 (B2-2): the pull-in of one order adds its id to the list's own where.
    if (extraConditions?.length) {
      conditions.push(...extraConditions)
    }

    if (conditions.length) {
      where = {
        conditions,
        conector: 'AND'
      }
    }

    const source = {}
    // the id walk is not the list's own request: it must not become what the list cancels
    if (!selectAttributes && !extraConditions) requestsState.orders = source
    options.cancelToken = source
    const attributes = selectAttributes ?? propsToFetch
    let functionFetch
    if (attributes) {
      functionFetch = ordering.setAccessToken(accessToken).orders().asDashboard().select(attributes).where(where)
    } else {
      functionFetch = ordering.setAccessToken(accessToken).orders().asDashboard().where(where)
    }
    return await functionFetch.get(options)
  }
  /**
   * Ids of every order the list matches (current tab, filters and search), not just the page.
   * Reuses `getOrders`, so the where cannot drift from the list's. Rejects on an API error or past
   * `MAX_MATCHING_ORDER_PAGES`; it never returns a partial list. Does not touch the list state.
   * @returns {Promise<number[]>}
   */
  const getAllMatchingOrderIds = async () => {
    const ids = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      if (page > MAX_MATCHING_ORDER_PAGES) throw new Error('Too many orders to select at once')
      const { content } = await getOrders(MATCHING_ORDER_IDS_PAGE_SIZE, page, ['id'])
      if (content.error) {
        throw new Error(String(Array.isArray(content.result) ? content.result[0] : content.result))
      }
      ids.push(...content.result.map(order => order.id))
      totalPages = content.pagination?.total_pages ?? 1
      page += 1
    }
    return ids
  }

  /**
   * Method to detect if incoming order and update order belong to filter.
   * @param {Object} order incoming order and update order
   */
  const isFilteredOrder = (order, lastHistoryData) => {
    let filterCheck = true
    if (searchValue) {
      let searchCheck = false
      const lowerCaseSearchValue = searchValue.toLowerCase()
      if (isSearchByOrderId) {
        const orderId = numericSearchText(searchValue)
        if (orderId !== null && (order?.id?.toString() || '').includes(orderId)) searchCheck = true
        if ((order?.external_id || '').toLowerCase().includes(lowerCaseSearchValue)) searchCheck = true
      }
      if (isSearchByCustomerName) {
        if ((order?.customer?.name || '').toLowerCase().includes(lowerCaseSearchValue)) searchCheck = true
      }

      if (isSearchByCustomerEmail) {
        if ((order?.customer?.email || '').toLowerCase().includes(lowerCaseSearchValue)) searchCheck = true
      }

      if (isSearchByCustomerPhone) {
        if ((order?.customer?.cellphone || '').toLowerCase().includes(lowerCaseSearchValue)) searchCheck = true
      }

      if (isSearchByBusinessName) {
        if ((order?.business?.name || '').toLowerCase().includes(lowerCaseSearchValue)) searchCheck = true
      }

      if (isSearchByDriverName) {
        if ((order?.driver?.name || '').toLowerCase().includes(lowerCaseSearchValue)) searchCheck = true
      }
      if (!searchCheck) filterCheck = false
    }

    if (orderStatus !== undefined && orderStatus.length > 0) {
      const lastStatus = lastHistoryData?.find(item => item.attribute === 'status')?.old
      if (!orderStatus.includes(parseInt(order.status)) && !orderStatus.includes(parseInt(lastStatus))) {
        filterCheck = false
      }
    }
    if (filterValues?.customerName) {
      if (!order?.customer?.name?.toString().includes(filterValues?.customerName)) filterCheck = false
    }
    if (filterValues?.customerLastname) {
      if (!order?.customer?.lastname?.toString().includes(filterValues?.customerLastname)) filterCheck = false
    }
    if (filterValues?.customerCellphone) {
      if (!order?.customer?.cellphone?.toString().includes(filterValues?.customerCellphone)) filterCheck = false
    }
    if (filterValues?.orderId) {
      if (!order?.id?.toString().includes(filterValues?.orderId)) filterCheck = false
    }
    if (filterValues?.externalId) {
      if (!order?.external_id?.toString().includes(filterValues?.externalId)) filterCheck = false
    }
    if (filterValues?.deliveryFromDatetime) {
      const isBefore = moment(order?.delivery_datetime).isBefore(filterValues?.deliveryFromDatetime, 'second')
      if (isBefore) filterCheck = false
    }
    if (filterValues.deliveryEndDatetime) {
      const isAfter = moment(order?.delivery_datetime).isAfter(filterValues?.deliveryEndDatetime, 'second')
      if (isAfter) filterCheck = false
    }
    if (filterValues.businessIds !== undefined && filterValues.businessIds.length > 0) {
      if (!filterValues.businessIds.includes(order.business_id)) {
        filterCheck = false
      }
    }
    if (filterValues?.countryCode?.length > 0) {
      if (!filterValues.countryCode.includes(order?.country_code)) filterCheck = false
    }
    if (filterValues?.cityIds?.length > 0) {
      if (!filterValues.cityIds.includes(order.city_id)) {
        filterCheck = false
      }
    }
    if (filterValues.driverIds !== undefined && filterValues.driverIds.length > 0) {
      const lastDriverId = lastHistoryData?.find(item => item.attribute === 'driver_id')?.old
      if (!filterValues.driverIds.includes(order.driver_id) && !filterValues.driverIds.includes(lastDriverId)) {
        filterCheck = false
      }
    }
    if (filterValues.deliveryTypes !== undefined && filterValues.deliveryTypes.length > 0) {
      if (!filterValues.deliveryTypes.includes(order.delivery_type)) {
        filterCheck = false
      }
    }
    if (filterValues.paymethodIds !== undefined && filterValues.paymethodIds.length > 0) {
      if (!filterValues.paymethodIds.includes(order.paymethod_id)) {
        filterCheck = false
      }
    }
    if (filterValues?.driverGroupIds?.length > 0) {
      if (!filterValues?.driverGroupIds?.some(driverGroup => order?.driver_group_id === driverGroup)) {
        filterCheck = false
      }
    }
    if (filterValues?.driverGroupBusinessIds?.length > 0) {
      if (!filterValues?.driverGroupBusinessIds?.some(driverGroup => order?.assignable_driver_groups?.includes?.(driverGroup))) {
        filterCheck = false
      }
    }
    if (filterValues?.groupTypesUnassigned?.length > 0) {
      if (!filterValues?.groupTypesUnassigned?.some(driverGroup => order?.driver_group_id === driverGroup)) {
        filterCheck = false
      }
    }
    if (filterValues?.currency?.length > 0) {
      if (!filterValues.currency.includes(order?.currency)) filterCheck = false
    }
    if (filterValues?.logisticStatus) {
      const lastLogisticStatus = lastHistoryData?.find(item => item.attribute === 'logistic_status')?.old
      if (order?.logistic_status !== parseInt(filterValues?.logisticStatus) && lastLogisticStatus !== parseInt(filterValues?.logisticStatus)) filterCheck = false
    }
    if (filterValues?.metafield?.length > 0) {
      filterValues.metafield.forEach(item => {
        const found = order?.metafields?.find(meta => meta.key === item.key && meta.value.includes(item.value))
        if (!found) {
          filterCheck = false
        }
      })
    }
    if (filterValues?.offerId) {
      if (!order?.offerId?.toString().includes(filterValues?.offerId)) filterCheck = false
    }
    if (filterValues?.coupon) {
      if (!order?.coupon?.toString().includes(filterValues?.coupon)) filterCheck = false
    }
    if (filterValues?.timeStatus) {
      if (order?.time_status !== filterValues?.timeStatus) filterCheck = false
    }
    return filterCheck
  }

  const loadOrders = async () => {
    if (!session.token) return
    try {
      setOrderList({ ...orderList, loading: true })
      const response = await getOrders(pagination.pageSize, firstRender.current ? pagination.currentPage : 1)

      if (!response.content.error) {
        setPagination({
          currentPage: response.content.pagination.current_page,
          pageSize: response.content.pagination.page_size === 0 ? pagination.pageSize : response.content.pagination.page_size,
          totalPages: response.content.pagination.total_pages,
          total: response.content.pagination.total,
          from: response.content.pagination.from,
          to: response.content.pagination.to
        })
        // redesign messages B2 (B2-2): a fresh page 1 has no «outside» messages left to announce
        if (response.content.pagination.current_page === 1) setOutsideMessages(0)
      }

      setOrderList({
        loading: false,
        orders: response.content.error ? [] : response.content.result,
        error: response.content.error ? response.content.result : null
      })
      firstRender.current = false
    } catch (err) {
      if (err.constructor.name !== 'Cancel') {
        setOrderList({ ...orderList, loading: false, error: [err.message] })
      }
    }
  }
  const loadMoreOrders = async () => {
    setOrderList({ ...orderList, loading: true })
    try {
      const response = await getOrders(pagination.pageSize, pagination.currentPage + 1)
      setOrderList({
        loading: false,
        orders: response.content.error ? orderList.orders : orderList.orders.concat(response.content.result),
        error: response.content.error ? response.content.result : null
      })
      if (!response.content.error) {
        setPagination({
          currentPage: response.content.pagination.current_page,
          pageSize: response.content.pagination.page_size === 0 ? pagination.pageSize : response.content.pagination.page_size,
          totalPages: response.content.pagination.total_pages,
          total: response.content.pagination.total,
          from: response.content.pagination.from,
          to: response.content.pagination.to
        })
      }
    } catch (err) {
      if (err.constructor.name !== 'Cancel') {
        setOrderList({ ...orderList, loading: false, error: [err.message] })
      }
    }
  }
  const getPageOrders = async (pageSize, page) => {
    setOrderList({ ...orderList, loading: true })
    try {
      const response = await getOrders(pageSize, page)
      setOrderList({
        loading: false,
        orders: response.content.error ? orderList.orders : response.content.result,
        error: response.content.error ? response.content.result : null
      })
      if (!response.content.error) {
        // redesign messages B2 (B2-2): loading page 1 resets the count of messages that arrived for other pages
        if (page === 1) setOutsideMessages(0)
        setPagination({
          currentPage: response.content.pagination.current_page,
          pageSize: response.content.pagination.page_size === 0 ? pagination.pageSize : response.content.pagination.page_size,
          totalPages: response.content.pagination.total_pages,
          total: response.content.pagination.total,
          from: response.content.pagination.from,
          to: response.content.pagination.to
        })
      }
    } catch (err) {
      if (err.constructor.name !== 'Cancel') {
        setOrderList({ ...orderList, loading: false, error: [err.message] })
      }
    }
  }

  /**
  * Method to handle drag drop
  */
  const handleDrop = (event, columnName) => {
    event.preventDefault()
    const transferColumnName = event.dataTransfer.getData('transferColumnName')
    if (columnName === transferColumnName) return
    const transferColumnOrder = allowColumns[transferColumnName]?.order
    const currentColumnOrder = allowColumns[columnName]?.order

    const [lessOrder, greaterOrder] = transferColumnOrder < currentColumnOrder ? [transferColumnOrder, currentColumnOrder] : [currentColumnOrder, transferColumnOrder]
    const _remainAllowColumns = {}
    const shouldUpdateColumns = Object.keys(allowColumns).filter(col => col !== transferColumnName && allowColumns[col]?.order >= lessOrder && allowColumns[col]?.order <= greaterOrder)
    shouldUpdateColumns.forEach(col => {
      _remainAllowColumns[col] = {
        ...allowColumns[col],
        order: allowColumns[col]?.order + ((transferColumnOrder < currentColumnOrder) ? -1 : 1)
      }
    })

    const _allowColumnsUpdated = {
      ...allowColumns,
      [transferColumnName]: { ...allowColumns[transferColumnName], order: currentColumnOrder },
      ..._remainAllowColumns
    }
    saveUserSettings(_allowColumnsUpdated)
    setAllowColumns(_allowColumnsUpdated)
  }

  const saveUserSettings = async (allowColumnsUpdated) => {
    try {
      if (!session?.user?.id) return
      const _settings = session?.user?.settings
      const _allowColumnsUpdated = Object.keys(allowColumnsUpdated).reduce((acc, key) => {
        const { title, ...rest } = allowColumnsUpdated[key] || {}
        acc[key] = rest
        return acc
      }, {})
      await ordering.users(session?.user?.id).save({ settings: { ..._settings, orderColumns: _allowColumnsUpdated } }, {
        accessToken
      })
    } catch (err) {
      console.warn(err, 'error')
    }
  }
  /**
   * Listening order id to update for unread_count parameter
   */
  useEffect(() => {
    if (orderIdForUnreadCountUpdate === null || orderList.orders.length === 0) return
    const _orders = orderList.orders.filter(order => {
      if (order?.id === orderIdForUnreadCountUpdate) {
        order.unread_count = 0
        order.unread_general_count = 0
        order.unread_direct_count = 0
      }
      return true
    })
    setOrderList({ ...orderList, orders: _orders })
  }, [orderIdForUnreadCountUpdate])

  /**
   * redesign messages R2.2 (M-08): the inbox hands a `{ orderId, seq }` signal instead of an id, so a second read of the same
   * conversation (same id, new seq) zeroes its counters again. The effect above stays as it is for the other consumers.
   */
  useEffect(() => {
    if (!unreadResetSignal) return
    setOrderList(prevState => ({
      ...prevState,
      orders: prevState.orders.map(order => (
        order?.id === unreadResetSignal.orderId
          ? { ...order, unread_count: 0, unread_general_count: 0, unread_direct_count: 0 }
          : order
      ))
    }))
  }, [unreadResetSignal?.seq])

  /**
   * Listening deleted order
   */
  useEffect(() => {
    if (!deletedOrderIds) return
    let totalDeletedCount = 0
    const orders = orderList.orders.filter(_order => {
      if (deletedOrderIds.includes(_order?.id)) {
        totalDeletedCount = totalDeletedCount + 1
        return false
      } else {
        return true
      }
    })

    setOrderList({ ...orderList, orders })
    setPagination(prevPagination => ({
      ...prevPagination,
      total: Math.max(0, prevPagination?.total - totalDeletedCount)
    }))
  }, [JSON.stringify(deletedOrderIds)])

  /**
   * Listening sesssion and filter values change
   */
  useEffect(() => {
    const filterObjectValues = Object?.values(filterValues)
    const hasFilterApplied = filterObjectValues.some(filt => filt !== null && filt?.length > 0)
    if (session?.loading || configState.loading || hasFilterApplied || filterObjectValues?.length === 0) return
    if (orders) {
      setOrderList({
        ...orderList,
        orders
      })
    } else {
      loadOrders()
    }
    return () => {
      if (requestsState.orders) {
        requestsState.orders.cancel()
      }
    }
  }, [session, orders, configState.loading, isOnlyDelivery, driverId, customerId, businessId, orderStatus, searchValue, orderBy, JSON.stringify(filterValues)])

  useEffect(() => {
    const filterObjectValues = Object?.values(filterValues)
    const hasFilterApplied = filterObjectValues.some(filt => filt !== null && filt?.length > 0)
    if (!hasFilterApplied) {
      return
    }
    loadOrders()
    return () => {
      if (requestsState.orders) {
        requestsState.orders.cancel()
      }
    }
    // redesign F6d-1 (Q3-01): with a filter on, the main effect above skips, so this one has to listen to
    // everything that shapes the request too: the Status pill (`orderStatus`, serialized: a new array with the
    // same statuses is no change), the search, the sort and the context ids.
  }, [JSON.stringify(filterValues), JSON.stringify(orderStatus), searchValue, orderBy, isOnlyDelivery, driverId, customerId, businessId])

  const getLastUpdates = (history, sendOnlyStatus) => {
    const attributesToFind = ['status', 'logistic_status', 'driver_id']
    const foundEntries = {}
    let foundAll = false

    for (let i = history.length - 1; i >= 0 && !foundAll; i--) {
      const data = history[i].data
      if (data) {
        data.forEach(entry => {
          if (attributesToFind.includes(entry.attribute) && !(entry.attribute in foundEntries)) {
            foundEntries[entry.attribute] = entry
            if (Object.keys(foundEntries)?.length === attributesToFind.length) {
              foundAll = true
            }
          }
        })
      }
    }

    if (sendOnlyStatus) {
      return foundEntries?.status || null
    }

    return Object.values(foundEntries)
  }

  const handleUpdateOrder = (orderFromSocket) => {
    let order = orderFromSocket
    const orderFound = orderList.orders.find(_order => _order?.id === orderFromSocket?.id)
    if (orderFound) {
      order = { ...orderFound, ...orderFromSocket }
    }
    if (order?.products?.[0]?.type === 'gift_card') return
    if (customerId && order?.customer_id !== customerId) return
    if (driverId && order?.driver_id !== driverId) return
    if (isOnlyDelivery && ![1, 7].includes(order?.delivery_type)) return
    if (typeof order.status === 'undefined') return

    if (!isFilteredOrder(order)) {
      const lastHistoryData = getLastUpdates(order?.history ?? [])

      setOrderList(prevState => {
        const orderExists = prevState.orders.some(_order => _order?.id === order?.id)
        if (orderExists && isFilteredOrder(order, lastHistoryData)) {
          setPagination(prevPagination => ({ ...prevPagination, total: Math.max(0, prevPagination.total - 1) }))
        }
        const updatedOrders = prevState.orders.filter(_order => _order?.id !== order?.id)
        return { ...prevState, orders: updatedOrders }
      })
      return
    }

    let updatedOrder = { ...order }
    if (!order?.driver && order?.driver_id) {
      const updatedDriver = driversList?.drivers.find(driver => driver.id === order?.driver_id)
      if (updatedDriver) {
        updatedOrder.driver = { ...updatedDriver }
      }
    }
    const found = orderList.orders.find(_order => _order?.id === updatedOrder?.id)
    if (found) {
      setOrderList(prevState => {
        const updatedOrders = prevState.orders.map(_order => {
          if (_order?.id === order?.id) {
            updatedOrder = { ..._order, ...updatedOrder }
            return updatedOrder
          }
          return _order
        })
        const _orders = sortOrdersArray(orderBy, updatedOrders.filter(Boolean))
        return { ...prevState, orders: _orders }
      })
    } else {
      const statusChange = getLastUpdates(order?.history ?? [], true)
      setOrderList(prevState => {
        const alreadyExists = prevState.orders.some(_order => _order?.id === order?.id)
        if (alreadyExists) return prevState
        if (statusChange) {
          const from = parseInt(statusChange.old)
          if (!orderStatus.includes(from)) {
            setPagination(prevPagination => ({ ...prevPagination, total: prevPagination.total + 1 }))
          }
        }
        const updatedOrders = [...prevState.orders, order]
        const _orders = sortOrdersArray(orderBy, updatedOrders.filter(Boolean))
        return { ...prevState, orders: _orders.slice(0, pagination.pageSize) }
      })
    }
  }

  const handleRegisterOrder = (order) => {
    if (order?.products?.[0]?.type === 'gift_card') return
    if (customerId && order?.customer_id !== customerId) return
    if (driverId && order?.driver_id !== driverId) return
    if (isOnlyDelivery && ![1, 7].includes(order?.delivery_type)) return
    const found = orderList.orders.find(_order => _order?.id === order?.id)
    if (found) return
    if (!isFilteredOrder(order)) return
    setOrderList(prevState => {
      const found = prevState.orders.find(_order => _order?.id === order?.id)
      if (found) return prevState
      setPagination(prevPagination => ({ ...prevPagination, total: prevPagination.total + 1 }))
      const updatedOrders = [order, ...prevState.orders]
      const sortedOrders = sortOrdersArray(orderBy, updatedOrders)

      return {
        ...prevState,
        orders: sortedOrders.slice(0, pagination.pageSize)
      }
    })
  }

  // redesign messages B2 (B2-2): the order id of a `message` event, as `message.order.id` or `message.order_id`.
  const getMessageOrderId = (message) => {
    const rawId = message?.order?.id ?? message?.order_id
    return rawId != null && rawId !== '' && !Number.isNaN(Number(rawId)) ? Number(rawId) : rawId
  }

  // redesign messages B2 (B2-2): fetches one order with the list's where plus its id (page size 1) and puts it
  // on top of page 1 when it matches. Never rejects: a failed fetch is dropped silently, without retry.
  const pullOrderIn = async (orderId) => {
    const startedWith = latest.current.key
    try {
      const { content } = await getOrders(1, 1, undefined, [{ attribute: 'id', value: orderId }])
      if (!mounted.current || content.error) return
      const pulled = content.result?.[0]
      if (!pulled || String(pulled.id) !== String(orderId)) return
      // the list changed (tab, filters, search, page) while the order was on its way: it may not belong anymore
      if (latest.current.key !== startedWith || latest.current.currentPage !== 1) return
      if (latest.current.orders.some(_order => _order?.id === pulled.id)) return
      const message = pullState.current.messages.get(String(orderId))
      // redesign messages integration (live): the server may not show this message yet, so the event's time wins when it is
      // newer; otherwise a pulled order sorted by the newest message falls out of the page it was pulled into.
      const at = message?.created_at
      if (at) {
        const isNewer = (current) => !current || moment.utc(at).isAfter(moment.utc(current))
        const field = message.type === 1 ? 'last_general_message_at' : 'last_direct_message_at'
        if (isNewer(pulled[field])) pulled[field] = at
        if (isNewer(pulled.last_message_at)) pulled.last_message_at = at
      }
      // redesign messages R1 (Q-02): the pulled order matches the list's own where, so the server's total already counts it: the
      // total is never raised. It is inserted, and announced, only when it lands inside page 1 once sorted and cut to the page size
      // (sorted by order number it may belong to a later page); otherwise nothing changes.
      const pageSize = latest.current.pageSize
      const insideFirstPage = sortOrdersArray(orderBy, [pulled, ...latest.current.orders].filter(Boolean))
        .slice(0, pageSize)
        .some(_order => _order?.id === pulled.id)
      if (!insideFirstPage) return
      setOrderList(prevState => {
        if (prevState.orders.some(_order => _order?.id === pulled.id)) return prevState
        const sortedOrders = sortOrdersArray(orderBy, [pulled, ...prevState.orders].filter(Boolean))
        return { ...prevState, orders: sortedOrders.slice(0, pageSize) }
      })
      setArrival({
        orderId: pulled.id,
        at: message?.created_at ?? Date.now(),
        authorName: message?.author?.name ?? null,
        fromOutside: true
      })
    } catch (err) {
      // dropped on purpose: no alert, no retry loop
    }
  }

  // Starts queued ids while fewer than PULL_IN_MAX_IN_FLIGHT fetches are running.
  const pumpPullQueue = () => {
    const state = pullState.current
    while (mounted.current && state.inFlight.size < PULL_IN_MAX_IN_FLIGHT && state.queued.length > 0) {
      const orderId = state.queued.shift()
      state.inFlight.add(String(orderId))
      latest.current.pullOrderIn(orderId).then(() => {
        state.inFlight.delete(String(orderId))
        state.messages.delete(String(orderId))
        latest.current.pumpPullQueue()
      })
    }
  }

  const enqueuePull = (orderId, message) => {
    const state = pullState.current
    const key = String(orderId)
    state.messages.set(key, message)
    // one request in flight per id, and a queued id is already waiting: later events for it are dropped
    if (state.inFlight.has(key) || state.queued.some(id => String(id) === key)) return
    state.queued.push(orderId)
    if (state.queued.length > PULL_IN_MAX_QUEUED) {
      state.queued.splice(0, state.queued.length - PULL_IN_MAX_QUEUED).forEach(id => state.messages.delete(String(id)))
    }
    pumpPullQueue()
  }

  // redesign messages R2.2 (M-D12): off, the admin rule it always was (a level-0 author does not count). On, only a message written by
  // someone other than the session user counts, whatever the level of either.
  const countsAsUnread = (message) => {
    if (!unreadByAuthor) return message.author?.level !== 0
    const authorId = message.author_id ?? message.author?.id
    return authorId == null || user?.id == null || String(authorId) !== String(user.id)
  }

  const handleNewMessage = (message) => {
    // redesign messages B2 (B2-2): off, this is exactly what it always was (`message.order?.id`, nothing for the rest)
    const messageOrderId = pullInOnMessage ? getMessageOrderId(message) : message.order?.id
    if (!pullInOnMessage && orderList.orders.length === 0) return
    const found = orderList.orders.find(order => order?.id === messageOrderId)
    if (pullInOnMessage) {
      const authorName = message?.author?.name ?? null
      const at = message?.created_at ?? Date.now()
      if (found) {
        setArrival({ orderId: messageOrderId, at, authorName, fromOutside: false })
      } else if (messageOrderId != null) {
        if (pagination.currentPage === 1) {
          // the arrival is announced when the order is inserted: a fetch that does not match shows nothing
          enqueuePull(messageOrderId, message)
        } else {
          setOutsideMessages(count => count + 1)
          setArrival({ orderId: messageOrderId, at, authorName, fromOutside: true })
        }
      }
    }
    if (found) {
      setOrderList(prevState => {
        const _orders = prevState.orders.filter(order => {
          if (order?.id === messageOrderId) {
            if (order.last_message_at !== message.created_at) {
              if (message.type === 1) {
                order.last_general_message_at = message.created_at
                if (countsAsUnread(message)) {
                  order.unread_general_count = order.unread_general_count + 1
                }
              } else {
                order.last_direct_message_at = message.created_at
                if (countsAsUnread(message)) {
                  order.unread_direct_count = order.unread_direct_count + 1
                }
              }
              order.last_message_at = message.created_at
              if (unreadByAuthor ? countsAsUnread(message) : message.author?.level !== 0) {
                order.unread_count = order.unread_count + 1
              }
            }
          }
          return true
        })
        const _sortedOrders = sortOrdersArray(orderBy, _orders)
        return { ...prevState, orders: _sortedOrders }
      })
    }
  }

  // redesign messages B2 (B2-2): what an async pull-in reads when it ends, always from the latest render
  latest.current = {
    key: JSON.stringify([orderStatus, filterValues, searchValue, orderIds, isOnlyDelivery, driverId, customerId, businessId, franchiseId, withMessagesOnly, orderBy, orderDirection]),
    currentPage: pagination.currentPage,
    pageSize: pagination.pageSize,
    orders: orderList.orders,
    pullOrderIn,
    pumpPullQueue
  }

  const isDeepEmptyObject = (obj) => {
    for (const key in obj) {
      if (obj[key] !== null && typeof obj[key] === 'object' && !isDeepEmptyObject(obj[key])) {
        return false
      }
      if (Array.isArray(obj[key]) && obj[key].length > 0) {
        return false
      }
      if (obj[key] !== null && typeof obj[key] !== 'object' && obj[key] !== '') {
        return false
      }
    }
    return true
  }

  useEffect(() => {
    if (orderList.loading) return
    if (pagination?.currentPage !== 0 && pagination?.total !== 0) {
      if (Math.ceil(pagination?.total / pagination.pageSize) >= pagination?.currentPage) {
        if (orderList.orders.length === 0 && ((filterValues && !isDeepEmptyObject(filterValues)) || !!searchValue)) {
          getPageOrders(pagination.pageSize, pagination.currentPage)
        }
      } else if (pagination.currentPage - 1 > 0) {
        getPageOrders(pagination.pageSize, pagination.currentPage - 1)
      }
    }
    socket.on('update_order', handleUpdateOrder)
    socket.on('orders_register', handleRegisterOrder)
    socket.on('message', handleNewMessage)
    return () => {
      socket.off('update_order', handleUpdateOrder)
      socket.off('orders_register', handleRegisterOrder)
      socket.off('message', handleNewMessage)
    }
  }, [orderList.orders, pagination, orderBy, socket, driversList, customerId, driverId])

  // Listening for customer rating
  useEffect(() => {
    const handleCustomerReviewed = (review) => {
      const orders = orderList.orders.filter(_order => {
        if (_order?.id === review.order_id) {
          _order.user_review = review
        }
        return true
      })
      const _orders = sortOrdersArray(orderBy, orders)
      setOrderList(prevState => ({
        ...prevState,
        orders: _orders
      }))
    }
    events.on('customer_reviewed', handleCustomerReviewed)
    return () => {
      events.off('customer_reviewed', handleCustomerReviewed)
    }
  }, [orderList, orderBy])

  const reloadPageOrders = () => {
    getPageOrders(pagination.pageSize, pagination.currentPage)
  }

  useEffect(() => {
    events.on('websocket_connected', reloadPageOrders)
    return () => {
      events.off('websocket_connected', reloadPageOrders)
    }
  }, [pagination])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          orderList={orderList}
          pagination={pagination}
          loadMoreOrders={loadMoreOrders}
          getPageOrders={getPageOrders}
          getAllMatchingOrderIds={getAllMatchingOrderIds}
          handleUpdateOrderStatus={handleUpdateOrderStatus}
          allowColumns={allowColumns}
          setAllowColumns={setAllowColumns}
          handleDrop={handleDrop}
          saveUserSettings={saveUserSettings}
          outsideMessages={outsideMessages}
          arrival={arrival}
        />
      )}
    </>
  )
}

DashboardOrdersList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string),
  /**
   * Function to get order that was clicked
   * @param {Object} order Order that was clicked
   */
  onOrderClick: PropTypes.func,
  /**
   * Enable/Disable default session manager
   * Save user and token with default session manager
   */
  useDefualtSessionManager: PropTypes.bool,
  /**
   * Array of orders
   * This is used of first option to show list
   */
  orders: PropTypes.arrayOf(object),
  /**
   * Array of id of orders
   * Get a list of orders by ids form Ordering API
   */
  orderIds: PropTypes.arrayOf(number),
  /**
   * id of order to update unread_count parameter
   */
  orderIdForUnreadCountUpdate: PropTypes.number,
  /**
   * redesign messages R2.2 (M-D12): opt-in, default off. A socket message raises the unread counters only when its author
   * (`author_id ?? author.id`) is not the session user. Off keeps the admin rule (a level-0 author does not count).
   */
  unreadByAuthor: PropTypes.bool,
  /**
   * redesign messages R2.2 (M-08): opt-in. `{ orderId, seq }` or null. A new `seq` zeroes the three unread counters of that
   * order, even when the id is the one of the previous signal.
   */
  unreadResetSignal: PropTypes.shape({ orderId: PropTypes.number, seq: PropTypes.number }),
  /**
   * Array of id of orders
   * Get a list of orders by status form Ordering API
   * This can be use together `orderIds` option but not has effect with `orders` option
   */
  orderStatus: PropTypes.arrayOf(number),
  /**
   * Order orders by some attribute. Default by `id`.
   */
  orderBy: PropTypes.string,
  /**
   * Order direction ascendent (asc) or descendent (desc). Default is `desc`.
   */
  orderDirection: PropTypes.oneOf(['asc', 'desc']),
  /**
   * Pagination settings
   * You can set the pageSize, initialPage and controlType can be by pages or infinity
   */
  paginationSettings: PropTypes.exact({
    /**
     * initialPage only work with control type `pages`
     */
    initialPage: PropTypes.number,
    pageSize: PropTypes.number,
    controlType: PropTypes.oneOf(['infinity', 'pages'])
  }),
  /**
   * redesign messages B2 (B2-1): only orders with direct messages (`last_direct_message_at != null`), ANDed with
   * the tab statuses, filters, search and `orderIds`. Default `false`.
   */
  withMessagesOnly: PropTypes.bool,
  /**
   * redesign messages B2 (B2-2): a `message` event for an order that is not in the page pulls it in by id (page 1)
   * or counts it in `outsideMessages` (other pages), and sets `arrival`. Default `false`.
   */
  pullInOnMessage: PropTypes.bool
}

const defaultProps = {
  orderBy: 'id',
  orderDirection: 'desc',
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' },
  withMessagesOnly: false, // redesign messages B2 (B2-1)
  pullInOnMessage: false // redesign messages B2 (B2-2)
}
