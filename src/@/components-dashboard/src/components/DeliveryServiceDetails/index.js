import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const DeliveryServiceDetails = (props) => {
  const {
    UIComponent,
    deliveryServicesState,
    curDriversGroup,
    driverGroupId,
    businesses,
    paymethods,
    deliveryGroups,
    setDeliveryGroups
  } = props

  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [deliveryServiceState, setDeliveryServiceState] = useState({ deliveryService: props.curDriversGroup, loading: !props.curDriversGroup, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [changesState, setChangesState] = useState({})
  const [selectedBusinessIds, setSelectedBusinessIds] = useState([])
  const [selectedPaymethodIds, setSelectedPaymethodIds] = useState([])
  const [useAdvanced, setUseAdvanced] = useState(false)
  const [pluginState, setPluginState] = useState({ configs: null, loading: false, error: null })
  const [availableModifyData, setAvailableModifyData] = useState(false)

  const fetchOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }

  const initSet = (deliveryService) => {
    const businessIds =
      deliveryService?.business?.reduce((ids, business) => [...ids, business.id], []) ?? []
    setSelectedBusinessIds(businessIds)
    setSelectedPaymethodIds(deliveryService?.allowed_paymethods || [])
    const useAdvancedLogistics = deliveryService?.autoassign_amount_drivers !== 0 && deliveryService?.orders_group_max_orders !== 0
    useAdvancedLogistics ? setUseAdvanced(true) : setUseAdvanced(false)
  }

  /**
   * Method to get the drives group from API
   */
  const getDriversGroup = async () => {
    const groupId = curDriversGroup?.id || driverGroupId
    if (!groupId) return
    try {
      setDeliveryServiceState({
        ...deliveryServiceState,
        loading: true
      })

      const response = await fetch(`${ordering.root}/drivergroups/${groupId}`, fetchOptions)
      const { result, error } = await response.json()
      if (!error) {
        setDeliveryServiceState({
          loading: false,
          deliveryService: result,
          error: null
        })
        initSet(result)
      } else {
        setDeliveryServiceState({
          ...deliveryServiceState,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setDeliveryServiceState({
        ...deliveryServiceState,
        loading: false,
        error: [error.message]
      })
    }
  }

  /**
   * Method to update selected drivers group from API
   * @param {Object} changes
   */
  const handleUpdateDeliveryGroup = async (_changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true, error: null })
      let changes = _changes
      const skipeableValues = ['', '[]']
      const newChangeState = { ...changesState }
      Object.keys(changes)?.map(changeName => {
        if (typeof changes?.[changeName] !== 'undefined') {
          changes = {
            ...changes,
            [changeName]: skipeableValues.includes(changes?.[changeName]) ? null : changes?.[changeName]
          }
          delete newChangeState[changeName]
        }
      })

      const requestOptions = {
        ...fetchOptions,
        method: 'PUT',
        body: JSON.stringify(changes)
      }
      const groupId = curDriversGroup?.id || driverGroupId
      const response = await fetch(`${ordering.root}/drivergroups/${groupId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ error: null, loading: false })
        const groups = deliveryGroups.groups.filter(group => {
          if (group.id === groupId) {
            Object.assign(group, content.result)
            const useAdvancedLogistics = group?.autoassign_amount_drivers !== 0 && group?.orders_group_max_orders !== 0
            useAdvancedLogistics ? setUseAdvanced(true) : setUseAdvanced(false)
          }
          return true
        })
        setDeliveryGroups({ ...deliveryServicesState, groups })
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
        setChangesState(newChangeState)
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
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
    const businessIds = [...(selectedBusinessIds ?? [])]
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
    const businessIds = businesses?.reduce((ids, business) => [...ids, business.id], []) ?? []
    let filteredIds = []
    if (isAll) {
      filteredIds = [...businessIds]
    } else {
      filteredIds = []
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

  const handleLogistic = (checked) => {
    const changes = {
      autoassign_amount_drivers: checked ? 1 : 0,
      orders_group_max_orders: checked ? 1 : 0
    }
    handleChangesState(changes)
  }

  const getPluginInformation = async (pluginKey) => {
    try {
      setPluginState({ ...pluginState, loading: true })
      const filterConditons = [
        {
          attribute: 'key',
          value: {
            condition: 'ilike',
            value: encodeURI(`%${pluginKey}%`)
          },
          conector: 'AND'
        }
      ]

      const response = await fetch(`${ordering.root}/configs?where=${JSON.stringify(filterConditons)}`, fetchOptions)
      const content = await response.json()
      if (!content.error) {
        setPluginState({
          ...pluginState,
          configs: content.result.filter(config => typeof config?.id === 'number'),
          loading: false
        })
        if (content.result.every(config => config?.value !== '')) {
          setAvailableModifyData(true)
        }
      }
    } catch (err) {
      setPluginState({ ...pluginState, loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    setChangesState({})
    if (curDriversGroup) {
      setDeliveryServiceState({
        ...deliveryServiceState,
        loading: false,
        deliveryService: curDriversGroup
      })
      initSet(curDriversGroup)
    } else {
      setDeliveryServiceState({
        deliveryService: null, loading: !props.curDriversGroup, error: null
      })
      const groupId = curDriversGroup?.id || driverGroupId
      if (groupId) {
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
      }
    }
  }, [curDriversGroup, driverGroupId])

  useEffect(() => {
    if (deliveryServiceState.deliveryService?.plugin?.id) {
      getPluginInformation(deliveryServiceState.deliveryService?.plugin?.key)
    }
  }, [deliveryServiceState.deliveryService?.plugin?.id])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            deliveryServiceState={deliveryServiceState}
            changesState={changesState}
            actionState={actionState}
            cleanChagesState={() => setChangesState({})}
            selectedBusinessIds={selectedBusinessIds}
            selectedPaymethodIds={selectedPaymethodIds}
            useAdvanced={useAdvanced}
            pluginState={pluginState}
            availableModifyData={availableModifyData}
            setPluginState={setPluginState}
            handleLogistic={handleLogistic}
            handleChangesState={handleChangesState}
            handleSelectBusiness={handleSelectBusiness}
            handleSelectAllBusiness={handleSelectAllBusiness}
            handleSelectPaymethod={handleSelectPaymethod}
            handleSelectAllPaymethod={handleSelectAllPaymethod}
            handleUpdateDeliveryGroup={handleUpdateDeliveryGroup}
            handleChangeMaxDistance={handleChangeMaxDistance}
            setAvailableModifyData={setAvailableModifyData}
          />
        )
      }
    </>
  )
}

DeliveryServiceDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
