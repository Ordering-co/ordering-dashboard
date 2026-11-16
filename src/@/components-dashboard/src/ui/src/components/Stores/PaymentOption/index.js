import React from 'react'
import { ProviderPanel } from '../BusinessPaymentMethods/ProviderPanel'

// redesign stores 5.9: PaymentOption on ProviderPanel — the generic gateways (cash, card on delivery, Braintree without a template, Stripe Terminal…): channels, order types and, for cash and card on delivery, devices; no keys, no mode.
const DEVICES_GATEWAYS = ['cash', 'card_delivery']

export const PaymentOption = ({
  paymethod,
  businessPaymethod,
  gatewayName,
  storeName,
  sites,
  devices,
  orderTypes,
  extraTabs,
  initialTab,
  onTabChange,
  onSave
}) => {
  const tabs = [
    { id: 'channels', index: 0 },
    { id: 'order_types', index: 1 },
    ...(DEVICES_GATEWAYS.includes(paymethod?.gateway) ? [{ id: 'devices', index: 2 }] : [])
  ]

  return (
    <ProviderPanel
      paymethod={paymethod}
      businessPaymethod={businessPaymethod}
      gatewayName={gatewayName}
      storeName={storeName}
      tabs={tabs}
      extraTabs={extraTabs}
      initialTab={initialTab}
      onTabChange={onTabChange}
      sites={sites}
      devices={devices}
      orderTypes={orderTypes}
      onSave={onSave}
    />
  )
}
