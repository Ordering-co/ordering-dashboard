import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { TriangleAlert } from '../../Shared/Icon'
import { Button, InlineNotice } from '../../Shared/Product'
import { ProviderPanel } from '../BusinessPaymentMethods/ProviderPanel'
import './stripe-connect.css'

// redesign stores 5.11: Stripe Connect on ProviderPanel (decision B-1). «Connect with Stripe» opens Stripe's OAuth window
// (`onConnect`, the controller's `handleStripeConnect`, which answers a promise); its result enters the panel's DRAFT (`draftPatch`): the
// mode Stripe answered and the four keys of that mode, so they show as unsaved changes and Save stores them, as main stored them with its
// Save. The keys are read-only (main drew them disabled) and the two tokens are secrets (decision 7). Only the fields of the mode in use
// show: main always drew `data`, even when Stripe's test answer was stored in `data_sandbox`. The platform fees (level 0, as main) live
// on the business, not on the gateway: they are `extraFields` of the panel and `onSave` (`handleSaveStripeConnect`) posts them apart.
// The URL of the OAuth window, with the session token in `state`, is the controller's and is not touched here.
const TABS = [
  { id: 'general', index: 0 },
  { id: 'channels', index: 1 },
  { id: 'order_types', index: 2 }
]

export const PaymethodOptionStripeConnect = ({
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
  onConnect,
  business
}) => {
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const isAdmin = user?.level === 0
  const [patch, setPatch] = useState(null)
  const [notice, setNotice] = useState(null) // 'blocked' | 'error'
  const [waiting, setWaiting] = useState(false)
  const mounted = useRef(true)

  useEffect(() => () => { mounted.current = false }, [])

  // the four keys the OAuth answer fills, per mode (literal `t` calls: the i18n scanner reads them)
  const keys = [
    { key: 'token', label: t('ACCESS_TOKEN_ID', 'Access token ID'), secret: true },
    { key: 'publishable', label: t('PUBLISHABLE_KEY', 'Publishable key') },
    { key: 'user', label: t('ID_USER', 'User ID') },
    { key: 'refresh_token', label: t('REFRESH_TOKEN', 'Refresh token'), secret: true }
  ]
  const fields = ['live', 'sandbox'].flatMap(mode => keys.map(item => ({ ...item, mode, secret: !!item.secret, readOnly: true })))

  const extraFields = isAdmin
    ? [
        { key: 'fixed_usage_fee', label: t('FIXED_FEE', 'Fixed fee'), number: { min: 0 } },
        { key: 'percentage_usage_fee', label: t('PERCENTAGE_FEE', 'Percentage fee'), number: { min: 0, max: 100 } }
      ]
    : []
  const extraValues = isAdmin
    ? { fixed_usage_fee: business?.fixed_usage_fee, percentage_usage_fee: business?.percentage_usage_fee }
    : undefined

  // review 5.11 F3: a second click ends the first window's flow (it answers «closed»); only the latest attempt moves the state
  const attempt = useRef(0)
  const connect = async () => {
    const current = ++attempt.current
    setNotice(null)
    setWaiting(true)
    const result = await onConnect?.()
    if (!mounted.current || current !== attempt.current) return
    setWaiting(false)
    if (result?.ok) {
      // a new object each time: the panel merges it into the draft once
      setPatch({ sandbox: !!result.sandbox, [result.sandbox ? 'data_sandbox' : 'data']: result.data })
      return
    }
    if (result?.reason === 'blocked') setNotice('blocked')
    else if (result?.reason === 'error') setNotice('error')
  }

  const generalBefore = (
    <div className='odc-psc-connect'>
      <Button variant='primary' onClick={connect} aria-busy={waiting ? 'true' : undefined}>
        {t('CONNECT_WITH_STRIPE', 'Connect with stripe')}
      </Button>
      <p className='odc-psc-hint' aria-live='polite'>
        {waiting
          ? t('STRIPE_CONNECT_WAITING', 'Finish in the Stripe window. The keys fill in here when you are done.')
          : t('STRIPE_CONNECT_HINT', 'Opens Stripe in a new window. Its keys fill in below; then save.')}
      </p>
      {notice === 'blocked' && (
        <InlineNotice tone='warning' icon={TriangleAlert}>
          {t('STRIPE_CONNECT_POPUP_BLOCKED', 'Your browser blocked the Stripe window. Allow pop-ups for this site and try again.')}
        </InlineNotice>
      )}
      {notice === 'error' && (
        <InlineNotice tone='danger' icon={TriangleAlert}>
          {t('STRIPE_CONNECT_FAILED', 'Stripe did not connect the account. Try again.')}
        </InlineNotice>
      )}
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
      fieldsDisplay='active'
      fields={fields}
      extraFields={extraFields}
      extraValues={extraValues}
      draftPatch={patch}
      generalBefore={generalBefore}
      onSave={onSave}
    />
  )
}
