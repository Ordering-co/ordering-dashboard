import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useEvent } from '../../contexts/EventContext'

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

  const handleSaveTax = async (id, action) => {
    let result
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    if (id) {
      const response = await fetch(`${ordering.root}/${action}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.auth}`
        },
        body: JSON.stringify({
          ...formTaxChanges,
          ...(action === 'taxes' ? { target: 'product' } : {})
        })
      })
      const { result: data } = await response.json()
      result = data
      if (action === 'taxes') {
        setTaxes({
          ...taxes,
          [`id:${data.id}`]: {
            name: data.name,
            description: data.description,
            id: data.id,
            rate: data.rate,
            type: data.type,
            recipient: data.recipient,
            apply_to_fees: data.apply_to_fees,
            order_type_rates: data.order_type_rates || null
          }
        })
        events.emit('tax_changed', {
          tax: {
            name: data.name,
            description: data.description,
            id: data.id,
            rate: data.rate,
            type: data.type,
            recipient: data.recipient,
            apply_to_fees: data.apply_to_fees,
            order_type_rates: data.order_type_rates || null
          }
        })
        showToast(ToastType.Success, t('PRODUCT_TAX_SAVED', 'Product tax saved'))
      } else {
        setFees({
          ...fees,
          [`id:${data.id}`]: {
            name: data.name,
            description: data.description,
            id: data.id,
            fixed: data.fixed,
            percentage: data.percentage,
            taxable: data.taxable,
            recipient: data.recipient,
            target: data.target
          }
        })
        events.emit('fee_changed', {
          fee: {
            name: data.name,
            description: data.description,
            id: data.id,
            fixed: data.fixed,
            percentage: data.percentage,
            taxable: data.taxable,
            recipient: data.recipient,
            target: data.target
          }
        })
        showToast(ToastType.Success, t('PRODUCT_FEE_SAVED', 'Product fee saved'))
      }
    } else {
      const response = await fetch(`${ordering.root}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.auth}`
        },
        body: JSON.stringify({
          ...formTaxChanges,
          ...(action === 'taxes' ? { target: 'product' } : {})
        })
      })
      const { result: data } = await response.json()
      if (action === 'taxes') {
        setTaxes({
          ...taxes,
          [`id:${data.id}`]: {
            name: data.name,
            description: data.description,
            id: data.id,
            rate: data.rate,
            type: data.type,
            recipient: data.recipient,
            apply_to_fees: data.apply_to_fees,
            order_type_rates: data.order_type_rates || null
          }
        })
        showToast(ToastType.Success, t('PRODUCT_TAX_SAVED', 'Product tax saved'))
      } else {
        setFees({
          ...fees,
          [`id:${data.id}`]: {
            name: data.name,
            description: data.description,
            id: data.id,
            fixed: data.fixed,
            percentage: data.percentage,
            taxable: data.taxable,
            recipient: data.recipient,
            target: data.target
          }
        })
        showToast(ToastType.Success, t('PRODUCT_FEE_SAVED', 'Product fee saved'))
      }
    }
    if (result?.error) return
    setTaxToEdit({ action: null, payload: null })
  }

  const handleDeleteTax = async (id, action) => {
    setFormTaxState({
      ...formTaxState,
      loading: true
    })
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    if (id) {
      const response = await fetch(`${ordering.root}/${action}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.auth}`
        }
      })
      const { error } = await response.json()
      if (!error) {
        if (action === 'taxes') {
          const newTaxes = taxes
          events.emit('tax_deleted', { tax: newTaxes[`id:${id}`], isRemove: true })
          delete newTaxes[`id:${id}`]
          setTaxes(newTaxes)
          showToast(ToastType.Success, t('PRODUCT_TAX_DELETED', 'Product tax deleted'))
        } else {
          const newFees = fees
          events.emit('fee_deleted', { tax: newFees[`id:${id}`], isRemove: true })
          delete newFees[`id:${id}`]
          setFees(newFees)
          showToast(ToastType.Success, t('PRODUCT_FEE_DELETED', 'Product fee deleted'))
        }
      }
    }
    setFormTaxState({
      ...formTaxState,
      loading: false
    })
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
