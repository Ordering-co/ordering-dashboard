/* eslint-disable import/first */
// redesign stores 5.11: the wallets editor is in line now, so `handleUpdateWallet` answers the control that called it:
// `{ ok: true }`, or `{ ok: false, error }` (the API's messages, or the thrown message). It frees `actionState.loading` on every path,
// keeps the «Changes saved» toast (review 5.11 F4: no «Loading» toast) and the state update + `handleSuccessUpdate` on success, and shows no error toast.
import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ toasts: [] }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false, user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback || key]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: (type, message) => mocks.toasts.push([type, message]) }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))

import { BusinessWalletsList } from '../index'

const cash = { id: 653, key: 'wallet_cash_enabled', type: 2, value: '1', options: [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }] }
const points = { id: 654, key: 'wallet_credit_point_enabled', type: 2, value: '1', options: [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }] }
const business = { id: 1505, configs: [cash, points] }

let api
let latest
const Probe = (props) => {
  latest = props
  return <output data-testid='probe'>{String(props.actionState.loading)}</output>
}

const answer = (body) => ({ json: async () => body })

describe('BusinessWalletsList controller (5.11)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    mocks.toasts.length = 0
    latest = undefined
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (url, options) => {
      if (String(url).endsWith('/loyalty_plans')) return answer({ error: false, result: [] })
      return api(url, options)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const renderController = (handleSuccessUpdate = vi.fn()) => {
    render(<BusinessWalletsList UIComponent={Probe} business={business} handleSuccessUpdate={handleSuccessUpdate} />)
    return handleSuccessUpdate
  }
  const posts = () => fetchMock.mock.calls.filter(([url]) => !String(url).endsWith('/loyalty_plans'))

  it('answers { ok: true }, posts the params, updates the list, tells the parent and toasts', async () => {
    api = async () => answer({ error: false, result: { ...points, value: '0' } })
    const handleSuccessUpdate = renderController()
    let result
    await act(async () => { result = await latest.handleUpdateWallet(654, { value: '0' }) })

    expect(result).toEqual({ ok: true })
    const [url, options] = posts()[0]
    expect(url).toBe('https://api.test/v400/en/demo/business/1505/configs/654')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ value: '0' })
    expect(latest.walletsListState.wallets.find(wallet => wallet.id === 654).value).toBe('0')
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ ...business, configs: [cash, { ...points, value: '0' }] })
    expect(mocks.toasts).toEqual([['success', 'Changes saved']])
    expect(latest.actionState).toEqual({ loading: false, error: null })
  })

  it('answers { ok: false, error } with the API messages, frees loading and changes nothing, with no error toast', async () => {
    api = async () => answer({ error: true, result: ['Not allowed for this store'] })
    const handleSuccessUpdate = renderController()
    let result
    await act(async () => { result = await latest.handleUpdateWallet(654, { value: '0' }) })

    expect(result).toEqual({ ok: false, error: ['Not allowed for this store'] })
    expect(latest.actionState.loading).toBe(false)
    expect(screen.getByTestId('probe')).toHaveTextContent('false')
    expect(latest.walletsListState.wallets.find(wallet => wallet.id === 654).value).toBe('1')
    expect(handleSuccessUpdate).not.toHaveBeenCalled()
    expect(mocks.toasts.filter(([type]) => type === 'error')).toEqual([])
    expect(mocks.toasts).toEqual([])
  })

  it('answers { ok: false, error } with the thrown message and frees loading', async () => {
    api = async () => { throw new Error('Network down') }
    renderController()
    let result
    await act(async () => { result = await latest.handleUpdateWallet(654, { value: '0' }) })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('false'))
    expect(mocks.toasts.filter(([type]) => type === 'error')).toEqual([])
  })

  // review 5.11 F1: the two switches of the row can save at once; the second answer must not undo the first
  it('two saves that land before a render both stay, in the list and for the parent', async () => {
    const pending = {}
    api = (url) => new Promise(resolve => { pending[String(url).split('/').pop()] = resolve })
    const handleSuccessUpdate = renderController()
    let first
    let second
    await act(async () => {
      first = latest.handleUpdateWallet(653, { value: '0' })
      second = latest.handleUpdateWallet(654, { value: '0' })
    })
    await act(async () => {
      pending['653'](answer({ error: false, result: { ...cash, value: '0' } }))
      pending['654'](answer({ error: false, result: { ...points, value: '0' } }))
      await Promise.all([first, second])
    })

    expect(latest.walletsListState.wallets.map(wallet => wallet.value)).toEqual(['0', '0'])
    expect(handleSuccessUpdate).toHaveBeenLastCalledWith({ ...business, configs: [{ ...cash, value: '0' }, { ...points, value: '0' }] })
  })
})
