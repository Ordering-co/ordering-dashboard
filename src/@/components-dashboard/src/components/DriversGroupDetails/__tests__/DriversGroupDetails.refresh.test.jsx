/* eslint-disable import/first */
// redesign DG-R1 (R1-01): a group opened from a row of the list comes with the row, whose stores carry no `location` (only
// `GET /drivergroups/:id` does), so the overview map of the zones could not draw the zones by distance. With the opt-in prop
// `refreshOnOpen` the controller paints the row at once and then asks for the detail and swaps it in, without a visible loading
// and without touching `changesState`. Without the prop it is what it was: the row, and no request.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
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

const ROW = { id: 3, name: 'North', enabled: true, type: 0, business: [{ id: 2, name: 'Store' }] }
const DETAIL = { ...ROW, business: [{ id: 2, name: 'Store', location: { lat: 1, lng: 2 } }] }

let ui
let renders
const draw = (extra = {}) => {
  ui = null
  renders = []
  const group = { ...ROW }
  const UI = (p) => {
    ui = p
    renders.push({ loading: p.driversGroupState.loading, group: p.driversGroupState.driversGroup })
    return null
  }
  return render(
    <DriversGroupDetails
      UIComponent={UI}
      curDriversGroup={group}
      driversGroupId={3}
      driversGroupsState={{ groups: [group], loading: false, error: null }}
      setDriversGroupsState={mocks.setGroups}
      driversManagers={[]}
      {...extra}
    />
  )
}

const detailGets = () => mocks.fetch.mock.calls.filter(([url, options]) => url === 'https://api.test/drivergroups/3' && (!options || options.method === 'GET'))

let releaseDetail
beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.showToast.mockReset()
  mocks.setGroups.mockReset()
  mocks.fetch.mockImplementation((url, options) => {
    if (options?.method === 'GET') {
      return new Promise(resolve => {
        releaseDetail = (body = { error: false, result: DETAIL }) => resolve({ json: () => Promise.resolve(body) })
      })
    }
    const sent = options?.body ? JSON.parse(options.body) : {}
    return Promise.resolve({ json: () => Promise.resolve({ error: false, result: { ...ROW, ...sent } }) })
  })
  globalThis.fetch = mocks.fetch
})

describe('DriversGroupDetails controller · refreshOnOpen (R1-01)', () => {
  it('without the prop an opened row is the group and nothing is requested, as before', async () => {
    draw()
    await act(async () => { await Promise.resolve() })
    expect(detailGets()).toHaveLength(0)
    expect(ui.driversGroupState.driversGroup.business[0].location).toBeUndefined()
  })

  it('with the prop the row is painted at once, the detail is requested once and replaces the group', async () => {
    draw({ refreshOnOpen: true })
    // at once: the row, no loading
    expect(renders[0]).toEqual({ loading: false, group: expect.objectContaining({ id: 3 }) })
    await waitFor(() => expect(detailGets()).toHaveLength(1))
    await act(async () => { releaseDetail() })
    await waitFor(() => expect(ui.driversGroupState.driversGroup.business[0].location).toEqual({ lat: 1, lng: 2 }))
    expect(detailGets()).toHaveLength(1)
    expect(renders.every(render => render.loading === false)).toBe(true)
    expect(ui.driversGroupState.error).toBeNull()
  })

  it('does not wipe what the user already changed while the detail was on its way', async () => {
    draw({ refreshOnOpen: true })
    await waitFor(() => expect(detailGets()).toHaveLength(1))
    act(() => { ui.handleChangesState({ name: 'South' }) })
    await act(async () => { releaseDetail() })
    await waitFor(() => expect(ui.driversGroupState.driversGroup.business[0].location).toBeDefined())
    expect(ui.changesState).toEqual({ name: 'South' })
  })

  it('a detail that fails leaves the row on screen, with no error state', async () => {
    draw({ refreshOnOpen: true })
    await waitFor(() => expect(detailGets()).toHaveLength(1))
    await act(async () => { releaseDetail({ error: true, result: ['Not found'] }) })
    expect(ui.driversGroupState.driversGroup.id).toBe(3)
    expect(ui.driversGroupState.loading).toBe(false)
    expect(ui.driversGroupState.error).toBeNull()
  })

  it('a save that answers first is not overwritten by the older detail', async () => {
    draw({ refreshOnOpen: true })
    await waitFor(() => expect(detailGets()).toHaveLength(1))
    const staleRelease = releaseDetail
    await act(async () => { await ui.handleUpdateDriversGroup({ enabled: false }) })
    await act(async () => { staleRelease({ error: false, result: { ...DETAIL, enabled: true } }) })
    expect(ui.driversGroupState.driversGroup.enabled).toBe(false)
  })

  it('an answer for a group that is no longer the open one is dropped', async () => {
    const view = draw({ refreshOnOpen: true })
    await waitFor(() => expect(detailGets()).toHaveLength(1))
    const staleRelease = releaseDetail
    const other = { id: 9, name: 'Other', enabled: true, type: 0, business: [] }
    view.rerender(
      <DriversGroupDetails
        UIComponent={(p) => { ui = p; return null }}
        curDriversGroup={other}
        driversGroupId={9}
        driversGroupsState={{ groups: [other], loading: false, error: null }}
        setDriversGroupsState={mocks.setGroups}
        driversManagers={[]}
        refreshOnOpen
      />
    )
    await act(async () => { staleRelease() })
    expect(ui.driversGroupState.driversGroup.id).toBe(9)
  })
})
