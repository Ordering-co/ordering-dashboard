import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { saveAssignment } from '../../utils/saveAssignment'

const isAlwaysOpenSchedule = (schedule) => Array.isArray(schedule) &&
  schedule.length === 7 &&
  schedule.every(day => day?.enabled && day?.lapses?.some(lapse =>
    lapse?.open?.hour === 0 &&
    lapse?.open?.minute === 0 &&
    lapse?.close?.hour === 23 &&
    lapse?.close?.minute === 59
  ))

const normalizeScheduleChanges = (changes) => isAlwaysOpenSchedule(changes?.schedule)
  ? { ...changes, schedule: null }
  : changes

const parseIds = (value) => (typeof value === 'string' ? JSON.parse(value) : value) ?? []
const temporaryKey = (drivers) => JSON.stringify(drivers.map(({ id, temporary_at: at }) => [id, at ?? null]).sort((a, b) => a[0] - b[0]))

/**
 * takes the drivers and managers out of a save as one add or remove per person against the saved group
 * (`[path, id, assign]`), so two people editing the same group keep each other's changes. The drivers stay in the
 * whole list save when the type changes, when they are emptied (the API ignores an empty list), or when a temporary
 * activation changes, which only the whole list carries.
 */
const splitAssignments = (changes, saved) => {
  const rest = { ...changes }
  const assignments = []
  const diff = (path, nextIds, savedPeople) => {
    const savedIds = (savedPeople ?? []).map(person => person.id)
    nextIds.filter(id => !savedIds.includes(id)).forEach(id => assignments.push([path, id, true]))
    savedIds.filter(id => !nextIds.includes(id)).forEach(id => assignments.push([path, id, false]))
  }
  const savedTemporary = (saved?.drivers ?? []).filter(driver => driver?.temporary_at)
  const temporaryChanged = temporaryKey(parseIds(rest.temporary_drivers)) !== temporaryKey(savedTemporary)
  if (rest.drivers && !('type' in rest) && !temporaryChanged) {
    diff('drivers', parseIds(rest.drivers), saved?.drivers)
    delete rest.drivers
    delete rest.temporary_drivers
  }
  if ('administrators' in rest) {
    diff('administrators', parseIds(rest.administrators), saved?.administrators)
    delete rest.administrators
  }
  return [rest, assignments]
}

export const DriversGroupDetails = (props) => {
  const {
    UIComponent,
    driversGroupsState,
    setDriversGroupsState,
    curDriversGroup,
    driversGroupId,
    driversManagers,
    businesses,
    paymethods,
    drivers,
    companies
  } = props

  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [driversGroupState, setDriversGroupState] = useState({ driversGroup: props.curDriversGroup, loading: !props.curDriversGroup, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [changesState, setChangesState] = useState({})
  const [selectedBusinessIds, setSelectedBusinessIds] = useState([])
  const [selectedPaymethodIds, setSelectedPaymethodIds] = useState([])
  const [selectedDriverIds, setSelectedDriverIds] = useState([])
  const [selectedDriverTemporaryIds, setSelectedDriverTemporaryIds] = useState([])
  const [selectedDriversCompanyIds, setSelectedDriversCompanyIds] = useState([])
  const [selectedDriverManager, setSelectedDriverManager] = useState([])
  const [useAdvanced, setUseAdvanced] = useState(false)
  const [isScheduleEnabled, setIsScheduleEnabled] = useState(false)

  const initSet = (driversGroup) => {
    setIsScheduleEnabled(!!driversGroup?.schedule)
    const businessIds = driversGroup?.business?.reduce((ids, business) => [...ids, business.id], []) || []
    setSelectedBusinessIds(businessIds)
    setSelectedPaymethodIds(driversGroup?.allowed_paymethods || [])
    const drivers = driversGroup?.drivers?.reduce((ids, driver) => [...ids, driver.id], [])
    setSelectedDriverIds(drivers)
    const driversTemporary = driversGroup?.drivers?.reduce((driverData, driver) => {
      if (driver?.temporary_at) {
        return [...driverData, { id: driver?.id, temporarily_activated: true, temporary_at: driver?.temporary_at }]
      } else {
        return [...driverData]
      }
    }, [])
    const useAdvancedLogistics = driversGroup?.autoassign_amount_drivers !== 0 && driversGroup?.orders_group_max_orders !== 0
    useAdvancedLogistics ? setUseAdvanced(true) : setUseAdvanced(false)
    setSelectedDriverTemporaryIds(driversTemporary)
    const companyIds = driversGroup?.driver_companies?.reduce((ids, company) => [...ids, company.id], [])
    setSelectedDriversCompanyIds(companyIds)
    const managersIds = driversGroup?.administrators?.reduce((ids, manager) => [...ids, manager.id], [])
    setSelectedDriverManager(managersIds)
  }

  /**
   * Method to get the drives group from API
   */
  const getDriversGroup = async () => {
    try {
      setDriversGroupState({
        ...driversGroupState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/drivergroups/${driversGroupId}`, requestOptions)
      const { result, error } = await response.json()
      if (!error) {
        setDriversGroupState({
          loading: false,
          driversGroup: result,
          error: null
        })
        initSet(result)
      } else {
        setDriversGroupState({
          ...driversGroupState,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setDriversGroupState({
        ...driversGroupState,
        loading: false,
        error: [error.message]
      })
    }
  }

  // redesign DG-R1 (R1-01): `refreshOnOpen` (opt-in). A group that comes from a row of the list has stores without `location`; the
  // overview map of the zones needs it. The row is painted at once (no `loading`), the detail is asked for and swapped in. The id
  // being refreshed is remembered so the answer of a group that is no longer the open one, or that a save has overtaken, is dropped.
  const refreshingId = useRef(null)
  const changesRef = useRef(changesState)
  changesRef.current = changesState
  useEffect(() => () => { refreshingId.current = null }, [])

  const refreshDriversGroup = async (id) => {
    refreshingId.current = id
    try {
      const response = await fetch(`${ordering.root}/drivergroups/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
      const { result, error } = await response.json()
      if (refreshingId.current !== id || error || !result) return
      setDriversGroupState({ loading: false, driversGroup: result, error: null })
      // what the user already changed is theirs: the selections only follow the detail while nothing has been touched
      if (Object.keys(changesRef.current).length === 0) initSet(result)
    } catch (err) {
      // the row stays on screen: the detail only adds what the list does not carry
    }
  }

  /**
   * Method to update selected drivers group from API
   * @param {Object} changes
   * @returns {Promise<{ ok: boolean, error?: Array }>} redesign DG-B1
   */
  const handleUpdateDriversGroup = async (_changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true, error: null })
      let changes = normalizeScheduleChanges(_changes)
      const skipeableValues = ['', '[]']
      Object.keys(changes)?.map(changeName => {
        if (typeof changes?.[changeName] !== 'undefined') {
          changes = {
            ...changes,
            [changeName]: skipeableValues.includes(changes?.[changeName]) ? null : changes?.[changeName]
          }
        }
      })

      let assignments
      [changes, assignments] = splitAssignments(changes, driversGroupState?.driversGroup)
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const groupId = curDriversGroup?.id || driversGroupId
      let content = { error: false, result: driversGroupState?.driversGroup }
      if (Object.keys(changes).length > 0) {
        const response = await fetch(`${ordering.root}/drivergroups/${groupId}`, requestOptions)
        content = await response.json()
      }
      // each answer is the whole group, so the last one carries every change sent
      for (const [path, id, assign] of assignments) {
        if (content.error) break
        content = await saveAssignment(ordering, token, `drivergroups/${groupId}/${path}/${id}`, assign)
      }
      if (!content.error) {
        refreshingId.current = null // redesign DG-R1 (R1-01): a refresh that was on its way is older than this answer
        setActionState({ error: null, loading: false })
        const groups = driversGroupsState.groups.filter(group => {
          if (group.id === groupId) {
            Object.assign(group, content.result)
            const useAdvancedLogistics = group?.autoassign_amount_drivers !== 0 && group?.orders_group_max_orders !== 0
            useAdvancedLogistics ? setUseAdvanced(true) : setUseAdvanced(false)
          }
          return true
        })
        setDriversGroupsState({ ...driversGroupsState, groups })
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
        setDriversGroupState({
          ...driversGroupState,
          driversGroup: content.result
        })
        setIsScheduleEnabled(!!content.result?.schedule)
        // redesign DG-B1 (M-DG5): only the keys that were sent leave `changesState`. A "Save" sends all of it (so it
        // empties, as before); the header switch ({ enabled }) leaves the unsaved changes of the other tabs alone.
        const sentKeys = Object.keys(_changes || {})
        setChangesState(prev => {
          const rest = { ...prev }
          sentKeys.forEach(key => { delete rest[key] })
          return rest
        })
        return { ok: true } // redesign DG-B1
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
        return { ok: false, error: content.result } // redesign DG-B1
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      return { ok: false, error: [err.message] } // redesign DG-B1
    }
  }

  /**
   * Method to delete the drivers group from API
   * @returns {Promise<{ ok: boolean, error?: Array }>} redesign DG-B1
   */
  const handleDeleteDriversGroup = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true, error: null })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/drivergroups/${curDriversGroup.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        const groups = driversGroupsState.groups.filter(group => group.id !== curDriversGroup.id)
        setDriversGroupsState({ ...driversGroupsState, groups })
        props.reloadDriversGroups?.() // the local filter leaves the total and the pages stale
        showToast(ToastType.Success, t('DRIVER_GROUP_DELETED', 'Driver group deleted'))
        props.onClose && props.onClose()
        return { ok: true } // redesign DG-B1
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
        return { ok: false, error: content.result } // redesign DG-B1
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      return { ok: false, error: [err.message] } // redesign DG-B1
    }
  }

  /**
   * Method to add new drivers group from API
   */
  const handleAddDriversGroup = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const changes = {
        ...normalizeScheduleChanges(changesState),
        driver_available_max_distance: changesState?.driver_available_max_distance || null
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/drivergroups`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ loading: false, error: null })
        let newGroup = { ...content.result }
        if (!content.result?.administrator && (driversManagers.length > 0 || user?.level === 5)) {
          const newAdmin = driversManagers.find(manager => manager.id === content.result?.administrator_id)
          newGroup = {
            ...newGroup,
            administrator: user?.level !== 5 ? newAdmin : JSON.parse(JSON.stringify(user))
          }
        }
        const groups = [...driversGroupsState.groups, newGroup]
        setDriversGroupsState({ ...driversGroupsState, groups })
        props.reloadDriversGroups?.() // the local append gives 11 rows on a page of 10 and a stale total
        showToast(ToastType.Success, t('DRIVER_GROUP_ADDED', 'Driver group added'))
        setChangesState({})
        // (row 27, drivers-groups P-10, D-39 (a)): with `onCreated` the owner opens the new group's record; without it, close as before (never both)
        if (props.onCreated) props.onCreated(newGroup)
        else props.onClose && props.onClose()
      } else {
        setActionState({ loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  const handleChangesState = (changes) => {
    const mergedChanges = { ...changesState, ...changes }
    const enterToValidation = Object?.keys(mergedChanges)?.filter(changeName => changeName === 'autoassign_amount_drivers' || changeName === 'orders_group_max_orders')
    if (enterToValidation?.length === 2) {
      const useAdvancedLogistics = mergedChanges?.autoassign_amount_drivers !== 0 && mergedChanges?.orders_group_max_orders !== 0
      useAdvancedLogistics ? setUseAdvanced(true) : setUseAdvanced(false)
    }
    setChangesState(mergedChanges)
  }

  const handleChangeMaxDistance = (value) => {
    const maxDistance = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    setChangesState({ ...changesState, driver_available_max_distance: maxDistance })
  }

  const handleSelectBusiness = (businessId, checked) => {
    const businessIds = [...selectedBusinessIds]
    let filteredIds = []
    if (checked) {
      filteredIds = [...businessIds, businessId]
    } else {
      filteredIds = businessIds.filter(id => id !== businessId)
    }
    setSelectedBusinessIds(filteredIds)
    setChangesState({
      ...changesState,
      business: JSON.stringify(filteredIds)
    })
  }

  const handleSelectAllBusiness = (isAll) => {
    let filteredIds = []
    if (isAll) {
      // redesign D-12 (owner, 2026-10-19): the page on screen joins the selection; the stores ticked on other
      // pages stay ticked (it used to replace the selection). "Select none" still clears everything.
      const pageIds = businesses?.map(business => business.id) || []
      filteredIds = [...selectedBusinessIds, ...pageIds.filter(id => !selectedBusinessIds.includes(id))]
    }
    setSelectedBusinessIds(filteredIds)
    setChangesState({
      ...changesState,
      business: JSON.stringify(filteredIds)
    })
  }

  const handleSelectPaymethod = (paymethodId, checked) => {
    const paymethodIds = [...selectedPaymethodIds]
    let filteredIds = []
    if (checked) {
      filteredIds = [...paymethodIds, paymethodId]
    } else {
      filteredIds = paymethodIds.filter(id => id !== paymethodId)
    }
    setSelectedPaymethodIds(filteredIds)
    setChangesState({
      ...changesState,
      allowed_paymethods: JSON.stringify(filteredIds)
    })
  }

  const handleSelectDriver = (driverId, checked) => {
    const driverIds = [...selectedDriverIds]
    let filteredIds = []
    if (checked) {
      filteredIds = [...driverIds, driverId]
    } else {
      filteredIds = driverIds.filter(id => id !== driverId)
    }
    setSelectedDriverIds(filteredIds)
    const changes = {
      ...changesState,
      drivers: JSON.stringify(filteredIds)
    }
    if (selectedDriverTemporaryIds?.length > 0) {
      changes.temporary_drivers = JSON.stringify(selectedDriverTemporaryIds)
    } else if ('temporary_drivers' in changes) {
      delete changes.temporary_drivers
    }
    setChangesState(changes)
  }

  const handleSelectDriverTemporary = (driverId, checked, temporaryAt) => {
    const index = selectedDriverTemporaryIds.findIndex(driver => driver.id === driverId)

    if (checked) {
      if (index !== -1) {
        selectedDriverTemporaryIds[index] = {
          ...selectedDriverTemporaryIds[index],
          temporarily_activated: checked,
          temporary_at: temporaryAt || null
        }
      } else {
        selectedDriverTemporaryIds.push({
          id: driverId,
          temporarily_activated: checked,
          temporary_at: temporaryAt || null
        })
      }
    } else {
      if (index !== -1) {
        selectedDriverTemporaryIds.splice(index, 1)
      }
    }

    setSelectedDriverTemporaryIds([...selectedDriverTemporaryIds])

    const changes = {
      ...changesState,
      drivers: JSON.stringify(selectedDriverIds)
    }
    if (selectedDriverTemporaryIds.length > 0) {
      changes.temporary_drivers = JSON.stringify(selectedDriverTemporaryIds)
    } else if ('temporary_drivers' in changes) {
      delete changes.temporary_drivers
    }
    setChangesState(changes)
  }

  const handleSelectDriversCompany = (driverCompanyId, checked) => {
    const driverCompanyIds = [...selectedDriversCompanyIds]
    let filteredIds = []
    if (checked) {
      filteredIds = [...driverCompanyIds, driverCompanyId]
    } else {
      filteredIds = driverCompanyIds.filter(id => id !== driverCompanyId)
    }
    setSelectedDriversCompanyIds(filteredIds)
    setChangesState({
      ...changesState,
      driver_companies: JSON.stringify(filteredIds)
    })
  }

  const handleSelectAllPaymethod = (isAll) => {
    const paymethodIds = paymethods?.reduce((ids, paymethod) => [...ids, paymethod.id], [])
    let filteredIds = []
    if (isAll) {
      filteredIds = [...paymethodIds]
    } else {
      filteredIds = []
    }
    setSelectedPaymethodIds(filteredIds)
    setChangesState({
      ...changesState,
      allowed_paymethods: JSON.stringify(filteredIds)
    })
  }

  const handleSelectAllDriver = (isAll) => {
    const driverIds = drivers?.reduce((ids, driver) => [...ids, driver.id], [])
    let filteredIds = []
    if (isAll) {
      filteredIds = [...driverIds]
    } else {
      filteredIds = []
    }
    setSelectedDriverIds(filteredIds)
    setChangesState({
      ...changesState,
      drivers: JSON.stringify(filteredIds)
    })
  }

  const handleSelectAllDriversCompany = (isAll) => {
    const driverCompanyIds = companies?.reduce((ids, company) => [...ids, company.id], [])
    let filteredIds = []
    if (isAll) {
      filteredIds = [...driverCompanyIds]
    } else {
      filteredIds = []
    }
    setSelectedDriversCompanyIds(filteredIds)
    setChangesState({
      ...changesState,
      driver_companies: JSON.stringify(filteredIds)
    })
  }

  const handleChangeType = (type) => {
    const changes = { ...changesState }
    delete changes.drivers
    delete changes.driver_companies
    changes.type = type
    setSelectedDriverIds([])
    setSelectedDriverManager([])
    setSelectedDriversCompanyIds([])
    setChangesState({ ...changes })
  }

  const handleSelectDriverManager = (managerId, checked) => {
    const driverCompanyIds = selectedDriverManager
    let filteredIds = []
    if (checked) {
      filteredIds = [...driverCompanyIds, managerId]
    } else {
      filteredIds = driverCompanyIds.filter(id => id !== managerId)
    }
    setSelectedDriverManager(filteredIds)
    setChangesState({
      ...changesState,
      administrators: JSON.stringify(filteredIds)
    })
  }

  // checking «Use advanced logistic» again restores the values it had (saved or edited here), 1 only if it never had any
  const advancedValuesRef = useRef({})
  const handleLogistic = (checked) => {
    const positive = (value) => Number(value) > 0 ? Number(value) : null
    const saved = driversGroupState?.driversGroup
    const keys = ['autoassign_amount_drivers', 'orders_group_max_orders']
    const changes = {}
    keys.forEach(key => {
      if (!checked) {
        const current = positive(changesState[key] ?? saved?.[key])
        if (current) advancedValuesRef.current[key] = current
      }
      changes[key] = checked ? (advancedValuesRef.current[key] ?? positive(saved?.[key]) ?? 1) : 0
    })
    handleChangesState(changes)
  }

  const handleChangeScheduleEnabled = (enabled, defaultTimezone) => {
    const driversGroup = driversGroupState?.driversGroup
    setIsScheduleEnabled(enabled)
    setChangesState(prevChanges => {
      const { schedule, timezone, ...changes } = prevChanges
      if (!enabled) {
        return driversGroup?.schedule ? { ...changes, schedule: null } : changes
      }
      const nextTimezone = timezone ?? driversGroup?.timezone ?? defaultTimezone
      return nextTimezone && nextTimezone !== driversGroup?.timezone
        ? { ...changes, timezone: nextTimezone }
        : changes
    })
  }

  const handleChangeScheduleState = (schedule) => {
    setChangesState(prevChanges => ({ ...prevChanges, schedule }))
  }

  const handleSelectAllManagers = (isAll) => {
    const managerIds = driversManagers?.reduce((ids, manager) => [...ids, manager.id], [])
    let filteredIds = []
    if (isAll) {
      filteredIds = [...managerIds]
    } else {
      filteredIds = []
    }
    setSelectedDriverManager(filteredIds)
    setChangesState({
      ...changesState,
      administrators: JSON.stringify(filteredIds)
    })
  }

  useEffect(() => {
    setChangesState({})
    refreshingId.current = null
    if (curDriversGroup) {
      setDriversGroupState({
        ...driversGroupState,
        loading: false,
        driversGroup: curDriversGroup
      })
      initSet(curDriversGroup)
      // redesign DG-R1 (R1-01): the row first, then the detail (a single request)
      if (props.refreshOnOpen && curDriversGroup.id) refreshDriversGroup(curDriversGroup.id)
    } else {
      setDriversGroupState({
        driversGroup: null, loading: !props.curDriversGroup, error: null
      })
      if (driversGroupId) {
        getDriversGroup()
      } else {
        // default for new group
        const extraAttributes = {
          enabled: true,
          autoassign_amount_drivers: useAdvanced ? 1 : 0,
          autoassign_autoaccept_by_driver: false,
          autoassign_autoreject_time: 30,
          autoassign_increment_radius: 100,
          autoassign_initial_radius: 500,
          autoassign_max_in_accepted_by_business: 5,
          autoassign_max_in_accepted_by_driver: 5,
          autoassign_max_in_driver_in_business: 5,
          autoassign_max_in_pending: 5,
          autoassign_max_in_pickup_completed: 5,
          autoassign_max_in_ready_for_pickup: 5,
          autoassign_max_in_driver_on_way: 5,
          autoassign_max_in_driver_almost_arrived_to_customer: 5,
          autoassign_max_orders: 5,
          autoassign_max_radius: 1000,
          orders_group_max_distance_between_delivery: 200,
          orders_group_max_distance_between_pickup: 200,
          orders_group_max_orders: useAdvanced ? 1 : 0,
          orders_group_max_time_between: 5,
          orders_group_max_time_between_delivery: 600,
          orders_group_max_time_between_pickup: 600,
          orders_group_start_in_status: 7,
          orders_group_use_maps_api: false,
          ...(user?.level === 5 && { administrator_id: user?.id })
        }
        setChangesState({
          type: 0,
          ...extraAttributes
        })
        setSelectedBusinessIds([])
        setSelectedPaymethodIds([])
        setSelectedDriverIds([])
        setSelectedDriversCompanyIds([])
        setSelectedDriverManager([])
        setIsScheduleEnabled(false)
      }
    }
  }, [curDriversGroup, driversGroupId])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            driversGroupState={driversGroupState}
            changesState={changesState}
            actionState={actionState}
            cleanChagesState={() => setChangesState({})}
            selectedBusinessIds={selectedBusinessIds}
            selectedPaymethodIds={selectedPaymethodIds}
            selectedDriverIds={selectedDriverIds}
            selectedDriverTemporaryIds={selectedDriverTemporaryIds}
            selectedDriversCompanyIds={selectedDriversCompanyIds}
            selectedDriverManager={selectedDriverManager}
            useAdvanced={useAdvanced}
            isScheduleEnabled={isScheduleEnabled}
            handleChangeScheduleEnabled={handleChangeScheduleEnabled}
            handleChangeScheduleState={handleChangeScheduleState}
            handleLogistic={handleLogistic}
            handleChangesState={handleChangesState}
            handleSelectBusiness={handleSelectBusiness}
            handleSelectAllBusiness={handleSelectAllBusiness}
            handleSelectPaymethod={handleSelectPaymethod}
            handleSelectDriver={handleSelectDriver}
            handleSelectDriversCompany={handleSelectDriversCompany}
            handleSelectAllPaymethod={handleSelectAllPaymethod}
            handleSelectAllDriver={handleSelectAllDriver}
            handleSelectAllManagers={handleSelectAllManagers}
            handleSelectAllDriversCompany={handleSelectAllDriversCompany}
            handleUpdateDriversGroup={handleUpdateDriversGroup}
            handleDeleteDriversGroup={handleDeleteDriversGroup}
            handleAddDriversGroup={handleAddDriversGroup}
            handleChangeType={handleChangeType}
            handleSelectDriverManager={handleSelectDriverManager}
            handleChangeMaxDistance={handleChangeMaxDistance}
            handleSelectDriverTemporary={handleSelectDriverTemporary}
          />
        )
      }
    </>
  )
}

DriversGroupDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
