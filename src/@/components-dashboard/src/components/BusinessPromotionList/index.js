import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

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

  const [promotionListState, setPromotionListState] = useState({ promotions: [], loading: false, error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [isSuccessDeleted, setIsSuccessDeleted] = useState(false)

  /**
   * Method to get the business promotions from API
   */
  const getBusinessesPromotions = async () => {
    try {
      setPromotionListState({ ...promotionListState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/offers`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setPromotionListState({ promotions: content.result, loading: false, error: null })
      }
    } catch (err) {
      setPromotionListState({
        ...promotionListState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to control the business promotion enabled state
   * @param {Number} promotionId promotion id
   */
  const handleChangePromotionActiveState = async (enabled, promotionId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled })
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/offers/${promotionId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const _promotions = promotionListState.promotions.filter(promotion => {
          if (promotion.id === promotionId) {
            Object.assign(promotion, content.result)
          }
          return true
        })
        setPromotionListState({ ...promotionListState, promotions: _promotions })
        showToast(ToastType.Success, t('PROMOTION_SAVED', 'Promotion saved'))
        if (handleSuccessUpdate) {
          handleSuccessUpdate({ ...business, offers: _promotions })
        }
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  /**
   * Method to delete the business promotion
   * @param {Number} promotionId promotion id
   */
  const handleDeletePromotion = async (promotionId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/offers/${promotionId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const _promotions = promotionListState.promotions.filter(promotion => promotion.id !== promotionId)
        setPromotionListState({ ...promotionListState, promotions: _promotions })

        if (handleSuccessUpdate) {
          handleSuccessUpdate({ ...business, offers: _promotions })
        }
        showToast(ToastType.Success, t('PROMOTION_DELETED', 'Promotion deleted'))
        setIsSuccessDeleted(true)
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    if (promotions) {
      setPromotionListState({
        ...promotionListState,
        loading: false,
        promotions
      })
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
