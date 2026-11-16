import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { DeliveriesManager as DeliveriesManagerController, addQueryToUrl, removeQueryToUrl, useFilterValues } from '~ui'
import { useOrdersUrlFilterSeed } from '~ui/src/hooks/useOrdersUrlFilterSeed'
import settings from '../../config'

export const DeliveriesManager = (props) => {
  const [filterValues] = useFilterValues()
  // (D-22): ?business= / ?unassigned=1 / ?late=1 open the list already filtered.
  // (D-22, review M2/M3): the controller mounts once the shared context is seeded (`ready`), and a seeded link
  // starts from neutral filters plus the seed instead of the filters left by an earlier visit.
  const { ready, seededFilterValues, defaultTimeStatus } = useOrdersUrlFilterSeed()
  const deliveriesManagerProps = {
    ...props,
    isUseQuery: true,
    useBatchSockets: settings?.use_batch_sockets,
    useFranchiseImages: settings?.use_franchise_images,
    defaultFilterValues: seededFilterValues || filterValues,
    ...(defaultTimeStatus ? { defaultTimeStatus } : {}),
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
      {ready && <DeliveriesManagerController {...deliveriesManagerProps} />}
    </>
  )
}
