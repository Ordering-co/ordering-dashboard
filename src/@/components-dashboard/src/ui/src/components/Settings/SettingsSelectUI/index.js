import React, { useEffect, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Select } from '../../../styles/Select'
import { Input } from '../../../styles/Inputs'
import { applySettingsConfigCopy } from '../../../../../utils/settingsCustomSections'
import { getSettingsSelectOptions } from '../../../../../utils/settingsSelectOptions'

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

  useEffect(() => {
    if (!config) return
    // redesign settings B: the list is built by the shared helper (same options as before, every order type
    // with no addon gate as in main); this component only wraps each label in its <Option> and gives the Custom row its input.
    const selectedTypes = getSettingsSelectOptions({ config, t, invertValues })?.map(item => (
      item.custom
        ? {
            value: item.value,
            content: <Option>{item.label}</Option>,
            showOnSelected: (
              <InputWrapper className='open-disabled'>
                <Input
                  placeholder={t('CUSTOM', 'Custom')}
                  defaultValue={config?.value}
                  onChange={e => handleSelectChange(e.target.value)}
                />
              </InputWrapper>
            )
          }
        : { value: item.value, content: <Option>{item.label}</Option> }
    ))
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
