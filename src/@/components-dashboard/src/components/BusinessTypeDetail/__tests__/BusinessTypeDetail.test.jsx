/* eslint-disable import/first */
// redesign stores 5.2 (; G2-05, G2-09, G2-10): the controller of a business type answers each request with `{ ok: true, result? }`
// or `{ ok: false, error }`, so the form can keep the user when a save fails. A type that is not saved yet has nothing to delete (it used to
// read `id` of null and throw). `cleanChanges` drops what was typed and not saved.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), fetch: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/demo' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { BusinessTypeDetail } from '../index'

const SAVED = { id: 4, name: 'Pizza', image: 'pizza.png' }
const OTHER = { id: 5, name: 'Sushi' }

let ui
const draw = (props = {}) => {
  ui = null
  const UI = (received) => {
    ui = received
    return null
  }
  return render(<BusinessTypeDetail UIComponent={UI} businessTypes={[SAVED, OTHER]} {...props} />)
}

const answer = (content) => mocks.fetch.mockResolvedValue({ json: async () => content })

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  global.fetch = mocks.fetch
})

describe('BusinessTypeDetail controller', () => {
  it('update: posts the changes to /business_types/:id, merges the answer into the list and returns { ok: true, result }', async () => {
    answer({ error: false, result: { id: 4, name: 'Pizzeria' } })
    const setBusinessTypes = vi.fn()
    draw({ businessType: SAVED, setBusinessTypes })
    act(() => ui.handleChangeItem('name', 'Pizzeria'))
    let result
    await act(async () => { result = await ui.handleUpdateProductType() })
    expect(result).toEqual({ ok: true, result: { id: 4, name: 'Pizzeria' } })
    const [url, options] = mocks.fetch.mock.calls[0]
    expect(url).toBe('https://api.test/v400/demo/business_types/4')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ name: 'Pizzeria' })
    expect(setBusinessTypes).toHaveBeenCalledWith([{ id: 4, name: 'Pizzeria', image: 'pizza.png' }, OTHER])
    expect(ui.businessTypeState.businessType).toEqual({ id: 4, name: 'Pizzeria', image: 'pizza.png' })
    expect(ui.typeFormState).toEqual({ loading: false, changes: {}, error: null })
    expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Category updated')
  })

  // redesign stores 5.2 (5.2-02): an answer that does not repeat the id still updates the open type in the list
  it('update: merges the answer into the open type of the list when the answer has no id', async () => {
    answer({ error: false, result: { name: 'Pizzeria' } })
    const setBusinessTypes = vi.fn()
    draw({ businessType: SAVED, setBusinessTypes })
    act(() => ui.handleChangeItem('name', 'Pizzeria'))
    await act(async () => { await ui.handleUpdateProductType() })
    expect(setBusinessTypes).toHaveBeenCalledWith([{ id: 4, name: 'Pizzeria', image: 'pizza.png' }, OTHER])
  })

  it('add: posts to /business_types, appends the new type, closes and returns { ok: true, result }', async () => {
    answer({ error: false, result: { id: 9, name: 'Tacos' } })
    const setBusinessTypes = vi.fn()
    const onClose = vi.fn()
    draw({ businessType: null, setBusinessTypes, onClose })
    act(() => ui.handleChangeItem('name', 'Tacos'))
    let result
    await act(async () => { result = await ui.handleAddProductType() })
    expect(result).toEqual({ ok: true, result: { id: 9, name: 'Tacos' } })
    const [url, options] = mocks.fetch.mock.calls[0]
    expect(url).toBe('https://api.test/v400/demo/business_types')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ name: 'Tacos' })
    expect(setBusinessTypes).toHaveBeenCalledWith([SAVED, OTHER, { id: 9, name: 'Tacos' }])
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Category added')
  })

  it('returns { ok: false, error } when the API rejects the update, and keeps what was typed', async () => {
    answer({ error: true, result: ['Name is taken'] })
    const setBusinessTypes = vi.fn()
    draw({ businessType: SAVED, setBusinessTypes })
    act(() => ui.handleChangeItem('name', 'Sushi'))
    let result
    await act(async () => { result = await ui.handleUpdateProductType() })
    expect(result).toEqual({ ok: false, error: ['Name is taken'] })
    expect(setBusinessTypes).not.toHaveBeenCalled()
    expect(ui.typeFormState.loading).toBe(false)
    expect(ui.typeFormState.changes).toEqual({ name: 'Sushi' })
    expect(ui.typeFormState.error).toEqual(['Name is taken'])
  })

  it('returns { ok: false, error } when the API rejects the add, without closing', async () => {
    answer({ error: true, result: ['Name is required'] })
    const onClose = vi.fn()
    draw({ businessType: null, setBusinessTypes: vi.fn(), onClose })
    let result
    await act(async () => { result = await ui.handleAddProductType() })
    expect(result).toEqual({ ok: false, error: ['Name is required'] })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('returns { ok: false, error: [message] } when a request throws', async () => {
    mocks.fetch.mockRejectedValue(new Error('Network down'))
    draw({ businessType: SAVED, setBusinessTypes: vi.fn() })
    let update
    let add
    let remove
    await act(async () => { update = await ui.handleUpdateProductType() })
    await act(async () => { add = await ui.handleAddProductType() })
    await act(async () => { remove = await ui.handleDeleteProductType() })
    expect(update).toEqual({ ok: false, error: ['Network down'] })
    expect(add).toEqual({ ok: false, error: ['Network down'] })
    expect(remove).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.typeFormState.loading).toBe(false)
  })

  it('delete of a type that is not saved returns { ok: false } and makes no request (G2-09)', async () => {
    draw({ businessType: null, setBusinessTypes: vi.fn(), onClose: vi.fn() })
    let result
    await act(async () => { result = await ui.handleDeleteProductType() })
    expect(result.ok).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('delete of a saved type sends DELETE, removes it from the list and closes', async () => {
    answer({ error: false, result: {} })
    const setBusinessTypes = vi.fn()
    const onClose = vi.fn()
    draw({ businessType: SAVED, setBusinessTypes, onClose })
    let result
    await act(async () => { result = await ui.handleDeleteProductType() })
    expect(result).toEqual({ ok: true })
    const [url, options] = mocks.fetch.mock.calls[0]
    expect(url).toBe('https://api.test/v400/demo/business_types/4')
    expect(options.method).toBe('DELETE')
    expect(setBusinessTypes).toHaveBeenCalledWith([OTHER])
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Category deleted')
  })

  it('a failed delete returns { ok: false, error } and neither removes nor closes', async () => {
    answer({ error: true, result: ['The category is in use'] })
    const setBusinessTypes = vi.fn()
    const onClose = vi.fn()
    draw({ businessType: SAVED, setBusinessTypes, onClose })
    let result
    await act(async () => { result = await ui.handleDeleteProductType() })
    expect(result).toEqual({ ok: false, error: ['The category is in use'] })
    expect(setBusinessTypes).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    // the failure is the confirmation's to say, not a form error
    expect(ui.typeFormState.error).toBeNull()
  })

  it('cleanChanges empties the changes', () => {
    draw({ businessType: SAVED })
    act(() => ui.handleChangeItem('name', 'Pizzeria'))
    act(() => ui.handleChangeItem('image', 'data:image/png;base64,AAA'))
    expect(ui.typeFormState.changes).toEqual({ name: 'Pizzeria', image: 'data:image/png;base64,AAA' })
    act(() => ui.cleanChanges())
    expect(ui.typeFormState).toEqual({ loading: false, changes: {}, error: null })
  })
})
