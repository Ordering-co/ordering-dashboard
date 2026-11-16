import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useConfig } from '../../contexts/ConfigContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

// redesign stores 5.14: `createPromotion(body, options)` and `updatePromotion(body, options)` send an explicit body
// and answer `{ ok: true, result }` | `{ ok: false, error }`; they always settle `formState.loading`. `options.inlineError` skips
// every toast and, on create, `handleCloseAddForm` (the UI keeps the created promotion's detail open); without it they toast as
// `handleAddClick` / `handleUpdateClick` do, plus an error toast. The business offers handed to `handleSuccessUpdate` are new
// objects: `business.offers` is never mutated. `handleUpdateClick` / `handleAddClick` keep their behavior.

const readJson = async (response) => {
  try {
    return await response.json()
  } catch (err) {
    return null
  }
}

const failureOf = (response, json) => {
  if (!response.ok || json?.error) return json?.result || response.statusText || `HTTP ${response.status}`
  return null
}

export const BusinessPromotionForm = (props) => {
  const {
    promotion,
    UIComponent,
    business,
    handleCloseAddForm,
    handleSuccessUpdate
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [{ configs }] = useConfig()
  const isAdvancedOffersActivated = configs?.advanced_offers_module?.value

  const [promotionState, setPromotionState] = useState({ promotion, loading: false, error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [isAddMode, setIsAddMode] = useState(false)

  const request = (method, path = '', body) => fetch(`${ordering.root}/business/${business.id}/offers${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  })

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    if (e.target.name === 'coupon' && (formState?.changes?.type === 2 || (!formState?.changes?.type && promotionState?.promotion?.type === 2))) {
      setFormState({
        ...formState,
        changes: { ...formState.changes, coupon: e.target.value.replace(/\s/g, '') }
      })
    } else {
      setFormState({
        ...formState,
        changes: { ...formState.changes, [e.target.name]: e.target.value }
      })
    }
  }

  /**
   * Update business promotion image data
   * @param {File} file Image to change business promotion image
   */
  const handleChangeImage = (file) => {
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
   * Update parameter data
   * @param {changes} changes parameters to change
   */
  const handleChangeItem = (changes) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        ...changes
      }
    })
  }

  /**
   * Default fuction for business profile workflow
   */
  const handleUpdateClick = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, result: {}, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState?.changes)
      }

      const response = await fetch(`${ordering.root}/business/${business.id}/offers/${promotion.id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setPromotionState({
          ...promotionState,
          promotion: content.result
        })
        setFormState({ ...formState, loading: false, changes: {} })
        showToast(ToastType.Success, t('PROMOTION_SAVED', 'Promotion saved'))
        if (handleSuccessUpdate) {
          // redesign stores 5.14: no `Object.assign` on `business.offers` (the same objects the parent renders)
          const _promotions = (business?.offers || []).map(offer => offer.id === promotion.id ? { ...offer, ...content.result } : offer)

          handleSuccessUpdate({ ...business, offers: _promotions })
        }
      } else {
        setFormState({
          ...formState,
          result: {
            error: true,
            result: content.result
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
   * Method to add the new business promotion
   */
  const handleAddClick = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, result: {}, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState?.changes)
      }

      const response = await fetch(`${ordering.root}/business/${business.id}/offers`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        showToast(ToastType.Success, t('PROMOTION_ADDED', 'Promotion added'))
        handleCloseAddForm && handleCloseAddForm()
        if (handleSuccessUpdate) {
          handleSuccessUpdate({ ...business, offers: [...business.offers, content.result] })
        }
      } else {
        setFormState({
          ...formState,
          result: {
            error: true,
            result: content.result
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
   * Method to update the promotion with an explicit body
   * @param {Object} body fields to send
   * @param {{ inlineError?: boolean }} options `inlineError: true` skips every toast
   * @returns {Promise<{ ok: true, result } | { ok: false, error }>}
   */
  const updatePromotion = async (body, options = {}) => {
    const inline = options?.inlineError === true
    try {
      if (!inline) showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState(prev => ({ ...prev, result: {}, loading: true }))
      const response = await request('PUT', `/${promotion.id}`, body)
      const content = await readJson(response)
      const error = failureOf(response, content) || (content ? null : 'Invalid response')
      if (error) {
        if (!inline) showToast(ToastType.Error, t('ERROR', 'Error'))
        setFormState(prev => ({ ...prev, result: { error: true, result: error }, loading: false }))
        return { ok: false, error }
      }
      setPromotionState(prev => ({ ...prev, promotion: content.result }))
      setFormState(prev => ({ ...prev, result: { error: false }, loading: false }))
      if (!inline) showToast(ToastType.Success, t('PROMOTION_SAVED', 'Promotion saved'))
      if (handleSuccessUpdate) {
        const _promotions = (business?.offers || []).map(offer => offer.id === promotion.id ? { ...offer, ...content.result } : offer)
        handleSuccessUpdate({ ...business, offers: _promotions })
      }
      return { ok: true, result: content.result }
    } catch (err) {
      if (!inline) showToast(ToastType.Error, t('ERROR', 'Error'))
      setFormState(prev => ({ ...prev, result: { error: true, result: err.message }, loading: false }))
      return { ok: false, error: err.message }
    }
  }

  /**
   * Method to create the promotion with an explicit body. With `inlineError` the add form stays open (the UI keeps the
   * created promotion's detail on screen) and nothing is toasted.
   * @param {Object} body fields to send
   * @param {{ inlineError?: boolean }} options `inlineError: true` skips every toast and `handleCloseAddForm`
   * @returns {Promise<{ ok: true, result } | { ok: false, error }>}
   */
  const createPromotion = async (body, options = {}) => {
    const inline = options?.inlineError === true
    try {
      if (!inline) showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState(prev => ({ ...prev, result: {}, loading: true }))
      const response = await request('POST', '', body)
      const content = await readJson(response)
      const error = failureOf(response, content) || (content ? null : 'Invalid response')
      if (error) {
        if (!inline) showToast(ToastType.Error, t('ERROR', 'Error'))
        setFormState(prev => ({ ...prev, result: { error: true, result: error }, loading: false }))
        return { ok: false, error }
      }
      setFormState(prev => ({ ...prev, result: { error: false }, loading: false }))
      if (!inline) showToast(ToastType.Success, t('PROMOTION_ADDED', 'Promotion added'))
      if (handleSuccessUpdate) {
        handleSuccessUpdate({ ...business, offers: [...(business?.offers || []), content.result] })
      }
      if (!inline) handleCloseAddForm && handleCloseAddForm()
      return { ok: true, result: content.result }
    } catch (err) {
      if (!inline) showToast(ToastType.Error, t('ERROR', 'Error'))
      setFormState(prev => ({ ...prev, result: { error: true, result: err.message }, loading: false }))
      return { ok: false, error: err.message }
    }
  }

  useEffect(() => {
    if (Object.keys(promotion).length === 0) {
      setIsAddMode(true)
      if (isAdvancedOffersActivated) {
        setFormState({
          ...formState,
          changes: {
            type: 2,
            rate_type: 2,
            rate: 0,
            auto: false,
            public: true,
            condition_type: 1,
            target: 1,
            stackable: false,
            sponsor: 'business'
          }
        })
      } else {
        setFormState({
          ...formState,
          changes: {
            type: 2,
            rate_type: 2,
            rate: 0,
            sponsor: 'business'
          }
        })
      }
    } else {
      setFormState({ ...formState, changes: {} })
      setIsAddMode(false)
    }
    setPromotionState({ ...promotionState, promotion })
  }, [promotion])
  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            promotionState={promotionState}
            formState={formState}
            isAddMode={isAddMode}
            handleChangeImage={handleChangeImage}
            handleChangeInput={handleChangeInput}
            handleChangeItem={handleChangeItem}
            handleUpdateClick={handleUpdateClick}
            handleAddClick={handleAddClick}
            createPromotion={createPromotion}
            updatePromotion={updatePromotion}
          />
        )
      }
    </>
  )
}

BusinessPromotionForm.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
