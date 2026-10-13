import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { BusinessProductsListing } from './index'

vi.mock('../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))

vi.mock('../../contexts/EventContext', () => ({
  useEvent: () => [{ on: vi.fn(), off: vi.fn() }]
}))

global.IS_REACT_ACT_ENVIRONMENT = true

describe('BusinessProductsListing', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('defers the initial product fetch until the business is loaded when requested', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ error: false, result: [] })
    }))

    const productParameters = vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        content: {
          error: false,
          result: [],
          pagination: { page_size: 10, current_page: 1, total: 0, total_pages: 1 }
        }
      })
    }))
    let resolveBusiness
    const businessGet = vi.fn(() => new Promise(resolve => {
      resolveBusiness = resolve
    }))
    const businessResource = {
      asDashboard: vi.fn(() => ({
        select: vi.fn(() => ({
          parameters: vi.fn(() => ({ get: businessGet }))
        }))
      })),
      products: vi.fn(() => ({ parameters: productParameters }))
    }
    const ordering = {
      root: 'https://api.test',
      businesses: vi.fn(() => businessResource)
    }

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <BusinessProductsListing
          ordering={ordering}
          slug='test-business'
          businessId={10}
          initialProductPageSize={10}
          deferProductsUntilBusinessLoaded
          propsToFetch={['id', 'categories']}
          UIComponent={() => null}
        />
      )
    })

    expect(productParameters).not.toHaveBeenCalled()

    await act(async () => {
      resolveBusiness({ content: { result: { id: 10, categories: [] } } })
    })

    await vi.waitFor(() => {
      expect(productParameters).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        page_size: 10
      }))
    })

    act(() => root.unmount())
  })

  test('restores the cached unfiltered product snapshot when an opted-in consumer clears search', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ error: false, result: [] })
    }))

    const productParameters = vi.fn(parameters => {
      const endpoint = {
        get: vi.fn().mockResolvedValue({
          content: {
            error: false,
            result: [],
            pagination: {
              page_size: parameters.page_size,
              current_page: parameters.page,
              total: 100,
              total_pages: Math.ceil(100 / parameters.page_size)
            }
          }
        })
      }
      endpoint.where = vi.fn(() => endpoint)
      return endpoint
    })
    const businessResource = {
      asDashboard: vi.fn(() => ({
        select: vi.fn(() => ({
          parameters: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              content: { result: { id: 10, categories: [], lazy_load_products_recommended: true } }
            })
          }))
        }))
      })),
      products: vi.fn(() => ({ parameters: productParameters }))
    }
    const ordering = {
      root: 'https://api.test',
      businesses: vi.fn(() => businessResource)
    }
    let controllerProps
    const UIComponent = props => {
      controllerProps = props
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
          businessId={10}
          forceLazyLoadProducts
          restoreProductListOnSearchClear
          propsToFetch={['id', 'categories']}
          UIComponent={UIComponent}
        />
      )
    })

    await act(async () => {
      await vi.waitFor(() => expect(productParameters).toHaveBeenCalled())
    })
    await act(async () => {
      await controllerProps.getPageProducts(true, 1, 50)
    })
    await act(async () => {
      await vi.waitFor(() => {
        expect(controllerProps.categoryState.pagination.pageSize).toBe(50)
      })
    })

    act(() => controllerProps.handleChangeSearch('burger'))
    await act(async () => {
      await vi.waitFor(() => {
        expect(productParameters.mock.calls.at(-1)[0].page_size).toBe(50)
      })
    })
    const callsBeforeClear = productParameters.mock.calls.length

    act(() => controllerProps.handleChangeSearch(null))
    await act(async () => {
      await vi.waitFor(() => {
        expect(controllerProps.categoryState.pagination.pageSize).toBe(50)
      })
    })
    expect(productParameters).toHaveBeenCalledTimes(callsBeforeClear)

    act(() => root.unmount())
  })

  test.each([
    ['omits', undefined],
    ['returns zero for', 0],
    ['returns an invalid', 'invalid']
  ])('preserves an omitted-prop consumer page size when a response %s page-size value and search changes', async (_scenario, responsePageSize) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ error: false, result: [] })
    }))

    const responsePageSizeMetadata = responsePageSize === undefined
      ? {}
      : { page_size: responsePageSize }
    const productParameters = vi.fn(parameters => {
      const endpoint = {
        get: vi.fn().mockResolvedValue({
          content: {
            error: false,
            result: [],
            pagination: {
              ...(parameters.page_size === 50
                ? responsePageSizeMetadata
                : { page_size: parameters.page_size }),
              current_page: parameters.page,
              total: 100,
              total_pages: Math.ceil(100 / parameters.page_size)
            }
          }
        })
      }
      endpoint.where = vi.fn(() => endpoint)
      return endpoint
    })
    const businessResource = {
      asDashboard: vi.fn(() => ({
        select: vi.fn(() => ({
          parameters: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              content: { result: { id: 10, categories: [], lazy_load_products_recommended: true } }
            })
          }))
        }))
      })),
      products: vi.fn(() => ({ parameters: productParameters }))
    }
    const ordering = {
      root: 'https://api.test',
      businesses: vi.fn(() => businessResource)
    }
    let controllerProps
    const UIComponent = props => {
      controllerProps = props
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
          businessId={10}
          isSearchByName
          isSearchByDescription
          propsToFetch={['id', 'categories']}
          UIComponent={UIComponent}
        />
      )
    })

    await act(async () => {
      await vi.waitFor(() => expect(productParameters).toHaveBeenCalled())
    })

    act(() => controllerProps.handleChangeSearch('burger'))
    await act(async () => {
      await vi.waitFor(() => {
        expect(productParameters.mock.calls.at(-1)[0].page_size).toBe(10)
      })
    })

    await act(async () => {
      await controllerProps.getPageProducts(true, 1, 50)
    })
    await act(async () => {
      await vi.waitFor(() => {
        expect(controllerProps.categoryState.pagination.pageSize).toBe(50)
      })
    })

    const callsBeforeReplacement = productParameters.mock.calls.length
    act(() => controllerProps.handleChangeSearch('pizza'))
    await act(async () => {
      await vi.waitFor(() => {
        expect(productParameters).toHaveBeenCalledTimes(callsBeforeReplacement + 1)
      })
    })
    expect(productParameters.mock.calls.at(-1)[0].page_size).toBe(50)

    act(() => root.unmount())
  })

  test('isolates pagination by search term so a failed replacement retries page one without stale products', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ error: false, result: [] })
    }))

    const requests = []
    let betaPageOneAttempts = 0
    let alphaPageOneAttempts = 0
    const productParameters = vi.fn(parameters => {
      let where
      const endpoint = {
        where: vi.fn(nextWhere => {
          where = nextWhere
          return endpoint
        }),
        get: vi.fn(async () => {
          const encodedTerm = where?.conditions?.[0]?.value?.value || ''
          const term = decodeURI(encodedTerm).replaceAll('%', '') || 'all'
          requests.push({ term, page: parameters.page })
          if (term === 'alpha' && parameters.page === 1 && alphaPageOneAttempts++ === 1) {
            return { content: { error: true, result: ['Alpha refresh failed'] } }
          }
          if (term === 'beta' && parameters.page === 1 && betaPageOneAttempts++ === 0) {
            return { content: { error: true, result: ['Beta page one failed'] } }
          }
          const totalPages = term === 'alpha' ? 10 : 1
          return {
            content: {
              error: false,
              result: [{ id: `${term}-${parameters.page}`, name: `${term}-${parameters.page}` }],
              pagination: {
                page_size: parameters.page_size,
                current_page: parameters.page,
                total: totalPages,
                total_pages: totalPages
              }
            }
          }
        })
      }
      return endpoint
    })
    const businessResource = {
      asDashboard: vi.fn(() => ({
        select: vi.fn(() => ({
          parameters: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              content: { result: { id: 10, categories: [], lazy_load_products_recommended: true } }
            })
          }))
        }))
      })),
      products: vi.fn(() => ({ parameters: productParameters }))
    }
    const ordering = {
      root: 'https://api.test',
      businesses: vi.fn(() => businessResource)
    }
    let controllerProps
    const UIComponent = props => {
      controllerProps = props
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
          businessId={10}
          initialProductPageSize={100}
          deferProductsUntilBusinessLoaded
          restoreProductListOnSearchClear
          isSearchByName
          isSearchByDescription
          forceLazyLoadProducts
          propsToFetch={['id', 'categories']}
          UIComponent={UIComponent}
        />
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(requests).toContainEqual({ term: 'all', page: 1 })
    expect(controllerProps.categoryState.products).toEqual([
      expect.objectContaining({ name: 'all-1' })
    ])

    await act(async () => {
      controllerProps.handleChangeSearch('alpha')
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(requests).toContainEqual({ term: 'alpha', page: 1 })
    expect(controllerProps.categoryState.pagination.currentPage).toBe(1)
    expect(controllerProps.categoryState.products).toEqual([
      expect.objectContaining({ name: 'alpha-1' })
    ])
    for (let page = 2; page <= 10; page += 1) {
      await act(async () => {
        await controllerProps.getPageProducts(false, undefined, 100)
      })
    }
    expect(controllerProps.categoryState.pagination.currentPage).toBe(10)
    expect(controllerProps.categoryState.products).toHaveLength(10)

    await act(async () => {
      controllerProps.handleChangeSearch('beta')
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(controllerProps.errors).toEqual(['Beta page one failed'])
    expect(controllerProps.categoryState.pagination.currentPage).toBe(0)
    expect(controllerProps.categoryState.products).toEqual([])

    const isInitialPage = controllerProps.categoryState.pagination.currentPage <= 0
    await act(async () => {
      await controllerProps.getPageProducts(isInitialPage, isInitialPage ? 1 : undefined, 100)
    })
    expect(requests.at(-1)).toEqual({ term: 'beta', page: 1 })
    expect(controllerProps.categoryState.products).toEqual([
      expect.objectContaining({ name: 'beta-1' })
    ])

    await act(async () => {
      controllerProps.handleChangeSearch('alpha')
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(controllerProps.errors).toEqual(['Alpha refresh failed'])
    expect(controllerProps.categoryState.pagination.currentPage).toBe(0)
    expect(controllerProps.categoryState.products).toEqual([])

    const isCachedSearchInitialPage = controllerProps.categoryState.pagination.currentPage <= 0
    await act(async () => {
      await controllerProps.getPageProducts(
        isCachedSearchInitialPage,
        isCachedSearchInitialPage ? 1 : undefined,
        100
      )
    })
    expect(requests.at(-1)).toEqual({ term: 'alpha', page: 1 })
    expect(controllerProps.categoryState.products).toEqual([
      expect.objectContaining({ name: 'alpha-1' })
    ])

    const requestCountBeforeClear = requests.length
    await act(async () => {
      controllerProps.handleChangeSearch('')
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(controllerProps.searchValue).toBe('')
    expect(requests).toHaveLength(requestCountBeforeClear)
    expect(controllerProps.categoryState.products).toEqual([
      expect.objectContaining({ name: 'all-1' })
    ])

    act(() => root.unmount())
  })

  test('clears a product error when a retry request begins and succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ error: false, result: [] })
    }))

    let productRequest = 0
    const productParameters = vi.fn(parameters => ({
      get: vi.fn().mockImplementation(async () => {
        productRequest += 1
        if (productRequest === 1) {
          return { content: { error: true, result: ['Temporary products error'] } }
        }
        return {
          content: {
            error: false,
            result: [],
            pagination: { page_size: parameters.page_size, current_page: 1, total: 0, total_pages: 1 }
          }
        }
      })
    }))
    const businessResource = {
      asDashboard: vi.fn(() => ({
        select: vi.fn(() => ({
          parameters: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              content: { result: { id: 10, categories: [], lazy_load_products_recommended: true } }
            })
          }))
        }))
      })),
      products: vi.fn(() => ({ parameters: productParameters }))
    }
    const ordering = {
      root: 'https://api.test',
      businesses: vi.fn(() => businessResource)
    }
    let controllerProps
    const UIComponent = props => {
      controllerProps = props
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
          businessId={10}
          initialProductPageSize={100}
          deferProductsUntilBusinessLoaded
          forceLazyLoadProducts
          propsToFetch={['id', 'categories']}
          UIComponent={UIComponent}
        />
      )
    })

    await vi.waitFor(() => {
      expect(controllerProps.errors).toEqual(['Temporary products error'])
    })
    await act(async () => {
      await controllerProps.getPageProducts(true, 1, 100)
    })
    expect(controllerProps.errors).toBeNull()

    act(() => root.unmount())
  })

  test('ignores a stale product failure while a replacement request is still loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ error: false, result: [] })
    }))

    let rejectStaleRequest
    let resolveCurrentRequest
    const cancelStaleRequest = vi.fn()
    let productRequest = 0
    const productParameters = vi.fn(parameters => ({
      get: vi.fn().mockImplementation(({ cancelToken }) => {
        productRequest += 1
        if (productRequest === 1) {
          return Promise.resolve({
            content: {
              error: false,
              result: [],
              pagination: { page_size: parameters.page_size, current_page: 1, total: 0, total_pages: 1 }
            }
          })
        }
        if (productRequest === 2) {
          cancelToken.cancel = cancelStaleRequest
          return new Promise((resolve, reject) => {
            rejectStaleRequest = reject
          })
        }
        return new Promise(resolve => {
          resolveCurrentRequest = resolve
        })
      })
    }))
    const businessResource = {
      asDashboard: vi.fn(() => ({
        select: vi.fn(() => ({
          parameters: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              content: { result: { id: 10, categories: [], lazy_load_products_recommended: true } }
            })
          }))
        }))
      })),
      products: vi.fn(() => ({ parameters: productParameters }))
    }
    const ordering = {
      root: 'https://api.test',
      businesses: vi.fn(() => businessResource)
    }
    let controllerProps
    const UIComponent = props => {
      controllerProps = props
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
          businessId={10}
          initialProductPageSize={100}
          deferProductsUntilBusinessLoaded
          forceLazyLoadProducts
          propsToFetch={['id', 'categories']}
          UIComponent={UIComponent}
        />
      )
    })
    await vi.waitFor(() => expect(productRequest).toBe(1))

    let stalePromise
    act(() => {
      stalePromise = controllerProps.getPageProducts(true, 1, 100)
    })
    await vi.waitFor(() => expect(productRequest).toBe(2))

    let currentPromise
    act(() => {
      currentPromise = controllerProps.getPageProducts(true, 1, 100)
    })
    await vi.waitFor(() => expect(productRequest).toBe(3))
    expect(cancelStaleRequest).toHaveBeenCalledOnce()

    await act(async () => {
      rejectStaleRequest(new Error('Stale products error'))
      await stalePromise
    })

    expect(controllerProps.errors).toBeNull()
    expect(controllerProps.categoryState.loading).toBe(true)

    await act(async () => {
      resolveCurrentRequest({
        content: {
          error: false,
          result: [],
          pagination: { page_size: 100, current_page: 1, total: 0, total_pages: 1 }
        }
      })
      await currentPromise
    })

    expect(controllerProps.errors).toBeNull()
    expect(controllerProps.categoryState.loading).toBe(false)

    act(() => root.unmount())
  })
})
