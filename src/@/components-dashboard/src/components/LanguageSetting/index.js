import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Component to manage LanguageSetting behavior without UI component
 */
export const LanguageSetting = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [, { showToast }] = useToast()
  const [languageState, t, { updateLanguageListState }] = useLanguage()

  const [languageFiledsState, setLanguageFiledsState] = useState({ fields: [], loading: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  /**
   * Method to update the language fields setting from API
   * @param {Number} fieldId selected field id
   * @param {Object} changes changes
   */
  const handleChangeFieldSetting = async (fieldId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const { content: { error, result } } = await ordering.languages(fieldId).save(changes)
      if (!error) {
        setActionState({ loading: false, error: null })
        showToast(ToastType.Success, t('WEB_APP_LANG_SAVED', 'Language change saved'))
        const fields = languageFiledsState.fields.filter(field => {
          if (field.id === fieldId) {
            Object.assign(field, result)
          }
          return true
        })
        setLanguageFiledsState({ ...languageFiledsState, fields })
        updateLanguageListState(result)
      } else {
        setActionState({ loading: false, error: result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    if (languageState.loading) return
    setLanguageFiledsState({
      ...languageFiledsState,
      loading: false,
      fields: languageState.languageList
    })
  }, [languageState.languageList])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          languageFiledsState={languageFiledsState}
          handleChangeFieldSetting={handleChangeFieldSetting}
        />
      )}
    </>
  )
}

LanguageSetting.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
