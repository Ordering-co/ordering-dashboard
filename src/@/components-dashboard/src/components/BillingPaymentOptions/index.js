import React, { useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js/pure'

import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useSession } from '../../contexts/SessionContext'

import { flatArray } from '../../utils'
import { awaitingPlanChangePayment, requestSubscriptions, toMessages } from '../../ui/src/components/Billing/BillingPaymentOptions/billingModel'
import { buildBillingSubscriptionRequest } from './billingSubscriptionRequest'

/**
 * Component to manage payment options behavior without UI component
 */
export const BillingPaymentOptions = (props) => {
  const {
    projectId,
    replace,
    settings,
    isUpgradeToPro,
    upgradeProPlanId,
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()

  const [paymethodSelected, setPaymethodSelected] = useState(null)
  // redesign BM-A (D5, M-BM4, M-BM21): `error` stays main's string. `kind` says whether a retry is safe: 'declined' (nothing
  // was charged) or 'uncertain' (the charge was sent and its outcome is unknown: never retry). `messages` are all the
  // texts of the API.
  const [placeOrderState, setPlaceOrderState] = useState({ loading: false, error: null, kind: null, messages: [], result: null })
  const [confirmState, setConfirmState] = useState({ loading: false, error: null, result: null, currentSub: null })
  const [subscriptionsState, setSubscriptionsState] = useState({ loading: false, error: null, subscriptions: [] })
  const [planStateToUpgrade, setPlanStateToUpgrade] = useState({ loading: false, error: null, plan: {} })

  const validStatus = ['active', 'trialing']
  // (billing-api#103): an active subscription whose plan change still waits for its payment is not charged, and one
  // with any change still pending is not done: no success screen until the change is applied.
  const isCharged = (sub) => validStatus.includes(sub?.status) && !awaitingPlanChangePayment(sub)
  const isSettled = (sub) => validStatus.includes(sub?.status) && sub?.data?.plan_change?.status !== 'pending'

  // redesign BM-A (D5): one charge at a time. A second call while the first runs (double click, Enter held) sends nothing.
  const placeOrderInFlight = useRef(false)

  /**
   * function to get public plans
  */
  const getPlanToUpgrade = async () => {
    try {
      setPlanStateToUpgrade({ ...planStateToUpgrade, loading: true, error: null })
      const response = await fetch(`${ordering.root}/billing/plans/public`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer '.concat(token)
        }
      })
      const { error, result } = await response.json()

      const plan = error ? {} : result?.sort((a, b) => a?.rank - b?.rank)?.find((plan) => (upgradeProPlanId?.includes(plan?.id)))

      setPlanStateToUpgrade({
        ...planStateToUpgrade,
        loading: false,
        plan: plan ?? {},
        error: error
          ? typeof result === 'string' ? result : result?.[0]
          : null
      })
    } catch (error) {
      setPlanStateToUpgrade({
        ...planStateToUpgrade,
        loading: false,
        error: error.message
      })
    }
  }

  /**
   * function to Subscriptions
   */
  const getSubscriptions = async () => {
    if (!projectId) return
    setSubscriptionsState({ ...subscriptionsState, loading: true, error: null })
    try {
      const response = await fetch(`${ordering.root}/billing/subscriptions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer '.concat(token)
        }
      })
      const { error, result } = await response.json()

      setSubscriptionsState({
        ...subscriptionsState,
        loading: false,
        subscriptions: error ? [] : result,
        error: error
          ? typeof result === 'string' ? result : result?.[0]
          : null
      })
    } catch (error) {
      setSubscriptionsState({
        ...subscriptionsState,
        loading: false,
        error: error.message
      })
    }
  }

  /**
   * function to sync subscription with API
   */
  const syncSubscription = async ({ projectId, subscriptionId }) => {
    try {
      const req = await fetch(`${ordering.root}/billing/subscriptions/${subscriptionId}/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: projectId,
          subscription_id: subscriptionId
        })
      })
      const { error, result } = await req.json()

      return {
        error: error
          ? typeof result === 'string'
            ? result
            : result?.[0]
          : null,
        result
      }
    } catch (err) {
      return {
        error: err?.message
      }
    }
  }

  /**
   * function to confirm payment methods
   * redesign BM-A (M-BM4, M-BM21): returns { subs, charged, declined } instead of the bare list. `charged`: Stripe says the
   * payment intent succeeded. `declined`: Stripe rejected the authentication and nothing was charged. Neither (an
   * exception, a payment still processing, a failed sync after a charge) means the outcome is unknown.
   */
  const confirmPaymentMethod = async ({ clientSecret, projectId, subscriptionId, subs }) => {
    try {
      setConfirmState({ ...confirmState, loading: true, error: null, currentSub: subscriptionId })
      let syncSubRes = await syncSubscription({ projectId, subscriptionId })

      const stripe = await loadStripe(settings?.stripe_public_key)
      const result = await stripe.confirmCardPayment(clientSecret)

      syncSubRes = await syncSubscription({ projectId, subscriptionId })

      const charged = result?.paymentIntent?.status === 'succeeded'

      if (result?.error || syncSubRes?.error) {
        if (!syncSubRes?.error) {
          setSubscriptionsState({
            ...subscriptionsState,
            subscriptions: [syncSubRes?.result]
          })
        }
        setConfirmState({
          ...confirmState,
          loading: false,
          error: result?.error?.message ?? syncSubRes?.error
        })
        return { subs: [syncSubRes?.result], charged, declined: Boolean(result?.error) && !charged }
      }

      const _subs = subs ?? subscriptionsState.subscriptions

      if (charged) {
        const currentSubIdx = _subs.findIndex(sub => sub.id === syncSubRes?.result?.id)
        _subs[currentSubIdx] = syncSubRes?.result
        setSubscriptionsState({
          ...subscriptionsState,
          subscriptions: _subs
        })
      }
      setConfirmState({ ...confirmState, loading: false })
      return { subs: _subs, charged, declined: false }
    } catch (error) {
      setConfirmState({
        ...confirmState,
        loading: false,
        error: error?.message
      })
      return { subs: undefined, charged: false, declined: false }
    }
  }

  // redesign BM-A (M-BM4, M-BM21): every failure leaves with its kind and its messages, never a bare text.
  const failPlaceOrder = (kind, error, messages) => {
    setPlaceOrderState({
      ...placeOrderState,
      loading: false,
      error,
      kind,
      messages: messages ?? (error ? [error] : [])
    })
  }

  const handlePlaceOrder = async ({ propPlanId, period, subscription, payPending }) => {
    if (placeOrderInFlight.current) return
    if (isUpgradeToPro && !subscription?.status) {
      failPlaceOrder('declined', t('CURRENT_SUBCRIPTION_NOT_PAYED', 'Please pay your current subscription before you upgrade to Pro'))
      return
    }
    if (!projectId) {
      failPlaceOrder('declined', t('PROJECT_ID_MISSING', 'Project id is missing'))
      return
    }
    if (!propPlanId) {
      failPlaceOrder('declined', t('PROJECT_PLAN_MISSING', 'Project plan id is missing'))
      return
    }
    placeOrderInFlight.current = true
    // `sent` flips right before the charge leaves: from there on, a failure we cannot read may hide a charge.
    let sent = false
    try {
      setPlaceOrderState({ ...placeOrderState, loading: true, error: null, kind: null, messages: [] })
      setConfirmState({ ...confirmState, error: null })
      const currentSubs = subscription
      const { urlPath, body } = buildBillingSubscriptionRequest({
        subscription: currentSubs,
        planId: propPlanId,
        period,
        replace,
        userPaymethodId: paymethodSelected?.id,
        payPending: !!payPending
      })
      const url = `${ordering.root}${urlPath}`

      sent = true
      const req = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
      const { error, result } = await req.json()

      const _subscriptions = result?.subscriptions ?? [result]

      const requireStripeActionSubs = (!error && _subscriptions?.filter(subs => subs.data?.status === 'requires_action')) || []
      const requireAnotherPaymethodSubs = (!error && _subscriptions?.filter(subs => subs.data?.status === 'requires_payment_method')) || []
      const canceledSubs = (!error && _subscriptions?.filter(subs => subs.data?.status === 'canceled')) || []

      setSubscriptionsState({
        ...subscriptionsState,
        subscriptions: error ? subscriptionsState.subscriptions : _subscriptions
      })

      if (error || requireAnotherPaymethodSubs.length || canceledSubs.length) {
        // redesign BM-A (M-BM4, M-BM21): a 5xx may hide a charge; a 4xx is a clear refusal. A rejected card with another
        // subscription already active is a partial success: money moved, so it is not safe to retry.
        const messages = error ? toMessages(result) : []
        const text = messages[0] ?? t('PAYMENT_FAILED', 'Payment Failed')
        const anyCharged = requestSubscriptions(_subscriptions).some(isCharged)
        const kind = error
          ? Number(req?.status) >= 500 ? 'uncertain' : 'declined'
          : anyCharged ? 'uncertain' : 'declined'
        failPlaceOrder(
          kind,
          error ? text : t('SUBSCRIPTION_STATUS_REQUIRES_PAYMENT_METHOD', 'Subscription status requires payment method'),
          error ? (messages.length ? messages : [text]) : undefined
        )
        return
      }

      let subs = null
      let isActive = false
      let confirmations = []
      if (requireStripeActionSubs.length) {
        const fetchSubs = requireStripeActionSubs
        confirmations = await Promise.all(requireStripeActionSubs.map(async (sub) => {
          const result = await confirmPaymentMethod({
            clientSecret: sub?.data?.client_secret,
            projectId: sub?.project_id,
            subscriptionId: sub?.id,
            subs: fetchSubs
          })
          return result
        }))

        subs = flatArray(confirmations.map(confirmation => confirmation.subs))

        // redesign BM-A: `sub?.` because a failed sync leaves an empty entry; main read `.status` of it and threw.
        isActive = subs && subs?.every(isSettled)
        if (!isActive) {
          setSubscriptionsState({
            ...subscriptionsState,
            subscriptions: error ? subscriptionsState.subscriptions : subs?.some(Boolean) ? subs.filter(Boolean) : _subscriptions
          })
          setPlaceOrderState({
            ...placeOrderState,
            loading: false
          })
        }
      } else {
        isActive = _subscriptions && _subscriptions?.every(sub => validStatus.includes(sub.status))
      }

      if (isActive) {
        const project = await getSubscriptions()

        setPlaceOrderState({
          ...placeOrderState,
          loading: false,
          error: error ? result : null,
          kind: null,
          messages: [],
          project,
          result: error ? null : subs ?? _subscriptions
        })
      } else {
        // redesign BM-A (M-BM21): the API accepted the charge but not everything ended active. Only a 3DS that Stripe
        // rejected on every confirmation, with nothing active anywhere, proves nothing was charged.
        const anyCharged = requestSubscriptions([..._subscriptions, ...(subs ?? [])]).some(isCharged)
        const cleanDecline = confirmations.length > 0 && confirmations.every(confirmation => confirmation.declined) && !anyCharged
        failPlaceOrder(cleanDecline ? 'declined' : 'uncertain', t('PAYMENT_FAILED', 'Payment Failed'))
      }
    } catch (error) {
      // redesign BM-A (M-BM4): before the charge leaves, nothing was charged; after it, nobody knows.
      const message = error?.message ?? t('PAYMENT_FAILED', 'Payment Failed')
      failPlaceOrder(sent ? 'uncertain' : 'declined', message)
    } finally {
      placeOrderInFlight.current = false
    }
  }

  useEffect(() => {
    if (!isUpgradeToPro) return
    getPlanToUpgrade()
  }, [isUpgradeToPro])

  useEffect(() => {
    getSubscriptions()

    return () => {
      setPlanStateToUpgrade({ loading: false, error: null, plan: {} })
    }
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          confirmState={confirmState}
          placeOrderState={placeOrderState}
          subscriptionsState={subscriptionsState}
          paymethodSelected={paymethodSelected}
          planStateToUpgrade={planStateToUpgrade}
          handlePaymethodChange={setPaymethodSelected}
          handlePlaceOrder={handlePlaceOrder}
        />
      )}
    </>
  )
}
