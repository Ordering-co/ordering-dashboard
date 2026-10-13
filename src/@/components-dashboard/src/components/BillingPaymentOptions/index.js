import React, { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js/pure'

import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useSession } from '../../contexts/SessionContext'

import { flatArray } from '../../utils'
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
  const [placeOrderState, setPlaceOrderState] = useState({ loading: false, error: null, result: null })
  const [confirmState, setConfirmState] = useState({ loading: false, error: null, result: null, currentSub: null })
  const [subscriptionsState, setSubscriptionsState] = useState({ loading: false, error: null, subscriptions: [] })
  const [planStateToUpgrade, setPlanStateToUpgrade] = useState({ loading: false, error: null, plan: {} })

  const validStatus = ['active', 'trialing']

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
   */
  const confirmPaymentMethod = async ({ clientSecret, projectId, subscriptionId, subs }) => {
    try {
      setConfirmState({ ...confirmState, loading: true, error: null, currentSub: subscriptionId })
      let syncSubRes = await syncSubscription({ projectId, subscriptionId })

      const stripe = await loadStripe(settings?.stripe_public_key)
      const result = await stripe.confirmCardPayment(clientSecret)

      syncSubRes = await syncSubscription({ projectId, subscriptionId })

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
        return [syncSubRes?.result]
      }

      const _subs = subs ?? subscriptionsState.subscriptions

      if (result?.paymentIntent?.status === 'succeeded') {
        const currentSubIdx = _subs.findIndex(sub => sub.id === syncSubRes?.result?.id)
        _subs[currentSubIdx] = syncSubRes?.result
        setSubscriptionsState({
          ...subscriptionsState,
          subscriptions: _subs
        })
      }
      setConfirmState({ ...confirmState, loading: false })
      return _subs
    } catch (error) {
      setConfirmState({
        ...confirmState,
        loading: false,
        error: error?.message
      })
    }
  }

  const handlePlaceOrder = async ({ propPlanId, period, subscription }) => {
    if (isUpgradeToPro && !subscription?.status) {
      setPlaceOrderState({ ...placeOrderState, error: t('CURRENT_SUBCRIPTION_NOT_PAYED', 'Please pay your current subscription before you upgrade to Pro') })
      return
    }
    if (!projectId) {
      setPlaceOrderState({ ...placeOrderState, error: t('PROJECT_ID_MISSING', 'Project id is missing') })
      return
    }
    if (!propPlanId) {
      setPlaceOrderState({ ...placeOrderState, error: t('PROJECT_PLAN_MISSING', 'Project plan id is missing') })
      return
    }
    try {
      setPlaceOrderState({ ...placeOrderState, loading: true, error: null })
      setConfirmState({ ...confirmState, error: null })
      const currentSubs = subscription
      const { urlPath, body } = buildBillingSubscriptionRequest({
        subscription: currentSubs,
        planId: propPlanId,
        period,
        replace,
        userPaymethodId: paymethodSelected?.id
      })
      const url = `${ordering.root}${urlPath}`

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
        setPlaceOrderState({
          ...placeOrderState,
          loading: false,
          error: error
            ? typeof result === 'string'
              ? result
              : result?.[0]
            : t('SUBSCRIPTION_STATUS_REQUIRES_PAYMENT_METHOD', 'Subscription status requires payment method')
        })
        return
      }

      let subs = null
      let isActive = false
      if (requireStripeActionSubs.length) {
        const fetchSubs = requireStripeActionSubs
        subs = await Promise.all(requireStripeActionSubs.map(async (sub) => {
          const result = await confirmPaymentMethod({
            clientSecret: sub?.data?.client_secret,
            projectId: sub?.project_id,
            subscriptionId: sub?.id,
            subs: fetchSubs
          })
          return result
        }))

        subs = flatArray(subs)

        isActive = subs && subs?.every(sub => validStatus.includes(sub.status))
        if (!isActive) {
          setSubscriptionsState({
            ...subscriptionsState,
            subscriptions: error ? subscriptionsState.subscriptions : subs ?? _subscriptions
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
          project,
          result: error ? null : subs ?? _subscriptions
        })
      } else {
        setPlaceOrderState({
          ...placeOrderState,
          error: t('PAYMENT_FAILED', 'Payment Failed'),
          loading: false
        })
      }
    } catch (error) {
      setPlaceOrderState({
        ...placeOrderState,
        loading: false,
        error: error?.message
      })
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
