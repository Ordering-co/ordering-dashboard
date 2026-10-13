import React from 'react'
import { Option } from './styles'

export const productTypes = (t) => {
  const productTypeOptions = [
    {
      value: 'website',
      content: <Option>{t('TYPE_WEBSITE', 'Website')}</Option>,
      enabled: true
    },
    {
      value: 'ordering_app',
      content: <Option>{t('TYPE_ORDERING_APP', 'Ordering App')}</Option>,
      enabled: true
    },
    {
      value: 'dashboard',
      content: <Option>{t('TYPE_DASHBOARD', 'Dashboard')}</Option>,
      enabled: true
    },
    {
      value: 'franchise_app',
      content: <Option>{t('TYPE_FRANCHISE_APP', 'Franchise App')}</Option>,
      enabled: true
    },
    {
      value: 'franchise_web',
      content: <Option>{t('TYPE_FRANCHISE_WEB', 'Franchise Web')}</Option>,
      enabled: true
    },
    {
      value: 'api',
      content: <Option>{t('TYPE_API', 'API')}</Option>,
      enabled: true
    },
    {
      value: 'business_app',
      content: <Option>{t('TYPE_BUSINESS_APP', 'Business App')}</Option>,
      enabled: true
    },
    {
      value: 'driver_app',
      content: <Option>{t('TYPE_DRIVER_APP', 'Driver App')}</Option>,
      enabled: true
    },
    {
      value: 'kiosk_app',
      content: <Option>{t('TYPE_KIOSK_APP', 'Kiosk App')}</Option>,
      enabled: true
    }
  ]
  return productTypeOptions.filter((option) => (option.enabled))
}
