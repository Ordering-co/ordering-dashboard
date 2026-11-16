import React from 'react'
import { useLanguage } from '../../../../../index'
import { ProviderPanel } from '../BusinessPaymentMethods/ProviderPanel'

// redesign stores 5.10b: PaymentOptionCredomatic on ProviderPanel — a processor ID and production keys (Live), sandbox keys (Sandbox) and the mode control, channels and order types.
const TABS = [
  { id: 'general', index: 0 },
  { id: 'channels', index: 1 },
  { id: 'order_types', index: 2 }
]

export const PaymentOptionCredomatic = ({
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
  const fields = [
    { key: 'processor_id', label: t('PROCESSOR_ID', 'Processor ID'), mode: 'live' },
    { key: 'private_production_key', label: t('PRIVATE_PRODUCTION_KEY', 'Private Production Key'), mode: 'live', secret: true },
    { key: 'public_production_key', label: t('PUBLIC_PRODUCTION_KEY', 'Public Production Key'), mode: 'live' },
    { key: 'private_sandbox_key', label: t('PRIVATE_SANDBOX_KEY', 'Private Sandbox Key'), mode: 'sandbox', secret: true },
    { key: 'public_sandbox_key', label: t('PUBLIC_SANDBOX_KEY', 'Public Sandbox Key'), mode: 'sandbox' }
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
