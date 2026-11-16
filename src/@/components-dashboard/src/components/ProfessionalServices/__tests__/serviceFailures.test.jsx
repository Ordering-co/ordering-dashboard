/* eslint-disable import/first */
// a professional's service that fails to save (untick = DELETE, tick = POST) keeps its error in actionState (the UI's
// Alert shows it, as in main: no second notice) and the check box goes back to what is stored. The success path is untouched.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  hideToast: vi.fn(),
  fetch: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const business = {
    id: 7,
    categories: [{ id: 1, name: 'Hair', products: [{ id: 1, name: 'Cut' }, { id: 2, name: 'Dye' }], subcategories: [] }]
  }
  const ordering = {
    root: 'https://api.test',
    businesses: () => ({
      asDashboard: () => ({
        select: () => ({ get: async () => ({ content: { error: false, result: business } }) })
      })
    })
  }
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast, hideToast: mocks.hideToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))

import { ProfessionalServices } from '../index'

// the network error is not shown raw («Failed to fetch»): it reads the same generic notice as other save failures (tanda O, )
const GENERIC_FAILURE = "We couldn't save the change."

const STORED = [{ id: 50, product_id: 1, product: { id: 1, name: 'Cut' } }]

let ui
let handleUpdateServices
const draw = (services) => {
  ui = null
  handleUpdateServices = vi.fn()
  const UI = (props) => {
    ui = props
    return null
  }
  return render(
    <ProfessionalServices
      UIComponent={UI}
      businessId={7}
      userId={3}
      services={services}
      handleUpdateServices={handleUpdateServices}
    />
  )
}
const ready = () => waitFor(() => {
  expect(ui.businessState.loading).toBe(false)
  expect(ui.subCategoriesList.length).toBe(1)
})
const answer = (content) => mocks.fetch.mockResolvedValue({ json: async () => content })
const errorToasts = () => mocks.showToast.mock.calls.filter(([type]) => type === 'error')

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.hideToast.mockReset()
  mocks.fetch.mockReset()
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProfessionalServices controller · failed saves', () => {
  it('DELETE answered with an API error: the error reaches the UI, no error toast, and the product is ticked again', async () => {
    const services = STORED
    draw(services)
    await ready()
    expect(ui.selectedProductsIds).toEqual([1])
    // the UI unticks it at once
    act(() => { ui.setSelectedProductsIds([]) })
    expect(ui.selectedProductsIds).toEqual([])
    answer({ error: true, result: ['Nope'] })
    await act(async () => { ui.handleDeleteService(1) })
    await waitFor(() => expect(ui.actionState.result).toEqual({ error: true, result: ['Nope'] }))
    expect(errorToasts()).toEqual([])
    // the «Loading» toast raised on submit does not stay up after the failure
    expect(mocks.hideToast).toHaveBeenCalled()
    await waitFor(() => expect(ui.selectedProductsIds).toEqual([1]))
    expect(ui.selectedProducts).toEqual([services[0].product])
    expect(ui.subCategoriesList[0].isChecked).toBe(false) // only product 1 of 2 is stored
    expect(ui.subCategoriesList[0].productIds).toEqual([1, 2])
    expect(mocks.fetch.mock.calls[0][1].method).toBe('DELETE')
    expect(handleUpdateServices).not.toHaveBeenCalled()
  })

  it('DELETE with a network failure: the error reaches the UI, no error toast, and the product is ticked again', async () => {
    draw(STORED)
    await ready()
    act(() => { ui.setSelectedProductsIds([]) })
    mocks.fetch.mockRejectedValue(new Error('Failed to fetch'))
    await act(async () => { ui.handleDeleteService(1) })
    await waitFor(() => expect(ui.actionState.result).toEqual({ error: true, result: [GENERIC_FAILURE] }))
    expect(errorToasts()).toEqual([])
    // the «Loading» toast raised on submit does not stay up after the failure
    expect(mocks.hideToast).toHaveBeenCalled()
    await waitFor(() => expect(ui.selectedProductsIds).toEqual([1]))
    expect(handleUpdateServices).not.toHaveBeenCalled()
  })

  it('POST answered with an API error: the error reaches the UI, no error toast, and the product is unticked again', async () => {
    draw([])
    await ready()
    expect(ui.selectedProductsIds).toEqual([])
    act(() => { ui.setSelectedProductsIds([2]) })
    expect(ui.selectedProductsIds).toEqual([2])
    answer({ error: true, result: ['Nope'] })
    await act(async () => { ui.handleCreateService(2) })
    await waitFor(() => expect(ui.actionState.result).toEqual({ error: true, result: ['Nope'] }))
    expect(errorToasts()).toEqual([])
    // the «Loading» toast raised on submit does not stay up after the failure
    expect(mocks.hideToast).toHaveBeenCalled()
    await waitFor(() => expect(ui.selectedProductsIds).toEqual([]))
    expect(ui.selectedProducts).toEqual([])
    expect(mocks.fetch.mock.calls[0][1].method).toBe('POST')
    expect(handleUpdateServices).not.toHaveBeenCalled()
  })

  it('POST with a network failure: the error reaches the UI, no error toast, and the product is unticked again', async () => {
    draw([])
    await ready()
    act(() => { ui.setSelectedProductsIds([2]) })
    mocks.fetch.mockRejectedValue(new Error('Failed to fetch'))
    await act(async () => { ui.handleCreateService(2) })
    await waitFor(() => expect(ui.actionState.result).toEqual({ error: true, result: [GENERIC_FAILURE] }))
    expect(errorToasts()).toEqual([])
    // the «Loading» toast raised on submit does not stay up after the failure
    expect(mocks.hideToast).toHaveBeenCalled()
    await waitFor(() => expect(ui.selectedProductsIds).toEqual([]))
  })

  it('success is unchanged: DELETE updates the services and says so, no error toast', async () => {
    draw(STORED)
    await ready()
    answer({ error: false, result: {} })
    await act(async () => { ui.handleDeleteService(1) })
    await waitFor(() => expect(handleUpdateServices).toHaveBeenCalledWith([]))
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Service deleted')
    expect(mocks.hideToast).not.toHaveBeenCalled()
    expect(errorToasts()).toEqual([])
  })

  it('success is unchanged: POST adds the service and says so, no error toast', async () => {
    draw(STORED)
    await ready()
    const created = { id: 51, product_id: 2, product: { id: 2, name: 'Dye' } }
    answer({ error: false, result: created })
    await act(async () => { ui.handleCreateService(2) })
    await waitFor(() => expect(handleUpdateServices).toHaveBeenCalledWith([...STORED, created]))
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Service added')
    expect(mocks.hideToast).not.toHaveBeenCalled()
    expect(errorToasts()).toEqual([])
  })
})
