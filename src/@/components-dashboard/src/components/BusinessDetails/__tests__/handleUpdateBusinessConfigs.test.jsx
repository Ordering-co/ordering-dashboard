/* eslint-disable import/first */
// redesign stores 5.4: a section of the store editor (Preorders) saves several configs one after the other with
// the same handler it got on one render. Each save used to write `business.configs` from the state of that render, so the
// last one erased the others. Now the update is functional (every save lands) and the handler tells its caller how it went:
// `{ ok: true, result }` or `{ ok: false, error }`. Toasts and `actionStatus` stay as before.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  fetch: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', project: 'demo' }]
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

const CONFIGS = [1, 2, 3, 4, 5].map(id => ({ id, key: `config_${id}`, value: 'old' }))
const STORE = { id: 7, name: 'Sample Burgers', configs: CONFIGS }

let ui
const draw = () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessDetails UIComponent={UI} business={STORE} businessId={STORE.id} notGetSites notGetTaxes notGetStreamConnection />)
}

const answer = (body) => ({ json: async () => body })

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  vi.stubGlobal('fetch', mocks.fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessDetails controller · handleUpdateBusinessConfigs', () => {
  it('keeps all five configs updated when five saves run in a row with the handler of one render', async () => {
    mocks.fetch.mockImplementation(async (url, options) => {
      const id = Number(url.split('/').pop())
      return answer({ error: false, result: { id, key: `config_${id}`, value: JSON.parse(options.body).value } })
    })
    draw()
    const save = ui.handleUpdateBusinessConfigs
    const results = []
    await act(async () => {
      for (const id of [1, 2, 3, 4, 5]) results.push(await save(`new-${id}`, id))
    })
    expect(ui.businessState.business.configs).toEqual([1, 2, 3, 4, 5].map(id => ({ id, key: `config_${id}`, value: `new-${id}` })))
    expect(results).toEqual([1, 2, 3, 4, 5].map(id => ({ ok: true, result: { id, key: `config_${id}`, value: `new-${id}` } })))
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/business/7/configs/3', expect.objectContaining({ method: 'POST', body: JSON.stringify({ value: 'new-3' }) }))
    expect(ui.actionStatus).toEqual({ loading: false, error: null })
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Changes saved')
  })

  it('returns { ok: false, error } and sets actionStatus.error when the API rejects the save, leaving the configs alone', async () => {
    mocks.fetch.mockResolvedValue(answer({ error: true, result: ['Invalid value'] }))
    draw()
    let result
    await act(async () => { result = await ui.handleUpdateBusinessConfigs('bad', 2) })
    expect(result).toEqual({ ok: false, error: ['Invalid value'] })
    expect(ui.actionStatus).toEqual({ loading: false, error: ['Invalid value'] })
    expect(ui.businessState.business.configs).toEqual(CONFIGS)
  })

  it('returns { ok: false, error: [message] } and sets actionStatus.error when the request throws', async () => {
    mocks.fetch.mockRejectedValue(new Error('Network down'))
    draw()
    let result
    await act(async () => { result = await ui.handleUpdateBusinessConfigs('x', 2) })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.actionStatus).toEqual({ loading: false, error: ['Network down'] })
  })

  it('with inlineError it paints no «Loading» toast (the caller shows its own busy state); without the option it does', async () => {
    mocks.fetch.mockResolvedValue(answer({ error: false, result: { id: 2, key: 'config_2', value: 'new' } }))
    draw()
    await act(async () => { await ui.handleUpdateBusinessConfigs('new', 2, { inlineError: true }) })
    expect(mocks.showToast).not.toHaveBeenCalledWith('info', expect.anything())
    await act(async () => { await ui.handleUpdateBusinessConfigs('new', 2) })
    expect(mocks.showToast).toHaveBeenCalledWith('info', 'Loading')
  })

  it('with inlineError, returns the failure but leaves actionStatus.error empty (the caller paints it, the editor alert stays shut)', async () => {
    mocks.fetch.mockResolvedValueOnce(answer({ error: true, result: ['Invalid value'] }))
    mocks.fetch.mockRejectedValueOnce(new Error('Network down'))
    draw()
    let rejected
    let thrown
    await act(async () => { rejected = await ui.handleUpdateBusinessConfigs('bad', 2, { inlineError: true }) })
    expect(rejected).toEqual({ ok: false, error: ['Invalid value'] })
    expect(ui.actionStatus).toEqual({ loading: false, error: null })
    await act(async () => { thrown = await ui.handleUpdateBusinessConfigs('x', 2, { inlineError: true }) })
    expect(thrown).toEqual({ ok: false, error: ['Network down'] })
    expect(ui.actionStatus).toEqual({ loading: false, error: null })
  })
})
