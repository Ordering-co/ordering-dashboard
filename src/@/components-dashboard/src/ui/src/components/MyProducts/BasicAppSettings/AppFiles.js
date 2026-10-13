import React, { useState } from 'react'
import { useTheme } from 'styled-components'

import {
  ButtonCustom,
  FormGroup,
  InnerBlock,
  InputFormWrapper,
  TitleWrapper
} from './styles'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { InputFile } from './InputFile'

export const AppFiles = (props) => {
  const {
    app,
    files,
    updateFiles,
    updateAppValues
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const [, { showToast }] = useToast()

  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })

  const handleChangeInput = (file, id) => {
    const changes = formState.changes
    if (file === null) {
      if (changes[id]) {
        delete changes[id]
      }
    } else {
      changes[id] = file
    }

    setFormState({ ...formState, changes })
  }

  const handleSave = async () => {
    try {
      setFormState({ ...formState, loading: true })

      const promises = Object.keys(formState.changes).map(id => ({
        body: formState.changes[id], id
      }))

      if (promises.length) {
        const responses = await Promise.all(promises.map(async (promise) => {
          const body = new FormData()
          body.append('source_file', promise.body)

          const { error, result } = await updateFiles({ id: promise.id, body })
          return error ? null : result
        }))

        if (responses.some(res => res)) {
          let newApp = { ...app }
          const baseActions = app?.baseActions
          responses.forEach(result => {
            const indexToUpdate = baseActions?.findIndex(act => Number(act.id) === Number(result?.id))
            if (indexToUpdate) {
              baseActions[indexToUpdate] = {
                ...baseActions?.find(act => act.id === result?.id),
                ...result
              }
              newApp = { ...newApp, baseActions }
            }
          })
          updateAppValues(newApp)
          showToast(ToastType.Success, t('CORRECTLY_SAVED_FILES', 'Correctly saved files'))
        }
      }

      setFormState({
        ...formState,
        loading: false,
        changes: {}
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
          <h4>{t('BUILD_FILES', 'Files')}</h4>
        </TitleWrapper>
        {files.map(item => (
          <FormGroup key={item.id}>
            <label>{item.name}{item?.file_rules?.extension ? `(.${item?.file_rules?.extension})` : ''}</label>
            <InputFile
              name={item.name}
              maxFileSize={Math.max(item?.file_rules?.max_size || 0, 1024)}
              accept={'.' + item?.file_rules?.extension}
              defaultValue={files.find(f => f.id === item.id)?.source_path}
              updateInput={(file) => handleChangeInput(file, item.id)}
            />
          </FormGroup>
        ))}
        <ButtonCustom
          style={{ width: 'fit-content' }}
          color={theme.colors.primary}
          textColor={theme.colors.white}
          disabled={
            formState.loading ||
            !(Object.values(formState?.changes).length && Object.values(formState?.changes).some(c => c))
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
