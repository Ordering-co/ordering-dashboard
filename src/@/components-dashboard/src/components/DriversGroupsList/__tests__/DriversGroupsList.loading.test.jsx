/* eslint-disable import/first */
// redesign (AD-6): the lists the group panel picks from (drivers, managers, payment methods, driver companies) say
// when they are loading, so the panel can draw a skeleton instead of an empty list. main set `loading: false` when it started
// asking for drivers and managers, and left payment methods and companies loading forever when the API refused.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  users: { pending: [], answer: null }
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0, id: 1 } }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const chain = () => {
    const c = {
      where: () => c,
      select: () => c,
      asDashboard: () => c,
      // users() (drivers, managers): held until the test answers; businesses() answers at once
      get: () => {
        if (mocks.users.answer) return Promise.resolve(mocks.users.answer)
        return new Promise(resolve => mocks.users.pending.push(resolve))
      }
    }
    return c
  }
  const businesses = () => {
    const c = { where: () => c, select: () => c, asDashboard: () => c, get: async () => ({ content: { error: false, result: [] } }) }
    return c
  }
  const ordering = {
    root: 'https://api.test',
    setAccessToken: () => ({ users: chain, businesses })
  }
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { DriversGroupsList } from '../index'

const PAGINATION = { current_page: 1, total_pages: 1, total: 0, page_size: 10, from: 0, to: 0 }
const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
const draw = (props = {}) => {
  const UI = (p) => {
    ui = p
    return null
  }
  return render(<DriversGroupsList UIComponent={UI} paginationSettings={{ controlType: 'pages', initialPage: 1, pageSize: 10 }} {...props} />)
}

beforeEach(() => {
  ui = null
  mocks.users.pending = []
  mocks.users.answer = null
  mocks.fetch.mockReset()
  mocks.fetch.mockImplementation((url) => {
    if (url.includes('/drivergroups?')) return json({ error: false, result: [], pagination: PAGINATION })
    return json({ error: false, result: [] })
  })
  globalThis.fetch = mocks.fetch
})

describe('DriversGroupsList controller · loading of the lists the panel picks from', () => {
  it('says the drivers and the managers are loading until the API answers', async () => {
    draw({ isDriversMangersRequired: true })
    await waitFor(() => expect(mocks.users.pending).toHaveLength(2))
    expect(ui.driversList.loading).toBe(true)
    expect(ui.driversManagersList.loading).toBe(true)
    await act(async () => {
      mocks.users.pending.forEach(resolve => resolve({ content: { error: false, result: [{ id: 7, name: 'Ana' }] } }))
    })
    await waitFor(() => expect(ui.driversList.loading).toBe(false))
    expect(ui.driversList.drivers).toEqual([{ id: 7, name: 'Ana' }])
    expect(ui.driversManagersList.loading).toBe(false)
    expect(ui.driversManagersList.managers).toEqual([{ id: 7, name: 'Ana' }])
  })

  it('stops loading and keeps the error when the API refuses the drivers', async () => {
    mocks.users.answer = { content: { error: true, result: ['Not allowed'] } }
    draw()
    await waitFor(() => expect(ui.driversList.error).toEqual(['Not allowed']))
    expect(ui.driversList.loading).toBe(false)
    expect(ui.driversList.drivers).toEqual([])
  })

  it('stops loading payment methods and companies when the API refuses them', async () => {
    mocks.users.answer = { content: { error: false, result: [] } }
    mocks.fetch.mockImplementation((url) => {
      if (url.includes('/drivergroups?')) return json({ error: false, result: [], pagination: PAGINATION })
      if (url.includes('/paymethods') || url.includes('/driver_companies')) return json({ error: true, result: ['Nope'] })
      return json({ error: false, result: [] })
    })
    draw()
    await waitFor(() => expect(ui.paymethodsList.error).toEqual(['Nope']))
    expect(ui.paymethodsList.loading).toBe(false)
    await waitFor(() => expect(ui.driversCompanyList.error).toEqual(['Nope']))
    expect(ui.driversCompanyList.loading).toBe(false)
  })
})
