import React, { useState, useEffect } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { PaymentRequestButtonElement, useStripe } from '@stripe/react-stripe-js'

import { CardForm as CardFormController } from '../CardForm/functions'
import { settleWalletPayment, toStripeAmountCents } from '../../../../../utils/stripeWallet'

import { Container } from './styles'

export const MethodFormUI = (props) => {
  const {
    cart,
    handleSource,
    handleCancel
  } = props

  const stripe = useStripe()
  const [paymentRequest, setPaymentRequest] = useState(null)

  useEffect(() => {
    if (stripe) {
      const pr = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: {
          label: cart?.business?.name,
          amount: toStripeAmountCents(cart?.balance || cart?.total)
        },
        requestPayerName: true,
        requestPayerEmail: true
      })
      pr.canMakePayment().then(result => {
        if (result) {
          setPaymentRequest(pr)
        }
      })
      pr.on('paymentmethod', async (e) => {
        const outcome = await settleWalletPayment({
          paymentMethod: e.paymentMethod,
          handleSource
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
      {paymentRequest
        ? (
        <PaymentRequestButtonElement options={{ paymentRequest }} />
          )
        : (
        <Skeleton />
          )}
    </Container>
  )
}

export const MethodForm = (props) => {
  const propsController = {
    ...props,
    UIComponent: MethodFormUI
  }
  return <CardFormController {...propsController} />
}
