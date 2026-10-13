import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const BusinessDeliveryDetails = (props) => {
  props = { ...defaultProps, ...props }
  const {
    business,
    UIComponent,
    handleUpdateBusinessState,
    propsToFetch
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [formState, setFormState] = useState({ changes: {} })
  const [zoneListState, setZoneListState] = useState({
    changes: {},
    isCheckAll: false,
    isDirty: false
  })

  /**
  * Method to get the business zones from API
  */
  const getBusinessZones = async () => {
    try {
      const { content: { error, result } } = await ordering.setAccessToken(session.token).businesses(business.id).select(propsToFetch).asDashboard().get()
      const _business = Array.isArray(result) ? null : result
      if (!error) {
        handleUpdateBusinessState(_business)
      } else {
        setActionState({
          loading: false,
          error: [result]
        })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to update the business from the API
   */
  const handleDeliveryStateSave = async () => {
    try {
      const { content: { error, result } } = await ordering.businesses(business.id).save(formState.changes, {
        accessToken: session.token
      })
      if (!error) {
        return result
      } else {
        throw { message: error }
      }
    } catch (err) {
      return Promise.reject(err)
    }
  }

  /**
   * Method to update the business delivery zone enable state from API
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
      const response = await fetch(`${ordering.root}/business/${business?.id}/deliveryzones/${zoneId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        return content.result
      } else {
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
          const foundZone = business?.zones?.find(zone => zone.id === zoneId)
          if (foundZone?.enabled !== zoneListState.changes[key]) {
            await handleUpdateDeliveryZoneState(zoneId, zoneListState.changes[key])
          }
        }
        setZoneListState({ ...zoneListState, isDirty: false })
        const zones = business.zones.filter(zone => {
          if (typeof zoneListState.changes[zone.id] !== 'undefined') {
            zone.enabled = zoneListState.changes[zone.id]
          }
          return true
        })
        const _business = { ...business, zones }
        handleUpdateBusinessState(_business)
      }
      if (Object.keys(formState.changes).length) {
        const result = await handleDeliveryStateSave()
        setFormState({ changes: {} })
        handleUpdateBusinessState(result)
      }
      setActionState({ loading: false, error: null })
      showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
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
    if (business?.zones) {
      const zoneList = business?.zones?.filter(zone => zone?.type !== 3) || []
      const zoneChanges = {}
      zoneList.forEach(zone => {
        zoneChanges[zone.id] = zone.enabled
      })
      setZoneListState({
        ...zoneListState,
        changes: zoneChanges
      })
    } else {
      getBusinessZones()
    }
  }, [business?.zones])

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
          />
        )
      }
    </>
  )
}

BusinessDeliveryDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of delivery zone props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: ['id', 'zones', 'header', 'logo', 'timezone']
}
