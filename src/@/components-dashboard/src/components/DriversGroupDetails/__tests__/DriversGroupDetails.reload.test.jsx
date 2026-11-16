/* eslint-disable import/first */
// a group that was added or deleted changes the total and the pages of the list, and the local append/filter cannot
// know them (11 rows on a page of 10, stale total). With the optional prop `reloadDriversGroups` the controller asks the list to
// re-fetch after a successful add and a successful delete; without it, or after a failure, it is what it was.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  showToast: vi.fn(),
  setGroups: vi.fn(),
  onClose: vi.fn(),
  onCreated: vi.fn(),
  reload: vi.fn()
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

const ROW = { id: 3, name: 'North', enabled: true, type: 0 }
const groups = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, name: `Group ${index + 1}` }))

let ui
const draw = (extra = {}) => {
  ui = null
  const UI = (p) => {
    ui = p
    return null
  }
  return render(
    <DriversGroupDetails
      UIComponent={UI}
      curDriversGroup={ROW}
      driversGroupId={3}
      driversGroupsState={{ groups, loading: false, error: null }}
      setDriversGroupsState={mocks.setGroups}
      driversManagers={[]}
      onClose={mocks.onClose}
      {...extra}
    />
  )
}

const answer = (body) => mocks.fetch.mockImplementation(() => Promise.resolve({ json: () => Promise.resolve(body) }))

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset())
  globalThis.fetch = mocks.fetch
})

describe('DriversGroupDetails controller · reloadDriversGroups', () => {
  it('re-fetches the list after a successful add', async () => {
    answer({ error: false, result: { id: 11, name: 'New' } })
    draw({ curDriversGroup: null, driversGroupId: undefined, reloadDriversGroups: mocks.reload })
    await act(async () => { await ui.handleAddDriversGroup() })
    expect(mocks.setGroups).toHaveBeenCalledTimes(1)
    expect(mocks.reload).toHaveBeenCalledTimes(1)
    expect(mocks.onClose).toHaveBeenCalledTimes(1)
  })

  // (row 27, drivers-groups P-10, D-39 (a)): with `onCreated` the created group is handed over instead of closing
  it('hands the created group to onCreated, once, and does not call onClose', async () => {
    answer({ error: false, result: { id: 11, name: 'New' } })
    draw({ curDriversGroup: null, driversGroupId: undefined, reloadDriversGroups: mocks.reload, onCreated: mocks.onCreated })
    await act(async () => { await ui.handleAddDriversGroup() })
    expect(mocks.reload).toHaveBeenCalledTimes(1)
    expect(mocks.onCreated).toHaveBeenCalledTimes(1)
    expect(mocks.onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 11, name: 'New' }))
    expect(mocks.onClose).not.toHaveBeenCalled()
  })

  it('does not call onCreated when the add is refused', async () => {
    answer({ error: true, result: ['Name is required'] })
    draw({ curDriversGroup: null, driversGroupId: undefined, onCreated: mocks.onCreated })
    await act(async () => { await ui.handleAddDriversGroup() })
    expect(mocks.onCreated).not.toHaveBeenCalled()
  })

  it('does not re-fetch when the add is refused', async () => {
    answer({ error: true, result: ['Name is required'] })
    draw({ curDriversGroup: null, driversGroupId: undefined, reloadDriversGroups: mocks.reload })
    await act(async () => { await ui.handleAddDriversGroup() })
    expect(mocks.reload).not.toHaveBeenCalled()
    expect(mocks.onClose).not.toHaveBeenCalled()
  })

  it('re-fetches the list after a successful delete', async () => {
    answer({ error: false, result: {} })
    draw({ reloadDriversGroups: mocks.reload })
    let result
    await act(async () => { result = await ui.handleDeleteDriversGroup() })
    expect(result).toEqual({ ok: true })
    expect(mocks.reload).toHaveBeenCalledTimes(1)
    expect(mocks.onClose).toHaveBeenCalledTimes(1)
  })

  it('does not re-fetch when the delete is refused or throws', async () => {
    draw({ reloadDriversGroups: mocks.reload })
    answer({ error: true, result: ['Group has active orders'] })
    await act(async () => { await ui.handleDeleteDriversGroup() })
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('offline')))
    await act(async () => { await ui.handleDeleteDriversGroup() })
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('without the prop add and delete work as before', async () => {
    answer({ error: false, result: { id: 11, name: 'New' } })
    draw({ curDriversGroup: null, driversGroupId: undefined })
    await act(async () => { await ui.handleAddDriversGroup() })
    expect(mocks.setGroups).toHaveBeenCalledTimes(1)
    expect(mocks.onClose).toHaveBeenCalledTimes(1)
    mocks.onClose.mockReset()
    answer({ error: false, result: {} })
    draw({ curDriversGroup: ROW, driversGroupId: 3 })
    let result
    await act(async () => { result = await ui.handleDeleteDriversGroup() })
    expect(result).toEqual({ ok: true })
    expect(mocks.onClose).toHaveBeenCalledTimes(1)
  })
})
