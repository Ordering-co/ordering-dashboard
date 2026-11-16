/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  usersByLevel: {},
  companies: null,
  ordering: null
}))

vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [mocks.ordering]
}))
vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'token', user: { id: 1, level: 0 } }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Error: 'error', Success: 'success', Info: 'info' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { DriversGroupsList } from '..'

const deferred = () => {
  const handle = {}
  handle.promise = new Promise(resolve => { handle.resolve = resolve })
  return handle
}

const buildOrdering = () => ({
  root: 'https://api.test',
  setAccessToken: () => ({
    users: () => ({
      where: ([condition]) => ({
        select: () => ({
          get: () => mocks.usersByLevel[condition.value].promise
        })
      })
    })
  })
})

const jsonResponse = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

const emptyPage = { result: [], error: false, pagination: { current_page: 1, total_pages: 1, page_size: 10, total: 0 } }

const renderController = () => {
  const latest = {}
  const UIComponent = (props) => {
    latest.props = props
    return null
  }
  render(<DriversGroupsList UIComponent={UIComponent} isDriversMangersRequired />)
  return latest
}

describe('DriversGroupsList drivers, driver managers and companies', () => {
  beforeEach(() => {
    mocks.usersByLevel = { 4: deferred(), 5: deferred() }
    mocks.companies = { result: [], error: false }
    mocks.ordering = buildOrdering()
    global.fetch = vi.fn((url) => {
      if (url.includes('/driver_companies')) return jsonResponse(mocks.companies)
      return jsonResponse(emptyPage)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps drivers and driver managers loading until their requests finish', async () => {
    const latest = renderController()

    await waitFor(() => {
      expect(latest.props.driversList.loading).toBe(true)
      expect(latest.props.driversManagersList.loading).toBe(true)
    })

    mocks.usersByLevel[4].resolve({ content: { error: false, result: [] } })
    mocks.usersByLevel[5].resolve({ content: { error: false, result: [] } })

    await waitFor(() => {
      expect(latest.props.driversList).toMatchObject({ loading: false, error: null, drivers: [] })
      expect(latest.props.driversManagersList).toMatchObject({ loading: false, error: null, managers: [] })
    })
  })

  it('reports a failed request as an error instead of an empty list', async () => {
    const latest = renderController()

    mocks.usersByLevel[4].resolve({ content: { error: true, result: ['Forbidden'] } })
    mocks.usersByLevel[5].resolve({ content: { error: true, result: ['Forbidden'] } })

    await waitFor(() => {
      expect(latest.props.driversList).toMatchObject({ loading: false, error: ['Forbidden'] })
      expect(latest.props.driversManagersList).toMatchObject({ loading: false, error: ['Forbidden'] })
    })
  })

  it('stops loading driver companies when their request fails', async () => {
    mocks.companies = { result: ['Forbidden'], error: true }
    const latest = renderController()

    await waitFor(() => {
      expect(latest.props.driversCompanyList).toMatchObject({ loading: false, error: ['Forbidden'], companies: [] })
    })
  })
})
