/* eslint-disable import/first */
// redesign stores 2.F: the Snooze dialog saves only `snooze_until` through this handler with
// `{ keepPendingChanges: true }`. Without that option the handler behaves as it always did (sends every pending change,
// clears them on success, keeps them and sets `error` on failure).
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

const SNOOZE = '2026-10-11 18:50:00'
const DATA = { distance: 5, unit: 'km' }

let ui
let zone
let business
let handleSuccessUpdate
const draw = () => {
  ui = null
  zone = { id: 3, name: 'Zone A' }
  business = { id: 7, zones: [zone] }
  handleSuccessUpdate = vi.fn()
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessDeliveryZone UIComponent={UI} business={business} zone={zone} handleSuccessUpdate={handleSuccessUpdate} />)
}

const answer = (content) => mocks.fetch.mockResolvedValue({ json: async () => content })
const sentBody = () => JSON.parse(mocks.fetch.mock.calls[0][1].body)
const typeName = async (value) => {
  await act(async () => { ui.handleChangeInput({ target: { name: 'name', value } }) })
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessDeliveryZone controller · handleUpdateBusinessDeliveryZone', () => {
  describe('without keepPendingChanges (as every caller does today)', () => {
    it('sends every pending change, stringifies `data`, clears the changes and returns { ok: true }', async () => {
      draw()
      await typeName('Draft')
      await act(async () => { ui.handleChangeInput({ target: { name: 'distance', value: 5 } }, 'km') })
      answer({ error: false, result: { id: 3, name: 'Draft' } })
      let result
      await act(async () => { result = await ui.handleUpdateBusinessDeliveryZone() })
      expect(mocks.fetch.mock.calls[0][0]).toBe('https://api.test/business/7/deliveryzones/3')
      expect(mocks.fetch.mock.calls[0][1].method).toBe('PUT')
      expect(sentBody()).toEqual({ name: 'Draft', data: JSON.stringify(DATA) })
      expect(result).toEqual({ ok: true })
      expect(ui.formState.changes).toEqual({})
      expect(ui.formState.loading).toBe(false)
      expect(handleSuccessUpdate).toHaveBeenCalledTimes(1)
      expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Delivery zone saved')
    })

    it('ignores an event and an explicit changes object without the option', async () => {
      draw()
      await typeName('Draft')
      answer({ error: false, result: { id: 3 } })
      await act(async () => { await ui.handleUpdateBusinessDeliveryZone({ type: 'click' }) })
      expect(sentBody()).toEqual({ name: 'Draft' })
      mocks.fetch.mockClear()
      await typeName('Draft 2')
      await act(async () => { await ui.handleUpdateBusinessDeliveryZone({ snooze_until: SNOOZE }) })
      expect(sentBody()).toEqual({ name: 'Draft 2' })
    })

    it('keeps the changes, sets `error` and returns { ok: false, error } when the API rejects', async () => {
      draw()
      await typeName('Draft')
      answer({ error: true, result: ['Nope'] })
      let result
      await act(async () => { result = await ui.handleUpdateBusinessDeliveryZone() })
      expect(result).toEqual({ ok: false, error: ['Nope'] })
      expect(ui.formState.changes).toEqual({ name: 'Draft' })
      expect(ui.formState.error).toEqual(['Nope'])
      expect(ui.formState.loading).toBe(false)
    })

    it('sets `error` and returns { ok: false, error } when the request throws', async () => {
      draw()
      await typeName('Draft')
      mocks.fetch.mockRejectedValue(new Error('Network down'))
      let result
      await act(async () => { result = await ui.handleUpdateBusinessDeliveryZone() })
      expect(result).toEqual({ ok: false, error: 'Network down' })
      expect(ui.formState.changes).toEqual({ name: 'Draft' })
      expect(ui.formState.error).toEqual(['Network down'])
    })
  })

  describe('with { keepPendingChanges: true }', () => {
    it('sends only the given keys and keeps the other pending edits (same changes object when nothing was removed)', async () => {
      draw()
      await typeName('Draft')
      const pending = ui.formState.changes
      answer({ error: false, result: { id: 3, snooze_until: SNOOZE } })
      let result
      await act(async () => { result = await ui.handleUpdateBusinessDeliveryZone({ snooze_until: SNOOZE }, { keepPendingChanges: true }) })
      expect(sentBody()).toEqual({ snooze_until: SNOOZE })
      expect(result).toEqual({ ok: true })
      expect(ui.formState.changes).toBe(pending)
      expect(ui.formState.changes).toEqual({ name: 'Draft' })
      expect(ui.formState.loading).toBe(false)
      expect(zone.snooze_until).toBe(SNOOZE)
      expect(handleSuccessUpdate).toHaveBeenCalledTimes(1)
      expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Delivery zone saved')
    })

    it('removes only the sent keys from the pending changes', async () => {
      draw()
      await typeName('Draft')
      await act(async () => { ui.handleChangeFormState({ snooze_until: '2026-01-01 00:00:00' }) })
      answer({ error: false, result: { id: 3, snooze_until: SNOOZE } })
      await act(async () => { await ui.handleUpdateBusinessDeliveryZone({ snooze_until: SNOOZE }, { keepPendingChanges: true }) })
      expect(ui.formState.changes).toEqual({ name: 'Draft' })
    })

    it('stringifies `data` like the plain path and sends null as null', async () => {
      draw()
      answer({ error: false, result: { id: 3 } })
      await act(async () => { await ui.handleUpdateBusinessDeliveryZone({ data: DATA, snooze_until: null }, { keepPendingChanges: true }) })
      expect(sentBody()).toEqual({ data: JSON.stringify(DATA), snooze_until: null })
    })

    it('leaves the changes, `error` and the entity alone and returns { ok: false, error } when the API rejects', async () => {
      draw()
      await typeName('Draft')
      const pending = ui.formState.changes
      answer({ error: true, result: ['Nope'] })
      let result
      await act(async () => { result = await ui.handleUpdateBusinessDeliveryZone({ snooze_until: SNOOZE }, { keepPendingChanges: true }) })
      expect(result).toEqual({ ok: false, error: ['Nope'] })
      expect(ui.formState.changes).toBe(pending)
      expect(ui.formState.error).toBe(null)
      expect(ui.formState.loading).toBe(false)
      expect(handleSuccessUpdate).not.toHaveBeenCalled()
      expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info'])
    })

    it('does the same when the request throws', async () => {
      draw()
      await typeName('Draft')
      const pending = ui.formState.changes
      mocks.fetch.mockRejectedValue(new Error('Network down'))
      let result
      await act(async () => { result = await ui.handleUpdateBusinessDeliveryZone({ snooze_until: SNOOZE }, { keepPendingChanges: true }) })
      expect(result).toEqual({ ok: false, error: 'Network down' })
      expect(ui.formState.changes).toBe(pending)
      expect(ui.formState.error).toBe(null)
      expect(ui.formState.loading).toBe(false)
    })
  })
})
