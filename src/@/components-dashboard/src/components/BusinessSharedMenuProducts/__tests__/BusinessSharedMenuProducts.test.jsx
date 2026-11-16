/* eslint-disable import/first */
// redesign stores 5.6 (G3-04 / G3-06): contract of the shared menu products controller. The update answers
// `{ ok }`, never raises the Loading toast, merges the change immutably (menuState + menuList through the functional
// setMenuList), and `patchProduct` is local only.
import React from 'react'
import { act, render } from '@testing-library/react'
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

import { BusinessSharedMenuProducts } from '../index'

const BUSINESS = { id: 7 }
const PRODUCT_1 = { id: 11, name: 'Burger', price: 10, quantity: 5, extras: [{ id: 1, enabled: true }] }
const PRODUCT_2 = { id: 12, name: 'Fries', price: 3, quantity: 9 }
const MENU = { id: 5, name: 'Brand menu', products: [PRODUCT_1, PRODUCT_2] }
const OTHER_MENU = { id: 6, name: 'Other menu', products: [{ ...PRODUCT_1 }] }

const reply = (content, ok = true) => () => Promise.resolve({ ok, json: async () => content })
const replyNotJson = () => () => Promise.resolve({ ok: false, json: async () => { throw new SyntaxError('Unexpected token <') } })
const boom = (message) => () => Promise.reject(new Error(message))

let route
let ui
let menuList
let setMenuList

const putCalls = () => mocks.fetch.mock.calls.filter(([, options]) => options.method === 'PUT')
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

const draw = async (props = {}) => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  const view = render(
    <BusinessSharedMenuProducts
      UIComponent={UI}
      menu={MENU}
      business={BUSINESS}
      menuList={menuList}
      setMenuList={setMenuList}
      {...props}
    />
  )
  await flush()
  return view
}

const lastMenuListUpdate = () => {
  const arg = setMenuList.mock.calls.at(-1)[0]
  expect(arg).toBeTypeOf('function')
  return arg(menuList)
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  route = reply({ error: false, result: { id: PRODUCT_1.id } })
  menuList = { menus: [{ id: 1 }], menusShared: [MENU, OTHER_MENU] }
  setMenuList = vi.fn()
  mocks.fetch.mockImplementation((url, options) => {
    if (options.method === 'PUT') return route()
    throw new Error(`unexpected request ${options.method} ${url}`)
  })
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessSharedMenuProducts controller · menuState', () => {
  it('passes menuState with the menu and re-syncs it when the prop changes', async () => {
    const view = await draw()
    expect(ui.menuState.menu).toBe(MENU)
    const next = { id: 5, name: 'Renamed', products: [] }
    view.rerender(
      <BusinessSharedMenuProducts UIComponent={(p) => { ui = p; return null }} menu={next} business={BUSINESS} menuList={menuList} setMenuList={setMenuList} />
    )
    await flush()
    expect(ui.menuState.menu).toBe(next)
  })
})

describe('BusinessSharedMenuProducts controller · handleUpdateBusinessSharedMenuProduct', () => {
  it('success: { ok: true }, same PUT, success toast only, never the Loading toast', async () => {
    await draw()
    const changes = { price: 12 }
    let result
    await act(async () => { result = await ui.handleUpdateBusinessSharedMenuProduct(PRODUCT_1.id, changes) })

    expect(result).toEqual({ ok: true })
    const [url, options] = putCalls()[0]
    expect(url).toBe(`https://api.test/business/${BUSINESS.id}/menus_shared/${MENU.id}/products/${PRODUCT_1.id}`)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual(changes)
    expect(mocks.showToast).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Product saved')
    expect(ui.actionState.loading).toBe(false)
  })

  it('merges the changes into menuState.menu.products immutably', async () => {
    await draw()
    await act(async () => { await ui.handleUpdateBusinessSharedMenuProduct(PRODUCT_1.id, { price: 12 }) })

    const products = ui.menuState.menu.products
    expect(products[0]).toEqual({ ...PRODUCT_1, price: 12 })
    expect(products[1]).toBe(PRODUCT_2)
    expect(PRODUCT_1.price).toBe(10)
    expect(MENU.products[0]).toBe(PRODUCT_1)
    expect(ui.menuState.menu).not.toBe(MENU)
  })

  it('updates menuList.menusShared through the functional setMenuList, only the shared menu of this id, never mutating', async () => {
    await draw()
    await act(async () => { await ui.handleUpdateBusinessSharedMenuProduct(PRODUCT_1.id, { price: 12 }) })

    const next = lastMenuListUpdate()
    expect(next.menus).toBe(menuList.menus)
    expect(next.menusShared[0].products[0]).toEqual({ ...PRODUCT_1, price: 12 })
    expect(next.menusShared[0].products[1]).toBe(PRODUCT_2)
    expect(next.menusShared[1]).toBe(OTHER_MENU)
    expect(next.menusShared[0]).not.toBe(MENU)
    expect(menuList.menusShared[0]).toBe(MENU)
    expect(MENU.products[0].price).toBe(10)
  })

  it('survives a menuList with no menusShared', async () => {
    menuList = { menus: [] }
    await draw()
    let result
    await act(async () => { result = await ui.handleUpdateBusinessSharedMenuProduct(PRODUCT_1.id, { price: 12 }) })
    expect(result).toEqual({ ok: true })
    expect(() => lastMenuListUpdate()).not.toThrow()
  })

  it('API error: { ok: false, error } (result, not the old resulut typo), no list change, no toast', async () => {
    await draw()
    route = reply({ error: true, result: ['BAD_PRICE'] })
    let result
    await act(async () => { result = await ui.handleUpdateBusinessSharedMenuProduct(PRODUCT_1.id, { price: -1 }) })

    expect(result).toEqual({ ok: false, error: ['BAD_PRICE'] })
    expect(ui.menuState.menu).toBe(MENU)
    expect(setMenuList).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.actionState.loading).toBe(false)
  })

  it('non-ok response: { ok: false, error }, settled', async () => {
    await draw()
    route = reply({ result: 'FORBIDDEN' }, false)
    let result
    await act(async () => { result = await ui.handleUpdateBusinessSharedMenuProduct(PRODUCT_1.id, { price: 1 }) })

    expect(result).toEqual({ ok: false, error: 'FORBIDDEN' })
    expect(setMenuList).not.toHaveBeenCalled()
    expect(ui.actionState.loading).toBe(false)
  })

  it('non-ok response that is not JSON resolves { ok: false } instead of throwing', async () => {
    await draw()
    route = replyNotJson()
    let result
    await act(async () => { result = await ui.handleUpdateBusinessSharedMenuProduct(PRODUCT_1.id, { price: 1 }) })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(ui.actionState.loading).toBe(false)
  })

  it('network failure: { ok: false, error: message }, settled', async () => {
    await draw()
    route = boom('Network down')
    let result
    await act(async () => { result = await ui.handleUpdateBusinessSharedMenuProduct(PRODUCT_1.id, { price: 1 }) })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.menuState.menu).toBe(MENU)
    expect(ui.actionState.loading).toBe(false)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })
})

describe('BusinessSharedMenuProducts controller · patchProduct', () => {
  it('merges the patch locally with no request and no toast, immutably', async () => {
    await draw()
    await act(async () => { ui.patchProduct(PRODUCT_1.id, { quantity: 1, featured: true }) })

    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.menuState.menu.products[0]).toEqual({ ...PRODUCT_1, quantity: 1, featured: true })
    expect(ui.menuState.menu.products[1]).toBe(PRODUCT_2)
    expect(PRODUCT_1.quantity).toBe(5)
    expect(MENU.products[0]).toBe(PRODUCT_1)
  })

  it('two patches in a row both stick', async () => {
    await draw()
    await act(async () => {
      ui.patchProduct(PRODUCT_1.id, { quantity: 1 })
      ui.patchProduct(PRODUCT_1.id, { price: 99 })
    })
    expect(ui.menuState.menu.products[0]).toEqual({ ...PRODUCT_1, quantity: 1, price: 99 })
  })
})
