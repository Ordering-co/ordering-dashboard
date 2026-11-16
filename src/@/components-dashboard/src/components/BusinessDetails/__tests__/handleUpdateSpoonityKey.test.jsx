/* eslint-disable import/first */
// redesign stores 5.16 (; G2-36, defect 5.16-A): saving the Spoonity key. Main showed the success toast even when the API
// answered `error: true` (it only checked that the body existed) and then threw on `content.result.value`. The handler answers
// `{ ok, result | error }` so the section can say whether the key was stored; the key itself never goes into a toast.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { id: 7, level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo', project: 'demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))
vi.mock('../../../contexts/EventContext', () => ({
  useEvent: () => [{ on: vi.fn(), off: vi.fn(), emit: vi.fn() }]
}))
vi.mock('../../../contexts/AssistantContext', () => ({
  useAssistantRecordChanges: () => {}
}))

import { BusinessDetails } from '../index'

const business = { id: 42, name: 'Demo' }
const KEY = 'SecretKey123'

let controller
const UI = (props) => {
  controller = props
  return null
}

const json = (body) => Promise.resolve({ json: async () => body })

const spoonityCall = (fetchMock) => fetchMock.mock.calls.find(([url]) => url.endsWith('/business/42/configs/9'))

const renderController = () => render(
  <BusinessDetails UIComponent={UI} businessId={42} business={business} notGetSites notGetTaxes notGetStreamConnection />
)

const toastKinds = () => mocks.showToast.mock.calls.map(([kind]) => kind)
const toastTexts = () => mocks.showToast.mock.calls.map(([, text]) => text)

describe('BusinessDetails handleUpdateSpoonityKey (5.16-A)', () => {
  beforeEach(() => {
    controller = null
    mocks.showToast.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('posts the key to the config and answers ok with the stored value', async () => {
    const fetchMock = vi.fn((url) => (
      url.endsWith('/business/42/configs/9')
        ? json({ error: false, result: { id: 9, value: KEY } })
        : json({ error: false, result: [] })
    ))
    vi.stubGlobal('fetch', fetchMock)
    renderController()
    await waitFor(() => expect(controller).not.toBeNull())

    let answer
    await act(async () => {
      answer = await controller.handleUpdateSpoonityKey(KEY, 9)
    })

    const [url, options] = spoonityCall(fetchMock)
    expect(url).toBe('https://api.test/v400/en/demo/business/42/configs/9')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ value: KEY })

    expect(answer).toEqual({ ok: true, result: { id: 9, value: KEY } })
    expect(toastKinds()).toEqual(['info', 'success'])
    expect(controller.spoonityKeyState).toEqual({ loading: false, key: KEY, result: { id: 9, value: KEY } })
    expect(toastTexts().join(' ')).not.toContain(KEY)
  })

  it('shows the error toast, never the success one, when the API answers error: true', async () => {
    const fetchMock = vi.fn((url) => (
      url.endsWith('/business/42/configs/9')
        ? json({ error: true, result: ['Invalid key'] })
        : json({ error: false, result: [] })
    ))
    vi.stubGlobal('fetch', fetchMock)
    renderController()
    await waitFor(() => expect(controller).not.toBeNull())

    let answer
    await act(async () => {
      answer = await controller.handleUpdateSpoonityKey(KEY, 9)
    })

    expect(answer).toEqual({ ok: false, error: ['Invalid key'] })
    expect(toastKinds()).toEqual(['info', 'error'])
    expect(toastTexts()).toContain('Spoonity key error')
    expect(toastTexts()).not.toContain('Spoonity key updated')
    expect(controller.spoonityKeyState.loading).toBe(false)
    expect(controller.spoonityKeyState.result).toEqual({ error: true, result: ['Invalid key'] })
    expect(controller.spoonityKeyState.key).toBe('')
    expect(toastTexts().join(' ')).not.toContain(KEY)
  })

  it('answers not ok with the message when the request fails', async () => {
    const fetchMock = vi.fn((url) => (
      url.endsWith('/business/42/configs/9')
        ? Promise.reject(new TypeError('Failed to fetch'))
        : json({ error: false, result: [] })
    ))
    vi.stubGlobal('fetch', fetchMock)
    renderController()
    await waitFor(() => expect(controller).not.toBeNull())

    let answer
    await act(async () => {
      answer = await controller.handleUpdateSpoonityKey(KEY, 9)
    })

    expect(answer).toEqual({ ok: false, error: ['Failed to fetch'] })
    expect(toastKinds()).toEqual(['info', 'error'])
    expect(controller.spoonityKeyState).toEqual({ loading: false, key: '', result: { error: true, result: 'Failed to fetch' } })
    expect(toastTexts().join(' ')).not.toContain(KEY)
  })
})
