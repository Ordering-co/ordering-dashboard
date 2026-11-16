import React from 'react'
import { useApi, useLanguage } from '../../../../../index'
import { getStripeConnectLegacyRedirectUri, getStripeConnectRedirectUri } from '../../../../../utils/stripeConnectRedirectUris'
import { McpCopyButton } from '../McpTokens/shared'
import {
  RedirectUriCard,
  RedirectUriItem,
  RedirectUriLabel,
  RedirectUriNotes,
  RedirectUriRow,
  RedirectUriText,
  RedirectUriTitle,
  RedirectUriValue
} from './styles'

export { getStripeConnectRedirectUri }

/**
 * The addresses Stripe sends a store back to after it connects its account,
 * one per payment method: Stripe Connect and Stripe Connect v2 each finish
 * on their own. A platform that registers only one of them cannot connect
 * stores with the other method, so both are always shown.
 */
export const OAuthRedirectUri = () => {
  const [, t] = useLanguage()
  const [ordering] = useApi()

  if (!ordering?.project) return null

  const copyLabel = t('STRIPE_CONNECT_REDIRECT_URI_COPY', 'Copy OAuth redirect URI')
  const redirectUris = [
    {
      key: 'stripe_connect',
      label: t('STRIPE_CONNECT_REDIRECT_URI_LEGACY_LABEL', 'Stripe Connect'),
      uri: getStripeConnectLegacyRedirectUri(ordering.url, ordering.project)
    },
    {
      key: 'stripe_connect_v2',
      label: t('STRIPE_CONNECT_REDIRECT_URI_V2_LABEL', 'Stripe Connect v2'),
      uri: getStripeConnectRedirectUri(ordering.project)
    }
  ]

  return (
    <RedirectUriCard>
      <RedirectUriTitle>{t('STRIPE_CONNECT_REDIRECT_URI_TITLE', 'OAuth redirect URI')}</RedirectUriTitle>
      <RedirectUriText>
        {t('STRIPE_CONNECT_REDIRECT_URI_HELP', 'Stripe sends a store back here after it connects its account. Add it in your Stripe Dashboard, in the Connect settings, under OAuth redirects.')}
      </RedirectUriText>
      {redirectUris.map(({ key, label, uri }) => (
        <RedirectUriItem key={key}>
          <RedirectUriLabel>{label}</RedirectUriLabel>
          <RedirectUriRow>
            <RedirectUriValue>{uri}</RedirectUriValue>
            <McpCopyButton text={uri} label={`${copyLabel}: ${label}`} />
          </RedirectUriRow>
        </RedirectUriItem>
      ))}
      <RedirectUriNotes>
        <li>{t('STRIPE_CONNECT_REDIRECT_URI_EACH_METHOD', 'Each payment method returns to its own address: add both, so stores can connect with either.')}</li>
        <li>{t('STRIPE_CONNECT_REDIRECT_URI_MODES', 'Test mode and live mode keep separate lists: add it in the mode you use, or in both if you use both.')}</li>
        <li>{t('STRIPE_CONNECT_REDIRECT_URI_STORES_ONLY', 'Only stores need it. Drivers use Express accounts and connect without it.')}</li>
      </RedirectUriNotes>
    </RedirectUriCard>
  )
}
