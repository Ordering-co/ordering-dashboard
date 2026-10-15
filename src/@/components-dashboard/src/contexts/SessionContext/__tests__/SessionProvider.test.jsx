/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo', project: 'demo' }]
}))

import { WebStrategy } from '../../../webStrategy'
import { SessionProvider, useSession } from '..'

const billingUrl = 'https://partners.test'
const trialExpire = 'Your project is not active, please pay your invoice or contact the Ordering.co sales team for assistance.'

const SessionState = () => {
  const [{ auth, loading }] = useSession()
  return <div data-testid='session'>{loading ? 'loading' : String(auth)}</div>
}

const renderProvider = () => render(
  <SessionProvider strategy={new WebStrategy()} settings={{ billing_url: billingUrl }}>
    <SessionState />
  </SessionProvider>
)

const storeSession = (user) => {
  localStorage.setItem('token', 'stored-token')
  localStorage.setItem('project', 'demo')
  localStorage.setItem('user', JSON.stringify(user))
}

const respond = (status, content) => vi.fn().mockResolvedValue({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(content)
})

const waitForSession = () => waitFor(() => expect(screen.getByTestId('session')).not.toHaveTextContent('loading'))

describe('SessionProvider stored session check', () => {
  let replace

  beforeEach(() => {
    localStorage.clear()
    replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, search: '', replace, reload: vi.fn() })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('validates the token with /users/me instead of /order_options', async () => {
    storeSession({ id: 1, level: 0 })
    const fetchMock = respond(200, { error: false, result: { id: 1, level: 0, enabled: true } })
    vi.stubGlobal('fetch', fetchMock)

    renderProvider()
    await waitForSession()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/v400/en/demo/users/me?params=id,level,enabled')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer stored-token')
    expect(screen.getByTestId('session')).toHaveTextContent('stored-token')
    expect(localStorage.getItem('token')).toBe('stored-token')
  })

  it('keeps a call center agent (level 8) signed in', async () => {
    storeSession({ id: 8, level: 8 })
    vi.stubGlobal('fetch', respond(200, { error: false, result: { id: 8, level: 8, enabled: true } }))

    renderProvider()
    await waitForSession()

    expect(screen.getByTestId('session')).toHaveTextContent('stored-token')
  })

  it('logs out when the token is rejected', async () => {
    storeSession({ id: 1, level: 0, user_system_id: 10 })
    vi.stubGlobal('fetch', respond(401, { error: true, result: ['You do not have permission'] }))

    renderProvider()
    await waitForSession()

    expect(screen.getByTestId('session')).toHaveTextContent('false')
    expect(localStorage.getItem('token')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })

  it('logs out a level 7 user', async () => {
    storeSession({ id: 7, level: 7 })
    vi.stubGlobal('fetch', respond(200, { error: false, result: { id: 7, level: 7, enabled: true } }))

    renderProvider()
    await waitForSession()

    expect(screen.getByTestId('session')).toHaveTextContent('false')
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('sends a billing user to billing when the project is not active', async () => {
    storeSession({ id: 1, level: 0, user_system_id: 10 })
    vi.stubGlobal('fetch', respond(401, { error: true, result: trialExpire }))

    renderProvider()
    await waitForSession()

    expect(localStorage.getItem('token')).toBeNull()
    expect(replace).toHaveBeenCalledWith(billingUrl)
  })

  it('keeps an inactive stored session in the docs connection popup for a fresh sign-in', async () => {
    const search = '?docs_connect=0123456789abcdef0123456789abcdef&docs_connect_purpose=agent'
    vi.stubGlobal('location', { ...window.location, search, replace, reload: vi.fn() })
    storeSession({ id: 1, level: 0, user_system_id: 10 })
    vi.stubGlobal('fetch', respond(401, { error: true, result: trialExpire }))

    renderProvider()
    await waitForSession()

    expect(screen.getByTestId('session')).toHaveTextContent('false')
    expect(localStorage.getItem('token')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
    expect(window.location.search).toBe(search)
  })

  it.each([
    '?docs_connect=invalid',
    '?docs_connect=0123456789abcdef0123456789abcdef&docs_connect=0123456789abcdef0123456789abcdef',
    '?docs_connect_purpose=agent'
  ])('keeps the normal billing redirect for an invalid connection query: %s', async (search) => {
    vi.stubGlobal('location', { ...window.location, search, replace, reload: vi.fn() })
    storeSession({ id: 1, level: 0, user_system_id: 10 })
    vi.stubGlobal('fetch', respond(401, { error: true, result: trialExpire }))

    renderProvider()
    await waitForSession()

    expect(localStorage.getItem('token')).toBeNull()
    expect(replace).toHaveBeenCalledWith(billingUrl)
  })

  it('does not send a user without billing account to billing', async () => {
    storeSession({ id: 1, level: 0 })
    vi.stubGlobal('fetch', respond(401, { error: true, result: trialExpire }))

    renderProvider()
    await waitForSession()

    expect(localStorage.getItem('token')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })

  it('keeps the session when the API is down', async () => {
    storeSession({ id: 1, level: 0 })
    vi.stubGlobal('fetch', respond(503, { error: true, result: 'Maintenance' }))

    renderProvider()
    await waitForSession()

    expect(screen.getByTestId('session')).toHaveTextContent('stored-token')
    expect(localStorage.getItem('token')).toBe('stored-token')
  })

  it('keeps the session on a network error', async () => {
    storeSession({ id: 1, level: 0 })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    renderProvider()
    await waitForSession()

    expect(screen.getByTestId('session')).toHaveTextContent('stored-token')
  })

  it('does not call the API without a stored token', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderProvider()
    await waitForSession()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('session')).toHaveTextContent('null')
  })
})

describe('SessionProvider local tenant identity', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('does not send a global tenant token to the configured local API or erase its cache', async () => {
    storeSession({ id: 99, level: 5 })
    localStorage.setItem('drivers_cache_99', 'untouched')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const settings = { project: 'demo', localProjectConfigured: true, local_project_pin: 'demo', api: { url: 'https://api.test', version: 'v400' } }
    render(
      <SessionProvider strategy={new WebStrategy(settings)} settings={settings}>
        <SessionState />
      </SessionProvider>
    )
    await waitForSession()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('session')).toHaveTextContent('null')
    expect(localStorage.getItem('token')).toBe('stored-token')
    expect(localStorage.getItem('drivers_cache_99')).toBe('untouched')
  })

  it('validates a scoped session for the matching tenant', async () => {
    const settings = { project: 'demo', localProjectConfigured: true, local_project_pin: 'demo', api: { url: 'https://api.test', version: 'v400' } }
    const strategy = new WebStrategy(settings)
    await strategy.setItem('project', 'demo')
    await strategy.setItem('token', 'matching-token')
    await strategy.setItem('user', { id: 1, level: 0 }, true)
    const fetchMock = respond(200, { error: false, result: { id: 1, level: 0, enabled: true } })
    vi.stubGlobal('fetch', fetchMock)
    render(
      <SessionProvider strategy={strategy} settings={settings}>
        <SessionState />
      </SessionProvider>
    )
    await waitForSession()
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer matching-token')
    expect(screen.getByTestId('session')).toHaveTextContent('matching-token')
  })
})

it('local driver logout removes only its scoped cache and identity', async () => {
  localStorage.clear()
  const settings = { project: 'demo', localProjectConfigured: true, local_project_pin: 'demo', api: { url: 'https://api.test', version: 'v400' } }
  const strategy = new WebStrategy(settings)
  await strategy.setItem('project', 'demo')
  await strategy.setItem('token', 'driver-token')
  await strategy.setItem('user', { id: 5, level: 5 }, true)
  await strategy.setItem('drivers_cache_5', 'local-cache')
  localStorage.setItem('drivers_cache_5', 'other-tenant-cache')
  localStorage.setItem('token', 'other-tenant-token')
  vi.stubGlobal('fetch', respond(200, { error: false, result: { id: 5, level: 5, enabled: true } }))
  const SessionActions = () => {
    const [, { logout }] = useSession()
    return <button onClick={logout}>Log out local driver</button>
  }
  render(
    <SessionProvider strategy={strategy} settings={settings}>
      <SessionState />
      <SessionActions />
    </SessionProvider>
  )
  await waitForSession()
  fireEvent.click(screen.getByRole('button', { name: 'Log out local driver' }))
  await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('false'))
  expect(await strategy.getItem('drivers_cache_5')).toBeNull()
  expect(await strategy.getItem('token')).toBeNull()
  expect(localStorage.getItem('drivers_cache_5')).toBe('other-tenant-cache')
  expect(localStorage.getItem('token')).toBe('other-tenant-token')
  vi.unstubAllGlobals()
})
