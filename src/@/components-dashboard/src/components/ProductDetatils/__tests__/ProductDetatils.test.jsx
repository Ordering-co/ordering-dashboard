/* eslint-disable import/first */
// redesign SP-F2 (D2): the product controller tells the editor how the Enabled switch and Duplicate went.
// `handleChangeProductActiveState` -> { ok: true } | { ok: false, error }; a good save keeps the other pending edits
// and updates `categoryState`. `handleDuplicateProduct` -> { ok } | { ok: false, error } and leaves
// `duplicateState.error`. No toast is added.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  showToast: vi.fn(),
  fetch: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const api = {
    root: 'https://api.test',
    businesses: () => ({ categories: () => ({ products: () => ({ save: mocks.save }) }) })
  }
  return { useApi: () => [api] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))
vi.mock('../../../contexts/AssistantContext', () => ({
  useAssistantRecordChanges: () => {}
}))

import { ProductDetatils } from '../index'

const PRODUCT = { id: 11, name: 'Burger', category_id: 4, enabled: true, price: 8, extras: [] }
const OTHER = { id: 12, name: 'Fries', category_id: 4, enabled: true, price: 3 }

let ui
const draw = (extra = {}) => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  const props = {
    UIComponent: UI,
    business: { id: 3, categories: [] },
    productId: PRODUCT.id,
    categoryId: PRODUCT.category_id,
    product: PRODUCT,
    categoryState: { products: [PRODUCT, OTHER] },
    handleUpdateCategoryState: vi.fn(),
    ...extra
  }
  render(<ProductDetatils {...props} />)
  return props
}

const toastTypes = () => mocks.showToast.mock.calls.map(([type]) => type)

beforeEach(() => {
  mocks.save.mockReset()
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  global.fetch = mocks.fetch
})

describe('ProductDetatils controller · Enabled switch', () => {
  it('returns { ok: true }, saves only { enabled } and updates categoryState with the changed product', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 11, enabled: false } } })
    const props = draw()

    let result
    await act(async () => { result = await ui.handleChangeProductActiveState() })

    expect(result).toEqual({ ok: true })
    expect(mocks.save.mock.calls[0][0]).toEqual({ enabled: false })
    expect(ui.productState.product.enabled).toBe(false)
    expect(props.handleUpdateCategoryState).toHaveBeenCalledTimes(1)
    const { products } = props.handleUpdateCategoryState.mock.calls[0][0]
    expect(products.map(item => [item.id, item.enabled])).toEqual([[11, false], [12, true]])
    // the success toast it already had; nothing new
    expect(toastTypes()).toEqual(['info', 'success'])
  })

  it('still says the requested value when the answer does not carry it', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 11 } } })
    const props = draw()

    await act(async () => { await ui.handleChangeProductActiveState() })

    const { products } = props.handleUpdateCategoryState.mock.calls[0][0]
    expect(products.find(item => item.id === 11).enabled).toBe(false)
    expect(ui.productState.product.enabled).toBe(false)
  })

  it('keeps the unsaved edits of the other fields after a good save', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 11, enabled: false } } })
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Burger XL' } }) })
    expect(ui.formState.changes).toEqual({ name: 'Burger XL' })

    await act(async () => { await ui.handleChangeProductActiveState() })

    expect(ui.formState.changes).toEqual({ name: 'Burger XL' })
    expect(ui.formState.loading).toBe(false)
  })

  it('returns { ok: false, error } on an API error and leaves product, list and edits as they were', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Internal error'] } })
    const props = draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Burger XL' } }) })

    let result
    await act(async () => { result = await ui.handleChangeProductActiveState() })

    expect(result).toEqual({ ok: false, error: ['Internal error'] })
    expect(ui.productState.product.enabled).toBe(true)
    expect(props.handleUpdateCategoryState).not.toHaveBeenCalled()
    expect(ui.formState.changes).toEqual({ name: 'Burger XL' })
    expect(ui.formState.result).toEqual({ error: true, result: ['Internal error'] })
    expect(toastTypes()).toEqual(['info'])
  })

  it('returns { ok: false, error } when the request throws', async () => {
    mocks.save.mockRejectedValue(new Error('Network down'))
    const props = draw()

    let result
    await act(async () => { result = await ui.handleChangeProductActiveState() })

    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(props.handleUpdateCategoryState).not.toHaveBeenCalled()
    expect(toastTypes()).toEqual(['info'])
  })

  it('works without handleUpdateCategoryState', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 11, enabled: false } } })
    draw({ handleUpdateCategoryState: undefined, categoryState: undefined })

    let result
    await act(async () => { result = await ui.handleChangeProductActiveState() })

    expect(result).toEqual({ ok: true })
  })
})

describe('ProductDetatils controller · Save of the form (unchanged)', () => {
  it('still clears every pending edit after a good save, and answers { ok: true }', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 11, name: 'Burger XL' } } })
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Burger XL' } }) })

    let result
    await act(async () => { result = await ui.handleUpdateClick() })

    expect(result).toEqual({ ok: true })
    expect(mocks.save.mock.calls[0][0]).toEqual({ name: 'Burger XL' })
    expect(ui.formState.changes).toEqual({})
    expect(toastTypes()).toEqual(['info', 'success'])
  })

  it('keeps the edits when the save fails', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Nope'] } })
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Burger XL' } }) })

    let result
    await act(async () => { result = await ui.handleUpdateClick() })

    expect(result).toEqual({ ok: false, error: ['Nope'] })
    expect(ui.formState.changes).toEqual({ name: 'Burger XL' })
  })
})

// redesign stores 2.F: the Snooze dialog saves only `snooze_until` with `{ keepPendingChanges: true }`; the other
// pending edits are neither sent nor lost, and `formState.result` is left to the dialog (it shows the error inline).
describe('ProductDetatils controller · keepPendingChanges with other keys (Snooze)', () => {
  const SNOOZE = { snooze_until: '2026-10-11 18:50:00' }

  it('sends only the given keys, keeps the other pending edits, does not set result and returns { ok: true }', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 11, ...SNOOZE } } })
    const props = draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })
    const resultBefore = ui.formState.result

    let result
    await act(async () => { result = await ui.handleUpdateClick(SNOOZE, { keepPendingChanges: true }) })

    expect(result).toEqual({ ok: true })
    expect(mocks.save.mock.calls[0][0]).toEqual(SNOOZE)
    expect(ui.formState.changes).toEqual({ name: 'Draft' })
    expect(ui.formState.result).toBe(resultBefore)
    expect(ui.formState.loading).toBe(false)
    expect(ui.productState.product.snooze_until).toBe(SNOOZE.snooze_until)
    expect(props.handleUpdateCategoryState).toHaveBeenCalledTimes(1)
    expect(toastTypes()).toEqual(['info', 'success'])
  })

  it('keeps the very same changes object when none of the sent keys was pending', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 11, ...SNOOZE } } })
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })
    const changesBefore = ui.formState.changes

    await act(async () => { await ui.handleUpdateClick(SNOOZE, { keepPendingChanges: true }) })

    expect(ui.formState.changes).toBe(changesBefore)
  })

  it('removes only the sent keys when they were also pending', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 11, ...SNOOZE } } })
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })
    act(() => { ui.handleChangeInput({ target: { name: 'snooze_until', value: 'old' } }) })

    await act(async () => { await ui.handleUpdateClick(SNOOZE, { keepPendingChanges: true }) })

    expect(ui.formState.changes).toEqual({ name: 'Draft' })
  })

  it('on an API error leaves changes and result as they were and returns { ok: false, error }', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Nope'] } })
    const props = draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })
    const changesBefore = ui.formState.changes
    const resultBefore = ui.formState.result

    let result
    await act(async () => { result = await ui.handleUpdateClick(SNOOZE, { keepPendingChanges: true }) })

    expect(result).toEqual({ ok: false, error: ['Nope'] })
    expect(ui.formState.changes).toBe(changesBefore)
    expect(ui.formState.result).toBe(resultBefore)
    expect(ui.formState.loading).toBe(false)
    expect(props.handleUpdateCategoryState).not.toHaveBeenCalled()
    expect(toastTypes()).toEqual(['info'])
  })

  it('on a throw leaves changes and result as they were and returns { ok: false, error }', async () => {
    mocks.save.mockRejectedValue(new Error('Network down'))
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })
    const changesBefore = ui.formState.changes
    const resultBefore = ui.formState.result

    let result
    await act(async () => { result = await ui.handleUpdateClick(SNOOZE, { keepPendingChanges: true }) })

    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.formState.changes).toBe(changesBefore)
    expect(ui.formState.result).toBe(resultBefore)
    expect(ui.formState.loading).toBe(false)
  })

  it('keeps an edit typed while the request is in flight', async () => {
    let release
    mocks.save.mockReturnValue(new Promise(resolve => { release = resolve }))
    draw()
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }) })
    let pending
    act(() => { pending = ui.handleUpdateClick(SNOOZE, { keepPendingChanges: true }) })
    act(() => { ui.handleChangeInput({ target: { name: 'price', value: 9 } }) })
    await act(async () => {
      release({ content: { error: false, result: { id: 11, ...SNOOZE } } })
      await pending
    })

    expect(ui.formState.changes).toEqual({ name: 'Draft', price: 9 })
  })

  it('the Enabled switch still reports its failure in formState.result', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Internal error'] } })
    draw()
    await act(async () => { await ui.handleChangeProductActiveState() })
    expect(ui.formState.result).toEqual({ error: true, result: ['Internal error'] })
  })
})

describe('ProductDetatils controller · Duplicate', () => {
  it('returns { ok: true }, adds the copy to categoryState and keeps duplicateState clean', async () => {
    mocks.fetch.mockResolvedValue({ json: async () => ({ error: false, result: { id: 99, name: 'Burger (copy)' } }) })
    const props = draw()

    let result
    await act(async () => { result = await ui.handleDuplicateProduct() })

    expect(result).toEqual({ ok: true })
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://api.test/business/3/categories/4/products/11/duplicate')
    expect(props.handleUpdateCategoryState.mock.calls[0][0].products.map(item => item.id)).toEqual([11, 12, 99])
    expect(ui.duplicateState).toEqual({ loading: false, error: null })
    expect(toastTypes()).toEqual(['info', 'success'])
  })

  it('returns { ok: false, error } and leaves the message in duplicateState when the API answers an error', async () => {
    mocks.fetch.mockResolvedValue({ json: async () => ({ error: true, result: ['Limit reached'] }) })
    const props = draw()

    let result
    await act(async () => { result = await ui.handleDuplicateProduct() })

    expect(result).toEqual({ ok: false, error: ['Limit reached'] })
    expect(ui.duplicateState).toEqual({ loading: false, error: ['Limit reached'] })
    expect(props.handleUpdateCategoryState).not.toHaveBeenCalled()
    expect(toastTypes()).toEqual(['info'])
  })

  it('returns { ok: false, error } when the request throws, with the error toast it already had', async () => {
    mocks.fetch.mockRejectedValue(new Error('Network down'))
    draw()

    let result
    await act(async () => { result = await ui.handleDuplicateProduct() })

    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.duplicateState).toEqual({ loading: false, error: ['Network down'] })
    expect(toastTypes()).toEqual(['info', 'error'])
  })

  it('clears a previous failure when it is tried again', async () => {
    mocks.fetch.mockResolvedValueOnce({ json: async () => ({ error: true, result: ['Limit reached'] }) })
    mocks.fetch.mockResolvedValueOnce({ json: async () => ({ error: false, result: { id: 99 } }) })
    draw()

    await act(async () => { await ui.handleDuplicateProduct() })
    expect(ui.duplicateState.error).toEqual(['Limit reached'])
    await act(async () => { await ui.handleDuplicateProduct() })

    expect(ui.duplicateState).toEqual({ loading: false, error: null })
  })
})
