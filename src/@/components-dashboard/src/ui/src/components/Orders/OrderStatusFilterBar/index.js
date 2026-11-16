import React, { memo, useEffect } from 'react'
import { useLanguage } from '../../../../../index'
import { Skeleton, Tabs } from '../../Shared/Product'
import { useLocation } from 'react-router-dom'
import { addQueryToUrl } from '../../../utils'
import { getOrdersUrlSearchState } from '../ordersUrlSearch'
import './order-status-filter-bar.css'

const STATUS_TABS = [
  { value: 'pending', labelKey: 'PENDING', labelDefault: 'Pending' },
  { value: 'inProgress', labelKey: 'IN_PROGRESS', labelDefault: 'In progress' },
  { value: 'completed', labelKey: 'COMPLETED', labelDefault: 'Completed' },
  // (tanda Y, Y-6): its own key; a live dictionary had CANCELLED in lower case («cancelled» beside «Completed»)
  { value: 'cancelled', labelKey: 'ORDER_STATUS_TAB_CANCELLED', labelDefault: 'Cancelled' }
]

/**
 * What a list reports as its total when its load failed (redesign 5.2 audit-1): the tab then
 * shows a dash instead of a skeleton that never ends. Any other non-number is still "loading".
 */
export const ORDERS_AMOUNT_UNAVAILABLE = 'unavailable'

// A total that is not a number yet (null while loading, undefined, NaN) is "still loading".
const isLoaded = (amount) => amount !== null && amount !== undefined && amount !== ORDERS_AMOUNT_UNAVAILABLE && !isNaN(amount)

/**
 * Redesign 5.2-A: the four status tabs as Product `Tabs` (C14). Behavior is the
 * one the buttons had: changing the tab scrolls up, changes the group and, with
 * `isUseQuery`, writes `?status`; `?status` is read back on every URL change.
 *
 * `children` are the panels (the page puts one `TabPanel` around its list) and
 * `afterTabs` is drawn between the tab list and them (the page's filter bar).
 * Both live inside the tabs root so the panel is wired to the selected tab.
 * Neighbours (/deliveries, /all-in-one) pass neither and get the bare tabs.
 */
export const OrderStatusFilterBar = memo((props) => {
  const {
    isUseQuery,
    selectedOrderStatus,
    changeOrderStatus,
    ordersAmountByStatus,
    afterTabs,
    children
  } = props

  const [, t] = useLanguage()
  const { search } = useLocation()
  const { statusGroup } = getOrdersUrlSearchState(search)

  const changeSelectedOrderStatus = (orderStatus) => {
    window.scrollTo(0, 0)
    changeOrderStatus(orderStatus)
    if (isUseQuery) {
      addQueryToUrl({ status: orderStatus })
    }
  }

  useEffect(() => {
    if (!isUseQuery) return
    if (statusGroup) {
      changeOrderStatus(statusGroup)
      return
    }
    addQueryToUrl({ status: 'pending' })
  }, [isUseQuery, search])

  const items = STATUS_TABS.map(({ value, labelKey, labelDefault }) => {
    const amount = ordersAmountByStatus?.[value]
    const loaded = isLoaded(amount)
    const unavailable = amount === ORDERS_AMOUNT_UNAVAILABLE
    const countLabel = loaded
      ? (Number(amount) === 1
          ? t('ORDERS_COUNT_ONE', '1 order')
          : t('ORDERS_COUNT', '_count_ orders').replace('_count_', amount))
      : unavailable ? t('ORDERS_COUNT_UNAVAILABLE', 'count unavailable') : undefined
    return {
      value,
      label: t(labelKey, labelDefault),
      // F4 (C20): the room of a two-digit count (the chip's height plus its padding), so the tabs beside do not slide when totals arrive.
      count: loaded ? amount : unavailable ? '—' : <Skeleton size='calc(var(--od-x-count-height) + var(--od-x-space-1-5))' />,
      attention: value === 'pending' && loaded && amount > 0,
      countLabel
    }
  })

  return (
    <Tabs
      className='order_status_filter odc-status-tabs'
      label={t('ORDER_STATUS', 'Order status')}
      // redesign bugs-d row 59 (Q-06): in a narrow list column the tabs break into lines instead of hiding «Cancelled» behind a scroll
      wrap
      value={selectedOrderStatus || 'pending'}
      onValueChange={changeSelectedOrderStatus}
      items={items}
    >
      {afterTabs}
      {children}
    </Tabs>
  )
})

OrderStatusFilterBar.displayName = 'OrderStatusFilterBar'
