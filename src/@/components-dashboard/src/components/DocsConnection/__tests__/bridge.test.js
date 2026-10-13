import {
  DOCS_CONNECT_ORIGIN,
  getDashboardDocsConnectionResponse,
  getDocsConnectNonce,
  installDocsConnectionBridge,
  isDashboardDocsSessionReady
} from '../bridge'

const nonce = '0123456789abcdef0123456789abcdef'

const createHarness = (session, selectedProject = 'demo') => {
  const project = { current: selectedProject }
  const postedMessages = []
  const opener = {
    postMessage: (message, targetOrigin) => {
      postedMessages.push({ message, targetOrigin })
    }
  }
  const listeners = new Map()
  const target = {
    opener,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => listeners.delete(type)
  }
  const clock = { current: 1001 }
  const approval = { current: null }
  const requests = { count: 0 }
  const dispatch = (overrides = {}) => {
    listeners.get('message')?.({
      origin: DOCS_CONNECT_ORIGIN,
      source: opener,
      data: { type: 'ordering-docs-connect', state: nonce },
      ...overrides
    })
  }
  const stop = installDocsConnectionBridge({
    nonce,
    startedAt: 1000,
    getSession: () => session.current,
    getProject: () => project.current,
    getApproval: () => approval.current,
    onRequest: () => { requests.count += 1 },
    target,
    clock: () => clock.current
  })

  return {
    clock,
    dispatch,
    listeners,
    opener,
    postedMessages,
    project,
    approval,
    requests,
    session,
    stop,
    target
  }
}

const authenticatedSession = () => ({
  current: {
    auth: true,
    loading: false,
    project: 'demo',
    token: 'dashboard-access-token',
    user: { id: 7 }
  }
})

describe('docs connection bridge', () => {
  it('accepts only one well-formed lowercase nonce from the URL', () => {
    expect(getDocsConnectNonce(`?docs_connect=${nonce}`)).toBe(nonce)
    expect(getDocsConnectNonce('')).toBeNull()
    expect(getDocsConnectNonce('?docs_connect=invalid')).toBeNull()
    expect(getDocsConnectNonce(`?docs_connect=${nonce.toUpperCase()}`)).toBeNull()
    expect(getDocsConnectNonce(`?docs_connect=${nonce}&docs_connect=${nonce}`)).toBeNull()
  })

  it('does not respond to requests from untrusted origins, sources, or state', () => {
    const harness = createHarness(authenticatedSession())
    harness.dispatch({ origin: 'https://attacker.example' })
    harness.dispatch({ source: {} })
    harness.dispatch({ data: { type: 'ordering-docs-connect', state: 'wrong' } })
    expect(harness.postedMessages).toEqual([])
    expect(harness.requests.count).toBe(0)
    harness.stop()
  })

  it('does not install a listener without a valid initial nonce', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    const uninstall = installDocsConnectionBridge({
      nonce: null,
      startedAt: 1000,
      getSession: () => authenticatedSession().current,
      getProject: () => 'demo',
      getApproval: () => null,
      target
    })
    expect(target.addEventListener).not.toHaveBeenCalled()
    uninstall()
  })

  it('rejects requests after the nonce has expired', () => {
    const harness = createHarness(authenticatedSession())
    harness.clock.current = 1000 + 10 * 60 * 1000 + 1
    harness.dispatch()
    expect(harness.postedMessages).toEqual([])
    harness.stop()
  })

  it('waits for authentication, a matching project, and explicit consent', () => {
    const session = { current: { auth: false, loading: true } }
    const harness = createHarness(session)
    harness.dispatch()
    expect(harness.postedMessages).toEqual([])
    expect(harness.requests.count).toBe(1)

    session.current = authenticatedSession().current
    harness.project.current = 'other-project'
    harness.dispatch()
    expect(harness.postedMessages).toEqual([])

    harness.project.current = 'demo'
    harness.dispatch()
    expect(harness.postedMessages).toEqual([])
    harness.approval.current = {
      token: 'dashboard-access-token',
      project: 'demo',
      userId: 7
    }
    harness.dispatch()
    expect(harness.postedMessages).toHaveLength(1)
    harness.stop()
  })

  it('sends the dashboard token and project once after approval', () => {
    const harness = createHarness(authenticatedSession())
    harness.dispatch()
    harness.dispatch()
    expect(harness.postedMessages).toEqual([])
    harness.approval.current = {
      token: 'dashboard-access-token',
      project: 'demo',
      userId: 7
    }
    harness.dispatch()
    harness.dispatch()
    expect(harness.postedMessages).toEqual([{
      message: {
        type: 'ordering-docs-connected',
        state: nonce,
        provider: 'dashboard',
        token: 'dashboard-access-token',
        project: 'demo'
      },
      targetOrigin: DOCS_CONNECT_ORIGIN
    }])
    harness.stop()
    expect(harness.listeners.has('message')).toBe(false)
  })

  it('rejects a session not bound to the selected project', () => {
    expect(isDashboardDocsSessionReady(
      { ...authenticatedSession().current, project: 'old-project' },
      'demo'
    )).toBe(false)
    expect(getDashboardDocsConnectionResponse({
      session: { ...authenticatedSession().current, project: 'old-project' },
      project: 'demo',
      nonce,
      approval: { token: 'dashboard-access-token', project: 'demo', userId: 7 }
    })).toBeNull()
  })

  it('does not respond when approval belongs to a different session', () => {
    const harness = createHarness(authenticatedSession())
    harness.approval.current = {
      token: 'previous-session-token',
      project: 'demo',
      userId: 7
    }
    harness.dispatch()
    expect(harness.postedMessages).toEqual([])
    harness.stop()
  })
})
