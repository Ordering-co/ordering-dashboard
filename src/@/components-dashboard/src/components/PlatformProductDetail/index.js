import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

/**
 * redesign GC-A (GC-A7): `price` travels as a number when the form holds a numeric text (the input gives a string)
 */
const withNumericPrice = (body) => {
  if (typeof body?.price !== 'string') return body
  const text = body.price.trim()
  if (text === '' || !Number.isFinite(Number(text))) return body
  return { ...body, price: Number(text) }
}

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
  // redesign bugs F row 19: every failure branch below hides the «Loading» toast (`hideToast`); the caller shows the
  // failure (the editor's foot error or the switch, or `formState.error` when not silent)
  const [, { showToast, hideToast }] = useToast()
  const [, t] = useLanguage()
  const [formState, setFormState] = useState({ loading: false, error: null, changes: {} })

  /**
   * Update product data
   * @param {EventTarget} evt Related HTML event
   */
  const handleChangeInput = (evt) => {
    // redesign GC-A: functional form everywhere, so two updates in the same tick do not overwrite each other
    const { name, value } = evt.target
    setFormState(prev => ({ ...prev, changes: { ...prev.changes, [name]: value } }))
  }

  /**
   * Update product image data
   * @param {File} file Image to change gift card image
   */
  const handlechangeImage = (file) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState(prev => ({
        ...prev,
        changes: {
          ...prev.changes,
          image: reader.result
        }
      }))
    }
  }

  /**
   * Update product data
   * @param {object} changes Related HTML event
   */
  const handleChangeItem = (changes) => {
    setFormState(prev => ({ ...prev, changes: { ...prev.changes, ...changes } }))
  }

  /**
   * Default fuction to delete a product
   */
  const handleDeleteProduct = async (options) => {
    // redesign GC-A (GC-A7): returns { ok, result | error }; `{ silent: true }` leaves formState.error to the caller.
    // This can be a click handler, so anything that is not `{ silent: true }` (an event) is not silent.
    const silent = options?.silent === true
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState(prev => ({ ...prev, loading: true }))
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
        setFormState(prev => ({ ...prev, loading: false, error: null, changes: {} }))
        handleSuccessDeleteProduct(product?.id)
        onClose && onClose()
        return { ok: true, result }
      }
      hideToast?.()
      setFormState(prev => ({ ...prev, loading: false, ...(silent ? {} : { error: result }) }))
      return { ok: false, error: result }
    } catch (error) {
      hideToast?.()
      setFormState(prev => ({ ...prev, loading: false, ...(silent ? {} : { error: error.message }) }))
      return { ok: false, error: [error.message] }
    }
  }

  /**
   * Function to update a product
   */
  const handleUpdateProduct = async (payload, options) => {
    // redesign GC-A (GC-A7): returns { ok, result | error }. A `payload` (the switch) saves only that and keeps the unsaved
    // form changes. `{ silent: true }` leaves formState.error to the caller.
    const silent = options?.silent === true
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState(prev => ({ ...prev, loading: true }))
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
        body: JSON.stringify(withNumericPrice(changes))
      }
      const response = await fetch(`${ordering.root}/platform_products/${product?.id}`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setFormState(prev => ({ ...prev, changes: payload ? prev.changes : {}, loading: false, error: null }))
        handleSuccessUpdateProduct(result)
        setSelectedProduct && setSelectedProduct(result)
        showToast(ToastType.Success, t('GIFT_CARD_UPDATED', 'Gift card updated'))
        return { ok: true, result }
      }
      hideToast?.()
      setFormState(prev => ({ ...prev, loading: false, ...(silent ? {} : { error: result }) }))
      return { ok: false, error: result }
    } catch (error) {
      hideToast?.()
      setFormState(prev => ({ ...prev, loading: false, ...(silent ? {} : { error: error.message }) }))
      return { ok: false, error: [error.message] }
    }
  }

  /**
   * Default fuction to add a product
   */
  const handleAddProduct = async (type, options) => {
    // redesign GC-A (GC-A7): returns { ok, result | error }; `{ silent: true }` leaves formState.error to the caller
    const silent = options?.silent === true
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState(prev => ({ ...prev, loading: true }))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(withNumericPrice({ ...formState.changes, type }))
      }
      const fetchEndpoint = `${ordering.root}/platform_products`
      const response = await fetch(fetchEndpoint, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('GIFT_CARD_ADDED', 'Gift card added'))
        setFormState(prev => ({ ...prev, loading: false, error: null, changes: {} }))
        handleSuccessAddProduct(result)
        onClose && onClose()
        return { ok: true, result }
      }
      hideToast?.()
      setFormState(prev => ({ ...prev, loading: false, ...(silent ? {} : { error: result }) }))
      return { ok: false, error: result }
    } catch (error) {
      hideToast?.()
      setFormState(prev => ({ ...prev, loading: false, ...(silent ? {} : { error: error.message }) }))
      return { ok: false, error: [error.message] }
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
