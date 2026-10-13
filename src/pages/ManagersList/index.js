import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { useLanguage } from '~components'
import { UsersListing, addQueryToUrl, removeQueryToUrl, learnOptionsValues } from '~ui'

export const ManagersList = (props) => {
  const [, t] = useLanguage()
  const learnOptions = learnOptionsValues(
    [
      'managers_general_view',
      'manager_details'
    ],
    t
  )

  const usersProps = {
    ...props,
    isUseQuery: true,
    learnOptions,
    headerTitle: t('ADMINS', 'Admins'),
    defaultUserTypesSelected: [0],
    propsToFetch: [
      'name', 'lastname', 'email', 'phone', 'photo', 'cellphone',
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
      <HelmetTags page='admins' />
      <UsersListing {...usersProps} />
    </>
  )
}
