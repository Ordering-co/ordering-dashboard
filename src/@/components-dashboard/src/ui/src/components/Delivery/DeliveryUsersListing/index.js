import React from 'react'
import { DriversPage } from '../DriversDirectory/DriversListing'

// redesign DL-B5: /delivery/drivers-list (`isDriversPage`) is the drivers page of Delivery/DriversDirectory.
// redesign DM-B5 (decisions 1-3 | audit 2, 3, 5): so is /delivery/drivers-managers (`isDriversManagersPage`), with `role='managers'`. Both
// production callers pass one of the two flags, so the wrapper always mounts the drivers page.
export const DeliveryUsersListing = (props) => React.createElement(DriversPage, props)
