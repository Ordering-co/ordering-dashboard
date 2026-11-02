import React from 'react'
import { useApi, useLanguage } from '../../../../../index'
import { McpCopyButton } from '../McpTokens/shared'
import {
  RedirectUriCard,
  RedirectUriNotes,
  RedirectUriRow,
  RedirectUriText,
  RedirectUriTitle,
  RedirectUriValue
} from './styles'

// The API sends Stripe its own public root (API_ROOT), not the one the Dashboard calls (api.orderingplus.com)
const STRIPE_CONNECT_API_ROOT = 'https://apiv4.ordering.co'

/**
 * The address Stripe sends a store back to after it connects its account.
 * Stripe only accepts it once the platform registers it, character by
 * character, in the OAuth settings of Connect. Version and language are fixed:
 * the API builds it that way whatever the Dashboard works with.
 */
export const getStripeConnectRedirectUri = (project) =>
  `${STRIPE_CONNECT_API_ROOT}/v400/en/${project}/stripe_connect_accounts/callback`

export const OAuthRedirectUri = () => {
  const [, t] = useLanguage()
  const [ordering] = useApi()

  if (!ordering?.project) return null

  const redirectUri = getStripeConnectRedirectUri(ordering.project)

  return (
    <RedirectUriCard>
      <RedirectUriTitle>{t('STRIPE_CONNECT_REDIRECT_URI_TITLE', 'OAuth redirect URI')}</RedirectUriTitle>
      <RedirectUriText>
        {t('STRIPE_CONNECT_REDIRECT_URI_HELP', 'Stripe sends a store back here after it connects its account. Add it in your Stripe Dashboard, in the Connect settings, under OAuth redirects.')}
      </RedirectUriText>
      <RedirectUriRow>
        <RedirectUriValue>{redirectUri}</RedirectUriValue>
        <McpCopyButton text={redirectUri} label={t('STRIPE_CONNECT_REDIRECT_URI_COPY', 'Copy OAuth redirect URI')} />
      </RedirectUriRow>
      <RedirectUriNotes>
        <li>{t('STRIPE_CONNECT_REDIRECT_URI_MODES', 'Test mode and live mode keep separate lists: add it in the mode you use, or in both if you use both.')}</li>
        <li>{t('STRIPE_CONNECT_REDIRECT_URI_STORES_ONLY', 'Only stores need it. Drivers use Express accounts and connect without it.')}</li>
      </RedirectUriNotes>
    </RedirectUriCard>
  )
}
