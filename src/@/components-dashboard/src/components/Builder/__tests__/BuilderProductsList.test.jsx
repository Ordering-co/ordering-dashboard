import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({
  listBuilderProducts: vi.fn(),
  getBuilderCatalog: vi.fn(),
  createBuilderProduct: vi.fn()
}))

vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'http://api/v400/en/development' }] }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok' }] }))
vi.mock('../builderApi', async () => {
  const actual = await vi.importActual('../builderApi')
  return {
    ...actual,
    listBuilderProducts: (...args) => api.listBuilderProducts(...args),
    getBuilderCatalog: (...args) => api.getBuilderCatalog(...args),
    createBuilderProduct: (...args) => api.createBuilderProduct(...args)
  }
})

import { BuilderProductsList } from '../BuilderProductsList'
import { BUILDER_PRODUCT_TYPES } from '../builderApi'

const ok = (result, pagination) => ({ error: false, status: 200, result, errorCodes: [], pagination })
const fail = (status, errorCodes) => ({ error: true, status, result: ['x'], errorCodes })

const renderController = () => {
  const ui = { current: null }
  const UIComponent = (props) => { ui.current = props; return null }
  render(<BuilderProductsList UIComponent={UIComponent} />)
  return ui
}

describe('BuilderProductsList controller', () => {
  beforeEach(() => {
    api.listBuilderProducts.mockReset().mockResolvedValue(ok([{ id: 41 }], { current_page: 1, total_pages: 3, total: 21 }))
    api.getBuilderCatalog.mockReset().mockResolvedValue(ok([{ id: 14, product_type: 'driver_app' }]))
    api.createBuilderProduct.mockReset()
  })

  it('loads the first page of apps and websites, and the catalog', async () => {
    const ui = renderController()
    await waitFor(() => expect(ui.current.productsState.loading).toBe(false))
    expect(api.listBuilderProducts).toHaveBeenCalledWith(expect.anything(), 'tok', {
      page: 1, pageSize: 10, search: '', productTypes: BUILDER_PRODUCT_TYPES, productStatuses: null
    })
    expect(ui.current.productsState.products).toEqual([{ id: 41 }])
    expect(ui.current.pagination).toEqual({ currentPage: 1, pageSize: 10, totalPages: 3, total: 21 })
    await waitFor(() => expect(ui.current.catalogState.canCreate).toBe(true))
  })

  it('goes back to page 1 with the new filter', async () => {
    const ui = renderController()
    await waitFor(() => expect(ui.current.productsState.loading).toBe(false))
    await act(async () => { ui.current.handleChangePage(3) })
    await act(async () => { ui.current.handleChangeType(['driver_app']) })
    await act(async () => { ui.current.handleChangeStatus('draft') })
    expect(api.listBuilderProducts).toHaveBeenLastCalledWith(expect.anything(), 'tok', {
      page: 1, pageSize: 10, search: '', productTypes: ['driver_app'], productStatuses: ['draft']
    })
    expect(ui.current.filters).toEqual({ search: '', productTypes: ['driver_app'], productStatus: 'draft' })
  })

  it('keeps only the answer to the latest request', async () => {
    let resolveSlow
    const ui = renderController()
    await waitFor(() => expect(ui.current.productsState.loading).toBe(false))
    api.listBuilderProducts
      .mockImplementationOnce(() => new Promise(resolve => { resolveSlow = resolve }))
      .mockResolvedValueOnce(ok([{ id: 2, name: 'Repartidores' }], { current_page: 1, total_pages: 1, total: 1 }))
    await act(async () => { ui.current.handleChangeSearch('r') })
    await act(async () => { ui.current.handleChangeSearch('rep') })
    await act(async () => { resolveSlow(ok([{ id: 1, name: 'Old' }], { current_page: 1, total_pages: 1, total: 1 })) })
    expect(ui.current.productsState.products).toEqual([{ id: 2, name: 'Repartidores' }])
  })

  it.each([
    ['answers 404', () => fail(404, []), 'not_enabled'],
    ['comes back empty', () => ok([]), 'empty'],
    ['fails', () => fail(500, []), 'error']
  ])('offers no Create and says why when the catalog %s', async (_case, response, reason) => {
    api.getBuilderCatalog.mockResolvedValueOnce(response())
    const ui = renderController()
    await waitFor(() => expect(ui.current.catalogState.loading).toBe(false))
    expect(ui.current.catalogState.canCreate).toBe(false)
    expect(ui.current.catalogState.unavailableReason).toBe(reason)
  })

  it('reloads the catalog on request', async () => {
    api.getBuilderCatalog.mockResolvedValueOnce(fail(500, []))
    const ui = renderController()
    await waitFor(() => expect(ui.current.catalogState.unavailableReason).toBe('error'))
    await act(async () => { await ui.current.reloadCatalog() })
    expect(ui.current.catalogState).toMatchObject({ canCreate: true, unavailableReason: null })
  })

  it('reports the module turned off', async () => {
    api.listBuilderProducts.mockResolvedValueOnce(fail(403, ['builder.disabled']))
    const ui = renderController()
    await waitFor(() => expect(ui.current.productsState.loading).toBe(false))
    expect(ui.current.productsState.errorKind).toBe('disabled')
  })

  it('creates a product and returns it', async () => {
    api.createBuilderProduct.mockResolvedValueOnce(ok({ id: 99 }))
    const ui = renderController()
    await waitFor(() => expect(ui.current.productsState.loading).toBe(false))
    let result
    await act(async () => { result = await ui.current.createProduct({ builderBaseId: 14, name: ' Repartidores ' }) })
    expect(api.createBuilderProduct).toHaveBeenCalledWith(expect.anything(), 'tok', { builderBaseId: 14, name: 'Repartidores' })
    expect(result).toEqual({ product: { id: 99 }, errorCodes: [] })
  })

  it('reloads the catalog when the chosen base was withdrawn', async () => {
    api.createBuilderProduct.mockResolvedValueOnce(fail(400, ['builder_base.not_offered']))
    const ui = renderController()
    await waitFor(() => expect(ui.current.catalogState.loading).toBe(false))
    let result
    await act(async () => { result = await ui.current.createProduct({ builderBaseId: 14, name: 'X' }) })
    expect(result).toEqual({ product: null, errorCodes: ['builder_base.not_offered'] })
    expect(ui.current.createState.errorCodes).toEqual(['builder_base.not_offered'])
    expect(api.getBuilderCatalog).toHaveBeenCalledTimes(2)
  })
})
