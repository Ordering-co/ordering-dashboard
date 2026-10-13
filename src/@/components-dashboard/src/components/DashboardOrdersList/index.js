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
dayjs.extend(utc)
dayjs.extend(timezone)

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
    setAllowColumns
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

  const sortOrdersArray = (option, array) => {
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
    return array
  }

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
   */
  const getOrders = async (pageSize, page) => {
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
        searchConditions.push(
          {
            attribute: 'id',
            value: {
              condition: 'ilike',
              value: encodeURIComponent(`%${searchValue}%`)
            }
          }
        )
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

    if (conditions.length) {
      where = {
        conditions,
        conector: 'AND'
      }
    }

    const source = {}
    requestsState.orders = source
    options.cancelToken = source
    let functionFetch
    if (propsToFetch) {
      functionFetch = ordering.setAccessToken(accessToken).orders().asDashboard().select(propsToFetch).where(where)
    } else {
      functionFetch = ordering.setAccessToken(accessToken).orders().asDashboard().where(where)
    }
    return await functionFetch.get(options)
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
        if ((order?.id?.toString() || '').toLowerCase().includes(lowerCaseSearchValue)) searchCheck = true
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
  }, [JSON.stringify(filterValues)])

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

  const handleNewMessage = (message) => {
    if (orderList.orders.length === 0) return
    const found = orderList.orders.find(order => order?.id === message.order?.id)
    if (found) {
      setOrderList(prevState => {
        const _orders = prevState.orders.filter(order => {
          if (order?.id === message.order?.id) {
            if (order.last_message_at !== message.created_at) {
              if (message.type === 1) {
                order.last_general_message_at = message.created_at
                if (message.author?.level !== 0) {
                  order.unread_general_count = order.unread_general_count + 1
                }
              } else {
                order.last_direct_message_at = message.created_at
                if (message.author?.level !== 0) {
                  order.unread_direct_count = order.unread_direct_count + 1
                }
              }
              order.last_message_at = message.created_at
              if (message.author.level !== 0) {
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
          handleUpdateOrderStatus={handleUpdateOrderStatus}
          allowColumns={allowColumns}
          setAllowColumns={setAllowColumns}
          handleDrop={handleDrop}
          saveUserSettings={saveUserSettings}
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
  })
}

const defaultProps = {
  orderBy: 'id',
  orderDirection: 'desc',
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' }
}
