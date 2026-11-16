import React from 'react'
import { useLanguage } from '../../../../../index'
import { ProviderPanel } from '../BusinessPaymentMethods/ProviderPanel'

// redesign stores 5.10a: PaymentOptionMercadoPago on ProviderPanel — public key, access token, client ID and client secret per mode (Live and Sandbox), channels and order types.
const TABS = [
  { id: 'general', index: 0 },
  { id: 'channels', index: 1 },
  { id: 'order_types', index: 2 }
]

export const PaymentOptionMercadoPago = ({
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
  const publicKey = t('PUBLIC_KEY', 'Public key')
  const accessToken = t('ACCESS_TOKEN', 'Access token')
  const clientId = t('CLIENT_ID', 'Client ID')
  const clientSecret = t('CLIENT_SECRET', 'Client secret')
  const fields = [
    { key: 'public_key', label: publicKey, mode: 'live' },
    { key: 'access_token', label: accessToken, mode: 'live', secret: true },
    { key: 'client_id', label: clientId, mode: 'live' },
    { key: 'client_secret', label: clientSecret, mode: 'live', secret: true },
    { key: 'public_key', label: publicKey, mode: 'sandbox' },
    { key: 'access_token', label: accessToken, mode: 'sandbox', secret: true },
    { key: 'client_id', label: clientId, mode: 'sandbox' },
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
