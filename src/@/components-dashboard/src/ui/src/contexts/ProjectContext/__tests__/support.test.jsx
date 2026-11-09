/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const session = vi.hoisted(() => ({ token: 'token-a', root: 'https://api.test/alpha', project: 'alpha' }))
vi.mock('../../../../../index', () => ({
  useApi: () => [{ root: session.root, project: session.project }],
  useSession: () => [{ token: session.token }],
  useConfig: () => [{ configs: {}, fetchedWithToken: true }]
}))
vi.mock('~/analytics/posthog', () => ({ captureDashboardOperation: vi.fn() }))
import { ProjectProvider, useProjectState } from '..'
import { isProjectIntercomAllowed } from '../../../utils/assistantIntercom'

const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const support = allowed => response({ error: false, result: { intercom_allowed: allowed } })
const current = () => response({ error: false, result: { id: 1, code: 'alpha' } })
const limitedBilling = () => response({ error: true, result: ['Limited access to the billing manager for this project, contact them.'] }, 400)
const Probe = () => {
  const [state, { getProjectStatus }] = useProjectState()
  return <><button onClick={getProjectStatus}>Refresh project</button><output aria-label='support'>{String(isProjectIntercomAllowed(state))}</output><pre data-testid='state'>{JSON.stringify(state)}</pre></>
}
const readState = () => JSON.parse(screen.getByTestId('state').textContent)
const renderProject = () => render(<ProjectProvider><Probe /></ProjectProvider>)
const routes = (supportRequest, billingRequest = limitedBilling) => {
  vi.stubGlobal('fetch', vi.fn((url, options) => {
    if (url.endsWith('/current/support')) {
      expect(options).toMatchObject({ method: 'GET', headers: { Authorization: `Bearer ${session.token}` } })
      return supportRequest(url, options)
    }
    if (url.endsWith('/billing/subscriptions')) return billingRequest(url, options)
    if (url.endsWith('/current')) return Promise.resolve(current())
    throw new Error(`Unexpected URL: ${url}`)
  }))
}

beforeEach(() => Object.assign(session, { token: 'token-a', root: 'https://api.test/alpha', project: 'alpha' }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('project support authority independent of billing permissions', () => {
  it('permits a project-local Supportadmin when billing returns HTTP 400', async () => {
    routes(async () => support(true))
    renderProject()
    await waitFor(() => expect(screen.getByLabelText('support')).toHaveTextContent('true'))
    expect(readState()).toMatchObject({ intercomAllowed: true, billingUnavailable: true, planResolved: false, plan: null })
  })

  it('blocks plan 581 from the support authority even when billing is unavailable', async () => {
    routes(async () => support(false))
    renderProject()
    await waitFor(() => expect(readState().loading).toBe(false))
    expect(readState().intercomAllowed).toBe(false)
    expect(screen.getByLabelText('support')).toHaveTextContent('false')
  })

  it('permits support before a billing request that never settles', async () => {
    routes(async () => support(true), () => new Promise(() => {}))
    renderProject()
    await waitFor(() => expect(screen.getByLabelText('support')).toHaveTextContent('true'))
    expect(readState().loading).toBe(true)
  })

  it('settles project and billing data while the support request never settles', async () => {
    routes(() => new Promise(() => {}), async () => response({ error: false, result: [{ status: 'active', plan: { plan: { id: 100 } } }] }))
    renderProject()
    await waitFor(() => expect(readState().loading).toBe(false))
    expect(readState()).toMatchObject({ plan: { id: 100 }, project: { id: 1 }, planResolved: true, intercomAllowed: null })
    expect(screen.getByLabelText('support')).toHaveTextContent('false')
  })

  it('revokes confirmed permission during a support refresh and ignores the previous refresh', async () => {
    routes(async () => support(true))
    renderProject()
    await waitFor(() => expect(screen.getByLabelText('support')).toHaveTextContent('true'))
    let finishOldRefresh
    routes(() => new Promise(resolve => { finishOldRefresh = resolve }))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh project' }))
    expect(readState().intercomAllowed).toBeNull()
    expect(screen.getByLabelText('support')).toHaveTextContent('false')
    routes(async () => support(false))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh project' }))
    await waitFor(() => expect(readState().intercomAllowed).toBe(false))
    await act(async () => finishOldRefresh(support(true)))
    expect(readState().intercomAllowed).toBe(false)
    expect(screen.getByLabelText('support')).toHaveTextContent('false')
  })

  it('keeps support independent of a rejected billing request', async () => {
    routes(async () => support(true), async () => { throw new Error('Billing offline') })
    renderProject()
    await waitFor(() => expect(screen.getByLabelText('support')).toHaveTextContent('true'))
    expect(readState().planResolved).toBe(false)
  })

  it.each([null, {}, { error: false, result: null }, { error: false, result: {} },
    { error: false, result: { intercom_allowed: 'true' } }, { error: false, result: { intercom_allowed: 1 } },
    { result: { intercom_allowed: true } }, { error: true, result: { intercom_allowed: true } }
  ])('fails closed for malformed support payload %j', async body => {
    routes(async () => response(body))
    renderProject()
    await waitFor(() => expect(readState().loading).toBe(false))
    expect(readState().intercomAllowed).toBeNull()
    expect(screen.getByLabelText('support')).toHaveTextContent('false')
  })

  it.each([401, 403, 500])('fails closed for support HTTP %s despite an allowed response body', async status => {
    routes(async () => response({ error: false, result: { intercom_allowed: true } }, status))
    renderProject()
    await waitFor(() => expect(readState().loading).toBe(false))
    expect(readState().intercomAllowed).toBeNull()
    expect(screen.getByLabelText('support')).toHaveTextContent('false')
  })

  it.each(['network', 'json'])('fails closed for a support %s error without discarding project data', async failure => {
    routes(async () => {
      if (failure === 'network') throw new Error('Support offline')
      return { ok: true, json: async () => { throw new SyntaxError('Invalid JSON') } }
    })
    renderProject()
    await waitFor(() => expect(readState().loading).toBe(false))
    expect(readState()).toMatchObject({ project: { id: 1 }, intercomAllowed: null })
    expect(screen.getByLabelText('support')).toHaveTextContent('false')
  })

  it('does not use readable billing as permission while support is loading', async () => {
    let finish
    routes(() => new Promise(resolve => { finish = resolve }), async () => response({ error: false, result: [{ status: 'active', plan: { plan: { id: 100 } } }] }))
    renderProject()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    expect(screen.getByLabelText('support')).toHaveTextContent('false')
    await act(async () => finish(support(true)))
    await waitFor(() => expect(screen.getByLabelText('support')).toHaveTextContent('true'))
  })

  it.each([100, 581])('does not allow readable billing on plan %s to override denied support', async planId => {
    routes(async () => support(false), async () => response({ error: false, result: [{ status: 'active', plan: { plan: { id: planId } } }] }))
    renderProject()
    await waitFor(() => expect(readState().loading).toBe(false))
    expect(readState().plan).toEqual({ id: planId })
    expect(screen.getByLabelText('support')).toHaveTextContent('false')
  })

  it.each(['root', 'project', 'token', 'logout'])('ignores support that resolves after changing %s', async change => {
    let finishOld
    routes(() => new Promise(resolve => { finishOld = resolve }))
    const view = renderProject()
    await waitFor(() => expect(finishOld).toBeTypeOf('function'))
    if (change === 'logout') session.token = null
    else session[change] = `${session[change]}-next`
    routes(async () => support(false))
    view.rerender(<ProjectProvider><Probe /></ProjectProvider>)
    await act(async () => {})
    await act(async () => finishOld(support(true)))
    expect(screen.getByLabelText('support')).toHaveTextContent('false')
    expect(readState().intercomAllowed).toBe(change === 'logout' ? null : false)
  })

  it('revokes confirmed permission immediately on a new session', async () => {
    routes(async () => support(true))
    const view = renderProject()
    await waitFor(() => expect(screen.getByLabelText('support')).toHaveTextContent('true'))
    session.token = 'next-token'
    routes(() => new Promise(() => {}))
    view.rerender(<ProjectProvider><Probe /></ProjectProvider>)
    expect(screen.getByLabelText('support')).toHaveTextContent('false')
    expect(readState().intercomAllowed).toBeNull()
    await act(async () => {})
  })
})
