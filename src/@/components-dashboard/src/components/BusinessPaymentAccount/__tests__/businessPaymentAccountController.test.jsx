/* eslint-disable import/first */
// redesign stores 5.11 (E3): the payout-account controller. G4-27: a failed load keeps `accountState.error` (and
// no account) and `getMethods` is exposed for a retry. A non-admin `updateAccount` answers the error shape instead of
// `undefined`. The four writes no longer show a «Loading» Info toast nor an Error toast (the UI shows the error in line); the
// success toasts, the returned `{ error, result }` shapes and the requests stay exactly as in main.
import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), level: 0 }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: mocks.level } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { BusinessPaymentAccount } from '../index'

const ACCOUNT = { id: 5, paymethod: 'stripe', name: 'Main', enabled: true, data: { key: 'abc' }, businesses: [{ id: 7 }] }
const OTHER = { id: 6, paymethod: 'paypal', name: 'Other', enabled: true, data: {}, businesses: [{ id: 9 }] }
const METHODS = [{ gateway: 'stripe', name: 'Stripe', cycle: 'weekly', cycle_day: 1, data_template: [] }]

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
let accountsAnswer
let writeAnswer
const draw = () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessPaymentAccount UIComponent={UI} businessId={7} />)
}

const settle = async () => {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

const calls = (method) => global.fetch.mock.calls.filter(([, options]) => (options?.method || 'GET') === method)
const toasts = (type) => mocks.showToast.mock.calls.filter(([kind]) => kind === type)

beforeEach(() => {
  mocks.level = 0
  mocks.showToast.mockReset()
  accountsAnswer = { error: false, result: [ACCOUNT, OTHER] }
  writeAnswer = { error: false, result: { id: 5 } }
  global.fetch = vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    if (method === 'GET') {
      if (url.endsWith('/business_payment_accounts/methods')) return json({ error: false, result: METHODS })
      if (url.split('?')[0].endsWith('/business_payment_accounts')) return json(accountsAnswer)
      return json({ error: false, result: [] })
    }
    return json(writeAnswer)
  })
})

afterEach(() => {
  cleanup()
  delete global.fetch
})

describe('BusinessPaymentAccount controller · a failed load (G4-27)', () => {
  it('keeps the error and no account, so the UI cannot offer to create a duplicate', async () => {
    accountsAnswer = { error: true, result: ['Unauthorized'] }
    draw()
    await settle()
    expect(ui.accountState.loading).toBe(false)
    expect(ui.accountState.error).toEqual(['Unauthorized'])
    expect(ui.accountState.account).toBeNull()
  })

  it('exposes getMethods and getAccount for a retry', async () => {
    draw()
    await settle()
    expect(typeof ui.getMethods).toBe('function')
    expect(typeof ui.getAccount).toBe('function')
    const before = calls('GET').length
    await act(async () => { await ui.getMethods() })
    expect(calls('GET').length).toBe(before + 1)
    expect(calls('GET').at(-1)[0]).toBe('https://api.test/business_payment_accounts/methods')
  })
})

describe('BusinessPaymentAccount controller · which accounts it asks for', () => {
  it('an owner asks only for the account of its store and keeps no list to associate', async () => {
    mocks.level = 2
    accountsAnswer = { error: false, result: [ACCOUNT] }
    draw()
    await settle()
    expect(calls('GET').map(([url]) => url)).toContain('https://api.test/business_payment_accounts?business_id=7')
    expect(calls('GET').map(([url]) => url)).not.toContain('https://api.test/business_payment_accounts')
    expect(ui.accountState.account).toEqual(ACCOUNT)
    expect(ui.allAccountsState.accounts).toEqual([])
  })

  it('an admin still asks for every account: only an admin associates one', async () => {
    draw()
    await settle()
    expect(calls('GET').map(([url]) => url)).toContain('https://api.test/business_payment_accounts')
    expect(ui.accountState.account).toEqual(ACCOUNT)
    expect(ui.allAccountsState.accounts).toEqual([ACCOUNT, OTHER])
  })
})

describe('BusinessPaymentAccount controller · updateAccount for a non-admin', () => {
  it('answers the error shape and makes no request (main answered undefined and sent nothing)', async () => {
    mocks.level = 2
    draw()
    await settle()
    let answer
    await act(async () => { answer = await ui.updateAccount(5, { name: 'X', data: {}, enabled: true }) })
    expect(answer).toEqual({ error: true, result: ['Only an administrator can edit the payment account.'] })
    expect(calls('PUT')).toHaveLength(0)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('an admin still sends name, data (as a JSON string) and enabled to the same endpoint', async () => {
    draw()
    await settle()
    await act(async () => { await ui.updateAccount(5, { name: 'N', data: { key: 'k' }, enabled: false }) })
    const [url, options] = calls('PUT')[0]
    expect(url).toBe('https://api.test/business_payment_accounts/5')
    expect(JSON.parse(options.body)).toEqual({ name: 'N', data: JSON.stringify({ key: 'k' }), enabled: false })
  })
})

describe('BusinessPaymentAccount controller · the writes show no Info or Error toast', () => {
  const writes = {
    createAccount: (api) => api.createAccount({ paymethod: 'stripe', name: 'N', data: { key: 'k' } }),
    updateAccount: (api) => api.updateAccount(5, { name: 'N' }),
    associateAccount: (api) => api.associateAccount(6),
    dissociateAccount: (api) => api.dissociateAccount()
  }

  for (const [name, run] of Object.entries(writes)) {
    it(`${name}: success keeps only the success toast and the content`, async () => {
      draw()
      await settle()
      let answer
      await act(async () => { answer = await run(ui) })
      expect(answer).toEqual(writeAnswer)
      expect(toasts('info')).toHaveLength(0)
      expect(toasts('error')).toHaveLength(0)
      expect(toasts('success')).toHaveLength(1)
    })

    it(`${name}: an API error resolves { error, result } with no toast at all`, async () => {
      draw()
      await settle()
      writeAnswer = { error: true, result: ['Not allowed'] }
      let answer
      await act(async () => { answer = await run(ui) })
      expect(answer).toEqual({ error: true, result: ['Not allowed'] })
      expect(ui.actionState).toEqual({ loading: false, error: ['Not allowed'] })
      expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it(`${name}: a network failure resolves { error, result } with no toast at all`, async () => {
      draw()
      await settle()
      const original = global.fetch
      global.fetch = vi.fn(() => Promise.reject(new Error('offline')))
      let answer
      await act(async () => { answer = await run(ui) })
      global.fetch = original
      expect(answer).toEqual({ error: true, result: ['offline'] })
      expect(mocks.showToast).not.toHaveBeenCalled()
    })
  }

  it('createAccount keeps the main payload; associate and dissociate keep theirs', async () => {
    draw()
    await settle()
    await act(async () => { await ui.createAccount({ paymethod: 'stripe', name: 'N', data: { key: 'k' } }) })
    await act(async () => { await ui.associateAccount(6) })
    await act(async () => { await ui.dissociateAccount() })
    const posts = calls('POST')
    expect(posts[0][0]).toBe('https://api.test/business_payment_accounts')
    expect(JSON.parse(posts[0][1].body)).toEqual({ paymethod: 'stripe', business_id: 7, name: 'N', data: JSON.stringify({ key: 'k' }) })
    expect(posts[1][0]).toBe('https://api.test/business/7')
    expect(JSON.parse(posts[1][1].body)).toEqual({ business_payment_account_id: 6 })
    expect(JSON.parse(posts[2][1].body)).toEqual({ business_payment_account_id: null })
  })
})
