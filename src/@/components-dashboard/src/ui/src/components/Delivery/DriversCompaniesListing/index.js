import React from 'react'
import { DriversCompaniesList as DriversCompaniesListController } from '../../../../../index'
import { DriversCompaniesListingUI } from '../DriversCompaniesDirectory/DriversCompaniesListing'

// redesign DC-B5 (decision 1): the page of /delivery/drivers-companies keeps this export and this wrapper; the UI is
// `DriversCompaniesDirectory/DriversCompaniesListing` (a split view of the list and the company panel). The legacy list, details and
// add forms it replaced were removed with the owner's
// approval (P-3).
export const DriversCompaniesListing = (props) => {
  const driversCompaniesProps = {
    ...props,
    UIComponent: DriversCompaniesListingUI
  }
  return <DriversCompaniesListController {...driversCompaniesProps} />
}
