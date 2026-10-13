import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({
  getBuilderProduct: vi.fn(),
  updateBuilderProductStatus: vi.fn()
}))

vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'http://api/v400/en/development' }] }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok' }] }))
vi.mock('../builderApi', async () => {
  const actual = await vi.importActual('../builderApi')
  return {
    ...actual,
    getBuilderProduct: (...args) => api.getBuilderProduct(...args),
    updateBuilderProductStatus: (...args) => api.updateBuilderProductStatus(...args)
  }
})

import { BuilderProductDetail } from '../BuilderProductDetail'

const ok = (result) => ({ error: false, status: 200, result, errorCodes: [] })
const fail = (status, errorCodes) => ({ error: true, status, result: ['x'], errorCodes })
const product = { id: 41, name: 'Repartidores', product_status: 'draft', apps: [{ id: 310 }] }

const renderController = async () => {
  const ui = { current: null }
  const UIComponent = (props) => { ui.current = props; return null }
  render(<BuilderProductDetail UIComponent={UIComponent} productId='41' />)
  await waitFor(() => expect(ui.current.productState.loading).toBe(false))
  return ui
}

describe('BuilderProductDetail controller', () => {
  beforeEach(() => {
    api.getBuilderProduct.mockReset().mockResolvedValue(ok(product))
    api.updateBuilderProductStatus.mockReset()
  })

  it('changes the status and keeps the app, without the activation checks', async () => {
    api.updateBuilderProductStatus.mockResolvedValueOnce(ok({ id: 41, name: 'Repartidores', product_status: 'active', checks: [{ app_id: 310, errors: 0, warnings: 2 }] }))
    const ui = await renderController()
    let result
    await act(async () => { result = await ui.current.changeStatus('active') })
    expect(api.updateBuilderProductStatus).toHaveBeenCalledWith(expect.anything(), 'tok', '41', 'active')
    expect(result).toEqual({ product: { ...product, product_status: 'active' }, errorKind: null, checks: null })
    expect(ui.current.productState.product).toEqual({ ...product, product_status: 'active' })
    expect(ui.current.statusState).toEqual({ loading: false, nextStatus: null })
  })

  it('keeps the page and reports a plain failure', async () => {
    api.updateBuilderProductStatus.mockResolvedValueOnce(fail(400, ['product_status.in']))
    const ui = await renderController()
    let result
    await act(async () => { result = await ui.current.changeStatus('archived') })
    expect(result).toEqual({ product: null, errorKind: 'error', checks: null })
    expect(ui.current.productState.product).toEqual(product)
  })

  it.each([
    [404, ['product.not_found'], 'not_found'],
    [403, ['builder.disabled'], 'disabled']
  ])('replaces the page when the change answers %s', async (status, codes, kind) => {
    api.updateBuilderProductStatus.mockResolvedValueOnce(fail(status, codes))
    const ui = await renderController()
    await act(async () => { await ui.current.changeStatus('active') })
    expect(ui.current.productState).toEqual({ loading: false, product: null, errorKind: kind })
  })
})
