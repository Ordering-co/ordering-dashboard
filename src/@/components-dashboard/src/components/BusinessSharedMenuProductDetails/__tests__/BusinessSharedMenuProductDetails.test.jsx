/* eslint-disable import/first */
// redesign stores 5.6 (G3-04 / G3-06): contract of the shared menu product detail controller. Price and
// quantity edits wait in `formState.changes` until `saveChanges()` (no autosave); toggles, extras, options and
// suboptions answer `{ ok, error? }`; nothing mutates the incoming product / menuList; no Loading toast.
import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ordering: { root: 'https://api.test' },
  showToast: vi.fn(),
  fetch: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [mocks.ordering]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))

import { BusinessSharedMenuProductDetails } from '../index'

const BUSINESS = { id: 7 }
const makeProduct = () => ({
  id: 11,
  name: 'Burger',
  price: 10,
  quantity: 5,
  inventoried: false,
  featured: false,
  upselling: false,
  extras: [
    {
      id: 1,
      enabled: true,
      options: [
        {
          id: 21,
          enabled: true,
          suboptions: [{ id: 31, enabled: true }, { id: 32, enabled: true }]
        },
        { id: 22, enabled: true }
      ]
    },
    { id: 2, enabled: true, options: [] }
  ]
})
const MENU = { id: 5, name: 'Brand menu' }

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value).forEach(deepFreeze)
  }
  return value
}
const clone = (value) => JSON.parse(JSON.stringify(value))

const reply = (content, ok = true) => () => Promise.resolve({ ok, json: async () => content })
const replyNotJson = () => () => Promise.resolve({ ok: false, json: async () => { throw new SyntaxError('Unexpected token <') } })
const boom = (message) => () => Promise.reject(new Error(message))

let route
let ui
let product
let menuList
let setMenuList
let onProductChange

const putCalls = () => mocks.fetch.mock.calls.filter(([, options]) => options.method === 'PUT')
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
const productUrl = (id) => `https://api.test/business/${BUSINESS.id}/menus_shared/${MENU.id}/products/${id}`

const buildElement = (props = {}) => {
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  return (
    <BusinessSharedMenuProductDetails
      UIComponent={UI}
      menu={MENU}
      product={product}
      business={BUSINESS}
      menuList={menuList}
      setMenuList={setMenuList}
      onProductChange={onProductChange}
      {...props}
    />
  )
}

const draw = async (props = {}) => {
  ui = null
  const view = render(buildElement(props))
  await flush()
  return { ...view, redraw: async (next) => { view.rerender(buildElement(next)); await flush() } }
}

const lastMenuListUpdate = () => {
  const arg = setMenuList.mock.calls.at(-1)[0]
  expect(arg).toBeTypeOf('function')
  return arg(menuList)
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  product = makeProduct()
  menuList = { menus: [], menusShared: [{ ...MENU, products: [product, { id: 12, price: 1 }] }, { id: 6, products: [makeProduct()] }] }
  setMenuList = vi.fn()
  onProductChange = vi.fn()
  route = reply({ error: false, result: {} })
  mocks.fetch.mockImplementation((url, options) => {
    if (options.method === 'PUT') return route()
    throw new Error(`unexpected request ${options.method} ${url}`)
  })
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('BusinessSharedMenuProductDetails controller · state', () => {
  it('passes productState and a clean formState', async () => {
    await draw()
    expect(ui.productState.product).toBe(product)
    expect(ui.formState).toEqual({ changes: {}, saving: false, error: null })
    expect(ui.pendingChangeKeys).toEqual([])
    expect(ui.isDirty).toBe(false)
  })

  it('a new product id resets changes and errors; a new object with the same id keeps the edits', async () => {
    const view = await draw()
    await act(async () => { ui.handleChangeField('price', '15') })
    route = reply({ error: true, result: ['NOPE'] })
    await act(async () => { await ui.saveChanges() })
    expect(ui.formState.error).toEqual(['NOPE'])

    await view.redraw({ product: { ...product, name: 'Burger v2' } })
    expect(ui.productState.product.name).toBe('Burger v2')
    expect(ui.formState.changes).toEqual({ price: '15' })
    expect(ui.formState.error).toEqual(['NOPE'])

    const other = { ...makeProduct(), id: 99 }
    await view.redraw({ product: other })
    expect(ui.productState.product).toBe(other)
    expect(ui.formState).toEqual({ changes: {}, saving: false, error: null })
  })
})

describe('BusinessSharedMenuProductDetails controller · handleChangeField and pendingChangeKeys', () => {
  it('stores the value with no request and no debounce autosave', async () => {
    await draw()
    vi.useFakeTimers()
    await act(async () => { ui.handleChangeField('price', '12') })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    expect(ui.formState.changes).toEqual({ price: '12' })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('two fields typed in the same tick both stay (functional update)', async () => {
    await draw()
    await act(async () => {
      ui.handleChangeField('price', '12')
      ui.handleChangeField('quantity', '8')
    })
    expect(ui.formState.changes).toEqual({ price: '12', quantity: '8' })
    expect(ui.pendingChangeKeys).toEqual(['price', 'quantity'])
    expect(ui.isDirty).toBe(true)
  })

  it('typing the stored value back is not dirty (numeric strings compare as numbers)', async () => {
    await draw()
    await act(async () => { ui.handleChangeField('price', '12') })
    expect(ui.isDirty).toBe(true)
    await act(async () => { ui.handleChangeField('price', '10') })
    expect(ui.pendingChangeKeys).toEqual([])
    expect(ui.isDirty).toBe(false)
    await act(async () => { ui.handleChangeField('price', '10.0') })
    expect(ui.isDirty).toBe(false)
    await act(async () => { ui.handleChangeField('price', 10) })
    expect(ui.isDirty).toBe(false)
  })

  it('an empty value equals an undefined or null stored value, but differs from a stored number', async () => {
    product = { ...makeProduct(), quantity: null }
    delete product.price
    await draw()
    await act(async () => {
      ui.handleChangeField('price', '')
      ui.handleChangeField('quantity', '')
    })
    expect(ui.pendingChangeKeys).toEqual([])

    await act(async () => { ui.handleChangeField('quantity', '3') })
    expect(ui.pendingChangeKeys).toEqual(['quantity'])
  })

  it('clearing a stored number is pending', async () => {
    await draw()
    await act(async () => { ui.handleChangeField('price', '') })
    expect(ui.pendingChangeKeys).toEqual(['price'])
  })

  it('discardChanges() clears the changes and the error', async () => {
    await draw()
    await act(async () => { ui.handleChangeField('price', '12') })
    route = reply({ error: true, result: 'NOPE' })
    await act(async () => { await ui.saveChanges() })
    expect(ui.formState.error).toBe('NOPE')

    await act(async () => { ui.discardChanges() })
    expect(ui.formState).toEqual({ changes: {}, saving: false, error: null })
    expect(ui.isDirty).toBe(false)
  })
})

describe('BusinessSharedMenuProductDetails controller · saveChanges', () => {
  it('nothing pending: { ok: true } without a request', async () => {
    await draw()
    let result
    await act(async () => { result = await ui.saveChanges() })
    expect(result).toEqual({ ok: true })

    await act(async () => { ui.handleChangeField('price', '10') })
    await act(async () => { result = await ui.saveChanges() })
    expect(result).toEqual({ ok: true })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('sends only the pending keys, with the same PUT', async () => {
    await draw()
    await act(async () => {
      ui.handleChangeField('price', '12')
      ui.handleChangeField('quantity', '5')
    })
    let result
    await act(async () => { result = await ui.saveChanges() })

    expect(result).toEqual({ ok: true })
    expect(putCalls()).toHaveLength(1)
    const [url, options] = putCalls()[0]
    expect(url).toBe(productUrl(product.id))
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ price: '12' })
  })

  it('sends what main sent: text, an emptied field as "", and a whole quantity', async () => {
    await draw()
    await act(async () => {
      ui.handleChangeField('price', 13.5)
      ui.handleChangeField('quantity', 7.8)
    })
    await act(async () => { await ui.saveChanges() })
    expect(JSON.parse(putCalls()[0][1].body)).toEqual({ price: '13.5', quantity: '7' })

    mocks.fetch.mockClear()
    await act(async () => { ui.handleChangeField('price', null) })
    await act(async () => { await ui.saveChanges() })
    expect(JSON.parse(putCalls()[0][1].body)).toEqual({ price: '' })
  })

  it('saving is true while the request is in flight and false afterwards', async () => {
    await draw()
    await act(async () => { ui.handleChangeField('price', '12') })
    let resolveFetch
    route = () => new Promise(resolve => {
      resolveFetch = () => resolve({ ok: true, json: async () => ({ error: false, result: {} }) })
    })
    let pending
    await act(async () => { pending = ui.saveChanges() })
    expect(ui.formState.saving).toBe(true)

    await act(async () => { resolveFetch(); await pending })
    expect(ui.formState.saving).toBe(false)
  })

  it('success: merges the saved patch, clears changes and error, toasts once, notifies the parent and the menuList', async () => {
    await draw()
    await act(async () => { ui.handleChangeField('price', '12') })
    let result
    await act(async () => { result = await ui.saveChanges() })

    expect(result.ok).toBe(true)
    expect(ui.productState.product).toEqual({ ...product, price: '12' })
    expect(ui.formState).toEqual({ changes: {}, saving: false, error: null })
    expect(ui.isDirty).toBe(false)
    expect(mocks.showToast).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Product saved')
    expect(onProductChange).toHaveBeenCalledWith(product.id, { price: '12' })

    const next = lastMenuListUpdate()
    expect(next.menusShared[0].products[0]).toEqual({ ...product, price: '12' })
    expect(next.menusShared[0].products[1]).toBe(menuList.menusShared[0].products[1])
    expect(next.menusShared[1]).toBe(menuList.menusShared[1])
    expect(menuList.menusShared[0].products[0].price).toBe(10)
  })

  it('works without onProductChange', async () => {
    await draw({ onProductChange: undefined })
    await act(async () => { ui.handleChangeField('price', '12') })
    let result
    await act(async () => { result = await ui.saveChanges() })
    expect(result.ok).toBe(true)
  })

  it('API error: { ok: false, error }, keeps the changes, saving false, no toast, no notification', async () => {
    await draw()
    await act(async () => { ui.handleChangeField('price', '-5') })
    route = reply({ error: true, result: ['BAD_PRICE'] })
    let result
    await act(async () => { result = await ui.saveChanges() })

    expect(result).toEqual({ ok: false, error: ['BAD_PRICE'] })
    expect(ui.formState).toEqual({ changes: { price: '-5' }, saving: false, error: ['BAD_PRICE'] })
    expect(ui.productState.product).toBe(product)
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(onProductChange).not.toHaveBeenCalled()
    expect(setMenuList).not.toHaveBeenCalled()
  })

  it('non-ok response: { ok: false, error }, saving false', async () => {
    await draw()
    await act(async () => { ui.handleChangeField('price', '12') })
    route = reply({ result: 'FORBIDDEN' }, false)
    let result
    await act(async () => { result = await ui.saveChanges() })

    expect(result).toEqual({ ok: false, error: 'FORBIDDEN' })
    expect(ui.formState).toEqual({ changes: { price: '12' }, saving: false, error: 'FORBIDDEN' })
  })

  it('non-ok response that is not JSON: { ok: false } and not stuck', async () => {
    await draw()
    await act(async () => { ui.handleChangeField('price', '12') })
    route = replyNotJson()
    let result
    await act(async () => { result = await ui.saveChanges() })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(ui.formState.saving).toBe(false)
    expect(ui.formState.changes).toEqual({ price: '12' })
  })

  it('network failure: { ok: false, error: message }, keeps the changes, saving false', async () => {
    await draw()
    await act(async () => { ui.handleChangeField('price', '12') })
    route = boom('Network down')
    let result
    await act(async () => { result = await ui.saveChanges() })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.formState).toEqual({ changes: { price: '12' }, saving: false, error: 'Network down' })
  })

  it('a retry after a failure succeeds and clears the error', async () => {
    await draw()
    await act(async () => { ui.handleChangeField('price', '12') })
    route = boom('Network down')
    await act(async () => { await ui.saveChanges() })
    route = reply({ error: false, result: {} })
    let result
    await act(async () => { result = await ui.saveChanges() })
    expect(result.ok).toBe(true)
    expect(ui.formState).toEqual({ changes: {}, saving: false, error: null })
  })
})

describe('BusinessSharedMenuProductDetails controller · handleToggleProperty', () => {
  it.each(['inventoried', 'featured', 'upselling'])('%s: success PUTs { key: value } and merges it', async (key) => {
    await draw()
    let result
    await act(async () => { result = await ui.handleToggleProperty(key, true) })

    expect(result).toEqual({ ok: true })
    const [url, options] = putCalls()[0]
    expect(url).toBe(productUrl(product.id))
    expect(JSON.parse(options.body)).toEqual({ [key]: true })
    expect(ui.productState.product[key]).toBe(true)
    expect(product[key]).toBe(false)
    expect(onProductChange).toHaveBeenCalledWith(product.id, { [key]: true })
    expect(mocks.showToast).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Product saved')
    expect(lastMenuListUpdate().menusShared[0].products[0][key]).toBe(true)
  })

  it('API error: returns the error and changes nothing', async () => {
    await draw()
    route = reply({ error: true, result: ['NOPE'] })
    let result
    await act(async () => { result = await ui.handleToggleProperty('featured', true) })

    expect(result).toEqual({ ok: false, error: ['NOPE'] })
    expect(ui.productState.product).toBe(product)
    expect(onProductChange).not.toHaveBeenCalled()
    expect(setMenuList).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('network failure and non-ok responses return { ok: false, error }', async () => {
    await draw()
    route = boom('Network down')
    let result
    await act(async () => { result = await ui.handleToggleProperty('featured', true) })
    expect(result).toEqual({ ok: false, error: 'Network down' })

    route = reply({ result: 'FORBIDDEN' }, false)
    await act(async () => { result = await ui.handleToggleProperty('featured', true) })
    expect(result).toEqual({ ok: false, error: 'FORBIDDEN' })
    expect(ui.productState.product).toBe(product)
  })

  it('does not touch the pending price / quantity edits', async () => {
    await draw()
    await act(async () => { ui.handleChangeField('price', '12') })
    await act(async () => { await ui.handleToggleProperty('featured', true) })
    expect(ui.formState.changes).toEqual({ price: '12' })
  })
})

describe('BusinessSharedMenuProductDetails controller · extras, options and suboptions', () => {
  const cases = [
    {
      name: 'handleUpdateExtra',
      call: () => ui.handleUpdateExtra(1, false),
      url: `https://api.test/business/${BUSINESS.id}/menus_shared/${MENU.id}/extras/1`,
      read: (p) => p.extras[0].enabled
    },
    {
      name: 'handleUpdateOption',
      call: () => ui.handleUpdateOption(21, false),
      url: `https://api.test/business/${BUSINESS.id}/menus_shared/${MENU.id}/options/21`,
      read: (p) => p.extras[0].options[0].enabled
    },
    {
      name: 'handleUpdateSuboption',
      call: () => ui.handleUpdateSuboption(32, false),
      url: `https://api.test/business/${BUSINESS.id}/menus_shared/${MENU.id}/suboptions/32`,
      read: (p) => p.extras[0].options[0].suboptions[1].enabled
    }
  ]

  it.each(cases)('$name success: same PUT { enabled }, immutable update, toast, onProductChange, menuList', async ({ call, url, read }) => {
    deepFreeze(product)
    deepFreeze(menuList)
    const before = clone(product)
    await draw()
    let result
    await act(async () => { result = await call() })

    expect(result).toEqual({ ok: true })
    const [calledUrl, options] = putCalls()[0]
    expect(calledUrl).toBe(url)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ enabled: false })

    expect(read(ui.productState.product)).toBe(false)
    expect(ui.productState.product).not.toBe(product)
    expect(product).toEqual(before)
    expect(read(product)).toBe(true)
    expect(read(menuList.menusShared[0].products[0])).toBe(true)

    expect(onProductChange).toHaveBeenCalledTimes(1)
    const [id, patch] = onProductChange.mock.calls[0]
    expect(id).toBe(product.id)
    expect(Object.keys(patch)).toEqual(['extras'])
    expect(read({ extras: patch.extras })).toBe(false)
    expect(mocks.showToast).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Product saved')

    const next = lastMenuListUpdate()
    expect(read(next.menusShared[0].products[0])).toBe(false)
    expect(read(menuList.menusShared[0].products[0])).toBe(true)
    expect(next.menusShared[1]).toBe(menuList.menusShared[1])
  })

  it.each(cases)('$name only flips the target, the rest of the tree is intact', async ({ call }) => {
    await draw()
    await act(async () => { await call() })
    const flat = JSON.stringify(ui.productState.product.extras)
    expect((flat.match(/"enabled":false/g) || []).length).toBe(1)
  })

  it.each(cases)('$name API error: returns the error, state unchanged, no toast', async ({ call }) => {
    await draw()
    route = reply({ error: true, result: ['NOPE'] })
    let result
    await act(async () => { result = await call() })

    expect(result).toEqual({ ok: false, error: ['NOPE'] })
    expect(ui.productState.product).toBe(product)
    expect(onProductChange).not.toHaveBeenCalled()
    expect(setMenuList).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.formState.saving).toBe(false)
  })

  it.each(cases)('$name network failure and non-ok: { ok: false, error }, state unchanged', async ({ call }) => {
    await draw()
    route = boom('Network down')
    let result
    await act(async () => { result = await call() })
    expect(result).toEqual({ ok: false, error: 'Network down' })

    route = reply({ result: 'FORBIDDEN' }, false)
    await act(async () => { result = await call() })
    expect(result).toEqual({ ok: false, error: 'FORBIDDEN' })

    route = replyNotJson()
    await act(async () => { result = await call() })
    expect(result.ok).toBe(false)
    expect(ui.productState.product).toBe(product)
  })

  it('a product without extras or options does not crash', async () => {
    product = { id: 11, price: 1, extras: [{ id: 1, enabled: true, options: [{ id: 21, enabled: true }] }] }
    await draw()
    let result
    await act(async () => { result = await ui.handleUpdateSuboption(32, false) })
    expect(result).toEqual({ ok: true })
    await act(async () => { result = await ui.handleUpdateOption(21, false) })
    expect(result).toEqual({ ok: true })

    cleanup()
    product = { id: 12, price: 1 }
    await draw()
    await act(async () => { result = await ui.handleUpdateExtra(1, false) })
    expect(result).toEqual({ ok: true })
  })
})

describe('BusinessSharedMenuProductDetails controller · surface', () => {
  it('no Loading toast anywhere and no leftover autosave handlers', async () => {
    await draw()
    await act(async () => { await ui.handleToggleProperty('featured', true) })
    await act(async () => { await ui.handleUpdateExtra(1, false) })
    expect(mocks.showToast.mock.calls.every(([type]) => type !== 'info')).toBe(true)
    expect(ui.handleChangeInput).toBeUndefined()
    expect(ui.handleChangeItem).toBeUndefined()
  })
})
