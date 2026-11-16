/* eslint-disable import/first */
// redesign stores 1.B (G4-01): when the API answers a payment-method write with `{ error: true }`, the
// controller used to leave `actionState.loading` true for good (every form reads it: Save stuck on «Loading») and say
// nothing. Now each write (create, update, delete, business update) frees `loading`, keeps the error in
// `actionState.result` and shows the API message in an error toast.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', appId: 'dashboard', appInternalName: 'dashboard' }, { configurations: {} }]
}))
vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { BusinessPaymethods } from '../index'

const BUSINESS = { id: 7, name: 'Sample Burgers' }
const CASH = { id: 1, name: 'Cash', gateway: 'cash', data_template: null }
const CARD = { id: 2, name: 'Card on delivery', gateway: 'card_delivery', data_template: null }
const BUSINESS_CASH = { id: 31, paymethod_id: 1, enabled: true, sandbox: false, paymethod: CASH }

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const FAILED = { error: true, result: ['Paymethod not saved'] }

let ui
const draw = () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessPaymethods UIComponent={UI} business={BUSINESS} />)
}

const settle = async () => {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

beforeEach(() => {
  mocks.showToast.mockReset()
  global.fetch = vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    if (method === 'GET') {
      if (url.includes('/business/7/paymethods')) return json({ error: false, result: [BUSINESS_CASH] })
      if (url.includes('/paymethods')) return json({ error: false, result: [CASH, CARD] })
      return json({ error: false, result: [] })
    }
    return json(FAILED)
  })
})

afterEach(() => {
  delete global.fetch
})

const expectFreedWithError = () => {
  expect(ui.actionState.loading).toBe(false)
  expect(ui.actionState.result).toEqual({ error: true, result: FAILED.result })
  const errors = mocks.showToast.mock.calls.filter(([type]) => type === 'error')
  expect(errors).toEqual([['error', 'Paymethod not saved']])
  expect(mocks.showToast.mock.calls.some(([type]) => type === 'success')).toBe(false)
}

describe('BusinessPaymethods controller · an API error frees Save and is shown (G4-01)', () => {
  it('update (Save) of a business paymethod', async () => {
    draw()
    await settle()
    await act(async () => { await ui.handleSavePaymethod(31, { sandbox: true }) })
    expectFreedWithError()
  })

  it('create of a business paymethod (first click on a row)', async () => {
    draw()
    await settle()
    await act(async () => { await ui.handleClickPayment(2) })
    expectFreedWithError()
  })

  it('delete of a business paymethod', async () => {
    draw()
    await settle()
    await act(async () => { await ui.handleDeleteBusinessPaymethodOption(1) })
    expectFreedWithError()
    expect(ui.isSuccessDeleted).toBe(false)
  })

  it('a request that throws also frees Save and says, in words, that it was not saved (main )', async () => {
    draw()
    await settle()
    global.fetch = vi.fn(() => Promise.reject(new Error('Network down')))
    await act(async () => { await ui.handleSavePaymethod(31, { sandbox: true }) })
    expect(ui.actionState.loading).toBe(false)
    expect(mocks.showToast.mock.calls.filter(([type]) => type === 'error')).toEqual([['error', 'The payment method could not be saved. Please try again.']])
    expect(ui.actionState.result).toEqual({ error: true, result: 'Network down' })
  })

  it('a successful save keeps the success toast and no error', async () => {
    draw()
    await settle()
    global.fetch = vi.fn(() => json({ error: false, result: { ...BUSINESS_CASH, sandbox: true } }))
    await act(async () => { await ui.handleSavePaymethod(31, { sandbox: true }) })
    expect(ui.actionState.loading).toBe(false)
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'success'])
  })
})
