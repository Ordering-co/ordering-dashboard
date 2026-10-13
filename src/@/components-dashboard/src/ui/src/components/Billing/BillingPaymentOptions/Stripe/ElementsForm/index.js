import React, { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js/pure'
import { Elements } from '@stripe/react-stripe-js'

import { CardInputWrapper } from '../styles'
import { CardForm } from '../CardForm'

export const ElementsForm = (props) => {
  const {
    publicKey,
    handleSource,
    requirements,
    onNewCard,
    onCancel
  } = props

  const [stripePromise] = useState(() => loadStripe(publicKey))

  return (
    <>
      {publicKey && (
        <Elements stripe={stripePromise}>
          <CardInputWrapper>
            <CardForm
              requirements={requirements}
              onNewCard={onNewCard}
              handleCancel={onCancel}
              handleSource={handleSource}
            />
          </CardInputWrapper>
        </Elements>
      )}
    </>
  )
}
