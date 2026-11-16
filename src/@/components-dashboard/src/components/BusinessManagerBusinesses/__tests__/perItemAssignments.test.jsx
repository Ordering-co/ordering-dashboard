/* eslint-disable import/first */
// saving an owner's stores sends only the stores added or removed since the last save
// (POST/DELETE users/{id}/businesses/{business_id}).
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chain: null,
  showToast: vi.fn(),
  session: { token: 'token', user: { id: 1, level: 0 } },
  ordering: { root: 'https://api.test' },
  failId: null
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { BusinessManagerBusinesses } from '..'

const business = (id) => ({ id, name: `Store ${id}` })

const renderController = () => {
  const ui = { current: null }
  const UIComponent = (uiProps) => { ui.current = uiProps; return null }
  render(<BusinessManagerBusinesses UIComponent={UIComponent} userId={5} businesses={[1, 2, 3, 4].map(business)} />)
  return ui
}

const assignmentCalls = () => global.fetch.mock.calls
  .filter(([url]) => url.includes('/businesses/'))
  .map(([url, options]) => [options.method, url])

describe('BusinessManagerBusinesses · per item stores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.failId = null
    const chain = {}
    chain.setAccessToken = vi.fn(() => chain)
    chain.users = vi.fn(() => chain)
    chain.select = vi.fn(() => chain)
    chain.get = vi.fn(async () => ({ content: { error: false, result: { businesses: [business(1), business(2)] } } }))
    chain.save = vi.fn(async () => ({ content: { error: false, result: {} } }))
    mocks.chain = chain
    mocks.ordering = Object.assign(chain, { root: 'https://api.test' })
    global.fetch = vi.fn(async (url) => ({
      json: async () => (url.endsWith(`/${mocks.failId}`) ? { error: true, result: ['Not permission'] } : { error: false, result: [] })
    }))
  })
  afterEach(() => { delete global.fetch })

  it('sends one request per store added or removed and nothing else', async () => {
    const ui = renderController()
    await waitFor(() => expect(ui.current.savedBusinessIds).toEqual([1, 2]))
    act(() => { ui.current.handleSetSelectedBusinessIds([2, 3, 4]) })

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBusinesses() })

    expect(outcome).toEqual({ ok: true })
    expect(assignmentCalls()).toEqual([
      ['POST', 'https://api.test/users/5/businesses/3'],
      ['POST', 'https://api.test/users/5/businesses/4'],
      ['DELETE', 'https://api.test/users/5/businesses/1']
    ])
    expect(mocks.chain.save).not.toHaveBeenCalled()
    expect(ui.current.savedBusinessIds).toEqual([2, 3, 4])
  })

  it('stops at the first error and keeps as saved what was already sent', async () => {
    mocks.failId = 4
    const ui = renderController()
    await waitFor(() => expect(ui.current.savedBusinessIds).toEqual([1, 2]))
    act(() => { ui.current.handleSetSelectedBusinessIds([2, 3, 4]) })

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateBusinesses() })

    expect(outcome).toEqual({ ok: false, error: ['Not permission'] })
    expect(assignmentCalls()).toHaveLength(2)
    expect(ui.current.savedBusinessIds).toEqual([1, 2, 3])
  })
})
