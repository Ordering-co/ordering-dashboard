import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

export const UserReviewDetails = (props) => {
  props = { ...defaultProps, ...props }
  const {
    userId,
    UIComponent,
    propsToFetch
  } = props

  const [ordering] = useApi()
  const [session] = useSession()

  const [userState, setUserState] = useState({ user: props.user, loading: !props.user, error: null })
  const [userReviewState, setUserReviewState] = useState({ reviews: [], loading: Boolean(userId), error: null }) // redesign reviews FC: no «No reviews yet» flash before the first load

  /**
   * Method to get the driver reviews from API
   */
  const getUserReviews = async () => {
    try {
      // redesign reviews FB (D5, RV-08): a new request (the reload too) starts without the previous error
      setUserReviewState({ ...userReviewState, loading: true, error: null })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }

      // `params=reviewer` brings who wrote each review (api-core #3623)
      const url = `${ordering.root}/users/${userId}/user_reviews?params=reviewer`
      const response = await fetch(url, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setUserReviewState({ reviews: content.result, loading: false, error: null })
      } else {
        // redesign reviews FB (D5, RV-08): it stayed loading forever; now the error reaches the UI
        setUserReviewState({ reviews: [], loading: false, error: content.result })
      }
    } catch (err) {
      setUserReviewState({
        ...userReviewState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to get user from API
   */
  const getUser = async () => {
    try {
      setUserState({
        ...userState,
        loading: true
      })
      const fetchEndpoint = ordering.setAccessToken(session.token).users(userId).select(propsToFetch)
      const { content: { result } } = await fetchEndpoint.get()
      const user = Array.isArray(result) ? null : result
      setUserState({
        ...userState,
        loading: false,
        user
      })
    } catch (err) {
      setUserState({
        ...userState,
        loading: false,
        error: [err.message]
      })
    }
  }

  useEffect(() => {
    if (!props.user) {
      getUser()
    } else {
      setUserState({
        ...userState,
        loading: false,
        user: props.user
      })
    }
  }, [props.user])

  useEffect(() => {
    if (!userId) return
    getUserReviews()
  }, [userId])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            userState={userState}
            userReviewState={userReviewState}
            reloadReviews={getUserReviews}
          />
        )
      }
    </>
  )
}

UserReviewDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  propsToFetch: [
    'name', 'lastname', 'photo'
  ]
}
