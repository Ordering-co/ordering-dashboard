import React, { useEffect, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Select } from '../../../styles/Select'
import { Input } from '../../../styles/Inputs'
import { capitalize } from '~ui'
import { getSettingsOrderTypeValues } from '../../../utils'
import { applySettingsConfigCopy } from '../../../../../utils/settingsCustomSections'

import {
  SettingsSelectContainer,
  SelectHeader,
  SelectContent,
  Option,
  OptionsError,
  InputWrapper
} from './styles'

export const SettingsSelectUI = (props) => {
  const {
    config,
    handleSelectChange,
    noHeader,
    invertValues
  } = props

  const [, t] = useLanguage()
  const displayConfig = applySettingsConfigCopy(config, t)

  const [options, setOptions] = useState(null)
  const customKeyConfigs = ['filter_order_options', 'allowed_order_types_guest_checkout', 'default_order_type', 'order_types_allowed', 'unaddressed_order_types_allowed']

  useEffect(() => {
    if (!config) return
    let selectedTypes = []
    if (config.key === 'terms_and_conditions') {
      selectedTypes = [
        { value: 'true', content: <Option>{t('YES', 'Yes')}</Option> },
        { value: 'false', content: <Option>{t('NO', 'No')}</Option> }
      ]
    } else if (customKeyConfigs.includes(config.key)) {
      const defaultOrderType = getSettingsOrderTypeValues()

      selectedTypes = config?.options?.filter(option => defaultOrderType.includes(option.value)).map(item => {
        return { value: item.value, content: <Option>{t(item.text.toUpperCase(), capitalize(item.text.toLowerCase().replace(/_/g, ' ')))}</Option> }
      })
    } else {
      selectedTypes = config?.options?.map((item, i, hash) => {
        const value = invertValues ? (i === 0 ? hash[1]?.value : hash[0]?.value) : item.value
        const content = <Option>{t(item.text.toUpperCase(), capitalize(item.text.toLowerCase().replace(/_/g, ' ')))}</Option>
        return { value, content }
      })
    }
    if (config.customizable) {
      selectedTypes.push({
        value: config?.value,
        content: <Option>{t('CUSTOM', 'Custom')}</Option>,
        showOnSelected: (
          <InputWrapper className='open-disabled'>
            <Input
              placeholder={t('CUSTOM', 'Custom')}
              defaultValue={config?.value}
              onChange={e => handleSelectChange(e.target.value)}
            />
          </InputWrapper>
        )
      })
    }
    setOptions(selectedTypes)
  }, [config, invertValues, handleSelectChange, t])

  return (
    <SettingsSelectContainer>
      {!noHeader && (
        <SelectHeader>
          {
            displayConfig?.name && (
              <label>{displayConfig.name}</label>
            )
          }
          {displayConfig?.description && <p>{displayConfig.description}</p>}
        </SelectHeader>
      )}
      {
        options
          ? (
          <SelectContent>
            <Select
              selectStyle={props.selectStyle}
              defaultValue={config?.value}
              options={options}
              onChange={(typeValue) => handleSelectChange(typeValue)}
              placeholder={t('SELECT_A_OPTION', 'Select a option')}
            />
          </SelectContent>
            )
          : (
          <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>
            )
      }

    </SettingsSelectContainer>
  )
}
