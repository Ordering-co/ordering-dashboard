/* eslint-disable import/first */
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({
  controllerProps: {},
  optimizeImage: null,
  ordering: { marker: 'ordering-client' }
}))

vi.mock('../../../../../index', () => ({
  BusinessProductsListing: ({ UIComponent, ...props }) => {
    runtime.controllerProps[props.fixtureId || 'default'] = { ...props, UIComponent }
    return <UIComponent {...props} />
  },
  useApi: () => [runtime.ordering],
  useUtils: () => [{ optimizeImage: (...args) => runtime.optimizeImage(...args) }]
}))

vi.mock('react-loading-skeleton', () => ({
  default: props => <span data-testid='skeleton' data-width={props.width} data-height={props.height} />
}))

import { SelectBusinessCategories } from './SelectBusinessCategories'
import { SelectBusinessProducts } from './SelectBusinessProducts'

const withProductDummy = currentTheme => ({
  ...currentTheme,
  images: {
    ...currentTheme.images,
    dummies: {
      ...currentTheme.images?.dummies,
      product: 'dummy-product.png'
    }
  }
})
const lightTheme = withProductDummy(createDashboardTheme(theme))
const rtlDarkTheme = { ...withProductDummy(createDashboardTheme(theme, { mode: 'dark' })), rtl: true }
const renderWithTheme = (content, currentTheme = lightTheme) => render(
  <ThemeProvider theme={currentTheme}>{content}</ThemeProvider>
)

const categoryTree = () => [
  {
    id: 1,
    name: 'Parent category with a long localized name',
    rank: 2,
    enabled: false,
    subcategories: [
      {
        id: 2,
        name: 'Child category',
        rank: 1,
        subcategories: [{ id: 3, name: 'Grandchild category', rank: 1, subcategories: [] }]
      }
    ]
  },
  { id: 4, name: 'First by rank', rank: 1, enabled: true, subcategories: [] }
]

const productTree = () => [
  {
    id: 10,
    name: 'Parent products',
    rank: 2,
    enabled: true,
    products: [
      { id: 101, name: 'Visible product', enabled: true, images: 'visible.png' },
      { id: 102, name: 'Disabled product', enabled: false, images: 'disabled.png' }
    ],
    subcategories: [
      {
        id: 11,
        name: 'Disabled child category',
        enabled: false,
        products: [{ id: 103, name: 'Nested visible product', enabled: true, images: null }],
        subcategories: []
      }
    ]
  },
  {
    id: 20,
    name: 'Filtered top category',
    rank: 1,
    enabled: false,
    products: [{ id: 201, name: 'Filtered top product', enabled: true }],
    subcategories: []
  },
  {
    id: 30,
    name: 'Empty category',
    rank: 0,
    enabled: true,
    products: [],
    subcategories: []
  },
  {
    id: 40,
    name: 'Disabled-only category',
    rank: 3,
    enabled: true,
    products: [{ id: 401, name: 'Only disabled product', enabled: false }],
    subcategories: []
  }
]

const commonControllerProps = fixtureId => ({
  businessState: { loading: false, business: { categories: [] } },
  fixtureId,
  include: true
})

beforeEach(() => {
  runtime.controllerProps = {}
  runtime.optimizeImage = vi.fn(url => `/optimized/${url}`)
})

describe('L2d-C7 selection trees', () => {
  it('keeps Categories controller flags, mutable top-rank sorting, disabled categories, and ten loading rows', async () => {
    const categories = categoryTree()
    const rendered = renderWithTheme(
      <SelectBusinessCategories
        businessState={{ loading: false, business: { categories } }}
        fixtureId='categories'
        include
        selectedCategoryIds={{}}
        setSelectedCategoryIds={vi.fn()}
      />
    )

    expect(runtime.controllerProps.categories).toMatchObject({
      isAllCategoryProducts: true,
      isInitialRender: false,
      isSearchByDescription: true,
      isSearchByName: true,
      ordering: runtime.ordering
    })
    expect(runtime.controllerProps.categories.UIComponent).toEqual(expect.any(Function))
    expect(categories.map(category => category.id)).toEqual([4, 1])
    expect(screen.getByText('Parent category with a long localized name')).toBeInTheDocument()
    act(() => runtime.controllerProps.categories.handleUpdateInitialRender(true))
    expect(runtime.controllerProps.categories.isInitialRender).toBe(true)

    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <SelectBusinessCategories
          businessState={{ loading: true, business: { categories: [] } }}
          fixtureId='categories'
          include
          selectedCategoryIds={{}}
          setSelectedCategoryIds={vi.fn()}
        />
      </ThemeProvider>
    )
    expect(document.querySelectorAll('[data-slot="entity-selector-skeleton"]')).toHaveLength(10)
    expect(screen.getAllByTestId('skeleton')).toHaveLength(30)
  })

  it('keeps Categories recursive writes, same-mode parent-only deletion, and opposite-mode replacement', async () => {
    const setSelectedCategoryIds = vi.fn()
    const categories = categoryTree()
    const rendered = renderWithTheme(
      <SelectBusinessCategories
        businessState={{ loading: false, business: { categories } }}
        fixtureId='category-selection'
        include
        selectedCategoryIds={{}}
        setSelectedCategoryIds={setSelectedCategoryIds}
      />
    )

    const parentCheckbox = screen.getByRole('checkbox', { name: 'Parent category with a long localized name' })
    expect(parentCheckbox.closest('[data-slot="selection-tree-row"]')).toHaveAttribute('data-depth', '0')
    fireEvent.click(parentCheckbox)
    expect(setSelectedCategoryIds).toHaveBeenLastCalledWith({
      1: { id: 1, include: true },
      2: { id: 2, include: true },
      3: { id: 3, include: true }
    })
    expect(screen.getByRole('button', { name: 'Parent category with a long localized name' })).toHaveAttribute('aria-expanded', 'false')

    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <SelectBusinessCategories
          businessState={{ loading: false, business: { categories } }}
          fixtureId='category-selection'
          include
          selectedCategoryIds={{
            1: { id: 1, include: true },
            2: { id: 2, include: true },
            3: { id: 3, include: true }
          }}
          setSelectedCategoryIds={setSelectedCategoryIds}
        />
      </ThemeProvider>
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Parent category with a long localized name' }))
    expect(setSelectedCategoryIds).toHaveBeenLastCalledWith({
      2: { id: 2, include: true },
      3: { id: 3, include: true }
    })

    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <SelectBusinessCategories
          businessState={{ loading: false, business: { categories } }}
          fixtureId='category-selection'
          include
          selectedCategoryIds={{ 1: { id: 1, include: false } }}
          setSelectedCategoryIds={setSelectedCategoryIds}
        />
      </ThemeProvider>
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Parent category with a long localized name' }))
    expect(setSelectedCategoryIds).toHaveBeenLastCalledWith({
      1: { id: 1, include: true },
      2: { id: 2, include: true },
      3: { id: 3, include: true }
    })
  })

  it('exposes one named keyboard disclosure while checkbox activation stays separate', async () => {
    const user = userEvent.setup()
    const setSelectedCategoryIds = vi.fn()
    renderWithTheme(
      <SelectBusinessCategories
        businessState={{ loading: false, business: { categories: categoryTree() } }}
        fixtureId='category-disclosure'
        include={false}
        selectedCategoryIds={{}}
        setSelectedCategoryIds={setSelectedCategoryIds}
      />
    )

    const disclosure = screen.getByRole('button', { name: 'Parent category with a long localized name' })
    const checkbox = screen.getByRole('checkbox', { name: 'Parent category with a long localized name' })
    const content = document.getElementById(disclosure.getAttribute('aria-controls'))
    expect(disclosure).toHaveAttribute('type', 'button')
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(disclosure).not.toContainElement(checkbox)
    expect(content).toHaveAttribute('aria-hidden', 'true')
    expect(content).toHaveAttribute('data-state', 'closed')
    expect(content).toHaveAttribute('inert', '')
    const disclosureIcon = disclosure.querySelector('svg')
    expect(disclosureIcon).toHaveClass('accordion__icon')
    expect(disclosureIcon).not.toHaveClass('rotate')

    disclosure.focus()
    await user.keyboard('{Enter}')
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(content).toHaveAttribute('aria-hidden', 'false')
    expect(content).toHaveAttribute('data-state', 'open')
    expect(content).not.toHaveAttribute('inert')
    expect(setSelectedCategoryIds).not.toHaveBeenCalled()

    await user.click(checkbox)
    expect(setSelectedCategoryIds).toHaveBeenCalledOnce()
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByText('Parent category with a long localized name'))
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps Products v1 controller flags, top filtering, child visibility, every-empty checked, and media payloads', async () => {
    const categories = productTree()
    renderWithTheme(
      <SelectBusinessProducts
        businessState={{ loading: false, business: { categories } }}
        fixtureId='products'
        include
        selectedProductsIds={{}}
        setSelectedProductsIds={vi.fn()}
      />,
      rtlDarkTheme
    )

    expect(runtime.controllerProps.products).toMatchObject({
      isAllCategoryProducts: true,
      isInitialRender: false,
      isSearchByDescription: true,
      isSearchByName: true,
      ordering: runtime.ordering,
      version: 'v1'
    })
    await screen.findByRole('button', { name: 'Parent products' })
    const root = document.querySelector('[data-entity-selector="business-products"]')
    expect(root).toHaveAttribute('data-slot', 'entity-selector')
    expect(root).toHaveAttribute('dir', 'rtl')
    expect(getComputedStyle(root).getPropertyValue('--od-entity-selector-surface')).toBe(rtlDarkTheme.ordering.semantic.surface.default)
    expect(screen.queryByText('Filtered top category')).not.toBeInTheDocument()
    expect(screen.queryByText('Empty category')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Disabled-only category' })).toBeChecked()

    await userEvent.click(screen.getByRole('button', { name: 'Parent products' }))
    expect(screen.getByRole('checkbox', { name: 'Visible product' })).toBeInTheDocument()
    expect(screen.queryByText('Disabled product')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disabled child category' })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="selection-tree-image"]')).toBeInTheDocument()
    expect(runtime.optimizeImage).toHaveBeenCalledWith('visible.png', 'h_50,c_limit')

    await userEvent.click(screen.getByRole('button', { name: 'Disabled child category' }))
    expect(screen.getByRole('checkbox', { name: 'Nested visible product' })).toBeInTheDocument()
    expect(runtime.optimizeImage).toHaveBeenCalledWith('dummy-product.png', 'h_50,c_limit')
  })

  it('keeps Products immediate-enabled category selection and individual product toggles separate', async () => {
    const categories = productTree()
    const setSelectedProductsIds = vi.fn()
    const rendered = renderWithTheme(
      <SelectBusinessProducts
        businessState={{ loading: false, business: { categories } }}
        fixtureId='product-selection'
        include
        selectedProductsIds={{}}
        setSelectedProductsIds={setSelectedProductsIds}
      />
    )

    const categoryCheckbox = await screen.findByRole('checkbox', { name: 'Parent products' })
    fireEvent.click(categoryCheckbox)
    expect(setSelectedProductsIds).toHaveBeenLastCalledWith({ 101: { id: 101, include: true } })
    expect(setSelectedProductsIds).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Parent products' })).toHaveAttribute('aria-expanded', 'false')

    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <SelectBusinessProducts
          businessState={{ loading: false, business: { categories } }}
          fixtureId='product-selection'
          include
          selectedProductsIds={{
            101: { id: 101, include: true },
            102: { id: 102, include: true },
            103: { id: 103, include: true }
          }}
          setSelectedProductsIds={setSelectedProductsIds}
        />
      </ThemeProvider>
    )
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Parent products' }))
    expect(setSelectedProductsIds).toHaveBeenLastCalledWith({
      102: { id: 102, include: true },
      103: { id: 103, include: true }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Parent products' }))
    const visibleProduct = screen.getByRole('checkbox', { name: 'Visible product' })
    expect(visibleProduct.closest('[data-slot="selection-tree-row"]')).toHaveAttribute('data-depth', '1')
    expect(visibleProduct.closest('[data-slot="selection-tree-row"]')).toHaveAttribute('data-product', '')
    expect(getComputedStyle(visibleProduct.closest('[data-slot="selection-tree-row"]')).getPropertyValue('--od-selection-tree-offset')).toBe('20px')
    fireEvent.click(visibleProduct)
    expect(setSelectedProductsIds).toHaveBeenLastCalledWith({
      102: { id: 102, include: true },
      103: { id: 103, include: true }
    })
  })

  it('keeps product insertion and deletion scoped to the activated product', async () => {
    const categories = productTree()
    const setSelectedProductsIds = vi.fn()
    const rendered = renderWithTheme(
      <SelectBusinessProducts
        businessState={{ loading: false, business: { categories } }}
        fixtureId='single-product'
        include={false}
        selectedProductsIds={{}}
        setSelectedProductsIds={setSelectedProductsIds}
      />
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Parent products' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Visible product' }))
    expect(setSelectedProductsIds).toHaveBeenLastCalledWith({ 101: { id: 101, include: false } })

    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <SelectBusinessProducts
          businessState={{ loading: false, business: { categories } }}
          fixtureId='single-product'
          include={false}
          selectedProductsIds={{ 101: { id: 101, include: false }, 999: { id: 999, include: true } }}
          setSelectedProductsIds={setSelectedProductsIds}
        />
      </ThemeProvider>
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Visible product' }))
    expect(setSelectedProductsIds).toHaveBeenLastCalledWith({ 999: { id: 999, include: true } })
  })

  it('keeps an expanded nested branch mounted when its ancestor closes', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <SelectBusinessProducts
        businessState={{ loading: false, business: { categories: productTree() } }}
        fixtureId='nested-disclosure-state'
        include
        selectedProductsIds={{}}
        setSelectedProductsIds={vi.fn()}
      />
    )

    const parent = await screen.findByRole('button', { name: 'Parent products' })
    await user.click(parent)
    const child = screen.getByRole('button', { name: 'Disabled child category' })
    await user.click(child)
    expect(child).toHaveAttribute('aria-expanded', 'true')

    await user.click(parent)
    expect(parent).toHaveAttribute('aria-expanded', 'false')
    const parentContent = document.getElementById(parent.getAttribute('aria-controls'))
    expect(parentContent).toHaveAttribute('aria-hidden', 'true')
    expect(parentContent).toHaveAttribute('inert', '')
    expect(screen.getByRole('button', { name: 'Disabled child category', hidden: true })).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders ten Products skeleton rows and unique disclosure IDs across simultaneous include/exclude trees', async () => {
    const categories = categoryTree()
    const products = productTree()
    const rendered = renderWithTheme(
      <SelectBusinessProducts
        {...commonControllerProps('products-loading')}
        businessState={{ loading: true, business: { categories: [] } }}
        selectedProductsIds={{}}
        setSelectedProductsIds={vi.fn()}
      />
    )
    expect(document.querySelectorAll('[data-slot="entity-selector-skeleton"]')).toHaveLength(10)

    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <>
          <SelectBusinessCategories businessState={{ loading: false, business: { categories } }} fixtureId='cat-in' include selectedCategoryIds={{}} setSelectedCategoryIds={vi.fn()} />
          <SelectBusinessCategories businessState={{ loading: false, business: { categories } }} fixtureId='cat-out' include={false} selectedCategoryIds={{}} setSelectedCategoryIds={vi.fn()} />
          <SelectBusinessProducts businessState={{ loading: false, business: { categories: products } }} fixtureId='prod-in' include selectedProductsIds={{}} setSelectedProductsIds={vi.fn()} />
          <SelectBusinessProducts businessState={{ loading: false, business: { categories: products } }} fixtureId='prod-out' include={false} selectedProductsIds={{}} setSelectedProductsIds={vi.fn()} />
        </>
      </ThemeProvider>
    )
    await waitFor(() => expect(screen.getAllByRole('button').length).toBeGreaterThan(4))
    const disclosures = document.querySelectorAll('[data-selection-tree-slot="disclosure"]')
    expect(disclosures.length).toBeGreaterThan(4)
    const controlledIds = [...disclosures].map(disclosure => disclosure.getAttribute('aria-controls'))
    expect(new Set(controlledIds).size).toBe(controlledIds.length)
    for (const disclosure of disclosures) {
      const content = document.getElementById(disclosure.getAttribute('aria-controls'))
      expect(content).toHaveAttribute('aria-labelledby', disclosure.getAttribute('aria-labelledby'))
      expect(within(disclosure).queryByRole('checkbox')).not.toBeInTheDocument()
    }
  })
})
