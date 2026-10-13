import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BUILDER_PRODUCT_TYPES,
  buildProductsWhere,
  createBuilderProduct,
  getBuilderBaseUrl,
  getBuilderCatalog,
  getBuilderErrorKind,
  getBuilderProduct,
  listBuilderProducts,
  updateBuilderProductStatus
} from '../builderApi'

const ordering = { root: 'http://localhost:8080/v400/en/development', appInternalName: 'dashboard' }

const respond = (body, { ok = true, status = 200 } = {}) => {
  global.fetch = vi.fn(async () => ({ ok, status, json: async () => body }))
}

const lastCall = () => {
  const [url, options] = global.fetch.mock.calls.at(-1)
  return { url: new URL(url), options }
}

describe('builderApi', () => {
  const originalFetch = global.fetch

  beforeEach(() => respond({ error: false, result: [] }))
  afterEach(() => { global.fetch = originalFetch })

  it('uses the backoffice internal name of the project', () => {
    expect(getBuilderBaseUrl(ordering)).toBe('http://localhost:8080/v400/en/development/dashboard/builder')
    expect(getBuilderBaseUrl({ root: 'https://api.test/v400/en/p' })).toBe('https://api.test/v400/en/p/dashboard/builder')
  })

  it('builds the where list: name ilike plus type and status IN lists', () => {
    expect(buildProductsWhere({ search: '  Drivers ', productTypes: ['driver_app'], productStatuses: ['draft', 'active'] })).toEqual([
      { attribute: 'name', value: { condition: 'ilike', value: '%Drivers%' } },
      { attribute: 'product_type', value: ['driver_app'] },
      { attribute: 'product_status', value: ['draft', 'active'] }
    ])
  })

  it('leaves out an empty search and an empty status list, and lists apps and websites by default', () => {
    expect(buildProductsWhere({ search: '   ' })).toEqual([
      { attribute: 'product_type', value: BUILDER_PRODUCT_TYPES }
    ])
  })

  it('lists products with page, a capped page size and where, never the old loose filters', async () => {
    await listBuilderProducts(ordering, 'tok', { page: 2, pageSize: 200, search: 'rep', productStatuses: ['draft'] })
    const { url, options } = lastCall()
    expect(url.pathname).toBe('/v400/en/development/dashboard/builder/products')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('page_size')).toBe('50')
    expect(url.searchParams.has('product_type')).toBe(false)
    expect(url.searchParams.has('product_status')).toBe(false)
    expect(JSON.parse(url.searchParams.get('where'))).toEqual([
      { attribute: 'name', value: { condition: 'ilike', value: '%rep%' } },
      { attribute: 'product_type', value: BUILDER_PRODUCT_TYPES },
      { attribute: 'product_status', value: ['draft'] }
    ])
    expect(options.headers.Authorization).toBe('Bearer tok')
  })

  it('reads the catalog of apps and websites, and one product', async () => {
    await getBuilderCatalog(ordering, 'tok')
    expect(lastCall().url.pathname).toBe('/v400/en/development/dashboard/builder/catalog')
    expect(lastCall().url.searchParams.get('kind')).toBe('app,web')
    await getBuilderProduct(ordering, 'tok', 41)
    expect(lastCall().url.pathname).toBe('/v400/en/development/dashboard/builder/products/41')
  })

  it('creates a product with the base id and the name', async () => {
    respond({ error: false, result: { id: 41 } })
    const response = await createBuilderProduct(ordering, 'tok', { builderBaseId: 14, name: 'Repartidores' })
    const { options } = lastCall()
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ builder_base_id: 14, name: 'Repartidores' })
    expect(response).toMatchObject({ error: false, result: { id: 41 }, errorCodes: [] })
  })

  it('creates a website with its type and the name, without a base', async () => {
    respond({ error: false, result: { id: 42, kind: 'web' } })
    await createBuilderProduct(ordering, 'tok', { productType: 'dashboard', name: 'Ops' })
    expect(JSON.parse(lastCall().options.body)).toEqual({ product_type: 'dashboard', name: 'Ops' })
  })

  it('changes the status of a product', async () => {
    respond({ error: false, result: { id: 41, product_status: 'active', checks: [] } })
    const response = await updateBuilderProductStatus(ordering, 'tok', 41, 'active')
    const { url, options } = lastCall()
    expect(url.pathname).toBe('/v400/en/development/dashboard/builder/products/41/status')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({ product_status: 'active' })
    expect(response.result).toMatchObject({ id: 41, product_status: 'active' })
  })

  it('returns the error codes of a failed response', async () => {
    respond({ error: true, result: ['The base is not offered.'], error_codes: ['builder_base.not_offered'] }, { ok: false, status: 400 })
    const response = await createBuilderProduct(ordering, 'tok', { builderBaseId: 1, name: 'X' })
    expect(response).toMatchObject({ error: true, status: 400, errorCodes: ['builder_base.not_offered'] })
  })

  it('turns a network failure into an error', async () => {
    global.fetch = vi.fn(async () => { throw new Error('offline') })
    const response = await getBuilderCatalog(ordering, 'tok')
    expect(response).toMatchObject({ error: true, status: 0, result: ['offline'], errorCodes: [] })
  })

  it('classifies failed responses by error code', () => {
    expect(getBuilderErrorKind({ error: false })).toBe(null)
    expect(getBuilderErrorKind({ error: true, status: 403, errorCodes: ['builder.disabled'] })).toBe('disabled')
    expect(getBuilderErrorKind({ error: true, status: 403, errorCodes: ['auth:00'] })).toBe('no_access')
    expect(getBuilderErrorKind({ error: true, status: 404, errorCodes: ['product.not_found'] })).toBe('not_found')
    expect(getBuilderErrorKind({ error: true, status: 500, errorCodes: [] })).toBe('error')
  })
})
