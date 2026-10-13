import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useValidationFields } from '../../contexts/ValidationsFieldsContext'

/**
 * Component to manage card field behavior without UI component
 */
export const CardFieldsSetting = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [, { loadValidationFields }] = useValidationFields()

  const [cardFieldsState, setCardFieldsState] = useState({ fields: [], loading: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  /**
   * Method to get the card fields from API
   */
  const getCardFields = async () => {
    try {
      setCardFieldsState({ ...cardFieldsState, loading: true })
      const conditons = [
        {
          attribute: 'validate',
          value: 'card'
        }
      ]
      const { content: { result, error } } = await ordering.validationFields().where(conditons).get()
      if (!error) {
        setCardFieldsState({ fields: result, loading: false })
      }
    } catch (err) {
      setCardFieldsState({ ...cardFieldsState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to update the card fields setting from API
   * @param {Number} fieldId selected field id
   * @param {Object} changes changes
   */
  const handleChangeFieldSetting = async (fieldId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const { content: { result, error } } = await ordering.validationFields(fieldId).save(changes)

      if (!error) {
        setActionState({ loading: false, error: null })
        showToast(ToastType.Success, t('FIELD_SAVED', 'Field saved'))
        const fields = cardFieldsState.fields.filter(field => {
          if (field.id === fieldId) {
            Object.assign(field, result)
          }
          return true
        })
        setCardFieldsState({ ...cardFieldsState, fields })
        loadValidationFields && loadValidationFields()
      } else {
        setActionState({ loading: false, error: result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    getCardFields()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          cardFieldsState={cardFieldsState}
          handleChangeFieldSetting={handleChangeFieldSetting}
        />
      )}
    </>
  )
}

CardFieldsSetting.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
