/* eslint-disable import/first */
// redesign stores 5.2 (G2-06, G2-07, decision 12c): the owners and agents of a store. Adding an agent to a store whose
// record has no `agents` threw after the server had saved it; the store changed from the state of one render; the toasts were
// «OWNERS deleted» in every language; and the last owner could be removed. Now the handlers answer `{ ok, error }`, change the
// store only after the API accepts it, say «Owner added» / «Agent removed»… with fixed keys, and refuse to leave a store with
// no owner. each person added or removed is its own request (POST/DELETE business/{id}/owners|agents/{user_id});
// `mocks.save` plays the API and answers its body.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    root: 'https://api.test',
    project: 'demo',
    businesses: () => ({ save: mocks.save }),
    setAccessToken: () => ({ businesses: () => ({ save: mocks.save }) })
  }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))
vi.mock('../../../contexts/EventContext', () => ({
  useEvent: () => [{ emit: vi.fn() }]
}))
vi.mock('../../../contexts/AssistantContext', () => ({
  useAssistantRecordChanges: () => {}
}))

import { BusinessDetails } from '../index'

const ANA = { id: 1, name: 'Ana', lastname: 'Ruiz' }
const BEN = { id: 2, name: 'Ben', lastname: 'Cole' }
const CARA = { id: 3, name: 'Cara', lastname: 'Diaz' }

let ui
const draw = (store) => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessDetails UIComponent={UI} business={store} businessId={store.id} notGetSites notGetTaxes notGetStreamConnection />)
}

const toasts = () => mocks.showToast.mock.calls.map(([type, message]) => [type, message])
const requests = () => global.fetch.mock.calls.map(([url, options]) => [options.method, url])

beforeEach(() => {
  mocks.save.mockReset()
  mocks.showToast.mockReset()
  global.fetch = vi.fn(async (url, options) => {
    const { content } = await mocks.save(url, options)
    return { json: async () => content }
  })
})

describe('BusinessDetails controller · owners and agents', () => {
  it('adds an agent to a store whose record has no agents, without throwing, and says «Agent added»', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: {} } })
    draw({ id: 7, name: 'Sample Burgers', owners: [ANA] })
    let result
    await act(async () => { result = await ui.handleAddBusinessOwner([CARA.id], CARA, { type: 'agents' }) })
    expect(result).toEqual({ ok: true })
    expect(requests()).toEqual([['POST', 'https://api.test/business/7/agents/3']])
    expect(ui.businessState.business.agents).toEqual([CARA])
    expect(ui.businessState.business.owners).toEqual([ANA])
    expect(toasts()).toContainEqual(['success', 'Agent added'])
  })

  it('changes the store only once the API answers, and from the latest state', async () => {
    let answer
    mocks.save.mockImplementation(() => new Promise(resolve => { answer = resolve }))
    draw({ id: 7, name: 'Sample Burgers', owners: [ANA, BEN] })
    let pending
    act(() => { pending = ui.handleAddBusinessOwner([ANA.id, BEN.id, CARA.id], CARA, { type: 'owners' }) })
    expect(ui.businessState.business.owners).toEqual([ANA, BEN])
    // something else changes the store meanwhile: the answer must not bring the old record back
    act(() => { ui.handleUpdateBusinessState({ name: 'Renamed' }) })
    let result
    await act(async () => {
      answer({ content: { error: false, result: {} } })
      result = await pending
    })
    expect(result).toEqual({ ok: true })
    expect(ui.businessState.business.owners).toEqual([ANA, BEN, CARA])
    expect(ui.businessState.business.name).toBe('Renamed')
    expect(toasts()).toContainEqual(['success', 'Business owner added'])
  })

  it('removes an owner with «Owner removed» and an agent with «Agent removed»', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: {} } })
    draw({ id: 7, name: 'Sample Burgers', owners: [ANA, BEN], agents: [CARA] })
    let owner
    let agent
    await act(async () => { owner = await ui.handleDeleteBusinessOwner([ANA.id], { type: 'owners' }) })
    await act(async () => { agent = await ui.handleDeleteBusinessOwner([], { type: 'agents' }) })
    expect(owner).toEqual({ ok: true })
    expect(agent).toEqual({ ok: true })
    expect(ui.businessState.business.owners).toEqual([ANA])
    expect(ui.businessState.business.agents).toEqual([])
    expect(requests().at(-1)).toEqual(['DELETE', 'https://api.test/business/7/agents/3'])
    expect(toasts()).toEqual(expect.arrayContaining([['success', 'Business owner removed'], ['success', 'Agent removed']]))
    expect(toasts().some(([, message]) => /OWNERS|AGENTS/.test(message))).toBe(false)
  })

  it('returns the API error and leaves the store as it was when the save fails', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['The user is not an owner'] } })
    draw({ id: 7, name: 'Sample Burgers', owners: [ANA, BEN] })
    let result
    await act(async () => { result = await ui.handleDeleteBusinessOwner([ANA.id], { type: 'owners' }) })
    expect(result).toEqual({ ok: false, error: ['The user is not an owner'] })
    expect(ui.businessState.business.owners).toEqual([ANA, BEN])
    expect(ui.actionStatus.loading).toBe(false)
    expect(toasts().some(([type]) => type === 'success')).toBe(false)
  })

  it('returns the message of an exception', async () => {
    mocks.save.mockRejectedValue(new Error('Network down'))
    draw({ id: 7, name: 'Sample Burgers', owners: [ANA] })
    let result
    await act(async () => { result = await ui.handleAddBusinessOwner([ANA.id, BEN.id], BEN, { type: 'owners' }) })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.businessState.business.owners).toEqual([ANA])
  })

  it('refuses to remove the last owner without calling the API (decision 12c)', async () => {
    draw({ id: 7, name: 'Sample Burgers', owners: [ANA] })
    let result
    await act(async () => { result = await ui.handleDeleteBusinessOwner([], { type: 'owners' }) })
    expect(result).toEqual({ ok: false, error: ['A store needs at least one owner.'] })
    expect(mocks.save).not.toHaveBeenCalled()
    expect(ui.businessState.business.owners).toEqual([ANA])
  })
})
