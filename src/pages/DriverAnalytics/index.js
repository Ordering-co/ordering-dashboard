import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { DriverAnalytics as DriverAnalyticsController } from '~ui'

export const DriverAnalytics = (props) => {
  return (
    <>
      <HelmetTags page='drivers_analytics' />
      <DriverAnalyticsController {...props} />
    </>
  )
}
