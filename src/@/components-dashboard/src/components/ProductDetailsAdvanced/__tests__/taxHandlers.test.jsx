/* eslint-disable import/first */
// bugs E row 13: the product editor's `handleSaveTax` and `handleDeleteTax` never read the API error. A tax or fee the
// API refused wrote `taxes['id:undefined']` and said «Product tax saved»; a refused delete looked like nothing happened, and a network
// failure threw past the loading state. Now, as the store editor does since G4-10, both say the API message (translated) and answer
// `{ ok: false, error }`, which keeps EditTaxManager open; a save that works answers `{ ok: true, result }`.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), emit: vi.fn() }))

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

import { ProductDetailsAdvanced } from '../index'

const TAX = { id: 31, name: 'VAT', description: '', rate: 10, type: 1, recipient: 'business', apply_to_fees: false, order_type_rates: null }
const FEE = { id: 41, name: 'Bag', description: '', fixed: 1, percentage: 0, taxable: false, recipient: 'business', target: 'product' }

let ui
const draw = ({ taxes = {}, fees = {} } = {}) => {
  const setters = { setTaxes: vi.fn(), setFees: vi.fn(), setFormTaxState: vi.fn() }
  const UI = (props) => {
    ui = props
    return null
  }
  render(
    <ProductDetailsAdvanced
      UIComponent={UI}
      business={{ id: 7 }}
      product={{ id: 5, category_id: 3 }}
      formTaxState={{ loading: false }}
      taxes={taxes}
      fees={fees}
      {...setters}
    />
  )
  return setters
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

describe('ProductDetailsAdvanced controller · handleSaveTax', () => {
  it.each([
    ['creates', undefined, 'POST'],
    ['edits', 31, 'PUT']
  ])('%s a tax: the tax in the list, «Product tax saved» and { ok: true, result }', async (_name, id, method) => {
    fetch.mockReturnValueOnce(answer({ error: false, result: TAX }))
    const { setTaxes } = draw()
    let result
    await act(async () => { result = await ui.handleSaveTax(id, 'taxes') })
    expect(fetch.mock.calls[0][1].method).toBe(method)
    expect(result).toEqual({ ok: true, result: TAX })
    expect(setTaxes.mock.calls[0][0]['id:31']).toMatchObject({ id: 31, name: 'VAT' })
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Product tax saved']])
  })

  it.each([
    ['create', undefined],
    ['edit', 41]
  ])('a fee %s the API rejects says why, writes nothing, emits nothing and returns { ok: false, error }', async (_name, id) => {
    fetch.mockReturnValueOnce(answer({ error: true, result: ['The rate is required'] }))
    const { setFees } = draw({ fees: { 'id:41': FEE } })
    let result
    await act(async () => { result = await ui.handleSaveTax(id, 'fees') })
    expect(result).toEqual({ ok: false, error: ['The rate is required'] })
    expect(setFees).not.toHaveBeenCalled()
    expect(mocks.emit).not.toHaveBeenCalled()
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'La tasa es obligatoria']])
  })

  it('a network failure says so and returns { ok: false } instead of throwing', async () => {
    fetch.mockRejectedValueOnce(new Error('Failed to fetch'))
    draw()
    let result
    await act(async () => { result = await ui.handleSaveTax(undefined, 'taxes') })
    expect(result).toEqual({ ok: false, error: ['Failed to fetch'] })
    // review (bugs E): an exception's text is not an API message, so the generic text is shown, not «Failed to fetch»
    expect(toasts().at(-1)).toEqual(['error', "We couldn't save the change."])
  })
})

describe('ProductDetailsAdvanced controller · handleDeleteTax', () => {
  it('a delete the API rejects says why and keeps the tax', async () => {
    fetch.mockReturnValueOnce(answer({ error: true, result: ['The rate is required'] }))
    const { setTaxes } = draw({ taxes: { 'id:31': TAX } })
    let result
    await act(async () => { result = await ui.handleDeleteTax(31, 'taxes') })
    expect(result).toEqual({ ok: false, error: ['The rate is required'] })
    expect(setTaxes).not.toHaveBeenCalled()
    expect(mocks.emit).not.toHaveBeenCalled()
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'La tasa es obligatoria']])
  })

  it('a network failure says so, ends the loading state and returns { ok: false }', async () => {
    fetch.mockRejectedValueOnce(new Error('Failed to fetch'))
    const { setFormTaxState } = draw({ taxes: { 'id:31': TAX } })
    let result
    await act(async () => { result = await ui.handleDeleteTax(31, 'taxes') })
    expect(result).toEqual({ ok: false, error: ['Failed to fetch'] })
    expect(toasts().at(-1)).toEqual(['error', "We couldn't save the change."])
    const last = setFormTaxState.mock.calls.at(-1)[0]
    expect(typeof last === 'function' ? last({ loading: true }) : last).toMatchObject({ loading: false })
  })

  it('deleting a fee removes it without mutating the list and emits fee_deleted with the fee (D9)', async () => {
    fetch.mockReturnValueOnce(answer({ error: false, result: {} }))
    const fees = { 'id:41': FEE }
    const { setFees } = draw({ fees })
    let result
    await act(async () => { result = await ui.handleDeleteTax(41, 'fees') })
    expect(result).toEqual({ ok: true })
    expect(fees).toHaveProperty('id:41')
    const next = setFees.mock.calls[0][0]
    expect(typeof next === 'function' ? next(fees) : next).toEqual({})
    expect(mocks.emit).toHaveBeenCalledWith('fee_deleted', { fee: FEE, isRemove: true })
    expect(toasts().at(-1)).toEqual(['success', 'Product fee deleted'])
  })
})
