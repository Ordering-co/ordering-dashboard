import React from 'react'
import { useLanguage } from '../../../../../index'
import { ProviderPanel } from '../BusinessPaymentMethods/ProviderPanel'

// redesign stores 5.10a: PaymentOptionStripeDirect on ProviderPanel — a publishable and a secret key per mode (Live and Sandbox), channels and order types.
const TABS = [
  { id: 'general', index: 0 },
  { id: 'channels', index: 1 },
  { id: 'order_types', index: 2 }
]

export const PaymentOptionStripeDirect = ({
  paymethod,
  businessPaymethod,
  gatewayName,
  storeName,
  sites,
  devices,
  orderTypes,
  initialTab,
  onTabChange,
  onSave
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
      onSave={onSave}
    />
  )
}
