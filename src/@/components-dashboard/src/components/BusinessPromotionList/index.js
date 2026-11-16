import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

// redesign stores 5.14 (G4-16): contract of the promotion list controller. `promotionListState` is `{ promotions,
// loading, error }`: the GET only runs without the `promotions` prop, `loading` starts true when it will run, and a failed GET
// (error:true, non-ok, throw) leaves `promotions: []` plus the error instead of looking like an empty list. `reloadPromotions()`
// repeats it. Toggle / delete answer `{ ok: true, result }` | `{ ok: false, error }`, always settle `actionState.loading`, leave
// the list alone on failure and update it without mutating the promotions they receive (they are also `business.offers`).
// `options.inlineError` skips every toast ("Loading", success and error: the UI shows the result inline). Without it the toasts
// are the old ones plus an error toast, so a failure no longer leaves "Loading" on screen.

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

export const BusinessPromotionList = (props) => {
  const {
    business,
    businessId,
    promotions,
    UIComponent,
    handleSuccessUpdate
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()

  /**
   * Promotion list: { promotions, loading, error }
   */
  const [promotionListState, setPromotionListState] = useState({
    promotions: Array.isArray(promotions) ? promotions : [],
    loading: !Array.isArray(promotions),
    error: null
  })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [isSuccessDeleted, setIsSuccessDeleted] = useState(false)
  const lastRequest = useRef(0)
  // the list as it is now: two switches pressed one after the other must both land, so each write starts from the latest list
  const latestPromotions = useRef(promotionListState.promotions)
  latestPromotions.current = promotionListState.promotions

  const request = (method, path = '', body) => fetch(`${ordering.root}/business/${businessId}/offers${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })

  /**
   * Method to get the business promotions from API
   */
  const getBusinessesPromotions = async () => {
    const requestId = ++lastRequest.current
    setPromotionListState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await request('GET')
      const content = await readJson(response)
      if (requestId !== lastRequest.current) return
      const error = failureOf(response, content) || (content ? null : 'Invalid response')
      if (error) {
        setPromotionListState({ promotions: [], loading: false, error })
        return
      }
      setPromotionListState({ promotions: Array.isArray(content.result) ? content.result : [], loading: false, error: null })
    } catch (err) {
      if (requestId !== lastRequest.current) return
      setPromotionListState({ promotions: [], loading: false, error: err.message })
    }
  }

  /**
   * Method to control the business promotion enabled state
   * @param {Boolean} enabled new enabled state
   * @param {Number} promotionId promotion id
   * @param {{ inlineError?: boolean }} options `inlineError: true` skips every toast
   * @returns {Promise<{ ok: true, result } | { ok: false, error }>}
   */
  const handleChangePromotionActiveState = async (enabled, promotionId, options = {}) => {
    const inline = options?.inlineError === true
    try {
      if (!inline) showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState(prev => ({ ...prev, loading: true }))
      const response = await request('PUT', `/${promotionId}`, { enabled })
      const content = await readJson(response)
      const error = failureOf(response, content) || (content ? null : 'Invalid response')
      if (error) {
        if (!inline) showToast(ToastType.Error, t('ERROR', 'Error'))
        setActionState({ loading: false, error: inline ? null : error })
        return { ok: false, error }
      }
      const _promotions = latestPromotions.current.map(promotion => promotion.id === promotionId ? { ...promotion, ...content.result } : promotion)
      latestPromotions.current = _promotions
      setPromotionListState(prev => ({ ...prev, promotions: _promotions }))
      setActionState({ loading: false, error: null })
      if (!inline) showToast(ToastType.Success, t('PROMOTION_SAVED', 'Promotion saved'))
      if (handleSuccessUpdate) {
        handleSuccessUpdate({ ...business, offers: _promotions })
      }
      return { ok: true, result: content.result }
    } catch (err) {
      if (!inline) showToast(ToastType.Error, t('ERROR', 'Error'))
      setActionState({ loading: false, error: inline ? null : [err.message] })
      return { ok: false, error: err.message }
    }
  }

  /**
   * Method to delete the business promotion
   * @param {Number} promotionId promotion id
   * @param {{ inlineError?: boolean }} options `inlineError: true` skips every toast
   * @returns {Promise<{ ok: true, result } | { ok: false, error }>}
   */
  const handleDeletePromotion = async (promotionId, options = {}) => {
    const inline = options?.inlineError === true
    try {
      if (!inline) showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState(prev => ({ ...prev, loading: true }))
      const response = await request('DELETE', `/${promotionId}`)
      const content = await readJson(response)
      const error = failureOf(response, content)
      if (error) {
        if (!inline) showToast(ToastType.Error, t('ERROR', 'Error'))
        setActionState({ loading: false, error: inline ? null : error })
        return { ok: false, error }
      }
      const _promotions = latestPromotions.current.filter(promotion => promotion.id !== promotionId)
      latestPromotions.current = _promotions
      setPromotionListState(prev => ({ ...prev, promotions: _promotions }))
      setActionState({ loading: false, error: null })
      if (handleSuccessUpdate) {
        handleSuccessUpdate({ ...business, offers: _promotions })
      }
      if (!inline) showToast(ToastType.Success, t('PROMOTION_DELETED', 'Promotion deleted'))
      setIsSuccessDeleted(true)
      return { ok: true, result: content?.result }
    } catch (err) {
      if (!inline) showToast(ToastType.Error, t('ERROR', 'Error'))
      setActionState({ loading: false, error: inline ? null : [err.message] })
      return { ok: false, error: err.message }
    }
  }

  useEffect(() => {
    if (Array.isArray(promotions)) {
      setPromotionListState(prev => ({ ...prev, loading: false, error: null, promotions }))
    } else {
      getBusinessesPromotions()
    }
  }, [promotions])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            promotionListState={promotionListState}
            actionState={actionState}
            reloadPromotions={getBusinessesPromotions}
            handleChangePromotionActiveState={handleChangePromotionActiveState}
            handleDeletePromotion={handleDeletePromotion}
            isSuccessDeleted={isSuccessDeleted}
            setIsSuccessDeleted={setIsSuccessDeleted}
          />
        )
      }
    </>
  )
}

BusinessPromotionList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
