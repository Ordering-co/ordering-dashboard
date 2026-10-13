/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false, user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))

import { BusinessConfigs } from '../index'

const business = {
  id: 1505,
  configs: [
    { id: 3500, key: 'pedidosya_integration_api_token', type: 1, value: 'old-token' },
    { id: 3502, key: 'pedidosya_integration_sandbox_mode', type: 2, value: '1' },
    { id: 653, key: 'wallet_cash_enabled', type: 2, value: '1' }
  ]
}

let lastResult
const UI = ({ saveBusinessConfig }) => (
  <button
    onClick={async () => {
      lastResult = await saveBusinessConfig(3502, { key: 'pedidosya_integration_sandbox_mode', value: '0' })
    }}
  >
    save
  </button>
)

describe('BusinessConfigs controller', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    lastResult = undefined
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updates the business config through the business endpoint and syncs the business state', async () => {
    const updated = { id: 3502, key: 'pedidosya_integration_sandbox_mode', type: 2, value: '0' }
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result: updated }) })
    const handleSuccessUpdate = vi.fn()

    render(<BusinessConfigs UIComponent={UI} business={business} handleSuccessUpdate={handleSuccessUpdate} />)

    await act(async () => {
      screen.getByText('save').click()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/business/1505/configs/3502')
    expect(options.method).toBe('PUT')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ value: '0' })

    expect(lastResult).toEqual({ error: false, result: updated })
    expect(handleSuccessUpdate).toHaveBeenCalledWith({
      ...business,
      configs: [business.configs[0], updated, business.configs[2]]
    })
  })

  it('returns the API error and leaves the business state untouched', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: true, result: ['API_ERROR_BUSINESS_CONFIG_CONFIG'] }) })
    const handleSuccessUpdate = vi.fn()

    render(<BusinessConfigs UIComponent={UI} business={business} handleSuccessUpdate={handleSuccessUpdate} />)

    await act(async () => {
      screen.getByText('save').click()
    })

    expect(lastResult).toEqual({ error: true, result: ['API_ERROR_BUSINESS_CONFIG_CONFIG'] })
    expect(handleSuccessUpdate).not.toHaveBeenCalled()
  })

  it('turns a network failure into an error result', async () => {
    fetchMock.mockRejectedValue(new Error('Network down'))

    render(<BusinessConfigs UIComponent={UI} business={business} handleSuccessUpdate={vi.fn()} />)

    await act(async () => {
      screen.getByText('save').click()
    })

    expect(lastResult).toEqual({ error: true, result: ['Network down'] })
  })
})
