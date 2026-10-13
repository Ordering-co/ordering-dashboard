export const DOCS_CONNECT_ORIGIN = 'https://docs.ordering.co'
export const DOCS_CONNECT_MAX_AGE_MS = 10 * 60 * 1000

const NONCE_PATTERN = /^[a-f0-9]{32}$/

export const getDocsConnectNonce = (search) => {
  const values = new URLSearchParams(search).getAll('docs_connect')
  if (values.length !== 1 || !NONCE_PATTERN.test(values[0])) return null
  return values[0]
}

export const isDocsConnectRequest = ({
  event,
  nonce,
  target,
  startedAt,
  now = Date.now()
}) => {
  const data = event?.data
  return Boolean(
    nonce &&
      Number.isFinite(startedAt) &&
      now >= startedAt &&
      now - startedAt <= DOCS_CONNECT_MAX_AGE_MS &&
      target?.opener &&
      event?.origin === DOCS_CONNECT_ORIGIN &&
      event.source === target.opener &&
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      data.type === 'ordering-docs-connect' &&
      data.state === nonce
  )
}

export const isDashboardDocsSessionReady = (session, project) => Boolean(
  session?.loading === false &&
    session?.auth &&
    typeof session?.token === 'string' &&
    session.token &&
    session?.user &&
    typeof session.user === 'object' &&
    !Array.isArray(session.user) &&
    typeof session.project === 'string' &&
    session.project &&
    typeof project === 'string' &&
    project &&
    session.project === project
)

export const getDashboardDocsConnectionResponse = ({
  session,
  project,
  nonce,
  approval
}) => {
  if (
    !isDashboardDocsSessionReady(session, project) ||
    approval?.token !== session.token ||
    approval?.project !== project ||
    approval?.userId !== session.user.id
  ) {
    return null
  }

  return {
    type: 'ordering-docs-connected',
    state: nonce,
    provider: 'dashboard',
    token: session.token,
    project
  }
}

export const installDocsConnectionBridge = ({
  nonce,
  startedAt,
  getSession,
  getProject,
  getApproval,
  onRequest,
  onConnected,
  target = window,
  clock = Date.now
}) => {
  if (!nonce) return () => {}

  let hasResponded = false
  const handleMessage = (event) => {
    if (
      hasResponded ||
      !isDocsConnectRequest({ event, nonce, target, startedAt, now: clock() })
    ) {
      return
    }

    onRequest?.()
    const response = getDashboardDocsConnectionResponse({
      session: getSession(),
      project: getProject(),
      nonce,
      approval: getApproval()
    })
    if (!response || typeof event.source?.postMessage !== 'function') return

    hasResponded = true
    event.source.postMessage(response, DOCS_CONNECT_ORIGIN)
    onConnected?.()
  }

  target.addEventListener('message', handleMessage)
  return () => target.removeEventListener('message', handleMessage)
}
