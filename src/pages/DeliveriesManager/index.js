import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { DeliveriesManager as DeliveriesManagerController, addQueryToUrl, removeQueryToUrl, useFilterValues } from '~ui'
import settings from '../../config'

export const DeliveriesManager = (props) => {
  const [filterValues] = useFilterValues()
  const deliveriesManagerProps = {
    ...props,
    isUseQuery: true,
    useBatchSockets: settings?.use_batch_sockets,
    useFranchiseImages: settings?.use_franchise_images,
    defaultFilterValues: filterValues,
    onOrderRedirect: (orderId) => {
      if (!orderId) {
        return removeQueryToUrl(['id'])
      }
      return addQueryToUrl({ id: orderId })
    }
  }
  return (
    <>
      <HelmetTags page='deliveries' />
      <DeliveriesManagerController {...deliveriesManagerProps} />
    </>
  )
}
