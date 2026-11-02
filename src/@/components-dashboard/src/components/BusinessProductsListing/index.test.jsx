import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { BusinessProductsListing } from './index'

const catalogResponse = (result = []) => ({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue({ error: false, result })
})

vi.mock('../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))

vi.mock('../../contexts/EventContext', () => ({
  useEvent: () => [{ on: vi.fn(), off: vi.fn() }]
}))

global.IS_REACT_ACT_ENVIRONMENT = true

describe('BusinessProductsListing catalogs', () => {
  let root
  let controllerProps
  const UIComponent = props => {
    controllerProps = props
    return null
  }

  const mount = async (apiRoot = 'https://api.test') => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(<BusinessProductsListing ordering={{ root: apiRoot }} UIComponent={UIComponent} />)
    })
  }

  afterEach(() => {
    if (root) act(() => root.unmount())
    root = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test.each([
    ['network rejection', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['HTTP 401', () => ({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: false, result: [{ id: 1 }] })
    })],
    ['HTTP 503', () => ({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue({ error: false, result: [{ id: 1 }] })
    })],
    ['invalid JSON', () => ({ ok: true, json: () => Promise.reject(new SyntaxError('Invalid JSON')) })],
    ['API error', () => ({ ok: true, json: async () => ({ error: true, result: ['Unavailable'] }) })],
    ['invalid result', () => catalogResponse({})],
    ['invalid entry', () => catalogResponse([null])],
    ['missing entry id', () => catalogResponse([{ name: 'Missing id' }])]
  ])('handles %s without leaving catalog loads pending', async (_name, response) => {
    vi.stubGlobal('fetch', vi.fn(url => /\/(taxes|fees)/.test(url) ? response() : catalogResponse()))
    await mount()

    for (const resource of ['taxes', 'fees']) {
      expect(controllerProps.catalogState[resource].loading).toBe(false)
      expect(controllerProps.catalogState[resource].error).toBeTruthy()
      expect(controllerProps.catalogState[resource].loaded).toBe(false)
      expect(controllerProps[resource]).toEqual({})
    }
    expect(controllerProps.formTaxState.loading).toBe(false)
  })

  test('loads both catalogs initially and retries only the failed catalog', async () => {
    let failTaxes = true
    const fee = { id: 2, name: 'Service fee' }
    const fetch = vi.fn(url => {
      if (url.endsWith('/taxes') && failTaxes) return Promise.reject(new TypeError('Failed to fetch'))
      return catalogResponse(url.includes('/fees?') ? [fee] : [])
    })
    vi.stubGlobal('fetch', fetch)
    await mount()
    expect(controllerProps.catalogState.taxes.error).toBeTruthy()
    expect(controllerProps.catalogState.taxes.loaded).toBe(false)
    expect(controllerProps.catalogState.fees).toEqual({ loading: false, error: null, loaded: true })
    expect(controllerProps.fees).toEqual({ 'id:2': fee })
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/taxes')).length).toBe(1)
    const feeRequests = fetch.mock.calls.filter(([url]) => url.includes('/fees?')).length
    expect(fetch).toHaveBeenCalledWith('https://api.test/fees?where={"type":"product"}', expect.objectContaining({
      method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer test-token' })
    }))

    failTaxes = false
    await act(async () => { await controllerProps.retryCatalogs() })
    expect(fetch.mock.calls.filter(([url]) => url.includes('/fees?')).length).toBe(feeRequests)
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/taxes')).length).toBe(2)
    expect(controllerProps.catalogState.taxes).toEqual({ loading: false, error: null, loaded: true })
    expect(controllerProps.taxes).toEqual({})
  })

  test('does not refetch successfully loaded catalogs on retry', async () => {
    const tax = { id: 1, name: 'VAT' }
    const fee = { id: 2, name: 'Fee' }
    const fetch = vi.fn(url => catalogResponse(url.endsWith('/taxes') ? [tax] : url.includes('/fees?') ? [fee] : []))
    vi.stubGlobal('fetch', fetch)
    await mount()
    const catalogRequests = fetch.mock.calls.filter(([url]) => /\/(taxes|fees)/.test(url)).length
    await act(async () => { await controllerProps.retryCatalogs() })
    expect(controllerProps.taxes).toEqual({ 'id:1': tax })
    expect(controllerProps.fees).toEqual({ 'id:2': fee })
    expect(fetch.mock.calls.filter(([url]) => /\/(taxes|fees)/.test(url))).toHaveLength(catalogRequests)
    expect(controllerProps.catalogState).toEqual({
      taxes: { loading: false, error: null, loaded: true },
      fees: { loading: false, error: null, loaded: true }
    })
  })

  test('does not retry catalogs that are still loading', async () => {
    let resolveTax
    const fetch = vi.fn(url => {
      if (url.endsWith('/taxes')) return new Promise(resolve => { resolveTax = resolve })
      return catalogResponse()
    })
    vi.stubGlobal('fetch', fetch)
    await mount()

    await act(async () => { await controllerProps.retryCatalogs() })
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/taxes'))).toHaveLength(1)
    expect(controllerProps.catalogState.taxes).toEqual({ loading: true, error: null, loaded: false })

    await act(async () => { resolveTax(catalogResponse()) })
    expect(controllerProps.catalogState.taxes).toEqual({ loading: false, error: null, loaded: true })
  })

  test('ignores superseded responses after an API root change and aborts pending loads on unmount', async () => {
    let resolveOldTax
    let oldSignal
    const fetch = vi.fn((url, options) => {
      if (url === 'https://api.test/taxes') {
        oldSignal = options.signal
        return new Promise(resolve => { resolveOldTax = resolve })
      }
      if (url.startsWith('https://api.changed/')) return new Promise(() => {})
      return catalogResponse()
    })
    vi.stubGlobal('fetch', fetch)
    await mount()
    expect(controllerProps.catalogState.taxes.loading).toBe(true)

    await act(async () => {
      root.render(<BusinessProductsListing ordering={{ root: 'https://api.changed' }} UIComponent={UIComponent} />)
    })
    expect(oldSignal.aborted).toBe(true)

    await act(async () => { resolveOldTax(catalogResponse([{ id: 99 }])) })
    expect(controllerProps.taxes).toEqual({})
    expect(controllerProps.catalogState.taxes).toEqual({ loading: true, error: null, loaded: false })
    act(() => root.unmount())
    root = null
    expect(fetch.mock.calls.filter(([url]) => /\/(taxes|fees)/.test(url)).every(([, options]) => options.signal.aborted)).toBe(true)
  })

  test('resets loaded catalogs and maps when the API root changes', async () => {
    const tax = { id: 1, name: 'VAT' }
    const fee = { id: 2, name: 'Fee' }
    let pending = false
    const newSignals = []
    const fetch = vi.fn((url, { signal }) => {
      if (pending) {
        newSignals.push(signal)
        return new Promise(() => {})
      }
      return catalogResponse(url.endsWith('/taxes') ? [tax] : url.includes('/fees?') ? [fee] : [])
    })
    vi.stubGlobal('fetch', fetch)
    await mount()
    expect(controllerProps.catalogState).toEqual({
      taxes: { loading: false, error: null, loaded: true },
      fees: { loading: false, error: null, loaded: true }
    })
    expect(controllerProps.taxes).toEqual({ 'id:1': tax })
    expect(controllerProps.fees).toEqual({ 'id:2': fee })

    pending = true
    await act(async () => {
      root.render(<BusinessProductsListing ordering={{ root: 'https://api.changed' }} UIComponent={UIComponent} />)
    })

    expect(controllerProps.catalogState).toEqual({
      taxes: { loading: true, error: null, loaded: false },
      fees: { loading: true, error: null, loaded: false }
    })
    expect(controllerProps.taxes).toEqual({})
    expect(controllerProps.fees).toEqual({})
    expect(fetch).toHaveBeenCalledWith('https://api.changed/taxes', expect.objectContaining({
      signal: expect.any(AbortSignal)
    }))
    expect(fetch).toHaveBeenCalledWith('https://api.changed/fees?where={"type":"product"}', expect.objectContaining({
      signal: expect.any(AbortSignal)
    }))
    expect(newSignals).toHaveLength(2)
    act(() => root.unmount())
    root = null
    expect(newSignals.every(signal => signal.aborted)).toBe(true)
  })
})

describe('BusinessProductsListing', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('defers the initial product fetch until the business is loaded when requested', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
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
      ok: true,
      status: 200,
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
      ok: true,
      status: 200,
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
      ok: true,
      status: 200,
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
      ok: true,
      status: 200,
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
      ok: true,
      status: 200,
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
