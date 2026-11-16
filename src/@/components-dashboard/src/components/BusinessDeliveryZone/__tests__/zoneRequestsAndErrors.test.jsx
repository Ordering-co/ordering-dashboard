/* eslint-disable import/first */
// redesign stores 5.8 (2.3): G3-20 (`error` is cleared when a request starts and on every edit, so the notice does not
// reopen while typing), add and delete answer `{ ok }` like update does, and the controller hands `cleanFormState` to the UI as
// `handleDiscardChanges` (the leave guard's Discard).
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  fetch: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))

import { BusinessDeliveryZone } from '../index'

let ui
let zone
let business
let handleSuccessUpdate
let onClose
const draw = (zoneProp = { id: 3, name: 'Zone A' }) => {
  ui = null
  zone = zoneProp
  business = { id: 7, zones: zone ? [zone] : [] }
  handleSuccessUpdate = vi.fn()
  onClose = vi.fn()
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessDeliveryZone UIComponent={UI} business={business} zone={zone} handleSuccessUpdate={handleSuccessUpdate} onClose={onClose} />)
}

const answer = (content) => mocks.fetch.mockResolvedValue({ json: async () => content })
const sentBody = () => JSON.parse(mocks.fetch.mock.calls[0][1].body)
const typeName = async (value) => {
  await act(async () => { ui.handleChangeInput({ target: { name: 'name', value } }) })
}
// a request that stays open until `finish` is called
const hold = () => {
  let finish
  mocks.fetch.mockReturnValue(new Promise(resolve => { finish = (content) => resolve({ json: async () => content }) }))
  return (content) => finish(content)
}
const failUpdate = async () => {
  answer({ error: true, result: ['Nope'] })
  await act(async () => { await ui.handleUpdateBusinessDeliveryZone() })
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessDeliveryZone controller · G3-20 `error` does not outlive its cause', () => {
  it('is cleared by handleChangeInput', async () => {
    draw()
    await typeName('Draft')
    await failUpdate()
    expect(ui.formState.error).toEqual(['Nope'])
    await typeName('Draft 2')
    expect(ui.formState.error).toBe(null)
    expect(ui.formState.changes).toEqual({ name: 'Draft 2' })
  })

  it('is cleared by handleChangeInput on the distance too', async () => {
    draw()
    await typeName('Draft')
    await failUpdate()
    await act(async () => { ui.handleChangeInput({ target: { name: 'distance', value: '4' } }, 'km') })
    expect(ui.formState.error).toBe(null)
    expect(ui.formState.changes.data).toEqual({ distance: '4', unit: 'km' })
  })

  it('is cleared by handleChangeFormState', async () => {
    draw()
    await typeName('Draft')
    await failUpdate()
    await act(async () => { ui.handleChangeFormState({ type: 1 }) })
    expect(ui.formState.error).toBe(null)
    expect(ui.formState.changes).toEqual({ name: 'Draft', type: 1 })
  })

  it('keeps every edit made in the same tick (functional updates)', async () => {
    draw()
    await act(async () => {
      ui.handleChangeInput({ target: { name: 'name', value: 'A' } })
      ui.handleChangeInput({ target: { name: 'minimum', value: '5' } })
      ui.handleChangeFormState({ type: 1 })
    })
    expect(ui.formState.changes).toEqual({ name: 'A', minimum: '5', type: 1 })
  })

  it('is cleared when an update starts, and a stale error does not come back when it succeeds', async () => {
    draw()
    await typeName('Draft')
    await failUpdate()
    expect(ui.formState.error).toEqual(['Nope'])
    const finish = hold()
    let pending
    await act(async () => { pending = ui.handleUpdateBusinessDeliveryZone() })
    expect(ui.formState.loading).toBe(true)
    expect(ui.formState.error).toBe(null)
    await act(async () => { finish({ error: false, result: { id: 3 } }); await pending })
    expect(ui.formState.error).toBe(null)
    expect(ui.formState.changes).toEqual({})
  })

  it('is cleared when an add starts, and when a delete starts', async () => {
    draw(null)
    await typeName('New')
    answer({ error: true, result: ['Nope'] })
    await act(async () => { await ui.handleAddBusinessDeliveryZone() })
    expect(ui.formState.error).toEqual(['Nope'])
    const finishAdd = hold()
    let pendingAdd
    await act(async () => { pendingAdd = ui.handleAddBusinessDeliveryZone() })
    expect(ui.formState.error).toBe(null)
    await act(async () => { finishAdd({ error: true, result: ['Again'] }); await pendingAdd })
    expect(ui.formState.error).toEqual(['Again'])
  })

  it('is cleared when a delete starts', async () => {
    draw()
    // a save that failed leaves its error (a failed delete no longer does: review R5.8-01)
    await failUpdate()
    expect(ui.formState.error).toEqual(['Nope'])
    const finish = hold()
    let pending
    await act(async () => { pending = ui.handleDeleteBusinessDeliveryZone() })
    expect(ui.formState.error).toBe(null)
    await act(async () => { finish({ error: false, result: true }); await pending })
    expect(ui.formState.error).toBe(null)
  })
})

describe('BusinessDeliveryZone controller · handleAddBusinessDeliveryZone', () => {
  it('posts the changes, closes the panel and returns { ok: true }', async () => {
    draw(null)
    await typeName('New zone')
    await act(async () => { ui.handleChangeFormState({ data: { distance: '4', unit: 'km' } }) })
    answer({ error: false, result: { id: 9, name: 'New zone' } })
    let result
    await act(async () => { result = await ui.handleAddBusinessDeliveryZone() })
    expect(result).toEqual({ ok: true })
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://api.test/business/7/deliveryzones')
    expect(mocks.fetch.mock.calls[0][1].method).toBe('POST')
    const body = sentBody()
    expect(body).toMatchObject({ name: 'New zone', data: JSON.stringify({ distance: '4', unit: 'km' }), type: 2, enabled: true })
    expect(JSON.parse(body.schedule)).toHaveLength(7)
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ ...business, zones: [{ id: 9, name: 'New zone' }] })
    expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Delivery zone added')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(ui.formState.changes).toEqual({})
    expect(ui.formState.loading).toBe(false)
  })

  it('keeps the form, sets `error` and returns { ok: false, error } when the API rejects', async () => {
    draw(null)
    await typeName('New zone')
    answer({ error: true, result: ['Nope'] })
    let result
    await act(async () => { result = await ui.handleAddBusinessDeliveryZone() })
    expect(result).toEqual({ ok: false, error: ['Nope'] })
    expect(ui.formState.error).toEqual(['Nope'])
    expect(ui.formState.changes).toEqual({ name: 'New zone' })
    expect(ui.formState.loading).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
    expect(handleSuccessUpdate).not.toHaveBeenCalled()
  })

  it('returns { ok: false, error } when the request throws', async () => {
    draw(null)
    await typeName('New zone')
    mocks.fetch.mockRejectedValue(new Error('Network down'))
    let result
    await act(async () => { result = await ui.handleAddBusinessDeliveryZone() })
    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.formState.error).toBe('Network down')
    expect(ui.formState.loading).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('BusinessDeliveryZone controller · handleDeleteBusinessDeliveryZone', () => {
  it('deletes, updates the business, closes the panel and returns { ok: true }', async () => {
    draw()
    answer({ error: false, result: true })
    let result
    await act(async () => { result = await ui.handleDeleteBusinessDeliveryZone() })
    expect(result).toEqual({ ok: true })
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://api.test/business/7/deliveryzones/3')
    expect(mocks.fetch.mock.calls[0][1].method).toBe('DELETE')
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ ...business, zones: [] })
    expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Business delivery zone deleted')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(ui.formState.loading).toBe(false)
  })

  // review R5.8-01: the delete's failure is said once, by its confirmation (ZoneDetails), not again in the form
  it('returns { ok: false, error } when the API rejects, and leaves the form error alone', async () => {
    draw()
    answer({ error: true, result: ['Nope'] })
    let result
    await act(async () => { result = await ui.handleDeleteBusinessDeliveryZone() })
    expect(result).toEqual({ ok: false, error: ['Nope'] })
    expect(ui.formState.error).toBeNull()
    expect(ui.formState.loading).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
    expect(handleSuccessUpdate).not.toHaveBeenCalled()
  })

  it('returns { ok: false, error } when the request throws', async () => {
    draw()
    mocks.fetch.mockRejectedValue(new Error('Network down'))
    let result
    await act(async () => { result = await ui.handleDeleteBusinessDeliveryZone() })
    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.formState.error).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('BusinessDeliveryZone controller · handleDiscardChanges', () => {
  it('drops the pending changes and the error', async () => {
    draw()
    await typeName('Draft')
    await failUpdate()
    await typeName('Draft 2')
    expect(ui.formState.changes).toEqual({ name: 'Draft 2' })
    await act(async () => { ui.handleDiscardChanges() })
    expect(ui.formState).toEqual({ loading: false, changes: {}, error: null })
  })
})
