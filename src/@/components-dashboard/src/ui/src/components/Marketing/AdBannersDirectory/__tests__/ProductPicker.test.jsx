/* eslint-disable import/first */
// redesign AB-B4 (M-AB15, M-AB22): the product picker of the image dialog. K/BusinessProductsListing (shared with the catalog) is
// stubbed with the contract the dialog relies on: it gets the props SelectBusinessProducts gives it and hands its UIComponent a
// `businessState`. The Product wrappers are real; the language and the utils are simulated. Nothing is ever sent.
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ businessState: null, listingProps: null, mounts: 0 }))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const Listing = (props) => {
    const { UIComponent } = props
    React.useEffect(() => { mocks.mounts += 1 }, [])
    mocks.listingProps = props
    return <UIComponent {...props} businessState={mocks.businessState} />
  }
  return {
    BusinessProductsListing: Listing,
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils: () => [{ optimizeImage: (url) => url }],
    useApi: () => [{ fake: 'ordering' }]
  }
})

import { ProductPicker } from '../ProductPicker'

const business = {
  id: 7,
  name: 'KCF',
  categories: [
    {
      id: 10,
      name: 'Burgers',
      enabled: true,
      rank: 2,
      products: [
        { id: 100, name: 'Classic', enabled: true, category_id: 10, images: 'https://cdn.example.test/classic.png' },
        { id: 101, name: 'Hidden burger', enabled: false, category_id: 10 }
      ],
      subcategories: []
    },
    {
      id: 11,
      name: 'Drinks',
      enabled: true,
      rank: 1,
      products: [{ id: 110, name: 'Cola', enabled: true, category_id: 11 }],
      subcategories: [
        { id: 12, name: 'Cold', enabled: true, products: [{ id: 120, name: 'Iced tea', enabled: true, category_id: 12 }], subcategories: [] }
      ]
    },
    { id: 13, name: 'Switched off', enabled: false, rank: 0, products: [{ id: 130, name: 'Ghost', enabled: true, category_id: 13 }], subcategories: [] },
    { id: 14, name: 'Only disabled', enabled: true, rank: 3, products: [{ id: 140, name: 'Gone', enabled: false, category_id: 14 }], subcategories: [] }
  ]
}

let onChange
const draw = (props = {}) => {
  onChange = vi.fn()
  return render(
    <ProductPicker
      business={{ id: 7, slug: 'kcf' }}
      storedUrl={undefined}
      categoryId={null}
      productId={null}
      onChange={onChange}
      {...props}
    />
  )
}
const header = name => screen.getByRole('button', { name })

beforeEach(() => {
  mocks.businessState = { business, loading: false, error: null }
  mocks.listingProps = null
  mocks.mounts = 0
})

afterEach(() => {
  cleanup()
})

describe('ProductPicker · the controller (as SelectBusinessProducts mounts it)', () => {
  it('mounts K/BusinessProductsListing with the slug of the chosen business and the same props', () => {
    draw()
    expect(mocks.listingProps).toMatchObject({
      slug: 'kcf',
      ordering: { fake: 'ordering' },
      isAllCategoryProducts: true,
      isSearchByName: true,
      isSearchByDescription: true,
      version: 'v1',
      isInitialRender: false
    })
    expect(typeof mocks.listingProps.handleUpdateInitialRender).toBe('function')
  })

  it('does not hand the controller `categoryId` or `productId` (it would open the product modal of the catalog)', () => {
    draw({ categoryId: 10, productId: 100 })
    expect(mocks.listingProps).not.toHaveProperty('categoryId')
    expect(mocks.listingProps).not.toHaveProperty('productId')
  })

  it('reads the slug of a stored link from its URL when the business has none (not in the loaded page)', () => {
    draw({ business: { id: 5 }, storedUrl: '/store/old-shop?category=3&product=9' })
    expect(mocks.listingProps.slug).toBe('old-shop')
  })

  it('reads the slug from a full URL too, and the slug of the business wins over the URL', () => {
    draw({ business: { id: 5 }, storedUrl: 'https://shop.example.test/store/other-shop?product=1' })
    expect(mocks.listingProps.slug).toBe('other-shop')
    cleanup()
    draw({ business: { id: 5, slug: 'kcf' }, storedUrl: '/store/old-shop?product=1' })
    expect(mocks.listingProps.slug).toBe('kcf')
  })

  it('paints nothing and mounts nothing without a business, or when no slug can be found', () => {
    const { container } = draw({ business: null, storedUrl: '/store/old-shop' })
    expect(container).toBeEmptyDOMElement()
    expect(mocks.mounts).toBe(0)
    cleanup()
    const second = draw({ business: { id: 5 }, storedUrl: '/somewhere/else' })
    expect(second.container).toBeEmptyDOMElement()
    expect(mocks.mounts).toBe(0)
  })
})

describe('ProductPicker · the groups', () => {
  it('lists the enabled categories that have enabled products, by rank, as buttons that say if they are open', () => {
    draw()
    const headers = screen.getAllByRole('button').map(button => button.textContent)
    expect(headers).toEqual(['Drinks', 'Burgers'])
    screen.getAllByRole('button').forEach(button => expect(button).toHaveAttribute('aria-expanded', 'false'))
    expect(screen.queryByText('Switched off')).toBeNull()
    expect(screen.queryByText('Only disabled')).toBeNull()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('opens a group with its header and shows its enabled products as radios', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(header('Burgers'))
    expect(header('Burgers')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('radio', { name: 'Classic' })).toBeInTheDocument()
    expect(screen.queryByText('Hidden burger')).toBeNull()
    await user.click(header('Burgers'))
    expect(header('Burgers')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('radio', { name: 'Classic' })).toBeNull()
  })

  it('draws the 20px product image as a decorative thumbnail, with a glyph when there is none', async () => {
    const user = userEvent.setup()
    const { container } = draw()
    await user.click(header('Burgers'))
    await user.click(header('Drinks'))
    const thumbs = container.querySelectorAll('.odc-banners-thumb')
    expect(thumbs).toHaveLength(2)
    const classic = [...thumbs].find(thumb => thumb.closest('label')?.textContent === 'Classic')
    expect(classic.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.test/classic.png')
    expect(classic.querySelector('img')).toHaveAttribute('alt', '')
    const cola = [...thumbs].find(thumb => thumb.closest('label')?.textContent === 'Cola')
    expect(cola.querySelector('img')).toBeNull()
    expect(cola.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('nests the subcategories inside their category (as the tree of main did)', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(header('Drinks'))
    expect(screen.getByRole('radio', { name: 'Cola' })).toBeInTheDocument()
    expect(header('Cold')).toHaveAttribute('aria-expanded', 'false')
    await user.click(header('Cold'))
    expect(screen.getByRole('radio', { name: 'Iced tea' })).toBeInTheDocument()
  })
})

describe('ProductPicker · the linked product (M-AB22)', () => {
  it('starts with the group of the linked product open and its radio checked; the others closed', () => {
    draw({ categoryId: 10, productId: 100 })
    expect(header('Burgers')).toHaveAttribute('aria-expanded', 'true')
    expect(header('Drinks')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('radio', { name: 'Classic' })).toBeChecked()
  })

  it('opens every group on the way to a product that lives in a subcategory', () => {
    draw({ categoryId: 12, productId: 120 })
    expect(header('Drinks')).toHaveAttribute('aria-expanded', 'true')
    expect(header('Cold')).toHaveAttribute('aria-expanded', 'true')
    expect(header('Burgers')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('radio', { name: 'Iced tea' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Cola' })).not.toBeChecked()
  })

  it('checks by the product when the stored link has no category', () => {
    draw({ categoryId: null, productId: 100 })
    expect(screen.getByRole('radio', { name: 'Classic' })).toBeChecked()
  })

  it('does not check a product whose id matches but whose category does not', () => {
    draw({ categoryId: 99, productId: 100 })
    expect(header('Burgers')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('radio', { name: 'Classic' })).not.toBeChecked()
  })

  it('is one radiogroup named «Product», so the arrows move between the products of the open groups', () => {
    draw({ categoryId: 10, productId: 100 })
    const group = screen.getByRole('radiogroup', { name: 'Product' })
    expect(within(group).getByRole('radio', { name: 'Classic' })).toBeInTheDocument()
  })
})

describe('ProductPicker · choosing', () => {
  it('calls onChange with the category and the product, as handleClickProduct did', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(header('Drinks'))
    await user.click(screen.getByRole('radio', { name: 'Cola' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ categoryId: 11, productId: 110 })
  })

  it('reports the category of the subcategory the product lives in', async () => {
    const user = userEvent.setup()
    draw()
    await user.click(header('Drinks'))
    await user.click(header('Cold'))
    await user.click(screen.getByRole('radio', { name: 'Iced tea' }))
    expect(onChange).toHaveBeenCalledWith({ categoryId: 12, productId: 120 })
  })

  it('follows the owner: a new product id moves the check without reopening groups', () => {
    const { rerender } = draw({ categoryId: 10, productId: 100 })
    rerender(<ProductPicker business={{ id: 7, slug: 'kcf' }} categoryId={11} productId={110} onChange={onChange} />)
    expect(screen.queryByRole('radio', { name: 'Cola' })).toBeNull() // Drinks stays closed: the person did not open it
    expect(screen.getByRole('radio', { name: 'Classic' })).not.toBeChecked()
  })
})

describe('ProductPicker · states', () => {
  it('draws a busy skeleton while the business loads', () => {
    mocks.businessState = { business: {}, loading: true, error: null }
    const { container } = draw()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('says «This business has no products.» when it has no categories, or none with an enabled product', () => {
    mocks.businessState = { business: { id: 7, categories: [] }, loading: false, error: null }
    draw()
    expect(screen.getByText('This business has no products.')).toBeInTheDocument()
    cleanup()
    mocks.businessState = { business: { id: 7, categories: [business.categories[2], business.categories[3]] }, loading: false, error: null }
    draw()
    expect(screen.getByText('This business has no products.')).toBeInTheDocument()
  })

  it('says it when the business fails to load, translating the API message, and not «no products»', () => {
    mocks.businessState = { business: {}, loading: false, error: ['INTERNAL_ERROR'] }
    draw()
    expect(screen.getByRole('alert')).toHaveTextContent('INTERNAL_ERROR')
    expect(screen.queryByText('This business has no products.')).toBeNull()
  })

  it('falls back to a sentence when the error carries no text', () => {
    mocks.businessState = { business: {}, loading: false, error: [{}] }
    draw()
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the products of this business.")
  })
})
