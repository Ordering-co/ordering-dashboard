import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton } from '../../../styles'
import { useWindowSize } from '../../../hooks/useWindowSize'
import {
  List as MenuIcon,
  Rulers,
  Map,
  MapFill,
  ClockHistory,
  FileRuled,
  FileEarmarkRuled,
  CalendarCheck,
  Cart4,
  GeoAltFill,
  Vr,
  Alarm,
  Truck,
  Shop,
  Cart3,
  PersonCheck,
  Star,
  CreditCard,
  ShopWindow,
  Bag,
  Tag,
  ListTask
} from 'react-bootstrap-icons'
import { useLanguage } from '../../../../../index'
import { SideBar } from '../../Shared'
import { SettingItemUI } from '../SettingItemUI'
import { ReportsBusinessDistance } from '../ReportsBusinessDistance'
import { ReportsOrderDistance } from '../ReportsOrderDistance'
import { ReportsBusinessSpend } from '../ReportsBusinessSpend'
import { ReportsDriverSpend } from '../ReportsDriverSpend'
import { ReportsDriverOrder } from '../ReportsDriverOrder'
import { ReportsDriverOrderTime } from '../ReportsDriverOrderTime'
import { ReportsDriverSchedule } from '../ReportsDriverSchedule'
import { ReportsOrderStatus } from '../ReportsOrderStatus'
import { ReportsHeatMap } from '../ReportsHeatMap'
import { ReportsDriverDistance } from '../ReportsDriverDistance'
import { ReportsSpentTime } from '../ReportsSpentTime'
import { ReportsTopDrivers } from '../ReportsTopDrivers'
import { ReportsOrders } from '../ReportsOrders'
import { ReportsSales } from '../ReportsSales'
import { ReportsUsers } from '../ReportsUsers'
import { ReportsCustomer } from '../ReportsCustomer'
import { ReportsPaymethodSales } from '../ReportsPaymethodSales'
import { ReportsSaleAndCategory } from '../ReportsSaleAndCategory'
import { ReportsAverageSales } from '../ReportsAverageSales'
import { ReportsGeneralSales } from '../ReportsGeneralSales'
import { ReportsSlaOrders } from './ReportsSlaOrders'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'

import {
  ReportsContainer,
  HeaderTitleContainer,
  ReportsList
} from './styles'

export const Reports = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState(0)
  const { width } = useWindowSize()
  const sidebarWidth = 240

  const advancedReportsList = [
    { id: 1, name: t('DISTANCE', 'Distance'), description: t('DISTANCE_DESC', 'Distance'), icon: <Rulers /> },
    { id: 2, name: t('DISTANCE_STORE_CUSTOMER', 'Distance in KM from the store to customer'), description: t('DISTANCE_STORE_CUSTOMER_DESC', 'Distance in KM from the store to customer'), icon: <Map /> },
    { id: 3, name: t('DISTANCE_STORE_CUSTOMER_RANGE_KM', 'Distance in KM from the store to customer (Range KM)'), description: t('DISTANCE_STORE_CUSTOMER_RANGE_KM_DESC', 'Distance in KM from the store to customer (Range KM)'), icon: <MapFill /> },
    { id: 4, name: t('SERVICE_TIMES', 'Service Times'), description: t('SERVICE_TIMES_DESCRIPTION', 'Service Times'), icon: <ClockHistory /> },
    { id: 5, name: t('DETAIL_COMPLETED_ORDERS', 'Detail of the completed orders of each delivery agency'), description: t('DETAIL_COMPLETED_ORDERS_DESC', 'Detail of the completed orders of each delivery agency'), icon: <FileRuled /> },
    { id: 6, name: t('NUMBER_ORDERS_SPECIFIC_RANGE', 'Number of orders within a specific range'), description: t('NUMBER_ORDERS_SPECIFIC_RANGE_DESC', 'Number of orders within a specific range'), icon: <FileEarmarkRuled /> },
    { id: 7, name: t('DRIVER_SCHEDULE', 'Driver schedule'), description: t('REPORT_DRIVER_SCHEDULE_DESCRIPTION', 'When each driver was available, busy or not available.'), icon: <CalendarCheck /> },
    { id: 8, name: t('ORDER_STATUS_TEXT', 'Order status'), description: t('REPORT_ORDER_STATUS_DESCRIPTION', 'Orders by status, by brand, store and order type.'), icon: <Cart4 /> },
    { id: 9, name: t('REPORT_ORDERS_HEAT_MAP', 'Orders heat map'), description: t('REPORT_ORDERS_HEAT_MAP_DESCRIPTION', 'Where orders are placed, by brand, store and driver group.'), icon: <GeoAltFill /> },
    { id: 10, name: t('DRIVER_DISTANCE', 'Driver distance'), description: t('REPORT_DRIVER_DISTANCE_DESCRIPTION', 'Distance traveled by each driver, by store and driver group.'), icon: <Vr /> },
    { id: 11, name: t('DRIVER_TIME', 'Driver Time'), description: t('REPORT_DRIVER_TIME_DESCRIPTION', 'Time drivers spent on orders, by driver group.'), icon: <Alarm /> },
    { id: 12, name: t('TOP_DRIVERS', 'Top drivers'), description: t('REPORT_TOP_DRIVERS_DESCRIPTION', 'Drivers with the most orders and their average delivery time.'), icon: <Truck /> },
    { id: 13, name: t('ORDERS', 'Orders'), description: t('REPORT_ORDERS_DESCRIPTION', 'Number of orders over time, by brand and store.'), icon: <Cart3 /> },
    { id: 14, name: t('SALES', 'Sales'), description: t('REPORT_SALES_DESCRIPTION', 'Sales over time, by brand and store.'), icon: <Shop /> },
    { id: 15, name: t('REGISTER_USERS', 'Register users'), description: t('REPORT_REGISTER_USERS_DESCRIPTION', 'New customer sign-ups over time, by app.'), icon: <PersonCheck /> },
    { id: 16, name: t('CUSTOMER_SATISFACTION', 'Customer satisfaction'), description: t('REPORT_CUSTOMER_SATISFACTION_DESCRIPTION', 'Review ratings from customers, by category.'), icon: <Star /> },
    { id: 17, name: t('PAYMETHOD_SALES', 'Paymethod sales'), description: t('REPORT_PAYMETHOD_SALES_DESCRIPTION', 'Sales by payment method, by brand and driver group.'), icon: <CreditCard /> },
    { id: 18, name: t('AVERAGE_SALES', 'Average sales'), description: t('REPORT_AVERAGE_SALES_DESCRIPTION', 'Average order value by site, brand and driver group.'), icon: <ShopWindow /> },
    { id: 19, name: t('GENERAL_SALES', 'General sales'), description: t('REPORT_GENERAL_SALES_DESCRIPTION', 'Sales summary by brand, store and driver group.'), icon: <Bag /> },
    { id: 20, name: t('TOP_SELLING_AND_CATEOGRY', 'Top selling and category'), description: t('REPORT_TOP_SELLING_DESCRIPTION', 'Best-selling products and categories by number of orders.'), icon: <Tag /> },
    { id: 21, name: t('SLA_ORDERS', 'SLA orders'), description: t('REPORT_SLA_ORDERS_DESCRIPTION', 'Orders that met or missed their delivery time (SLA).'), icon: <ListTask /> }
  ]

  const handleCloseSidebar = () => {
    setIsOpen(false)
    setSelectedReport(0)
    removeQueryToUrl(['id'])
  }

  const handleOpenSlider = (index, isInitialRender) => {
    setSelectedReport(index)
    setIsOpen(true)
    if (!isInitialRender) {
      addQueryToUrl({ id: index })
    }
  }

  useEffect(() => {
    const id = query.get('id')
    if (id) {
      handleOpenSlider(Number(id), true)
    }
  }, [])

  return (
    <ReportsContainer>
      <HeaderTitleContainer>
        {isCollapse && (
          <IconButton
            color='black'
            onClick={() => handleMenuCollapse(false)}
          >
            <MenuIcon />
          </IconButton>
        )}
        <h1>{t('ENTERPRISE_REPORTS', 'Enterprise reports')}</h1>
      </HeaderTitleContainer>
      <ReportsList className='row'>
        {advancedReportsList && advancedReportsList.map((report, i) => (
          <div
            key={i}
            className='col-md-6 col-lg-4'
            onClick={() => handleOpenSlider(report.id)}
          >
            <SettingItemUI
              title={report.name}
              // description={t('DISTANCE_DESC')}
              description={report.description}
              icon={report.icon}
              active={selectedReport === report.id}
            />
          </div>
        ))}
      </ReportsList>
      {isOpen && (
        <SideBar
          sidebarId='brand-details'
          defaultSideBarWidth={width - sidebarWidth}
          open={isOpen}
          onClose={() => handleCloseSidebar()}
        >
          {selectedReport === 1 && <ReportsBusinessDistance />}
          {selectedReport === 2 && <ReportsOrderDistance />}
          {selectedReport === 3 && <ReportsBusinessSpend />}
          {selectedReport === 4 && <ReportsDriverOrderTime />}
          {selectedReport === 5 && <ReportsDriverSpend />}
          {selectedReport === 6 && <ReportsDriverOrder />}
          {selectedReport === 7 && <ReportsDriverSchedule />}
          {selectedReport === 8 && <ReportsOrderStatus />}
          {selectedReport === 9 && <ReportsHeatMap />}
          {selectedReport === 10 && <ReportsDriverDistance />}
          {selectedReport === 11 && <ReportsSpentTime />}
          {selectedReport === 12 && <ReportsTopDrivers />}
          {selectedReport === 13 && <ReportsOrders />}
          {selectedReport === 14 && <ReportsSales />}
          {selectedReport === 15 && <ReportsUsers />}
          {selectedReport === 16 && <ReportsCustomer />}
          {selectedReport === 17 && <ReportsPaymethodSales />}
          {selectedReport === 18 && <ReportsAverageSales />}
          {selectedReport === 19 && <ReportsGeneralSales />}
          {selectedReport === 20 && <ReportsSaleAndCategory />}
          {selectedReport === 21 && <ReportsSlaOrders />}
        </SideBar>
      )}
    </ReportsContainer>
  )
}
