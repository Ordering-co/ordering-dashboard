import React, { useState } from 'react'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { ColorPicker } from '../../Shared'
import { InnerBlock, InputFormWrapper, ThemeContainerList, TitleWrapper } from './styles'

export const AppTheme = (props) => {
  const { app, appTheme, updateTheme, updateAppValues } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [themeState, setThemeState] = useState({ loading: false, changes: {}, error: null })
  const themeList = appTheme

  const handleChange = async (id, color) => {
    try {
      setThemeState({
        ...themeState,
        loading: true,
        changes: {
          ...themeState.changes,
          [id]: color
        }
      })
      const { error, result } = await updateTheme({ id, type: 'colors', body: JSON.stringify({ text_content: color }) })
      if (!error) {
        let newApp = { ...app }
        const baseActions = app?.baseActions
        const indexToUpdate = baseActions?.findIndex(act => Number(act.id) === Number(result?.id))
        if (indexToUpdate !== -1) {
          baseActions[indexToUpdate] = {
            ...baseActions?.find(act => act.id === result?.id),
            ...result
          }
          newApp = { ...newApp, baseActions }
          updateAppValues(newApp)
        }
        showToast(ToastType.Success, t('CORRECTLY_SAVED_THEME_COLOR', 'Correctly saved color'))
      }
      setThemeState({
        ...themeState,
        loading: false,
        error: error ? result : null,
        changes: {}
      })
    } catch (err) {
      setThemeState({
        ...themeState,
        loading: false,
        error: err?.message ?? err
      })
    }
  }

  return (
    <InputFormWrapper>
      <InnerBlock>
        <TitleWrapper>
          <h4>{t('THEME_APP_SETTINGS', 'Theme Settings')}</h4>
        </TitleWrapper>
        <ThemeContainerList>
          {themeList.map(color => (
            <div key={color.id} style={{ width: 'fit-content' }}>
              <p className='color'>{t(`THEME_COLOR_${color.name.toUpperCase().replace(/ /g, '_')}`, color.name)}</p>
              <ColorPicker
                isDisabled={themeState.loading && Object.keys(themeState.changes).map(k => Number(k)).includes(color.id)}
                defaultColor={themeState.changes?.[color.id] ?? color.text_content}
                onChangeColor={(c) => handleChange(color.id, c)}
              />
            </div>
          ))}
        </ThemeContainerList>
      </InnerBlock>
    </InputFormWrapper>
  )
}
