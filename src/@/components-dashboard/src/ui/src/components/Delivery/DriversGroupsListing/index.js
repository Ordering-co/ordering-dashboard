import React from 'react'
import { useLocation } from 'react-router-dom'
import { DriversGroupsList as DriversGroupsListController } from '../../../../../index'
import { DriversGroupsListingUI } from '../DriversGroupsDirectory/DriversGroupsListing'

// redesign DG-B5 (decision 1): the page of /delivery/drivers-groups keeps this export, this wrapper and its `paginationSettings`; the UI
// is `DriversGroupsDirectory/DriversGroupsListing` (a split view of the list and the group panel). The store editor
// (`Stores/BusinessDeliveryGroupsDetails`) does not come through here: it mounts `Delivery/DriversGroupsList` with `isFromStore`.
export const DriversGroupsListing = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10

  const driversGroupsListProps = {
    ...props,
    isDriversMangersRequired: true,
    UIComponent: DriversGroupsListingUI,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    }
  }
  return (
    <DriversGroupsListController {...driversGroupsListProps} />
  )
}
