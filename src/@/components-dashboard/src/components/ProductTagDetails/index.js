import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const ProductTagDetails = (props) => {
  const {
    UIComponent,
    handleSuccessUpdate,
    handleSuccessDelete,
    handleSuccessAdd
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [tagState, setTagState] = useState({ tag: props.tag ?? null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })

  /**
   * Update tag image data
   * @param {File} file Image to change tag image
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
   * Update credential data
   * @param {*} changes Field for product tag
   */
  const handleChangeItem = (changes) => {
    const currentChanges = { ...formState?.changes, ...changes }
    setFormState({ ...formState, changes: currentChanges })
  }

  /**
   * Method to update the product tag from API
   */
  const handleUpdateProductTag = async () => {
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
      const response = await fetch(`${ordering.root}/tags/${tagState.tag.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setTagState({ tag: { ...tagState.tag, ...content.result } })
        setFormState({
          loading: false,
          changes: {},
          error: null
        })
        handleSuccessUpdate && handleSuccessUpdate(content.result)
        showToast(ToastType.Success, t('PRODUCT_TAG_SAVED', 'Product tag saved'))
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to add the product tag from API
   */
  const handleAddProductTag = async () => {
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
      const response = await fetch(`${ordering.root}/tags`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({
          loading: false,
          changes: {},
          error: null
        })
        handleSuccessAdd && handleSuccessAdd(content.result)
        showToast(ToastType.Success, t('PRODUCT_TAG_ADDED', 'Product tag added'))
        props.onClose && props.onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to delete the product tag from API
   */
  const handleDeleteProductTag = async () => {
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
      const response = await fetch(`${ordering.root}/tags/${tagState.tag.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({
          loading: false,
          changes: {},
          error: null
        })
        handleSuccessDelete && handleSuccessDelete(tagState.tag.id)
        showToast(ToastType.Success, t('PRODUCT_TAG_DELETED', 'Product tag deleted'))
        props.onClose && props.onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }

  useEffect(() => {
    setFormState({
      loading: false,
      changes: {},
      error: null
    })
    setTagState({ tag: props.tag ?? null })
  }, [props.tag])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          tagState={tagState}
          formState={formState}
          handleChangeInput={handleChangeInput}
          handlechangeImage={handlechangeImage}
          handleUpdateProductTag={handleUpdateProductTag}
          handleAddProductTag={handleAddProductTag}
          handleDeleteProductTag={handleDeleteProductTag}
          handleChangeItem={handleChangeItem}
        />
      )}
    </>
  )
}

ProductTagDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
