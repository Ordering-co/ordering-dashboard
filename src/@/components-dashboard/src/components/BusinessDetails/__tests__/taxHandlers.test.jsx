/* eslint-disable import/first */
// redesign stores 5.12 (E1): the tax / fee handlers of the store editor.
//  - getTaxes frees `formTaxState.loading` (it stayed true forever) and reports an error;
//  - handleSaveTax returns `{ ok: true, result }` on success (PUT and POST), clears the pending editor changes, never spreads the
//    business form into the tax form state, and has an opt-in `inlineError` (no LOADING / error toast: the caller shows it);
//  - handleDeleteTax builds a NEW object (it mutated the state in place), guards a missing id and has the same `inlineError`;
//  - handleChangeTax stores `null` (not NaN) for an emptied order-type rate.
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
const FEE = { id: 52, name: 'Service', description: '', fixed: 1, percentage: 0, taxable: false, recipient: 'business', target: 'product' }

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
const bodyOf = (call) => JSON.parse(fetch.mock.calls[call][1].body)

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.emit.mockReset()
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessDetails controller · getTaxes', () => {
  it('frees formTaxState.loading after a successful GET and fills the taxes', async () => {
    fetch.mockReturnValueOnce(answer({ error: false, result: [TAX] }))
    draw()
    await act(async () => { await ui.getTaxes() })
    expect(fetch.mock.calls[0][0]).toBe('https://api.test/taxes')
    expect(ui.taxes['id:31']).toMatchObject({ id: 31, rate: 10 })
    expect(ui.formTaxState.loading).toBe(false)
    expect(ui.formTaxState.result.error).toBe(false)
  })

  it('an API error reports it in formTaxState, frees the loading and leaves the taxes alone', async () => {
    fetch.mockReturnValueOnce(answer({ error: false, result: [TAX] }))
    draw()
    await act(async () => { await ui.getTaxes() })
    fetch.mockReturnValueOnce(answer({ error: true, result: ['Not allowed'] }))
    await act(async () => { await ui.getTaxes() })
    expect(ui.formTaxState).toMatchObject({ loading: false, result: { error: true, result: ['Not allowed'] } })
    expect(ui.taxes['id:31']).toBeDefined()
  })

  it('a request that throws reports it in formTaxState and frees the loading', async () => {
    fetch.mockRejectedValueOnce(new Error('Network down'))
    draw()
    await act(async () => { await ui.getTaxes() })
    expect(ui.formTaxState).toMatchObject({ loading: false, result: { error: true, result: ['Network down'] } })
    expect(ui.taxes).toEqual({})
  })
})

describe('BusinessDetails controller · handleSaveTax', () => {
  it('a PUT that works returns { ok: true, result }, emits tax_changed, closes the editor and clears the pending changes', async () => {
    fetch.mockReturnValueOnce(answer({ error: false, result: TAX }))
    draw()
    act(() => { ui.setTaxToEdit({ action: 'taxes', payload: { ...TAX, value: 31 } }) })
    act(() => { ui.handleChangeTax('rate', 10) })
    expect(ui.formTaxChanges).toEqual({ rate: 10 })
    let result
    await act(async () => { result = await ui.handleSaveTax(31, 'taxes') })
    expect(fetch.mock.calls[0][1].method).toBe('PUT')
    expect(bodyOf(0)).toEqual({ rate: 10, target: 'product' })
    expect(result).toEqual({ ok: true, result: TAX })
    expect(ui.taxes['id:31']).toMatchObject({ id: 31, name: 'VAT', rate: 10 })
    expect(mocks.emit).toHaveBeenCalledWith('tax_changed', { tax: expect.objectContaining({ id: 31 }) })
    expect(ui.taxToEdit).toEqual({ action: null, payload: null })
    expect(ui.formTaxChanges).toEqual({})
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Tax saved']])
  })

  it('a fee PUT that works returns { ok: true, result } and emits fee_changed', async () => {
    fetch.mockReturnValueOnce(answer({ error: false, result: FEE }))
    draw()
    let result
    await act(async () => { result = await ui.handleSaveTax(52, 'fees') })
    expect(result).toEqual({ ok: true, result: FEE })
    expect(ui.fees['id:52']).toMatchObject({ id: 52, fixed: 1 })
    expect(mocks.emit).toHaveBeenCalledWith('fee_changed', { fee: expect.objectContaining({ id: 52 }) })
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Fee saved']])
  })

  it('a POST that works returns { ok: true, result }, emits nothing and clears the pending changes', async () => {
    fetch.mockReturnValueOnce(answer({ error: false, result: TAX }))
    draw()
    act(() => { ui.handleChangeTax('name', 'VAT') })
    let result
    await act(async () => { result = await ui.handleSaveTax(undefined, 'taxes', { rate: 10 }) })
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    expect(bodyOf(0)).toEqual({ name: 'VAT', rate: 10, target: 'product' })
    expect(result).toEqual({ ok: true, result: TAX })
    expect(ui.taxes['id:31']).toMatchObject({ id: 31 })
    expect(mocks.emit).not.toHaveBeenCalled()
    expect(ui.formTaxChanges).toEqual({})
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Tax saved']])
  })

  it('an API error returns { ok: false, error } and keeps the pending changes', async () => {
    fetch.mockReturnValueOnce(answer({ error: true, result: ['The rate is required'] }))
    draw()
    act(() => { ui.handleChangeTax('name', 'VAT') })
    let result
    await act(async () => { result = await ui.handleSaveTax(undefined, 'taxes') })
    expect(result).toEqual({ ok: false, error: ['The rate is required'] })
    expect(ui.formTaxChanges).toEqual({ name: 'VAT' })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'La tasa es obligatoria']])
    expect(ui.formTaxState.loading).toBe(false)
  })

  it('a request that throws returns { ok: false, error } and keeps the pending changes', async () => {
    fetch.mockRejectedValueOnce(new Error('Network down'))
    draw()
    act(() => { ui.handleChangeTax('name', 'VAT') })
    let result
    await act(async () => { result = await ui.handleSaveTax(31, 'taxes') })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.formTaxChanges).toEqual({ name: 'VAT' })
    expect(ui.formTaxState.loading).toBe(false)
  })

  it('never spreads the business form into formTaxState while the request is in flight', async () => {
    let release
    fetch.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
    draw()
    act(() => { ui.setFormState({ loading: false, changes: { name: 'Other' }, result: { error: false, marker: 'business' } }) })
    let pending
    act(() => { pending = ui.handleSaveTax(undefined, 'taxes') })
    expect(ui.formTaxState).toEqual({ loading: true, changes: {}, result: { error: false } })
    await act(async () => {
      release({ json: () => Promise.resolve({ error: false, result: TAX }) })
      await pending
    })
    expect(ui.formTaxState).toEqual({ loading: false, changes: {}, result: { error: false } })
  })

  it('inlineError: no LOADING toast and no error toast on an API error, the error is returned', async () => {
    fetch.mockReturnValueOnce(answer({ error: true, result: ['The rate is required'] }))
    draw()
    let result
    await act(async () => { result = await ui.handleSaveTax(undefined, 'taxes', {}, { inlineError: true }) })
    expect(result).toEqual({ ok: false, error: ['The rate is required'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.formTaxState.loading).toBe(false)
  })

  it('inlineError: no toasts when the request throws', async () => {
    fetch.mockRejectedValueOnce(new Error('Network down'))
    draw()
    let result
    await act(async () => { result = await ui.handleSaveTax(31, 'taxes', {}, { inlineError: true }) })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('inlineError: the success toast stays', async () => {
    fetch.mockReturnValueOnce(answer({ error: false, result: TAX }))
    draw()
    let result
    await act(async () => { result = await ui.handleSaveTax(undefined, 'taxes', {}, { inlineError: true }) })
    expect(result).toEqual({ ok: true, result: TAX })
    expect(toasts()).toEqual([['success', 'Tax saved']])
  })
})

describe('BusinessDetails controller · handleDeleteTax', () => {
  const drawWithRecords = async () => {
    fetch.mockReturnValueOnce(answer({ error: false, result: TAX }))
    fetch.mockReturnValueOnce(answer({ error: false, result: FEE }))
    draw()
    await act(async () => { await ui.handleSaveTax(undefined, 'taxes') })
    await act(async () => { await ui.handleSaveTax(undefined, 'fees') })
    fetch.mockClear()
    mocks.showToast.mockReset()
    mocks.emit.mockReset()
  }

  it('builds a NEW taxes object without the key (the old one is not mutated)', async () => {
    await drawWithRecords()
    const before = ui.taxes
    fetch.mockReturnValueOnce(answer({ error: false, result: {} }))
    let result
    await act(async () => { result = await ui.handleDeleteTax(31, 'taxes') })
    expect(result).toEqual({ ok: true })
    expect(ui.taxes).not.toBe(before)
    expect(before['id:31']).toBeDefined()
    expect(ui.taxes['id:31']).toBeUndefined()
    expect(mocks.emit).toHaveBeenCalledWith('tax_deleted', { tax: expect.objectContaining({ id: 31 }), isRemove: true })
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'tax deleted']])
  })

  it('builds a NEW fees object without the key', async () => {
    await drawWithRecords()
    const before = ui.fees
    fetch.mockReturnValueOnce(answer({ error: false, result: {} }))
    let result
    await act(async () => { result = await ui.handleDeleteTax(52, 'fees') })
    expect(result).toEqual({ ok: true })
    expect(ui.fees).not.toBe(before)
    expect(before['id:52']).toBeDefined()
    expect(ui.fees['id:52']).toBeUndefined()
    expect(mocks.emit).toHaveBeenCalledWith('fee_deleted', { tax: expect.objectContaining({ id: 52 }), isRemove: true })
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Fee deleted']])
  })

  it('a falsy id returns { ok: false, error: [...] } without a request', async () => {
    await drawWithRecords()
    let result
    await act(async () => { result = await ui.handleDeleteTax(undefined, 'taxes') })
    expect(result).toEqual({ ok: false, error: [expect.any(String)] })
    expect(fetch).not.toHaveBeenCalled()
    expect(ui.formTaxState.loading).toBe(false)
  })

  it('inlineError: no LOADING toast and no error toast on an API error, the tax stays', async () => {
    await drawWithRecords()
    fetch.mockReturnValueOnce(answer({ error: true, result: ['In use'] }))
    let result
    await act(async () => { result = await ui.handleDeleteTax(31, 'taxes', { inlineError: true }) })
    expect(result).toEqual({ ok: false, error: ['In use'] })
    expect(ui.taxes['id:31']).toBeDefined()
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.formTaxState.loading).toBe(false)
  })

  it('inlineError: no toasts when the request throws', async () => {
    await drawWithRecords()
    fetch.mockRejectedValueOnce(new Error('Network down'))
    let result
    await act(async () => { result = await ui.handleDeleteTax(31, 'taxes', { inlineError: true }) })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('without the option the error toast stays', async () => {
    await drawWithRecords()
    fetch.mockReturnValueOnce(answer({ error: true, result: ['The rate is required'] }))
    await act(async () => { await ui.handleDeleteTax(31, 'taxes') })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'La tasa es obligatoria']])
  })
})

describe('BusinessDetails controller · handleChangeTax', () => {
  it.each([[''], [undefined]])('an emptied order-type rate (%j) is stored as null, not NaN', (value) => {
    draw()
    act(() => { ui.handleChangeTax('rate', value, 'delivery') })
    expect(ui.formTaxChanges.order_type_rates.delivery.rate).toBeNull()
  })

  it('a typed order-type rate is still parsed', () => {
    draw()
    act(() => { ui.handleChangeTax('rate', '12.5', 'delivery') })
    expect(ui.formTaxChanges.order_type_rates.delivery.rate).toBe(12.5)
  })
})
