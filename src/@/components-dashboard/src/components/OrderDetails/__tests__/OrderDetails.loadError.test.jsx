/* eslint-disable import/first */
// (review R1): a failed `GET /orders/:id` (the SDK rejects on a 5xx or with no network) leaves `error` in the
// order state, and the panel tells it apart from an order that does not exist. «Try again» is `handleRetryOrder`: it asks
// for the same order again and clears the old error when the order arrives.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ ui: null, get: null }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const request = {
    get: (options) => {
      if (options?.cancelToken) options.cancelToken.cancel = () => {}
      return runtime.get(options)
    }
  }
  request.asDashboard = () => request
  request.select = () => request
  const api = { root: 'https://api.test/v400/en/demo', project: 'demo', orders: () => request }
  api.setAccessToken = () => api
  return { useApi: () => [api] }
})
vi.mock('../../../contexts/WebsocketContext', () => ({ useWebsocket: () => ({ on: vi.fn(), off: vi.fn() }) }))
vi.mock('../../../contexts/EventContext', () => ({ useEvent: () => [{ on: vi.fn(), off: vi.fn() }] }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/UtilsContext', () => ({ useUtils: () => [{ parsePrice: value => String(value) }] }))
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: {} }] }))

import { OrderDetails } from '../index'

const UI = (props) => { runtime.ui = props; return null }

const mount = () => render(<OrderDetails UIComponent={UI} orderId={13861} asDashboard isDisableLoadMessages />)

beforeEach(() => {
  runtime.ui = null
  runtime.get = vi.fn()
})

describe('OrderDetails controller · a failed load and Try again', () => {
  it('keeps the error of a failed load, with no order', async () => {
    runtime.get.mockRejectedValue(new Error('Internal error'))
    await act(async () => { mount() })
    expect(runtime.ui.order).toMatchObject({ loading: false, order: null, error: ['Internal error'] })
  })

  it('Try again asks for the order again and clears the error when it arrives', async () => {
    runtime.get.mockRejectedValueOnce(new Error('Internal error'))
    await act(async () => { mount() })
    expect(typeof runtime.ui.handleRetryOrder).toBe('function')
    runtime.get.mockResolvedValueOnce({ content: { error: false, result: { id: 13861, status: 0 } } })
    await act(async () => { await runtime.ui.handleRetryOrder() })
    expect(runtime.get).toHaveBeenCalledTimes(2)
    expect(runtime.ui.order).toMatchObject({ loading: false, error: null, order: { id: 13861 } })
  })

  it('while it asks again it shows the loading state, not the old error', async () => {
    runtime.get.mockRejectedValueOnce(new Error('Internal error'))
    await act(async () => { mount() })
    let answer
    runtime.get.mockReturnValueOnce(new Promise(resolve => { answer = resolve }))
    act(() => { runtime.ui.handleRetryOrder() })
    expect(runtime.ui.order).toMatchObject({ loading: true, error: null })
    await act(async () => { answer({ content: { error: false, result: { id: 13861 } } }) })
  })
})
