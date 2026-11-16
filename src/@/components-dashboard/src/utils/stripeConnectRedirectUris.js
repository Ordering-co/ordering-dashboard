/**
 * The two addresses Stripe sends a store back to after it authorizes the
 * platform, one per payment method. Stripe only accepts an address the
 * platform registered, character by character, in the OAuth settings of
 * Connect, so version and language are fixed in both.
 */

// The API builds this one with its own public root (API_ROOT), not the one the Dashboard calls (api.orderingplus.com)
const STRIPE_CONNECT_API_ROOT = 'https://apiv4.ordering.co'

/**
 * Stripe Connect v2 (`stripe_connect_v2`): the API saves the account there.
 */
export const getStripeConnectRedirectUri = (project) =>
  `${STRIPE_CONNECT_API_ROOT}/v400/en/${project}/stripe_connect_accounts/callback`

/**
 * Stripe Connect (`stripe_connect`): the window the Dashboard opened ends on
 * this page and hands it the keys with postMessage, which only works when
 * the page is on the API the Dashboard calls. That is why it hangs from
 * `apiUrl` (the client's `ordering.url`) and not from the root above.
 */
export const getStripeConnectLegacyRedirectUri = (apiUrl, project) =>
  `${String(apiUrl || '').replace(/\/+$/, '')}/v400/en/${project}/payments/stripe_connect/callback`
