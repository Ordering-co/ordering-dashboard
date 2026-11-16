import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const DriverGroupDeliveryDetails = (props) => {
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
  // redesign DG-B1: set when our own save updates `zoneList.zones`, so the effect below does not wipe the pending
  // changes of a zone whose PUT failed.
  const skipZonesResetRef = useRef(false)
  // redesign DG-B1 (D-01): the stored «enabled» of each zone, to tell a pending box from a stored one
  const storedEnabledRef = useRef({})

  /**
   * Method to get the deliveryzones from the API
   */
  const getDeliveryZones = async () => {
    setZoneList(prev => ({ ...prev, loading: true, error: null }))
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
        // redesign DG-B1 (M-DG25): an error leaves an empty list with the messages; it does not reject
        setZoneList({
          zones: [],
          loading: false,
          error: Array.isArray(content.result) ? content.result : [content.result]
        })
      }
    } catch (err) {
      setZoneList({
        zones: [],
        loading: false,
        error: [err.message]
      })
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

  /**
   * @returns {Promise<{ ok: boolean, error?: Array }>} redesign DG-B1 (M-DG25): if any PUT fails, `ok: false` with the
   * message; the ones already sent are not undone, as before.
   */
  const onDeliveryStateSave = async () => {
    const saved = {}
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      if (Object.keys(zoneListState.changes).length) {
        for (const key in zoneListState.changes) {
          const zoneId = parseInt(key)
          const foundZone = zoneList?.zones?.find(zone => zone.id === zoneId)
          if (foundZone?.enabled !== zoneListState.changes[key]) {
            await handleUpdateDeliveryZoneState(zoneId, zoneListState.changes[key])
            saved[zoneId] = zoneListState.changes[key]
          }
        }
        setZoneListState({ ...zoneListState, isDirty: false })
      }
      setActionState({ loading: false, error: null })
      showToast(ToastType.Success, t('DRIVER_GROUP_UPDATED', 'Driver group updated'))
      return { ok: true }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
      return { ok: false, error: [err.message] }
    } finally {
      // redesign DG-B1: what was sent becomes the stored value (so "Discard" returns to it and a toggle back is
      // not skipped against the stale list)
      if (Object.keys(saved).length) {
        skipZonesResetRef.current = true
        setZoneList(prev => ({
          ...prev,
          zones: (prev.zones || []).map(zone => zone.id in saved ? { ...zone, enabled: saved[zone.id] } : zone)
        }))
      }
    }
  }

  /**
   * redesign DG-B1: "Discard" of the SaveBar. Puts the checkboxes back to the stored `enabled` values.
   */
  const resetZoneState = () => {
    const changes = {}
    ;(zoneList?.zones || []).filter(zone => zone?.type !== 3).forEach(zone => {
      changes[zone.id] = zone.enabled
    })
    setZoneListState(prev => ({ ...prev, changes, isDirty: false }))
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
      // redesign DG-B1 (M-DG38): with no zones the header checkbox is not checked (0 === 0)
      isCheckAll: Object.keys(zoneListState.changes).length > 0 && Object.keys(zoneListState.changes).length === enabledZones
    })
  }, [zoneListState.changes])

  useEffect(() => {
    if (skipZonesResetRef.current) {
      skipZonesResetRef.current = false
      return
    }
    const zoneListFilter = zoneList?.zones?.filter(zone => zone?.type !== 3) || []
    // redesign DG-B1 (D-01): saving or deleting one zone replaces the list; an «Active» box changed and not saved yet
    // keeps its pending value instead of going back to the stored one
    const stored = storedEnabledRef.current
    setZoneListState(prev => {
      const zoneChanges = {}
      zoneListFilter.forEach(zone => {
        const pending = prev.changes?.[zone.id]
        const isPending = zone.id in stored && pending !== undefined && pending !== stored[zone.id]
        zoneChanges[zone.id] = isPending ? pending : zone.enabled
      })
      return { ...prev, changes: zoneChanges }
    })
    storedEnabledRef.current = Object.fromEntries(zoneListFilter.map(zone => [zone.id, zone.enabled]))
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
            resetZoneState={resetZoneState}
            reloadZones={getDeliveryZones}
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

DriverGroupDeliveryDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
