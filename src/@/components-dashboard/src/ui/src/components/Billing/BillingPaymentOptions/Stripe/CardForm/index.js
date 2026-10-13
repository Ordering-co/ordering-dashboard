import React, { useEffect, useRef, useState } from 'react'
import { CardElement } from '@stripe/react-stripe-js'
import {
  useLanguage,
  ToastType,
  useToast
} from '~components'

import { BillingCardForm as CardFormController } from '../../../../../../../components/BillingCardForm'

import { Button } from '~ui'

import {
  FormStripe,
  FormRow,
  ErrorMessage,
  FormActions
} from './styles'

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#32325d',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#aab7c4'
      }
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a'
    }
  }
}

const CardFormUI = (props) => {
  const {
    cardState,
    addCardState,
    handleSubmit,
    handleChange
  } = props

  const { error, loading } = cardState

  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [isFocus, setIsFocus] = useState(false)
  const cardElementRef = useRef(null)

  const handleOnChange = (event) => {
    handleChange(event)
    cardElementRef.current = event?.complete ? 'complete' : null
  }

  useEffect(() => {
    if (addCardState?.error || error) {
      showToast(ToastType.Error, addCardState?.error ?? error)
    }
    if (!addCardState?.error && addCardState?.result) {
      showToast(ToastType.Success, t('CARD_CREATED_SUCCESSFULLY', 'Card Created Successfully'))
    }
  }, [addCardState, cardState])

  return (
    <FormStripe onSubmit={handleSubmit}>
      <FormRow>
        <CardElement
          options={CARD_ELEMENT_OPTIONS}
          onChange={handleOnChange}
          onFocus={() => setIsFocus(true)}
          onBlur={() => cardElementRef.current !== 'complete' && setIsFocus(false)}
        />
        <ErrorMessage>{error}</ErrorMessage>
      </FormRow>
      <FormActions>
        <Button
          color={isFocus ? 'primary' : 'secundaryLight'}
          type='submit'
          disabled={loading}
        >
          {loading ? `${t('LOADING', 'Loading')}...` : t('ADD_CARD', 'Add card')}
        </Button>
      </FormActions>
    </FormStripe>
  )
}

export const CardForm = (props) => {
  const cardFormProps = {
    ...props,
    toSave: true,
    UIComponent: CardFormUI
  }
  return <CardFormController {...cardFormProps} />
}
