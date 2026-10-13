import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { JourneyProductPicker, JourneyProductPickerUI } from './JourneyProductPicker'

const controllerState = vi.hoisted(() => ({ props: null, ordering: {}, handleChangeSearch: null }))

vi.mock('../../../../../index', () => ({
  BusinessProductsListing: props => {
    controllerState.props = props
    const Component = props.UIComponent
    return (
      <Component
        businessState={{ loading: false }}
        categoryState={{ loading: false, products: [], pagination: { currentPage: 1, totalPages: 1 } }}
        errors={null}
        getPageProducts={vi.fn()}
        selectedProductsIds={props.selectedProductsIds}
        setSelectedProductsIds={props.setSelectedProductsIds}
        handleChangeSearch={controllerState.handleChangeSearch || vi.fn()}
      />
    )
  },
  useApi: () => [controllerState.ordering],
  useLanguage: () => [{}, (key, fallback) => fallback || key]
}))

global.IS_REACT_ACT_ENVIRONMENT = true

const theme = {
  colors: {
    primary: '#266DF0',
    backgroundPage: '#FFFFFF',
    headingColor: '#0B0C0D',
    lightGray: '#3F4145',
    borderColor: '#DEE0E3',
    secundary: '#F6F7F7'
  }
}

const renderPicker = props => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const rerender = nextProps => {
    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <JourneyProductPickerUI
            businessState={{ loading: false }}
            categoryState={{ loading: false, products: [], pagination: { currentPage: 1, totalPages: 1 } }}
            errors={null}
            getPageProducts={vi.fn()}
            selectedProductsIds={{}}
            setSelectedProductsIds={vi.fn()}
            {...nextProps}
          />
        </ThemeProvider>
      )
    })
  }
  rerender(props)
  return { container, root, rerender }
}

const setInputValue = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const categories = [
  {
    id: 7,
    name: 'Pizzas',
    enabled: true,
    rank: 1,
    products: [{ id: 22, name: 'Pepperoni pizza', description: 'Classic', enabled: true }],
    subcategories: [
      {
        id: 8,
        name: 'Special pizzas',
        enabled: true,
        rank: 1,
        products: [
          { id: 23, name: 'Garden pizza', description: 'Vegetarian', enabled: true },
          { id: 24, name: 'Hidden pizza', enabled: false }
        ],
        subcategories: []
      }
    ]
  },
  {
    id: 9,
    name: 'Drinks',
    enabled: true,
    rank: 2,
    products: [{ id: 30, name: 'Cola', description: 'Cold drink', enabled: true }],
    subcategories: []
  }
]

const catalogState = {
  loading: false,
  business: { id: 10, categories }
}

describe('JourneyProductPickerUI', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    controllerState.ordering = {}
    controllerState.props = null
    controllerState.handleChangeSearch = null
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  test('shows categories first, collapsed, with accessible expansion controls', () => {
    const { container, root } = renderPicker({ businessState: catalogState })

    expect(container.textContent).toContain('Choose a whole category or expand it to select individual products.')
    expect(container.textContent).toContain('Selecting a category includes its currently enabled products. Products added later are not included automatically.')
    expect(container.textContent).toContain('Pizzas')
    expect(container.textContent).toContain('Drinks')
    expect(container.textContent).not.toContain('Pepperoni pizza')

    const expandPizzas = container.querySelector('button[aria-label="Expand Pizzas"]')
    expect(expandPizzas.getAttribute('aria-expanded')).toBe('false')
    act(() => expandPizzas.click())
    expect(expandPizzas.getAttribute('aria-expanded')).toBe('true')
    expect(container.textContent).toContain('Pepperoni pizza')
    expect(container.textContent).toContain('Special pizzas')
    expect(container.textContent).not.toContain('Garden pizza')
    act(() => root.unmount())
  })

  test('selects every enabled descendant product when selecting a category', () => {
    const setSelectedProductsIds = vi.fn()
    const { container, root } = renderPicker({
      businessState: catalogState,
      setSelectedProductsIds
    })
    expect(container.textContent).toContain('0 selected')
    act(() => container.querySelector('input[aria-label="Select all products in Pizzas"]').click())
    expect(setSelectedProductsIds).toHaveBeenCalledWith({
      22: { id: 22, include: true, name: 'Pepperoni pizza' },
      23: { id: 23, include: true, name: 'Garden pizza' }
    })
    act(() => root.unmount())
  })

  test('represents a partial category and allows individual drill-down without duplicates', () => {
    const setSelectedProductsIds = vi.fn()
    const { container, root } = renderPicker({
      businessState: catalogState,
      selectedProductsIds: { 22: { id: 22, include: true } },
      setSelectedProductsIds
    })

    expect(container.textContent).toContain('1 selected')
    const categoryCheckbox = container.querySelector('input[aria-label="Select all products in Pizzas"]')
    expect(categoryCheckbox.indeterminate).toBe(true)
    expect(categoryCheckbox.getAttribute('aria-checked')).toBe('mixed')

    act(() => container.querySelector('button[aria-label="Expand Pizzas"]').click())
    act(() => container.querySelector('input[aria-label="Remove Pepperoni pizza"]').click())
    expect(setSelectedProductsIds).toHaveBeenCalledWith({})
    act(() => root.unmount())
  })

  test('removes only the selected category products when the whole category is deselected', () => {
    const setSelectedProductsIds = vi.fn()
    const { container, root } = renderPicker({
      businessState: catalogState,
      selectedProductsIds: {
        22: { id: 22, include: true },
        23: { id: 23, include: true },
        30: { id: 30, include: true }
      },
      setSelectedProductsIds
    })

    const categoryCheckbox = container.querySelector('input[aria-label="Remove all products in Pizzas"]')
    expect(categoryCheckbox.checked).toBe(true)
    act(() => categoryCheckbox.click())
    expect(setSelectedProductsIds).toHaveBeenCalledWith({
      30: { id: 30, include: true }
    })
    act(() => root.unmount())
  })

  test('filters the category tree by product and keeps matching drill-down visible', () => {
    const { container, root } = renderPicker({ businessState: catalogState })

    const search = container.querySelector('input[type="search"]')
    setInputValue(search, 'garden')
    expect(container.textContent).toContain('Pizzas')
    expect(container.textContent).toContain('Special pizzas')
    expect(container.textContent).toContain('Garden pizza')
    expect(container.textContent).not.toContain('Drinks')
    act(() => root.unmount())
  })

  test('debounces Journey search into the shared server-side controller', () => {
    vi.useFakeTimers()
    controllerState.handleChangeSearch = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <JourneyProductPicker
            businessId={10}
            businessSlug='pizza-boston'
            selectedProductsIds={{}}
            setSelectedProductsIds={vi.fn()}
          />
        </ThemeProvider>
      )
    })

    setInputValue(container.querySelector('input[type="search"]'), '  burger  ')
    expect(controllerState.handleChangeSearch).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(249))
    expect(controllerState.handleChangeSearch).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(controllerState.handleChangeSearch).toHaveBeenCalledTimes(1)
    expect(controllerState.handleChangeSearch).toHaveBeenCalledWith('burger')
    expect(controllerState.props).toMatchObject({
      isSearchByName: true,
      isSearchByDescription: true
    })
    act(() => root.unmount())
  })

  test('keeps loading, error and empty catalog states explicit', () => {
    const loading = renderPicker({ businessState: { loading: true, business: {} } })
    expect(loading.container.textContent).toContain('Loading...')
    act(() => loading.root.unmount())

    const failed = renderPicker({ businessState: { loading: false, business: {}, error: ['Catalog unavailable'] } })
    expect(failed.container.querySelector('[role="alert"]').textContent).toContain('Catalog unavailable')
    act(() => failed.root.unmount())

    const productRequestFailed = renderPicker({
      businessState: catalogState,
      categoryState: { loading: false, products: [], pagination: { currentPage: 0, totalPages: 0 } },
      errors: ['Products unavailable']
    })
    expect(productRequestFailed.container.querySelector('[role="alert"]').textContent).toContain('Products unavailable')
    act(() => productRequestFailed.root.unmount())

    const empty = renderPicker({ businessState: { loading: false, business: { categories: [] } } })
    expect(empty.container.textContent).toContain('No products found.')
    act(() => empty.root.unmount())
  })

  test('groups the lightweight v2 product pages under their categories', () => {
    const setSelectedProductsIds = vi.fn()
    const lightweightCategories = categories.map(category => ({ ...category, products: [], subcategories: [] }))
    const { container, root } = renderPicker({
      businessState: { loading: false, business: { id: 10, categories: lightweightCategories } },
      categoryState: {
        loading: false,
        products: [
          { id: 22, category_id: 7, name: 'Pepperoni pizza', enabled: true },
          { id: 30, category_id: 9, name: 'Cola', enabled: true }
        ],
        pagination: { currentPage: 1, totalPages: 1 }
      },
      selectedProductsIds: {},
      setSelectedProductsIds
    })

    act(() => container.querySelector('input[aria-label="Select all products in Pizzas"]').click())
    expect(setSelectedProductsIds).toHaveBeenCalledWith({
      22: { id: 22, include: true, name: 'Pepperoni pizza' }
    })
    act(() => root.unmount())
  })

  test('renders loaded products while the remaining snapshot pages load', () => {
    const getPageProducts = vi.fn()
    const stripProducts = category => ({
      ...category,
      products: [],
      subcategories: (category.subcategories || []).map(stripProducts)
    })
    const picker = renderPicker({
      businessState: { loading: false, business: { id: 10, categories: categories.map(stripProducts) } },
      categoryState: {
        loading: true,
        products: [{ id: 22, category_id: 7, name: 'Pepperoni pizza', enabled: true }],
        pagination: { currentPage: 1, pageSize: 10, totalPages: 2 }
      },
      getPageProducts
    })

    expect(picker.container.textContent).toContain('Pizzas')
    expect(picker.container.textContent).toContain('Loading...')
    expect(picker.container.querySelector('input[aria-label="Select all products in Pizzas"]').disabled).toBe(true)
    act(() => picker.container.querySelector('button[aria-label="Expand Pizzas"]').click())
    expect(picker.container.querySelector('input[aria-label="Select Pepperoni pizza"]').disabled).toBe(false)
    expect(getPageProducts).not.toHaveBeenCalled()
    act(() => picker.root.unmount())
  })

  test('requests only the next page after the shared controller resolves page one', () => {
    const getPageProducts = vi.fn()
    const picker = renderPicker({
      businessId: 10,
      businessState: catalogState,
      categoryState: { loading: true, products: [], pagination: { currentPage: 0, pageSize: 100, totalPages: 0 } },
      getPageProducts
    })

    expect(getPageProducts).not.toHaveBeenCalled()

    picker.rerender({
      businessId: 10,
      businessState: catalogState,
      categoryState: {
        loading: false,
        products: [{ id: 22, category_id: 7, name: 'Pepperoni pizza', enabled: true }],
        pagination: { currentPage: 1, pageSize: 10, totalPages: 2 }
      },
      getPageProducts
    })

    expect(getPageProducts).toHaveBeenCalledTimes(1)
    expect(getPageProducts).toHaveBeenCalledWith(false, undefined, 10)
    expect(getPageProducts).not.toHaveBeenCalledWith(true, 1, 100)

    picker.rerender({
      businessId: 10,
      businessState: catalogState,
      categoryState: { loading: false, products: [], pagination: { currentPage: 2, pageSize: 10, totalPages: 3 } },
      getPageProducts
    })
    expect(getPageProducts).toHaveBeenCalledTimes(2)

    picker.rerender({
      businessId: 10,
      businessState: catalogState,
      categoryState: { loading: false, products: [], pagination: { currentPage: 1, pageSize: 10, totalPages: 3 } },
      getPageProducts
    })
    expect(getPageProducts).toHaveBeenCalledTimes(3)
    expect(getPageProducts).toHaveBeenLastCalledWith(false, undefined, 10)
    act(() => picker.root.unmount())
  })

  test('waits for the new search scope page one before reserving its next page', () => {
    const getPageProducts = vi.fn()
    const picker = renderPicker({
      businessId: 10,
      businessState: catalogState,
      searchValue: '',
      categoryState: {
        loading: false,
        products: [],
        pagination: { currentPage: 1, pageSize: 100, totalPages: 2 }
      },
      getPageProducts
    })

    expect(getPageProducts).toHaveBeenCalledTimes(1)
    getPageProducts.mockClear()

    picker.rerender({
      businessId: 10,
      businessState: catalogState,
      searchValue: 'burger',
      categoryState: {
        loading: false,
        products: [],
        pagination: { currentPage: 1, pageSize: 100, totalPages: 3 }
      },
      getPageProducts
    })

    expect(getPageProducts).not.toHaveBeenCalled()

    picker.rerender({
      businessId: 10,
      businessState: catalogState,
      searchValue: 'burger',
      categoryState: {
        loading: true,
        products: [],
        pagination: { currentPage: 1, pageSize: 100, totalPages: 3 }
      },
      getPageProducts
    })

    picker.rerender({
      businessId: 10,
      businessState: catalogState,
      searchValue: 'burger',
      categoryState: {
        loading: false,
        products: [],
        pagination: { currentPage: 1, pageSize: 100, totalPages: 3 }
      },
      getPageProducts
    })

    expect(getPageProducts).toHaveBeenCalledTimes(1)
    expect(getPageProducts).toHaveBeenLastCalledWith(false, undefined, 100)
    act(() => picker.root.unmount())
  })

  test('loads a 500-product snapshot in five 100-item pages when the API honors the requested size', () => {
    const getPageProducts = vi.fn()
    const picker = renderPicker({
      businessId: 10,
      businessState: catalogState,
      categoryState: { loading: false, products: [], pagination: { currentPage: 1, pageSize: 100, totalPages: 5 } },
      getPageProducts
    })

    for (let currentPage = 2; currentPage <= 5; currentPage += 1) {
      picker.rerender({
        businessId: 10,
        businessState: catalogState,
        categoryState: { loading: false, products: [], pagination: { currentPage, pageSize: 100, totalPages: 5 } },
        getPageProducts
      })
    }

    expect(getPageProducts).toHaveBeenCalledTimes(4)
    getPageProducts.mock.calls.forEach(call => {
      expect(call).toEqual([false, undefined, 100])
    })
    act(() => picker.root.unmount())
  })

  test('does not show a terminal empty search state while catalog pages are still loading', () => {
    const picker = renderPicker({
      businessState: catalogState,
      categoryState: {
        loading: true,
        products: [{ id: 22, category_id: 7, name: 'Pepperoni pizza', enabled: true }],
        pagination: { currentPage: 1, pageSize: 100, totalPages: 2 }
      }
    })

    setInputValue(picker.container.querySelector('input[type="search"]'), 'burger')
    expect(picker.container.textContent).toContain('Loading...')
    expect(picker.container.textContent).not.toContain('No products found.')
    act(() => picker.root.unmount())
  })

  test('treats a resolved response without pagination metadata as terminal', () => {
    const { container, root } = renderPicker({
      businessState: catalogState,
      categoryState: { loading: false, products: [], pagination: { currentPage: 0, totalPages: 0 } }
    })

    expect(container.textContent).toContain('Pizzas')
    expect(container.textContent).not.toContain('Loading...')
    act(() => root.unmount())
  })

  test('selects only visible products when a category is filtered by search', () => {
    const setSelectedProductsIds = vi.fn()
    const picker = renderPicker({
      businessState: catalogState,
      setSelectedProductsIds
    })

    setInputValue(picker.container.querySelector('input[type="search"]'), 'garden')
    act(() => picker.container.querySelector('input[aria-label="Select all products in Pizzas"]').click())
    expect(setSelectedProductsIds).toHaveBeenCalledWith({
      23: { id: 23, include: true, name: 'Garden pizza' }
    })

    picker.rerender({
      businessState: catalogState,
      selectedProductsIds: { 23: { id: 23, include: true, name: 'Garden pizza' } },
      setSelectedProductsIds
    })
    expect(picker.container.textContent).toContain('1 selected')
    expect(picker.container.querySelector('input[aria-label="Remove all products in Pizzas"]').checked).toBe(true)
    act(() => picker.root.unmount())
  })

  test('keeps category bulk selection scoped to the server search while clear is debouncing', () => {
    vi.useFakeTimers()
    const setSelectedProductsIds = vi.fn()
    const picker = renderPicker({
      businessState: catalogState,
      searchValue: 'garden',
      setSelectedProductsIds
    })
    const searchInput = picker.container.querySelector('input[type="search"]')

    setInputValue(searchInput, 'garden')
    expect(picker.container.textContent).toContain('Garden pizza')
    expect(picker.container.textContent).not.toContain('Pepperoni pizza')

    setInputValue(searchInput, '')
    act(() => picker.container.querySelector('input[aria-label="Select all products in Pizzas"]').click())
    expect(setSelectedProductsIds).toHaveBeenCalledWith({
      23: { id: 23, include: true, name: 'Garden pizza' }
    })

    setSelectedProductsIds.mockClear()
    picker.rerender({
      businessState: catalogState,
      searchValue: '',
      setSelectedProductsIds
    })
    act(() => picker.container.querySelector('input[aria-label="Select all products in Pizzas"]').click())
    expect(setSelectedProductsIds).toHaveBeenCalledWith({
      22: { id: 22, include: true, name: 'Pepperoni pizza' },
      23: { id: 23, include: true, name: 'Garden pizza' }
    })

    act(() => picker.root.unmount())
  })

  test('keeps replacement search actions pending until the server scope catches up', () => {
    vi.useFakeTimers()
    const setSelectedProductsIds = vi.fn()
    const businessState = {
      loading: false,
      business: {
        id: 10,
        categories: [{
          id: 7,
          name: 'Pizzas',
          enabled: true,
          rank: 1,
          products: [],
          subcategories: [{
            id: 8,
            name: 'Special pizzas',
            enabled: true,
            rank: 1,
            products: [],
            subcategories: []
          }]
        }]
      }
    }
    const categoryState = {
      loading: false,
      products: [{ id: 23, category_id: 8, name: 'Garden pizza', enabled: true }],
      pagination: { currentPage: 1, pageSize: 100, totalPages: 1 }
    }
    const picker = renderPicker({
      businessState,
      categoryState,
      searchValue: 'garden',
      setSelectedProductsIds
    })
    const searchInput = picker.container.querySelector('input[type="search"]')

    setInputValue(searchInput, 'garden')
    expect(picker.container.textContent).toContain('Garden pizza')

    setInputValue(searchInput, 'pizza')
    const categoryCheckbox = picker.container.querySelector('input[aria-label="Select all products in Pizzas"]')
    expect(categoryCheckbox.disabled).toBe(true)
    act(() => categoryCheckbox.click())
    expect(setSelectedProductsIds).not.toHaveBeenCalled()

    setInputValue(searchInput, 'pepperoni')
    expect(picker.container.textContent).toContain('Loading...')
    expect(picker.container.textContent).not.toContain('No products found.')

    act(() => picker.root.unmount())
  })

  test('keeps unavailable selected products visible and removable', () => {
    const setSelectedProductsIds = vi.fn()
    const { container, root } = renderPicker({
      businessState: catalogState,
      selectedProductsIds: { 99: { id: 99, include: true, name: 'Archived burger' } },
      setSelectedProductsIds
    })

    expect(container.textContent).toContain('Unavailable')
    expect(container.textContent).toContain('Archived burger')
    act(() => container.querySelector('input[aria-label="Remove Archived burger"]').click())
    expect(setSelectedProductsIds).toHaveBeenCalledWith({})
    act(() => root.unmount())
  })

  test('does not classify selections outside a resolved server-search bucket as unavailable', () => {
    const picker = renderPicker({
      businessState: { loading: false, business: { id: 10, categories: [{ ...categories[0], products: [] }] } },
      categoryState: {
        loading: false,
        products: [{ id: 50, category_id: 7, name: 'Burger match', enabled: true }],
        pagination: { currentPage: 1, pageSize: 100, totalPages: 1 }
      },
      searchValue: 'burger',
      selectedProductsIds: { 99: { id: 99, include: true, name: 'Archived burger' } }
    })

    setInputValue(picker.container.querySelector('input[type="search"]'), 'burger')

    expect(picker.container.textContent).toContain('Burger match')
    expect(picker.container.textContent).not.toContain('Unavailable')
    expect(picker.container.textContent).not.toContain('Archived burger')
    expect(picker.container.querySelector('input[aria-label="Remove Archived burger"]')).toBeNull()
    act(() => picker.root.unmount())
  })

  test('keeps loaded products visible and retries a failed later page in place', () => {
    const getPageProducts = vi.fn()
    const { container, root } = renderPicker({
      businessState: catalogState,
      categoryState: {
        loading: false,
        products: [{ id: 22, category_id: 7, name: 'Pepperoni pizza', enabled: true }],
        pagination: { currentPage: 6, pageSize: 100, totalPages: 30 }
      },
      errors: ['Temporary products error'],
      getPageProducts
    })

    expect(container.textContent).toContain('Pizzas')
    expect(container.textContent).toContain('Temporary products error')
    const retry = [...container.querySelectorAll('button')].find(button => button.textContent === 'Retry')
    expect(retry).toBeTruthy()
    act(() => retry.click())
    expect(getPageProducts).toHaveBeenCalledWith(false, undefined, 100)
    act(() => root.unmount())
  })

  test('retries an initial product-page failure with replacement semantics', () => {
    const getPageProducts = vi.fn()
    const { container, root } = renderPicker({
      businessState: { loading: false, business: { id: 10, categories: [] } },
      categoryState: {
        loading: false,
        products: [],
        pagination: { currentPage: 0, pageSize: 100, totalPages: 0 }
      },
      errors: ['Temporary products error'],
      selectedProductsIds: {
        22: { id: 22, include: true, name: 'Pepperoni pizza' }
      },
      getPageProducts
    })

    expect(container.textContent).not.toContain('Unavailable')
    expect(container.textContent).not.toContain('Pepperoni pizza')
    const retry = [...container.querySelectorAll('button')].find(button => button.textContent === 'Retry')
    expect(retry).toBeTruthy()
    act(() => retry.click())
    expect(getPageProducts).toHaveBeenCalledWith(true, 1, 100)
    act(() => root.unmount())
  })

  test('treats null category and product payloads as an empty catalog', () => {
    const { container, root } = renderPicker({
      businessState: { loading: false, business: { id: 10, categories: null } },
      categoryState: {
        loading: false,
        products: null,
        pagination: { currentPage: 1, pageSize: 100, totalPages: 1 }
      }
    })

    expect(container.textContent).toContain('No products found.')
    act(() => root.unmount())
  })

  test('caps automatic paging and lets the user request another batch', () => {
    const getPageProducts = vi.fn()
    const picker = renderPicker({
      businessId: 10,
      businessState: catalogState,
      categoryState: {
        loading: false,
        products: [],
        pagination: { currentPage: 1, pageSize: 100, totalPages: 50 }
      },
      getPageProducts
    })

    for (let currentPage = 2; currentPage <= 10; currentPage += 1) {
      picker.rerender({
        businessId: 10,
        businessState: catalogState,
        categoryState: {
          loading: false,
          products: [],
          pagination: { currentPage, pageSize: 100, totalPages: 50 }
        },
        getPageProducts
      })
    }

    expect(getPageProducts).toHaveBeenCalledTimes(9)
    expect(picker.container.textContent).not.toContain('Loading...')
    expect(picker.container.querySelector('input[aria-label="Select all products in Pizzas"]').disabled).toBe(true)
    expect(picker.container.textContent).toContain('Load the remaining products to enable whole-category selection.')
    const loadMore = [...picker.container.querySelectorAll('button')]
      .find(button => button.textContent === 'Load more')
    expect(loadMore).toBeTruthy()

    act(() => loadMore.click())
    expect(getPageProducts).toHaveBeenCalledTimes(10)
    expect(getPageProducts).toHaveBeenLastCalledWith(false, undefined, 100)

    for (let currentPage = 11; currentPage <= 20; currentPage += 1) {
      picker.rerender({
        businessId: 10,
        businessState: catalogState,
        categoryState: {
          loading: false,
          products: [],
          pagination: { currentPage, pageSize: 100, totalPages: 50 }
        },
        getPageProducts
      })
    }

    expect(getPageProducts).toHaveBeenCalledTimes(19)
    expect(picker.container.textContent).toContain('Load more')
    expect(picker.container.textContent).not.toContain('Loading...')
    act(() => picker.root.unmount())
  })

  test('keeps Load more retryable when a successful response does not advance the page', () => {
    const getPageProducts = vi.fn()
    const picker = renderPicker({
      businessId: 10,
      businessState: catalogState,
      categoryState: {
        loading: false,
        products: [],
        pagination: { currentPage: 10, pageSize: 100, totalPages: 50 }
      },
      getPageProducts
    })

    const clickLoadMore = () => {
      const loadMore = [...picker.container.querySelectorAll('button')]
        .find(button => button.textContent === 'Load more')
      expect(loadMore).toBeTruthy()
      act(() => loadMore.click())
    }

    clickLoadMore()
    expect(getPageProducts).toHaveBeenCalledTimes(1)

    picker.rerender({
      businessId: 10,
      businessState: catalogState,
      categoryState: {
        loading: true,
        products: [],
        pagination: { currentPage: 10, pageSize: 100, totalPages: 50 }
      },
      getPageProducts
    })
    picker.rerender({
      businessId: 10,
      businessState: catalogState,
      categoryState: {
        loading: false,
        products: [],
        pagination: { currentPage: 10, pageSize: 100, totalPages: 50 }
      },
      getPageProducts
    })

    clickLoadMore()
    expect(getPageProducts).toHaveBeenCalledTimes(2)
    expect(getPageProducts).toHaveBeenLastCalledWith(false, undefined, 100)
    act(() => picker.root.unmount())
  })

  test('shows retry instead of loading when a later page fails before any visible product loads', () => {
    const getPageProducts = vi.fn()
    const { container, root } = renderPicker({
      businessState: { loading: false, business: { id: 10, categories: [{ id: 7, name: 'Pizzas', enabled: true, products: [] }] } },
      categoryState: {
        loading: false,
        products: [],
        pagination: { currentPage: 6, pageSize: 100, totalPages: 30 }
      },
      errors: ['Temporary products error'],
      getPageProducts
    })

    expect(container.textContent).toContain('Temporary products error')
    expect(container.textContent).not.toContain('Loading...')
    const retry = [...container.querySelectorAll('button')].find(button => button.textContent === 'Retry')
    act(() => retry.click())
    expect(getPageProducts).toHaveBeenCalledWith(false, undefined, 100)
    act(() => root.unmount())
  })

  test('uses a 100-item shared-controller snapshot page so large catalogs need fewer requests', () => {
    controllerState.ordering = { root: 'https://api.test' }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <JourneyProductPicker
            businessId={10}
            businessSlug='pizza-boston'
            selectedProductsIds={{}}
            setSelectedProductsIds={vi.fn()}
          />
        </ThemeProvider>
      )
    })

    expect(controllerState.props).toMatchObject({
      ordering: controllerState.ordering,
      slug: 'pizza-boston',
      businessId: 10,
      propsToFetch: ['id', 'categories'],
      initialProductPageSize: 100,
      deferProductsUntilBusinessLoaded: true,
      version: 'v2'
    })
    act(() => root.unmount())
  })
})
