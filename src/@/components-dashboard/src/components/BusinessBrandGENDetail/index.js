import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { ribbonValues } from '../../ui/src/utils'

/**
 * Component to manage BusinessBrandGENDetail behavior without UI component
 */
export const BusinessBrandGENDetail = (props) => {
  const {
    UIComponent,
    brand,
    handleUpdateBrandList,
    onSelectedBrand,
    setPaginationProps
  } = props

  const [ordering] = useApi()
  const [, t] = useLanguage()
  const [, { showToast, hideToast }] = useToast()
  const [{ token }] = useSession()

  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })

  /**
   * Method to update or create a brand
   * redesign SB-B1: returns `{ ok: true }`, `{ ok: false, error: result }` (API error) or
   * `{ ok: false, error: [message] }` (exception). On failure `formState.result` keeps the error (the UI draws it in the save
   * bar) and `changes` are kept.
   */
  const handleUpdateClick = async () => {
    if (brand) {
      return updateBrand()
    }
    return createBrand()
  }

  // redesign SB-B1: a failure keeps the error in `result` (the bar draws it) and the `changes`
  // redesign bugs F row 19: the failure is drawn in the save bar, so the «Loading» toast must not stay
  const handleFailure = (content) => {
    hideToast?.()
    setFormState(prev => ({ ...prev, result: content, loading: false }))
    return { ok: false, error: content?.result }
  }

  const handleException = (err) => {
    hideToast?.()
    setFormState(prev => ({ ...prev, result: { error: true, result: err.message }, loading: false }))
    return { ok: false, error: [err.message] }
  }

  /**
   * Method to create brand from API
   */
  const createBrand = async () => {
    try {
      setFormState(prev => ({ ...prev, loading: true }))
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
      if (content?.error) return handleFailure(content)
      setFormState(prev => ({ ...prev, changes: {}, result: content, loading: false }))
      if (handleUpdateBrandList) {
        handleUpdateBrandList(prevBrands => [...(prevBrands || []), content.result])
      }
      // redesign SB-B1 (M-SB8): the list has one brand more
      setPaginationProps && setPaginationProps(prev => Number.isFinite(prev?.totalItems)
        ? { ...prev, totalItems: prev.totalItems + 1 }
        : prev)
      onSelectedBrand && onSelectedBrand(content.result)
      showToast(ToastType.Success, t('BRAND_ADDED', 'Brand added'))
      return { ok: true }
    } catch (err) {
      return handleException(err)
    }
  }

  /**
   * Function to update brand
   * redesign SB-B1: the saved brand is handed to the detail (`onSelectedBrand`) on update too, not only on create,
   * so the detail shows what was saved.
   */
  const updateResult = (content) => {
    setFormState(prev => ({ ...prev, changes: {}, result: content, loading: false }))
    if (handleUpdateBrandList) {
      handleUpdateBrandList(prevBrands => (prevBrands || []).map(item => {
        if (item.id === content.result.id) {
          return {
            ...item,
            ...content.result
          }
        }
        return item
      }))
    }
    onSelectedBrand && onSelectedBrand({ ...brand, ...content.result })
  }

  /**
   * Method to update a brand
   */
  const updateBrand = async () => {
    try {
      setFormState(prev => ({ ...prev, loading: true }))
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
      if (content?.error) return handleFailure(content)
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
        if (content?.error) return handleFailure(content)
        updateResult(content)
      } else {
        updateResult(content)
      }
      showToast(ToastType.Success, t('BRAND_UPDATED', 'Brand updated'))
      return { ok: true }
    } catch (err) {
      return handleException(err)
    }
  }

  /**
   * redesign SB-B1: throws the unsaved changes (and the last error) away.
   */
  const handleDiscard = () => {
    setFormState(prev => ({ ...prev, changes: {}, result: { error: false } }))
  }

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    const currentChanges = {
      [e.target.name]: e.target.value
    }

    setFormState(prev => ({
      ...prev,
      changes: { ...prev.changes, ...currentChanges }
    }))
  }

  /**
   * Update business brand logo data
   * @param {File} file Image to change business brand logo
   */
  const handlechangeImage = (file, name) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState(prev => ({
        ...prev,
        changes: {
          ...prev.changes,
          [name]: reader.result
        }
      }))
    }
  }

  const handleChangeItem = (changes) => {
    setFormState(prev => ({
      ...prev,
      changes: { ...prev.changes, ...changes }
    }))
  }

  /**
   * Update ribbon data
   * @param {Object} changes Related HTML event
   * redesign SB-B1 (auditor 10): turning the ribbon on seeds what the brand has no value for (color, shape) with the
   * defaults. Turning it off sends `enabled: false` only, as before. redesign bugs C: not the text, which the form
   * asks for (the default «ribbon» reached the customers).
   */
  const handleChangeRibbon = (changes) => {
    setFormState(prev => {
      const pending = prev.changes?.ribbon
      let ribbonChanges = pending ? { ...pending, ...changes } : { ...changes }
      if (changes?.enabled === true) {
        const seeded = {}
        for (const key of ['color', 'shape']) {
          const has = (value) => typeof value !== 'undefined' && value !== null
          if (!has(brand?.ribbon?.[key]) && !has(ribbonChanges[key])) seeded[key] = ribbonValues[key]
        }
        ribbonChanges = { ...seeded, ...ribbonChanges }
      }
      return { ...prev, changes: { ...prev.changes, ribbon: ribbonChanges } }
    })
  }

  useEffect(() => {
    setFormState(prev => ({ ...prev, changes: {} }))
  }, [brand?.id])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          brandFormState={formState}
          handleUpdateClick={handleUpdateClick}
          handleDiscard={handleDiscard}
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
  onSelectedBrand: PropTypes.func,
  /**
   * Setter of the list controller's pagination (a created brand adds one to `totalItems`)
   */
  setPaginationProps: PropTypes.func
}
