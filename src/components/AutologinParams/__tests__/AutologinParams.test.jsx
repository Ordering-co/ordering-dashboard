import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('~ui', () => ({
  SpinnerLoader: () => {
    window.__autologinSpinnerMounted = true
    return <div data-testid='spinner' />
  },
  AppBootLoader: () => {
    window.__autologinBootMounted = true
    return <div data-testid='boot-home' />
  }
}))

import { AutologinParams } from '../index'
import { consumeAutologinNotice } from '../autologinSession'
import { WebStrategy } from '../../../@/components-dashboard/src/webStrategy'

const Dashboard = ({ settings }) => (
  <div data-testid='dashboard' data-project={settings.project} />
)

describe('AutologinParams', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.__autologinSpinnerMounted = false
    window.__autologinBootMounted = false
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    delete window.__ORDERING_AUTOLOGIN__
    delete window.__autologinSpinnerMounted
    delete window.__autologinBootMounted
    window.history.replaceState(null, '', '/')
    vi.unstubAllGlobals()
  })

  it('does not mount a boot spinner when there is no autologin token', () => {
    render(
      <AutologinParams configFile={{ project: 'default-project' }}>
        <Dashboard />
      </AutologinParams>
    )

    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    expect(window.__autologinSpinnerMounted).toBe(false)
    expect(window.__autologinBootMounted).toBe(false)
  })

  it('shows the home boot loader while applying autologin params', () => {
    window.history.replaceState(null, '', '/orders?token=session-token&project=tenant-project')
    fetch.mockImplementation(() => new Promise(() => {}))

    render(
      <AutologinParams configFile={{ project: 'default-project' }}>
        <Dashboard />
      </AutologinParams>
    )

    expect(screen.getByTestId('boot-home')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument()
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
  })

  it('removes authentication parameters after a successful login', async () => {
    window.history.replaceState(
      null,
      '',
      '/orders?token=session-token&project=tenant-project&filter=open#details'
    )
    fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        error: false,
        result: { id: 1, level: 0 }
      })
    })

    render(
      <AutologinParams configFile={{ project: 'default-project' }}>
        <Dashboard />
      </AutologinParams>
    )

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'tenant-project')
    expect(window.location.pathname).toBe('/orders')
    expect(window.location.search).toBe('?filter=open')
    expect(window.location.hash).toBe('#details')
    expect(window.localStorage.getItem('token')).toBe('session-token')
    expect(window.localStorage.getItem('project')).toBe('tenant-project')
  })

  it('removes authentication parameters when the token is rejected', async () => {
    window.history.replaceState(null, '', '/orders?token=invalid-token&project=tenant-project')
    fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        error: true,
        result: {}
      })
    })

    render(
      <AutologinParams configFile={{ project: 'default-project' }}>
        <Dashboard />
      </AutologinParams>
    )

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument()
    expect(window.location.search).toBe('')
    expect(window.localStorage.getItem('token')).toBeNull()
  })

  it('does not wipe an existing session when the autologin token is rejected', async () => {
    window.localStorage.setItem('token', 'existing-token')
    window.localStorage.setItem('user', JSON.stringify({ id: 2, level: 0 }))
    window.localStorage.setItem('project', 'project-a')
    window.history.replaceState(null, '', '/orders?token=invalid-token&project=project-b')
    fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        error: true,
        result: {}
      })
    })

    render(
      <AutologinParams configFile={{ project: 'project-a' }}>
        <Dashboard />
      </AutologinParams>
    )

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'project-a')
    expect(window.localStorage.getItem('token')).toBe('existing-token')
    expect(window.localStorage.getItem('project')).toBe('project-a')
  })

  it('logs in from the in-memory stash when the token is already gone from the URL', async () => {
    window.__ORDERING_AUTOLOGIN__ = { token: 'stashed-token', project: 'tenant-project' }
    window.history.replaceState(null, '', '/orders?filter=open')
    fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        error: false,
        result: { id: 1, level: 0 }
      })
    })

    render(
      <AutologinParams configFile={{ project: 'default-project' }}>
        <Dashboard />
      </AutologinParams>
    )

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'tenant-project')
    expect(window.location.search).toBe('?filter=open')
    expect(window.localStorage.getItem('token')).toBe('stashed-token')
    expect(window.localStorage.getItem('project')).toBe('tenant-project')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/tenant-project/users/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer stashed-token'
        })
      })
    )
  })

  it('persists a level 8 autologin session', async () => {
    window.history.replaceState(null, '', '/?token=level-8-token&project=tenant-project')
    fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        error: false,
        result: { id: 8, level: 8 }
      })
    })

    render(
      <AutologinParams configFile={{ project: 'default-project' }}>
        <Dashboard />
      </AutologinParams>
    )

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'tenant-project')
    expect(window.localStorage.getItem('token')).toBe('level-8-token')
    expect(window.localStorage.getItem('project')).toBe('tenant-project')
  })
})

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(body)
})

describe('AutologinParams handoff code', () => {
  beforeEach(() => {
    window.localStorage.clear()
    consumeAutologinNotice()
  })

  afterEach(() => {
    delete window.__ORDERING_AUTOLOGIN__
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.unstubAllGlobals()
  })

  it('exchanges the code once and logs in through the token path', async () => {
    window.__ORDERING_AUTOLOGIN__ = { token: null, code: 'handoff-ok', project: 'tenant-project' }
    window.history.replaceState(null, '', '/?project=tenant-project')
    const fetchMock = vi.fn((url) => Promise.resolve(url.endsWith('/auth/handoff')
      ? jsonResponse(200, { error: false, result: { id: 1, level: 0, session: { access_token: 'handoff-jwt', token_type: 'bearer', expires_in: 3600 } } })
      : jsonResponse(200, { error: false, result: { id: 1, level: 0 } })))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <React.StrictMode>
        <AutologinParams configFile={{ project: 'default-project' }}>
          <Dashboard />
        </AutologinParams>
      </React.StrictMode>
    )

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'tenant-project')
    const handoffCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/tenant-project/auth/handoff'))
    expect(handoffCalls).toHaveLength(1)
    expect(handoffCalls[0][1]).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'handoff-ok' })
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/tenant-project/users/me'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer handoff-jwt' }) })
    )
    expect(window.localStorage.getItem('token')).toBe('handoff-jwt')
    expect(window.localStorage.getItem('project')).toBe('tenant-project')
    expect(window.location.search).toBe('')
    expect(window.__ORDERING_AUTOLOGIN__).toBeUndefined()
    expect(consumeAutologinNotice()).toBeNull()
  })

  it('falls back to the login screen and leaves a notice when the code is rejected', async () => {
    window.history.replaceState(null, '', '/?project=tenant-project&code=handoff-expired')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, {
      error: true,
      result: ['The access link expired.'],
      error_codes: ['auth_handoff.invalid']
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AutologinParams configFile={{ project: 'default-project' }}>
        <Dashboard />
      </AutologinParams>
    )

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'default-project')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('token')).toBeNull()
    expect(window.location.search).toBe('')
    expect(consumeAutologinNotice()).toBe('handoff_expired')
  })

  it('ignores `code` outside the root path', async () => {
    window.history.replaceState(null, '', '/password/reset?code=reset-code&random=abc')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AutologinParams configFile={{ project: 'default-project' }}>
        <Dashboard />
      </AutologinParams>
    )

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?code=reset-code&random=abc')
  })
})

const storeSession = ({ token, project, user }) => {
  window.localStorage.setItem('token', token)
  window.localStorage.setItem('project', project)
  window.localStorage.setItem('user', JSON.stringify(user))
}

const handoffFetch = ({ handoff, me, logout } = {}) => vi.fn((url) => {
  if (url.endsWith('/auth/handoff')) return Promise.resolve(handoff ?? jsonResponse(200, { error: false, result: { session: { access_token: 'support-jwt' } } }))
  if (url.endsWith('/users/me')) return Promise.resolve(me ?? jsonResponse(200, { error: false, result: { id: 99, level: 0, email: 'support@ordering.co' } }))
  if (url.endsWith('/auth/logout')) return logout ? logout() : Promise.resolve(jsonResponse(200, { error: false, result: 'OK' }))
  return Promise.reject(new Error(`unexpected ${url}`))
})

const callsTo = (fetchMock, suffix) => fetchMock.mock.calls.filter(([url]) => url.endsWith(suffix))

const renderHandoff = (configFile = { project: 'project-a' }) => render(
  <AutologinParams configFile={configFile}>
    <Dashboard />
  </AutologinParams>
)

describe('AutologinParams handoff over an existing session', () => {
  beforeEach(() => {
    window.localStorage.clear()
    consumeAutologinNotice()
  })

  afterEach(() => {
    delete window.__ORDERING_AUTOLOGIN__
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.unstubAllGlobals()
  })

  it('asks before switching to another project and Stay keeps the session without calling the API', async () => {
    storeSession({ token: 'owner-token', project: 'project-a', user: { id: 2, level: 0, email: 'owner@store.com' } })
    window.history.replaceState(null, '', '/?project=project-b&code=handoff-stay')
    const fetchMock = handoffFetch()
    vi.stubGlobal('fetch', fetchMock)

    renderHandoff()

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('You are signed in to project-a as owner@store.com. Switch to project-b as support?')
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'project-a')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('token')).toBe('owner-token')
    expect(window.localStorage.getItem('project')).toBe('project-a')
    expect(window.location.search).toBe('')
    expect(window.__ORDERING_AUTOLOGIN__).toBeUndefined()
  })

  it('Switch to another project exchanges the code and logs out the old session on its project', async () => {
    storeSession({ token: 'owner-token', project: 'project-a', user: { id: 2, level: 0, email: 'owner@store.com' } })
    window.history.replaceState(null, '', '/?project=project-b&code=handoff-switch')
    const fetchMock = handoffFetch()
    vi.stubGlobal('fetch', fetchMock)

    renderHandoff()
    fireEvent.click(await screen.findByRole('button', { name: 'Switch' }))

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'project-b')
    expect(callsTo(fetchMock, '/project-b/auth/handoff')).toHaveLength(1)
    expect(window.localStorage.getItem('token')).toBe('support-jwt')
    expect(window.localStorage.getItem('project')).toBe('project-b')
    const logoutCalls = callsTo(fetchMock, '/auth/logout')
    expect(logoutCalls).toHaveLength(1)
    expect(logoutCalls[0][0]).toMatch(/\/project-a\/auth\/logout$/)
    expect(logoutCalls[0][1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer owner-token' } })
  })

  it('keeps the new session when the old session logout fails', async () => {
    storeSession({ token: 'owner-token', project: 'project-a', user: { id: 2, level: 0 } })
    window.history.replaceState(null, '', '/?project=project-b&code=handoff-logout-fails')
    const fetchMock = handoffFetch({ logout: () => Promise.reject(new Error('offline')) })
    vi.stubGlobal('fetch', fetchMock)

    renderHandoff()
    fireEvent.click(await screen.findByRole('button', { name: 'Switch' }))

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'project-b')
    await waitFor(() => expect(callsTo(fetchMock, '/auth/logout')).toHaveLength(1))
    expect(window.localStorage.getItem('token')).toBe('support-jwt')
    expect(window.localStorage.getItem('project')).toBe('project-b')
  })

  it('fires no logout when the exchange fails', async () => {
    storeSession({ token: 'owner-token', project: 'project-a', user: { id: 2, level: 0 } })
    window.history.replaceState(null, '', '/?project=project-a&code=handoff-fails')
    const fetchMock = handoffFetch({ handoff: jsonResponse(401, { error: true, result: ['expired'], error_codes: ['auth_handoff.invalid'] }) })
    vi.stubGlobal('fetch', fetchMock)

    renderHandoff()

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'project-a')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/auth/logout')).toHaveLength(0)
    expect(window.localStorage.getItem('token')).toBe('owner-token')
  })

  it('same project and same user replaces the session without asking', async () => {
    storeSession({ token: 'old-support-token', project: 'project-a', user: { id: 99, level: 0, email: 'support@ordering.co' } })
    window.history.replaceState(null, '', '/?project=project-a&code=handoff-same-user')
    const fetchMock = handoffFetch()
    vi.stubGlobal('fetch', fetchMock)

    renderHandoff()

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'project-a')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem('token')).toBe('support-jwt')
    const logoutCalls = callsTo(fetchMock, '/project-a/auth/logout')
    expect(logoutCalls).toHaveLength(1)
    expect(logoutCalls[0][1].headers.Authorization).toBe('Bearer old-support-token')
  })

  it('same project and a different user asks after the exchange; Stay logs out the new token', async () => {
    storeSession({ token: 'owner-token', project: 'project-a', user: { id: 2, level: 0, email: 'owner@store.com' } })
    window.history.replaceState(null, '', '/?project=project-a&code=handoff-user-stay')
    const fetchMock = handoffFetch()
    vi.stubGlobal('fetch', fetchMock)

    renderHandoff()

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('You are signed in to project-a as owner@store.com. Switch to support@ordering.co (support)?')
    expect(callsTo(fetchMock, '/auth/handoff')).toHaveLength(1)
    expect(window.localStorage.getItem('token')).toBe('owner-token')

    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'project-a')
    expect(window.localStorage.getItem('token')).toBe('owner-token')
    expect(JSON.parse(window.localStorage.getItem('user')).id).toBe(2)
    const logoutCalls = callsTo(fetchMock, '/project-a/auth/logout')
    expect(logoutCalls).toHaveLength(1)
    expect(logoutCalls[0][1].headers.Authorization).toBe('Bearer support-jwt')
  })

  it('same project and a different user: Switch persists and logs out the old token', async () => {
    storeSession({ token: 'owner-token', project: 'project-a', user: { id: 2, level: 0, email: 'owner@store.com' } })
    window.history.replaceState(null, '', '/?project=project-a&code=handoff-user-switch')
    const fetchMock = handoffFetch()
    vi.stubGlobal('fetch', fetchMock)

    renderHandoff()
    fireEvent.click(await screen.findByRole('button', { name: 'Switch' }))

    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'project-a')
    expect(window.localStorage.getItem('token')).toBe('support-jwt')
    expect(JSON.parse(window.localStorage.getItem('user')).id).toBe(99)
    expect(callsTo(fetchMock, '/auth/handoff')).toHaveLength(1)
    const logoutCalls = callsTo(fetchMock, '/project-a/auth/logout')
    expect(logoutCalls).toHaveLength(1)
    expect(logoutCalls[0][1].headers.Authorization).toBe('Bearer owner-token')
  })
})

describe('local project pin autologin', () => {
  afterEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.unstubAllGlobals()
  })

  it('drops a different tenant query without validating or storing its token', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.setItem('token', 'untouched-other-token')
    window.history.replaceState(null, '', '/orders?project=tenant-b&token=wrong-tenant-token')
    render(
      <AutologinParams configFile={{ project: 'tenant-a', localProjectConfigured: true, local_project_pin: 'tenant-a' }}>
        <Dashboard />
      </AutologinParams>
    )
    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'tenant-a')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
    expect(window.localStorage.getItem('token')).toBe('untouched-other-token')
  })

  it('persists a matching autologin into scoped storage and preserves global identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ error: false, result: { id: 1, level: 0 } }) })
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.setItem('token', 'untouched-other-token')
    window.history.replaceState(null, '', '/orders?project=tenant-a&token=matching-token')
    render(
      <AutologinParams configFile={{ project: 'tenant-a', localProjectConfigured: true, local_project_pin: 'tenant-a' }}>
        <Dashboard />
      </AutologinParams>
    )
    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'tenant-a')
    expect(window.localStorage.getItem('token')).toBe('untouched-other-token')
    expect(await new WebStrategy({ localProjectConfigured: true, local_project_pin: 'tenant-a' }).getItem('token')).toBe('matching-token')
  })
})

describe('unmarked historical configuration autologin', () => {
  afterEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.unstubAllGlobals()
  })

  it('keeps the existing query login and global session behavior without a setup marker', async () => {
    localStorage.clear()
    localStorage.setItem('project', 'old-session')
    localStorage.setItem('token', 'old-token')
    localStorage.setItem('user', JSON.stringify({ id: 1, level: 0 }))
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ error: false, result: { id: 2, level: 0 } }) })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState(null, '', '/?project=query-tenant&token=query-token')
    render(
      <AutologinParams configFile={{ project: 'historical-project', localProjectConfigured: false, local_project_pin: null }}>
        <Dashboard />
      </AutologinParams>
    )
    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-project', 'query-tenant')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('project')).toBe('query-tenant')
    expect(localStorage.getItem('token')).toBe('query-token')
    expect(localStorage.length).toBe(3)
  })
})
