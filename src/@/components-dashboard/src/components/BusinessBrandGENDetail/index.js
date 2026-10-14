import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

/**
 * Component to manage BusinessBrandGENDetail behavior without UI component
 */
export const BusinessBrandGENDetail = (props) => {
  const {
    UIComponent,
    brand,
    handleUpdateBrandList,
    brandListState,
    onSelectedBrand
  } = props

  const [ordering] = useApi()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ token }] = useSession()

  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })

  /**
   * Method to update or create a brand
   */
  const handleUpdateClick = async () => {
    if (brand) {
      updateBrand()
    } else {
      createBrand()
    }
  }

  /**
   * Method to create brand from API
   */
  const createBrand = async () => {
    try {
      setFormState({ ...formState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const changes = { ...formState?.changes }
      if (typeof changes?.ribbon !== 'undefined' && !changes?.ribbon?.enabled) delete changes.ribbon
      for (const key in changes) {
        if ((typeof changes[key] === 'object' && changes[key] !== null) || Array.isArray(changes[key])) {
          changes[key] = JSON.stringify(changes[key])
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
      const response = await fetch(`${ordering.root}/franchises`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        setFormState({
          ...formState,
          changes: {},
          result: content,
          loading: false
        })
        if (handleUpdateBrandList) {
          handleUpdateBrandList([...brandListState?.brands, content.result])
        }
        onSelectedBrand && onSelectedBrand(content.result)
        showToast(ToastType.Success, t('BRAND_ADDED', 'Brand added'))
      } else {
        setFormState({
          ...formState,
          changes: formState.changes,
          result: content,
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
   * Function to update brand
   */
  const updateResult = (content) => {
    setFormState({
      ...formState,
      changes: {},
      result: content,
      loading: false
    })
    if (handleUpdateBrandList) {
      const _brands = brandListState?.brands.map(item => {
        if (item.id === content.result.id) {
          return {
            ...item,
            ...content.result
          }
        }
        return item
      })
      handleUpdateBrandList(_brands)
    }
    onSelectedBrand && onSelectedBrand({ ...brand, ...content.result })
  }

  /**
   * Method to update a brand
   */
  const updateBrand = async () => {
    try {
      setFormState({ ...formState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const changes = { ...formState?.changes }
      for (const key in changes) {
        if ((typeof changes[key] === 'object' && changes[key] !== null) || Array.isArray(changes[key])) {
          changes[key] = JSON.stringify(changes[key])
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
      const response = await fetch(`${ordering.root}/franchises/${brand?.id}`, requestOptions)
      const content = await response.json()
      if (!content?.error) {
        if ((typeof formState.changes?.ribbon?.enabled) !== 'undefined' && !formState.changes?.ribbon?.enabled && content?.result?.ribbon?.enabled) {
          const updatedChanges = { ribbon: JSON.stringify({ enabled: false }) }
          const Options = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(updatedChanges)
          }
          const response = await fetch(`${ordering.root}/franchises/${brand?.id}`, Options)
          const content = await response.json()
          updateResult(content)
        } else {
          updateResult(content)
        }
        showToast(ToastType.Success, t('BRAND_UPDATED', 'Brand updated'))
      } else {
        setFormState({
          ...formState,
          changes: formState.changes,
          result: content,
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
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    const currentChanges = {
      [e.target.name]: e.target.value
    }

    setFormState({
      ...formState,
      changes: { ...formState.changes, ...currentChanges }
    })
  }

  /**
   * Update business brand logo data
   * @param {File} file Image to change business brand logo
   */
  const handlechangeImage = (file, name) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          [name]: reader.result
        }
      })
    }
  }

  const handleChangeItem = (changes) => {
    const currentChanges = { ...formState?.changes, ...changes }
    setFormState({
      ...formState,
      changes: currentChanges
    })
  }

  /**
   * Update ribbon data
   * @param {Object} changes Related HTML event
   */
  const handleChangeRibbon = (changes) => {
    const ribbonChanges = formState?.changes?.ribbon
      ? { ...formState?.changes?.ribbon, ...changes }
      : { ...changes }
    const currentChanges = { ...formState?.changes, ribbon: ribbonChanges }
    setFormState({
      ...formState,
      changes: currentChanges
    })
  }

  useEffect(() => {
    setFormState({
      ...formState,
      changes: {}
    })
  }, [brand?.id])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          brandFormState={formState}
          handleUpdateClick={handleUpdateClick}
          handleChangeInput={handleChangeInput}
          handlechangeImage={handlechangeImage}
          handleChangeItem={handleChangeItem}
          handleChangeRibbon={handleChangeRibbon}
        />
      )}
    </>
  )
}

BusinessBrandGENDetail.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Object for a brand
   */
  brand: PropTypes.object,
  /**
   * Object for brand list
   */
  brandListState: PropTypes.object,
  /**
  * Function to set a business state
  */
  handleUpdateBrandList: PropTypes.func,
  /**
   * Function to set selected brand
   */
  onSelectedBrand: PropTypes.func
}
