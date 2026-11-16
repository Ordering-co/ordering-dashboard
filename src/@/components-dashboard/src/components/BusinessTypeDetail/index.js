import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const BusinessTypeDetail = (props) => {
  const {
    UIComponent,
    setBusinessTypes,
    businessTypes
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [businessTypeState, setBusinessTypeState] = useState({ businessType: props.businessType ?? null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })

  /**
   * Update business type image data
   * @param {File} file Image to change business type image
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
   * Update business type field data
   */
  const handleChangeItem = (name, value) => {
    const currentChanges = { ...formState?.changes, [name]: value }
    setFormState({ ...formState, changes: currentChanges })
  }

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        [e.target.name]: e.target.value
      }
    })
  }

  /**
   * Method to update the product business type from API
   * redesign stores 5.2: the three requests answer `{ ok: true, result? }` or `{ ok: false, error }`, so the form can keep
   * the user when a save fails (the leave guard reads it)
   */
  const handleUpdateProductType = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({
        ...formState,
        loading: true
      })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState.changes)
      }
      const response = await fetch(`${ordering.root}/business_types/${businessTypeState?.businessType?.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setBusinessTypeState({ businessType: { ...businessTypeState.businessType, ...content.result } })
        setFormState({
          loading: false,
          changes: {},
          error: null
        })
        if (setBusinessTypes) {
          // redesign stores 5.2: the type that was saved is the open one, whether or not the answer repeats its id
          const savedId = content?.result?.id ?? businessTypeState?.businessType?.id
          const updatedBusinessTypes = businessTypes.map(type => {
            if (type.id === savedId) {
              return { ...type, ...content?.result }
            }
            return type
          })
          setBusinessTypes(updatedBusinessTypes)
        }
        showToast(ToastType.Success, t('CATEGORY_UPDATED', 'Category updated'))
        return { ok: true, result: content.result }
      }
      setFormState({
        ...formState,
        loading: false,
        error: content.result
      })
      return { ok: false, error: content.result }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Method to add the pbusiness type from API
   */
  const handleAddProductType = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({
        ...formState,
        loading: true
      })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState.changes)
      }
      const response = await fetch(`${ordering.root}/business_types`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({
          loading: false,
          changes: {},
          error: null
        })
        if (setBusinessTypes) {
          setBusinessTypes([...businessTypes, content.result])
        }
        showToast(ToastType.Success, t('CATEGORY_ADDED', 'Category added'))
        props.onClose && props.onClose()
        return { ok: true, result: content.result }
      }
      setFormState({
        ...formState,
        loading: false,
        error: content.result
      })
      return { ok: false, error: content.result }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * Method to delete the business type from API
   */
  const handleDeleteProductType = async () => {
    // redesign stores 5.2 (G2-09): a type that is not saved yet has nothing to delete (it read `id` of null: TypeError)
    const id = businessTypeState?.businessType?.id
    if (id == null) return { ok: false, error: null }
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({
        ...formState,
        loading: true
      })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business_types/${id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({
          loading: false,
          changes: {},
          error: null
        })
        if (setBusinessTypes) {
          const updatedBusinessTypes = businessTypes.filter(type => type.id !== id)
          setBusinessTypes(updatedBusinessTypes)
        }
        showToast(ToastType.Success, t('CATEGORY_DELETED', 'Category deleted'))
        props.onClose && props.onClose()
        return { ok: true }
      }
      // redesign stores 5.2: the failure of a delete is the confirmation's to say; it is not a form error
      setFormState({ ...formState, loading: false })
      return { ok: false, error: content.result }
    } catch (err) {
      setFormState({ ...formState, loading: false })
      return { ok: false, error: [err.message] }
    }
  }

  /**
   * redesign stores 5.2: drops what was typed or picked and not saved (the form's «Discard»)
   */
  const cleanChanges = () => {
    setFormState({ loading: false, changes: {}, error: null })
  }

  useEffect(() => {
    setFormState({
      loading: false,
      changes: {},
      error: null
    })
    setBusinessTypeState({ businessType: props.businessType ?? null })
  }, [props?.businessType])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessTypeState={businessTypeState}
          typeFormState={formState}
          handleChangeInput={handleChangeInput}
          handlechangeImage={handlechangeImage}
          handleUpdateProductType={handleUpdateProductType}
          handleAddProductType={handleAddProductType}
          handleDeleteProductType={handleDeleteProductType}
          handleChangeItem={handleChangeItem}
          cleanChanges={cleanChanges}
        />
      )}
    </>
  )
}

BusinessTypeDetail.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
