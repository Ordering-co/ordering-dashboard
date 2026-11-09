import React from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BusinessDetails } from './index'

const context = vi.hoisted(() => ({ root: 'https://api.test', token: 'test-token' }))
vi.mock('../../contexts/ApiContext', () => ({ useApi: () => [{ root: context.root }] }))
vi.mock('../../contexts/SessionContext', () => ({ useSession: () => [{ token: context.token }] }))
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => [null, { showToast: vi.fn() }], ToastType: {} }))
vi.mock('../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_key, fallback) => fallback] }))
vi.mock('../../contexts/EventContext', () => ({ useEvent: () => [{ emit: vi.fn() }] }))
vi.mock('../../contexts/AssistantContext', () => ({ useAssistantRecordChanges: vi.fn() }))

const response = (result = []) => ({ ok: true, json: async () => ({ error: false, result }) })
const business = { id: 1, taxes: [7] }
let controller
const UI = props => { controller = props; return null }
const component = (props = {}) => <BusinessDetails business={business} UIComponent={UI} notGetSites notGetStreamConnection {...props} />

beforeEach(() => {
  context.root = 'https://api.test'
  context.token = 'test-token'
  controller = null
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BusinessDetails tax catalog', () => {
  it.each([
    ['network', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['HTTP', () => ({ ...response([{ id: 7 }]), ok: false, status: 503 })],
    ['JSON', () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON') } })],
    ['API', () => ({ ok: true, json: async () => ({ error: true, result: [] }) })],
    ['payload', () => response({})],
    ['entry', () => response([{ name: 'No id' }])]
  ])('settles %s failures without rejecting or locking tax mutations', async (_name, fail) => {
    vi.stubGlobal('fetch', vi.fn(fail))
    render(component())
    await waitFor(() => expect(controller.taxCatalogState.loading).toBe(false))
    expect(controller.taxCatalogState.error).toBeTruthy()
    expect(controller.taxCatalogState.loaded).toBe(false)
    expect(controller.formTaxState.loading).toBe(false)
    expect(controller.taxes).toEqual({})
    expect(controller.businessState.business.taxes).toEqual([7])
  })

  it('retries successfully and retains loaded taxes and edits on a failed refresh', async () => {
    const tax = { id: 7, name: 'VAT', rate: 10 }
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(response([tax])).mockRejectedValueOnce(new TypeError('Offline'))
    vi.stubGlobal('fetch', fetch)
    render(component())
    await waitFor(() => expect(controller.taxCatalogState.error).toBeTruthy())
    await act(async () => { await controller.getTaxes() })
    expect(controller.taxCatalogState).toEqual({ loading: false, loaded: true, error: null })
    expect(controller.formTaxState.loading).toBe(false)
    act(() => controller.setFormState(prev => ({ ...prev, changes: { taxes: [7], name: 'Edited' } })))
    await act(async () => { await controller.getTaxes() })
    expect(controller.taxes).toEqual({ 'id:7': tax })
    expect(controller.taxCatalogState).toEqual({ loading: false, loaded: true, error: 'Offline' })
    expect(controller.formState.changes).toEqual({ taxes: [7], name: 'Edited' })
    expect(fetch).toHaveBeenCalledWith('https://api.test/taxes', expect.objectContaining({
      method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer test-token' })
    }))
  })

  it('accepts an empty catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
    render(component())
    await waitFor(() => expect(controller.taxCatalogState.loaded).toBe(true))
    expect(controller.taxCatalogState.loading).toBe(false)
    expect(controller.taxes).toEqual({})
  })

  it('aborts obsolete requests and ignores stale results when the API context changes', async () => {
    let resolveOld
    const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValue(response([{ id: 9 }]))
    vi.stubGlobal('fetch', fetch)
    const view = render(component())
    const oldSignal = fetch.mock.calls[0][1].signal
    context.root = 'https://other-api.test'
    context.token = 'new-token'
    view.rerender(component())
    await waitFor(() => expect(controller.taxCatalogState.loaded).toBe(true))
    expect(oldSignal.aborted).toBe(true)
    await act(async () => { resolveOld(response([{ id: 7 }])) })
    expect(controller.taxes).toEqual({ 'id:9': { id: 9 } })
    expect(fetch).toHaveBeenLastCalledWith('https://other-api.test/taxes', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer new-token' })
    }))
    const latestSignal = fetch.mock.calls[1][1].signal
    view.unmount()
    expect(latestSignal.aborted).toBe(true)
  })

  it('honors notGetTaxes', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(component({ notGetTaxes: true }))
    expect(fetch).not.toHaveBeenCalled()
    expect(controller.taxCatalogState.loading).toBe(false)
  })
})
