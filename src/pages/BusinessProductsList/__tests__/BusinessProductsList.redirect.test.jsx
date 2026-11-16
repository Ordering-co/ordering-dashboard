import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'

const listingProps = vi.hoisted(() => ({ current: null }))
const events = vi.hoisted(() => ({ emit: vi.fn() }))

vi.mock('../../../components/HelmetTags', () => ({
  HelmetTags: () => null
}))

vi.mock('~ui', async () => {
  const { createUiPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  const mocks = await createUiPageMocks()
  return {
    ...mocks,
    BusinessProductsListing: (props) => {
      listingProps.current = props
      return null
    }
  }
})

vi.mock('~components', async () => {
  const { createComponentsPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  return { ...(await createComponentsPageMocks()), useEvent: () => [events] }
})

vi.mock('../../../config', () => ({ default: {} }))

import { BusinessProductsList } from '../index'

const redirectAt = (url, args) => {
  renderWithProviders(<BusinessProductsList />, {
    initialEntries: [url],
    routePath: '/stores/products/:store?'
  })
  listingProps.current.onProductRedirect(args)
  return events.emit.mock.calls.at(-1)[1]
}

// bugs E SP-20: the deep link `?category=&product=&section=&tab=` is rewritten by the page on the initial render
describe('BusinessProductsList page · onProductRedirect (SP-20)', () => {
  beforeEach(() => events.emit.mockClear())

  it('keeps section and tab (and any other query param) when the product in the link is the one being opened', () => {
    const payload = redirectAt(
      '/stores/products/demo-store?category=3&product=7&section=product_details&tab=pricing&foo=bar',
      { slug: 'demo-store', product: '7', category: '3' }
    )
    const search = new URLSearchParams(payload.search)
    expect(payload).toMatchObject({ page: 'store', params: { store: 'demo-store' }, replace: true })
    expect(search.get('category')).toBe('3')
    expect(search.get('product')).toBe('7')
    expect(search.get('section')).toBe('product_details')
    expect(search.get('tab')).toBe('pricing')
    expect(search.get('foo')).toBe('bar')
  })

  it('opening another product from the list still rebuilds the address with only category and product', () => {
    const payload = redirectAt(
      '/stores/products/demo-store?category=3&product=7&section=product_details&tab=pricing',
      { slug: 'demo-store', product: 8, category: 3 }
    )
    expect(payload.search).toBe('category=3&product=8')
  })

  it('a product opened with nothing in the address gets category and product only', () => {
    const payload = redirectAt('/stores/products/demo-store', { slug: 'demo-store', product: 8, category: 3 })
    expect(payload.search).toBe('category=3&product=8')
  })

  it('closing the product clears the address as before', () => {
    const payload = redirectAt(
      '/stores/products/demo-store?category=3&product=7&section=product_details',
      { slug: 'demo-store' }
    )
    expect(payload.search).toBeUndefined()
  })
})
