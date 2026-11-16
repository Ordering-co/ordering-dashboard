import React from 'react'
import { useLocation } from 'react-router-dom'
import { DeliveryServices as DeliveryServicesController } from '../../../../../index'
import { DeliveryServicesListingUI } from '../DeliveryServicesDirectory/DeliveryServicesListing'

// redesign DS-B4 (decisions 1, 6): the page's UI is now `DeliveryServicesDirectory/DeliveryServicesListing` (list + provider panel in a
// split view). This file keeps the export, the wrapper and the `paginationSettings` of main; the old `DeliveryServicesUI`
// (side bar + `DeliveryServicesList` + `DeliveryServiceDetails`) is no longer mounted. Its pieces (`DeliveryServicesList`,
// `DeliveryServiceDetails`, `styles.js`) were deleted as dead code; `DeliveryServiceDetails/DoordashContent` stays (Credentials).
export const DeliveryServices = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10

  const deliveryServicesProps = {
    ...props,
    UIComponent: DeliveryServicesListingUI,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    }
  }
  return (
    <DeliveryServicesController {...deliveryServicesProps} />
  )
}
