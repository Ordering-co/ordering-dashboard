/* eslint-disable import/first */
import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ ordering: { root: '/fixture-api' }, token: null, capture: vi.fn() }))
vi.mock('../../../../index', () => ({
  useApi: () => [runtime.ordering],
  useSession: () => [{ token: runtime.token }],
  useConfig: () => [{ configs: {}, fetchedWithToken: false }]
}))
vi.mock('~/analytics/posthog', () => ({ captureDashboardOperation: runtime.capture }))

import { FilterValuesProvider, useFilterValues } from '../FilterValuesContext'
import { InfoShareProvider, useInfoShare } from '../InfoShareContext'
import { ProjectProvider, useProjectState } from '../ProjectContext'

const FilterProbe = () => {
  const [state, { handleFilterValues }] = useFilterValues()
  return <><output data-testid='filter'>{JSON.stringify(state)}</output><button onClick={() => handleFilterValues({ orderId: 41 })}>Replace filters</button></>
}
const InfoProbe = () => {
  const [state, { handleMenuCollapse }] = useInfoShare()
  return <><output data-testid='collapse'>{String(state.isCollapse)}</output><button onClick={() => handleMenuCollapse(true)}>Collapse</button></>
}
const ProjectProbe = () => {
  const [state] = useProjectState()
  return <output data-testid='project'>{JSON.stringify(state)}</output>
}

beforeEach(() => {
  runtime.token = null
  runtime.capture.mockClear()
  vi.restoreAllMocks()
})

describe('L2 provider contracts', () => {
  it('keeps the complete initial filter shape and replacement semantics', async () => {
    const user = userEvent.setup()
    render(<FilterValuesProvider><FilterProbe /></FilterValuesProvider>)
    const initial = JSON.parse(screen.getByTestId('filter').textContent)
    expect(initial).toMatchObject({ orderId: null, externalId: null, businessIds: [], driverIds: [], statuses: [], logisticStatus: null, administratorIds: [], timeStatus: null })
    expect(Object.keys(initial)).toHaveLength(28)
    await user.click(screen.getByRole('button', { name: 'Replace filters' }))
    expect(screen.getByTestId('filter')).toHaveTextContent(JSON.stringify({ orderId: 41 }))
  })

  it('keeps shared menu collapse state and exact boolean assignment', async () => {
    const user = userEvent.setup()
    render(<InfoShareProvider><InfoProbe /></InfoShareProvider>)
    expect(screen.getByTestId('collapse')).toHaveTextContent('false')
    await user.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(screen.getByTestId('collapse')).toHaveTextContent('true')
  })

  it('fetches current project and subscriptions, selects active plan and records analytics', async () => {
    runtime.token = 'synthetic-token'
    // main #472: the project also asks /current/support whether Intercom is allowed, apart from billing
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.endsWith('/current/support')) return { ok: true, json: async () => ({ error: false, result: { intercom_allowed: true } }) }
      if (url.endsWith('/current')) return { ok: true, json: async () => ({ error: false, result: { code: 'fixture', current_status: 'active' } }) }
      return { ok: true, json: async () => ({ error: false, result: [{ status: 'past_due', plan: { plan: { id: 1 } } }, { status: 'active', plan: { plan: { id: 2 } } }] }) }
    })
    render(<ProjectProvider><ProjectProbe /></ProjectProvider>)
    await waitFor(() => expect(JSON.parse(screen.getByTestId('project').textContent)).toMatchObject({ loading: false, project: { code: 'fixture' }, plan: { id: 2 } }))
    expect(fetchMock).toHaveBeenCalledWith('/fixture-api/current', { method: 'GET', headers: { 'Content-Type': 'application/json' } })
    expect(fetchMock).toHaveBeenCalledWith('/fixture-api/billing/subscriptions', { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-token' } })
    expect(runtime.capture).toHaveBeenNthCalledWith(1, { status: 'started', module: 'project', action: 'load_project' })
    expect(runtime.capture).toHaveBeenNthCalledWith(2, { status: 'succeeded', module: 'project', action: 'load_project' })
  })

  it('does not fetch without token and preserves network-failure analytics/state', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const rendered = render(<ProjectProvider><ProjectProbe /></ProjectProvider>)
    expect(fetchMock).not.toHaveBeenCalled()
    runtime.token = 'token'
    await act(async () => rendered.rerender(<ProjectProvider><ProjectProbe /></ProjectProvider>))
    await waitFor(() => expect(runtime.capture).toHaveBeenCalledWith({ status: 'failed', module: 'project', action: 'load_project', failureType: 'network' }))
    expect(JSON.parse(screen.getByTestId('project').textContent)).toMatchObject({ loading: false, project: {} })
  })
})

// ConfigFileContext intentionally remains a bare createContext. Its meaningful
// contracts are exercised by Login/Forgot/Reset/Query consumers, not React itself.
