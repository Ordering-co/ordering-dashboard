import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { EcommerceReports as EcommerceReportsController } from '~ui'

export const EcommerceReports = (props) => {
  return (
    <>
      <HelmetTags page='ecommerce_reports' />
      <EcommerceReportsController {...props} />
    </>
  )
}
