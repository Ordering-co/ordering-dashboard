import React from 'react'
import {
  Option
} from './styles'

export const emailSettingsOptionsValues = (t) => {
  return [
    {
      value: 'superadmin',
      content: <Option>{t('ADMINISTRATOR', 'Administrator')}</Option>
    },
    {
      value: 'business',
      content: <Option>{t('BUSINESS', 'Business')}</Option>
    },
    {
      value: 'customer',
      content: <Option>{t('CUSTOMER', 'Customer')}</Option>
    }
  ]
}
