import React, { useState } from 'react'
import { useTheme } from 'styled-components'

import { useLanguage } from '../../../../../index'
import { ButtonCustom, FormGroup, FormGroupGrid, InnerBlock, InputFormWrapper, TitleWrapper } from './styles'
import { Input, TextArea } from '../../../styles'

export const AppSettings = (props) => {
  const { app, updateProductApp, updateAppValues } = props

  const [, t] = useLanguage()
  const theme = useTheme()

  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })

  const handleChangeInput = (e) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        [e.target.name]: e.target.value
      }
    })
  }

  const handleSave = async () => {
    try {
      setFormState({ ...formState, loading: true })
      const { error, result } = await updateProductApp(formState.changes)
      !error && updateAppValues(result)
      setFormState({
        ...formState,
        loading: false,
        error: error ? result : null,
        changes: {},
        result: error ? null : result
      })
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err?.message ?? err
      })
    }
  }

  return (
    <InputFormWrapper>
      <InnerBlock>
        <TitleWrapper>
          <h4>{t('BASIC_SETTINGS_APP_SETTINGS', 'App Basic settings')}</h4>
        </TitleWrapper>
        <FormGroup>
          <label>{t('NAME', 'Name')}</label>
          <Input
            name='name'
            placeholder={t('CUSTOMER_APP', 'Customer App')}
            value={formState?.changes?.name ?? app?.name ?? ''}
            onChange={handleChangeInput}
          />
        </FormGroup>
        <FormGroupGrid>
          <FormGroup>
            <label>{t('PACKAGE_APP', 'Package')}</label>
            <Input
              name='package'
              placeholder={t('NAME', 'Name')}
              value={formState?.changes?.package ?? app?.package ?? ''}
              onChange={handleChangeInput}
            />
          </FormGroup>
          <FormGroup>
            <label>{t('VERSION_APP', 'Version')}</label>
            <Input
              name='version'
              placeholder='0.0.0'
              value={formState?.changes?.version ?? app?.version ?? ''}
              onChange={handleChangeInput}
            />
          </FormGroup>
        </FormGroupGrid>
        <FormGroup>
          <label>{t('DESCRIPTION', 'Decription')}</label>
          <TextArea
            name='description'
            placeholder={t('DESCRIPTION', 'Decription')}
            value={formState?.changes?.description ?? app?.description ?? ''}
            onChange={handleChangeInput}
          />
        </FormGroup>
        <ButtonCustom
          style={{ width: 'fit-content' }}
          color={theme.colors.primary}
          textColor={theme.colors.white}
          disabled={
            formState.loading ||
            !(Object.values(formState?.changes).length && Object.values(formState?.changes).every(c => c))
          }
          onClick={() => handleSave()}
        >
          {formState.loading
            ? <p className='loader'><span>{t('LOADING', 'Loading')}</span></p>
            : <p>{t('SAVE', 'Save')}</p>}
        </ButtonCustom>
      </InnerBlock>
    </InputFormWrapper>
  )
}
