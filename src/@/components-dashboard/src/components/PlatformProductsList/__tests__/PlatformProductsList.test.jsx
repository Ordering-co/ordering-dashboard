/* eslint-disable import/first */
// redesign GC-A: the platform products list exposes `reload`, its three handleSuccess* never overwrite each other
// (functional state) and a failed load keeps the API / thrown error with `loading: false`.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))

import { PlatformProductsList } from '../index'

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
const UI = (p) => {
  ui = p
  return null
}

beforeEach(() => {
  mocks.fetch.mockReset()
  globalThis.fetch = mocks.fetch
})

describe('PlatformProductsList controller', () => {
  it('starts loading and lands on the products', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: [{ id: 1 }] }))
    render(<PlatformProductsList UIComponent={UI} />)
    expect(ui.platformProductsListState.loading).toBe(true)
    await waitFor(() => expect(ui.platformProductsListState.loading).toBe(false))
    expect(ui.platformProductsListState.products).toEqual([{ id: 1 }])
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/platform_products?mode=dashboard', expect.objectContaining({ method: 'GET' }))
  })

  it('reload asks again for the dashboard products', async () => {
    mocks.fetch.mockImplementationOnce(() => json({ error: true, result: ['Boom'] }))
    render(<PlatformProductsList UIComponent={UI} />)
    await waitFor(() => expect(ui.platformProductsListState.error).toEqual(['Boom']))
    expect(typeof ui.reload).toBe('function')
    mocks.fetch.mockImplementation(() => json({ error: false, result: [{ id: 7 }] }))
    await act(async () => { await ui.reload() })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.fetch.mock.calls[1][0]).toBe('https://api.test/platform_products?mode=dashboard')
    expect(ui.platformProductsListState.error).toBe(null)
    expect(ui.platformProductsListState.products).toEqual([{ id: 7 }])
  })

  it('adding and then deleting in the same tick leaves the right list', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: [{ id: 1 }, { id: 2 }] }))
    render(<PlatformProductsList UIComponent={UI} />)
    await waitFor(() => expect(ui.platformProductsListState.loading).toBe(false))
    act(() => {
      ui.handleSuccessAddProduct({ id: 3 })
      ui.handleSuccessDeleteProduct(1)
    })
    expect(ui.platformProductsListState.products).toEqual([{ id: 2 }, { id: 3 }])
  })

  it('updating and then adding in the same tick keeps both', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: [{ id: 1, name: 'a' }] }))
    render(<PlatformProductsList UIComponent={UI} />)
    await waitFor(() => expect(ui.platformProductsListState.loading).toBe(false))
    act(() => {
      ui.handleSuccessUpdateProduct({ id: 1, name: 'b' })
      ui.handleSuccessAddProduct({ id: 2, name: 'c' })
    })
    expect(ui.platformProductsListState.products).toEqual([{ id: 1, name: 'b' }, { id: 2, name: 'c' }])
  })

  it('keeps the API error as `result` with an empty list and no loading', async () => {
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Not allowed'] }))
    render(<PlatformProductsList UIComponent={UI} />)
    await waitFor(() => expect(ui.platformProductsListState.loading).toBe(false))
    expect(ui.platformProductsListState.error).toEqual(['Not allowed'])
    expect(ui.platformProductsListState.products).toEqual([])
  })

  it('keeps a thrown error as `[message]` and stops loading', async () => {
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('Network down')))
    render(<PlatformProductsList UIComponent={UI} />)
    await waitFor(() => expect(ui.platformProductsListState.loading).toBe(false))
    expect(ui.platformProductsListState.error).toEqual(['Network down'])
  })
})
