/* eslint-disable import/first */
// redesign stores 2.F: the Snooze dialog of an extra needs to know how the save went. The handler sends only
// the changes it is given (no pending-changes state is involved), returns `{ ok: true }` / `{ ok: false, error }`, and an
// API error or a throw no longer leaves `extrasState.loading` stuck on true.
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

import { ProductExtras } from '../index'

const SNOOZE = '2026-10-11 18:50:00'

let ui
let handleSuccessUpdate
const draw = () => {
  ui = null
  handleSuccessUpdate = vi.fn()
  const extra = { id: 1, name: 'Cheese' }
  const UI = (props) => {
    ui = props
    return null
  }
  return render(
    <ProductExtras
      UIComponent={UI}
      business={{ id: 7, extras: [extra] }}
      product={{ id: 9, category_id: 2, extras: [{ id: 1, name: 'Cheese' }] }}
      handleSuccessUpdate={handleSuccessUpdate}
    />
  )
}

const answer = (content) => mocks.fetch.mockResolvedValue({ json: async () => content })

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProductExtras controller · handleUpdateExtraState', () => {
  it('sends only the given changes, updates the extra, shows the toast and returns { ok: true }', async () => {
    draw()
    answer({ error: false, result: { id: 1, snooze_until: SNOOZE } })
    let result
    await act(async () => { result = await ui.handleUpdateExtraState(1, { snooze_until: SNOOZE }) })
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://api.test/business/7/extras/1')
    expect(mocks.fetch.mock.calls[0][1].method).toBe('PUT')
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ snooze_until: SNOOZE })
    expect(result).toEqual({ ok: true })
    expect(ui.extrasState.loading).toBe(false)
    expect(ui.extrasState.extras[0]).toMatchObject({ id: 1, name: 'Cheese', snooze_until: SNOOZE })
    expect(handleSuccessUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenLastCalledWith('success', 'Extra saved')
  })

  it('sends null as null', async () => {
    draw()
    answer({ error: false, result: { id: 1, snooze_until: null } })
    await act(async () => { await ui.handleUpdateExtraState(1, { snooze_until: null }) })
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ snooze_until: null })
  })

  it('clears `loading` and returns { ok: false, error } when the API rejects, without any new toast or entity change', async () => {
    draw()
    answer({ error: true, result: ['Nope'] })
    let result
    await act(async () => { result = await ui.handleUpdateExtraState(1, { snooze_until: SNOOZE }) })
    expect(result).toEqual({ ok: false, error: ['Nope'] })
    expect(ui.extrasState.loading).toBe(false)
    expect(ui.extrasState.extras[0].snooze_until).toBeUndefined()
    expect(handleSuccessUpdate).not.toHaveBeenCalled()
    expect(mocks.showToast.mock.calls.map(([type]) => type)).toEqual(['info'])
  })

  it('clears `loading` and returns { ok: false, error } with the message when the request throws', async () => {
    draw()
    mocks.fetch.mockRejectedValue(new Error('Network down'))
    let result
    await act(async () => { result = await ui.handleUpdateExtraState(1, { snooze_until: SNOOZE }) })
    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.extrasState.loading).toBe(false)
    expect(handleSuccessUpdate).not.toHaveBeenCalled()
  })
})
