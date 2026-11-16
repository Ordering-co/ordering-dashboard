/* eslint-disable import/first */
// adding or removing an owner or agent sends only that person (POST/DELETE business/{id}/owners|agents/{user_id}),
// so two tabs saving the same store keep both changes.
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

const ANA = { id: 1, name: 'Ana' }
const BEN = { id: 2, name: 'Ben' }
const CARA = { id: 3, name: 'Cara' }

let ui
const draw = (store) => {
  const UI = (props) => { ui = props; return null }
  return render(
    <BusinessDetails UIComponent={UI} business={store} businessId={store.id} notGetSites notGetTaxes notGetStreamConnection />
  )
}

const assignmentCalls = () => global.fetch.mock.calls
  .filter(([url]) => /\/(owners|agents)\//.test(url))
  .map(([url, options]) => [options.method, url])

beforeEach(() => {
  mocks.save.mockReset()
  mocks.showToast.mockReset()
  global.fetch = vi.fn(async () => ({ json: async () => ({ error: false, result: [] }) }))
})

describe('BusinessDetails controller · per item owners and agents', () => {
  it('adds only the new owner and keeps the whole list out of the request', async () => {
    draw({ id: 7, owners: [ANA] })
    let result
    await act(async () => { result = await ui.handleAddBusinessOwner([ANA.id, CARA.id], CARA, { type: 'owners' }) })
    expect(result).toEqual({ ok: true })
    expect(assignmentCalls()).toEqual([['POST', 'https://api.test/business/7/owners/3']])
    expect(mocks.save).not.toHaveBeenCalled()
    expect(ui.businessState.business.owners).toEqual([ANA, CARA])
  })

  it('removes only the agent that left', async () => {
    draw({ id: 7, owners: [ANA], agents: [BEN, CARA] })
    let result
    await act(async () => { result = await ui.handleDeleteBusinessOwner([CARA.id], { type: 'agents' }) })
    expect(result).toEqual({ ok: true })
    expect(assignmentCalls()).toEqual([['DELETE', 'https://api.test/business/7/agents/2']])
    expect(ui.businessState.business.agents).toEqual([CARA])
  })

  it('returns the API error and leaves the store as it was', async () => {
    global.fetch = vi.fn(async () => ({ json: async () => ({ error: true, result: ['Not permission'] }) }))
    draw({ id: 7, owners: [ANA, BEN] })
    let result
    await act(async () => { result = await ui.handleDeleteBusinessOwner([ANA.id], { type: 'owners' }) })
    expect(result).toEqual({ ok: false, error: ['Not permission'] })
    expect(ui.businessState.business.owners).toEqual([ANA, BEN])
  })
})
