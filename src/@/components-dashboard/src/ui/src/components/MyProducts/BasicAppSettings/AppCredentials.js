import React, { useState } from 'react'
import { useTheme } from 'styled-components'

import {
  ButtonCustom,
  FormGroup,
  InnerBlock,
  InputFormWrapper,
  TitleWrapper,
  WrapperCredentialsInputs
} from './styles'

import { useToast, ToastType, useLanguage } from '../../../../../index'
import { credentialsUtilities } from './utils'
import { Input } from '../../../styles'
import { InputFile } from './InputFile'

const { CREDENTIALINPUTS, formatInputName, formatPlatformName } = credentialsUtilities()

export const AppCredentials = (props) => {
  const {
    app,
    credentials,
    updateAppValues,
    updateCredentials
  } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const theme = useTheme()

  const [formState, setFormState] = useState({ loading: false, changes: { ios: {}, android: {} }, error: null })

  const handleChangeInput = (file, platform) => {
    const changes = formState.changes
    if (file?.target?.value === null) {
      delete changes[platform]?.[file?.target?.name]
      if (changes[platform]?.[file?.target?.name]) {
        delete changes[platform]?.[file?.target?.name]
      }
    } else {
      const sanitizedValue = file.target.value.replace ? file.target.value.replace(/\s+/g, '') : file.target.value
      changes[platform] = {
        ...changes[platform],
        [file?.target?.name]: sanitizedValue
      }
    }

    setFormState({ ...formState, changes })
  }

  const handleSave = async () => {
    try {
      setFormState({ ...formState, loading: true })

      const platforms = app?.base?.platforms?.map(platform => ({
        platform,
        enabled: Object.values(formState?.changes?.[platform]).length,
        body: formState.changes?.[platform],
        state: { error: null, result: null }
      }))

      const promises = Object.values(platforms).filter(p => p.enabled)
      const messages = []
      if (promises.length) {
        const responses = await Promise.all(promises.map(async (platform) => {
          const body = new FormData()

          Object.keys(platform.body).forEach(field => {
            if (typeof platform.body[field] !== 'undefined') {
              body.append(field, platform.body[field])
            }
          })

          const { error, result } = await updateCredentials({ body, platform: platform.platform })
          if (error) {
            messages.push(...result)
          }
          return error
            ? null
            : { [`${platform.platform}_credentials`]: result }
        }))
        showToast(
          messages.length ? ToastType.Error : ToastType.Success,
          messages.length ? messages.join('\n') : t('CREDENTIALS_SAVED', 'Credentials saved successfully')
        )
        if (responses.some(res => res)) {
          const values = responses.filter(r => r).reduce((obj, item) => {
            const key = Object.keys(item)[0]
            return { ...obj, [key]: item[key] }
          }, {})

          let newApp = { ...app }
          Object.keys(values).forEach(prop => {
            newApp = {
              ...newApp,
              [prop]: {
                ...newApp?.[prop],
                ...values[prop]
              }
            }
          })
          updateAppValues(newApp)
        }
      }

      setFormState({
        ...formState,
        loading: false,
        changes: { ios: {}, android: {} }
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
          <h4>{t('APP_KEYS', 'App keys')}</h4>
        </TitleWrapper>
        {CREDENTIALINPUTS.map((input, i) => (
          <WrapperCredentialsInputs
            key={input.platform}
            style={{ borderBottom: i !== (CREDENTIALINPUTS.length - 1) ? `3px solid ${theme.colors.gray}` : 0 }}
          >
            <h4>{formatPlatformName(input.platform)}</h4>

            {input.inputs.map(item => (
              <FormGroup key={item.name}>
                <label>{formatInputName(item.name)}{item?.accept ? `(${item?.accept})` : ''}</label>
                {item.type === 'file'
                  ? <InputFile
                    key={item.name}
                    name={item.name}
                    maxFileSize={1024}
                    accept={item.accept}
                    defaultValue={credentials?.[input.platform]?.[item.name]}
                    updateInput={(file) => handleChangeInput({ target: { name: item.name, value: file } }, input.platform)}
                  />
                  : <Input
                    name={item.name}
                    type={item.type}
                    minLength='1'
                    maxLength='255'
                    placeholder={formatInputName(item.name)}
                    value={formState?.changes?.[input.platform]?.[item.name] ?? credentials?.[input.platform]?.[item.name] ?? ''}
                    onChange={(e) => handleChangeInput(e, input.platform)}
                  />}
              </FormGroup>
            ))}
          </WrapperCredentialsInputs>
        ))}
        <ButtonCustom
          style={{ width: 'fit-content' }}
          color={theme.colors.primary}
          textColor={theme.colors.white}
          disabled={
            formState.loading ||
            !(
              (Object.values(formState?.changes?.android).length) ||
              (Object.values(formState?.changes?.ios).length)
            )
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
