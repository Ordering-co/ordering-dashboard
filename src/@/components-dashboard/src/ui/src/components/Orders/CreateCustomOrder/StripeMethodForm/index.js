import React, { useState, useEffect } from 'react'
import { PaymentRequestButtonElement, useStripe } from '@stripe/react-stripe-js'
import { CardForm as CardFormController, useConfig, useLanguage } from '../../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { settleWalletPayment, toStripeAmountCents } from '../../../../utils/stripeWallet'
import { Container } from './styles'
export const StripeMethodFormUI = (props) => {
  const {
    cart,
    handleSource,
    handleCancel,
    handlePlaceOrder,
    paymethod,
    cartGroup
  } = props

  const [, t] = useLanguage()
  const stripe = useStripe()
  const [{ configs }] = useConfig()
  const [paymentRequest, setPaymentRequest] = useState(null)
  const [methodUnavailable, setMethodUnavailable] = useState(false)

  const googlePayMethods = ['google_pay', 'global_google_pay']

  useEffect(() => {
    if (stripe) {
      let cartNames = ''
      if (cartGroup) {
        // eslint-disable-next-line no-unused-expressions
        cartGroup?.carts.map((cart, i) => (
          cartNames = `${cart?.business?.name} ${i !== cartNames?.carts?.length && ', '}`
        ))
      }
      const pr = stripe.paymentRequest({
        country: 'US',
        currency: configs?.stripe_currency?.value?.toLowerCase?.() || 'usd',
        total: {
          label: cartNames || cart?.business?.name,
          amount: toStripeAmountCents(cartGroup?.balance || cartGroup?.total || cart?.balance || cart?.total)
        },
        requestPayerName: true,
        requestPayerEmail: true
      })
      pr.canMakePayment().then(result => {
        if (result) {
          setPaymentRequest(pr)
        } else {
          setMethodUnavailable(true)
        }
      })
      pr.on('paymentmethod', async (e) => {
        const outcome = await settleWalletPayment({
          paymentMethod: e.paymentMethod,
          placeOrder: handlePlaceOrder,
          handleSource,
          stringifySource: Boolean(cartGroup)
        })
        e.complete(outcome.complete)
        if (outcome.shouldCancel) {
          handleCancel()
        }
      })
    }
  }, [stripe])

  return (
    <Container>
      {methodUnavailable
        ? (
        <h2>{googlePayMethods.includes(paymethod) ? t('GOOGLE_PAY_UNAVAILABLE', 'Google pay unavailable') : t('APPLE_PAY_UNAVAILABLE', 'Apple pay unavailable')}</h2>
          )
        : (
        <>
          {paymentRequest
            ? (
            <PaymentRequestButtonElement options={{ paymentRequest }} />
              )
            : (
            <Skeleton />
              )}
        </>
          )}
    </Container>
  )
}

export const StripeMethodForm = (props) => {
  const propsController = {
    ...props,
    UIComponent: StripeMethodFormUI
  }
  return <CardFormController {...propsController} />
}
