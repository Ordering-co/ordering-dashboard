import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const DeliveryServiceDetails = (props) => {
  const {
    UIComponent,
    curDriversGroup,
    driverGroupId,
    businesses,
    paymethods,
    deliveryGroups,
    setDeliveryGroups
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
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
  // redesign DS-B1 (M-DS22): the plugin key the credentials were last asked for
  const pluginKeyRef = useRef()

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
   * Method to update selected drivers group from API
   * @param {Object} changes
   */
  const handleUpdateDeliveryGroup = async (_changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true, error: null })
      let changes = _changes
      const skipeableValues = ['', '[]']
      // redesign DS-B1 (M-DS2): the keys that go in the PUT; only those leave changesState after a good save
      const sentKeys = []
      Object.keys(changes)?.map(changeName => {
        if (typeof changes?.[changeName] !== 'undefined') {
          changes = {
            ...changes,
            [changeName]: skipeableValues.includes(changes?.[changeName]) ? null : changes?.[changeName]
          }
          sentKeys.push(changeName)
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
        // redesign DS-B1 (M-DS2): new group objects, written into the groups' state (not the providers')
        const groups = (deliveryGroups?.groups ?? []).map(group => {
          if (group.id !== groupId) return group
          const merged = { ...group, ...content.result }
          const useAdvancedLogistics = merged?.autoassign_amount_drivers !== 0 && merged?.orders_group_max_orders !== 0
          useAdvancedLogistics ? setUseAdvanced(true) : setUseAdvanced(false)
          return merged
        })
        setDeliveryGroups({ ...deliveryGroups, groups })
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
        // redesign DS-B1 (M-DS2): functional, so a draft typed while the PUT was in flight survives
        setChangesState(prev => {
          const next = { ...prev }
          sentKeys.forEach(key => { delete next[key] })
          return next
        })
        return { ok: true }
      } else {
        setActionState({ ...actionState, loading: false, error: content.result })
        return { ok: false, error: content.result }
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      return { ok: false, error: [err.message] }
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

  // checking «Use advanced logistic» again restores the values it had (saved or edited here), 1 only if it never had any
  const advancedValuesRef = useRef({})
  const handleLogistic = (checked) => {
    const positive = (value) => Number(value) > 0 ? Number(value) : null
    const saved = deliveryServiceState?.deliveryService
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

  const getPluginInformation = async (pluginKey) => {
    try {
      // redesign DS-B1 (M-DS9): a (re)load clears the previous error
      setPluginState(prev => ({ ...prev, loading: true, error: null }))
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
        setPluginState(prev => ({
          ...prev,
          configs: content.result.filter(config => typeof config?.id === 'number'),
          loading: false,
          error: null
        }))
        if (content.result.every(config => config?.value !== '')) {
          setAvailableModifyData(true)
        }
      } else {
        // redesign DS-B1 (M-DS9): the API refused; say so instead of leaving `loading` on
        setPluginState({ configs: null, loading: false, error: content.result })
      }
    } catch (err) {
      setPluginState({ configs: null, loading: false, error: [err.message] })
    }
  }

  // redesign DS-B1 (M-DS9): the "Retry" of the credentials; the same request, for the current provider
  const reloadPluginInformation = async () => {
    const pluginKey = deliveryServiceState.deliveryService?.plugin?.key
    if (!deliveryServiceState.deliveryService?.plugin?.id || !pluginKey) return
    await getPluginInformation(pluginKey)
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
    }
    // the panel always hands the group (`curDriversGroup`, DeliveryServicesListing); the fetch by id and the defaults of a
    // new group (the old side bar) were unreachable and are gone
  }, [curDriversGroup, driverGroupId])

  useEffect(() => {
    // redesign DS-B1 (M-DS22): another provider (another plugin key) starts locked until its own configs say otherwise
    const pluginKey = deliveryServiceState.deliveryService?.plugin?.key
    if (pluginKeyRef.current !== pluginKey) {
      if (pluginKeyRef.current !== undefined) {
        setAvailableModifyData(false)
        setPluginState({ configs: null, loading: false, error: null })
      }
      pluginKeyRef.current = pluginKey
    }
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
            // redesign DS-B1 (M-DS9)
            reloadPluginInformation={reloadPluginInformation}
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
