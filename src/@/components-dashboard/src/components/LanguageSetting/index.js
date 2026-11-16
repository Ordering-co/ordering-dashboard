import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { translateApiMessage } from '../../utils/translateApiMessage'

// The first message of an API error: a string, a list of strings or of { message }.
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

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

  const [languageFiledsState, setLanguageFiledsState] = useState({ fields: [], loading: false, error: null, revisions: {} })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  // a save that fails says why and tells the UI to put that field's switch back (its revision changes).
  const handleSaveError = (fieldId, apiError) => {
    const message = apiError
      ? translateApiMessage(t, firstMessage(apiError), t('LANGUAGE_CHANGE_FAILED', "We couldn't save the language change. Try again."))
      : t('LANGUAGE_CHANGE_FAILED', "We couldn't save the language change. Try again.")
    showToast(ToastType.Error, message)
    setLanguageFiledsState(prev => ({
      ...prev,
      revisions: { ...prev.revisions, [fieldId]: (prev.revisions?.[fieldId] || 0) + 1 }
    }))
  }

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
        // redesign (D4, M-02): saving a new default clears the mark on the other languages.
        const fields = languageFiledsState.fields.map(field => {
          if (field.id === fieldId) return { ...field, ...result }
          return changes?.default === true ? { ...field, default: false } : field
        })
        setLanguageFiledsState(prev => ({ ...prev, fields }))
        updateLanguageListState(result)
      } else {
        setActionState({ loading: false, error: result })
        handleSaveError(fieldId, result)
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
      handleSaveError(fieldId, null)
    }
  }

  useEffect(() => {
    if (languageState.loading) return
    setLanguageFiledsState(prev => ({
      ...prev,
      loading: false,
      fields: languageState.languageList
    }))
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
