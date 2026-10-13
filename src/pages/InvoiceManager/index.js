import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { InvoiceManager as InvoiceManagerController } from '~ui'

export const InvoiceManager = (props) => {
  return (
    <>
      <HelmetTags page='invoice' />
      <InvoiceManagerController />
    </>
  )
}
