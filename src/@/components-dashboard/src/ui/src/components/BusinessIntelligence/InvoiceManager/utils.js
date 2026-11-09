import React from 'react'
import {
  ShopWindow as BusinessIcon,
  Truck as DriverIcon
} from 'react-bootstrap-icons'

export const invoiceOptionValues = (props) => {
  const { t } = props
  const values = [
    {
      id: 1,
      key: 'business',
      name: t('BUSINESS_INVOICE', 'Business invoice'),
      icon: <BusinessIcon />,
      description: t('BUSINESS_INVOICE_DESCRIPTION', 'Efficiently handle business payments with tailored invoices using Ordering.co.'),
      enabled: true
    },
    {
      id: 2,
      key: 'driver',
      name: t('DRIVER_INVOICE', 'Driver invoice'),
      icon: <DriverIcon />,
      description: t('DRIVER_INVOICE_DESCRIPTION', 'Effortlessly manage driver payments with detailed, customizable invoices on Ordering.co.'),
      enabled: true
    }
  ]
  return values.filter((option) => (option.enabled))
}
