/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: [{ token: 'test-token', user: { id: 7, level: 0 } }]
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => mocks.session
}))
vi.mock('../../../contexts/ApiContext', () => {
  const emptyResponse = async () => ({ content: { error: false, result: [], pagination: { total: 0, current_page: 1, page_size: 10, total_pages: 0 } } })
  const chain = () => new Proxy(function () {}, {
    get: (target, prop) => {
      if (prop === 'then') return undefined
      if (prop === 'get') return emptyResponse
      return () => chain()
    },
    apply: () => chain()
  })
  const ordering = new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'root') return 'https://api.test/v400/en/demo'
      if (prop === 'project') return 'demo'
      if (prop === 'then') return undefined
      return () => chain()
    }
  })
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))

import { PosMenuBusinessList } from '../index'

let controller
const UI = (props) => {
  controller = props
  return null
}

const json = (body) => Promise.resolve({ json: async () => body })
const page = (number, totalPages, rows) => ({
  error: false,
  result: Array.from({ length: rows }, (_, i) => ({ id: number * 100 + i, name: `Store ${number}.${i}` })),
  pagination: { current_page: number, page_size: 10, total_pages: totalPages, total: totalPages * 10, from: 1, to: rows }
})

/**
 * Refresh reads again the page the user is on, and the integrations catalog.
 * It used to go back to page 1 and leave the catalog as it was, so a plugin
 * installed or disabled meanwhile did not show.
 */
describe('PosMenuBusinessList refresh', () => {
  let fetchMock
  let totalPages

  const requestedPages = () => fetchMock.mock.calls
    .map(([url]) => url)
    .filter(url => url.includes('/backoffice/businesses'))
    .map(url => Number(new URL(url).searchParams.get('page')))
  const catalogReads = () => fetchMock.mock.calls.filter(([url]) => url.endsWith('/third_party_integrations')).length

  beforeEach(() => {
    controller = null
    totalPages = 3
    fetchMock = vi.fn((url) => {
      if (url.includes('/backoffice/businesses')) {
        const requested = Number(new URL(url).searchParams.get('page'))
        return json(page(requested, totalPages, requested <= totalPages ? 10 : 0))
      }
      if (url.endsWith('/third_party_integrations')) return json({ error: false, result: [] })
      return json({ error: false, result: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const onPage = async (number) => {
    render(<PosMenuBusinessList UIComponent={UI} integrationType='pos' />)
    await waitFor(() => expect(controller.pagination.currentPage).toBe(1))
    await act(async () => { await controller.getPageBusinesses(10, number) })
    expect(controller.pagination.currentPage).toBe(number)
    fetchMock.mockClear()
  }

  it('keeps the page the user is on and reads the catalog again', async () => {
    await onPage(3)

    await act(async () => { await controller.refreshBusinesses() })

    expect(requestedPages()).toEqual([3])
    expect(controller.pagination.currentPage).toBe(3)
    expect(catalogReads()).toBe(1)
  })

  it('goes to the last page when the one it was on no longer exists', async () => {
    await onPage(3)
    totalPages = 2

    await act(async () => { await controller.refreshBusinesses() })

    expect(requestedPages()).toEqual([3, 2])
    expect(controller.pagination.currentPage).toBe(2)
    expect(controller.businessList.businesses).toHaveLength(10)
  })
})
