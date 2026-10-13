import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { Reports as ReportsController } from '~ui'

export const AdvancedReports = (props) => {
  return (
    <>
      <HelmetTags page='reports' />
      <ReportsController {...props} />
    </>
  )
}
