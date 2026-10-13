import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const PlatformProductDetail = (props) => {
  const {
    UIComponent,
    handleSuccessDeleteProduct,
    handleSuccessUpdateProduct,
    handleSuccessAddProduct,
    product,
    setSelectedProduct,
    onClose
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [formState, setFormState] = useState({ loading: false, error: null, changes: {} })

  /**
   * Update product data
   * @param {EventTarget} evt Related HTML event
   */
  const handleChangeInput = (evt) => {
    const changes = { ...formState?.changes, [evt.target.name]: evt.target.value }
    setFormState({ ...formState, changes })
  }

  /**
   * Update product image data
   * @param {File} file Image to change gift card image
   */
  const handlechangeImage = (file) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          image: reader.result
        }
      })
    }
  }

  /**
   * Update product data
   * @param {object} changes Related HTML event
   */
  const handleChangeItem = (changes) => {
    const currentChanges = { ...formState?.changes, ...changes }
    setFormState({ ...formState, changes: currentChanges })
  }

  /**
   * Default fuction to delete a product
   */
  const handleDeleteProduct = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const fetchEndpoint = `${ordering.root}/platform_products/${product?.id}`
      const response = await fetch(fetchEndpoint, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('GIFT_CARD_DELETED', 'Gift card deleted'))
        setFormState({ ...formState, loading: false, error: null, changes: {} })
        handleSuccessDeleteProduct(product?.id)
        onClose && onClose()
      } else {
        setFormState({ ...formState, loading: false, error: result })
      }
    } catch (error) {
      setFormState({ ...formState, loading: false, error: error.message })
    }
  }

  /**
   * Function to update a product
   */
  const handleUpdateProduct = async (payload) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      let changes
      if (payload) {
        changes = payload
      } else {
        changes = { ...formState?.changes }
        for (const key in changes) {
          if (!changes?.name && changes[key] === '') {
            changes[key] = null
          }
        }
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/platform_products/${product?.id}`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setFormState({ changes: {}, loading: false, error: null })
        handleSuccessUpdateProduct(result)
        setSelectedProduct(result)
        showToast(ToastType.Success, t('GIFT_CARD_UPDATED', 'Gift card updated'))
      } else {
        setFormState({ ...formState, loading: false, error: result })
      }
    } catch (error) {
      setFormState({ ...formState, loading: false, error: error.message })
    }
  }

  /**
   * Default fuction to add a product
   */
  const handleAddProduct = async (type) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...formState.changes, type })
      }
      const fetchEndpoint = `${ordering.root}/platform_products`
      const response = await fetch(fetchEndpoint, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('GIFT_CARD_ADDED', 'Gift card added'))
        setFormState({ ...formState, loading: false, error: null, changes: {} })
        handleSuccessAddProduct(result)
        onClose && onClose()
      } else {
        setFormState({ ...formState, loading: false, error: result })
      }
    } catch (error) {
      setFormState({ ...formState, loading: false, error: error.message })
    }
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          handleChangeInput={handleChangeInput}
          handleChangeItem={handleChangeItem}
          handlechangeImage={handlechangeImage}
          handleDeleteProduct={handleDeleteProduct}
          handleUpdateProduct={handleUpdateProduct}
          handleAddProduct={handleAddProduct}
        />
      )}
    </>
  )
}

PlatformProductDetail.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
