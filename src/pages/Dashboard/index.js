import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { OrderingWebsiteUI } from '~ui'
import { Dashboard as DashboardController } from '~components'

export const Dashboard = (props) => {
  const dashboardProps = {
    ...props,
    UIComponent: OrderingWebsiteUI,
    appId: 'web_dashboard_x',
    type: 'dashboardweb',
    isDashboard: true
  }
  return (
    <>
      <HelmetTags page='dashboard' />
      <DashboardController {...dashboardProps} />
    </>
  )
}
