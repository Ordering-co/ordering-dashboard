import React from 'react'
import { useLanguage } from '../../../../../index'
import { ProviderPanel } from '../BusinessPaymentMethods/ProviderPanel'

// redesign stores 5.10b: PaymentOptionEpayco on ProviderPanel — a receiver ID and its two fees (no Live / Sandbox: main had no mode control), channels and order types.
// The split receivers table and modal were dead code in main (G4-22) and are not ported; a `split_receivers` already saved stays in `data` and goes back with every save.
const TABS = [
  { id: 'general', index: 0 },
  { id: 'channels', index: 1 },
  { id: 'order_types', index: 2 }
]

export const PaymentOptionEpayco = ({
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
    // main only let digits and «.» be typed in the three fields; a number field keeps that (an ID is never grouped)
    { key: 'receiver_id', label: t('RECEIVER_ID', 'Receiver ID'), mode: 'live', number: { min: 0 } },
    { key: 'receiver_fee_percentage', label: t('RECEIVER_FEE_PERCENTAGE', 'Receiver fee (%)'), mode: 'live', number: { min: 0, max: 100 } },
    { key: 'receiver_fee_fixed', label: t('RECEIVER_FEE_FIXED', 'Receiver fixed fee'), mode: 'live', number: { min: 0 } }
  ]

  const generalBefore = (
    <p className='odc-pp-hint'>{t('ONLY_AVAILABLE_FOR_COP_AND_USD', 'Only available for COP and USD currency')}</p>
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
      fieldsDisplay='plain'
      fields={fields}
      generalBefore={generalBefore}
      onSave={onSave}
    />
  )
}
