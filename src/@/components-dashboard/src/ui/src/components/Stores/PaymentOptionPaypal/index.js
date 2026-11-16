import React from 'react'
import { useLanguage } from '../../../../../index'
import { ProviderPanel } from '../BusinessPaymentMethods/ProviderPanel'

// redesign stores 5.10a: PaymentOptionPaypal on ProviderPanel — a client ID and a secret ID per mode (Live and Sandbox), channels and order types.
const TABS = [
  { id: 'general', index: 0 },
  { id: 'channels', index: 1 },
  { id: 'order_types', index: 2 }
]

export const PaymentOptionPaypal = ({
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
  const clientId = t('CLIENT_ID', 'Client ID')
  const secretId = t('SECRET_ID', 'Secret ID')
  const fields = [
    { key: 'client_id', label: clientId, mode: 'live' },
    { key: 'secret', label: secretId, mode: 'live', secret: true },
    { key: 'client_id', label: clientId, mode: 'sandbox' },
    { key: 'secret', label: secretId, mode: 'sandbox', secret: true }
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
