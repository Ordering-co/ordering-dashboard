/* eslint-disable import/first */
// redesign stores 5.5a: contract of the Menu detail controller. Shared products are read only for shared
// menus; delete and add answer `{ ok }`; `handleChangeMenuSite` tolerates a menu without `sites`; `pendingChangeKeys` /
// `isDirty` tell real edits apart from the products the controller seeds on open; `discardChanges()` reopens the form.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  fetch: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))

import { BusinessMenuOptions } from '../index'

let ui
let answer
let setMenuList
let setCurrentMenu
let onClose

const reply = (content) => () => Promise.resolve({ json: async () => content })
const boom = (message) => () => Promise.reject(new Error(message))
const sharedProductCalls = () => mocks.fetch.mock.calls.filter(([url]) => url.includes('/menus_shared/') && url.includes('/products'))
const callsWith = (method) => mocks.fetch.mock.calls.filter(([, options]) => options.method === method)

const savedMenu = () => ({
  id: 4,
  name: 'Lunch',
  comment: '',
  delivery: true,
  pickup: false,
  schedule: [{ enabled: true, lapses: [] }],
  products: [{ id: 1 }, { id: 2 }],
  sites: [{ id: 10 }, { id: 11 }]
})

const draw = async ({ menu = savedMenu(), isSelectedSharedMenus = false, categories = [] } = {}) => {
  ui = null
  setMenuList = vi.fn()
  setCurrentMenu = vi.fn()
  onClose = vi.fn()
  const UI = (props) => {
    ui = props
    return null
  }
  await act(async () => {
    render(
      <BusinessMenuOptions
        UIComponent={UI}
        business={{ id: 7, categories }}
        menu={menu}
        isSelectedSharedMenus={isSelectedSharedMenus}
        menuList={{ menus: [menu].filter(m => m?.id), menusShared: [menu].filter(m => m?.id) }}
        setMenuList={setMenuList}
        setCurrentMenu={setCurrentMenu}
        sitesState={{ sites: [{ id: 10 }, { id: 11 }, { id: 12 }] }}
        onClose={onClose}
      />
    )
  })
}
const type = async (name, value) => {
  await act(async () => { ui.handleChangeInput({ target: { name, value } }) })
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  answer = {
    get: reply({ error: false, result: [{ id: 1 }, { id: 2 }] }),
    write: reply({ error: false, result: { id: 4 } })
  }
  mocks.fetch.mockImplementation((url, options) => options.method === 'GET' ? answer.get() : answer.write())
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessMenuOptions controller · shared products', () => {
  it('does not ask for menus_shared products when the menu is the business own', async () => {
    await draw({ isSelectedSharedMenus: false })
    expect(sharedProductCalls()).toHaveLength(0)
    expect(setCurrentMenu).not.toHaveBeenCalled()
  })

  it('asks for menus_shared products when the menu is shared', async () => {
    await draw({ isSelectedSharedMenus: true })
    expect(sharedProductCalls()).toHaveLength(1)
    expect(sharedProductCalls()[0][0]).toContain('/business/7/menus_shared/4/products?params=')
  })
})

// redesign stores 5.18 (from 5.6): the product list of a shared menu asks for `quantity` too (the product detail draws and
// saves it; the API intersects `params` with the model's fields, so it never fails for it), and a menu that comes without `products`
// (or a category without them) does not take the editor down.
describe('BusinessMenuOptions controller · shared products (stores 5.18)', () => {
  const CATEGORIES = [
    { id: 20, name: 'Mains', products: [{ id: 1 }, { id: 2 }], subcategories: [{ id: 21, name: 'Grill' }] },
    { id: 30, name: 'Drinks' }
  ]

  it('asks for the quantity of each product, with the fields main asked for', async () => {
    await draw({ isSelectedSharedMenus: true })
    const params = new URL(sharedProductCalls()[0][0], 'https://api.test').searchParams.get('params').split(',')
    expect(params).toEqual(expect.arrayContaining(['id', 'name', 'enabled', 'featured', 'upselling', 'price', 'extras', 'inventoried', 'category_id', 'quantity']))
  })

  it('a menu without products opens with none chosen, and categories without products do not break it', async () => {
    const { products: _products, ...menu } = savedMenu()
    await draw({ menu, categories: CATEGORIES })
    expect(ui.selectedProductsIds).toEqual([])
    expect(ui.subCategoriesList.map(category => [category.id, category.isChecked])).toEqual([[20, false], [21, false], [30, false]])
  })

  // review F4: a menu that came without its products (or whose product list could not be read) must not be emptied by a save of
  // something else: `products` only goes when the list was known or the user chose some
  const putBody = () => JSON.parse(mocks.fetch.mock.calls.filter(([, options]) => options.method === 'PUT').at(-1)[1].body)

  it('a menu that came without products is saved without touching them', async () => {
    const { products: _products, ...menu } = savedMenu()
    await draw({ menu, categories: CATEGORIES })
    await type('name', 'Lunch 2')
    await act(async () => { await ui.handleUpdateBusinessMenuOption() })
    expect(putBody()).toEqual(expect.objectContaining({ name: 'Lunch 2' }))
    expect(putBody()).not.toHaveProperty('products')
  })

  it('a menu with its products sends them as main did', async () => {
    await draw({ categories: CATEGORIES })
    await type('name', 'Lunch 2')
    await act(async () => { await ui.handleUpdateBusinessMenuOption() })
    expect(putBody().products).toBe(JSON.stringify([1, 2]))
  })

  it('a shared menu whose products come back as nothing opens with none chosen', async () => {
    answer.get = reply({ error: false, result: null })
    await draw({ isSelectedSharedMenus: true, categories: CATEGORIES })
    expect(ui.selectedProductsIds).toEqual([])
  })
})

describe('BusinessMenuOptions controller · handleDeleteMenu', () => {
  it('resolves { ok: false, error } and keeps the form error when the API refuses', async () => {
    await draw()
    answer.write = reply({ error: true, result: ['CANNOT_DELETE'] })
    let result
    await act(async () => { result = await ui.handleDeleteMenu() })

    expect(result).toEqual({ ok: false, error: ['CANNOT_DELETE'] })
    expect(ui.formState.error).toEqual(['CANNOT_DELETE'])
    expect(ui.formState.loading).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
    expect(setMenuList).not.toHaveBeenCalled()
  })

  it('resolves { ok: false, error } on a network failure', async () => {
    await draw()
    answer.write = boom('Network down')
    let result
    await act(async () => { result = await ui.handleDeleteMenu() })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.formState.loading).toBe(false)
  })

  it('resolves { ok: true }, updates the list, shows the toast and closes', async () => {
    await draw()
    answer.write = reply({ error: false, result: {} })
    let result
    await act(async () => { result = await ui.handleDeleteMenu() })

    expect(result).toEqual({ ok: true })
    expect(callsWith('DELETE')[0][0]).toBe('https://api.test/business/7/menus/4')
    expect(setMenuList).toHaveBeenCalledWith(expect.objectContaining({ menus: [] }))
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Products catalog deleted')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('BusinessMenuOptions controller · handleAddBusinessMenuOption', () => {
  it('resolves { ok: true } when the menu is created', async () => {
    await draw({ menu: {} })
    answer.write = reply({ error: false, result: { id: 9, name: 'New', products: [] } })
    await type('name', 'New')
    let result
    await act(async () => { result = await ui.handleAddBusinessMenuOption() })

    expect(result).toEqual({ ok: true })
    expect(callsWith('POST')[0][0]).toBe('https://api.test/business/7/menus')
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Products catalog added')
    expect(onClose).toHaveBeenCalled()
  })

  // redesign bugs F row 10: the untouched schedule of a new menu is sent as it is shown (00:00-23:59), not 23:45
  it('sends the default schedule of a new menu closing at 23:59 when the schedule was never touched', async () => {
    await draw({ menu: {} })
    answer.write = reply({ error: false, result: { id: 9, name: 'New', products: [] } })
    await type('name', 'New')
    await act(async () => { await ui.handleAddBusinessMenuOption() })

    const schedule = JSON.parse(JSON.parse(callsWith('POST')[0][1].body).schedule)
    expect(schedule).toHaveLength(7)
    schedule.forEach(day => {
      expect(day.enabled).toBe(true)
      expect(day.lapses).toEqual([{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }])
    })
  })

  it('resolves { ok: false, error } with the API result when it refuses', async () => {
    await draw({ menu: {} })
    answer.write = reply({ error: true, result: ['NAME_REQUIRED'] })
    let result
    await act(async () => { result = await ui.handleAddBusinessMenuOption() })

    expect(result).toEqual({ ok: false, error: ['NAME_REQUIRED'] })
    expect(ui.formState.result).toEqual({ error: true, result: ['NAME_REQUIRED'] })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('resolves { ok: false, error: message } on a network failure', async () => {
    await draw({ menu: {} })
    answer.write = boom('Network down')
    let result
    await act(async () => { result = await ui.handleAddBusinessMenuOption() })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.formState.result).toEqual({ error: true, result: 'Network down' })
  })
})

// redesign stores 5.5b (G3-08): creating a menu walks the business categories to fill the new row's products.
describe('BusinessMenuOptions controller · handleAddBusinessMenuOption guards (G3-08)', () => {
  it('creates the menu in a store without categories', async () => {
    await draw({ menu: {}, categories: null })
    answer.write = reply({ error: false, result: { id: 9, name: 'New', products: [] } })
    await type('name', 'New')
    let result
    await act(async () => { result = await ui.handleAddBusinessMenuOption() })

    expect(result).toEqual({ ok: true })
    expect(setMenuList).toHaveBeenCalled()
    expect(setMenuList.mock.calls.at(-1)[0].menus.at(-1)).toMatchObject({ id: 9, products: [] })
  })

  it('creates the menu when the answer brings no products', async () => {
    await draw({ menu: {}, categories: [{ id: 1, products: [{ id: 5, name: 'Fries' }], subcategories: [] }] })
    answer.write = reply({ error: false, result: { id: 9, name: 'New' } })
    await type('name', 'New')
    let result
    await act(async () => { result = await ui.handleAddBusinessMenuOption() })

    expect(result).toEqual({ ok: true })
    expect(setMenuList.mock.calls.at(-1)[0].menus.at(-1)).toMatchObject({ id: 9, products: [] })
  })
})

describe('BusinessMenuOptions controller · handleChangeMenuSite', () => {
  it('does not throw when the menu has no `sites`', async () => {
    await draw({ menu: { id: 4, name: 'No sites', products: [] } })
    await act(async () => { ui.handleChangeMenuSite(12) })
    expect(ui.formState.changes.sites).toEqual([12])
  })

  it('still toggles a site against the saved ones', async () => {
    await draw()
    await act(async () => { ui.handleChangeMenuSite(12) })
    expect(ui.formState.changes.sites).toEqual([10, 11, 12])
    await act(async () => { ui.handleChangeMenuSite(12) })
    expect(ui.formState.changes.sites).not.toContain(12)
  })
})

describe('BusinessMenuOptions controller · pendingChangeKeys / isDirty', () => {
  it('a saved menu just opened is not dirty even though the products are seeded into the changes', async () => {
    await draw()
    expect(ui.formState.changes.products).toEqual([1, 2])
    expect(ui.pendingChangeKeys).toEqual([])
    expect(ui.isDirty).toBe(false)
  })

  it('detects a changed name and clears it again when the value goes back to the saved one', async () => {
    await draw()
    await type('name', 'Brunch')
    expect(ui.pendingChangeKeys).toEqual(['name'])
    expect(ui.isDirty).toBe(true)

    await type('name', 'Lunch')
    expect(ui.pendingChangeKeys).toEqual([])
    expect(ui.isDirty).toBe(false)
  })

  it('treats undefined, null and empty string as the same value', async () => {
    await draw()
    await type('comment', null)
    expect(ui.pendingChangeKeys).toEqual([])
    await type('comment', 'Hello')
    expect(ui.pendingChangeKeys).toEqual(['comment'])
  })

  it('compares products and sites as unordered sets of ids', async () => {
    await draw()
    await act(async () => { ui.setSelectedProductsIds([2, 1]) })
    expect(ui.pendingChangeKeys).toEqual([])
    await act(async () => { ui.setSelectedProductsIds([1, 2, 3]) })
    expect(ui.pendingChangeKeys).toEqual(['products'])

    await act(async () => { ui.handleSelectAllChannels() })
    expect(ui.pendingChangeKeys).toEqual(['products', 'sites'])
    await act(async () => { ui.handleSelectNoneChannels() })
    expect(ui.pendingChangeKeys).toEqual(['products', 'sites'])
  })

  it('compares booleans by truthiness and the schedule by value', async () => {
    await draw()
    await act(async () => { ui.handleCheckOrderType('pickup') })
    expect(ui.pendingChangeKeys).toEqual(['pickup'])
    await act(async () => { ui.handleCheckOrderType('pickup') })
    expect(ui.pendingChangeKeys).toEqual([])

    await act(async () => { ui.handleChangeScheduleState([{ enabled: true, lapses: [] }]) })
    expect(ui.pendingChangeKeys).toEqual([])
    await act(async () => { ui.handleChangeScheduleState([{ enabled: false, lapses: [] }]) })
    expect(ui.pendingChangeKeys).toEqual(['schedule'])
  })

  it('a new menu is not dirty with its seeded delivery, pickup and empty products, and is once anything else is typed', async () => {
    await draw({ menu: {} })
    expect(ui.formState.changes).toMatchObject({ delivery: true, pickup: true })
    expect(ui.pendingChangeKeys).toEqual([])
    expect(ui.isDirty).toBe(false)

    await type('name', 'New')
    expect(ui.pendingChangeKeys).toEqual(['name'])
    expect(ui.isDirty).toBe(true)

    await act(async () => { ui.handleCheckOrderType('delivery') })
    expect(ui.pendingChangeKeys.slice().sort()).toEqual(['delivery', 'name'])
  })
})

describe('BusinessMenuOptions controller · discardChanges', () => {
  it('leaves a saved menu as freshly opened', async () => {
    await draw()
    await type('name', 'Brunch')
    await act(async () => { ui.setSelectedProductsIds([1, 2, 3]) })
    await act(async () => { ui.handleChangeMenuSite(12) })
    expect(ui.isDirty).toBe(true)

    await act(async () => { ui.discardChanges() })
    expect(ui.pendingChangeKeys).toEqual([])
    expect(ui.isDirty).toBe(false)
    expect(ui.formState.changes.name).toBeUndefined()
    expect(ui.formState.changes.sites).toBeUndefined()
    expect(ui.selectedProductsIds).toEqual([1, 2])
  })

  it('leaves a new menu with only its seeded order types', async () => {
    await draw({ menu: {} })
    await type('name', 'New')
    await act(async () => { ui.handleCheckOrderType('delivery') })
    expect(ui.isDirty).toBe(true)

    await act(async () => { ui.discardChanges() })
    expect(ui.isDirty).toBe(false)
    expect(ui.formState.changes.name).toBeUndefined()
    expect(ui.formState.changes).toMatchObject({ delivery: true, pickup: true })
  })
})
