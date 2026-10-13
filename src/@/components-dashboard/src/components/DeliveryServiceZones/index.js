import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const DeliveryServiceZones = (props) => {
  const {
    drivergroup,
    UIComponent
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [zoneList, setZoneList] = useState({ loading: false, zones: [], error: null })
  const [formState, setFormState] = useState({ changes: {} })
  const [zoneListState, setZoneListState] = useState({
    changes: {},
    isCheckAll: false,
    isDirty: false
  })

  /**
   * Method to get the deliveryzones from the API
   */
  const getDeliveryZones = async () => {
    if (!drivergroup?.id) {
      setZoneList({ zones: [], loading: false, error: null })
      return
    }
    setZoneList({ ...zoneList, loading: true, error: null })
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/drivergroups/${drivergroup?.id}/deliveryzones`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setZoneList({
          zones: content.result,
          loading: false,
          error: null
        })
      } else {
        setZoneList({
          zones: content,
          loading: false,
          error: [content.result]
        })
        throw { message: content.result }
      }
    } catch (err) {
      return Promise.reject(err)
    }
  }

  /**
   * Method to update the drivergroup delivery zone enable state from API
   */
  const handleUpdateDeliveryZoneState = async (zoneId, enabled) => {
    try {
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({ enabled })
      }
      const response = await fetch(`${ordering.root}/drivergroups/${drivergroup?.id}/deliveryzones/${zoneId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        return content.result
      } else {
        setActionState({
          loading: false,
          error: [content.result]
        })
        throw { message: content.result }
      }
    } catch (err) {
      return Promise.reject(err)
    }
  }

  const onDeliveryStateSave = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      if (Object.keys(zoneListState.changes).length) {
        for (const key in zoneListState.changes) {
          const zoneId = parseInt(key)
          const foundZone = zoneList?.zones?.find(zone => zone.id === zoneId)
          if (foundZone?.enabled !== zoneListState.changes[key]) {
            await handleUpdateDeliveryZoneState(zoneId, zoneListState.changes[key])
          }
        }
        setZoneListState({ ...zoneListState, isDirty: false })
      }
      setActionState({ loading: false, error: null })
      showToast(ToastType.Success, t('DRIVER_GROUP_UPDATED', 'Driver group updated'))
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
    }
  }

  const handleChangeAllZoneState = (enabled) => {
    const zoneChanges = { ...zoneListState.changes }
    for (const key in zoneChanges) {
      zoneChanges[key] = enabled
    }
    setZoneListState({
      ...zoneListState,
      changes: zoneChanges,
      isCheckAll: enabled,
      isDirty: true
    })
  }

  const handleChangeZoneState = (zoneId, enabled) => {
    setZoneListState({
      ...zoneListState,
      changes: {
        ...zoneListState.changes,
        [zoneId]: enabled
      },
      isDirty: true
    })
  }

  const handleChangeForm = (updateChange) => {
    setFormState({
      changes: {
        ...formState.changes,
        ...updateChange
      }
    })
  }

  useEffect(() => {
    let enabledZones = 0
    for (const key in zoneListState.changes) {
      if (zoneListState.changes[key]) enabledZones += 1
    }
    setZoneListState({
      ...zoneListState,
      isCheckAll: Object.keys(zoneListState.changes).length === enabledZones
    })
  }, [zoneListState.changes])

  useEffect(() => {
    const zoneListFilter = zoneList?.zones?.filter(zone => zone?.type !== 3) || []
    const zoneChanges = {}
    zoneListFilter?.forEach(zone => {
      zoneChanges[zone.id] = zone.enabled
    })
    setZoneListState({
      ...zoneListState,
      changes: zoneChanges
    })
  }, [zoneList?.zones])

  useEffect(() => {
    getDeliveryZones()
  }, [drivergroup?.id])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            actionState={actionState}
            formState={formState}
            zoneListState={zoneListState}
            handleChangeForm={handleChangeForm}
            onDeliveryStateSave={onDeliveryStateSave}
            handleChangeAllZoneState={handleChangeAllZoneState}
            handleChangeZoneState={handleChangeZoneState}
            zoneList={zoneList}
            setZoneList={setZoneList}
          />
        )
      }
    </>
  )
}

DeliveryServiceZones.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
