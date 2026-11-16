import React from 'react'
import { CalendarDriversList as CalendarDriversListController } from '../../../../../index'
import { TimeCalendarListingUI } from '../DriversTimeCalendar/TimeCalendarListing'

// redesign DT-B5 (decisions 1–7): the page of /delivery/drivers-time-display keeps this export and this wrapper; the UI is
// `DriversTimeCalendar/TimeCalendarListing` (Product header, scope and date bar, the grid or the agenda, the block dialogs). The
// legacy pieces of this folder (UserList, DriverBlockAddForm, styles) were removed (owner's decision 32).
export const DriversTimeDisplay = (props) => {
  const driversTimeDisplayProps = {
    ...props,
    UIComponent: TimeCalendarListingUI,
    paginationSettings: {
      initialPage: 1,
      pageSize: 10,
      controlType: 'pages'
    },
    propsToFetch: ['id', 'enabled', 'name', 'email', 'level', 'lastname', 'delivery_blocks', 'photo']
  }
  return (
    <CalendarDriversListController {...driversTimeDisplayProps} />
  )
}
