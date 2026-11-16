import React, { useEffect, useState, useRef, useContext } from 'react'
import PropTypes, { string } from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { ConfigFileContext } from '../../ui/src/contexts/ConfigFileContext'
import { getDashboardStorageKey } from '~/utils/local-tenant'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useEvent } from '../../contexts/EventContext'
import { useWebsocket } from '../../contexts/WebsocketContext'
import { USERS_FILTER_INITIAL_VALUES } from '../UsersFilter'
import { confirmationPayload } from '../../utils/confirmationPayload'

// redesign UC-B1 (M-10): the error of an outcome is the API result when it is an array of strings, else null; never an object
const outcomeError = (result) => Array.isArray(result) && result.every(item => typeof item === 'string') ? result : null

// redesign DL-B1 (decision 7, M-DL6): the only attributes the live driver events may change on a loaded row
const LIVE_DRIVER_ATTRIBUTES = ['enabled', 'available', 'busy']

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
    isSearchByFullName,
    isBusinessOwners,
    defaultUserTypesSelected,
    disabledActiveStateCondition,
    isDriver,
    isProfessional,
    searchSeed,
    filterSeed,
    statusFilter,
    liveDriversRoom,
    clearSelectionOnQueryChange
  } = props
  // redesign DL-B1 (decision 3): only a value other than undefined / 'all' changes the request
  const activeStatusFilter = statusFilter && statusFilter !== 'all' ? statusFilter : null

  const [ordering] = useApi()
  const [configFile] = useContext(ConfigFileContext) || []
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

  // redesign (n.º 14, D-55): opt-in; functional update so an already empty selection does not re-render
  const clearSelection = () => setSelectedUsers(current => current.length ? [] : current)

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
    // redesign (n.º 14, D-55): a bulk delete only reaches what is on screen, so a different page or page size empties the selection
    if (clearSelectionOnQueryChange && ((page != null && page !== paginationProps.currentPage) || (pageSize != null && pageSize !== paginationProps.pageSize))) {
      clearSelection()
    }
    const source = {}
    if (requestsState.current.users?.cancel) {
      requestsState.current.users.cancel()
    }
    requestsState.current.users = source
    try {
      // a new load leaves the last error behind (the tables paint the error over the rows while it is set)
      setUsersList({ ...usersList, loading: true, error: null })
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

      // redesign DL-B1 (decision 3): each status asks for exactly its state, ANDed with the conditions above
      if (activeStatusFilter === 'available') {
        conditions.push({ attribute: 'enabled', value: true }, { attribute: 'available', value: true }, { attribute: 'busy', value: false })
      } else if (activeStatusFilter === 'busy') {
        conditions.push({ attribute: 'enabled', value: true }, { attribute: 'available', value: true }, { attribute: 'busy', value: true })
      } else if (activeStatusFilter === 'offline') {
        conditions.push({ attribute: 'enabled', value: true }, { attribute: 'available', value: false })
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

        // redesign UC-B1 (decision 2A, auditor #8): «Olivia Bennett» matches name «Olivia» AND lastname «Bennett»
        const trimmedSearch = String(searchValue).trim()
        const firstSpace = trimmedSearch.search(/\s/)
        if (isSearchByFullName && firstSpace > 0) {
          searchConditions.push({
            conector: 'AND',
            conditions: [
              {
                attribute: 'name',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${trimmedSearch.slice(0, firstSpace)}%`)
                }
              },
              {
                attribute: 'lastname',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${trimmedSearch.slice(firstSpace).trim()}%`)
                }
              }
            ]
          })
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

        // redesign DL-B1 (decision 3, M-DL5): a filtered answer is not merged with the level 5 cache (it would bring back rows that do not match)
        if (isDriver && session?.user?.level === 5 && session?.user?.id && !activeStatusFilter) {
          try {
            const storageKey = getDashboardStorageKey(configFile, `drivers_cache_${session.user.id}`)
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

        // redesign (row 92, M-C18): the new list goes into the new state object; the previous one is not assigned to
        setUsersList({
          ...usersList,
          users: finalUsers,
          loading: false,
          error: null // a good answer clears the error of the load before it (Retry, a tab, a search)
        })
        let nextPageItems = 0
        if (pagination.current_page !== pagination.total_pages) {
          const remainingItems = pagination.total - finalUsers.length
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
      // an admin-level toggle goes through ConfirmAdmin first, which hands over the one-time
      // confirmation_token the API now requires to flip `enabled` on a level 0 user; a toggle that never
      // asked (any other level) carries none.
      const { content: { error, result } } = await ordering.setAccessToken(session.token).users(user.id).save({
        enabled: user.enabled,
        ...confirmationPayload(user.confirmationToken)
      })
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: error ? result : null
      })
      if (!error) {
        if (isDriver) {
          handleSuccessUpdate(result)
        } else {
          // the row follows what the API returned (result.enabled), not what was asked; without a state condition it
          // changes in place (only `enabled`: the list's other fields stay as it fetched them), with one it leaves the list when it
          // is no longer the list's state, and a user that was not in it enters as the returned record
          const saved = result && typeof result === 'object' ? result : {}
          const enabled = typeof saved.enabled === 'boolean' ? saved.enabled : !!user.enabled
          const inList = usersList.users.some(_user => _user.id === user.id)
          let users
          if (!disabledActiveStateCondition && enabled !== !!selectedUserActiveState) {
            users = usersList.users.filter(_user => _user.id !== user.id)
          } else if (inList) {
            users = usersList.users.map(_user => (_user.id === user.id ? { ..._user, enabled } : _user))
          } else {
            users = disabledActiveStateCondition ? usersList.users : [...usersList.users, { ...user, ...saved, enabled }]
          }
          setUsersList({ ...usersList, users })
        }
        showToast(ToastType.Success, t('UPDATED', 'Updated'))
      }
      // redesign UC-B1 (M-10): the caller learns the outcome; on success it also gets the record the API returned
      return error ? { ok: false, error: outcomeError(result) } : { ok: true, error: null, user: result }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
      return { ok: false, error: null }
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
        // the row follows what the API returned (result.busy), not what was asked
        const busy = typeof result?.busy === 'boolean' ? result.busy : user.busy
        let users = []
        users = usersList.users.filter(_user => {
          if (_user.id === user.id) {
            _user.busy = busy
          }
          return true
        })
        setUsersList({ ...usersList, users })
        showToast(ToastType.Success, t('UPDATED', 'Updated'))
      }
      // redesign DL-B1 (M-DL3): the caller learns the outcome, like handleChangeActiveUser; with the record the API returned
      return error ? { ok: false, error: outcomeError(result) } : { ok: true, error: null, user: result }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
      return { ok: false, error: null }
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
        // the row follows what the API returned (result.available), not what was asked
        const available = typeof result?.available === 'boolean' ? result.available : user.available
        let users = []
        users = usersList.users.filter(_user => {
          if (_user.id === user.id) {
            _user.available = available
          }
          return true
        })
        setUsersList({ ...usersList, users })
        showToast(ToastType.Success, t('UPDATED', 'Updated'))
      }
      // redesign DL-B1 (M-DL3): the caller learns the outcome, like handleChangeActiveUser; with the record the API returned
      return error ? { ok: false, error: outcomeError(result) } : { ok: true, error: null, user: result }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
      return { ok: false, error: null }
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
   * `token` is the ConfirmAdmin confirmation_token (action `users_delete`).
   */
  const handleDeleteSeveralUsers = async (token) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setDeleteUsersActionState({
        ...deleteUsersActionState,
        loading: true
      })
      const payload = {
        users_id: selectedUsers,
        ...confirmationPayload(token)
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
    // redesign (n.º 14, D-55): a new filter or search empties the selection, even when the page stays the first one
    if (clearSelectionOnQueryChange) clearSelection()
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
    if ((Object.keys(filterValues?.changes).length > 0 || filterValues.clear) && !usersList.loading) {
      if (clearSelectionOnQueryChange) clearSelection()
      getUsers(1, null)
    }
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

  // redesign DL-B1 (decision 3): a change of the status filter asks again for page 1 once; the first render already asked
  const lastStatusFilter = useRef(activeStatusFilter)
  useEffect(() => {
    if (lastStatusFilter.current === activeStatusFilter) return
    lastStatusFilter.current = activeStatusFilter
    getUsers(1, paginationProps.pageSize)
  }, [activeStatusFilter])

  // redesign DL-B1 (decision 7, M-DL6): updates a row when enabled, available OR busy differ, copying only the attributes the event
  // carries, and with the functional form so it never reads the rows of an old render.
  useEffect(() => {
    const handleUpdateDriver = (driver) => {
      setUsersList((prevState) => {
        const selectedUser = prevState?.users?.find(item => item?.id === driver?.id)
        if (!selectedUser) return prevState
        const patch = {}
        for (const attribute of LIVE_DRIVER_ATTRIBUTES) {
          if (driver?.[attribute] !== undefined && driver[attribute] !== selectedUser[attribute]) {
            patch[attribute] = driver[attribute]
          }
        }
        if (Object.keys(patch).length === 0) return prevState
        return {
          ...prevState,
          users: prevState.users.map(item => item.id === driver.id ? { ...item, ...patch } : item)
        }
      })
    }

    socket.on('drivers_update', handleUpdateDriver)

    return () => {
      socket.off('drivers_update', handleUpdateDriver)
    }
  }, [socket])

  // redesign DL-B1 (decision 7, M-DL6): opt-in, like K/DriversList: join the drivers room as manager now if connected and on every
  // (re)connect; leaving it only drops this page's use of the room (the socket counts the uses)
  useEffect(() => {
    if (!liveDriversRoom || !session?.auth || session?.loading || !socket?.socket) return
    const io = socket.socket
    const room = { room: 'drivers', user_id: session?.user?.id, role: 'manager' }
    const handleJoin = () => socket.join(room)
    if (io.connected) handleJoin()
    io.on('connect', handleJoin)

    return () => {
      socket.leave(room)
      io.off('connect', handleJoin)
    }
  }, [liveDriversRoom, socket, socket?.socket, session?.auth, session?.loading, session?.user?.id])

  // redesign DL-B1 (decision 7, M-DL6): live status of the rows already loaded: only available, busy and enabled, only the ones that arrive;
  // never adds, removes or reorders rows
  useEffect(() => {
    if (!liveDriversRoom) return
    const handleBatchDriverChanges = (batch) => {
      if (!Array.isArray(batch)) return
      const patches = new Map()
      for (const entry of batch) {
        if (!Array.isArray(entry?.changes)) continue
        for (const change of entry.changes) {
          if (!LIVE_DRIVER_ATTRIBUTES.includes(change?.attribute)) continue
          patches.set(entry.driver_id, { ...patches.get(entry.driver_id), [change.attribute]: change.new })
        }
      }
      if (patches.size === 0) return
      setUsersList((prevState) => {
        let changed = false
        const users = prevState.users.map(item => {
          const patch = patches.get(item?.id)
          if (!patch || Object.keys(patch).every(attribute => item[attribute] === patch[attribute])) return item
          changed = true
          return { ...item, ...patch }
        })
        return changed ? { ...prevState, users } : prevState
      })
    }

    socket.on('batch_driver_changes', handleBatchDriverChanges)

    return () => {
      socket.off('batch_driver_changes', handleBatchDriverChanges)
    }
  }, [liveDriversRoom, socket])

  // redesign DL-B1 (decision 3, M-DL5): rows of a filtered answer are not written into the level 5 cache. `activeStatusFilter` is
  // deliberately not a dependency: when it goes back to «all» the rows still on screen are the filtered ones until the reload lands
  useEffect(() => {
    if (isDriver && session?.user?.level === 5 && session?.user?.id && !activeStatusFilter && usersList?.users?.length > 0 && !usersList.loading) {
      try {
        const storageKey = getDashboardStorageKey(configFile, `drivers_cache_${session.user.id}`)
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
   * Opt-in (UC-B1): a search with a space also matches «first word» as name AND «the rest» as lastname
   */
  isSearchByFullName: PropTypes.bool,
  /**
   * Opt-in (DL-B1): driver status asked from the API. `undefined` / 'all' is today's request;
   * 'available' = enabled, available, not busy; 'busy' = enabled, available, busy; 'offline' = enabled, not available
   */
  statusFilter: PropTypes.oneOf(['all', 'available', 'busy', 'offline']),
  /**
   * Opt-in (DL-B1): join the `drivers` socket room as manager and apply `batch_driver_changes` (available, busy, enabled) to the loaded rows
   */
  liveDriversRoom: PropTypes.bool,
  /**
   * Opt-in (n.º 14, D-55): the selection empties when the page, the page size, a filter or the search changes, so a bulk delete only reaches visible rows
   */
  clearSelectionOnQueryChange: PropTypes.bool,
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
  defaultUserActiveState: true,
  isSearchByFullName: false, // redesign UC-B1 (decision 2A): opt-in
  liveDriversRoom: false // redesign DL-B1 (decision 7, M-DL6): opt-in
}
