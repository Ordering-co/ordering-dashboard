import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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
