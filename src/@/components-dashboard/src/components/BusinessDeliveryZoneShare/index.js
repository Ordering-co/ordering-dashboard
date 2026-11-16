import React from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { StoreSharePicker } from '../StoreSharePicker'

// redesign stores 2.H: «Share with» of a delivery zone is the common StoreSharePicker; this alias only says
// what to save (the same PUT /business/:id/deliveryzones/:zoneId { businesses } as before) and who learns it.
export const BusinessDeliveryZoneShare = (props) => {
  const {
    business,
    zone,
    handleSuccessUpdate
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  const saveShare = async (ids) => {
    const requestOptions = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ businesses: ids })
    }
    const response = await fetch(`${ordering.root}/business/${business.id}/deliveryzones/${zone.id}`, requestOptions)
    return response.json()
  }

  const onShared = (stores) => {
    const _businessZone = {
      ...zone,
      businesses: stores.map(({ id, name }) => ({ id, name, pivot: { business_id: id, zone_id: zone.id } }))
    }
    const zones = business.zones?.filter(_zone => {
      if (_zone.id === _businessZone.id) {
        Object.assign(_zone, _businessZone)
      }
      return true
    })
    // A store without its zones loaded keeps them as they are (before, this threw and the save looked failed).
    const _business = zones ? { ...business, zones } : business
    handleSuccessUpdate && handleSuccessUpdate(_business)
  }

  return (
    <StoreSharePicker
      {...props}
      sharedBusinesses={zone?.businesses}
      saveShare={saveShare}
      onShared={onShared}
    />
  )
}

BusinessDeliveryZoneShare.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
