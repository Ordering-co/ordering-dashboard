export const DASHBOARD_AUTOLOGIN_LEVELS = [0, 2, 5, 8]

export const getAutologinApplyResult = ({
  queryProject,
  queryToken,
  apiError,
  user,
  fallbackProject
}) => {
  const persistSession = Boolean(
    queryProject &&
    queryToken &&
    !apiError &&
    DASHBOARD_AUTOLOGIN_LEVELS.includes(user?.level)
  )

  return {
    persistSession,
    providerProject: persistSession ? queryProject : fallbackProject
  }
}

export const HANDOFF_EXPIRED_NOTICE = 'handoff_expired'

const requestHandoffToken = async ({ apiRoot, code, fetchImpl }) => {
  try {
    const response = await fetchImpl(`${apiRoot}/auth/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    const { error, result } = await response.json()
    const token = result?.session?.access_token
    if (!response.ok || error || typeof token !== 'string' || !token) return null
    return token
  } catch {
    return null
  }
}

// A sign-in code is single use: StrictMode double effects or a remount must
// reuse the first exchange instead of posting the code a second time.
const handoffExchanges = new Map()

export const exchangeHandoffCode = ({ apiRoot, code, fetchImpl = globalThis.fetch }) => {
  if (!handoffExchanges.has(code)) {
    handoffExchanges.set(code, requestHandoffToken({ apiRoot, code, fetchImpl }))
  }
  return handoffExchanges.get(code)
}

// Message for the session UI, read once after the autologin finished.
let pendingNotice = null

export const setAutologinNotice = (notice) => {
  pendingNotice = notice
}

export const consumeAutologinNotice = () => {
  const notice = pendingNotice
  pendingNotice = null
  return notice
}

// Ends the session a one-time sign-in replaced. Fire-and-forget: the new login never
// waits for it and a failure is ignored.
export const revokeReplacedSession = ({ apiRoot, token, appId, fetchImpl = globalThis.fetch }) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
    if (appId) headers['X-APP-X'] = appId
    Promise.resolve(fetchImpl(`${apiRoot}/auth/logout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    })).catch(() => {})
  } catch {}
}
