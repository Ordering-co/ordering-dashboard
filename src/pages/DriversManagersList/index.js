import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { useLanguage } from '~components'
import { DeliveryUsersListing as DriversListingController, addQueryToUrl, removeQueryToUrl, learnOptionsValues } from '~ui'

export const DriversManagersList = (props) => {
  const [, t] = useLanguage()
  const learnOptions = learnOptionsValues(['drivers_manager'], t)

  const usersProps = {
    ...props,
    learnOptions,
    isUseQuery: true,
    headerTitle: t('DRIVERS_MANAGERS', 'Drivers managers'),
    defaultUserTypesSelected: [5],
    disabledActiveStateCondition: true,
    isDriversManagersPage: true,
    onUserRedirect: (userId) => {
      if (!userId) {
        return removeQueryToUrl(['id', 'tab'])
      }
      return addQueryToUrl({ id: userId })
    }
  }
  return (
    <>
      <HelmetTags page='drivers_managers' />
      <DriversListingController {...usersProps} />
    </>
  )
}
