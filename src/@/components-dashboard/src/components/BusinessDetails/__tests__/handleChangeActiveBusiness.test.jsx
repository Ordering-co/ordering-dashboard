/* eslint-disable import/first */
// redesign SL-F1 (A3): `handleChangeActiveBusiness` of the BusinessDetails controller tells its caller how the save went:
// `{ ok: true }` when it was saved, `{ ok: false, error }` on an API error or an exception. The list switches (StoreRowSwitch)
// need it to go back to the stored value; the other consumers ignore it. No toast is added: the success toast stays, the failure
// still only sets `actionStatus` (the editor's Alert reads it).
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  businesses: vi.fn(),
  showToast: vi.fn(),
  hideToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{
    root: 'https://api.test',
    project: 'demo',
    setAccessToken: () => ({ businesses: (id) => { mocks.businesses(id); return { save: mocks.save } } })
  }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast, hideToast: mocks.hideToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))
vi.mock('../../../contexts/EventContext', () => ({
  useEvent: () => [{ emit: vi.fn() }]
}))
vi.mock('../../../contexts/AssistantContext', () => ({
  useAssistantRecordChanges: () => {}
}))

import { BusinessDetails } from '../index'

const STORE = { id: 7, name: 'Sample Burgers', enabled: true, featured: false }

let ui
const draw = () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessDetails UIComponent={UI} business={STORE} businessId={STORE.id} notGetSites notGetTaxes notGetStreamConnection />)
}

beforeEach(() => {
  mocks.save.mockReset()
  mocks.businesses.mockReset()
  mocks.showToast.mockReset()
  mocks.hideToast.mockReset()
})

describe('BusinessDetails controller · handleChangeActiveBusiness returns how the save went', () => {
  it('returns { ok: true } and keeps the success toast when the save works', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7, enabled: false } } })
    draw()
    let result
    await act(async () => { result = await ui.handleChangeActiveBusiness(false) })
    expect(mocks.businesses).toHaveBeenCalledWith(7)
    expect(mocks.save).toHaveBeenCalledWith({ enabled: false })
    expect(result).toEqual({ ok: true })
    expect(ui.businessState.business.enabled).toBe(false)
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info', 'success'])
    // redesign bugs F row 19: the success toast replaces «Loading»; nothing to hide
    expect(mocks.hideToast).not.toHaveBeenCalled()
  })

  it('saves Featured as { featured } and returns { ok: true }', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7, featured: true } } })
    draw()
    let result
    await act(async () => { result = await ui.handleChangeActiveBusiness(true, true) })
    expect(mocks.save).toHaveBeenCalledWith({ featured: true })
    expect(result).toEqual({ ok: true })
  })

  it('returns { ok: false, error } on an API error, leaves the store as it was and adds no error toast', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Internal error'] } })
    draw()
    let result
    await act(async () => { result = await ui.handleChangeActiveBusiness(false) })
    expect(result).toEqual({ ok: false, error: ['Internal error'] })
    expect(ui.businessState.business.enabled).toBe(true)
    expect(ui.actionStatus.error).toEqual(['Internal error'])
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info'])
    // redesign bugs F row 19: no error toast replaces «Loading», so the failure hides it
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })

  it('returns { ok: false, error } when the request throws, and still sets actionStatus', async () => {
    mocks.save.mockRejectedValue(new Error('Network down'))
    draw()
    let result
    await act(async () => { result = await ui.handleChangeActiveBusiness(false) })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.actionStatus.error).toEqual(['Network down'])
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info'])
    expect(mocks.hideToast).toHaveBeenCalledTimes(1)
  })
})
