import React, { useId } from 'react'
import { useConfig, useLanguage } from '../../../../../index'
import { Button, Checkbox, InlineNotice, RadioGroup } from '../../Shared/Product'

// redesign (D1): the «Orders and payments» group of the add. The payment methods are main's list in main's two groups
// (card gateways apart), as checkboxes with their name; the first one comes chosen, as before, and it is always one the list
// shows (G5-29). The price level keeps main's five steps of the currency symbol. The delivery zone comes in as `zoneSlot`.

// main's card gateways, drawn under «Credit card payments» (BusinessAdd/PaymentMethods before the redesign)
const CARD_GATEWAYS = ['google_pay', 'apple_pay', 'stripe', 'stripe_checkout', 'paypal']

export const StoreAddOrders = ({ paymethodsList, paymethodIds, onPaymethodsChange, onRetryPaymethods, form, changeFields, problems, showErrors, disabled, zoneSlot, paymentsRef }) => {
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const id = useId()
  const paymethods = paymethodsList?.paymethods || []
  const groups = [
    { key: 'other', methods: paymethods.filter(method => !CARD_GATEWAYS.includes(method.gateway)) },
    { key: 'card', label: t('CREDIT_CARD_PAYMENTS', 'Credit card payments'), methods: paymethods.filter(method => CARD_GATEWAYS.includes(method.gateway)) }
  ].filter(group => group.methods.length)
  const toggle = (methodId, checked) => onPaymethodsChange(checked
    ? [...paymethodIds.filter(item => item !== methodId), methodId]
    : paymethodIds.filter(item => item !== methodId))
  const paymentsError = showErrors && problems?.payments
  const symbol = configs?.format_number_currency?.value?.trim() || '$'
  const priceLevels = ['1', '2', '3', '4', '5'].map(key => ({ value: key, label: symbol.repeat(Number(key)) }))

  return (
    <section className='odc-sadd-group' aria-labelledby={`${id}-title`}>
      <h2 className='odc-sadd-group-title' id={`${id}-title`}>{t('STORE_ADD_ORDERS_AND_PAYMENTS', 'Orders and payments')}</h2>

      <fieldset className='odc-sadd-payments' aria-describedby={paymentsError ? `${id}-payments-error` : undefined} ref={paymentsRef} tabIndex={-1}>
        <legend className='odc-sadd-label'>
          {t('PAYMENT_METHODS', 'Payment methods')}
          <span className='odc-sadd-required' aria-hidden='true'> *</span>
          <span className='odc-sr-only'>{t('REQUIRED', 'Required')}</span>
        </legend>
        {paymethodsList?.loading && <p className='odc-sadd-muted' role='status'>{t('LOADING', 'Loading')}…</p>}
        {!paymethodsList?.loading && paymethodsList?.error && (
          <InlineNotice
            tone='danger'
            role='alert'
            action={<Button size='sm' onClick={onRetryPaymethods}>{t('TRY_AGAIN', 'Try again')}</Button>}
          >
            {t('STORE_ADD_PAYMETHODS_FAILED', 'The payment methods could not load.')}
          </InlineNotice>
        )}
        {groups.map(group => (
          <div key={group.key} className='odc-sadd-payments-group'>
            {group.label && <p className='odc-sadd-payments-heading'>{group.label}</p>}
            <div className='odc-sadd-payments-list'>
              {group.methods.map(method => (
                <Checkbox
                  key={method.id}
                  checked={paymethodIds.includes(method.id)}
                  disabled={disabled}
                  onCheckedChange={checked => toggle(method.id, checked === true)}
                >
                  {t(method?.gateway?.toUpperCase(), method?.name)}
                </Checkbox>
              ))}
            </div>
          </div>
        ))}
        {paymentsError && (
          <p className='odc-sadd-error' id={`${id}-payments-error`}>{t('AT_LEAST_A_PAYMENT_METHOD_REQUIRED', 'At least a payment method is required')}</p>
        )}
      </fieldset>

      <RadioGroup
        className='odc-sadd-price'
        label={t('PRICE_LEVEL', 'Price level')}
        orientation='horizontal'
        options={priceLevels}
        value={form.price_level ?? null}
        disabled={disabled}
        onValueChange={value => changeFields({ price_level: value })}
      />

      {zoneSlot}
    </section>
  )
}
