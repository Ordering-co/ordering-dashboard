/* eslint-disable import/first */
// the drivers and managers of a save go one by one
// (POST/DELETE drivergroups/{id}/drivers|administrators/{user_id}) against the saved group, and only the other fields
// go in the PUT, so two tabs saving the same group keep both changes. A change of temporary activation still needs the
// whole driver list.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  showToast: vi.fn(),
  setGroups: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0, id: 1 } }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const ordering = { root: 'https://api.test' }
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { DriversGroupDetails } from '../index'

const GROUP = { id: 3, name: 'North', enabled: true, type: 0, drivers: [{ id: 10 }, { id: 11 }], administrators: [{ id: 20 }] }
const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
const draw = (groupExtra = {}) => {
  const group = { ...GROUP, ...groupExtra }
  const UI = (p) => { ui = p; return null }
  return render(
    <DriversGroupDetails
      UIComponent={UI}
      curDriversGroup={group}
      driversGroupsState={{ groups: [group], loading: false, error: null }}
      setDriversGroupsState={mocks.setGroups}
      driversManagers={[]}
    />
  )
}

const writes = () => mocks.fetch.mock.calls
  .filter(([, options]) => options?.method && options.method !== 'GET')
  .map(([url, options]) => [options.method, url, options.body ? JSON.parse(options.body) : undefined])

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.showToast.mockReset()
  mocks.setGroups.mockReset()
  mocks.fetch.mockImplementation((url, options) => {
    if (options?.method && options.method !== 'GET') return json({ error: false, result: { ...GROUP, name: 'answer' } })
    return json({ error: false, result: [] })
  })
  globalThis.fetch = mocks.fetch
})

describe('DriversGroupDetails controller · per item drivers and managers', () => {
  it('sends the other fields in the PUT and each added or removed driver and manager on its own', async () => {
    draw()
    let result
    await act(async () => {
      result = await ui.handleUpdateDriversGroup({ name: 'South', drivers: JSON.stringify([11, 12]), administrators: JSON.stringify([20, 21]) })
    })
    expect(result).toEqual({ ok: true })
    expect(writes()).toEqual([
      ['PUT', 'https://api.test/drivergroups/3', { name: 'South' }],
      ['POST', 'https://api.test/drivergroups/3/drivers/12', undefined],
      ['DELETE', 'https://api.test/drivergroups/3/drivers/10', undefined],
      ['POST', 'https://api.test/drivergroups/3/administrators/21', undefined]
    ])
    expect(ui.driversGroupState.driversGroup.name).toBe('answer')
  })

  it('sends no PUT when only drivers changed', async () => {
    draw()
    await act(async () => { await ui.handleUpdateDriversGroup({ drivers: JSON.stringify([10, 11, 12]) }) })
    expect(writes()).toEqual([['POST', 'https://api.test/drivergroups/3/drivers/12', undefined]])
  })

  it('stops at the first error and reports it', async () => {
    mocks.fetch.mockImplementation((url, options) => json(
      options?.method === 'POST' ? { error: true, result: ['Not permission'] } : { error: false, result: GROUP }
    ))
    draw()
    let result
    await act(async () => { result = await ui.handleUpdateDriversGroup({ drivers: JSON.stringify([12]) }) })
    expect(result).toEqual({ ok: false, error: ['Not permission'] })
    expect(writes()).toEqual([['POST', 'https://api.test/drivergroups/3/drivers/12', undefined]])
  })

  it('keeps the whole driver list in the PUT when a temporary activation changes', async () => {
    draw()
    const changes = { drivers: JSON.stringify([10, 11]), temporary_drivers: JSON.stringify([{ id: 11, temporarily_activated: true, temporary_at: '2099-01-01 00:00:00' }]) }
    await act(async () => { await ui.handleUpdateDriversGroup(changes) })
    expect(writes()).toEqual([['PUT', 'https://api.test/drivergroups/3', changes]])
  })

  it('goes per item when the temporary drivers are the saved ones', async () => {
    draw({ drivers: [{ id: 10 }, { id: 11, temporary_at: '2099-01-01 00:00:00' }] })
    const changes = { drivers: JSON.stringify([11]), temporary_drivers: JSON.stringify([{ id: 11, temporarily_activated: true, temporary_at: '2099-01-01 00:00:00' }]) }
    await act(async () => { await ui.handleUpdateDriversGroup(changes) })
    expect(writes()).toEqual([['DELETE', 'https://api.test/drivergroups/3/drivers/10', undefined]])
  })
})
