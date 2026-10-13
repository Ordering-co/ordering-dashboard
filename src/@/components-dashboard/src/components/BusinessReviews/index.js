import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const BusinessReviews = (props) => {
  const {
    businessId,
    reviews,
    fetchReviewsFromApi,
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const requestsState = useRef({})

  const [businessState, setBusinessState] = useState({
    business: props.business,
    loading: fetchReviewsFromApi ? true : !props.business,
    error: null
  })
  /**
   * businessReviewsList, this must be contain a reviews, loading and error to send UIComponent
   */
  const [businessReviewsList, setBusinessReviewsList] = useState({
    reviews: [],
    loading: true,
    error: null
  })

  const [actionState, setActionState] = useState({ loading: false, error: null })

  const sortReviews = (list = []) => {
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  const syncBusinessFromProps = () => {
    if (props.business?.id === businessId) {
      setBusinessState({
        business: props.business,
        loading: false,
        error: null
      })
    }
  }

  /**
   * Method to get business reviews from API
   */
  const getBusiness = async () => {
    try {
      setBusinessReviewsList(prev => ({ ...prev, loading: true, error: null, reviews: [] }))
      syncBusinessFromProps()

      if (!props.business?.name || props.business?.id !== businessId) {
        setBusinessState(prev => ({ ...prev, loading: true, error: null }))
      }

      const source = {}
      requestsState.current.reviews = source

      const fetchEndpoint = fetchReviewsFromApi
        ? ordering
          .setAccessToken(token)
          .businesses(businessId)
          .select(['name', 'logo', 'reviews'])
        : ordering
          .businesses(businessId)
          .select(['reviews'])

      const { content: { result, error } } = await fetchEndpoint.get({ cancelToken: source })

      if (error) {
        setBusinessState({
          business: props.business || null,
          loading: false,
          error: null
        })
        setBusinessReviewsList({
          reviews: [],
          loading: false,
          error: null
        })
        return
      }

      setBusinessState({
        loading: false,
        business: result || props.business,
        error: null
      })

      const list = sortReviews(result?.reviews?.reviews || [])
      setBusinessReviewsList({
        reviews: list,
        loading: false,
        error: null
      })
    } catch (err) {
      if (err.constructor.name !== 'Cancel') {
        setBusinessState({
          business: props.business || null,
          loading: false,
          error: null
        })
        setBusinessReviewsList({
          reviews: [],
          loading: false,
          error: null
        })
      }
    }
  }

  /**
   * Method to change the enabled of the review
   * @param {boolean} enabled
   */
  const handleChangeReviewEnabled = async (reviewId, enabled) => {
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
      const response = await fetch(`${ordering.root}/business/${businessId}/reviews/${reviewId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const reviews = businessReviewsList.reviews.filter(review => {
          if (review.id === reviewId) {
            Object.assign(review, content.result)
          }
          return true
        })
        setBusinessReviewsList({ ...businessReviewsList, reviews })
        showToast(ToastType.Success, t('REVIEW_UPDATED', 'Review updated'))
      }
    } catch (err) {
      setActionState({ loading: false, error: [err.message] })
    }
  }

  useEffect(() => {
    syncBusinessFromProps()

    if (fetchReviewsFromApi) {
      getBusiness()
    } else if (reviews) {
      setBusinessReviewsList({
        reviews: sortReviews(reviews),
        loading: false,
        error: null
      })
      setBusinessState({
        business: props.business,
        loading: false,
        error: null
      })
    } else {
      getBusiness()
    }

    return () => {
      if (requestsState.current.reviews) {
        requestsState.current.reviews.cancel()
      }
    }
  }, [businessId, fetchReviewsFromApi, props.business?.id])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessState={businessState}
          reviewsList={businessReviewsList}
          actionState={actionState}
          handleChangeReviewEnabled={handleChangeReviewEnabled}
        />
      )}
    </>
  )
}

BusinessReviews.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Reviews, this array must be containt all info about business reviews
   */
  reviews: PropTypes.arrayOf(PropTypes.object),
  /**
   * Id to get business from aPI
   */
  businessId: PropTypes.number,
  /**
   * When true, reviews are always loaded from the business reviews endpoint
   */
  fetchReviewsFromApi: PropTypes.bool
}

BusinessReviews.defaultProps = {
  fetchReviewsFromApi: false
}
