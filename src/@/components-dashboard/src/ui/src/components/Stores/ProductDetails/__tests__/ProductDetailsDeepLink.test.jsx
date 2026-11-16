/* eslint-disable import/first */
// redesign SP-F1 (D1): the editor with the REAL ProductMainDetails, ProductSectionBody and address helpers (addQueryToUrl writes
// with history.replaceState, which the router does not hear). Only the leaves (the forms and lists of each section) are stubs.
// Deep links: ?section=product_details&tab=advanced, ?section=custom_fields, ?section=personalization, and Information → Ingredients → Advanced.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const spy = vi.hoisted(() => {
  const state = { calls: {} }
  state.stub = (name) => async () => {
    const { createElement } = await import('react')
    return {
      [name]: (props) => {
        state.calls[name] = [...(state.calls[name] || []), props]
        return createElement('div', { 'data-testid': name })
      }
    }
  }
  return state
})

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url, parsePrice: (value) => `$${value}` }],
  ProductDetatils: () => null
}))
vi.mock('../../../Shared', async () => {
  const { createElement } = await import('react')
  return {
    Modal: () => null,
    ProgressRing: () => null,
    DragScroll: ({ children }) => createElement('div', null, children),
    Personalization: (props) => {
      spy.calls.Personalization = [...(spy.calls.Personalization || []), props]
      return createElement('div', { 'data-testid': 'Personalization' })
    }
  }
})
vi.mock('../../SnoozeComponent', () => ({ SnoozeComponent: () => null }))
vi.mock('../../ProductDesktopPreview', () => ({ ProductDesktopPreview: () => null }))
vi.mock('../../ProductDetatilsInformation', spy.stub('ProductDetatilsInformation'))
vi.mock('../../ProductDetailsAdvanced', spy.stub('ProductDetailsAdvanced'))
vi.mock('../../ProductTagsList', spy.stub('ProductTagsList'))
vi.mock('../../ProductDetailsCategories', spy.stub('ProductDetailsCategories'))
vi.mock('../../SeoOptions', spy.stub('SeoOptions'))
vi.mock('../../ProductIngredient', spy.stub('ProductIngredient'))
vi.mock('../../ProductExtras', spy.stub('ProductExtras'))
vi.mock('../../ProductGallery', spy.stub('ProductGallery'))
vi.mock('../../ProductVideos', spy.stub('ProductVideos'))
vi.mock('../../ProductMetaFields', spy.stub('ProductMetaFields'))
vi.mock('../../BusinessServiceProfessionals', spy.stub('BusinessServiceProfessionals'))
vi.mock('../../ServiceDetail', spy.stub('ServiceDetail'))

import { ProductDetailsUI } from '../index'

const BASE = '/stores/products/fast-bite'
const product = { id: 7, name: 'Cheese Burger', type: 'product', enabled: true, category_id: 9, price: 10, cost_price: 4 }

const makeProps = (over = {}) => ({
  open: true,
  onClose: vi.fn(),
  product,
  business: { id: 3 },
  productState: { loading: false, product, error: null },
  formState: { loading: false, changes: {} },
  handleChangeFormState: vi.fn(),
  handleUpdateClick: vi.fn(),
  handleSuccessUpdate: vi.fn(),
  handleChangeProductActiveState: vi.fn(async () => ({ ok: true })),
  handleDuplicateProduct: vi.fn(async () => ({ ok: true })),
  handleDeleteProduct: vi.fn(),
  duplicateState: { loading: false, error: null },
  productCart: {},
  showProductOption: vi.fn(),
  getProduct: vi.fn(),
  taxes: [],
  fees: [],
  ...over
})

// The address the browser holds and the one the router was given are the same, as after a real navigation.
const mount = (search = '', props = makeProps()) => {
  window.history.replaceState(null, '', `${BASE}${search}`)
  return render(
    <MemoryRouter initialEntries={[`${BASE}${search}`]}>
      <ProductDetailsUI {...props} />
    </MemoryRouter>
  )
}

const params = () => Object.fromEntries(new URLSearchParams(window.location.search))
const mounted = () => ['ProductDetatilsInformation', 'ProductDetailsAdvanced', 'ProductTagsList', 'ProductDetailsCategories', 'SeoOptions', 'ProductIngredient', 'ProductMetaFields', 'Personalization']
  .filter(name => screen.queryByTestId(name))
const nav = () => screen.getByRole('navigation', { name: 'Product sections' })

beforeEach(() => {
  spy.calls = {}
  window.innerWidth = 1280
  window.dispatchEvent(new Event('resize'))
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
  window.history.replaceState(null, '', '/')
})

describe('ProductDetails · deep links (real ProductMainDetails)', () => {
  it('?section=product_details&tab=advanced opens Advanced and nothing else, and ProductMainDetails does not touch the address', () => {
    mount('?category=9&product=7&section=product_details&tab=advanced')
    expect(mounted()).toEqual(['ProductDetailsAdvanced'])
    const advanced = spy.calls.ProductDetailsAdvanced.at(-1)
    expect(advanced.product).toBe(product)
    expect(advanced.business).toEqual({ id: 3 })
    expect(within(nav()).getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-current', 'page')
    expect(params()).toEqual({ category: '9', product: '7', section: 'product_details', tab: 'advanced' })
    // its own heading and tab bar are hidden: the list of sections is the tabs
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(document.querySelectorAll('button[aria-pressed]')).toHaveLength(0)
  })

  it('?section=product_details with no tab opens Information and writes tab=information, as ProductMainDetails did', () => {
    mount('?category=9&product=7&section=product_details')
    expect(mounted()).toEqual(['ProductDetatilsInformation'])
    expect(params()).toEqual({ category: '9', product: '7', section: 'product_details', tab: 'information' })
    expect(within(nav()).getByRole('button', { name: 'Information' })).toHaveAttribute('aria-current', 'page')
  })

  it('?section=custom_fields paints ProductMetaFields although it is not in the list', () => {
    mount('?category=9&product=7&section=custom_fields')
    expect(mounted()).toEqual(['ProductMetaFields'])
    expect(spy.calls.ProductMetaFields.at(-1)).toMatchObject({ businessId: 3, categoryId: 9, productId: 7 })
    expect(params()).toEqual({ category: '9', product: '7', section: 'custom_fields' })
    expect(nav().querySelector('[aria-current="page"]')).toBeNull()
  })

  it('?section=personalization paints Personalization although nothing in the list reaches it', () => {
    mount('?category=9&product=7&section=personalization')
    expect(mounted()).toEqual(['Personalization'])
    expect(spy.calls.Personalization.at(-1)).toMatchObject({ isShowTitle: true })
    expect(params().section).toBe('personalization')
  })

  it('opens the Overview, and leaves the address alone, with no section', () => {
    mount('?category=9&product=7')
    expect(mounted()).toEqual([])
    expect(params()).toEqual({ category: '9', product: '7' })
    expect(within(nav()).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('ProductDetails · Information → Ingredients → Advanced (real ProductMainDetails)', () => {
  it('each step paints its branch and leaves the address as the entry says; Overview empties it', async () => {
    const user = userEvent.setup()
    mount('?category=9&product=7')

    await user.click(within(nav()).getByRole('button', { name: 'Information' }))
    expect(mounted()).toEqual(['ProductDetatilsInformation'])
    expect(params()).toEqual({ category: '9', product: '7', section: 'product_details', tab: 'information' })

    await user.click(within(nav()).getByRole('button', { name: 'Ingredients / Properties' }))
    expect(mounted()).toEqual(['ProductIngredient'])
    expect(params()).toEqual({ category: '9', product: '7', section: 'ingredients' }) // the tab of the section it left is gone
    expect(spy.calls.ProductIngredient.at(-1)).toMatchObject({ business: { id: 3 }, product })

    await user.click(within(nav()).getByRole('button', { name: 'Advanced' }))
    expect(mounted()).toEqual(['ProductDetailsAdvanced'])
    expect(params()).toEqual({ category: '9', product: '7', section: 'product_details', tab: 'advanced' })

    await user.click(within(nav()).getByRole('button', { name: 'Overview' }))
    expect(mounted()).toEqual([])
    expect(params()).toEqual({ category: '9', product: '7' })
  })

  it('going from a tab to another clears what the first one left in the address (tag of Labels)', async () => {
    const user = userEvent.setup()
    mount('?category=9&product=7&section=product_details&tab=labels&tag=12')
    expect(mounted()).toEqual(['ProductTagsList'])
    await user.click(within(nav()).getByRole('button', { name: 'Categories' }))
    expect(mounted()).toEqual(['ProductDetailsCategories'])
    expect(params()).toEqual({ category: '9', product: '7', section: 'product_details', tab: 'categories' })
  })

  it('the five tabs each paint their own leaf', async () => {
    const user = userEvent.setup()
    mount('?category=9&product=7')
    const expected = {
      Information: 'ProductDetatilsInformation',
      Advanced: 'ProductDetailsAdvanced',
      Labels: 'ProductTagsList',
      Categories: 'ProductDetailsCategories',
      'SEO Options': 'SeoOptions'
    }
    for (const [label, leaf] of Object.entries(expected)) {
      await user.click(within(nav()).getByRole('button', { name: label }))
      expect(mounted()).toEqual([leaf])
    }
  })
})
