import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useEvent } from '../../contexts/EventContext'
import { translateApiMessage } from '../../utils/translateApiMessage'

// The first message of an API error: a string, a list of strings or of { message } (as BusinessDetails reads it).
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

/**
 * Component to manage product properties behavior without UI component
 */
export const ProductDetailsAdvanced = (props) => {
  const {
    business,
    UIComponent,
    product,
    handleSuccessUpdate,
    setFormTaxState,
    formTaxState,
    taxes,
    setTaxes,
    fees,
    setFees
  } = props
  const [ordering] = useApi()
  const [session] = useSession()
  const [events] = useEvent()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [productState, setProductState] = useState(product)
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [formTaxChanges, setFormTaxChanges] = useState({})
  const [taxToEdit, setTaxToEdit] = useState({ action: null, payload: null })
  const [alertState, setAlertState] = useState({ open: false, content: [] })

  /**
   * Method to update the product details from API
   */
  const handleUpdateClick = async (params) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const changes = params ? { ...params } : { ...formState.changes }

      let error
      let result
      if (Array.isArray(changes.taxes)) {
        const { tax_id: _taxId, ...payload } = changes
        const response = await fetch(
          `${ordering.root}/business/${business?.id}/categories/${productState?.category_id}/products/${productState?.id}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.token}`
            },
            body: JSON.stringify(payload)
          }
        )
        const content = await response.json()
        error = content.error
        result = content.result
      } else {
        const { content: { error: sdkError, result: sdkResult } } = await ordering
          .businesses(business?.id)
          .categories(productState?.category_id)
          .products(productState?.id)
          .save(changes, { accessToken: session.token })
        error = sdkError
        result = sdkResult
      }

      if (!error) {
        setProductState({ ...productState, ...result })
        setFormState({ ...formState, loading: false, changes: {} })
        handleSuccessUpdate && handleSuccessUpdate(result)
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      } else {
        setFormState({
          ...formState,
          result: {
            error: true,
            result
          },
          loading: false
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    }
  }

  /**
   * Method to change the product peroperty
   */
  const handleClickProperty = (key, value) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        [key]: value
      }
    })
  }

  const handleClickProperties = (changes) => {
    const newChanges = {
      ...formState.changes,
      ...changes
    }
    if (Array.isArray(newChanges.taxes)) {
      delete newChanges.tax_id
    }
    setFormState({
      ...formState,
      changes: newChanges
    })
  }

  const handleChangeTax = (name, value, orderType) => {
    if (value === null) {
      const _formTaxChanges = { ...formTaxChanges }
      delete _formTaxChanges.order_type_rates
      setFormTaxChanges(_formTaxChanges)
      return
    }
    if (orderType) {
      setFormTaxChanges((prev) => ({
        ...prev,
        order_type_rates: {
          ...prev.order_type_rates,
          [orderType]: {
            ...prev.order_type_rates?.[orderType],
            [name]: parseFloat(value)
          }
        }
      }))
    } else {
      setFormTaxChanges((prev) => ({
        ...prev,
        [name]: value
      }))
    }
  }

  // bugs E row 13: a failed save or delete says why, in the place of the «Loading» toast (as the store editor does since
  // G4-10). The API sends its reason as text (translated by its slug) or nothing; then the generic text.
  const showTaxError = (error) => {
    showToast(ToastType.Error, translateApiMessage(t, firstMessage(error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
  }

  const taxRecord = (data) => ({
    name: data.name,
    description: data.description,
    id: data.id,
    rate: data.rate,
    type: data.type,
    recipient: data.recipient,
    apply_to_fees: data.apply_to_fees,
    order_type_rates: data.order_type_rates || null
  })

  const feeRecord = (data) => ({
    name: data.name,
    description: data.description,
    id: data.id,
    fixed: data.fixed,
    percentage: data.percentage,
    taxable: data.taxable,
    recipient: data.recipient,
    target: data.target
  })

  /**
   * Creates (no id, POST) or edits (PUT) a product tax or fee.
   * @returns {Promise<{ok: boolean, result?: object, error?: *}>} bugs E row 13: `{ ok: true, result }` once saved;
   * `{ ok: false, error }` on an API error or an exception, after the error toast. EditTaxManager stays open on `{ ok: false }`.
   */
  const handleSaveTax = async (id, action) => {
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    try {
      const response = await fetch(id ? `${ordering.root}/${action}/${id}` : `${ordering.root}/${action}`, {
        method: id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.auth}`
        },
        body: JSON.stringify({
          ...formTaxChanges,
          ...(action === 'taxes' ? { target: 'product' } : {})
        })
      })
      const { error, result: data } = await response.json()
      if (error || !data?.id) {
        showTaxError(data)
        return { ok: false, error: data }
      }
      if (action === 'taxes') {
        const tax = taxRecord(data)
        setTaxes({ ...taxes, [`id:${data.id}`]: tax })
        if (id) events.emit('tax_changed', { tax })
        showToast(ToastType.Success, t('PRODUCT_TAX_SAVED', 'Product tax saved'))
      } else {
        const fee = feeRecord(data)
        setFees({ ...fees, [`id:${data.id}`]: fee })
        if (id) events.emit('fee_changed', { fee })
        showToast(ToastType.Success, t('PRODUCT_FEE_SAVED', 'Product fee saved'))
      }
      setTaxToEdit({ action: null, payload: null })
      return { ok: true, result: data }
    } catch (err) {
      showTaxError() // an exception's text («Failed to fetch», «Invalid response») is not for the user: the generic text
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Deletes a product tax or fee.
   * @returns {Promise<{ok: boolean, error?: *}>} bugs E row 13: a refused or failed delete says why and keeps the record.
   * It builds a new object without the key (it mutated the list in place) and `fee_deleted` carries `{ fee }`, the shape its listener
   * reads (it carried `{ tax }`, D9).
   */
  const handleDeleteTax = async (id, action) => {
    if (!id) return { ok: false }
    setFormTaxState(prev => ({ ...prev, loading: true }))
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    try {
      const response = await fetch(`${ordering.root}/${action}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.auth}`
        }
      })
      const { error, result } = await response.json()
      if (error) {
        showTaxError(result)
        return { ok: false, error: result }
      }
      const key = `id:${id}`
      const without = (list) => {
        const next = { ...list }
        delete next[key]
        return next
      }
      if (action === 'taxes') {
        events.emit('tax_deleted', { tax: taxes[key], isRemove: true })
        setTaxes(without)
        showToast(ToastType.Success, t('PRODUCT_TAX_DELETED', 'Product tax deleted'))
      } else {
        events.emit('fee_deleted', { fee: fees[key], isRemove: true })
        setFees(without)
        showToast(ToastType.Success, t('PRODUCT_FEE_DELETED', 'Product fee deleted'))
      }
      return { ok: true }
    } catch (err) {
      showTaxError() // an exception's text («Failed to fetch», «Invalid response») is not for the user: the generic text
      return { ok: false, error: [err.message] }
    } finally {
      setFormTaxState(prev => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    setProductState(product)
  }, [product])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          productState={productState}
          taxes={taxes}
          fees={fees}
          formTaxState={formTaxState}
          taxToEdit={taxToEdit}
          alertState={alertState}
          setAlertState={setAlertState}
          formState={formState}
          handleClickProperty={handleClickProperty}
          handleClickProperties={handleClickProperties}
          handleChangeTax={handleChangeTax}
          setTaxToEdit={setTaxToEdit}
          handleSaveTax={handleSaveTax}
          handleDeleteTax={handleDeleteTax}
          handleUpdateClick={handleUpdateClick}
          formTaxChanges={formTaxChanges}
          setFormTaxChanges={setFormTaxChanges}
        />
      )}
    </>
  )
}

ProductDetailsAdvanced.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
