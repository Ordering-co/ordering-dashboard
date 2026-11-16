/* eslint-disable import/first */
// redesign J2 (, row 9, D-43 (a)): «Move up» and «Move down» in the ⋯ menu of a product row and of a category row of
// /stores/products. Both use the REAL controllers over a simulated API: choosing «Move up» sends the request the drag already sends
// (the rank of the previous sibling, siblings sorted by rank), «Move down» the rank of the next one. The drag is not touched here.
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  productSaves: [], // { businessId, categoryId, productId, params }
  categorySaves: [], // { businessId, categoryId, params }
  productResponse: null, // what the product save resolves to: { error, result }; null = echo the params as a success
  toasts: [],
  session: { loading: false }
}))

vi.mock('../../../../../../index', async () => {
  const { SingleBusinessCategory } = await vi.importActual('../../../../../../components/SingleBusinessCategory')
  const { SingleBusinessProduct } = await vi.importActual('../../../../../../components/SingleBusinessProduct')
  return {
    SingleBusinessCategory,
    SingleBusinessProduct,
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils: () => [{ parsePrice: value => `$${Number(value).toFixed(2)}`, optimizeImage: src => src }],
    useToast: () => [{}, { showToast: (type, message) => mockState.toasts.push([type, message]), hideToast: () => {} }]
  }
})
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [mockState.session] }))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{ dictionary: {} }, (_key, text) => text] }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'info', Success: 'success', Error: 'error' },
  useToast: () => [{}, { showToast: (type, message) => mockState.toasts.push([type, message]), hideToast: () => {} }]
}))
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{
    businesses: (businessId) => ({
      categories: (categoryId) => ({
        save: async (params) => {
          mockState.categorySaves.push({ businessId, categoryId, params })
          return { content: { error: false, result: { id: categoryId, ...params } } }
        },
        products: (productId) => ({
          save: async (params) => {
            mockState.productSaves.push({ businessId, categoryId, productId, params })
            return { content: mockState.productResponse ?? { error: false, result: { id: productId, ...params } } }
          }
        })
      })
    })
  }]
}))

import { SingleBusinessProduct } from '../../SingleBusinessProduct'
import { CatalogCategories } from '../index'

// ---- products ---------------------------------------------------------------------------------------------------------------------

const product = (id, name, rank) => ({ id, category_id: 3, name, price: 5, enabled: true, rank, fee: { fixed: 0, percentage: 0 }, tax: { rate: 7, type: 1 } })
const PRODUCTS = [product(5, 'Burger', 1), product(6, 'Fries', 2), product(7, 'Shake', 3)]

const drawProduct = (target, { products = PRODUCTS, variant = 'row', ...extra } = {}) => {
  const spies = { handleUpdateCategoryState: vi.fn(), handleUpdateBusinessState: vi.fn() }
  const props = {
    viewMethod: 'list',
    variant,
    product: products.find(item => item.name === target),
    category: { id: 3, products },
    business: { id: 1, service_fee: 0, categories: [{ id: 3, products }] },
    canReorder: true,
    hasSubcategories: false,
    handleOpenProductDetails: vi.fn(),
    setDataSelected: vi.fn(),
    ...spies,
    ...extra
  }
  const row = <SingleBusinessProduct {...props} />
  const utils = render(variant === 'card' ? <ul>{row}</ul> : <table>{row}</table>)
  return { ...utils, ...spies, handleOpenProductDetails: props.handleOpenProductDetails }
}

const openActions = async (user, name) => {
  await user.click(screen.getByRole('button', { name: `More actions for ${name}` }))
  return screen.findByRole('menu')
}

describe('products: Move up / Move down in the ⋯ menu of the row', () => {
  // live check (orderingv1, synthetic write): the moved product got the neighbour's rank and the neighbour kept it, so the tie left
  // the list drawn as before. A move is a swap: the neighbour takes the moved product's old rank, in the same state update.
  it('after Move up the neighbour takes the old rank of the moved product, so the list is drawn in the new order', async () => {
    const user = userEvent.setup()
    const { handleUpdateCategoryState, handleUpdateBusinessState } = drawProduct('Fries')
    await user.click(within(await openActions(user, 'Fries')).getByRole('menuitem', { name: 'Move up' }))
    await waitFor(() => expect(handleUpdateCategoryState).toHaveBeenCalledTimes(1))
    const ranks = (products) => Object.fromEntries(products.map(item => [item.name, item.rank]))
    expect(ranks(handleUpdateCategoryState.mock.calls[0][0].products)).toEqual({ Burger: 2, Fries: 1, Shake: 3 })
    expect(ranks(handleUpdateBusinessState.mock.calls[0][0].categories[0].products)).toEqual({ Burger: 2, Fries: 1, Shake: 3 })
  })

  it('Move up sends the rank of the previous sibling, with the request and the state updates of the drag', async () => {
    const user = userEvent.setup()
    const { handleUpdateCategoryState, handleUpdateBusinessState, handleOpenProductDetails } = drawProduct('Fries')
    const menu = await openActions(user, 'Fries')
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Move up', 'Move down'])
    await user.click(within(menu).getByRole('menuitem', { name: 'Move up' }))
    await waitFor(() => expect(mockState.productSaves).toEqual([{ businessId: 1, categoryId: 3, productId: 6, params: { rank: 1 } }]))
    await waitFor(() => expect(handleUpdateCategoryState).toHaveBeenCalledTimes(1))
    expect(handleUpdateBusinessState).toHaveBeenCalledTimes(1)
    expect(mockState.toasts.at(-1)).toEqual(['success', 'Product updated'])
    expect(screen.queryByRole('menu')).toBeNull() // the menu closes as for any other action
    expect(handleOpenProductDetails).not.toHaveBeenCalled() // a click in the menu is not a click on the row
  })

  it('Move down sends the rank of the next sibling', async () => {
    const user = userEvent.setup()
    drawProduct('Fries')
    await user.click(within(await openActions(user, 'Fries')).getByRole('menuitem', { name: 'Move down' }))
    await waitFor(() => expect(mockState.productSaves).toEqual([{ businessId: 1, categoryId: 3, productId: 6, params: { rank: 3 } }]))
  })

  it('uses the rank of the neighbour when ranks have gaps, whatever the order of the list', async () => {
    const user = userEvent.setup()
    drawProduct('Fries', { products: [product(7, 'Shake', 40), product(6, 'Fries', 10), product(5, 'Burger', 3)] })
    await user.click(within(await openActions(user, 'Fries')).getByRole('menuitem', { name: 'Move up' }))
    await waitFor(() => expect(mockState.productSaves.map(save => save.params)).toEqual([{ rank: 3 }]))
  })

  it('the first product cannot move up and the last cannot move down', async () => {
    const user = userEvent.setup()
    const first = drawProduct('Burger')
    const menu = await openActions(user, 'Burger')
    expect(within(menu).getByRole('menuitem', { name: 'Move up' })).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByRole('menuitem', { name: 'Move down' })).not.toHaveAttribute('aria-disabled')
    await user.keyboard('{Escape}')
    first.unmount()

    drawProduct('Shake')
    const lastMenu = await openActions(user, 'Shake')
    expect(within(lastMenu).getByRole('menuitem', { name: 'Move down' })).toHaveAttribute('aria-disabled', 'true')
    await user.click(within(lastMenu).getByRole('menuitem', { name: 'Move down' }))
    expect(mockState.productSaves).toEqual([])
  })

  it('where the drag is off (no category chosen, or subcategories with products) there is no menu', () => {
    drawProduct('Fries', { canReorder: false })
    expect(screen.queryByRole('button', { name: 'More actions for Fries' })).toBeNull()
  })

  it('a refused move says why in the row and does not close it as a success', async () => {
    mockState.productResponse = { error: true, result: ['Rank not valid'] }
    const user = userEvent.setup()
    drawProduct('Fries')
    await user.click(within(await openActions(user, 'Fries')).getByRole('menuitem', { name: 'Move up' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('is in the card of a phone too (the card has no drag, so this is how it is reordered there)', async () => {
    const user = userEvent.setup()
    drawProduct('Fries', { variant: 'card' })
    await user.click(within(await openActions(user, 'Fries')).getByRole('menuitem', { name: 'Move up' }))
    await waitFor(() => expect(mockState.productSaves.map(save => save.params)).toEqual([{ rank: 1 }]))
  })

  it('puts the focus back on the ⋯ trigger of the moved row', async () => {
    const user = userEvent.setup()
    drawProduct('Fries')
    await user.click(within(await openActions(user, 'Fries')).getByRole('menuitem', { name: 'Move up' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions for Fries' })).toHaveFocus())
  })
})

// ---- categories -------------------------------------------------------------------------------------------------------------------

const makeBusiness = () => ({
  id: 5,
  name: 'Sample Burgers',
  categories: [
    {
      id: 20,
      name: 'Drinks',
      rank: 2,
      enabled: true,
      subcategories: [
        { id: 202, name: 'Cold', rank: 8, enabled: true, subcategories: [] },
        { id: 201, name: 'Hot', rank: 3, enabled: true, subcategories: [] }
      ]
    },
    { id: 10, name: 'Burgers', rank: 1, enabled: true, subcategories: [] },
    { id: 30, name: 'Desserts', rank: 5, enabled: true, subcategories: [] }
  ]
})

const Page = ({ initialBusiness }) => {
  const [business, setBusiness] = useState(initialBusiness)
  const [categorySelected, setSelected] = useState(null)
  return (
    <CatalogCategories
      businessState={{ loading: false, business }}
      categorySelected={categorySelected}
      onClickCategory={(event, category) => setSelected(category)}
      handleOpenCategoryDetails={() => {}}
      handleUpdateBusinessState={setBusiness}
      setCategorySelected={setSelected}
      setCurrentCategory={() => {}}
      openCategories={{ values: [] }}
    />
  )
}

const drawTree = () => render(<Page initialBusiness={makeBusiness()} />)

describe('categories: Move up / Move down in the ⋯ menu of the row', () => {
  beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })
  afterEach(() => { delete Element.prototype.scrollIntoView })

  it('after Move up the tree is drawn in the new order (the neighbour takes the old rank)', async () => {
    const user = userEvent.setup()
    drawTree()
    const order = () => screen.getAllByRole('button', { name: /^More actions for / }).map(button => button.getAttribute('aria-label').replace('More actions for ', ''))
    expect(order().filter(name => ['Burgers', 'Drinks', 'Desserts'].includes(name))).toEqual(['Burgers', 'Drinks', 'Desserts'])
    await user.click(screen.getByRole('button', { name: 'More actions for Drinks' }))
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Move up' }))
    await waitFor(() => expect(order().filter(name => ['Burgers', 'Drinks', 'Desserts'].includes(name))).toEqual(['Drinks', 'Burgers', 'Desserts']))
  })

  it('Move up sends the rank of the previous category, to the same request as the drag', async () => {
    const user = userEvent.setup()
    drawTree()
    await user.click(screen.getByRole('button', { name: 'More actions for Drinks' }))
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Move up' }))
    await waitFor(() => expect(mockState.categorySaves).toEqual([{ businessId: 5, categoryId: 20, params: { rank: 1 } }]))
    expect(mockState.toasts.at(-1)).toEqual(['success', 'Category updated'])
  })

  it('Move down sends the rank of the next category (ranks 1, 2, 5: Drinks goes to 5)', async () => {
    const user = userEvent.setup()
    drawTree()
    await user.click(screen.getByRole('button', { name: 'More actions for Drinks' }))
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Move down' }))
    await waitFor(() => expect(mockState.categorySaves).toEqual([{ businessId: 5, categoryId: 20, params: { rank: 5 } }]))
  })

  it('moves a subcategory among the subcategories of its own parent only', async () => {
    const user = userEvent.setup()
    drawTree()
    await user.click(screen.getByRole('button', { name: 'Expand Drinks' }))
    await user.click(screen.getByRole('button', { name: 'More actions for Cold' }))
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Move up' }))
    await waitFor(() => expect(mockState.categorySaves).toEqual([{ businessId: 5, categoryId: 202, params: { rank: 3 } }]))
  })

  it('the first of a list cannot move up and the last cannot move down', async () => {
    const user = userEvent.setup()
    drawTree()
    await user.click(screen.getByRole('button', { name: 'More actions for Burgers' }))
    expect(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Move up' })).toHaveAttribute('aria-disabled', 'true')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'More actions for Desserts' }))
    const down = within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Move down' })
    expect(down).toHaveAttribute('aria-disabled', 'true')
    await user.click(down)
    expect(mockState.categorySaves).toEqual([])
  })

  it('puts the focus back on the ⋯ trigger of the moved category', async () => {
    const user = userEvent.setup()
    drawTree()
    await user.click(screen.getByRole('button', { name: 'More actions for Drinks' }))
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Move up' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions for Drinks' })).toHaveFocus())
  })
})

beforeEach(() => {
  mockState.productSaves = []
  mockState.categorySaves = []
  mockState.productResponse = null
  mockState.toasts = []
  mockState.session = { loading: false }
})
