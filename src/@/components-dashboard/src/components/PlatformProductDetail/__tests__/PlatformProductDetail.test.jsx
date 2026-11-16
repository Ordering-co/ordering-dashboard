/* eslint-disable import/first */
// redesign GC-A: the platform product detail handlers return `{ ok, result | error }`, a switch payload keeps the
// unsaved form changes, `{ silent: true }` leaves `formState.error` alone, `price` travels as a number and the form state
// never overwrites itself (functional updates).
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), showToast: vi.fn(), hideToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast, hideToast: mocks.hideToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))

import { PlatformProductDetail } from '../index'

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
const UI = (p) => {
  ui = p
  return null
}

const handlers = () => ({
  handleSuccessDeleteProduct: vi.fn(),
  handleSuccessUpdateProduct: vi.fn(),
  handleSuccessAddProduct: vi.fn(),
  setSelectedProduct: vi.fn(),
  onClose: vi.fn()
})

const setup = (extra = {}) => {
  const h = handlers()
  render(<PlatformProductDetail UIComponent={UI} product={{ id: 5 }} {...h} {...extra} />)
  return h
}

const bodyOf = (call = 0) => JSON.parse(mocks.fetch.mock.calls[call][1].body)

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.showToast.mockReset()
  mocks.hideToast.mockReset()
  globalThis.fetch = mocks.fetch
})

describe('PlatformProductDetail controller · return values', () => {
  it('update returns { ok: true, result } and keeps its toasts and calls', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: { id: 5, name: 'Gift' } }))
    const h = setup()
    let out
    await act(async () => { out = await ui.handleUpdateProduct() })
    expect(out).toEqual({ ok: true, result: { id: 5, name: 'Gift' } })
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://api.test/platform_products/5')
    expect(mocks.fetch.mock.calls[0][1].method).toBe('POST')
    expect(h.handleSuccessUpdateProduct).toHaveBeenCalledWith({ id: 5, name: 'Gift' })
    expect(h.setSelectedProduct).toHaveBeenCalledWith({ id: 5, name: 'Gift' })
    expect(mocks.showToast).toHaveBeenCalledWith('info', 'Loading')
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Gift card updated')
    expect(ui.formState).toEqual({ loading: false, error: null, changes: {} })
    expect(mocks.hideToast).not.toHaveBeenCalled()
  })

  it('add returns { ok: true, result } and closes', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: { id: 9 } }))
    const h = setup()
    let out
    await act(async () => { out = await ui.handleAddProduct('gift_card') })
    expect(out).toEqual({ ok: true, result: { id: 9 } })
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://api.test/platform_products')
    expect(bodyOf()).toEqual({ type: 'gift_card' })
    expect(h.handleSuccessAddProduct).toHaveBeenCalledWith({ id: 9 })
    expect(h.onClose).toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Gift card added')
    expect(mocks.hideToast).not.toHaveBeenCalled()
  })

  it('delete returns { ok: true, result } and closes', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: {} }))
    const h = setup()
    let out
    await act(async () => { out = await ui.handleDeleteProduct() })
    expect(out).toEqual({ ok: true, result: {} })
    expect(mocks.fetch.mock.calls[0][1].method).toBe('DELETE')
    expect(h.handleSuccessDeleteProduct).toHaveBeenCalledWith(5)
    expect(h.onClose).toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Gift card deleted')
    expect(mocks.hideToast).not.toHaveBeenCalled()
  })

  it.each([
    ['update', (u) => u.handleUpdateProduct()],
    ['add', (u) => u.handleAddProduct('gift_card')],
    ['delete', (u) => u.handleDeleteProduct()]
  ])('%s returns { ok: false, error: result } on an API error and still sets formState.error', async (_name, run) => {
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Price is required'] }))
    const h = setup()
    let out
    await act(async () => { out = await run(ui) })
    expect(out).toEqual({ ok: false, error: ['Price is required'] })
    expect(ui.formState.error).toEqual(['Price is required'])
    expect(ui.formState.loading).toBe(false)
    expect(h.onClose).not.toHaveBeenCalled()
    // redesign bugs F row 19: the failure is shown by the caller, so the «Loading» toast must not stay
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['update', (u) => u.handleUpdateProduct()],
    ['add', (u) => u.handleAddProduct('gift_card')],
    ['delete', (u) => u.handleDeleteProduct()]
  ])('%s returns { ok: false, error: [message] } on a throw and sets formState.error as today', async (_name, run) => {
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('Network down')))
    setup()
    let out
    await act(async () => { out = await run(ui) })
    expect(out).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.formState.error).toBe('Network down')
    expect(ui.formState.loading).toBe(false)
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })
})

describe('PlatformProductDetail controller · payload and silent', () => {
  it('a switch payload keeps the unsaved form changes', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: { id: 5 } }))
    setup()
    act(() => ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }))
    await act(async () => { await ui.handleUpdateProduct({ enabled: true }) })
    expect(bodyOf()).toEqual({ enabled: true })
    expect(ui.formState.changes).toEqual({ name: 'Draft' })
    expect(ui.formState.error).toBe(null)
  })

  it('a save without payload clears the changes', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: { id: 5 } }))
    setup()
    act(() => ui.handleChangeInput({ target: { name: 'name', value: 'Draft' } }))
    await act(async () => { await ui.handleUpdateProduct() })
    expect(bodyOf()).toEqual({ name: 'Draft' })
    expect(ui.formState.changes).toEqual({})
  })

  it('silent leaves formState.error alone but still returns the error', async () => {
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Nope'] }))
    setup()
    let out
    await act(async () => { out = await ui.handleUpdateProduct({ enabled: true }, { silent: true }) })
    expect(out).toEqual({ ok: false, error: ['Nope'] })
    expect(ui.formState.error).toBe(null)
    expect(ui.formState.loading).toBe(false)
    // silent: the caller shows the failure (inline), so the «Loading» toast is hidden here too
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it('silent also holds on a throw, and for add and delete', async () => {
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('Network down')))
    setup()
    await act(async () => { await ui.handleUpdateProduct({ enabled: true }, { silent: true }) })
    expect(ui.formState.error).toBe(null)
    await act(async () => { await ui.handleAddProduct('gift_card', { silent: true }) })
    expect(ui.formState.error).toBe(null)
    await act(async () => { await ui.handleDeleteProduct({ silent: true }) })
    expect(ui.formState.error).toBe(null)
    expect(mocks.hideToast).toHaveBeenCalledTimes(3)
  })

  it('delete used as a click handler (event argument) is not silent', async () => {
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Nope'] }))
    setup()
    await act(async () => { await ui.handleDeleteProduct({ type: 'click' }) })
    expect(ui.formState.error).toEqual(['Nope'])
  })
})

describe('PlatformProductDetail controller · price and state', () => {
  it('add sends a numeric price as a number', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: { id: 9 } }))
    setup()
    act(() => ui.handleChangeItem({ name: 'Card', price: '12.50' }))
    await act(async () => { await ui.handleAddProduct('gift_card') })
    expect(bodyOf()).toEqual({ name: 'Card', price: 12.5, type: 'gift_card' })
  })

  it('update sends a numeric price as a number', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: { id: 5 } }))
    setup()
    act(() => ui.handleChangeItem({ name: 'Card', price: '20' }))
    await act(async () => { await ui.handleUpdateProduct() })
    expect(bodyOf()).toEqual({ name: 'Card', price: 20 })
  })

  it('a price that is not numeric travels untouched', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: { id: 9 } }))
    setup()
    act(() => ui.handleChangeItem({ name: 'Card', price: 'abc' }))
    await act(async () => { await ui.handleAddProduct('gift_card') })
    expect(bodyOf().price).toBe('abc')
  })

  it('two changes in the same tick both survive', () => {
    setup()
    act(() => {
      ui.handleChangeInput({ target: { name: 'name', value: 'Card' } })
      ui.handleChangeItem({ price: '5' })
    })
    expect(ui.formState.changes).toEqual({ name: 'Card', price: '5' })
  })

  it('goes loading while the request is in flight and keeps the changes made meanwhile', async () => {
    let settle
    mocks.fetch.mockImplementation(() => new Promise((resolve) => { settle = resolve }))
    setup()
    let pending
    act(() => { pending = ui.handleUpdateProduct({ enabled: true }) })
    expect(ui.formState.loading).toBe(true)
    act(() => ui.handleChangeInput({ target: { name: 'name', value: 'Typed meanwhile' } }))
    await act(async () => {
      settle({ json: () => Promise.resolve({ error: false, result: { id: 5 } }) })
      await pending
    })
    expect(ui.formState.loading).toBe(false)
    expect(ui.formState.changes).toEqual({ name: 'Typed meanwhile' })
  })
})
