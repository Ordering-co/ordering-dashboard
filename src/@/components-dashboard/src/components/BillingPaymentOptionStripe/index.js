import React, { useEffect, useRef, useState } from 'react'
import { useApi, useSession } from '~components'

/**
 * Component to manage payment option stripe behavior without UI component
 */
export const BillingPaymentOptionStripe = (props) => {
  const {
    onSelectCard,
    // redesign (n.º 5, P-2): the Billing picker asks for the Stripe requirements when «Add card» is pressed, not on open.
    // Without this prop (the old Billing Stripe UI, unmounted since /purchase/addons uses the picker too: P-6) they are fetched on open, as in main.
    requirementsOnDemand = false,
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ user, token }] = useSession()

  const [cardsList, setCardsList] = useState({ cards: [], loading: true, error: null })
  const [requirements, setRequirements] = useState()
  const [publicKey, setPublicKey] = useState()
  const [cardSelected, setCardSelected] = useState(null)
  // the delete answers after a round trip: it asks which card is selected NOW, not the one its closure was made with
  const cardSelectedRef = useRef(null)
  cardSelectedRef.current = cardSelected
  const [cardDefaultState, setCardDefaultState] = useState({ loading: false, error: null, result: null })
  // on demand: `requested` turns true when «Add card» is pressed (the refs keep a second press from fetching twice)
  const [requirementsState, setRequirementsState] = useState({ requested: !requirementsOnDemand, loading: false })
  const requirementsRequestedRef = useRef(!requirementsOnDemand)
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

      if (!requirementsOnDemand) {
        const secretRes = await getRequirementsKey()
        setPublicKey(secretRes?.publishable_key)
        setRequirements(secretRes?.client_secret)
      }
      if (!error) {
        // (purchase-addons P-2): loading only reads. The default card is preselected; main also made the only card the
        // default as soon as the dialog opened, changing the account's billing. Choosing a card still writes the default.
        const card = result.find(card => card.default) ?? null
        await handleCardClick(card, true)
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
   * redesign (n.º 5, P-2): runs the requirements request once, when the user asks to add a card. Opening the picker
   * no longer creates a Stripe client_secret nor counts a Rewardful conversion (M-BM14).
   */
  const loadRequirements = async () => {
    if (requirementsRequestedRef.current) return
    requirementsRequestedRef.current = true
    // a retry keeps `requested`, so the notice and its «Try again» stay on screen while it runs
    setRequirementsState(current => ({ requested: current.requested, loading: true }))
    const secretRes = await getRequirementsKey()
    setPublicKey(secretRes?.publishable_key)
    setRequirements(secretRes?.client_secret)
    // without a key the person can ask again (review L2 #2): the next press runs the request once more
    if (!secretRes?.publishable_key) requirementsRequestedRef.current = false
    setRequirementsState({ requested: true, loading: false })
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
    // owner decision 17: the «default could not change» notice belongs to the click that failed, not to a later delete
    setCardDefaultState({ ...cardDefaultState, error: null, result: null, reverted: false })
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
        setCardsList(current => ({
          ...current,
          error: typeof result === 'string'
            ? result
            : result?.[0]
        }))
        return
      }

      // redesign (row 51 R1-2): a delete that works clears the error a failed one left (main showed it as a toast that
      // never came back; the Billing dialog shows it inline and it stayed). Functional update: it reads the list as it is now.
      setCardsList(current => ({
        ...current,
        error: null,
        cards: current.cards.filter(_card => _card.id !== card.id)
      }))
      // redesign (row 51 main-2): the card that was going to be charged is gone. Nothing stays selected and the parent
      // is told (`paymethodSelected` → null), so its «Pay» waits for a new choice instead of targeting a deleted card.
      if (cardSelectedRef.current?.id === card?.id) {
        setCardSelected(null)
        onSelectCard && onSelectCard(null)
      }
    } catch (error) {}
  }

  const handleCardClick = async (card, isDefault) => {
    const previous = cardSelected
    const _card = cardSelected?.id === card?.id ? null : card
    setCardSelected(_card)
    if (_card && !isDefault) {
      const res = await setDefaultCard(_card)
      // Owner decision 17 B (2026-10-21): when the default cannot change (the API refuses, or the request never answers) the card
      // that is charged goes back to the one the person had, and `reverted` lets the picker say so. main kept the clicked card.
      if (!res || res.error) {
        setCardSelected(previous)
        setCardDefaultState(current => ({ ...current, reverted: true }))
        onSelectCard && onSelectCard(previous)
        return
      }
      const list = cardsList.cards
      const _cards = list.map(c => ({ ...c, default: c.id === card.id }))
      cardsList.cards = _cards
      setCardsList({ ...cardsList, error: null })
    }
    onSelectCard && onSelectCard(_card)
  }

  const handleNewCard = async (card) => {
    // owner decision 17: a new card (made the default by the add) clears the notice of an earlier failed default
    setCardDefaultState(current => ({ ...current, error: null, reverted: false }))
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
          requirementsState={requirementsState}
          loadRequirements={loadRequirements}
          setDefaultCard={setDefaultCard}
          handleCardClick={handleCardClick}
          handleNewCard={handleNewCard}
          deleteCard={deleteCard}
        />
      )}
    </>
  )
}
