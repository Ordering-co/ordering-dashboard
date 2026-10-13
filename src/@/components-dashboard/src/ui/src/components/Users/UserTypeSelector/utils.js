import React from 'react'
import {
  Option
} from './styles'

export const userTypesValues = (props) => {
  const {
    t,
    isPrimary,
    defaultUserType,
    defaultUserTypesSelected
  } = props

  const values = [
    {
      value: 0,
      content: <Option>{t('ADMINISTRATOR', 'Administrator')}</Option>,
      showOnSelected: <Option padding>{t('ADMINISTRATOR', 'Administrator')}</Option>,
      showOption: true,
      disabled: !isPrimary && defaultUserType === 0
    },
    {
      value: 2,
      content: <Option>{t('BUSINESS_OWNER', 'Business owner')}</Option>,
      showOnSelected: <Option padding>{t('BUSINESS_OWNER', 'Business owner')}</Option>,
      showOption: true,
      disabled: !isPrimary && defaultUserType === 2
    },
    {
      value: 3,
      content: <Option>{t('USER', 'User')}</Option>,
      showOnSelected: <Option padding>{t('USER', 'User')}</Option>,
      showOption: true,
      disabled: !isPrimary && defaultUserType === 3
    },
    {
      value: 4,
      content: <Option>{t('DRIVER', 'Driver')}</Option>,
      showOnSelected: <Option padding>{t('DRIVER', 'Driver')}</Option>,
      showOption: true,
      disabled: !isPrimary && defaultUserType === 4
    },
    {
      value: 5,
      content: <Option>{t('DRIVER_MANAGER', 'Driver manager')}</Option>,
      showOnSelected: <Option padding>{t('DRIVER_MANAGER', 'Driver manager')}</Option>,
      showOption: true,
      disabled: !isPrimary && defaultUserType === 5
    },
    {
      value: 9,
      content: <Option>{t('CALL_CENTER_AGENT', 'Call center agent')}</Option>,
      showOnSelected: <Option padding>{t('CALL_CENTER_AGENT', 'Call center agent')}</Option>,
      showOption: true,
      disabled: !isPrimary && defaultUserType === 9
    },
    {
      value: 8,
      content: <Option>{t('PROFESSIONAL', 'Professional')}</Option>,
      showOnSelected: <Option padding>{t('PROFESSIONAL', 'Professional')}</Option>,
      showOption: true,
      disabled: !isPrimary && defaultUserType === 8
    }
  ]
  return values.filter((option) => ((option.showOption && !Array.isArray(defaultUserTypesSelected)) || (defaultUserTypesSelected?.includes(option.value))))
}
