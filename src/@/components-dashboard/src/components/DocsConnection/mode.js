import { getDocsConnectNonce } from './bridge'

/**
 * Docs-connect page mode (view only).
 *
 * `docs_connect_purpose` only picks the copy of the consent page. It never
 * reaches the bridge: origin, nonce, one reply and approval stay in bridge.js.
 */
export const DOCS_CONNECT_PURPOSES = Object.freeze(['docs', 'agent'])
export const DEFAULT_DOCS_CONNECT_PURPOSE = 'docs'

export const getDocsConnectPurpose = (search) => {
  const values = new URLSearchParams(search).getAll('docs_connect_purpose')
  if (values.length !== 1) return DEFAULT_DOCS_CONNECT_PURPOSE
  return DOCS_CONNECT_PURPOSES.includes(values[0]) ? values[0] : DEFAULT_DOCS_CONNECT_PURPOSE
}

/** The focused page replaces the Dashboard shell only for a valid docs_connect nonce. */
export const getDocsConnectMode = (search) => {
  const nonce = getDocsConnectNonce(search)
  return {
    active: Boolean(nonce),
    nonce,
    purpose: nonce ? getDocsConnectPurpose(search) : DEFAULT_DOCS_CONNECT_PURPOSE
  }
}

/**
 * Which screen the consent page shows:
 * loading → sign-in → preparing → consent → connected, or expired.
 */
export const getDocsConnectView = ({ loaded, auth, ready, connected, expired }) => {
  if (!loaded) return 'loading'
  if (connected) return 'connected'
  if (expired) return 'expired'
  if (!auth) return 'sign-in'
  if (!ready) return 'preparing'
  return 'consent'
}
