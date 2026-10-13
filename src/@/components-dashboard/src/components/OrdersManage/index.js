import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useWebsocket } from '../../contexts/WebsocketContext'
import { useConfig } from '../../contexts/ConfigContext'
import { isOrderStatusRegressionError } from '../../utils'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { advanceBulkStatusQueue } from './bulkStatusQueue'

export const OrdersManage = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    statusGroup,
    driversPropsToFetch,
    disableSocketRoomDriver,
    useFranchiseImages,
    defaultFilterValues,
    getDriversByControls,
    disableDriverLocationsSockets,
    searchSeed
  } = props

  const [ordering] = useApi()
  const socket = useWebsocket()
  const [{ auth, user, token, loading }] = useSession()
  const [configState] = useConfig()
  const [languageState, t] = useLanguage()
  const [, { showToast }] = useToast()

  const requestsState = {}
  const orderStatuesList = {
    pending: [0, 13],
    inProgress: [7, 8, 4, 9, 3, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26],
    completed: [1, 11, 15],
    cancelled: [2, 5, 6, 10, 12, 16, 17]
  }

  const [searchValue, setSearchValue] = useState(searchSeed?.value || null)
  const [ordersStatusGroup, setOrdersStatusGroup] = useState(statusGroup || 'pending')
  const [filterValues, setFilterValues] = useState(defaultFilterValues || {})
  const [timeStatus, setTimeStatus] = useState(null)
  const [updateStatus, setUpdateStatus] = useState(null)
  const [startMulitOrderStatusChange, setStartMulitOrderStatusChange] = useState(false)
  const [actionStatus, setActionStatus] = useState({ loading: false, error: null })
  const [regressionRequest, setRegressionRequest] = useState(null)
  const [multiOrderReasons, setMultiOrderReasons] = useState(null)
  const isRegressionValidationEnabled = configState?.configs?.order_status_regression_validation_enabled?.value === '1'
  const [deletedOrderIds, setDeletedOrderIds] = useState([])
  const [mapsData, setMapsData] = useState({
    driversIsOnline: true,
    onlineDrivers: [],
    offlineDrivers: [],
    selectedDriver: null
  })
  const [detailsOrder, setDetailsOrder] = useState(null)
  const showExternalId = configState?.configs?.change_order_id?.value === '1'

  const allowColumnsModel = {
    slaBar: { visable: false, title: '', className: '', draggable: false, colSpan: 1, order: -2 },
    orderNumber: { visable: !showExternalId, title: '', className: '', draggable: false, colSpan: 1, order: -1 },
    dateTime: { visable: true, title: '', className: '', draggable: false, colSpan: 1, order: showExternalId ? -1 : 0 },
    externalId: { visable: false, title: t('EXTERNAL_ID', 'External id'), className: 'externalId', draggable: true, colSpan: 1, order: 1 },
    status: { visable: true, title: t('STATUS', 'Status'), className: 'statusInfo', draggable: true, colSpan: 1, order: 2 },
    agent: { visable: false, title: t('AGENT', 'Agent'), className: 'agent', draggable: true, colSpan: 1, order: 3 },
    cartGroupId: { visable: true, title: t('GROUP_ORDER', 'Group Order'), className: 'groupOrderId', draggable: true, colSpan: 1, order: 4 },
    driverGroupId: { visable: true, title: t('EXPORT_DRIVER_GROUP_ID', 'Driver Group Id'), className: 'driverGroupId', draggable: true, colSpan: 1, order: 5 },
    business: { visable: true, title: t('BUSINESS', 'Business'), className: 'businessInfo', draggable: true, colSpan: 1, order: 6 },
    customer: { visable: true, title: t('CUSTOMER', 'Customer'), className: 'customerInfo', draggable: true, colSpan: 1, order: 7 },
    driver: { visable: true, title: t('DRIVER', 'Driver'), className: 'driverInfo', draggable: true, colSpan: 1, order: 8 },
    advanced: { visable: true, title: t('ADVANCED_LOGISTICS', 'Advanced logistics'), className: 'advanced', draggable: true, colSpan: 3, order: 9 },
    cloned: { visable: true, title: t('CLONED', 'Cloned'), className: 'cloned', draggable: true, colSpan: 1, order: 10 },
    timer: { visable: false, title: t('SLA_TIMER', 'SLA’s timer'), className: 'timer', draggable: true, colSpan: 1, order: 11 },
    eta: { visable: true, title: t('ETA', 'ETA'), className: 'eta', draggable: true, colSpan: 1, order: 12 },
    channel: { visable: false, title: t('CHANNEL', 'Channel'), className: 'channelInfo', draggable: true, colSpan: 1, order: 13 },
    pod: { visable: true, title: t('PODS', 'Pod'), className: 'podInfo', draggable: true, colSpan: 1, order: 14 },
    total: { visable: true, title: '', className: '', draggable: false, colSpan: 1, order: 15 }
  }

  const [allowColumns, setAllowColumns] = useState(allowColumnsModel)
  const [franchisesList, setFranchisesList] = useState({ loading: false, franchises: [], error: null })

  /**
   * Object to save driver group list
   */
  const [driverGroupList, setDriverGroupList] = useState({ groups: [], loading: false, error: null })
  /**
  * Object to save driver group list
  */
  const [assignableDriverGroupList, setAssignableDriverGroupList] = useState({ groups: [], loading: false, error: null })
  /**
   * Object to save drivers
   */
  const [driversList, setDriversList] = useState({ drivers: [], loading: true, error: null })
  /**
   * Object to save admins
   */
  const [adminsList, setAdminsList] = useState({ admins: [], loading: true, error: null })
  /**
   * Object to save paymethods
   */
  const [paymethodsList, setPaymethodsList] = useState({ paymethods: [], loading: true, error: null })
  /**
   * Object to save businesses
   */
  const [businessesList, setBusinessesList] = useState({ businesses: [], loading: true, error: null })
  /**
   * Array to save the cities
   */
  const [citiesList, setCitiesList] = useState([])

  /**
   * Object to save selected order ids
   */
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  /**
   * Object to save order substatuses
   */
  const [selectedSubOrderStatus, setSelectedSubOrderStatus] = useState({
    pending: orderStatuesList?.pending,
    inProgress: orderStatuesList?.inProgress,
    completed: orderStatuesList?.completed,
    cancelled: orderStatuesList?.cancelled,
    all: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
  })

  /**
   * Save ids of orders selected
   * @param {string} orderId order id
   */
  const handleSelectedOrderIds = (orderId) => {
    let _ids = [...selectedOrderIds]
    if (!_ids.includes(orderId)) {
      _ids.push(orderId)
    } else {
      _ids = _ids.filter((_id) => _id !== orderId)
    }
    setSelectedOrderIds(_ids)
  }
  /**
   * Remove id of order updated or delected
   * @param {string} orderId order id
   */
  const handleRemoveSelectedOrderId = (orderId) => {
    let _ids = [...selectedOrderIds]
    _ids = _ids.filter((_id) => _id !== orderId)
    setSelectedOrderIds(_ids)
  }

  /**
   * Change orders filter by statuses selected
   * @param {string} ordersStatusGroup orders status
   */
  const handleOrdersStatusGroupFilter = (statusGroup) => {
    if (statusGroup === ordersStatusGroup) return
    setOrdersStatusGroup(statusGroup)
    setSelectedOrderIds([])
  }
  /**
   * Change text to search
   * @param {string} search Search value
   */
  const handleChangeSearch = (search) => {
    setSearchValue(search)
  }

  // Text carried from the command palette (`/orders?q=`)
  useEffect(() => {
    if (searchSeed?.value) setSearchValue(searchSeed.value)
  }, [searchSeed?.key])
  /**
   * Save filter type values
   * @param {object} types
   */
  const handleChangeFilterValues = (types) => {
    setFilterValues(types)
  }

  /**
   * save status for multi orders selected
   * @param {number} status order status
   */
  const handleChangeMultiOrdersStatus = (status) => {
    setUpdateStatus(status)
    setStartMulitOrderStatusChange(true)
  }
  /**
   * Method to change multi orders status from API
   */
  const applyBulkStatusQueueAdvance = () => {
    setSelectedOrderIds(prev => advanceBulkStatusQueue(prev).remainingOrderIds)
  }

  const handleChangeMultiOrderStatus = async (orderId, reasons = null) => {
    try {
      setActionStatus({ loading: true, error: null })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: updateStatus, ...(reasons && { reasons }) })
      }
      const response = await fetch(`${ordering.root}/orders/${orderId}`, requestOptions)
      const { result, error, error_codes: errorCodes } = await response.json()

      if (error) {
        if (isRegressionValidationEnabled && !reasons && isOrderStatusRegressionError(errorCodes)) {
          if (multiOrderReasons) {
            return handleChangeMultiOrderStatus(orderId, multiOrderReasons)
          }
          setActionStatus({ loading: false, error: null })
          setRegressionRequest({ orderId })
          return
        }
        const errorMessages = Array.isArray(result) ? result : [result]
        setActionStatus({ loading: false, error: errorMessages })
        showToast(ToastType.Error, errorMessages[0])
        applyBulkStatusQueueAdvance()
        return
      }

      applyBulkStatusQueueAdvance()
      setActionStatus({ loading: false, error: null })
    } catch (err) {
      applyBulkStatusQueueAdvance()
      setActionStatus({ loading: false, error: [err.message] })
    }
  }

  const handleSubmitRegressionReason = (reasons) => {
    const { orderId } = regressionRequest
    setMultiOrderReasons(reasons)
    setRegressionRequest(null)
    handleChangeMultiOrderStatus(orderId, reasons)
  }

  const handleCancelRegressionReason = () => {
    setRegressionRequest(null)
    setMultiOrderReasons(null)
    setStartMulitOrderStatusChange(false)
  }

  /**
   * Delete orders for orders selected
   */
  const handleDeleteMultiOrders = async (code, ids) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })

      const payload = {
        orders_id: ids ?? selectedOrderIds
      }
      if (code) {
        payload.deleted_action_code = code
      }
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
      const response = await fetch(`${ordering.root}/orders`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setDeletedOrderIds(ids ?? selectedOrderIds)
        setSelectedOrderIds([])
        showToast(ToastType.Success, ids ? t('ORDER_DELETED', 'Order deleted') : t('ORDERS_DELETED', 'Orders deleted'))
      } else {
        setActionStatus({
          loading: true,
          error: content.result
        })
      }
    } catch (error) {
      setActionStatus({ loading: false, error: [error.message] })
    }
  }

  /**
   * Method to get drivers from API
   */
  const getDrivers = async () => {
    try {
      const source = {}
      requestsState.drivers = source

      const { content: { result } } = await ordering
        .setAccessToken(token)
        .users()
        .select(driversPropsToFetch)
        .where([{ attribute: 'level', value: [4] }])
        .get({ cancelToken: source })

      setDriversList({
        ...driversList,
        loading: false,
        drivers: result
      })
    } catch (err) {
      setDriversList({
        ...driversList,
        loading: false,
        error: err.message
      })
    }
  }

  const getControlsOrders = async () => {
    try {
      setActionStatus({ ...actionStatus, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/controls/orders?version=v2`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setCitiesList(content.result.cities)
        setDriverGroupList({
          ...driverGroupList,
          loading: false,
          groups: content.result.driver_groups
        })
        setAssignableDriverGroupList({
          ...assignableDriverGroupList,
          loading: false,
          groups: content.result.assignable_driver_groups
        })
        setPaymethodsList({
          ...paymethodsList,
          loading: false,
          paymethods: content.result.paymethods
        })
        setBusinessesList({
          ...businessesList,
          loading: false,
          businesses: content.result.businesses
        })
        setAdminsList({
          ...adminsList,
          loading: false,
          admins: content.result.agents
        })
        if (getDriversByControls) {
          setDriversList({
            ...driversList,
            loading: false,
            drivers: content.result.drivers
          })
        }
        setActionStatus({ ...actionStatus, loading: false })
      } else {
        setActionStatus({ loading: false, error: content?.result })
      }
    } catch (err) {
      setActionStatus({ loading: false, error: [err.message] })
    }
  }

  const getFranchises = async () => {
    try {
      setFranchisesList({ ...franchisesList, loading: true })
      let where = null
      const conditions = []
      conditions.push({
        attribute: 'enabled',
        value: true
      })
      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const functionFetch = `${ordering.root}/franchises?where=${JSON.stringify(where)}`
      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setFranchisesList({
          ...franchisesList,
          loading: false,
          franchises: result
        })
      } else {
        setFranchisesList({
          ...franchisesList,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setFranchisesList({
        ...franchisesList,
        loading: false,
        error: err
      })
    }
  }

  const handleJoinMainRooms = () => {
    if (!disableDriverLocationsSockets) {
      socket.join({
        room: 'driver_locations',
        user_id: user?.id,
        role: 'manager'
      })
    }
    socket.join({
      room: 'drivers',
      user_id: user?.id,
      role: 'manager'
    })
  }

  const handleLeaveMainRooms = () => {
    socket.leave({
      room: 'driver_locations',
      user_id: user?.id,
      role: 'manager'
    })
    socket.leave({
      room: 'drivers',
      user_id: user?.id,
      role: 'manager'
    })
  }

  /**
   * Listening driver change
   */
  useEffect(() => {
    if (loading) return
    const handleBatchDriverChanges = (changes) => {
      setDriversList((prevState) => {
        const updatedDrivers = prevState.drivers.map((driver) => {
          const changeData = changes.find((change) => change.driver_id === driver.id)
          if (changeData) {
            const updatedDriver = { ...driver }
            for (const change of changeData.changes) {
              updatedDriver[change.attribute] = change.new
            }
            return updatedDriver
          }
          return driver
        })
        return { ...prevState, drivers: updatedDrivers }
      })
    }
    const handleBatchDriverLocations = (locations) => {
      const locationMap = new Map(locations.map(location => [location.driver_id, location.location]))
      setDriversList((prevState) => {
        const updatedDrivers = prevState.drivers.map(driver => {
          if (locationMap.has(driver?.id)) {
            return { ...driver, location: locationMap.get(driver?.id) }
          }
          return driver
        })
        return { ...prevState, drivers: updatedDrivers }
      })
      if (detailsOrder?.id && detailsOrder?.driver_id) {
        const selectedDriverLocation = locationMap.get(detailsOrder.driver_id)
        if (selectedDriverLocation) {
          setDetailsOrder(prevState => ({
            ...prevState,
            driver: { ...prevState.driver, location: selectedDriverLocation }
          }))
        }
      }
      if (mapsData?.selectedDriver?.id) {
        const selectedDriverLocation = locationMap.get(mapsData.selectedDriver.id)
        if (selectedDriverLocation) {
          setMapsData(prevState => ({
            ...prevState,
            selectedDriver: { ...prevState.selectedDriver, location: selectedDriverLocation }
          }))
        }
      } else {
        setMapsData((prevState) => {
          const updateDriverLocation = (driver) => {
            if (locationMap.has(driver?.id)) {
              return { ...driver, location: locationMap.get(driver?.id) }
            }
            return driver
          }
          return {
            ...prevState,
            onlineDrivers: prevState.onlineDrivers.map(updateDriverLocation),
            offlineDrivers: prevState.offlineDrivers.map(updateDriverLocation)
          }
        })
      }
    }

    if (!disableSocketRoomDriver) {
      socket.on('batch_driver_locations', handleBatchDriverLocations)
      socket.on('batch_driver_changes', handleBatchDriverChanges)
    }
    return () => {
      if (!disableSocketRoomDriver) {
        socket.off('batch_driver_locations', handleBatchDriverLocations)
        socket.off('batch_driver_changes', handleBatchDriverChanges)
      }
    }
  }, [socket, loading, mapsData?.selectedDriver?.id, detailsOrder?.id])

  useEffect(() => {
    if (!auth || loading || !socket?.socket || disableSocketRoomDriver) return
    const io = socket.socket
    if (io.connected) handleJoinMainRooms()
    io.on('connect', handleJoinMainRooms)

    return () => {
      handleLeaveMainRooms()
      io.off('connect', handleJoinMainRooms)
    }
  }, [socket?.socket, auth, loading, disableSocketRoomDriver])

  /**
   * Listening multi orders action start to change status
   */
  useEffect(() => {
    if (!startMulitOrderStatusChange) return
    if (selectedOrderIds.length === 0) {
      setStartMulitOrderStatusChange(false)
      setMultiOrderReasons(null)
      return
    }
    handleChangeMultiOrderStatus(selectedOrderIds[0])
  }, [selectedOrderIds, startMulitOrderStatusChange])

  useEffect(() => {
    if (loading) return
    if (!getDriversByControls && (user?.level === 0 || user?.level === 2 || user?.level === 5)) {
      getDrivers()
    }
    getControlsOrders()

    return () => {
      if (requestsState.drivers) {
        requestsState.drivers.cancel()
      }
    }
  }, [user, loading])

  useEffect(() => {
    if (!user?.id || configState?.loading) return
    const withFreshTitles = (savedCols) => {
      const allKeys = new Set([
        ...Object.keys(allowColumnsModel),
        ...Object.keys(savedCols || {})
      ])
      const result = {}
      allKeys.forEach((key) => {
        const saved = savedCols?.[key]
        if (saved) {
          result[key] = {
            ...saved,
            ...(allowColumnsModel[key]?.title !== undefined
              ? { title: allowColumnsModel[key].title }
              : {})
          }
        } else if (allowColumnsModel[key]) {
          result[key] = { ...allowColumnsModel[key] }
        }
      })
      return result
    }
    const getUser = async () => {
      try {
        const response = await ordering.users(user.id).select(['settings']).get()
        const { content: { error, result } } = response
        const baseColumnConfig = {
          orderNumber: { ...allowColumnsModel.orderNumber },
          dateTime: { ...allowColumnsModel.dateTime },
          slaBar: { ...allowColumnsModel.slaBar, visable: true },
          timer: { ...allowColumnsModel.timer, visable: true }
        }

        if (!error && result?.settings?.orderColumns) {
          const fresh = withFreshTitles(result.settings.orderColumns)
          setAllowColumns({
            ...fresh,
            ...baseColumnConfig,
            timer: { ...fresh.timer }
          })

          return
        }

        setAllowColumns({
          ...allowColumnsModel,
          ...baseColumnConfig
        })
      } catch (err) {
        setAllowColumns({
          ...allowColumnsModel,
          slaBar: { ...allowColumnsModel?.slaBar, visable: true },
          timer: { ...allowColumnsModel?.timer, visable: true }
        })
      }
    }
    getUser()
  }, [user, configState, languageState?.language?.id])

  useEffect(() => {
    if (!ordering || !token || !useFranchiseImages) return
    getFranchises()
  }, [ordering, token, useFranchiseImages])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          searchValue={searchValue}
          driverGroupList={driverGroupList}
          driversList={driversList}
          paymethodsList={paymethodsList}
          businessesList={businessesList}
          citiesList={citiesList}
          ordersStatusGroup={ordersStatusGroup}
          filterValues={filterValues}
          multiOrderUpdateStatus={updateStatus}
          selectedOrderIds={selectedOrderIds}
          deletedOrderIds={deletedOrderIds}
          startMulitOrderStatusChange={startMulitOrderStatusChange}
          selectedSubOrderStatus={selectedSubOrderStatus}
          handleSelectedSubOrderStatus={setSelectedSubOrderStatus}
          handleSelectedOrderIds={handleSelectedOrderIds}
          handleRemoveSelectedOrderId={handleRemoveSelectedOrderId}
          handleChangeSearch={handleChangeSearch}
          handleChangeFilterValues={handleChangeFilterValues}
          handleOrdersStatusGroupFilter={handleOrdersStatusGroupFilter}
          handleChangeMultiOrdersStatus={handleChangeMultiOrdersStatus}
          regressionRequest={regressionRequest}
          handleSubmitRegressionReason={handleSubmitRegressionReason}
          handleCancelRegressionReason={handleCancelRegressionReason}
          handleDeleteMultiOrders={handleDeleteMultiOrders}
          setSelectedOrderIds={setSelectedOrderIds}
          allowColumns={allowColumns}
          setAllowColumns={setAllowColumns}
          timeStatus={timeStatus}
          setTimeStatus={setTimeStatus}
          franchisesList={franchisesList}
          adminsList={adminsList}
          assignableDriverGroupList={assignableDriverGroupList}
          mapsData={mapsData}
          setMapsData={setMapsData}
          detailsOrder={detailsOrder}
          setDetailsOrder={setDetailsOrder}
        />
      )}
    </>
  )
}

OrdersManage.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  driversPropsToFetch: ['id', 'name', 'lastname', 'location', 'enabled', 'available', 'busy', 'driver_groups.name', 'driver_groups.id', 'assigned_orders_count', 'photo']
}
