import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { BusinessPaymentReports as BusinessPaymentReportsController } from '~ui'

export const BusinessPaymentReports = (props) => {
  return (
    <>
      <HelmetTags page='business_payment_reports' />
      <BusinessPaymentReportsController />
    </>
  )
}
