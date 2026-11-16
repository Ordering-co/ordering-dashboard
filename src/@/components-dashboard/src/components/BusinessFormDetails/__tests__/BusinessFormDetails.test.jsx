/* eslint-disable import/first */
// redesign stores 5.1a (decision 4): the store's Information form saves through this controller from a SaveBar and the
// leave guard, so `handleButtonUpdateClick` tells its caller how the save went (`{ ok: true }` or `{ ok: false, error }`) and
// `handleDiscardChanges` drops what the form holds. `silentToasts` (opt-in) leaves the feedback to the form.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  businesses: vi.fn(),
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { id: 3, level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ businesses: (id) => { mocks.businesses(id); return { save: mocks.save } } }]
}))
vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { BusinessFormDetails } from '../index'

const STORE = { id: 7, name: 'Sample Burgers', ribbon: { enabled: true, text: 'New', color: '#000000', shape: 'rectangle' } }

let ui
const draw = (props = {}) => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  return render(<BusinessFormDetails UIComponent={UI} business={STORE} {...props} />)
}

const type = (name, value) => act(() => { ui.handleChangeInput({ target: { name, value } }) })

beforeEach(() => {
  mocks.save.mockReset()
  mocks.businesses.mockReset()
  mocks.showToast.mockReset()
})

describe('BusinessFormDetails controller · the save says how it went', () => {
  it('returns { ok: true }, clears the changes, refreshes its callers and keeps the toasts by default', async () => {
    const handleSuccessUpdate = vi.fn()
    const handleUpdateBusinessState = vi.fn()
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7, name: 'Sample Grill' } } })
    draw({ handleSuccessUpdate, handleUpdateBusinessState })
    type('name', 'Sample Grill')
    let result
    await act(async () => { result = await ui.handleButtonUpdateClick() })
    expect(mocks.businesses).toHaveBeenCalledWith(7)
    expect(mocks.save).toHaveBeenCalledWith({ name: 'Sample Grill' }, { accessToken: 'test-token' })
    expect(result).toEqual({ ok: true })
    expect(ui.formState.changes).toEqual({})
    expect(ui.businessState.business.name).toBe('Sample Grill')
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ id: 7, name: 'Sample Grill' })
    expect(handleUpdateBusinessState).toHaveBeenCalledWith({ id: 7, name: 'Sample Grill' })
    expect(mocks.showToast.mock.calls.map(([kind]) => kind)).toEqual(['info', 'success'])
  })

  it('returns { ok: false, error } on an API error and keeps the changes', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['The name is too long'] } })
    draw()
    type('name', 'Sample Grill')
    let result
    await act(async () => { result = await ui.handleButtonUpdateClick() })
    expect(result).toEqual({ ok: false, error: ['The name is too long'] })
    expect(ui.formState.changes).toEqual({ name: 'Sample Grill' })
    expect(ui.formState.result).toEqual({ error: true, result: ['The name is too long'] })
    expect(ui.formState.loading).toBe(false)
  })

  it('returns { ok: false, error } when the request throws', async () => {
    mocks.save.mockRejectedValue(new Error('Network Error'))
    draw()
    type('name', 'Sample Grill')
    let result
    await act(async () => { result = await ui.handleButtonUpdateClick() })
    expect(result).toEqual({ ok: false, error: 'Network Error' })
    expect(ui.formState.changes).toEqual({ name: 'Sample Grill' })
  })

  it('with silentToasts the save shows no toast', async () => {
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7 } } })
    draw({ silentToasts: true })
    type('name', 'Sample Grill')
    await act(async () => { await ui.handleButtonUpdateClick() })
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('still sends the second request that turns the ribbon off', async () => {
    mocks.save
      .mockResolvedValueOnce({ content: { error: false, result: { id: 7, ribbon: { enabled: true } } } })
      .mockResolvedValueOnce({ content: { error: false, result: { id: 7, ribbon: { enabled: false } } } })
    draw()
    act(() => { ui.handleChangeRibbon({ enabled: false }) })
    let result
    await act(async () => { result = await ui.handleButtonUpdateClick() })
    expect(mocks.save).toHaveBeenNthCalledWith(2, { ribbon: { enabled: false } }, { accessToken: 'test-token' })
    expect(result).toEqual({ ok: true })
    expect(ui.businessState.business.ribbon.enabled).toBe(false)
  })
})

describe('BusinessFormDetails controller · discard', () => {
  it('handleDiscardChanges drops the changes and the last error', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Failed'] } })
    draw()
    type('name', 'Sample Grill')
    await act(async () => { await ui.handleButtonUpdateClick() })
    act(() => { ui.handleDiscardChanges() })
    expect(ui.formState.changes).toEqual({})
    expect(ui.formState.result).toEqual({ error: false })
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })
})
