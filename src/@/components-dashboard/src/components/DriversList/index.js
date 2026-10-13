import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useWebsocket } from '../../contexts/WebsocketContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const DriversList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    propsToFetch,
    isSearchByName,
    isSearchByCellphone,
    isOrderDrivers,
    isFilterDriverGroup,
    orderId,
    disableSocketRoomDriver,
    useBatchSockets,
    filterValues,
    useDriversByProps,
    paginationSettings,
    disableDriverLocationsSockets,
    enableSocketEventDriverRoom,
    setOrderForMap,
    orderForMap
  } = props

  const [ordering] = useApi()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const requestsState = {}
  const [driverActionStatus, setDriverActionStatus] = useState({ loading: true, error: null })
  const [companyActionStatus, setCompanyActionStatus] = useState({ loading: true, error: null })
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [assignedOrders, setAssignedOrders] = useState({ loading: false, error: null, orders: [] })
  const [paginationDrivers, setPaginationDrivers] = useState({
    initialPage: 1,
    currentPage: (paginationSettings?.controlType === 'pages' && paginationSettings?.initialPage && paginationSettings?.initialPage >= 1) ? paginationSettings?.initialPage : 1,
    pageSize: paginationSettings?.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })
  const controller = new AbortController()
  const signal = controller.signal
  const activeOrderStatuses = [0, 13, 7, 8, 4, 9, 3, 14, 18, 19, 20, 21, 22, 23]

  const socket = useWebsocket()

  /**
   * Get session
   */
  const [session] = useSession()

  /**
   * Array to save drivers
   */
  const [driversList, setDriversList] = useState({ drivers: useDriversByProps ? props.driversList?.drivers : [], loading: !useDriversByProps, error: null })
  /**
   * Array to save companys
   */
  const [companysList, setCompanysList] = useState({ companys: [], loading: true, error: null })
  /**
   * Array to save online drivers
   */
  const [onlineDrivers, setOnlineDrivers] = useState([])
  /**
   * Array to save offline drivers
   */
  const [offlineDrivers, setOfflineDrivers] = useState([])
  /**
   * state for drivers online / offline filter
   */
  const [driversIsOnline, setDriversIsOnline] = useState(true)
  /**
   * state for drivers busy / not busy sub filter
   */
  const [driversSubfilter, setDriversSubfilter] = useState({
    busy: true,
    notBusy: true
  })
  /**
   * search value
   */
  const [searchValue, setSearchValue] = useState(null)

  /**
   * Change text to search
   * @param {string} search Search value
   */
  const handleChangeSearch = (search) => {
    if (search !== searchValue) {
      setSearchValue(search)
    }
  }

  /**
   * Method to assign driver to order from API
   * @param {object} assign assigned order id and driver id
   */
  const handleAssignDriver = async (assign) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setDriverActionStatus({ ...driverActionStatus, loading: true })

      const source = {}
      requestsState.assignDriver = source
      const { content } = await ordering.setAccessToken(session.token).orders(assign.orderId).save({ driver_id: assign.driverId }, { cancelToken: source })

      setDriverActionStatus({
        loading: false,
        error: content.error ? content.result : null
      })

      if (!content.error) {
        if (assign.driverId) {
          showToast(ToastType.Success, t('ORDER_DRIVER_ASSIGNED', 'Driver assigned to order'))
        } else {
          showToast(ToastType.Success, t('ORDER_DRIVER_REMOVED', 'Driver removed from the order'))
        }
      }
    } catch (err) {
      setDriverActionStatus({ ...driverActionStatus, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to assign driver_company to order from API
   * @param {object} assign assigned order_id and driver_company_id
   */
  const handleAssignDriverCompany = async (assign) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setCompanyActionStatus({ ...companyActionStatus, loading: true })

      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          driver_company_id: assign.companyId
        })
      }
      const response = await fetch(`${ordering.root}/orders/${assign.orderId}`, requestOptions)
      const { error, result } = await response.json()

      setCompanyActionStatus({
        loading: false,
        error: result.error ? result.result : null
      })

      if (!error) {
        if (assign.driverId) {
          showToast(ToastType.Success, t('ORDER_COMPANY_ASSIGNED', 'Company assigned to order'))
        } else {
          showToast(ToastType.Success, t('ORDER_COMPANY_REMOVED', 'Company removed from the order'))
        }
      } else {
        showToast(ToastType.Error, t('ERROR_REMOVING_COMPANY', 'The delivery company cannot be removed because the delivery process has already started'))
      }
    } catch (err) {
      setCompanyActionStatus({ ...companyActionStatus, loading: false, error: [err.message] })
    }
  }

  /**
   * change online state for drivers
   * @param {Boolean} isOnline
   */
  const handleChangeDriverIsOnline = (isOnline) => {
    setDriversIsOnline(isOnline)
  }

  /**
   * sub filter for drivers
   * @param {Object} subFilter
   */
  const handleChangeDriversSubFilter = (subFilter) => {
    setDriversSubfilter(subFilter)
  }

  /**
   * Method to get online/offline drivers
   * @param {Array} drivers
   */
  const getOnlineOfflineDrivers = (drivers) => {
    let _onlineDrivers
    let _offlineDrivers
    let driversFiltered = drivers
    if (filterValues?.driverIds?.length > 0) {
      driversFiltered = driversFiltered.filter(driver => filterValues?.driverIds?.includes(driver?.id))
    }

    if (isFilterDriverGroup && filterValues?.driverGroupBusinessIds?.length > 0) {
      driversFiltered = driversFiltered.filter(driver => (driver.drivergroups?.some(driverGroup => filterValues?.driverGroupBusinessIds.includes(driverGroup?.id))))
    }

    if (driversSubfilter.busy && driversSubfilter.notBusy) {
      _onlineDrivers = driversFiltered.filter(driver => driver.enabled && driver.available)
      _offlineDrivers = driversFiltered.filter(driver => driver.enabled && !driver.available)
    } else if (driversSubfilter.busy && !driversSubfilter.notBusy) {
      _onlineDrivers = driversFiltered.filter(driver => driver.enabled && driver.available && driver.busy)
      _offlineDrivers = driversFiltered.filter(driver => driver.enabled && !driver.available && driver.busy)
    } else if (!driversSubfilter.busy && driversSubfilter.notBusy) {
      _onlineDrivers = driversFiltered.filter(driver => driver.enabled && driver.available && !driver.busy)
      _offlineDrivers = driversFiltered.filter(driver => driver.enabled && !driver.available && !driver.busy)
    } else {
      _onlineDrivers = []
      _offlineDrivers = []
    }
    setOnlineDrivers(_onlineDrivers)
    setOfflineDrivers(_offlineDrivers)
  }

  /**
   * Method to get drivers from API
   */
  const getDrivers = async (page = 1, pageSize = 10) => {
    try {
      setDriversList({ ...driversList, loading: true })
      const paginationParams = {
        page,
        page_size: pageSize || paginationDrivers.pageSize
      }
      const parameters = paginationSettings ? paginationParams : {}
      const source = {}
      requestsState.drivers = source

      let where = null
      const conditions = []
      conditions.push({ attribute: 'level', value: [4] })

      if (searchValue) {
        const searchConditions = []
        if (isSearchByName) {
          searchConditions.push(
            {
              attribute: 'name',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${searchValue}%`)
              }
            }
          )
          searchConditions.push(
            {
              attribute: 'lastname',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${searchValue}%`)
              }
            }
          )
        }
        if (isSearchByCellphone) {
          searchConditions.push(
            {
              attribute: 'cellphone',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${searchValue}%`)
              }
            }
          )
        }
        conditions.push({
          conector: 'OR',
          conditions: searchConditions
        })
      }

      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }

      const { content: { result, pagination } } = await ordering
        .setAccessToken(session.token)
        .users()
        .parameters(parameters)
        .select(propsToFetch)
        .where(where)
        .get({ cancelToken: source })

      setDriversList({
        ...driversList,
        loading: false,
        drivers: result
      })
      let nextPageItems = 0
      if (pagination.current_page !== pagination.total_pages) {
        const remainingItems = pagination.total - driversList?.drivers?.length
        nextPageItems = remainingItems < pagination.page_size ? remainingItems : pagination.page_size
      }
      setPaginationDrivers({
        ...paginationDrivers,
        currentPage: pagination.current_page,
        pageSize: pagination.page_size === 0 ? paginationDrivers.pageSize : pagination.page_size,
        totalPages: pagination.total_pages,
        total: pagination.total,
        from: pagination.from,
        to: pagination.to,
        nextPageItems
      })
      getOnlineOfflineDrivers(result)
    } catch (err) {
      setDriversList({
        ...driversList,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to get the drivers of order from API
   */
  const getOrderDrivers = async () => {
    try {
      setDriversList({ ...driversList, loading: true })
      setCompanysList({ ...companysList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        signal
      }
      const response = await fetch(`${ordering.root}/controls/orders/${orderId}?version=v2`, requestOptions)
      const { error, result } = await response.json()

      const drivers = result?.drivers?.map(driver => ({ ...driver, enabled: true }))
      setDriversList({
        loading: false,
        drivers: error ? [] : drivers,
        error: error ? result : null
      })
      setCompanysList({
        loading: false,
        companys: error ? [] : result?.driver_companies,
        error: error ? result : null
      })
    } catch (err) {
      setDriversList({
        ...driversList,
        loading: false,
        error: err.message
      })
      setCompanysList({
        ...companysList,
        loading: false,
        error: err.message
      })
    }
  }

  const getOrders = async () => {
    let options = null
    let where = []
    const conditions = []
    options = {
      query: {
        orderBy: '-id'
      }
    }

    conditions.push({
      attribute: 'products',
      conditions: [{
        attribute: 'type',
        value: {
          condition: '=',
          value: 'item'
        }
      }]
    })
    conditions.push({ attribute: 'status', value: activeOrderStatuses })
    conditions.push(
      {
        attribute: 'delivery_type',
        value: 1
      }
    )
    conditions.push(
      {
        attribute: 'driver_id',
        value: selectedDriver?.id
      }
    )

    if (conditions.length) {
      where = {
        conditions,
        conector: 'AND'
      }
    }

    const source = {}
    requestsState.orders = source
    options.cancelToken = source
    const functionFetch = ordering.setAccessToken(session.token).orders().asDashboard().select(['business', 'customer']).where(where)
    return await functionFetch.get(options)
  }

  /**
   * Method to get the orders assigned to the driver
   */
  const loadAssignedOrders = async () => {
    try {
      setAssignedOrders({ ...assignedOrders, loading: true })
      const response = await getOrders()
      setAssignedOrders({
        loading: false,
        orders: response.content.error ? [] : response.content.result,
        error: response.content.error ? response.content.result : null
      })
    } catch (err) {
      setAssignedOrders({ ...assignedOrders, loading: false, error: [err.message] })
    }
  }

  const handleChangePage = (page) => {
    !useDriversByProps && getDrivers(page, paginationDrivers?.pageSize)
    setPaginationDrivers({
      ...paginationDrivers,
      currentPage: page
    })
  }

  const handleChangePageSize = (pageSize) => {
    const expectedPage = Math.ceil(((paginationDrivers?.currentPage - 1) * paginationDrivers?.pageSize + 1) / pageSize)
    !useDriversByProps && getDrivers(expectedPage, pageSize)
    setPaginationDrivers({
      ...paginationDrivers,
      currentPage: expectedPage,
      pageSize,
      totalPages: Math.ceil(driversList?.drivers?.length / pageSize)
    })
  }

  useEffect(() => {
    if (selectedDriver?.id) {
      loadAssignedOrders()
    } else {
      setAssignedOrders({
        loading: false,
        orders: [],
        error: null
      })
    }
  }, [selectedDriver?.id])

  /**
   * listen for busy/not busy filter
   */
  useEffect(() => {
    if (useDriversByProps) return
    getOnlineOfflineDrivers(driversList.drivers)
  }, [driversSubfilter, filterValues?.driverIds, filterValues?.driverGroupBusinessIds, useDriversByProps])

  useEffect(() => {
    if (useDriversByProps) return
    if (props.driversList?.drivers) {
      setDriversList({ ...driversList, drivers: props.driversList?.drivers, loading: false })
      getOnlineOfflineDrivers(props.driversList?.drivers)
    } else {
      if (isOrderDrivers) {
        getOrderDrivers()
      } else {
        getDrivers(paginationDrivers?.initialPage, paginationDrivers?.pageSize)
      }
    }

    return () => {
      if (requestsState.drivers) {
        requestsState.drivers.cancel()
      }
      if (isOrderDrivers) {
        controller?.abort()
      }
    }
  }, [props.driversList?.loading, orderId, useDriversByProps, searchValue])

  useEffect(() => {
    if (!useDriversByProps) return
    setDriversList({ drivers: props.driversList?.drivers, loading: false, error: null })
  }, [props.driversList?.loading, driversSubfilter, filterValues?.driverIds, useDriversByProps])

  /**
   * Listening driver change
   */
  useEffect(() => {
    if (session?.loading) return
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

      if (selectedDriver?.id && locationMap.has(selectedDriver.id)) {
        setSelectedDriver((prevState) => ({ ...prevState, location: locationMap.get(selectedDriver.id) }))
        setOrderForMap && setOrderForMap({
          ...orderForMap,
          driver: {
            ...orderForMap.driver,
            location: locationMap.get(selectedDriver.id)
          }
        })
      }

      setDriversList((prevState) => {
        const updatedDrivers = prevState.drivers.map((driver) => {
          if (locationMap.has(driver.id)) {
            return { ...driver, location: locationMap.get(driver.id) }
          }
          return driver
        })
        return { ...prevState, drivers: updatedDrivers }
      })
    }

    if (!disableSocketRoomDriver || (socket?.socket?._callbacks?.$batch_driver_changes && socket?.socket?._callbacks?.$batch_driver_locations) || enableSocketEventDriverRoom) {
      socket.on('batch_driver_locations', handleBatchDriverLocations)
      socket.on('batch_driver_changes', handleBatchDriverChanges)
    }
    return () => {
      if (!disableSocketRoomDriver || (socket?.socket?._callbacks?.$batch_driver_changes && socket?.socket?._callbacks?.$batch_driver_locations) || enableSocketEventDriverRoom) {
        socket.off('batch_driver_locations', handleBatchDriverLocations)
        socket.off('batch_driver_changes', handleBatchDriverChanges)
      }
    }
  }, [socket, session?.loading, props.driversList?.loading, selectedDriver?.id, orderForMap?.id])

  useEffect(() => {
    if (orderForMap?.driver) {
      setSelectedDriver(orderForMap.driver)
    }
  }, [orderForMap?.driver?.id])

  const handleJoinMainRooms = () => {
    if (!disableDriverLocationsSockets) {
      socket.join({
        room: 'driver_locations',
        user_id: session?.user?.id,
        role: 'manager'
      })
    }
    socket.join({
      room: 'drivers',
      user_id: session?.user?.id,
      role: 'manager'
    })
  }

  const handleLeaveMainRooms = () => {
    socket.leave({
      room: 'driver_locations',
      user_id: session?.user?.id,
      role: 'manager'
    })
    socket.leave({
      room: 'drivers',
      user_id: session?.user?.id,
      role: 'manager'
    })
  }

  useEffect(() => {
    if (!session?.auth || session?.loading || !socket?.socket || disableSocketRoomDriver) return
    const io = socket.socket
    if (io.connected) handleJoinMainRooms()
    io.on('connect', handleJoinMainRooms)

    return () => {
      handleLeaveMainRooms()
      io.off('connect', handleJoinMainRooms)
    }
  }, [socket?.socket, session?.auth, session?.loading, disableSocketRoomDriver, useBatchSockets])

  useEffect(() => {
    if (useDriversByProps) return
    getOnlineOfflineDrivers(driversList.drivers)
  }, [driversList.drivers, useDriversByProps])

  useEffect(() => {
    if (!useDriversByProps) return
    const drivers =
      searchValue
        ? driversList.drivers.filter(driver => (driver.name + driver.lastname).toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
        : driversList.drivers

    setPaginationDrivers({
      initialPage: 1,
      currentPage: 1,
      pageSize: 10,
      totalPages: Math.ceil(drivers?.length / 10),
      total: drivers?.length || 0
    })
  }, [driversList?.drivers?.length, searchValue, useDriversByProps])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          driversList={driversList}
          companysList={companysList}
          onlineDrivers={onlineDrivers}
          offlineDrivers={offlineDrivers}
          driverActionStatus={driverActionStatus}
          companyActionStatus={companyActionStatus}
          driversIsOnline={driversIsOnline}
          driversSubfilter={driversSubfilter}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          handleAssignDriverCompany={handleAssignDriverCompany}
          handleChangeSearch={handleChangeSearch}
          handleChangeDriverIsOnline={handleChangeDriverIsOnline}
          handleChangeDriversSubFilter={handleChangeDriversSubFilter}
          handleAssignDriver={handleAssignDriver}
          selectedDriver={selectedDriver}
          setSelectedDriver={setSelectedDriver}
          assignedOrders={assignedOrders}
          pagination={paginationDrivers}
          handleChangePage={handleChangePage}
          handleChangePageSize={handleChangePageSize}
        />
      )}
    </>
  )
}

DriversList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: ['id', 'name', 'lastname', 'assigned_orders_count', 'available', 'phone', 'cellphone', 'location', 'photo', 'qualification', 'last_order_assigned_at']
}
