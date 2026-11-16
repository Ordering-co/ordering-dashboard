import React, { useEffect, useId, useState } from 'react'

import { useLanguage, PaymentOptionStripeLink as PaymentOptionStripeLinkController } from '../../../../../index'
import { DefaultSelect as Select } from '../../../styles'
import { SecretField } from '../../Shared/Product'
import { ProviderPanel } from '../BusinessPaymentMethods/ProviderPanel'
import { commitOnBlur, commitOnKeyDown, useConfigSaveError } from '../BusinessPaymentMethods/configField'
import { Option } from './styles'

// redesign stores 5.10a: Stripe Link on ProviderPanel — a publishable and a secret key per mode (Live and Sandbox), channels and order types; the Twilio configs close the General tab and save by themselves, not through the save bar.
const TABS = [
  { id: 'general', index: 0 },
  { id: 'channels', index: 1 },
  { id: 'order_types', index: 2 }
]

// the only business configs this form edits (as `main`)
const CONFIGS_TO_SHOW = ['allow_text_messages_sms', 'allow_text_messages_whatsapp']

// A select config, saved when the choice changes. The legacy select is not a labelable control: the visible label is a span, and the
// trigger is named by it followed by its own content (the current choice).
const ConfigSelect = ({ config, onChange }) => {
  const [, t] = useLanguage()
  const base = useId()
  const labelId = `${base}-label`
  const triggerId = `${base}-trigger`
  const options = config.options.map(item => ({
    value: item.value,
    content: <Option>{t(item.text.toUpperCase(), item.text)}</Option>
  }))
  return (
    <div className='odc-pp-config'>
      <span id={labelId} className='odc-pp-config-label'>{config.name}</span>
      <Select
        notAsync
        id={triggerId}
        ariaLabelledBy={`${labelId} ${triggerId}`}
        defaultValue={config.value}
        options={options}
        onChange={onChange}
        placeholder={t('SELECT_A_OPTION', 'Select a option')}
      />
    </div>
  )
}

const PaymentOptionStripeLinkUI = ({
  paymethod,
  businessPaymethod,
  gatewayName,
  storeName,
  sites,
  devices,
  orderTypes,
  initialTab,
  onTabChange,
  onSave,
  configsState,
  actionState,
  handleUpdateConfigs
}) => {
  const [, t] = useLanguage()
  const publishable = t('PUBLISHABLE_KEY', 'Publishable key')
  const secret = t('SECRET_KEY', 'Secret key')
  const fields = [
    { key: 'publishable', label: publishable, mode: 'live' },
    { key: 'secret', label: secret, mode: 'live', secret: true },
    { key: 'publishable', label: publishable, mode: 'sandbox' },
    { key: 'secret', label: secret, mode: 'sandbox', secret: true }
  ]

  // a config the API refuses (a Twilio secret) shows as a toast
  useConfigSaveError(actionState?.error)

  // redesign bugs F row 33: the select keeps its own state and only follows `defaultValue`, which a refused save does not change.
  // Each failure remounts the selects (it is in their key), so they show the stored value again.
  const [failedSaves, setFailedSaves] = useState(0)
  useEffect(() => {
    if (actionState?.error) setFailedSaves(count => count + 1)
  }, [actionState?.error])

  const saveConfig = (config, value) => handleUpdateConfigs(config.id, { value })

  const secretEnding = (ending) => {
    const [before, after] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
    return <>{before}{ending}{after}</>
  }

  const renderConfig = (config) => {
    const key = config.id ?? config.key
    if (config.type === 2 && config.options) {
      return <ConfigSelect key={`${key}-${failedSaves}`} config={config} onChange={(value) => saveConfig(config, value)} />
    }
    if (config.type === 7) {
      const commit = commitOnBlur(config.value, (value) => saveConfig(config, value))
      // review 5.10a #1: Show / Hide take the focus from the input, which is not leaving the field: it saves only when the focus
      // leaves the input AND its button (a half-typed secret is never sent by a click on Show)
      const commitOnLeave = (e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return
        const field = e.currentTarget.querySelector('input')
        if (field) commit({ target: field })
      }
      return (
        <div key={key} className='odc-pp-config' onBlur={commitOnLeave}>
          <SecretField
            label={config.name ?? config.key}
            defaultValue={config.value ?? ''}
            showLabel={t('SHOW', 'Show')}
            hideLabel={t('HIDE', 'Hide')}
            endingLabel={secretEnding}
            onKeyDown={commitOnKeyDown(config.value, (value) => saveConfig(config, value))}
          />
        </div>
      )
    }
    return null
  }

  const generalBefore = (
    <p className='odc-pp-hint'>
      {t('STRIPE_AND_TWILIO_CONFIGS_REQUIERED', 'Stripe and Twilio keys are required to use this Payment Method')}
    </p>
  )

  // Not part of the save bar: each config saves by itself, as in `main` (a select when it changes, a secret when the field is left)
  const generalAfter = (
    <div className='odc-pp-configs'>
      <p className='odc-pp-hint'>{t('TWILIO_CONFIGURATION_MESSAGE', '*Enable these options after twilio configuration')}</p>
      {!configsState?.loading && configsState?.configs?.filter(config => CONFIGS_TO_SHOW.includes(config?.key)).map(renderConfig)}
    </div>
  )

  return (
    <ProviderPanel
      paymethod={paymethod}
      businessPaymethod={businessPaymethod}
      gatewayName={gatewayName}
      storeName={storeName}
      tabs={TABS}
      initialTab={initialTab}
      onTabChange={onTabChange}
      sites={sites}
      devices={devices}
      orderTypes={orderTypes}
      showMode
      fieldsDisplay='both'
      fields={fields}
      generalBefore={generalBefore}
      generalAfter={generalAfter}
      onSave={onSave}
    />
  )
}

export const PaymentOptionStripeLink = (props) => {
  const paymentOptionStripeLinkProps = {
    ...props,
    UIComponent: PaymentOptionStripeLinkUI
  }
  return <PaymentOptionStripeLinkController {...paymentOptionStripeLinkProps} />
}
