import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { ConnectOverview as ConnectOverviewController } from '~ui'

export const ConnectOverview = (props) => {
  const connectOverviewProps = {
    ...props,
    isUseQuery: true
  }
  return (
    <>
      <HelmetTags page='connect_overview' />
      <ConnectOverviewController {...connectOverviewProps} />
    </>
  )
}
