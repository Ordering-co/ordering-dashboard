import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'

const listingProps = vi.hoisted(() => ({ current: null }))

vi.mock('../../../components/HelmetTags', () => ({
  HelmetTags: ({ page }) => <div data-testid='helmet-tags' data-page={page} />
}))

vi.mock('~ui', async () => {
  const { createUiPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  const mocks = await createUiPageMocks()
  return {
    ...mocks,
    BusinessProductsListing: (props) => {
      listingProps.current = props
      return <div data-testid='page-ui' />
    }
  }
})

vi.mock('~components', async () => {
  const { createComponentsPageMocks } = await import('../../../__tests__/helpers/pageMocks')
  return createComponentsPageMocks()
})

vi.mock('../../../config', () => ({ default: {} }))

import { BusinessProductsList } from '../index'

const renderAt = (url) => {
  listingProps.current = null
  renderWithProviders(<BusinessProductsList />, {
    initialEntries: [url],
    routePath: '/stores/products/:store?'
  })
  return listingProps.current
}

describe('BusinessProductsList page', () => {
  it('renders its helmet tags and main controller', () => {
    renderWithProviders(<BusinessProductsList />, {
      initialEntries: ['/stores/products/demo-store'],
      routePath: '/stores/products/:store?'
    })

    expect(screen.getByTestId('helmet-tags')).toHaveAttribute('data-page', 'store')
    expect(screen.getByTestId('page-ui')).toBeInTheDocument()
  })

  // redesign Tiendas 1.F (G5-49): the bridge reads `category` and `product` by name, not by position
  describe('query string', () => {
    it('passes no category or product without a query (palette products_page link)', () => {
      const props = renderAt('/stores/products/demo-store')
      expect(props.slug).toBe('demo-store')
      expect(props.categoryId).toBeUndefined()
      expect(props.productId).toBeUndefined()
    })

    it('reads a category alone', () => {
      const props = renderAt('/stores/products/demo-store?category=3')
      expect(props.categoryId).toBe('3')
      expect(props.productId).toBeUndefined()
    })

    it('reads a category and a product', () => {
      const props = renderAt('/stores/products/demo-store?category=3&product=7')
      expect(props.categoryId).toBe('3')
      expect(props.productId).toBe('7')
    })

    it('reads them in any order', () => {
      const props = renderAt('/stores/products/demo-store?product=7&category=3')
      expect(props.categoryId).toBe('3')
      expect(props.productId).toBe('7')
    })

    it('does not take the store editor ?id= as a category', () => {
      const props = renderAt('/stores/products/demo-store?id=5')
      expect(props.categoryId).toBeUndefined()
      expect(props.productId).toBeUndefined()
    })

    it('does not take ?id= after a category as a product', () => {
      const props = renderAt('/stores/products/demo-store?category=3&id=5')
      expect(props.categoryId).toBe('3')
      expect(props.productId).toBeUndefined()
    })

    it('keeps category and product when ?id= comes first', () => {
      const props = renderAt('/stores/products/demo-store?id=5&category=3&product=7')
      expect(props.categoryId).toBe('3')
      expect(props.productId).toBe('7')
    })
  })
})
