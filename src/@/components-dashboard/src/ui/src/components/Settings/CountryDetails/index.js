import React, { useState, useEffect, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useLanguage } from '../../../../../index'
import { Button, Input, Switch } from '../../../styles'
import { Alert } from '../../Shared'
import { useHubFormReport } from '../SettingsHubForm/useHubFormReport'

import {
  Container,
  Header,
  InputWrapper,
  FormContainer
} from './styles'

export const CountryDetails = (props) => {
  const {
    country,
    handleUpdateCountry,
    handleAddCountry
  } = props

  const [, t] = useLanguage()
  const { handleSubmit, register, errors, control, reset, watch } = useForm()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const titleRef = useRef(null)

  // (owner decision 17): tell the Settings hub when the form holds a value other than the saved one, so its
  // «Discard your changes?» guard covers this panel too. `watch` is undefined until a field is registered: that is not a change.
  // After a save the list hands this panel the country with its new values, so the form is clean again.
  const typedName = watch('name')
  const typedCode = watch('code')
  const isDirty = (typeof typedName === 'string' && typedName !== (country?.name ?? '')) ||
    (typeof typedCode === 'string' && typedCode !== (country?.code ?? ''))
  useHubFormReport('places:country', { dirty: isDirty, saving: false })

  // the panel opens with the focus on its title (the list gives the focus back to what opened it on close)
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [country?.id])

  const onSubmit = (values) => {
    if (country) {
      handleUpdateCountry(country?.id, values)
    } else {
      handleAddCountry(values)
    }
  }

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setAlertState({
        open: true,
        content: Object.values(errors).map((error) => error.message)
      })
    }
  }, [errors])

  useEffect(() => {
    reset()
  }, [country?.id])

  return (
    <Container>
      <Header>
        <h1 ref={titleRef} tabIndex={-1}>{country ? t('COUNTRY_SETTINGS', 'Country settings') : t('ADD_NEW_COUNTRY ', 'Add new country')}</h1>
        {country && (
          <Switch
            defaultChecked={!!country?.enabled}
            onChange={enabled => handleUpdateCountry(country?.id, { enabled })}
          />
        )}
      </Header>
      <FormContainer onSubmit={handleSubmit(onSubmit)}>
        <InputWrapper>
          <label>{t('NAME', 'Name')}</label>
          <Input
            name='name'
            ref={register({
              required: t(
                'VALIDATION_ERROR_REQUIRED',
                'Name is required'
              ).replace('_attribute_', t('NAME', 'Name'))
            })}
            defaultValue={country?.name ?? ''}
            autoComplete='off'
          />
        </InputWrapper>
        <InputWrapper>
          <label>{t('CODE', 'Code')}</label>
          <Controller
            name='code'
            control={control}
            render={({ onChange, value }) => (
              <Input
                value={value}
                autoComplete='off'
                onChange={e => onChange(e.target.value.toUpperCase())}
              />
            )}
            rules={{
              required: t(
                'VALIDATION_ERROR_REQUIRED',
                'Code is required'
              ).replace('_attribute_', t('CODE', 'Code')),
              minLength: {
                value: 2,
                message: t('ERROR_VERIFICATION_CODE_INVALID', 'The code is invalid')
              },
              maxLength: {
                value: 2,
                message: t('ERROR_VERIFICATION_CODE_INVALID', 'The code is invalid')
              }
            }}
            defaultValue={country?.code ?? ''}
          />
        </InputWrapper>
        <Button
          type='submit'
          borderRadius='8px'
          color='primary'
        >
          {country ? t('SAVE', 'Save') : t('ADD', 'Add')}
        </Button>
      </FormContainer>
      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </Container>
  )
}
