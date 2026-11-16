/* eslint-disable import/first */
// redesign DC-B1 (M-DC9, M-DC15): the DriversCompanyDetails controller tells its UI how a save, an add or a delete went
// (`{ ok: true }` or `{ ok: false, error }`); after a save its own copy of the company carries the result (the panel's header
// reads it); and on add the values chosen in the form win over the defaults (main sent `priority: '0'` whatever was chosen).
// The requests, the default schedule and fields, the toasts and `actionState` stay as they were.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), showToast: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0, id: 1 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', appId: 'app', appInternalName: 'dash' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { DriversCompanyDetails } from '../index'

const company = () => ({ id: 7, name: 'Fast Couriers', address: 'Main 1', timezone: 'UTC', priority: 0, limit: 10, enabled: true })
const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
const draw = (props = {}) => {
  ui = null
  const UI = (p) => {
    ui = p
    return null
  }
  return render(<DriversCompanyDetails UIComponent={UI} {...props} />)
}

const bodyOf = (method, url) => {
  const call = mocks.fetch.mock.calls.find(([u, options]) => options?.method === method && (!url || u === url))
  return call ? JSON.parse(call[1].body) : null
}

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.showToast.mockReset()
  mocks.fetch.mockImplementation((url, options) => {
    if (options?.method === 'GET') return json({ error: false, result: company() })
    if (options?.method === 'POST' && url === 'https://api.test/driver_companies') return json({ error: false, result: { id: 9, name: 'New one' } })
    if (options?.method === 'POST') return json({ error: false, result: { ...company(), ...JSON.parse(options.body) } })
    if (options?.method === 'DELETE') return json({ error: false, result: {} })
    return json({ error: false, result: {} })
  })
  globalThis.fetch = mocks.fetch
})

describe('DriversCompanyDetails controller · update', () => {
  it('returns { ok: true }, sends only the changes (schedule as a string, as main) and updates the list and its own copy', async () => {
    const list = { companies: [company(), { id: 8, name: 'Other' }] }
    const setList = vi.fn()
    draw({ driversCompany: company(), driversCompaniesState: list, setDriversCompaniesState: setList })
    await waitFor(() => expect(ui.companyState.company?.id).toBe(7))
    act(() => ui.handleChangesState('name', 'Faster Couriers'))
    act(() => ui.handleChangeScheduleState([{ enabled: true, lapses: [] }]))
    let result
    await act(async () => { result = await ui.handleUpdateDriversCompany() })
    expect(result).toEqual({ ok: true })
    expect(bodyOf('POST', 'https://api.test/driver_companies/7')).toEqual({ name: 'Faster Couriers', schedule: JSON.stringify([{ enabled: true, lapses: [] }]) })
    expect(ui.changesState).toEqual({})
    expect(ui.companyState.company.name).toBe('Faster Couriers')
    const next = setList.mock.calls.at(-1)[0]
    expect(next.companies.find(c => c.id === 7).name).toBe('Faster Couriers')
    expect(list.companies[0].name).toBe('Fast Couriers')
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'success'])
  })

  it('returns { ok: false, error } and keeps the changes when the API refuses', async () => {
    draw({ driversCompany: company(), driversCompaniesState: { companies: [company()] }, setDriversCompaniesState: vi.fn() })
    await waitFor(() => expect(ui.companyState.company?.id).toBe(7))
    act(() => ui.handleChangesState('limit', '5'))
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Invalid limit'] }))
    let result
    await act(async () => { result = await ui.handleUpdateDriversCompany() })
    expect(result).toEqual({ ok: false, error: ['Invalid limit'] })
    expect(ui.actionState.error).toEqual(['Invalid limit'])
    expect(ui.changesState).toEqual({ limit: '5' })
  })

  it('updates a company opened by id (no row) with its own id', async () => {
    draw({ driversCompanyId: 7, driversCompaniesState: { companies: [] }, setDriversCompaniesState: vi.fn() })
    await waitFor(() => expect(ui.companyState.company?.id).toBe(7))
    act(() => ui.handleChangesState('name', 'Renamed'))
    let result
    await act(async () => { result = await ui.handleUpdateDriversCompany() })
    expect(result).toEqual({ ok: true })
    expect(bodyOf('POST', 'https://api.test/driver_companies/7')).toEqual({ name: 'Renamed' })
  })
})

describe('DriversCompanyDetails controller · add', () => {
  it('returns { ok: true }, keeps the defaults of main and lets the chosen priority win (M-DC15)', async () => {
    const setList = vi.fn()
    const onClose = vi.fn()
    draw({ driversCompaniesState: { companies: [] }, setDriversCompaniesState: setList, onClose })
    act(() => ui.handleChangesState('name', 'New one'))
    act(() => ui.handleChangesState('priority', 2))
    let result
    await act(async () => { result = await ui.handleAddDriversCompany() })
    expect(result).toEqual({ ok: true })
    const body = bodyOf('POST', 'https://api.test/driver_companies')
    expect(body).toMatchObject({ name: 'New one', priority: 2, enabled: true, fixed_cost_per_km: 0, fixed_cost_delivery: 0, percentage_cost_per_order_subtotal: 0 })
    const schedule = JSON.parse(body.schedule)
    expect(schedule).toHaveLength(7)
    expect(schedule[0]).toEqual({ enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 45 } }] })
    expect(setList.mock.calls.at(-1)[0].companies).toEqual([{ id: 9, name: 'New one' }])
    expect(onClose).toHaveBeenCalled()
  })

  it('sends priority "0" when none was chosen, as main', async () => {
    draw({ driversCompaniesState: { companies: [] }, setDriversCompaniesState: vi.fn() })
    act(() => ui.handleChangesState('name', 'New one'))
    await act(async () => { await ui.handleAddDriversCompany() })
    expect(bodyOf('POST', 'https://api.test/driver_companies').priority).toBe('0')
  })

  it('returns { ok: false, error } and does not close when the API refuses', async () => {
    const onClose = vi.fn()
    draw({ driversCompaniesState: { companies: [] }, setDriversCompaniesState: vi.fn(), onClose })
    act(() => ui.handleChangesState('name', 'New one'))
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['The name is taken'] }))
    let result
    await act(async () => { result = await ui.handleAddDriversCompany() })
    expect(result).toEqual({ ok: false, error: ['The name is taken'] })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('DriversCompanyDetails controller · delete', () => {
  it('returns { ok: true }, takes the company off the list and closes', async () => {
    const setList = vi.fn()
    const onClose = vi.fn()
    draw({ driversCompany: company(), driversCompaniesState: { companies: [company()] }, setDriversCompaniesState: setList, onClose })
    await waitFor(() => expect(ui.companyState.company?.id).toBe(7))
    let result
    await act(async () => { result = await ui.handleDeleteDriversCompany() })
    expect(result).toEqual({ ok: true })
    expect(setList.mock.calls.at(-1)[0].companies).toEqual([])
    expect(onClose).toHaveBeenCalled()
  })

  it('deletes a company opened by id (no row) with its own id', async () => {
    draw({ driversCompanyId: 7, driversCompaniesState: { companies: [] }, setDriversCompaniesState: vi.fn(), onClose: vi.fn() })
    await waitFor(() => expect(ui.companyState.company?.id).toBe(7))
    let result
    await act(async () => { result = await ui.handleDeleteDriversCompany() })
    expect(result).toEqual({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/driver_companies/7', expect.objectContaining({ method: 'DELETE' }))
  })

  it('returns { ok: false, error } when the API refuses', async () => {
    const onClose = vi.fn()
    draw({ driversCompany: company(), driversCompaniesState: { companies: [company()] }, setDriversCompaniesState: vi.fn(), onClose })
    await waitFor(() => expect(ui.companyState.company?.id).toBe(7))
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['In use by a group'] }))
    let result
    await act(async () => { result = await ui.handleDeleteDriversCompany() })
    expect(result).toEqual({ ok: false, error: ['In use by a group'] })
    expect(onClose).not.toHaveBeenCalled()
  })
})
