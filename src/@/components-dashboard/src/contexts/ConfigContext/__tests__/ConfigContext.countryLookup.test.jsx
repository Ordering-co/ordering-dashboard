import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ConfigProvider, useConfig } from '../index'

const mocks = vi.hoisted(() => ({
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
      project: 'luisv4plus',
      configs,
      setAccessToken: () => ({ configs })
    }]
  }
}))

vi.mock('../../LanguageContext', () => ({
  useLanguage: () => [{ loading: false }]
}))

vi.mock('../../SessionContext', () => ({
  useSession: () => [{ token: 'token' }]
}))

const Probe = () => {
  const [state] = useConfig()
  return (
    <div>
      <span data-testid='loading'>{String(state.loading)}</span>
      <span data-testid='country'>{state.configs?.default_country_code?.value || ''}</span>
    </div>
  )
}

const renderProvider = () => render(
  <ConfigProvider>
    <Probe />
  </ConfigProvider>
)

describe('ConfigProvider country lookup', () => {
  beforeEach(() => {
    delete window.__FIRST_LOAD__
    delete window.__CONFIG__
    mocks.configsGet.mockReset()
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ country_code: 'MX', country_calling_code: '+52' })
    })
  })

  it('skips the IP lookup when the project already sets a default country', async () => {
    mocks.configsGet.mockResolvedValue({
      content: { error: false, result: { default_country_code: { value: 'CO' } } }
    })

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('country').textContent).toBe('CO')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('falls back to the IP lookup when the project has no default country', async () => {
    mocks.configsGet.mockResolvedValue({
      content: { error: false, result: { default_country_code: { value: '' } } }
    })

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('country').textContent).toBe('MX'))
    expect(global.fetch).toHaveBeenCalledWith('https://ipapi.co/json/')
  })

  it('defaults to US when the IP lookup fails', async () => {
    mocks.configsGet.mockResolvedValue({ content: { error: false, result: {} } })
    global.fetch = vi.fn().mockRejectedValue(new Error('CORS'))

    renderProvider()

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('country').textContent).toBe('US')
  })
})
