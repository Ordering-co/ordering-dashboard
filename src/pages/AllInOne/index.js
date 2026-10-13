import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import {
  AllInOne as AllInOneController,
  addQueryToUrl, removeQueryToUrl, useFilterValues
} from '~ui'
import settings from '../../config'

export const AllInOne = (props) => {
  const [filterValues] = useFilterValues()
  const ordersListProps = {
    ...props,
    isUseQuery: true,
    useBatchSockets: settings?.use_batch_sockets,
    defaultFilterValues: filterValues,
    onOrderRedirect: (orderId) => {
      if (!orderId) {
        return removeQueryToUrl(['id', 'section', 'tab'])
      }
      return addQueryToUrl({ id: orderId })
    }
  }
  return (
    <>
      <HelmetTags page='all_in_one' />
      <AllInOneController {...ordersListProps} />
    </>
  )
}
