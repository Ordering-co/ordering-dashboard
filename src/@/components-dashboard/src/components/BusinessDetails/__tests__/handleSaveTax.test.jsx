/* eslint-disable import/first */
// redesign stores 1.A (G4-10): `handleSaveTax` never read the API error: a tax or fee that was not saved wrote
// `taxes['id:undefined']` and said "Tax saved". `handleDeleteTax` ignored the error too and had no catch: a failed delete
// looked like nothing happened. Now both say the API message, translated, and return `{ ok: false, error }`; a save that
// works keeps its toast and what it returned before.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  emit: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', auth: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', project: 'demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => ({ THE_RATE_IS_REQUIRED: 'La tasa es obligatoria' }[key] ?? text)]
}))
vi.mock('../../../contexts/EventContext', () => ({
  useEvent: () => [{ emit: mocks.emit }]
}))
vi.mock('../../../contexts/AssistantContext', () => ({
  useAssistantRecordChanges: () => {}
}))

import { BusinessDetails } from '../index'

const STORE = { id: 7, name: 'Sample Burgers' }
const TAX = { id: 31, name: 'VAT', description: '', rate: 10, type: 1, recipient: 'business', apply_to_fees: false, order_type_rates: null }

let ui
const draw = () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessDetails UIComponent={UI} business={STORE} businessId={STORE.id} notGetSites notGetTaxes notGetStreamConnection />)
}

const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const toasts = () => mocks.showToast.mock.calls.map(([type, message]) => [type, message])

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.emit.mockReset()
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessDetails controller · handleSaveTax', () => {
  it('creates a tax: "Tax saved", the tax in the list, and the API result returned as before', async () => {
    fetch.mockReturnValueOnce(answer({ error: false, result: TAX }))
    draw()
    let result
    await act(async () => { result = await ui.handleSaveTax(undefined, 'taxes') })
    expect(result).toEqual({ ok: true, result: TAX }) // redesign stores 5.12: one `{ ok, result }` for PUT and POST
    expect(ui.taxes['id:31']).toMatchObject({ id: 31, name: 'VAT', rate: 10 })
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Tax saved']])
  })

  it('a create the API rejects says why, writes nothing and returns { ok: false, error }', async () => {
    fetch.mockReturnValueOnce(answer({ error: true, result: ['The rate is required'] }))
    draw()
    let result
    await act(async () => { result = await ui.handleSaveTax(undefined, 'taxes') })
    expect(result).toEqual({ ok: false, error: ['The rate is required'] })
    expect(ui.taxes).toEqual({})
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'La tasa es obligatoria']])
    expect(ui.formTaxState.loading).toBe(false)
  })

  it('an edit the API rejects says why, does not say "Tax saved", emits nothing and keeps the editor open', async () => {
    fetch.mockReturnValueOnce(answer({ error: true, result: ['The rate is required'] }))
    draw()
    act(() => { ui.setTaxToEdit({ action: 'taxes', payload: { ...TAX, value: 31 } }) })
    let result
    await act(async () => { result = await ui.handleSaveTax(31, 'taxes') })
    expect(result).toEqual({ ok: false, error: ['The rate is required'] })
    expect(ui.taxes).toEqual({})
    expect(mocks.emit).not.toHaveBeenCalled()
    expect(ui.taxToEdit.action).toBe('taxes')
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'La tasa es obligatoria']])
  })

  it('a fee the API rejects does not say "Fee saved"', async () => {
    fetch.mockReturnValueOnce(answer({ error: true, result: ['The rate is required'] }))
    draw()
    let result
    await act(async () => { result = await ui.handleSaveTax(undefined, 'fees') })
    expect(result).toEqual({ ok: false, error: ['The rate is required'] })
    expect(ui.fees).toEqual({})
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'La tasa es obligatoria']])
  })

  it('a request that throws says so and returns { ok: false, error }', async () => {
    fetch.mockRejectedValueOnce(new Error('Network down'))
    draw()
    let result
    await act(async () => { result = await ui.handleSaveTax(undefined, 'taxes') })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Network down']])
    expect(ui.formTaxState.loading).toBe(false)
  })
})

describe('BusinessDetails controller · handleDeleteTax', () => {
  const drawWithTax = async () => {
    fetch.mockReturnValueOnce(answer({ error: false, result: TAX }))
    draw()
    await act(async () => { await ui.handleSaveTax(undefined, 'taxes') })
    mocks.showToast.mockReset()
    mocks.emit.mockReset()
  }

  it('a delete that works removes the tax and says so', async () => {
    await drawWithTax()
    fetch.mockReturnValueOnce(answer({ error: false, result: {} }))
    let result
    await act(async () => { result = await ui.handleDeleteTax(31, 'taxes') })
    expect(result).toEqual({ ok: true })
    expect(ui.taxes['id:31']).toBeUndefined()
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'tax deleted']])
  })

  it('a delete the API rejects says why, keeps the tax and returns { ok: false, error }', async () => {
    await drawWithTax()
    fetch.mockReturnValueOnce(answer({ error: true, result: ['The rate is required'] }))
    let result
    await act(async () => { result = await ui.handleDeleteTax(31, 'taxes') })
    expect(result).toEqual({ ok: false, error: ['The rate is required'] })
    expect(ui.taxes['id:31']).toBeDefined()
    expect(mocks.emit).not.toHaveBeenCalled()
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'La tasa es obligatoria']])
    expect(ui.formTaxState.loading).toBe(false)
  })

  it('a delete that throws says so and frees the form', async () => {
    await drawWithTax()
    fetch.mockRejectedValueOnce(new Error('Network down'))
    let result
    await act(async () => { result = await ui.handleDeleteTax(31, 'taxes') })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Network down']])
    expect(ui.formTaxState.loading).toBe(false)
  })
})
