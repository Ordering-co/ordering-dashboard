import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { Emitter } from '../../Emitter'
import { BusinessProductsListing } from '../index'

// One emitter for the whole file: the controller registers its tax / fee listeners on it
const sharedEvents = vi.hoisted(() => ({ current: null }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))

vi.mock('../../../contexts/EventContext', () => ({
  useEvent: () => [sharedEvents.current]
}))

global.IS_REACT_ACT_ENVIRONMENT = true

const emptyPage = { page_size: 10, current_page: 1, total: 0, total_pages: 1 }

/**
 * Mounts the controller with a fake API.
 * `business` is what `getBusiness` answers; `productsAnswer` what any products request answers.
 */
const mount = async ({ business, productsAnswer, props = {} }) => {
  sharedEvents.current = new Emitter()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue({ error: false, result: [] }) }))

  const productsGet = vi.fn().mockResolvedValue({
    content: productsAnswer || { error: false, result: [], pagination: emptyPage }
  })
  const singleProductGet = vi.fn().mockResolvedValue({ content: { result: { id: 9 } } })
  const productEndpoint = () => ({ parameters: vi.fn(() => ({ get: productsGet })) })
  const businessResource = {
    asDashboard: vi.fn(() => ({
      select: vi.fn(() => ({
        parameters: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ content: { result: business } }) }))
      }))
    })),
    products: vi.fn(productEndpoint),
    categories: vi.fn(() => ({
      products: vi.fn((productId) => (productId ? { parameters: vi.fn(() => ({ get: singleProductGet })) } : productEndpoint()))
    }))
  }
  const ordering = { root: 'https://api.test', businesses: vi.fn(() => businessResource) }
  const seen = { props: null }
  const UIComponent = (uiProps) => {
    seen.props = uiProps
    return null
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <BusinessProductsListing
        ordering={ordering}
        slug='test-business'
        propsToFetch={['id', 'categories']}
        UIComponent={UIComponent}
        {...props}
      />
    )
  })
  await vi.waitFor(() => expect(seen.props.businessState.loading).toBe(false))
  return { seen, root, ordering, productsGet, singleProductGet, businessResource }
}

describe('BusinessProductsListing controller · bugs E', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // 260-R: the request that ran on mount, before the business existed, left its error behind
  describe('260-R: a store with no categories', () => {
    test('ends without a products error: the empty state of the list is not replaced by «A business is required»', async () => {
      const { seen, root } = await mount({ business: { id: 10, categories: [] } })

      expect(seen.props.businessState.business).toMatchObject({ id: 10 })
      expect(seen.props.errors).toBeNull()
      expect(seen.props.categoryState.loading).toBe(false)

      act(() => root.unmount())
    })

    test('a store with categories ends without the error too once the first category is chosen', async () => {
      const { seen, root, productsGet } = await mount({ business: { id: 10, categories: [{ id: 1, name: 'Beer' }] } })

      await act(async () => {
        seen.props.setCategorySelected({ id: 1, name: 'Beer' })
      })
      await vi.waitFor(() => expect(productsGet).toHaveBeenCalled())
      expect(seen.props.errors).toBeNull()

      act(() => root.unmount())
    })

    test('a real failure of the products request is still reported', async () => {
      const { seen, root } = await mount({
        business: { id: 10, categories: [{ id: 1, name: 'Beer' }] },
        productsAnswer: { error: true, result: ['The products service is down'] }
      })

      await act(async () => {
        seen.props.setCategorySelected({ id: 1, name: 'Beer' })
      })
      await vi.waitFor(() => expect(seen.props.errors).toEqual(['The products service is down']))

      act(() => root.unmount())
    })

    test('a consumer that gives the business id still loads its products on mount', async () => {
      const { seen, root, productsGet } = await mount({
        business: { id: 10, categories: [] },
        props: { businessId: 10, deferProductsUntilBusinessLoaded: false }
      })

      expect(productsGet).toHaveBeenCalled()
      expect(seen.props.errors).toBeNull()

      act(() => root.unmount())
    })
  })

  // D8: ProductDetails fetches its own product; `productModal` has no reader
  describe('D8: deep link', () => {
    test('does not fetch the product a second time', async () => {
      const { root, singleProductGet } = await mount({
        business: { id: 10, categories: [{ id: 1, name: 'Beer' }] },
        props: { categoryId: '1', productId: '9', isInitialRender: true }
      })
      await act(async () => {})

      expect(singleProductGet).not.toHaveBeenCalled()

      act(() => root.unmount())
    })
  })

  // D9: the listeners of the tax / fee events
  describe('D9: tax and fee listeners', () => {
    const catalog = () => ({
      id: 10,
      categories: [
        {
          id: 1,
          name: 'Beer',
          products: [{ id: 100, tax: { id: 5, rate: 10 }, taxes: [{ id: 5, rate: 10 }], fee: { id: 7, name: 'Old' }, fee_id: 7 }],
          subcategories: [
            { id: 2, name: 'Craft', products: [{ id: 200, tax: { id: 5, rate: 10 }, fee: { id: 7, name: 'Old' }, fee_id: 7 }] },
            { id: 3, name: 'No products yet' }
          ]
        }
      ]
    })

    test('the business changes do not pile up listeners: one per event', async () => {
      const { seen, root } = await mount({ business: catalog() })

      for (let i = 0; i < 3; i++) {
        await act(async () => {
          seen.props.handleUpdateBusinessState({ name: `Renamed ${i}` })
        })
      }

      for (const name of ['tax_changed', 'tax_deleted', 'fee_changed', 'fee_deleted']) {
        expect(sharedEvents.current._events[name]).toHaveLength(1)
      }

      act(() => root.unmount())
      for (const name of ['tax_changed', 'tax_deleted', 'fee_changed', 'fee_deleted']) {
        expect(sharedEvents.current._events[name]).toHaveLength(0)
      }
    })

    test('tax_deleted removes the tax from the products (it ran the fee handler)', async () => {
      const { seen, root } = await mount({ business: catalog() })

      await act(async () => {
        sharedEvents.current.emit('tax_deleted', { tax: { id: 5 }, isRemove: true })
      })

      const [category] = seen.props.businessState.business.categories
      expect(category.products[0].tax).toBeNull()
      expect(category.products[0].tax_id).toBeNull()
      expect(category.subcategories[0].products[0].tax).toBeNull()

      act(() => root.unmount())
    })

    test('fee_deleted removes the fee whether the emitter sends { fee } or the { tax } of BusinessDetails', async () => {
      const { seen, root } = await mount({ business: catalog() })

      await act(async () => {
        sharedEvents.current.emit('fee_deleted', { fee: { id: 7 }, isRemove: true })
      })
      let [category] = seen.props.businessState.business.categories
      expect(category.products[0].fee).toBeNull()
      expect(category.subcategories[0].products[0].fee).toBeNull()

      act(() => root.unmount())

      const second = await mount({ business: catalog() })
      await act(async () => {
        sharedEvents.current.emit('fee_deleted', { tax: { id: 7 }, isRemove: true })
      })
      ;[category] = second.seen.props.businessState.business.categories
      expect(category.products[0].fee).toBeNull()
      expect(category.products[0].fee_id).toBeNull()
      expect(category.subcategories[0].products[0].fee).toBeNull()

      act(() => second.root.unmount())
    })

    test('fee_changed updates the fee of the products at any depth, and the tree stays an array of categories', async () => {
      const { seen, root } = await mount({ business: catalog() })

      await act(async () => {
        sharedEvents.current.emit('fee_changed', { fee: { id: 7, name: 'New' } })
        sharedEvents.current.emit('tax_changed', { tax: { id: 5, rate: 21 } })
      })

      const { categories } = seen.props.businessState.business
      expect(categories[0].products[0].fee.name).toBe('New')
      expect(categories[0].subcategories[0].products[0].fee.name).toBe('New')
      expect(categories[0].subcategories[0].products[0].tax.rate).toBe(21)
      // the recursion used to hang the result of the subcategories on the array of categories
      expect(Object.keys(categories)).toEqual(['0'])
      expect(categories[0].subcategories).toHaveLength(2)

      act(() => root.unmount())
    })
  })
})
