/* eslint-disable import/first */
// redesign stores 5.14: `createPromotion` / `updatePromotion` answer `{ ok, ... }` without raising toasts when
// `options.inlineError` is true, never leave `formState.loading` stuck, and the offers handed to `handleSuccessUpdate` are
// new objects (the ones in `business.offers` are never mutated). The legacy `handleUpdateClick` / `handleAddClick` keep
// their toasts.
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
vi.mock('../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))

import { BusinessPromotionForm } from '../index'

const BUSINESS_ID = 7
const BASE = `https://api.test/business/${BUSINESS_ID}/offers`
const PROMO_A = { id: 1, name: 'A', enabled: true }
const PROMO_B = { id: 2, name: 'B', enabled: true }

const reply = (content, ok = true) => () => Promise.resolve({ ok, json: async () => content })
const replyNotJson = (ok = false) => () => Promise.resolve({ ok, json: async () => { throw new SyntaxError('Unexpected token <') } })
const boom = (message) => () => Promise.reject(new Error(message))

let routes
let ui

const callsOf = (method) => mocks.fetch.mock.calls.filter(([, options]) => options.method === method)
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
const toastTypes = () => mocks.showToast.mock.calls.map(([type]) => type)

const Harness = (props) => {
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  return <BusinessPromotionForm UIComponent={UI} {...props} />
}

const draw = async (props = {}) => {
  ui = null
  const view = render(<Harness {...props} />)
  await flush()
  return view
}

// `business.offers` holds the same objects the form receives, as in the real screen.
const withBusiness = (extra = {}) => {
  const offers = [PROMO_A, PROMO_B].map(offer => ({ ...offer }))
  const business = { id: BUSINESS_ID, name: 'Shop', offers }
  const handleSuccessUpdate = vi.fn()
  const handleCloseAddForm = vi.fn()
  return { offers, business, handleSuccessUpdate, handleCloseAddForm, props: { business, promotion: offers[0], handleSuccessUpdate, handleCloseAddForm, ...extra } }
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  routes = {
    post: reply({ error: false, result: { id: 9, name: 'New', enabled: true } }),
    put: reply({ error: false, result: { id: 1, name: 'Renamed' } })
  }
  mocks.fetch.mockImplementation((url, options) => {
    if (options.method === 'POST') return routes.post()
    if (options.method === 'PUT') return routes.put()
    throw new Error(`unexpected request ${options.method} ${url}`)
  })
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessPromotionForm controller · updatePromotion', () => {
  it('exposes both explicit functions next to the legacy handlers', async () => {
    await draw(withBusiness().props)
    expect(typeof ui.createPromotion).toBe('function')
    expect(typeof ui.updatePromotion).toBe('function')
    expect(typeof ui.handleUpdateClick).toBe('function')
    expect(typeof ui.handleAddClick).toBe('function')
  })

  it('success: { ok: true, result }, PUT with the given body, promotionState and callback updated', async () => {
    const { props, business, offers } = withBusiness()
    const { handleSuccessUpdate } = props
    await draw(props)
    let result
    await act(async () => { result = await ui.updatePromotion({ name: 'Renamed' }) })

    expect(result).toEqual({ ok: true, result: { id: 1, name: 'Renamed' } })
    const [url, options] = callsOf('PUT')[0]
    expect(url).toBe(`${BASE}/1`)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ name: 'Renamed' })
    expect(ui.promotionState.promotion).toEqual({ id: 1, name: 'Renamed' })
    expect(ui.formState.loading).toBe(false)
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ ...business, offers: [{ ...offers[0], id: 1, name: 'Renamed' }, offers[1]] })
    expect(mocks.showToast.mock.calls).toEqual([['info', 'Loading'], ['success', 'Promotion saved']])
  })

  it('does not mutate business.offers', async () => {
    const { props, business, offers } = withBusiness()
    const originalA = offers[0]
    await draw(props)
    await act(async () => { await ui.updatePromotion({ name: 'Renamed' }, { inlineError: true }) })

    expect(originalA.name).toBe('A')
    expect(business.offers[0]).toBe(originalA)
    const sent = props.handleSuccessUpdate.mock.calls[0][0].offers
    expect(sent[0]).not.toBe(originalA)
    expect(sent[1]).toBe(offers[1])
  })

  it('inlineError: success with no toast at all', async () => {
    await draw(withBusiness().props)
    let result
    await act(async () => { result = await ui.updatePromotion({ name: 'Renamed' }, { inlineError: true }) })

    expect(result.ok).toBe(true)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('works when business.offers is undefined and without handleSuccessUpdate', async () => {
    const { props } = withBusiness()
    await draw({ ...props, business: { id: BUSINESS_ID }, handleSuccessUpdate: undefined })
    let result
    await act(async () => { result = await ui.updatePromotion({ name: 'Renamed' }, { inlineError: true }) })
    expect(result.ok).toBe(true)

    const { handleSuccessUpdate } = props
    await draw({ ...props, business: { id: BUSINESS_ID } })
    await act(async () => { await ui.updatePromotion({ name: 'Renamed' }, { inlineError: true }) })
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ id: BUSINESS_ID, offers: [] })
  })

  it('API error: { ok: false, error }, not stuck, no callback, error toast without inlineError', async () => {
    const { props } = withBusiness()
    await draw(props)
    routes.put = reply({ error: true, result: ['FORBIDDEN'] })
    let result
    await act(async () => { result = await ui.updatePromotion({ name: 'x' }) })

    expect(result).toEqual({ ok: false, error: ['FORBIDDEN'] })
    expect(ui.formState.loading).toBe(false)
    expect(ui.formState.result).toEqual({ error: true, result: ['FORBIDDEN'] })
    expect(ui.promotionState.promotion).toEqual(props.business.offers[0])
    expect(props.handleSuccessUpdate).not.toHaveBeenCalled()
    expect(toastTypes()).toEqual(['info', 'error'])
  })

  it('API error with inlineError: no toast at all', async () => {
    await draw(withBusiness().props)
    routes.put = reply({ error: true, result: ['FORBIDDEN'] })
    let result
    await act(async () => { result = await ui.updatePromotion({ name: 'x' }, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: ['FORBIDDEN'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('non-ok response: { ok: false, error }', async () => {
    const { props } = withBusiness()
    await draw(props)
    routes.put = reply({ result: 'SERVER' }, false)
    let result
    await act(async () => { result = await ui.updatePromotion({ name: 'x' }, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: 'SERVER' })
    expect(ui.formState.loading).toBe(false)
    expect(props.handleSuccessUpdate).not.toHaveBeenCalled()
  })

  it('non-ok response that is not JSON does not throw out of the handler', async () => {
    await draw(withBusiness().props)
    routes.put = replyNotJson(false)
    let result
    await act(async () => { result = await ui.updatePromotion({ name: 'x' }, { inlineError: true }) })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(ui.formState.loading).toBe(false)
  })

  it('network failure: { ok: false, error: message }', async () => {
    await draw(withBusiness().props)
    routes.put = boom('Network down')
    let result
    await act(async () => { result = await ui.updatePromotion({ name: 'x' }, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.formState.loading).toBe(false)
    expect(ui.formState.result).toEqual({ error: true, result: 'Network down' })
    expect(mocks.showToast).not.toHaveBeenCalled()
  })
})

describe('BusinessPromotionForm controller · createPromotion', () => {
  const NEW = { id: 9, name: 'New', enabled: true }

  it('success without options: toasts and handleCloseAddForm as before', async () => {
    const { props, business, offers, handleCloseAddForm, handleSuccessUpdate } = withBusiness({ promotion: {} })
    await draw(props)
    let result
    await act(async () => { result = await ui.createPromotion({ name: 'New' }) })

    expect(result).toEqual({ ok: true, result: NEW })
    const [url, options] = callsOf('POST')[0]
    expect(url).toBe(BASE)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ name: 'New' })
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ ...business, offers: [...offers, NEW] })
    expect(handleCloseAddForm).toHaveBeenCalledTimes(1)
    expect(ui.formState.loading).toBe(false)
    expect(mocks.showToast.mock.calls).toEqual([['info', 'Loading'], ['success', 'Promotion added']])
  })

  it('inlineError: no toast and the add form is not closed', async () => {
    const { props, business, offers, handleCloseAddForm, handleSuccessUpdate } = withBusiness({ promotion: {} })
    await draw(props)
    let result
    await act(async () => { result = await ui.createPromotion({ name: 'New' }, { inlineError: true }) })

    expect(result).toEqual({ ok: true, result: NEW })
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ ...business, offers: [...offers, NEW] })
    expect(handleCloseAddForm).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('does not mutate business.offers and tolerates it being undefined', async () => {
    const { props, business, offers } = withBusiness({ promotion: {} })
    await draw(props)
    await act(async () => { await ui.createPromotion({ name: 'New' }, { inlineError: true }) })
    expect(business.offers).toBe(offers)
    expect(offers).toHaveLength(2)

    const handleSuccessUpdate = vi.fn()
    await draw({ promotion: {}, business: { id: BUSINESS_ID }, handleSuccessUpdate })
    await act(async () => { await ui.createPromotion({ name: 'New' }, { inlineError: true }) })
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ id: BUSINESS_ID, offers: [NEW] })
  })

  it('API error: { ok: false, error }, nothing closed or stuck', async () => {
    const { props, handleCloseAddForm, handleSuccessUpdate } = withBusiness({ promotion: {} })
    await draw(props)
    routes.post = reply({ error: true, result: ['DUPLICATED'] })
    let result
    await act(async () => { result = await ui.createPromotion({ name: 'New' }) })

    expect(result).toEqual({ ok: false, error: ['DUPLICATED'] })
    expect(ui.formState.loading).toBe(false)
    expect(ui.formState.result).toEqual({ error: true, result: ['DUPLICATED'] })
    expect(handleCloseAddForm).not.toHaveBeenCalled()
    expect(handleSuccessUpdate).not.toHaveBeenCalled()
    expect(toastTypes()).toEqual(['info', 'error'])
  })

  it('API error with inlineError: no toast at all', async () => {
    await draw(withBusiness({ promotion: {} }).props)
    routes.post = reply({ error: true, result: ['DUPLICATED'] })
    let result
    await act(async () => { result = await ui.createPromotion({ name: 'New' }, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: ['DUPLICATED'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('non-ok response: { ok: false, error }', async () => {
    await draw(withBusiness({ promotion: {} }).props)
    routes.post = reply({ result: 'SERVER' }, false)
    let result
    await act(async () => { result = await ui.createPromotion({ name: 'New' }, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: 'SERVER' })
    expect(ui.formState.loading).toBe(false)
  })

  it('non-ok response that is not JSON does not throw out of the handler', async () => {
    await draw(withBusiness({ promotion: {} }).props)
    routes.post = replyNotJson(false)
    let result
    await act(async () => { result = await ui.createPromotion({ name: 'New' }, { inlineError: true }) })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(ui.formState.loading).toBe(false)
  })

  it('network failure: { ok: false, error: message }', async () => {
    await draw(withBusiness({ promotion: {} }).props)
    routes.post = boom('Network down')
    let result
    await act(async () => { result = await ui.createPromotion({ name: 'New' }, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.formState.loading).toBe(false)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })
})

describe('BusinessPromotionForm controller · legacy handleUpdateClick', () => {
  it('sends the typed changes, keeps its toasts and does not mutate business.offers', async () => {
    const { props, business, offers, handleSuccessUpdate } = withBusiness()
    const originalA = offers[0]
    await draw(props)
    act(() => { ui.handleChangeInput({ target: { name: 'name', value: 'Renamed' } }) })
    await act(async () => { await ui.handleUpdateClick() })

    expect(JSON.parse(callsOf('PUT')[0][1].body)).toEqual({ name: 'Renamed' })
    expect(mocks.showToast.mock.calls).toEqual([['info', 'Loading'], ['success', 'Promotion saved']])
    expect(originalA.name).toBe('A')
    expect(business.offers[0]).toBe(originalA)
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ ...business, offers: [{ ...originalA, id: 1, name: 'Renamed' }, offers[1]] })
    expect(handleSuccessUpdate.mock.calls[0][0].offers[0]).not.toBe(originalA)
  })

  it('does not crash when business.offers is undefined', async () => {
    const { props } = withBusiness()
    const handleSuccessUpdate = vi.fn()
    await draw({ ...props, business: { id: BUSINESS_ID }, handleSuccessUpdate })
    await act(async () => { await ui.handleUpdateClick() })

    expect(handleSuccessUpdate).toHaveBeenCalledWith({ id: BUSINESS_ID, offers: [] })
    expect(ui.formState.result?.error).toBeFalsy()
  })
})
