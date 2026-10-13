/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  languageLoading: true,
  token: null,
  project: 'development',
  configsGet: vi.fn()
}))

vi.mock('../../ApiContext', () => ({
  useApi: () => {
    const configs = () => ({
      asDictionary: () => ({
        get: mocks.configsGet
      })
    })
    return [{
      project: mocks.project,
      configs,
      setAccessToken: () => ({ configs })
    }]
  }
}))

vi.mock('../../LanguageContext', () => ({
  useLanguage: () => [{ loading: mocks.languageLoading }]
}))

vi.mock('../../SessionContext', () => ({
  useSession: () => [{ token: mocks.token }]
}))

import { ConfigProvider, useConfig } from '../index'

const Probe = () => {
  const [state] = useConfig()
  return (
    <div>
      <span data-testid='loading'>{String(state.loading)}</span>
      <span data-testid='primary'>
        {state.configs?.dashboard_buttons_colors?.value || ''}
      </span>
      <span data-testid='keys'>{Object.keys(state.configs || {}).join(',')}</span>
      <span data-testid='fetchedWithToken'>{String(Boolean(state.fetchedWithToken))}</span>
    </div>
  )
}

const renderProvider = () => render(
  <ConfigProvider>
    <Probe />
  </ConfigProvider>
)

const apiConfigs = {
  dashboard_buttons_colors: { value: '#00AA88' }
}

describe('ConfigProvider first_load hydrate', () => {
  beforeEach(() => {
    mocks.languageLoading = true
    mocks.token = null
    mocks.project = 'development'
    mocks.configsGet.mockReset()
    mocks.configsGet.mockResolvedValue({
      content: { error: false, result: apiConfigs }
    })
    delete window.__FIRST_LOAD__
    delete window.__CONFIG__
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ country_code: 'US', country_calling_code: '+1' })
    })
  })

  afterEach(() => {
    delete window.__FIRST_LOAD__
    delete window.__CONFIG__
  })

  it('hydrates from __FIRST_LOAD__.configs with loading false', () => {
    window.__FIRST_LOAD__ = {
      configs: { dashboard_buttons_colors: { value: '#112233' } }
    }

    renderProvider()

    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('primary').textContent).toBe('#112233')
    expect(mocks.configsGet).not.toHaveBeenCalled()
  })

  it('hydrates from __FIRST_LOAD__.result.configs with loading false', () => {
    window.__FIRST_LOAD__ = {
      result: {
        configs: { dashboard_buttons_colors: { value: '#445566' } }
      }
    }

    renderProvider()

    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('primary').textContent).toBe('#445566')
  })

  it('hydrates from __FIRST_LOAD__ when the worker resolved the active project', () => {
    window.__CONFIG__ = { project: 'development' }
    window.__FIRST_LOAD__ = {
      configs: { dashboard_buttons_colors: { value: '#112233' } }
    }

    renderProvider()

    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('primary').textContent).toBe('#112233')
  })

  it('ignores __FIRST_LOAD__ from another project and waits for the API', async () => {
    let resolveConfigs
    mocks.languageLoading = false
    mocks.project = 'luisv4plus'
    mocks.configsGet.mockImplementation(() => new Promise(resolve => {
      resolveConfigs = resolve
    }))
    window.__CONFIG__ = { project: 'orderingplus' }
    window.__FIRST_LOAD__ = {
      configs: { dashboard_buttons_colors: { value: '' } }
    }

    renderProvider()

    expect(screen.getByTestId('loading').textContent).toBe('true')
    expect(screen.getByTestId('primary').textContent).toBe('')

    resolveConfigs({ content: { error: false, result: apiConfigs } })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('primary').textContent).toBe('#00AA88')
  })

  it('keeps loading true until the API when first_load is missing', async () => {
    let resolveConfigs
    mocks.languageLoading = false
    mocks.configsGet.mockImplementation(() => new Promise(resolve => {
      resolveConfigs = resolve
    }))

    renderProvider()

    expect(screen.getByTestId('loading').textContent).toBe('true')
    expect(screen.getByTestId('primary').textContent).toBe('')

    resolveConfigs({ content: { error: false, result: apiConfigs } })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('primary').textContent).toBe('#00AA88')
  })

  it('still refreshes from the API after hydrate without flipping loading true', async () => {
    window.__FIRST_LOAD__ = {
      configs: { dashboard_buttons_colors: { value: '#112233' } }
    }

    const { rerender } = renderProvider()

    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('primary').textContent).toBe('#112233')

    mocks.languageLoading = false
    rerender(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('primary').textContent).toBe('#00AA88')
    })
    expect(screen.getByTestId('loading').textContent).toBe('false')
    // Hydrated and refreshed without a session token: account-level configs are not known yet.
    expect(screen.getByTestId('fetchedWithToken').textContent).toBe('false')
  })

  it('flags configs as fetched with the session token only after that request succeeds', async () => {
    let resolveConfigs
    window.__FIRST_LOAD__ = {
      configs: { dashboard_buttons_colors: { value: '#112233' } }
    }
    mocks.languageLoading = false
    mocks.token = 'session-token'
    mocks.configsGet.mockImplementation(() => new Promise(resolve => {
      resolveConfigs = resolve
    }))

    renderProvider()

    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('fetchedWithToken').textContent).toBe('false')

    resolveConfigs({ content: { error: false, result: { white_label_module: { value: '1' } } } })

    await waitFor(() => {
      expect(screen.getByTestId('fetchedWithToken').textContent).toBe('true')
    })
    expect(screen.getByTestId('keys').textContent).toContain('white_label_module')
  })

  it('drops fetchedWithToken when the session token changes until the new request succeeds', async () => {
    let resolveFirst
    mocks.languageLoading = false
    mocks.token = 'token-a'
    mocks.configsGet.mockImplementation(() => new Promise(resolve => {
      resolveFirst = resolve
    }))

    const { rerender } = renderProvider()
    resolveFirst({ content: { error: false, result: { white_label_module: { value: '0' } } } })
    await waitFor(() => {
      expect(screen.getByTestId('fetchedWithToken').textContent).toBe('true')
    })

    let resolveNext
    mocks.token = 'token-b'
    mocks.configsGet.mockImplementation(() => new Promise(resolve => {
      resolveNext = resolve
    }))
    rerender(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>
    )

    expect(screen.getByTestId('fetchedWithToken').textContent).toBe('false')

    resolveNext({ content: { error: false, result: { white_label_module: { value: '1' } } } })
    await waitFor(() => {
      expect(screen.getByTestId('fetchedWithToken').textContent).toBe('true')
    })
    expect(screen.getByTestId('keys').textContent).toContain('white_label_module')
  })

  it('ignores a config response that belongs to the previous token', async () => {
    let resolveStale
    mocks.languageLoading = false
    mocks.token = 'token-a'
    mocks.configsGet.mockImplementation(() => new Promise(resolve => {
      resolveStale = resolve
    }))

    const { rerender } = renderProvider()

    let resolveNext
    mocks.token = 'token-b'
    mocks.configsGet.mockImplementation(() => new Promise(resolve => {
      resolveNext = resolve
    }))
    rerender(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>
    )

    resolveStale({ content: { error: false, result: { stale_flag: { value: '1' } } } })
    await act(async () => {})
    expect(screen.getByTestId('fetchedWithToken').textContent).toBe('false')
    expect(screen.getByTestId('keys').textContent).not.toContain('stale_flag')

    resolveNext({ content: { error: false, result: { white_label_module: { value: '1' } } } })
    await waitFor(() => {
      expect(screen.getByTestId('fetchedWithToken').textContent).toBe('true')
    })
    expect(screen.getByTestId('keys').textContent).toContain('white_label_module')
    expect(screen.getByTestId('keys').textContent).not.toContain('stale_flag')
  })

  it('does not flag configs as fetched with the session token when that request fails', async () => {
    mocks.languageLoading = false
    mocks.token = 'session-token'
    mocks.configsGet.mockResolvedValue({ content: { error: true, result: 'boom' } })

    renderProvider()

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('fetchedWithToken').textContent).toBe('false')
  })
})
