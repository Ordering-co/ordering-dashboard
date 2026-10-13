import React from 'react'
import { useConfig } from '../../../../../index'
import { OrdersDashboardList } from '../OrdersDashboardList'
import {
  OrdersManageContainer
} from './styles'

export const OrdersDashboard = (props) => {
  const [{ configs }] = useConfig()
  const ordersDashboardListProps = {
    ...props
  }
  if ((configs?.optimize_order_data && (configs?.optimize_order_data?.value === '1'))) {
    ordersDashboardListProps.propsToFetch = ['app_id', 'business', 'business_id', 'created_at', 'customer', 'customer_id', 'delivery_type', 'driver_group_id', 'driver_id', 'driver', 'delivery_datetime', 'delivery_datetime_utc', 'external_id', 'eta_time', 'id', 'logistic_status', 'logistic_attemps', 'uuid', 'order_group', 'order_group_id', 'priority', 'summary', 'status', 'time_status', 'total', 'driver_group_business', 'metadata', 'assignable_driver_groups', 'external_driver', 'external_driver_id', 'driver_company', 'driver_company_id']
  }
  return (
    <OrdersManageContainer>
      <OrdersDashboardList
        {...ordersDashboardListProps}
        orderListView='table'
      />
    </OrdersManageContainer>
  )
}
