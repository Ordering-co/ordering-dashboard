/* eslint-disable import/first */
// redesign stores 4.B (decision 6, G1-27): Duplicate went out on every click (two clicks, two copies) and the
// toast did not say which store was created. Now a second call while the first one is on its way does nothing, the handler
// tells its caller how it went (`{ ok: true, result }` or `{ ok: false, error }`), and the toast names the copy.
// Decision 3: the editor's request asks for `snooze_until` too (one field more), so the Overview can say a snooze is on.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    root: 'https://api.test',
    project: 'demo',
    businesses: () => ({ save: vi.fn() }),
    setAccessToken: () => ({
      businesses: () => {
        const endpoint = { asDashboard: () => endpoint, select: (params) => { mocks.select(params); return endpoint }, get: () => new Promise(() => {}) }
        return endpoint
      }
    })
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

const STORE = { id: 7, name: 'Sample Burgers', slug: 'sample' }

let ui
const draw = (props = {}) => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  return render(<BusinessDetails UIComponent={UI} business={STORE} businessId={STORE.id} notGetSites notGetTaxes notGetStreamConnection {...props} />)
}

const toasts = () => mocks.showToast.mock.calls.map(([type, message]) => [type, message])

const answer = (content) => ({ json: async () => content })

beforeEach(() => {
  mocks.select.mockReset()
  mocks.showToast.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessDetails controller · handleDuplicateBusiness', () => {
  it('sends one request while the first is on its way, and returns { ok: true, result } with a toast that names the copy', async () => {
    let release
    const fetch = vi.fn(() => new Promise(resolve => { release = resolve }))
    vi.stubGlobal('fetch', fetch)
    const handleSucessAddBusiness = vi.fn()
    draw({ handleSucessAddBusiness })

    let first, second
    await act(async () => {
      first = ui.handleDuplicateBusiness()
      second = ui.handleDuplicateBusiness()
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('https://api.test/business/7/duplicate')
    expect(await second).toEqual({ ok: false, busy: true })

    await act(async () => { release(answer({ error: false, result: { id: 8, name: 'Sample Burgers (copy)' } })) })
    expect(await first).toEqual({ ok: true, result: { id: 8, name: 'Sample Burgers (copy)' } })
    expect(handleSucessAddBusiness).toHaveBeenCalledWith({ id: 8, name: 'Sample Burgers (copy)' })
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Created «Sample Burgers (copy)»']])

    // once it has answered, it can go again
    fetch.mockImplementation(() => Promise.resolve(answer({ error: false, result: { id: 9 } })))
    await act(async () => { await ui.handleDuplicateBusiness() })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(toasts().at(-1)).toEqual(['success', 'Business duplicated'])
  })

  it('returns { ok: false, error } and reports it through actionStatus when the API says no', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(answer({ error: true, result: ['Not allowed'] }))))
    draw()
    let result
    await act(async () => { result = await ui.handleDuplicateBusiness() })
    expect(result).toEqual({ ok: false, error: ['Not allowed'] })
    expect(ui.actionStatus.error).toEqual(['Not allowed'])
  })

  it('returns { ok: false, error } when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    draw()
    let result
    await act(async () => { result = await ui.handleDuplicateBusiness() })
    expect(result).toEqual({ ok: false, error: ['offline'] })
    expect(ui.actionStatus.error).toEqual(['offline'])
  })
})

describe('BusinessDetails controller · propsToFetch', () => {
  it('asks for snooze_until with the rest of the editor request', () => {
    draw({ business: undefined })
    expect(mocks.select).toHaveBeenCalled()
    expect(mocks.select.mock.calls[0][0]).toContain('snooze_until')
  })
})
