/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign (the controller lives in components/ReportsDriverGroupFilter; this test sits with the page that mounts it because the
// bi family of scripts/redesign/families.json lists no test glob for that controller directory): opening the «Driver group» filter of /intelligence/drivers asked `GET drivergroups` twice (a mount effect and the effect
// of the search text both ran on mount). The controller is the real one; the contexts are stubbed and `fetch` is simulated.

const ROOT = 'https://api.test/v400/en/dev'

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tkn', loading: false }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: ROOT }] }))

import { ReportsDriverGroupFilter } from '../../../../../../components/ReportsDriverGroupFilter'

const GROUPS = [
  { id: 1, name: 'North', enabled: true, drivers: [{ id: 10 }] },
  { id: 2, name: 'South', enabled: false, drivers: [{ id: 20 }] },
  { id: 3, name: 'East', enabled: true, drivers: [{ id: 30 }, { id: 31 }] }
]

let ui
const Probe = (props) => {
  ui = props
  return null
}

const groupCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => String(url).includes('/drivergroups'))

describe('ReportsDriverGroupFilter', () => {
  let fetchMock
  beforeEach(() => {
    ui = null
    fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ error: false, result: GROUPS, pagination: { total: 3 } }) }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for the driver groups once when it opens, and lists the enabled ones', async () => {
    render(<ReportsDriverGroupFilter UIComponent={Probe} filterList={{}} handleChangeFilterList={vi.fn()} />)
    await waitFor(() => expect(ui.driverGroupList.driverGroups.map(group => group.id)).toEqual([1, 3]))
    expect(groupCalls(fetchMock)).toHaveLength(1)
    expect(groupCalls(fetchMock)[0][0]).toBe(`${ROOT}/drivergroups?params=id,name,enabled,drivers`)
    expect(ui.driverGroupList.loading).toBe(false)
  })

  it('keeps the search: a new text asks once more, with the name condition', async () => {
    render(<ReportsDriverGroupFilter UIComponent={Probe} filterList={{}} handleChangeFilterList={vi.fn()} />)
    await waitFor(() => expect(ui.driverGroupList.loading).toBe(false))
    expect(groupCalls(fetchMock)).toHaveLength(1)
    await act(async () => ui.onSearch('eas'))
    await waitFor(() => expect(groupCalls(fetchMock)).toHaveLength(2))
    const url = decodeURIComponent(groupCalls(fetchMock)[1][0])
    expect(url).toContain('"attribute":"name"')
    expect(url).toContain('%eas%')
  })

  it('keeps the selection of the filter in force (the ids in `filterList`)', async () => {
    render(<ReportsDriverGroupFilter UIComponent={Probe} filterList={{ driver_groups_ids: [3] }} handleChangeFilterList={vi.fn()} />)
    await waitFor(() => expect(ui.driverGroupIds).toEqual([3]))
    expect(ui.isAllCheck).toBe(false)
    expect(groupCalls(fetchMock)).toHaveLength(1)
  })
})
