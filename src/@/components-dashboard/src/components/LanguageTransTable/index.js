import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { ToastType, useToast } from '../../contexts/ToastContext'

/**
 * Component to manage LanguageTransTable behavior without UI component
 */
export const LanguageTransTable = (props) => {
  const {
    UIComponent,
    getTranslations,
    isShowProductType,
    selectedProductType
  } = props
  const [ordering] = useApi()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: null } })

  /**
   * Method to save Updated new translation key and text
   * @param {string} type translation field name
   * @param {EventTarget} evt Related HTML event
   */
  const handleChangeInput = (type, evt) => {
    setFormState({ ...formState, changes: { ...formState?.changes, [type]: evt.target.value } })
  }

  const handleUpdateClick = () => {
    createTranslation()
  }

  /**
   * Method to update translation from API
   */
  const createTranslation = async () => {
    try {
      setFormState({
        ...formState,
        loading: true
      })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      let changes = {
        key: formState?.changes?.key,
        [isShowProductType ? 'value' : 'text']: formState?.changes?.text ?? formState?.changes?.value
      }
      if (isShowProductType) {
        const productPrefix = selectedProductType.toUpperCase()
        if (!changes.key.startsWith(`${productPrefix}_`)) {
          changes.key = `${productPrefix}_${changes.key}`
        }
        changes = {
          ...changes,
          version: 'v2',
          product: selectedProductType
        }
      }

      const { content: { error, result } } = await ordering.translations().save(changes)
      if (!error) {
        setFormState({
          ...formState,
          loading: false,
          changes: {},
          result: {
            error: false,
            result
          }
        })
        getTranslations && getTranslations()
        showToast(ToastType.Success, t('WEB_APP_LANG_ADDED', 'Language item added'))
      } else {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: true,
            result
          }
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        result: {
          error: true,
          result: err
        }
      })
    }
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          creationFormState={formState}
          handleChangeInput={handleChangeInput}
          handleUpdateClick={handleUpdateClick}
        />
      )}
    </>
  )
}

LanguageTransTable.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Function to get translation list
   */
  getTranslations: PropTypes.func
}
