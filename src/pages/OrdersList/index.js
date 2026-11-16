import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { OrdersManager as OrdersManagerController, addQueryToUrl, removeQueryToUrl, useFilterValues } from '~ui'
import { useOrdersUrlFilterSeed } from '~ui/src/hooks/useOrdersUrlFilterSeed'
import settings from '../../config'

export const OrdersList = (props) => {
  const [filterValues] = useFilterValues()
  // (D-22): ?business= / ?unassigned=1 / ?late=1 open the list already filtered.
  // (D-22, review M2/M3): the controller mounts once the shared context is seeded (`ready`), and a seeded link
  // starts from neutral filters plus the seed instead of the filters left by an earlier visit.
  const { ready, seededFilterValues, defaultTimeStatus } = useOrdersUrlFilterSeed()

  const ordersListProps = {
    ...props,
    isUseQuery: true,
    disableSocketRoomDriver: true,
    useFranchiseImages: settings?.use_franchise_images,
    defaultFilterValues: seededFilterValues || filterValues,
    ...(defaultTimeStatus ? { defaultTimeStatus } : {}),
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
      {ready && <OrdersManagerController {...ordersListProps} />}
    </>
  )
}
