// apply-list row 22 (users-professionals P-1): handleRemoveBusinessServices takes a professional out of one store with the same
// DELETE the services controller sends for one service, once per service of that store, in order. fetch is faked: nothing reaches a server.
import React from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ props: null, showToast: vi.fn() }))

vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v1/en', businesses: () => ({ asDashboard: () => ({ select: () => ({ get: async () => ({ content: { error: false, result: [] } }) }) }) }) }]
}))
vi.mock('../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tkn' }] }))
vi.mock('../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_key, fallback) => fallback] }))
vi.mock('../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [{}, { showToast: state.showToast }]
}))

import { ProfessionalBusinessService } from './index'

const services = [
  { id: 11, business_id: 1 },
  { id: 12, business_id: 1 },
  { id: 13, business_id: 1 },
  { id: 21, business_id: 2 },
  { id: 99, business_id: 77 }
]

const UI = (props) => { state.props = props; return null }

const reply = (body) => ({ json: async () => body })
const deletes = () => fetch.mock.calls.filter(([, options]) => options.method === 'DELETE')

const mount = async () => {
  render(<ProfessionalBusinessService user={{ id: 41 }} UIComponent={UI} />)
  await waitFor(() => expect(state.props.userServiceList.services).toHaveLength(services.length))
}

beforeEach(() => {
  state.props = null
  state.showToast.mockReset()
  global.fetch = vi.fn(async (url, options) => (options.method === 'GET' ? reply({ error: false, result: services }) : reply({ error: false, result: 'ok' })))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('handleRemoveBusinessServices', () => {
  it('sends one DELETE per service of that store, the same call as unticking one service, and nothing for the others', async () => {
    await mount()
    let outcome
    await act(async () => { outcome = await state.props.handleRemoveBusinessServices(1) })
    expect(deletes().map(([url]) => url)).toEqual([
      'https://api.test/v1/en/users/41/products/11',
      'https://api.test/v1/en/users/41/products/12',
      'https://api.test/v1/en/users/41/products/13'
    ])
    expect(deletes()[0][1]).toEqual({ method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tkn' } })
    expect(outcome).toEqual({ removed: 3, failed: 0 })
  })

  it('sends them one after the other, never together', async () => {
    await mount()
    const resolvers = []
    fetch.mockImplementation((url, options) => (
      options.method === 'DELETE'
        ? new Promise(resolve => resolvers.push(() => resolve(reply({ error: false, result: 'ok' }))))
        : Promise.resolve(reply({ error: false, result: services }))
    ))
    let promise
    act(() => { promise = state.props.handleRemoveBusinessServices(1) })
    await waitFor(() => expect(resolvers).toHaveLength(1))
    expect(deletes()).toHaveLength(1)
    await act(async () => { resolvers[0]() })
    await waitFor(() => expect(resolvers).toHaveLength(2))
    await act(async () => { resolvers[1]() })
    await waitFor(() => expect(resolvers).toHaveLength(3))
    await act(async () => { resolvers[2](); await promise })
    expect(deletes()).toHaveLength(3)
  })

  it('updates the list of services without the ones removed, and says how many with a success toast', async () => {
    await mount()
    await act(async () => { await state.props.handleRemoveBusinessServices(1) })
    expect(state.props.userServiceList.services.map(service => service.id)).toEqual([21, 99])
    expect(state.showToast).toHaveBeenLastCalledWith('SUCCESS', '3 services removed')
  })

  it('says «1 service removed» for one', async () => {
    await mount()
    await act(async () => { await state.props.handleRemoveBusinessServices(2) })
    expect(state.showToast).toHaveBeenLastCalledWith('SUCCESS', '1 service removed')
  })

  it('when one fails it keeps it in the list, removes the others and says how many could not be removed', async () => {
    await mount()
    fetch.mockImplementation(async (url, options) => {
      if (options.method === 'GET') return reply({ error: false, result: services })
      return url.endsWith('/12') ? reply({ error: true, result: ['Not allowed'] }) : reply({ error: false, result: 'ok' })
    })
    let outcome
    await act(async () => { outcome = await state.props.handleRemoveBusinessServices(1) })
    expect(deletes()).toHaveLength(3)
    expect(outcome).toEqual({ removed: 2, failed: 1 })
    expect(state.props.userServiceList.services.map(service => service.id)).toEqual([12, 21, 99])
    expect(state.showToast).toHaveBeenLastCalledWith('ERROR', "1 service couldn't be removed")
  })

  it('a network error counts as a failure and the next services are still tried', async () => {
    await mount()
    fetch.mockImplementation(async (url, options) => {
      if (options.method === 'GET') return reply({ error: false, result: services })
      if (url.endsWith('/11') || url.endsWith('/13')) throw new Error('offline')
      return reply({ error: false, result: 'ok' })
    })
    let outcome
    await act(async () => { outcome = await state.props.handleRemoveBusinessServices(1) })
    expect(outcome).toEqual({ removed: 1, failed: 2 })
    expect(state.props.userServiceList.services.map(service => service.id)).toEqual([11, 13, 21, 99])
    expect(state.showToast).toHaveBeenLastCalledWith('ERROR', "2 services couldn't be removed")
  })

  it('a store with no service of this professional sends nothing', async () => {
    await mount()
    let outcome
    await act(async () => { outcome = await state.props.handleRemoveBusinessServices(3) })
    expect(deletes()).toHaveLength(0)
    expect(outcome).toEqual({ removed: 0, failed: 0 })
  })
})
