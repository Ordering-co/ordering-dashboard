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
        // redesign reviews FB (D5, RV-08): the load error reaches the UI (it was null, so a failure looked like «no reviews»)
        setBusinessReviewsList({
          reviews: [],
          loading: false,
          error: result ?? error
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
          error: [err.message]
        })
      }
    }
  }

  /**
   * Method to change the enabled of the review
   * redesign reviews FB (D5, RV-04): it answers `{ ok: true }` or `{ ok: false, error }` so the switch of the UI says
   * «saving» and «could not save» itself (no «Loading» toast, no toast on failure). The review of the list is replaced by
   * a copy, never mutated.
   * @param {number} reviewId
   * @param {boolean} enabled
   */
  const handleChangeReviewEnabled = async (reviewId, enabled) => {
    // redesign reviews FB (D5, RV-04)
    try {
      setActionState({ loading: true, error: null })
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
      if (content.error) {
        setActionState({ loading: false, error: content.result })
        return { ok: false, error: content.result }
      }
      setBusinessReviewsList(prev => ({
        ...prev,
        reviews: prev.reviews.map(review => review.id === reviewId ? { ...review, ...content.result } : review)
      }))
      setActionState({ loading: false, error: null })
      showToast(ToastType.Success, t('REVIEW_UPDATED', 'Review updated'))
      return { ok: true }
    } catch (err) {
      // redesign reviews R1 (Q1-7): `actionState.error` keeps the message of the exception, but the answer carries no text, so the
      // switch says its own «The review wasn't updated.» instead of «Failed to fetch» (AsyncSwitch only uses `failureText` when the
      // error has none)
      setActionState({ loading: false, error: [err.message] })
      return { ok: false, error: null }
    }
  }

  // redesign reviews FB (D5, RV-08): the load of the effect, also exposed as `reloadReviews` (the «Try again» of the UI)
  const loadReviews = () => {
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
  }

  useEffect(() => {
    loadReviews()

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
          reloadReviews={loadReviews}
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
