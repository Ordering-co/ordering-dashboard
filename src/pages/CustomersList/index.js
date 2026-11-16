import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { useLanguage } from '~components'
import { CustomersListing } from '~ui'

export const CustomersList = (props) => {
  const [, t] = useLanguage()
  // redesign UC-B7: the fields to fetch live in CustomersListing (its wrapper sets them last, so the list the page used to give
  // was never read), and nothing reads an `onUserRedirect` for customers: the page owns the ?id= itself (useCustomerQuery)
  const customersProps = {
    ...props,
    isUseQuery: true,
    headerTitle: t('CUSTOMERS', 'Customers'),
    defaultUserTypesSelected: [3]
  }
  return (
    <>
      <HelmetTags page='customers' />
      <CustomersListing {...customersProps} />
    </>
  )
}
