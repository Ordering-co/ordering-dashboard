/* eslint-disable import/first */
// redesign stores 5.14 (A-3): contract of the promotion meta fields controller, the same as the menu one. GET errors
// never become the list, `loading` starts true when a fetch will happen, add / delete answer `{ ok }`, never leave
// `actionState.loading` stuck and never raise toasts; the success callbacks still run.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ordering: { root: 'https://api.test' },
  showToast: vi.fn(),
  fetch: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [mocks.ordering]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))

import { BusinessPromotionMetaFields } from '../index'

const BUSINESS_ID = 7
const OFFER_ID = 3
const BASE = `https://api.test/business/${BUSINESS_ID}/offers/${OFFER_ID}/metafields`
const FIELD_A = { id: 1, key: 'a', value: '1' }
const FIELD_B = { id: 2, key: 'b', value: '2' }

const reply = (content, ok = true) => () => Promise.resolve({ ok, json: async () => content })
const replyNotJson = (ok = false) => () => Promise.resolve({ ok, json: async () => { throw new SyntaxError('Unexpected token <') } })
const boom = (message) => () => Promise.reject(new Error(message))
const never = () => new Promise(() => {})

let routes
let ui
let seen

const callsOf = (method) => mocks.fetch.mock.calls.filter(([, options]) => options.method === method)
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

const Harness = (props) => {
  const UI = (uiProps) => {
    ui = uiProps
    seen.push(uiProps.metaFieldsList)
    return null
  }
  return <BusinessPromotionMetaFields businessId={BUSINESS_ID} offerId={OFFER_ID} UIComponent={UI} {...props} />
}

const draw = async (props = {}) => {
  ui = null
  seen = []
  const view = render(<Harness {...props} />)
  await flush()
  return view
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  routes = {
    get: reply({ error: false, result: [FIELD_A, FIELD_B] }),
    post: reply({ error: false, result: { id: 9, key: 'new', value: 'x' } }),
    delete: reply({ error: false, result: true })
  }
  mocks.fetch.mockImplementation((url, options) => {
    if (options.method === 'GET') return routes.get()
    if (options.method === 'POST') return routes.post()
    if (options.method === 'DELETE') return routes.delete()
    throw new Error(`unexpected request ${options.method} ${url}`)
  })
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessPromotionMetaFields controller · list', () => {
  it('starts with loading true (no empty flash) and then shows the list', async () => {
    await draw()
    expect(seen[0]).toEqual({ metaFields: [], loading: true, error: null })
    expect(ui.metaFieldsList).toEqual({ metaFields: [FIELD_A, FIELD_B], loading: false, error: null })
    const [url, options] = callsOf('GET')[0]
    expect(url).toBe(BASE)
    expect(options.headers.Authorization).toBe('Bearer test-token')
  })

  it('uses the metafields prop and does not fetch', async () => {
    await draw({ metafields: [FIELD_A] })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(seen[0]).toEqual({ metaFields: [FIELD_A], loading: false, error: null })
    expect(ui.metaFieldsList).toEqual({ metaFields: [FIELD_A], loading: false, error: null })
  })

  it('a GET answering error:true does not store the payload as the list', async () => {
    routes.get = reply({ error: true, result: ['API_ERROR'] })
    await draw()
    expect(ui.metaFieldsList).toEqual({ metaFields: [], loading: false, error: ['API_ERROR'] })
  })

  it('a non-ok GET ends loading with the error', async () => {
    routes.get = reply({ result: 'NOT_FOUND' }, false)
    await draw()
    expect(ui.metaFieldsList).toEqual({ metaFields: [], loading: false, error: 'NOT_FOUND' })
  })

  it('a GET that throws ends loading with the message and an empty list', async () => {
    routes.get = boom('Network down')
    await draw()
    expect(ui.metaFieldsList).toEqual({ metaFields: [], loading: false, error: 'Network down' })
  })

  it('reloadMetaFields() flips to loading with no error and recovers', async () => {
    routes.get = boom('Network down')
    await draw()
    routes.get = never
    await act(async () => { ui.reloadMetaFields() })
    expect(ui.metaFieldsList).toEqual({ metaFields: [], loading: true, error: null })
    expect(callsOf('GET')).toHaveLength(2)

    routes.get = reply({ error: false, result: [FIELD_B] })
    await act(async () => { ui.reloadMetaFields() })
    await flush()
    expect(ui.metaFieldsList).toEqual({ metaFields: [FIELD_B], loading: false, error: null })
  })
})

describe('BusinessPromotionMetaFields controller · handleDeleteMetaField', () => {
  it('success: { ok: true }, removes the field immutably, settles actionState and calls the callback', async () => {
    const onDelete = vi.fn()
    await draw({ handleSuccessDeletePromotionMetaFields: onDelete })
    const before = ui.metaFieldsList.metaFields
    let result
    await act(async () => { result = await ui.handleDeleteMetaField(FIELD_A.id) })

    expect(result).toEqual({ ok: true })
    const [url, options] = callsOf('DELETE')[0]
    expect(url).toBe(`${BASE}/${FIELD_A.id}`)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(ui.metaFieldsList.metaFields).toEqual([FIELD_B])
    expect(before).toEqual([FIELD_A, FIELD_B])
    expect(ui.actionState).toEqual({ loading: false, result: { error: false } })
    expect(onDelete).toHaveBeenCalledWith(FIELD_A.id)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('non-ok response: { ok: false, error }, keeps the list, does not stay loading and skips the callback', async () => {
    const onDelete = vi.fn()
    await draw({ handleSuccessDeletePromotionMetaFields: onDelete })
    routes.delete = reply({ result: ['FORBIDDEN'] }, false)
    let result
    await act(async () => { result = await ui.handleDeleteMetaField(FIELD_A.id) })

    expect(result).toEqual({ ok: false, error: ['FORBIDDEN'] })
    expect(ui.metaFieldsList.metaFields).toEqual([FIELD_A, FIELD_B])
    expect(ui.actionState).toEqual({ loading: false, result: { error: true, result: ['FORBIDDEN'] } })
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('non-ok response that is not JSON does not throw out of the handler', async () => {
    await draw()
    routes.delete = replyNotJson(false)
    let result
    await act(async () => { result = await ui.handleDeleteMetaField(FIELD_A.id) })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(ui.actionState.loading).toBe(false)
    expect(ui.metaFieldsList.metaFields).toEqual([FIELD_A, FIELD_B])
  })

  it('ok response that is not JSON is a success', async () => {
    await draw()
    routes.delete = replyNotJson(true)
    let result
    await act(async () => { result = await ui.handleDeleteMetaField(FIELD_A.id) })

    expect(result).toEqual({ ok: true })
    expect(ui.metaFieldsList.metaFields).toEqual([FIELD_B])
  })

  it('JSON error:true is a failure even with an ok status', async () => {
    await draw()
    routes.delete = reply({ error: true, result: 'IN_USE' })
    let result
    await act(async () => { result = await ui.handleDeleteMetaField(FIELD_A.id) })

    expect(result).toEqual({ ok: false, error: 'IN_USE' })
    expect(ui.metaFieldsList.metaFields).toEqual([FIELD_A, FIELD_B])
    expect(ui.actionState.loading).toBe(false)
  })

  it('network failure: { ok: false, error: message } and actionState settles', async () => {
    await draw()
    routes.delete = boom('Network down')
    let result
    await act(async () => { result = await ui.handleDeleteMetaField(FIELD_A.id) })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.actionState).toEqual({ loading: false, result: { error: true, result: 'Network down' } })
  })
})

describe('BusinessPromotionMetaFields controller · handleAddMetaField', () => {
  it('success: { ok: true, result }, appends the result, posts the same body and calls the callback', async () => {
    const onAdd = vi.fn()
    await draw({ handleSuccessAddPromotionMetaFields: onAdd })
    const values = { key: 'new', value: 'x' }
    let result
    await act(async () => { result = await ui.handleAddMetaField(values) })

    expect(result).toEqual({ ok: true, result: { id: 9, key: 'new', value: 'x' } })
    const [url, options] = callsOf('POST')[0]
    expect(url).toBe(BASE)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual(values)
    expect(ui.metaFieldsList.metaFields).toEqual([FIELD_A, FIELD_B, { id: 9, key: 'new', value: 'x' }])
    expect(ui.actionState).toEqual({ loading: false, result: { error: false } })
    expect(onAdd).toHaveBeenCalledWith({ id: 9, key: 'new', value: 'x' })
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('keeps the old misspelled name as an alias of the same function', async () => {
    await draw()
    expect(typeof ui.handleAddMetaField).toBe('function')
    expect(ui.handeAddMetaField).toBe(ui.handleAddMetaField)
  })

  it('API error: { ok: false, error }, the list is untouched and the callback is skipped', async () => {
    const onAdd = vi.fn()
    await draw({ handleSuccessAddPromotionMetaFields: onAdd })
    routes.post = reply({ error: true, result: ['DUPLICATED'] })
    let result
    await act(async () => { result = await ui.handleAddMetaField({ key: 'a' }) })

    expect(result).toEqual({ ok: false, error: ['DUPLICATED'] })
    expect(ui.metaFieldsList.metaFields).toEqual([FIELD_A, FIELD_B])
    expect(ui.actionState).toEqual({ loading: false, result: { error: true, result: ['DUPLICATED'] } })
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('non-ok response: { ok: false, error } and not stuck', async () => {
    await draw()
    routes.post = reply({ result: 'SERVER' }, false)
    let result
    await act(async () => { result = await ui.handleAddMetaField({ key: 'a' }) })

    expect(result).toEqual({ ok: false, error: 'SERVER' })
    expect(ui.actionState.loading).toBe(false)
    expect(ui.metaFieldsList.metaFields).toEqual([FIELD_A, FIELD_B])
  })

  it('network failure: { ok: false, error: message } and not stuck', async () => {
    await draw()
    routes.post = boom('Network down')
    let result
    await act(async () => { result = await ui.handleAddMetaField({ key: 'a' }) })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.actionState).toEqual({ loading: false, result: { error: true, result: 'Network down' } })
  })

  it('two adds in a row keep both (functional updates, no stale list)', async () => {
    await draw()
    routes.post = reply({ error: false, result: { id: 10 } })
    await act(async () => {
      const first = ui.handleAddMetaField({ key: 'x' })
      routes.post = reply({ error: false, result: { id: 11 } })
      const second = ui.handleAddMetaField({ key: 'y' })
      await Promise.all([first, second])
    })
    expect(ui.metaFieldsList.metaFields.map(field => field.id)).toEqual([1, 2, 10, 11])
  })
})
