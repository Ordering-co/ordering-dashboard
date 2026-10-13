import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { OrdersManager as OrdersManagerController, addQueryToUrl, removeQueryToUrl, useFilterValues } from '~ui'
import settings from '../../config'

export const OrdersList = (props) => {
  const [filterValues] = useFilterValues()

  const ordersListProps = {
    ...props,
    isUseQuery: true,
    disableSocketRoomDriver: true,
    useFranchiseImages: settings?.use_franchise_images,
    defaultFilterValues: filterValues,
    getDriversByControls: true,
    disableDriverLocationsSockets: true,
    onOrderRedirect: (orderId) => {
      if (!orderId) {
        return removeQueryToUrl(['id', 'section', 'tab'])
      }
      return addQueryToUrl({ id: orderId })
    }
  }
  return (
    <>
      <HelmetTags page='orders' />
      <OrdersManagerController {...ordersListProps} />
    </>
  )
}
