import React, { useState } from 'react'
import { useApi, useSession } from '~components'
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'

/**
 * Component to manage card form for stripe elements form behavior without UI component
 */
export const BillingCardForm = (props) => {
  const {
    UIComponent,
    requirements,
    onNewCard
  } = props

  const [{ user, token }] = useSession()
  const [ordering] = useApi()

  const stripe = useStripe()
  const elements = useElements()

  const [cardState, setCardState] = useState({ error: null, loading: false })
  const [addCardState, setAddCardState] = useState({ loading: false, error: null, result: null })

  /**
   * Handle real-time validation errors from the card Element
   * @param {*event} event
   */
  const handleChange = (event) => {
    setAddCardState({ ...addCardState, result: null })
    setCardState({
      ...cardState,
      error: event?.error?.message ?? null
    })
  }

  /**
   * POST the token ID to backend.
   * @param {*string} param0 payment method id
   */
  const stripeTokenHandler = async (tokenId) => {
    if (!tokenId) return
    try {
      setAddCardState({ ...addCardState, loading: true })
      const req = await fetch(`${ordering.root}/billing/paymethods`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source_id: tokenId,
          default: true
        })
      })
      const { error, result } = await req.json()

      setAddCardState({
        ...addCardState,
        loading: false,
        error: error
          ? typeof result === 'string'
            ? result
            : result?.[0]
          : null,
        result: error ? null : result
      })
      if (!error) {
        onNewCard && onNewCard(result)
      }
    } catch (error) {
      setAddCardState({
        ...addCardState,
        loading: false,
        error: error?.message
      })
    }
  }

  /**
   * Handle form submission
   * @param {event} event
   */
  const handleSubmit = async (event) => {
    event.preventDefault()
    setCardState({ ...cardState, loading: true })
    const card = elements?.getElement(CardElement)

    if (!stripe) {
      setCardState({
        ...cardState,
        error: 'Your browser extensions may be blocking stripe. Please try in another browser or incognito mode with extensions disabled'
      })
      return
    }
    const result = await stripe.confirmCardSetup(
      requirements,
      {
        payment_method: {
          card,
          billing_details: {
            name: `${user.name} ${user.lastname}`,
            email: user.email
          }
        }
      }
    )

    setCardState({
      ...cardState,
      loading: false,
      error: result.error ? result.error.message : null
    })
    stripeTokenHandler(!result?.error && result.setupIntent.payment_method)
    card.clear()
  }

  return (
    <UIComponent
      {...props}
      cardState={cardState}
      addCardState={addCardState}
      handleSubmit={handleSubmit}
      handleChange={handleChange}
    />
  )
}
