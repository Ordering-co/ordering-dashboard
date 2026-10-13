import React, { useEffect, useState } from 'react'
import { useApi, useSession } from '~components'

/**
 * Component to manage payment option stripe behavior without UI component
 */
export const BillingPaymentOptionStripe = (props) => {
  const {
    onSelectCard,
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ user, token }] = useSession()

  const [cardsList, setCardsList] = useState({ cards: [], loading: true, error: null })
  const [requirements, setRequirements] = useState()
  const [publicKey, setPublicKey] = useState()
  const [cardSelected, setCardSelected] = useState(null)
  const [cardDefaultState, setCardDefaultState] = useState({ loading: false, error: null, result: null })
  const requestState = {}

  const getRequirementsKey = async () => {
    try {
      const secretResp = await fetch(`${ordering.root}/billing/paymethods/requirements`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer '.concat(token)
        }
      })
      const { result: secretRes } = await secretResp.json()
      if (secretRes?.client_secret && window.rewardful) {
        window.rewardful('convert', { email: user?.email })
      }
      return secretRes
    } catch {
      return null
    }
  }

  /**
   * method to get cards from API
   */
  const getCards = async () => {
    try {
      const source = {}
      requestState.paymentCards = source

      const response = await fetch(`${ordering.root}/billing/paymethods`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
      const { error, result } = await response.json()

      const secretRes = await getRequirementsKey()
      setPublicKey(secretRes?.publishable_key)
      setRequirements(secretRes?.client_secret)
      if (!error) {
        const card = result.find(card => card.default) ?? (result?.length === 1 && result?.[0])
        await handleCardClick(card, result.some(card => card.default))
      }
      setCardsList({
        ...cardsList,
        loading: false,
        error: error ? result : null,
        cards: error ? [] : result
      })
    } catch (e) {
      setCardsList({
        ...cardsList,
        loading: false,
        error: e?.message
      })
    }
  }

  /**
   * method to set card as default
   */
  const setDefaultCard = async (card) => {
    try {
      setCardDefaultState({ ...cardDefaultState, loading: true, error: null, result: null })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          user_paymethod_id: card.id
        })
      }

      const functionFetch = `${ordering.root}/billing/paymethods/${card.id}/default`
      const response = await fetch(functionFetch, requestOptions)
      const content = await response.json()

      setCardDefaultState({
        loading: false,
        error: content?.error
          ? typeof content?.result === 'string'
            ? content?.result
            : content?.result?.[0]
          : null,
        result: !content?.error ? content?.result : null
      })
      return content
    } catch (error) {
      setCardDefaultState({ loading: false, error: error?.message })
    }
  }

  /**
   * method to get cards from API
   */
  const deleteCard = async (card) => {
    setCardDefaultState({ ...cardDefaultState, error: null, result: null })
    try {
      const req = await fetch(`${ordering.root}/billing/paymethods/${card?.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const { error, result } = await req.json()

      if (error) {
        setCardsList({
          ...cardsList,
          error: typeof result === 'string'
            ? result
            : result?.[0]
        })
        return
      }

      cardsList.cards = cardsList.cards.filter(_card => _card.id !== card.id)
      setCardsList({ ...cardsList })
    } catch (error) {}
  }

  const handleCardClick = async (card, isDefault) => {
    const _card = cardSelected?.id === card?.id ? null : card
    setCardSelected(_card)
    if (_card && !isDefault) {
      const res = await setDefaultCard(_card)
      if (!res?.error) {
        const list = cardsList.cards
        const _cards = list.map(c => ({ ...c, default: c.id === card.id }))
        cardsList.cards = _cards
        setCardsList({ ...cardsList, error: null })
      }
    }
    onSelectCard && onSelectCard(_card)
  }

  const handleNewCard = async (card) => {
    const list = [...cardsList.cards, card]
    const _cards = list.map(c => ({ ...c, default: c.id === card.id }))
    cardsList.cards = _cards
    setCardsList({ ...cardsList, error: null })
    const secretRes = await getRequirementsKey()
    setPublicKey(secretRes?.publishable_key)
    setRequirements(secretRes?.client_secret)
    handleCardClick(card, true)
  }

  useEffect(() => {
    if (user?.id) {
      getCards()
    }
    return () => {
      if (requestState.paymentCards && requestState.paymentCards.cancel) {
        requestState.paymentCards.cancel()
      }
    }
  }, [user])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          cardsList={cardsList}
          cardDefaultState={cardDefaultState}
          requirements={requirements}
          cardSelected={cardSelected}
          publicKey={publicKey}
          setDefaultCard={setDefaultCard}
          handleCardClick={handleCardClick}
          handleNewCard={handleNewCard}
          deleteCard={deleteCard}
        />
      )}
    </>
  )
}
