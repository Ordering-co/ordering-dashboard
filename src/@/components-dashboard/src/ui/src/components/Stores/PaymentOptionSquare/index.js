import React from 'react'
import { useLanguage } from '../../../../../index'
import { ProviderPanel } from '../BusinessPaymentMethods/ProviderPanel'

// redesign stores 5.10b: PaymentOptionSquare on ProviderPanel — an application ID, a location ID and a client secret per mode (Live and Sandbox), channels, order types and devices.
// G4-02 (1.B): this form once ran on the customer-checkout Square controller, which threw on open; it now saves through the panel's `onSave`, like PayPal.
// D-16 (owner, stage 2): «Connect with Square» is gone: it never had a handler (no Square OAuth flow, in main either). An OAuth flow
// goes to backend only if the business wants to sell Square with it.
const TABS = [
  { id: 'general', index: 0 },
  { id: 'channels', index: 1 },
  { id: 'order_types', index: 2 },
  { id: 'devices', index: 3 }
]

export const PaymentOptionSquare = ({
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
  const applicationId = t('APPLICATION_ID', 'Application Id')
  const locationId = t('LOCATION_ID', 'Location Id')
  const clientSecret = t('CLIENT_SECRET', 'Client secret')
  const fields = [
    { key: 'application_id', label: applicationId, mode: 'live' },
    { key: 'location_id', label: locationId, mode: 'live' },
    { key: 'client_secret', label: clientSecret, mode: 'live', secret: true },
    { key: 'application_id', label: applicationId, mode: 'sandbox' },
    { key: 'location_id', label: locationId, mode: 'sandbox' },
    { key: 'client_secret', label: clientSecret, mode: 'sandbox', secret: true }
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
