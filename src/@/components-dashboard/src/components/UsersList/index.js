import React, { useEffect, useState, useRef } from 'react'
import PropTypes, { string } from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useEvent } from '../../contexts/EventContext'
import { useWebsocket } from '../../contexts/WebsocketContext'
import { USERS_FILTER_INITIAL_VALUES } from '../UsersFilter'

export const UsersList = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    defaultUserActiveState,
    paginationSettings,
    propsToFetch,
    isSearchByUserId,
    isSearchByUserEmail,
    isSearchByUserPhone,
    isSearchByUserName,
    isBusinessOwners,
    defaultUserTypesSelected,
    disabledActiveStateCondition,
    isDriver,
    isProfessional,
    searchSeed,
    filterSeed
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [events] = useEvent()
  const socket = useWebsocket()

  const firstRender = useRef(true)
  const requestsState = useRef({})

  const [usersList, setUsersList] = useState({ users: [], loading: false, error: null })
  const [filterValues, setFilterValues] = useState({ clear: false, changes: {} })
  const [searchValue, setSearchValue] = useState(searchSeed?.value || null)
  const [isVerified, setIsVerified] = useState(false)
  const [userTypesSelected, setUserTypesSelected] = useState(defaultUserTypesSelected)
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage : 1,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })
  const [paginationDetail, setPaginationDetail] = useState({})
  const [selectedUserActiveState, setSelectedUserActiveState] = useState(defaultUserActiveState)
  const [actionStatus, setActionStatus] = useState({ loading: false, error: null })
  const [selectedUsers, setSelectedUsers] = useState([])
  const [deleteUsersActionState, setDeleteUsersActionState] = useState({ loading: false, error: null })
  const [occupationsState, setOccupationsState] = useState({ occupations: [], loading: false, error: null })
  const [selectedOccupation, setSelectedOccupation] = useState(null)
  const [orderFilterValue, setOrderFilterValue] = useState(null)
  const [multiFilterValues, setMultiFilterValues] = useState(() => filterSeed?.values ? { ...USERS_FILTER_INITIAL_VALUES, ...filterSeed.values } : {})
  const [actionDisabled, setActionDisabled] = useState(true)
  const [driversGroupsState, setDriversGroupsState] = useState({ groups: [], loading: false, error: null })

  /**
   * Save filter type values
   * @param {object} types
   */
  const handleChangeMultiFilterValues = (types) => {
    setMultiFilterValues(types)
  }

  // Search text or filters carried from the command palette (`?q=`). The
  // first seed is already in the initial state; later ones replace it.
  const appliedSeedKey = useRef(searchSeed?.key || filterSeed?.key || null)
  useEffect(() => {
    const seedKey = searchSeed?.key || filterSeed?.key
    if (!seedKey || seedKey === appliedSeedKey.current) return
    appliedSeedKey.current = seedKey
    if (searchSeed?.value) {
      setMultiFilterValues({})
      setSearchValue(searchSeed.value)
      return
    }
    if (filterSeed?.values) {
      setSearchValue(null)
      setMultiFilterValues({ ...USERS_FILTER_INITIAL_VALUES, ...filterSeed.values })
    }
  }, [searchSeed?.key, filterSeed?.key])

  /**
   * Get users by params, order options and filters
   * @param {boolean} newFetch Make a new request or next page
   */
  const getUsers = async (page, pageSize) => {
    const source = {}
    if (requestsState.current.users?.cancel) {
      requestsState.current.users.cancel()
    }
    requestsState.current.users = source
    try {
      setUsersList({ ...usersList, loading: true })
      let parameters = {}

      const paginationParams = {
        page,
        page_size: pageSize || paginationProps.pageSize
      }

      if (!isBusinessOwners) {
        parameters = { ...paginationParams }
      }

      if (orderFilterValue !== null) {
        parameters = {
          ...parameters,
          orders_count_condition: orderFilterValue === 0 ? 'eq' : 'ge',
          orders_count_value: orderFilterValue
        }
      }

      let where = null
      const conditions = []

      if (!disabledActiveStateCondition) {
        conditions.push({ attribute: 'enabled', value: selectedUserActiveState })
      }

      if (isVerified) {
        const verifiedConditions = []
        verifiedConditions.push(
          {
            attribute: 'email_verified',
            value: true
          }
        )
        verifiedConditions.push(
          {
            attribute: 'phone_verified',
            value: true
          }
        )
        conditions.push({
          conector: 'OR',
          conditions: verifiedConditions
        })
      }

      if (userTypesSelected.length > 0) {
        conditions.push({ attribute: 'level', value: userTypesSelected })
      }

      if (selectedOccupation) {
        conditions.push({ attribute: 'occupation_id', value: selectedOccupation })
      }

      if (searchValue) {
        const searchConditions = []
        if (isSearchByUserId) {
          searchConditions.push(
            {
              attribute: 'id',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${searchValue}%`)
              }
            }
          )
        }
        if (isSearchByUserEmail) {
          searchConditions.push(
            {
              attribute: 'email',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${searchValue}%`)
              }
            }
          )
        }

        if (isSearchByUserPhone) {
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

        if (isSearchByUserName) {
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

        conditions.push({
          conector: 'OR',
          conditions: searchConditions
        })
      }

      if (Object.keys(filterValues.changes).length) {
        const filterConditions = []
        if (filterValues?.changes?.name && filterValues?.changes?.name !== null) {
          filterConditions.push(
            {
              attribute: 'name',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${filterValues?.changes?.name}%`)
              }
            }
          )
        }
        if (filterValues.changes.lastname && filterValues.changes.lastname !== null) {
          filterConditions.push(
            {
              attribute: 'lastname',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${filterValues.changes.lastname}%`)
              }
            }
          )
        }
        if (filterValues.changes.email && filterValues.changes.email !== null) {
          filterConditions.push(
            {
              attribute: 'email',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${filterValues.changes.email}%`)
              }
            }
          )
        }
        if (filterValues.changes.email_verified !== undefined) {
          filterConditions.push(
            {
              attribute: 'email_verified',
              value: filterValues.changes.email_verified
            }
          )
        }
        if (filterValues.changes.phone && filterValues.changes.phone !== null) {
          filterConditions.push(
            {
              attribute: 'phone',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${filterValues.changes.phone}%`)
              }
            }
          )
        }
        if (filterValues.changes.phone_verified !== undefined) {
          filterConditions.push(
            {
              attribute: 'phone_verified',
              value: filterValues.changes.phone_verified
            }
          )
        }
        if (filterValues.changes.id && parseInt(filterValues.changes.id) > 0) {
          filterConditions.push(
            {
              attribute: 'id',
              value: parseInt(filterValues.changes.id)
            }
          )
        }
        if (filterConditions.length) {
          conditions.push({
            conector: 'AND',
            conditions: filterConditions
          })
        }
      }

      if (Object.keys(multiFilterValues).length > 0) {
        const filterConditons = []

        if (multiFilterValues?.id && parseInt(multiFilterValues?.id) > 0) {
          filterConditons.push(
            {
              attribute: 'id',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${parseInt(multiFilterValues.id)}%`)
              }
            }
          )
        }
        if (multiFilterValues?.externalId && parseInt(multiFilterValues?.externalId) > 0) {
          filterConditons.push(
            {
              attribute: 'external_id',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${parseInt(multiFilterValues.externalId)}%`)
              }
            }
          )
        }
        if (multiFilterValues?.name && multiFilterValues?.name !== null) {
          filterConditons.push(
            {
              attribute: 'name',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${multiFilterValues?.name}%`)
              }
            }
          )
        }
        if (multiFilterValues?.lastname && multiFilterValues?.lastname !== null) {
          filterConditons.push(
            {
              attribute: 'lastname',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${multiFilterValues?.lastname}%`)
              }
            }
          )
        }
        if (multiFilterValues?.email && multiFilterValues?.email !== null) {
          filterConditons.push(
            {
              attribute: 'email',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${multiFilterValues?.email}%`)
              }
            }
          )
        }
        if (multiFilterValues?.cellphone && multiFilterValues?.cellphone !== null) {
          filterConditons.push(
            {
              attribute: 'cellphone',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${multiFilterValues?.cellphone}%`)
              }
            }
          )
        }
        if (multiFilterValues?.countryPhoneCode !== null) {
          filterConditons.push(
            {
              attribute: 'country_phone_code',
              value: {
                condition: 'ilike',
                value: encodeURI(`%${multiFilterValues?.countryPhoneCode}%`)
              }
            }
          )
        }
        if (multiFilterValues?.cityIds.length !== 0) {
          filterConditons.push(
            {
              attribute: 'city_id',
              value: multiFilterValues?.cityIds
            }
          )
        }
        if (multiFilterValues?.phoneVerified !== null) {
          filterConditons.push(
            {
              attribute: 'phone_verified',
              value: multiFilterValues?.phoneVerified
            }
          )
        }
        if (multiFilterValues?.ordersCount?.value !== '') {
          parameters = {
            ...parameters,
            orders_count_condition: multiFilterValues?.ordersCount?.condition,
            orders_count_value: multiFilterValues?.ordersCount?.value
          }
        }
        if (multiFilterValues?.emailVerified !== null) {
          filterConditons.push(
            {
              attribute: 'email_verified',
              value: multiFilterValues?.emailVerified
            }
          )
        }
        if (multiFilterValues?.userType !== null) {
          filterConditons.push(
            {
              attribute: 'level',
              value: multiFilterValues?.userType
            }
          )
        }
        if (multiFilterValues?.loyaltyLevel !== null) {
          filterConditons.push(
            {
              attribute: 'loyalty_level_id',
              value: multiFilterValues?.loyaltyLevel
            }
          )
        }
        if (multiFilterValues?.enabled !== null) {
          filterConditons.push(
            {
              attribute: 'enabled',
              value: multiFilterValues?.enabled
            }
          )
        }
        if (multiFilterValues?.deliveryFromDatetime !== null) {
          filterConditons.push(
            {
              attribute: 'created_at',
              value: {
                condition: '>=',
                value: multiFilterValues?.deliveryFromDatetime
              }
            }
          )
        }
        if (multiFilterValues?.deliveryEndDatetime !== null) {
          filterConditons.push(
            {
              attribute: 'created_at',
              value: {
                condition: '<=',
                value: multiFilterValues?.deliveryEndDatetime
              }
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

      let fetchEndpoint = null
      let content = {}

      if (session.user?.level !== 2) {
        fetchEndpoint = where
          ? ordering.setAccessToken(session.token).users().select(propsToFetch).parameters(parameters).where(where)
          : ordering.setAccessToken(session.token).users().select(propsToFetch).parameters(parameters)
        const response = await fetchEndpoint.get({ cancelToken: source })
        content = response.content
      } else {
        const requestOptions = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`
          }
        }
        const fetchEndpoint = where
          ? `${ordering.root}/professionals?page=${page}&page_size=${pageSize}&&where=${JSON.stringify(where)}`
          : `${ordering.root}/professionals?page=${page}&page_size=${pageSize}`

        const response = await fetch(fetchEndpoint, requestOptions)
        content = await response.json()
      }

      const { result, pagination, error } = content
      if (error) {
        setUsersList({
          ...usersList,
          loading: false,
          error: result
        })
      } else {
        let finalUsers = result

        if (isDriver && session?.user?.level === 5 && session?.user?.id) {
          try {
            const storageKey = `drivers_cache_${session.user.id}`
            let cachedDrivers = []

            const cachedData = localStorage.getItem(storageKey)
            if (cachedData) {
              cachedDrivers = JSON.parse(cachedData)
              if (!Array.isArray(cachedDrivers)) {
                cachedDrivers = []
                localStorage.removeItem(storageKey)
              }
            }

            const validResult = Array.isArray(result) ? result : []

            const currentDriversMap = new Map()
            validResult.forEach(driver => {
              if (driver?.id) {
                currentDriversMap.set(driver.id, driver)
              }
            })

            const cachedDriversMap = new Map()
            cachedDrivers.forEach(driver => {
              if (driver?.id) {
                cachedDriversMap.set(driver.id, driver)
              }
            })

            cachedDrivers.forEach(cachedDriver => {
              if (cachedDriver?.id && !currentDriversMap.has(cachedDriver.id)) {
                currentDriversMap.set(cachedDriver.id, cachedDriver)
              }
            })

            validResult.forEach(driver => {
              if (driver?.id) {
                cachedDriversMap.set(driver.id, driver)
              }
            })

            const dataToCache = Array.from(cachedDriversMap.values())
            localStorage.setItem(storageKey, JSON.stringify(dataToCache))

            finalUsers = Array.from(currentDriversMap.values())
          } catch (error) {
            console.error('Error in driver cache logic:', error)
            finalUsers = result
          }
        }

        usersList.users = finalUsers
        setUsersList({
          ...usersList,
          loading: false
        })
        let nextPageItems = 0
        if (pagination.current_page !== pagination.total_pages) {
          const remainingItems = pagination.total - usersList.users.length
          nextPageItems = remainingItems < pagination.page_size ? remainingItems : pagination.page_size
        }
        setPaginationProps({
          ...paginationProps,
          currentPage: pagination.current_page,
          pageSize: pagination.page_size === 0 ? paginationProps.pageSize : pagination.page_size,
          totalPages: pagination.total_pages,
          totalItems: pagination.total,
          from: pagination.from,
          to: pagination.to,
          nextPageItems
        })
        setPaginationDetail({ ...pagination })
      }
      firstRender.current = false
    } catch (err) {
      if (err.constructor.name !== 'Cancel') {
        setUsersList({
          ...usersList,
          loading: false,
          error: [err.message]
        })
      }
    }
  }

  /**
   * Get the occupations from API
   */
  const getOccupations = async () => {
    try {
      setOccupationsState({
        ...occupationsState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token}`
        }
      }
      const response = await fetch(`${ordering.root}/occupations`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setOccupationsState({
          loading: false,
          occupations: content.result,
          error: null
        })
      } else {
        setOccupationsState({
          ...occupationsState,
          loading: false,
          error: content.result
        })
      }
    } catch (error) {
      setOccupationsState({
        ...occupationsState,
        loading: false,
        error: [error.message]
      })
    }
  }

  /**
   * Change user type
   * @param {object} userType User type
   */
  const handleSelectedUserTypes = (userTypes) => {
    setUserTypesSelected(userTypes)
  }

  /**
   * Method to change user active state for filter
   */
  const handleChangeUserActiveState = () => {
    setSelectedUserActiveState(!selectedUserActiveState)
  }

  /**
   * Method to change user type from API
   * @param {Object} user user id and new type
   */
  const handleChangeUserType = async (user) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const requestsState = {}
      const source = {}
      requestsState.updateOrder = source
      const { content: { error, result } } = await ordering.setAccessToken(session.token).users(user.id).save({ level: user.level }, { cancelToken: source })
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: error ? result : null
      })
      if (!error) {
        let users = []
        if (userTypesSelected.includes(user.level)) {
          users = usersList.users.filter(_user => {
            if (_user.id === user.id) {
              _user.level = user.level
            }
            return true
          })
        } else {
          users = usersList.users.filter(_user => _user.id !== result.id)
        }
        setUsersList({ ...usersList, users })
        showToast(ToastType.Success, t('UPDATED', 'Updated'))
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to change user enable/disable
   * @param {Object} user user id and enable state
   */

  const handleChangeActiveUser = async (user) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const { content: { error, result } } = await ordering.setAccessToken(session.token).users(user.id).save({ enabled: user.enabled })
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: error ? result : null
      })
      if (!error) {
        if (isDriver) {
          handleSuccessUpdate(result)
        } else if (!disabledActiveStateCondition) {
          let users = [...usersList?.users]
          if ((!user.enabled && selectedUserActiveState) || (user?.enabled && !selectedUserActiveState)) {
            users = usersList.users.filter(_user => {
              let valid = true
              if (_user.id === user.id) {
                if (user.enabled === !selectedUserActiveState) {
                  valid = false
                }
              }
              return valid
            })
          } else {
            users.push(user)
          }
          setUsersList({ ...usersList, users })
        }
        showToast(ToastType.Success, t('UPDATED', 'Updated'))
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  /**
  * Method to change busy state of user
  * @param {Object} user user id and busy state
  */

  const handleChangeBusyUser = async (user) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const requestsState = {}
      const source = {}
      requestsState.updateOrder = source
      const { content: { error, result } } = await ordering.setAccessToken(session.token).users(user.id).save({ busy: user.busy }, { cancelToken: source })
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: error ? result : null
      })
      if (!error) {
        let users = []
        users = usersList.users.filter(_user => {
          if (_user.id === user.id) {
            _user.busy = user.busy
          }
          return true
        })
        setUsersList({ ...usersList, users })
        showToast(ToastType.Success, t('UPDATED', 'Updated'))
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to change user type from API
   * @param {Object} user user id and new type
   */
  const handleChangeAvailable = async (user) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const requestsState = {}
      const source = {}
      requestsState.updateOrder = source
      const { content: { error, result } } = await ordering.setAccessToken(session.token).users(user.id).save({ available: user.available }, { cancelToken: source })
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: error ? result : null
      })
      if (!error) {
        let users = []
        users = usersList.users.filter(_user => {
          if (_user.id === user.id) {
            _user.available = user.available
          }
          return true
        })
        setUsersList({ ...usersList, users })
        showToast(ToastType.Success, t('UPDATED', 'Updated'))
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to delete users from API
   * @param {Number} userId user id to delete
   */
  const handleDeleteUser = async (userId) => {
    try {
      setActionStatus({ ...actionStatus, loading: true })
      const { content } = await ordering.setAccessToken(session.token).users(userId).delete()
      if (!content.error) {
        const users = usersList.users.filter(user => user.id !== userId)
        setUsersList({ ...usersList, users })
        if (deleteUsersActionState.loading) {
          const _selectedUsers = [...selectedUsers]
          _selectedUsers.shift()
          if (_selectedUsers.length === 0) {
            setDeleteUsersActionState({ ...deleteUsersActionState, loading: false })
          }
          setSelectedUsers(_selectedUsers)
        }
        setPaginationDetail({
          ...paginationDetail,
          total: paginationDetail?.total - 1
        })
      }
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: content.error ? content.result : null
      })
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
      if (deleteUsersActionState.loading) {
        setDeleteUsersActionState({ ...deleteUsersActionState, loading: false, error: [err.message] })
      }
    }
  }

  /**
   * Method to delete several users from API
   */
  const handleDeleteSeveralUsers = async (code) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setDeleteUsersActionState({
        ...deleteUsersActionState,
        loading: true
      })
      const payload = {
        users_id: selectedUsers
      }
      if (code) {
        payload.deleted_action_code = code
      }
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify(payload)
      }
      const response = await fetch(`${ordering.root}/users`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const users = usersList.users.filter(user => !selectedUsers.includes(user.id))
        setUsersList({ ...usersList, users })
        setPaginationDetail({
          ...paginationDetail,
          total: paginationDetail?.total - selectedUsers.length
        })
        setSelectedUsers([])
        setDeleteUsersActionState({
          loading: false,
          error: null
        })
        showToast(ToastType.Success, t('USER_DELETED', 'User deleted'))
      } else {
        setDeleteUsersActionState({
          loading: false,
          error: content.result
        })
      }
    } catch (error) {
      setDeleteUsersActionState({
        loading: false,
        error: [error.message]
      })
    }
  }

  /**
   * Method to change selected users
   * @param {Number} userId user id to change selected state
   */
  const handleSelectedUsers = (userId) => {
    let _selectedUsers
    if (selectedUsers.includes(userId)) {
      _selectedUsers = selectedUsers.filter(id => id !== userId)
    } else {
      _selectedUsers = [...selectedUsers, userId]
    }
    setSelectedUsers(_selectedUsers)
  }

  /**
   * Method to update users
   * @param {Object} updatedUser updated user
   */
  const handleSuccessUpdate = (updatedUser) => {
    const isLevelOutOfList = typeof updatedUser?.level === 'number' &&
      userTypesSelected.length > 0 &&
      !userTypesSelected.includes(updatedUser.level)
    if (isLevelOutOfList) {
      setUsersList({
        ...usersList,
        users: usersList.users.filter(user => user.id !== updatedUser.id)
      })
      setPaginationDetail({
        ...paginationDetail,
        total: paginationDetail?.total ? paginationDetail.total - 1 : 0
      })
      return
    }
    const users = usersList.users.filter(user => {
      if (user.id === updatedUser.id) {
        Object.assign(user, updatedUser)
      }
      return true
    })
    setUsersList({
      ...usersList,
      users
    })
  }
  /**
   * Method to add user
   * @param {Object} newUser new user to add
   */
  const handleSuccessAddUser = (newUser) => {
    if (userTypesSelected.includes(newUser?.level)) {
      setUsersList({
        ...usersList,
        users: [
          ...usersList.users,
          newUser
        ]
      })
      setPaginationDetail({
        ...paginationDetail,
        total: paginationDetail?.total ? paginationDetail?.total + 1 : 1
      })
    }
  }
  /**
   * Method to delete user
   * @param {Object} user new user to delete
   */
  const handleSuccessDeleteUser = (user) => {
    if (userTypesSelected.includes(user?.level)) {
      setUsersList({
        ...usersList,
        users: usersList.users.filter(_user => _user.id !== user.id)
      })
      setPaginationDetail({
        ...paginationDetail,
        total: paginationDetail?.total - 1
      })
    }
  }
  /**
   * Method to update addresses of selected user
   * @param {number, Array} useId and addresses updated addresses
   */
  const handleSuccessAddressesUpdate = (userId, addresses) => {
    const users = usersList.users.filter(user => {
      if (user.id === userId) {
        user.addresses = [...addresses]
      }
      return true
    })
    setUsersList({
      ...usersList,
      users
    })
  }

  /**
   * Method to get the drivers groups from API
   */
  const getDriversGroups = async () => {
    try {
      setDriversGroupsState({ ...driversGroupsState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/drivergroups`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const found = content.result.find(group => group?.administrators?.some(admin => admin.id === session?.user?.id))
        if (found) setActionDisabled(false)
        else setActionDisabled(true)
        const driverManagerGroups = content.result?.filter(group => group.administrators?.some(admin => admin.id === session?.user?.id))
        setDriversGroupsState({ ...driversGroupsState, groups: driverManagerGroups, loading: false })
      }
    } catch (err) {
      setDriversGroupsState({ ...driversGroupsState, loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    if (session?.user?.level === 5) {
      getDriversGroups()
    } else {
      setActionDisabled(false)
    }
  }, [session])

  useEffect(() => {
    getUsers(firstRender.current ? paginationProps.currentPage : 1, null)
  }, [userTypesSelected, selectedUserActiveState, searchValue, isVerified, selectedOccupation, multiFilterValues, orderFilterValue])

  useEffect(() => {
    return () => {
      if (requestsState.current.users?.cancel) {
        requestsState.current.users.cancel()
      }
    }
  }, [])

  useEffect(() => {
    if ((Object.keys(filterValues?.changes).length > 0 || filterValues.clear) && !usersList.loading) getUsers(1, null)
  }, [filterValues])

  useEffect(() => {
    if (isProfessional) {
      getOccupations()
    }
  }, [isProfessional])

  useEffect(() => {
    events.on('occupations_update', (data) => {
      setOccupationsState({
        ...occupationsState,
        occupations: data
      })
    })
    return () => {
      events.off('occupations_update')
    }
  }, [events])

  useEffect(() => {
    const handleUpdateDriver = (driver) => {
      const selectedUser = usersList?.users?.find(item => item?.id === driver?.id)
      if (selectedUser && ((driver?.enabled !== selectedUser?.enabled) || (driver?.available !== selectedUser?.available))) {
        const updatedUserList = usersList?.users.map(item => {
          if (item.id === driver?.id) {
            return {
              ...item,
              enabled: driver?.enabled,
              available: driver?.available,
              busy: driver?.busy
            }
          }
          return item
        })
        setUsersList({ ...usersList, users: updatedUserList })
      }
    }

    socket.on('drivers_update', handleUpdateDriver)

    return () => {
      socket.off('drivers_update', handleUpdateDriver)
    }
  }, [socket, usersList?.users])

  useEffect(() => {
    if (isDriver && session?.user?.level === 5 && session?.user?.id && usersList?.users?.length > 0 && !usersList.loading) {
      try {
        const storageKey = `drivers_cache_${session.user.id}`
        if (Array.isArray(usersList.users)) {
          const validDrivers = usersList.users.filter(driver => driver?.id)
          if (validDrivers.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(validDrivers))
          }
        }
      } catch (error) {
        console.error('Error updating localStorage cache:', error)
      }
    }
  }, [usersList.users, isDriver, session?.user?.level, session?.user?.id, usersList.loading])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            actionStatus={actionStatus}
            usersList={usersList}
            filterValues={filterValues}
            setFilterValues={setFilterValues}
            userTypesSelected={userTypesSelected}
            handleSelectedUserTypes={handleSelectedUserTypes}
            paginationProps={paginationProps}
            getUsers={getUsers}
            searchValue={searchValue}
            onSearch={setSearchValue}
            paginationDetail={paginationDetail}
            selectedUserActiveState={selectedUserActiveState}
            isVerified={isVerified}
            setIsVerified={setIsVerified}
            handleChangeUserActiveState={handleChangeUserActiveState}
            handleChangeUserType={handleChangeUserType}
            handleChangeActiveUser={handleChangeActiveUser}
            handleChangeAvailable={handleChangeAvailable}
            handleDeleteUser={handleDeleteUser}
            selectedUsers={selectedUsers}
            handleSelectedUsers={handleSelectedUsers}
            deleteUsersActionState={deleteUsersActionState}
            handleDeleteSeveralUsers={handleDeleteSeveralUsers}
            handleSuccessUpdate={handleSuccessUpdate}
            handleSuccessAddUser={handleSuccessAddUser}
            handleSuccessDeleteUser={handleSuccessDeleteUser}
            handleSuccessAddressesUpdate={handleSuccessAddressesUpdate}
            occupationsState={occupationsState}
            selectedOccupation={selectedOccupation}
            handleSelectOccupation={setSelectedOccupation}
            setSelectedUsers={setSelectedUsers}
            orderFilterValue={orderFilterValue}
            handleChangeOrderFilterValue={setOrderFilterValue}
            multiFilterValues={multiFilterValues}
            handleChangeMultiFilterValues={handleChangeMultiFilterValues}
            actionDisabled={actionDisabled}
            driversGroupsState={driversGroupsState}
            handleChangeBusyUser={handleChangeBusyUser}
          />
        )
      }
    </>
  )
}

UsersList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Enable/Disable search option
   * Search Users list by a user ID
   */
  isSearchByUserId: PropTypes.bool,
  /**
   * Enable/Disable search option
   * Search Users list by a user email
   */
  isSearchByUserEmail: PropTypes.bool,
  /**
   * Enable/Disable search option
   * Search Users list by a user phone
   */
  isSearchByUserPhone: PropTypes.bool,
  /**
   * Array of user props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: [
    'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'schedule', 'external_id',
    'country_phone_code', 'city_id', 'city', 'address', 'addresses', 'max_days_in_future', 'push_tokens',
    'address_notes', 'driver_zone_restriction', 'mono_session', 'dropdown_option_id', 'dropdown_option', 'location', 'available',
    'zipcode', 'level', 'enabled', 'middle_name', 'second_lastname', 'birthdate', 'drivergroups', 'created_at', 'timezone', 'busy'
  ],
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' },
  defaultUserTypesSelected: [0, 1, 2, 3],
  defaultUserActiveState: true
}
