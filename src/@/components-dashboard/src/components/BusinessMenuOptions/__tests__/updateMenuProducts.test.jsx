import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { BusinessMenuOptions } from '../index'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: [{ token: 'test-token', user: { id: 7, level: 0 } }],
  api: [{ root: 'https://api.test/v400/en/demo' }]
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => mocks.session }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => mocks.api }))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

let controller
const UI = (props) => {
  controller = props
  return null
}

const business = { id: 3202, categories: [] }

const renderMenu = async (menu, menuProducts) => {
  const setCurrentMenu = vi.fn()
  vi.stubGlobal('fetch', vi.fn((url, options) => Promise.resolve({
    json: async () => options?.method === 'PUT'
      ? { error: false, result: { ...menu, ...JSON.parse(options.body) } }
      : { error: false, result: menuProducts }
  })))
  render(
    <BusinessMenuOptions
      UIComponent={UI}
      business={business}
      menu={menu}
      menuList={{ menus: [menu] }}
      setMenuList={vi.fn()}
      setCurrentMenu={setCurrentMenu}
    />
  )
  await waitFor(() => expect(setCurrentMenu).toHaveBeenCalledWith(expect.objectContaining({ loading: false })))
  await waitFor(() => expect(controller.formState.changes.products).toEqual(menuProducts.map(product => product.id)))
}

const save = async (name, value) => {
  act(() => controller.handleChangeInput({ target: { name, value } }))
  await act(async () => controller.handleUpdateBusinessMenuOption())
  const [url, options] = fetch.mock.calls.find(([, request]) => request?.method === 'PUT')
  return { url, body: JSON.parse(options.body) }
}

describe('BusinessMenuOptions update products', () => {
  beforeEach(() => {
    controller = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not send products for an all products menu without menu products', async () => {
    await renderMenu({ id: 4621, name: 'Main', all_products: true, products: [] }, [])

    const { url, body } = await save('name', 'Main 2')

    expect(url).toBe('https://api.test/v400/en/demo/business/3202/menus/4621')
    expect(body).toEqual({ name: 'Main 2' })
  })

  it('does not send products when all products is turned on', async () => {
    await renderMenu({ id: 4622, name: 'Catalog', all_products: false, products: [{ id: 1 }] }, [{ id: 1 }])

    const { body } = await save('all_products', true)

    expect(body).toEqual({ all_products: true })
  })

  it('keeps sending the selected products for a menu without all products', async () => {
    await renderMenu({ id: 4622, name: 'Catalog', all_products: false, products: [{ id: 1 }, { id: 2 }] }, [{ id: 1 }, { id: 2 }])

    const { body } = await save('name', 'Catalog 2')

    expect(body).toEqual({ name: 'Catalog 2', products: '[1,2]' })
  })
})
