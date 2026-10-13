import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { useLanguage } from '~components'
import { CustomersListing, addQueryToUrl, removeQueryToUrl } from '~ui'

export const CustomersList = (props) => {
  const [, t] = useLanguage()
  const customersProps = {
    ...props,
    isUseQuery: true,
    headerTitle: t('CUSTOMERS', 'Customers'),
    defaultUserTypesSelected: [3],
    propsToFetch: [
      'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'loyalty_level', 'loyalty_level_id',
      'country_phone_code', 'city_id', 'city', 'address', 'addresses',
      'address_notes', 'dropdown_option_id', 'dropdown_option', 'location',
      'zipcode', 'level', 'enabled', 'middle_name', 'second_lastname', 'birthdate', 'drivergroups',
      'phone_verified', 'email_verified', 'wallets', 'orders_count', 'push_tokens'
    ],
    onUserRedirect: (userId) => {
      if (!userId) {
        return removeQueryToUrl(['id', 'section', 'tab'])
      }
      return addQueryToUrl({ id: userId })
    }
  }
  return (
    <>
      <HelmetTags page='customers' />
      <CustomersListing {...customersProps} />
    </>
  )
}
