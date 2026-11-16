import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { useEvent } from '~components'
import { DriversManager as DriversManagerController } from '~ui'
import settings from '../../config'

export const DriversList = (props) => {
  const [events] = useEvent()
  const driversListProps = {
    ...props,
    isSearchByName: true,
    isSearchByCellphone: true,
    useBatchSockets: settings?.use_batch_sockets,
    // redesign drivers-dashboard B4 (DD-07): the panel shows the phone; the last assignment rides along
    propsToFetch: ['id', 'name', 'lastname', 'location', 'enabled', 'available', 'busy', 'driver_groups.name', 'driver_groups.id', 'assigned_orders_count', 'photo', 'last_location_at', 'cellphone', 'last_order_assigned_at'],
    onDriverRedirect: (driverId) => {
      // redesign W1-4 (T1-4-4a, W1-D-5): 'drivers_dashboard' is the key ListenPageChanges knows; 'drivers' matched no route, so
      // opening the panel never wrote ?id= and closing it never removed it.
      if (!driverId) {
        return events.emit('go_to_page', { page: 'drivers_dashboard', replace: true })
      }
      // replace, like /orders: each opening is not a history entry (Back used to drop ?id= and leave the panel open)
      return events.emit('go_to_page', { page: 'drivers_dashboard', search: `?id=${driverId}`, replace: true })
    }
  }

  return (
    <>
      <HelmetTags page='drivers_dashboard' />
      <DriversManagerController {...driversListProps} />
    </>
  )
}
