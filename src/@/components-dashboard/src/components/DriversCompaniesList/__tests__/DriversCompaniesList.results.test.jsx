/* eslint-disable import/first */
// redesign DC-B1 (M-DC2, M-DC3): the DriversCompaniesList controller tells its UI how a save/delete went (`{ ok: true }` or
// `{ ok: false, error }`), says when the load failed (before, the list stayed loading forever), exposes
// `reloadDriversCompanies()` for «Retry», and gives a saved company as a new object (the row's switch is controlled).
// The requests, the toasts and `actionState` stay as they were.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), showToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0, id: 1 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { DriversCompaniesList } from '../index'

const companies = () => ([
  { id: 1, name: 'Fast Couriers', enabled: true, priority: 0 },
  { id: 2, name: 'Bike Riders', enabled: true, priority: 1 }
])
const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
const draw = () => {
  ui = null
  const UI = (p) => {
    ui = p
    return null
  }
  return render(<DriversCompaniesList UIComponent={UI} />)
}

const listCalls = () => mocks.fetch.mock.calls.filter(([url, options]) => url === 'https://api.test/driver_companies' && options?.method === 'GET')

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.showToast.mockReset()
  mocks.fetch.mockImplementation((url, options) => {
    if (url === 'https://api.test/driver_companies' && options?.method === 'GET') return json({ error: false, result: companies() })
    if (options?.method === 'POST') return json({ error: false, result: { id: 1, name: 'Fast Couriers', enabled: false, priority: 0 } })
    if (options?.method === 'DELETE') return json({ error: false, result: {} })
    return json({ error: false, result: [] })
  })
  globalThis.fetch = mocks.fetch
})

describe('DriversCompaniesList controller · the load', () => {
  it('loads the companies once on mount, as main', async () => {
    draw()
    await waitFor(() => expect(ui.driversCompaniesState.companies).toHaveLength(2))
    expect(ui.driversCompaniesState.loading).toBe(false)
    expect(listCalls()).toHaveLength(1)
  })

  it('stops loading and keeps the error when the API refuses (M-DC3)', async () => {
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Session expired'] }))
    draw()
    await waitFor(() => expect(ui.driversCompaniesState.loading).toBe(false))
    expect(ui.driversCompaniesState.error).toEqual(['Session expired'])
    expect(ui.driversCompaniesState.companies).toEqual([])
  })

  it('stops loading and keeps the error when the request throws', async () => {
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('Network down')))
    draw()
    await waitFor(() => expect(ui.driversCompaniesState.loading).toBe(false))
    expect(ui.driversCompaniesState.error).toEqual(['Network down'])
  })

  it('reloadDriversCompanies asks again and clears the previous error', async () => {
    mocks.fetch.mockImplementationOnce(() => json({ error: true, result: ['Try later'] }))
    draw()
    await waitFor(() => expect(ui.driversCompaniesState.error).toEqual(['Try later']))
    await act(async () => { await ui.reloadDriversCompanies() })
    await waitFor(() => expect(ui.driversCompaniesState.companies).toHaveLength(2))
    expect(ui.driversCompaniesState.error).toBeNull()
    expect(listCalls()).toHaveLength(2)
  })
})

describe('DriversCompaniesList controller · handleUpdateDriversCompany returns how the save went', () => {
  it('returns { ok: true }, keeps the request and the toasts, and replaces the row with a new object', async () => {
    draw()
    await waitFor(() => expect(ui.driversCompaniesState.companies).toHaveLength(2))
    const before = ui.driversCompaniesState.companies[0]
    let result
    await act(async () => { result = await ui.handleUpdateDriversCompany(1, { enabled: false }) })
    expect(result).toEqual({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/driver_companies/1', expect.objectContaining({ method: 'POST', body: JSON.stringify({ enabled: false }) }))
    const after = ui.driversCompaniesState.companies[0]
    expect(after.enabled).toBe(false)
    expect(after).not.toBe(before)
    expect(before.enabled).toBe(true)
    expect(ui.actionState).toEqual({ loading: false, error: null })
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'success'])
  })

  it('returns { ok: false, error } and writes actionState when the API refuses', async () => {
    draw()
    await waitFor(() => expect(ui.driversCompaniesState.companies).toHaveLength(2))
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Not allowed'] }))
    let result
    await act(async () => { result = await ui.handleUpdateDriversCompany(1, { enabled: false }) })
    expect(result).toEqual({ ok: false, error: ['Not allowed'] })
    expect(ui.actionState.error).toEqual(['Not allowed'])
    expect(ui.driversCompaniesState.companies[0].enabled).toBe(true)
  })

  it('returns { ok: false, error } when the request throws', async () => {
    draw()
    await waitFor(() => expect(ui.driversCompaniesState.companies).toHaveLength(2))
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('Offline')))
    let result
    await act(async () => { result = await ui.handleUpdateDriversCompany(1, { enabled: false }) })
    expect(result).toEqual({ ok: false, error: ['Offline'] })
  })
})

describe('DriversCompaniesList controller · handleDeleteDriversCompany returns how the delete went', () => {
  it('returns { ok: true } and takes the company off the list', async () => {
    draw()
    await waitFor(() => expect(ui.driversCompaniesState.companies).toHaveLength(2))
    let result
    await act(async () => { result = await ui.handleDeleteDriversCompany(2) })
    expect(result).toEqual({ ok: true })
    expect(ui.driversCompaniesState.companies.map(c => c.id)).toEqual([1])
  })

  it('returns { ok: false, error } when the API refuses', async () => {
    draw()
    await waitFor(() => expect(ui.driversCompaniesState.companies).toHaveLength(2))
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['In use'] }))
    let result
    await act(async () => { result = await ui.handleDeleteDriversCompany(2) })
    expect(result).toEqual({ ok: false, error: ['In use'] })
    expect(ui.driversCompaniesState.companies).toHaveLength(2)
  })

  it('deletes the selected companies one after the other, as main', async () => {
    draw()
    await waitFor(() => expect(ui.driversCompaniesState.companies).toHaveLength(2))
    act(() => ui.handleSelectCompany(1))
    act(() => ui.handleSelectCompany(2))
    act(() => ui.handleDeleteSelectedCompanies())
    await waitFor(() => expect(ui.driversCompaniesState.companies).toHaveLength(0))
    expect(ui.selectedCompanyList).toEqual([])
    const deletes = mocks.fetch.mock.calls.filter(([, options]) => options?.method === 'DELETE').map(([url]) => url)
    expect(deletes).toEqual(['https://api.test/driver_companies/1', 'https://api.test/driver_companies/2'])
  })
})
