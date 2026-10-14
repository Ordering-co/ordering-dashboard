import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { BusinessPaymethods } from '../index'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: [{ token: 'test-token', user: { id: 7, level: 0 } }],
  api: [{ root: 'https://api.test/v400/en/demo', appId: 'dashboard', appInternalName: 'dashboard' }, { configurations: { subdomain: 'demo' } }],
  config: [{ configs: {} }]
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => mocks.session }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => mocks.api }))
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => mocks.config }))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

const paymethods = [
  { id: 1, name: 'Cash', gateway: 'cash' },
  { id: 2, name: 'Card on delivery', gateway: 'card_delivery' }
]

let controller
const UI = (props) => {
  controller = props
  return null
}

const json = (body) => Promise.resolve({ json: async () => body })

describe('BusinessPaymethods create business paymethod', () => {
  let fetchMock
  let createResponse

  beforeEach(() => {
    controller = null
    mocks.showToast.mockReset()
    createResponse = { error: false, result: { id: 5974, paymethod_id: 2, enabled: true } }
    fetchMock = vi.fn((url, options = {}) => {
      if (url.includes('/business/3202/paymethods') && options.method === 'POST') return json(createResponse)
      if (url.includes('/business/3202/paymethods')) return json({ error: false, result: [{ id: 1, paymethod_id: 1, enabled: true }] })
      if (url.includes('/paymethods?')) return json({ error: false, result: paymethods })
      return json({ error: false, result: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const renderController = async () => {
    render(<BusinessPaymethods UIComponent={UI} business={{ id: 3202 }} />)
    await waitFor(() => expect(controller.paymethodsList.paymethods).toHaveLength(2))
  }

  const createBody = () => JSON.parse(fetchMock.mock.calls.find(([url, options]) => url.includes('/business/3202/paymethods') && options?.method === 'POST')[1].body)

  it('creates the paymethod enabled when no config step follows', async () => {
    await renderController()
    await act(async () => {
      controller.handleClickPayment(2, null)
    })
    await waitFor(() => expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Payment method saved'))
    expect(createBody()).toMatchObject({ enabled: true, paymethod_id: 2 })
  })

  it('creates the paymethod disabled when the config panel opens to fill its data', async () => {
    const openConfig = vi.fn()
    await renderController()
    await act(async () => {
      controller.handleClickPayment(2, openConfig)
    })
    await waitFor(() => expect(openConfig).toHaveBeenCalled())
    expect(createBody()).toMatchObject({ enabled: false, paymethod_id: 2 })
  })

  it('shows the API error instead of staying on Loading when the create is rejected', async () => {
    createResponse = { error: true, result: ['The paymethod is not available'] }
    await renderController()
    await act(async () => {
      controller.handleClickPayment(2, null)
    })
    await waitFor(() => expect(mocks.showToast).toHaveBeenLastCalledWith('error', 'The paymethod is not available'))
  })
})
