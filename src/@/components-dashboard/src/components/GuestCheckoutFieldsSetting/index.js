import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const GuestCheckoutFieldsSetting = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [checkoutFieldsState, setCheckoutFieldsState] = useState({ fields: [], loading: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  const getValidationFieldOrderTypes = async () => {
    try {
      setCheckoutFieldsState({ ...checkoutFieldsState, loading: true })

      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/validation_field_order_types`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        setCheckoutFieldsState({ fields: content?.result, loading: false })
      }
    } catch (err) {
      setCheckoutFieldsState({ ...checkoutFieldsState, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to update the checkout fields setting from API
   * @param {Number} fieldId selected field id
   * @param {Number} orderTypeId order type id
   * @param {Object} changes changes
   */
  const handleChangeCheckoutFieldSetting = async (fieldId, orderTypeId, changes) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/validationfields/${fieldId}/order_types/${orderTypeId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ loading: false, error: null })
        showToast(ToastType.Success, t('FIELD_SAVED', 'Field saved'))
        const fields = checkoutFieldsState.fields.map(field => {
          if (field.order_type_id === orderTypeId && field.validation_field_id === fieldId) {
            return {
              ...field,
              ...changes
            }
          }
          return field
        })
        setCheckoutFieldsState({ ...checkoutFieldsState, fields })
      } else {
        setActionState({ loading: false, error: content.result })
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    getValidationFieldOrderTypes()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          checkoutFieldsState={checkoutFieldsState}
          handleChangeCheckoutFieldSetting={handleChangeCheckoutFieldSetting}
          setCheckoutFieldsState={setCheckoutFieldsState}
        />
      )}
    </>
  )
}

GuestCheckoutFieldsSetting.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
