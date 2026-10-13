import React, { useEffect, useState } from 'react'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { InnerBlock, InputFormWrapper, TitleWrapper, FormGroup, WrapperCheckbox } from './styles'
import { Checkbox, Input, TextArea } from '../../../styles'
import { constantsUtilities } from './utils'
import { SelectBusiness } from '../OrderingWebsite/SelectBusiness'

const { typeDictionary } = constantsUtilities()

export const AppContants = (props) => {
  const { app, constants, updateContants, updateAppValues, businessesList } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [constantsState, setConstantsState] = useState({ loading: false, changes: {}, error: null })
  const constantsList = constants

  const handleChange = async (id, value) => {
    try {
      setConstantsState({
        ...constantsState,
        loading: true,
        changes: {
          ...constantsState.changes,
          [id]: value
        }
      })
      const { error, result } = await updateContants({ id, body: { value } })
      if (!error) {
        let newApp = { ...app }
        const baseConstants = app?.baseConstants
        const indexToUpdate = baseConstants?.findIndex(act => Number(act.id) === Number(result?.id))
        if (indexToUpdate !== -1) {
          baseConstants[indexToUpdate] = {
            ...baseConstants?.find(act => act.id === result?.id),
            ...result
          }
          newApp = { ...newApp, baseConstants }
          updateAppValues(newApp)
        }
        showToast(ToastType.Success, t('CORRECTLY_SAVED_CONSTANTS', 'Correctly saved constant'))
      }
      setConstantsState({
        ...constantsState,
        loading: false,
        error: error ? result : null,
        changes: {}
      })
    } catch (err) {
      setConstantsState({
        ...constantsState,
        loading: false,
        error: err?.message ?? err
      })
    }
  }

  return (
    <InputFormWrapper>
      <InnerBlock>
        <TitleWrapper>
          <h4>{t('CONSTANTS_SETTINGS', 'Constants')}</h4>
        </TitleWrapper>
        {constantsList.map(constant => (
          <FormGroup key={constant.id} isCheckbox={typeDictionary[constant.type] === 'checkbox'}>
            <label>{t(`CONSTANT_${constant.code.toUpperCase()}`, constant.name)}</label>
            <InputComponent
              id={constant.id}
              name={constant.code}
              placeholder={constant.name}
              disabled={constantsState.loading}
              type={typeDictionary[constant.type]}
              businessesList={constant.code === 'business_slug' ? businessesList : null}
              value={constantsState?.changes?.[constant.id] ?? constant?.value ?? ''}
              onChange={handleChange}
            />
          </FormGroup>
        ))}
      </InnerBlock>
    </InputFormWrapper>
  )
}

const InputComponent = (props) => {
  const {
    id,
    name,
    type,
    placeholder,
    value,
    disabled,
    onChange,
    businessesList
  } = props

  const [inputValue, setInputValue] = useState(value)
  const [timeoutId, setTimeoutId] = useState(null)

  const handleChange = (id, value, withDelay) => {
    const sanitizedValue = value === null ? null : value?.replace?.(/\s+/g, '')
    if (withDelay) {
      setInputValue(sanitizedValue)
      clearTimeout(timeoutId)
      const newTimeoutId = setTimeout(() => {
        onChange(id, sanitizedValue)
      }, 750)
      setTimeoutId(newTimeoutId)
    } else {
      onChange(id, sanitizedValue)
    }
  }

  useEffect(() => {
    return () => clearTimeout(timeoutId)
  }, [timeoutId])

  return (
    <>
      {type === 'checkbox' && (
        <WrapperCheckbox id='checkbox'>
          <Checkbox
            checked={typeof value === 'string' ? !!parseInt(value, 10) : value}
            disabled={disabled}
            onChange={e => onChange(id, e.target.checked)}
          />
        </WrapperCheckbox>
      )}
      {!businessesList && ['text', 'number'].includes(type) && (
        <Input
          name={name}
          placeholder={placeholder}
          type={type}
          value={inputValue ?? value}
          disabled={disabled}
          onChange={(c) => handleChange(id, c.target?.value, true)}
        />
      )}
      {type === 'textarea' && (
        <TextArea
          placeholder={placeholder}
          name={name}
          rows={3}
          value={inputValue ?? value}
          onChange={(c) => handleChange(id, c.target?.value, true)}
          disabled={disabled}
          autoComplete='off'
        />
      )}
      {!!businessesList && (
        <SelectBusiness
          defaultValue={inputValue ?? value ?? null}
          businessesList={businessesList}
          onChange={value => handleChange(id, value === 'none' ? null : value, true)}
          showNoOption
        />
      )}
    </>
  )
}
