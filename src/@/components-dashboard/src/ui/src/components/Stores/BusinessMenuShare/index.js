import React from 'react'
import { BusinessMenuShare as BusinessMenuShareController } from '../../../../../index'
import { StoreSharePickerUI } from '../StoreSharePicker'

// redesign stores 2.H: the menu's «Share with» is the common StoreSharePicker.
export const BusinessMenuShare = (props) => {
  const businessMenuShareProps = {
    ...props,
    UIComponent: StoreSharePickerUI
  }
  return (
    <BusinessMenuShareController {...businessMenuShareProps} />
  )
}
