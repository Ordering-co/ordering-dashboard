import React from 'react'
import { useForm } from 'react-hook-form'
import { StripeRedirectForm as StripeRedirectFormController, useSession, useLanguage } from '../../../../../../index'
import { Button, Input } from '../../../../styles'

import {
  FormRedirect,
  FormGroup,
  ErrorMessage
} from './styles'

const StripeRedirectFormUI = (props) => {
  const {
    paymethods,
    handleSubmitPaymentMethod
  } = props

  const [{ user }] = useSession()
  const { handleSubmit, register, errors, formState } = useForm()
  const [, t] = useLanguage()

  return (
    <>
      <FormRedirect onSubmit={handleSubmit(handleSubmitPaymentMethod)}>

        <FormGroup>
          <label htmlFor='stripe_redirect_type'>{t('SELECT_A_PAYMENT_METHOD', 'Select a payment method')}</label>
          <select
            id='stripe_redirect_type'
            name='type'
            ref={
              register({
                required: true
              })
            }
          >
            <option value=''>{t('SELECT_A_PAYMENT_METHOD', 'Select a payment method')}</option>
            {paymethods?.length > 0 && paymethods.map((paymethod, i) => (
              <option key={i} value={paymethod.value}>{paymethod.name}</option>
            ))}
          </select>
          {errors.type && errors.type.type === 'required' && (
            <ErrorMessage>{t('FIELD_REQUIRED', 'This field is required')}</ErrorMessage>
          )}
        </FormGroup>

        <FormGroup>
          <label htmlFor='stripe_redirect_name'>{t('ACCOUNT_HOLDER', 'Account holder')}</label>
          <Input
            id='stripe_redirect_name'
            name='name'
            defaultValue={user?.name}
            placeholder={t('TYPE_ACCOUNT_HOLDER', 'Type an Account holder')}
            ref={
              register({
                required: true
              })
            }
            autoComplete='off'
          />
          {errors.name && errors.name.type === 'required' && (
            <ErrorMessage>{t('FIELD_REQUIRED', 'This field is required')}</ErrorMessage>
          )}
        </FormGroup>

        <FormGroup>
          <label htmlFor='stripe_redirect_email'>{t('EMAIL', 'Email')}</label>
          <Input
            id='stripe_redirect_email'
            name='email'
            type='email'
            defaultValue={user?.email}
            placeholder={t('TYPE_AN_EMAIL', 'Type an email')}
            ref={
              register({
                required: true
              })
            }
            autoComplete='off'
          />
          {errors.email && errors.email.type === 'required' && (
            <ErrorMessage>{t('FIELD_REQUIRED', 'This field is required')}</ErrorMessage>
          )}
        </FormGroup>
        <Button borderRadius='8px' color='primary' type='submit' disabled={formState.isSubmitting}>
          {formState.isSubmitting ? t('LOADING', 'Loading...') : t('OK', 'OK')}
        </Button>
      </FormRedirect>
    </>
  )
}

export const StripeRedirectForm = (props) => {
  const stripeRedirectFormProps = {
    ...props,
    UIComponent: StripeRedirectFormUI
  }
  return <StripeRedirectFormController {...stripeRedirectFormProps} />
}
