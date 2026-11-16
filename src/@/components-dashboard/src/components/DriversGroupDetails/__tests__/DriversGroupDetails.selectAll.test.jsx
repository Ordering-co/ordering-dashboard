/* eslint-disable import/first */
// redesign D-12 (owner, 2026-10-19): in the stores of a drivers group "Select all" ADDS the page on screen to the
// selection (it used to replace it and silently lose the stores ticked on other pages). "Select none" still clears everything.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0, id: 1 } }]
}))
vi.mock('../../../contexts/ApiContext', () => {
  const ordering = { root: 'https://api.test' }
  return { useApi: () => [ordering] }
})
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { DriversGroupDetails } from '../index'

const GROUP = { id: 3, name: 'North', enabled: true, type: 0, business: [{ id: 2 }, { id: 9 }] }
const page = (...ids) => ids.map(id => ({ id, name: `Store ${id}` }))

let ui
const Probe = (p) => {
  ui = p
  return null
}
// the same group object on every render: a new one would reset the selection, as it does when another group is opened
const group = { ...GROUP }
const groupsState = { groups: [group], loading: false, error: null }
const element = (businesses) => (
  <DriversGroupDetails
    UIComponent={Probe}
    curDriversGroup={group}
    driversGroupsState={groupsState}
    setDriversGroupsState={vi.fn()}
    driversManagers={[]}
    businesses={businesses}
  />
)

beforeEach(() => {
  ui = null
  globalThis.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ error: false, result: [] }) }))
})

describe('DriversGroupDetails controller · Select all in the stores (D-12)', () => {
  it('adds the page and keeps the ticks of other pages, with no duplicates', () => {
    const { rerender } = render(element(page(1, 2, 3)))
    // stores 2 and 9 come ticked from the group; 9 lives on another page
    expect(ui.selectedBusinessIds).toEqual([2, 9])

    act(() => { ui.handleSelectAllBusiness(true) })
    expect(ui.selectedBusinessIds).toEqual([2, 9, 1, 3])
    expect(JSON.parse(ui.changesState.business)).toEqual([2, 9, 1, 3])

    // a second page: its stores join, nothing already ticked is lost or repeated
    rerender(element(page(3, 4, 5)))
    act(() => { ui.handleSelectAllBusiness(true) })
    expect(ui.selectedBusinessIds).toEqual([2, 9, 1, 3, 4, 5])
    expect(new Set(ui.selectedBusinessIds).size).toBe(ui.selectedBusinessIds.length)
    expect(JSON.parse(ui.changesState.business)).toEqual([2, 9, 1, 3, 4, 5])
  })

  it('keeps the ticks when the page on screen is empty or not loaded', () => {
    render(element(undefined))
    act(() => { ui.handleSelectAllBusiness(true) })
    expect(ui.selectedBusinessIds).toEqual([2, 9])
  })

  it('"Select none" clears the whole selection, as before', () => {
    render(element(page(1, 2, 3)))
    act(() => { ui.handleSelectAllBusiness(true) })
    act(() => { ui.handleSelectAllBusiness(false) })
    expect(ui.selectedBusinessIds).toEqual([])
    expect(JSON.parse(ui.changesState.business)).toEqual([])
  })
})
