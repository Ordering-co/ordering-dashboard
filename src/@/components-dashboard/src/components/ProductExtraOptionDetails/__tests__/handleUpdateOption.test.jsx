/* eslint-disable import/first */
// redesign stores 2.F: `handleUpdateOption(change)` of the option editor.
// Without options it behaves as before (it sends `change`, empties `settingChangeState.changes` once saved, leaves the state
// alone on an API error) and now also answers `{ ok: true }` / `{ ok: false, error }`. With `{ keepPendingChanges: true }`
// (the Snooze dialog) it sends only the given keys, keeps the other pending settings, does not set `settingChangeState.error`
// (the dialog shows the error inline) and always clears `loading`.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  showToast: vi.fn()
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
  useLanguage: () => [{}, (_key, text) => text]
}))

import { ProductExtraOptionDetails } from '../index'

const SNOOZE = { snooze_until: '2026-10-11 18:50:00' }

let ui
let props
const draw = () => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  const option = { id: 9, name: 'Size', suboptions: [] }
  props = {
    UIComponent: UI,
    business: { id: 3, extras: [], categories: [] },
    extra: { id: 4, options: [option] },
    option,
    handleUpdateBusinessState: vi.fn()
  }
  render(<ProductExtraOptionDetails {...props} />)
}

const answer = (content) => ({ json: async () => content })
const sentBody = () => JSON.parse(mocks.fetch.mock.calls[0][1].body)
const toastTypes = () => mocks.showToast.mock.calls.map(([type]) => type)
const markPending = (values) => act(() => { ui.handleChangeSettingsChangeState(values) })

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.showToast.mockReset()
  global.fetch = mocks.fetch
})

describe('ProductExtraOptionDetails controller · handleUpdateOption without options', () => {
  it('sends the change, empties the pending change once saved and answers { ok: true }', async () => {
    mocks.fetch.mockResolvedValue(answer({ error: false, result: { id: 9, name: 'Size', external_id: 'x1' } }))
    draw()
    markPending({ external_id: 'x1' })

    let result
    await act(async () => { result = await ui.handleUpdateOption({ external_id: 'x1' }) })

    expect(result).toEqual({ ok: true })
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://api.test/business/3/extras/4/options/9')
    expect(sentBody()).toEqual({ external_id: 'x1' })
    expect(ui.settingChangeState).toEqual({ changes: {}, loading: false })
    expect(ui.optionState.option.external_id).toBe('x1')
    expect(toastTypes()).toEqual(['info', 'success'])
  })

  it('answers { ok: false, error } on an API error and keeps the pending change', async () => {
    mocks.fetch.mockResolvedValue(answer({ error: true, result: ['Nope'] }))
    draw()
    markPending({ external_id: 'x1' })

    let result
    await act(async () => { result = await ui.handleUpdateOption({ external_id: 'x1' }) })

    expect(result).toEqual({ ok: false, error: ['Nope'] })
    expect(ui.settingChangeState.changes).toEqual({ external_id: 'x1' })
    expect(toastTypes()).toEqual(['info'])
  })

  it('answers { ok: false, error } and keeps the message in settingChangeState.error when the request throws', async () => {
    mocks.fetch.mockRejectedValue(new Error('Network down'))
    draw()

    let result
    await act(async () => { result = await ui.handleUpdateOption({ external_id: 'x1' }) })

    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.settingChangeState.error).toBe('Network down')
    expect(ui.settingChangeState.loading).toBe(false)
  })

  it('ignores a second argument that is not the option (react-hook-form passes the event)', async () => {
    mocks.fetch.mockResolvedValue(answer({ error: false, result: { id: 9 } }))
    draw()

    await act(async () => { await ui.handleUpdateOption({ external_id: 'x1' }, { type: 'submit' }) })

    expect(ui.settingChangeState).toEqual({ changes: {}, loading: false })
  })
})

describe('ProductExtraOptionDetails controller · handleUpdateOption with { keepPendingChanges: true }', () => {
  it('sends only the given keys, keeps the other pending settings and answers { ok: true }', async () => {
    mocks.fetch.mockResolvedValue(answer({ error: false, result: { id: 9, name: 'Size', ...SNOOZE } }))
    draw()
    markPending({ name: 'Draft' })

    let result
    await act(async () => { result = await ui.handleUpdateOption(SNOOZE, { keepPendingChanges: true }) })

    expect(result).toEqual({ ok: true })
    expect(sentBody()).toEqual(SNOOZE)
    expect(ui.settingChangeState.changes).toEqual({ name: 'Draft' })
    expect(ui.settingChangeState.loading).toBe(false)
    expect(ui.settingChangeState.error).toBeNull()
    // the option shown is updated, with the success toast it already had
    expect(ui.optionState.option.snooze_until).toBe(SNOOZE.snooze_until)
    expect(toastTypes()).toEqual(['info', 'success'])
  })

  it('keeps snooze_until: null in the request ("Off")', async () => {
    mocks.fetch.mockResolvedValue(answer({ error: false, result: { id: 9, snooze_until: null } }))
    draw()

    await act(async () => { await ui.handleUpdateOption({ snooze_until: null }, { keepPendingChanges: true }) })

    expect(sentBody()).toEqual({ snooze_until: null })
  })

  it('keeps the very same changes object when none of the sent keys was pending', async () => {
    mocks.fetch.mockResolvedValue(answer({ error: false, result: { id: 9, ...SNOOZE } }))
    draw()
    markPending({ name: 'Draft' })
    const changesBefore = ui.settingChangeState.changes

    await act(async () => { await ui.handleUpdateOption(SNOOZE, { keepPendingChanges: true }) })

    expect(ui.settingChangeState.changes).toBe(changesBefore)
  })

  it('removes a sent key that was also pending', async () => {
    mocks.fetch.mockResolvedValue(answer({ error: false, result: { id: 9, ...SNOOZE } }))
    draw()
    markPending({ name: 'Draft', snooze_until: 'old' })

    await act(async () => { await ui.handleUpdateOption(SNOOZE, { keepPendingChanges: true }) })

    expect(ui.settingChangeState.changes).toEqual({ name: 'Draft' })
  })

  it('on an API error leaves changes and error as they were, clears loading and answers { ok: false, error }', async () => {
    mocks.fetch.mockResolvedValue(answer({ error: true, result: ['Nope'] }))
    draw()
    markPending({ name: 'Draft' })
    const changesBefore = ui.settingChangeState.changes

    let result
    await act(async () => { result = await ui.handleUpdateOption(SNOOZE, { keepPendingChanges: true }) })

    expect(result).toEqual({ ok: false, error: ['Nope'] })
    expect(ui.settingChangeState.changes).toBe(changesBefore)
    expect(ui.settingChangeState.error).toBeNull()
    expect(ui.settingChangeState.loading).toBe(false)
    expect(ui.optionState.option.snooze_until).toBeUndefined()
    expect(toastTypes()).toEqual(['info'])
  })

  it('on a throw leaves changes and error as they were, clears loading and answers { ok: false, error }', async () => {
    mocks.fetch.mockRejectedValue(new Error('Network down'))
    draw()
    markPending({ name: 'Draft' })
    const changesBefore = ui.settingChangeState.changes

    let result
    await act(async () => { result = await ui.handleUpdateOption(SNOOZE, { keepPendingChanges: true }) })

    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.settingChangeState.changes).toBe(changesBefore)
    expect(ui.settingChangeState.error).toBeNull()
    expect(ui.settingChangeState.loading).toBe(false)
  })

  it('keeps a setting changed while the request is in flight', async () => {
    let release
    mocks.fetch.mockReturnValue(new Promise(resolve => { release = resolve }))
    draw()
    markPending({ name: 'Draft' })
    let pending
    act(() => { pending = ui.handleUpdateOption(SNOOZE, { keepPendingChanges: true }) })
    markPending({ name: 'Draft', min: 2 })
    await act(async () => {
      release(answer({ error: false, result: { id: 9, ...SNOOZE } }))
      await pending
    })

    expect(ui.settingChangeState.changes).toEqual({ name: 'Draft', min: 2 })
  })
})
