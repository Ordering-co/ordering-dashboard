import React from 'react'
import { useLanguage } from '../../../../../index'
import { Select } from '../../../styles/Select'
import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'
import { userTypesValues } from './utils'

import {
  Option
} from './styles'

export const UserTypeSelector = (props) => {
  const {
    userId,
    defaultUserType,
    defaultUserTypesSelected,
    handleChangeUserType,
    isPrimary
  } = props
  const [, t] = useLanguage()

  const userTypes = userTypesValues({
    ...props,
    t,
    defaultUserTypesSelected
  })

  const placeholder = <Option isWeight>{t('TYPE', 'Type')}</Option>

  const onUpdateUserType = (type) => {
    handleChangeUserType && handleChangeUserType({ id: userId, level: type })
  }

  return (
    <>
      {isPrimary
        ? (
            <FirstSelect
              defaultValue={defaultUserType}
              placeholder={placeholder}
              options={userTypes}
              onChange={type => handleChangeUserType(type)}
              isDisabled={Array.isArray(defaultUserTypesSelected)}
            />
          )
        : (
            <Select
              type='primary'
              noSelected
              placeholder={placeholder}
              options={userTypes}
              onChange={type => onUpdateUserType(type)}
            />
          )}
    </>
  )
}
