import React from 'react'
import { BusinessDeliveryZoneShare as BusinessDeliveryZoneShareController } from '../../../../../index'
import { StoreSharePickerUI } from '../StoreSharePicker'

// redesign stores 2.H: the zone's «Share with» is the common StoreSharePicker. `BusinessDeliveryZoneShareUI`
// stays as an alias of its UI for whoever imported it.
export const BusinessDeliveryZoneShareUI = StoreSharePickerUI

export const BusinessDeliveryZoneShare = (props) => {
  const BusinessDeliveryZoneShareProps = {
    ...props,
    UIComponent: StoreSharePickerUI
  }
  return (
    <BusinessDeliveryZoneShareController {...BusinessDeliveryZoneShareProps} />
  )
}
