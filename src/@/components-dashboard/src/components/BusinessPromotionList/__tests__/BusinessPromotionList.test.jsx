/* eslint-disable import/first */
// redesign stores 5.14 (G4-16): contract of the promotion list controller. The GET only runs without the
// `promotions` prop, a failed GET never looks like an empty list, toggle / delete answer `{ ok }`, never leave
// `actionState.loading` stuck, update the list without mutating the objects they receive, and `options.inlineError` skips
// every toast.
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

import { BusinessPromotionList } from '../index'

const BUSINESS_ID = 7
const BASE = `https://api.test/business/${BUSINESS_ID}/offers`
const PROMO_A = { id: 1, name: 'A', enabled: true }
const PROMO_B = { id: 2, name: 'B', enabled: true }

const reply = (content, ok = true) => () => Promise.resolve({ ok, json: async () => content })
const replyNotJson = (ok = false) => () => Promise.resolve({ ok, json: async () => { throw new SyntaxError('Unexpected token <') } })
const boom = (message) => () => Promise.reject(new Error(message))
const never = () => new Promise(() => {})

let routes
let ui
let seen

const callsOf = (method) => mocks.fetch.mock.calls.filter(([, options]) => options.method === method)
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
const toastTypes = () => mocks.showToast.mock.calls.map(([type]) => type)

const Harness = (props) => {
  const UI = (uiProps) => {
    ui = uiProps
    seen.push(uiProps.promotionListState)
    return null
  }
  return <BusinessPromotionList businessId={BUSINESS_ID} UIComponent={UI} {...props} />
}

const draw = async (props = {}) => {
  ui = null
  seen = []
  const view = render(<Harness {...props} />)
  await flush()
  return view
}

// The list handed down by the parent and `business.offers` are the same objects, as in the real screen.
const withBusiness = (extra = {}) => {
  const promotions = [PROMO_A, PROMO_B].map(promotion => ({ ...promotion }))
  const business = { id: BUSINESS_ID, name: 'Shop', offers: promotions }
  const handleSuccessUpdate = vi.fn()
  return { promotions, business, handleSuccessUpdate, props: { promotions, business, handleSuccessUpdate, ...extra } }
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.fetch.mockReset()
  routes = {
    get: reply({ error: false, result: [PROMO_A, PROMO_B] }),
    put: reply({ error: false, result: { id: 1, enabled: false } }),
    delete: reply({ error: false, result: true })
  }
  mocks.fetch.mockImplementation((url, options) => {
    if (options.method === 'GET') return routes.get()
    if (options.method === 'PUT') return routes.put()
    if (options.method === 'DELETE') return routes.delete()
    throw new Error(`unexpected request ${options.method} ${url}`)
  })
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessPromotionList controller · list', () => {
  it('starts with loading true (no empty flash) and then shows the list', async () => {
    await draw()
    expect(seen[0]).toEqual({ promotions: [], loading: true, error: null })
    expect(ui.promotionListState).toEqual({ promotions: [PROMO_A, PROMO_B], loading: false, error: null })
    expect(callsOf('GET')).toHaveLength(1)
    const [url, options] = callsOf('GET')[0]
    expect(url).toBe(BASE)
    expect(options.headers.Authorization).toBe('Bearer test-token')
  })

  it('uses the promotions prop and does not fetch', async () => {
    const { props, promotions } = withBusiness()
    await draw(props)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(seen[0]).toEqual({ promotions, loading: false, error: null })
    expect(ui.promotionListState).toEqual({ promotions, loading: false, error: null })
  })

  it('follows a new promotions prop without fetching', async () => {
    const view = await draw({ promotions: [PROMO_A] })
    view.rerender(<Harness promotions={[PROMO_B]} />)
    await flush()
    expect(ui.promotionListState.promotions).toEqual([PROMO_B])
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('a GET answering error:true is an error, not an empty list', async () => {
    routes.get = reply({ error: true, result: ['API_ERROR'] })
    await draw()
    expect(ui.promotionListState).toEqual({ promotions: [], loading: false, error: ['API_ERROR'] })
  })

  it('a non-ok GET ends loading with the error', async () => {
    routes.get = reply({ result: 'NOT_FOUND' }, false)
    await draw()
    expect(ui.promotionListState).toEqual({ promotions: [], loading: false, error: 'NOT_FOUND' })
  })

  it('a non-ok GET that is not JSON ends loading with some error', async () => {
    routes.get = replyNotJson(false)
    await draw()
    expect(ui.promotionListState.loading).toBe(false)
    expect(ui.promotionListState.promotions).toEqual([])
    expect(ui.promotionListState.error).toBeTruthy()
  })

  it('a GET that throws ends loading with the message and an empty list', async () => {
    routes.get = boom('Network down')
    await draw()
    expect(ui.promotionListState).toEqual({ promotions: [], loading: false, error: 'Network down' })
  })

  it('reloadPromotions() flips to loading with no error and recovers', async () => {
    routes.get = boom('Network down')
    await draw()
    routes.get = never
    await act(async () => { ui.reloadPromotions() })
    expect(ui.promotionListState).toEqual({ promotions: [], loading: true, error: null })
    expect(callsOf('GET')).toHaveLength(2)

    routes.get = reply({ error: false, result: [PROMO_B] })
    await act(async () => { ui.reloadPromotions() })
    await flush()
    expect(ui.promotionListState).toEqual({ promotions: [PROMO_B], loading: false, error: null })
  })
})

describe('BusinessPromotionList controller · handleChangePromotionActiveState', () => {
  it('success: { ok: true, result }, same request, toasts as before and a callback with the new offers', async () => {
    const { props, business, handleSuccessUpdate } = withBusiness()
    await draw(props)
    let result
    await act(async () => { result = await ui.handleChangePromotionActiveState(false, 1) })

    expect(result).toEqual({ ok: true, result: { id: 1, enabled: false } })
    const [url, options] = callsOf('PUT')[0]
    expect(url).toBe(`${BASE}/1`)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ enabled: false })
    expect(ui.promotionListState.promotions).toEqual([{ ...PROMO_A, enabled: false }, PROMO_B])
    expect(ui.actionState).toEqual({ loading: false, error: null })
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ ...business, offers: [{ ...PROMO_A, enabled: false }, PROMO_B] })
    expect(mocks.showToast.mock.calls).toEqual([['info', 'Loading'], ['success', 'Promotion saved']])
  })

  it('does not mutate the objects it receives (business.offers keeps the old promotion)', async () => {
    const { props, business, promotions } = withBusiness()
    const originalA = promotions[0]
    await draw(props)
    await act(async () => { await ui.handleChangePromotionActiveState(false, 1) })

    expect(originalA.enabled).toBe(true)
    expect(business.offers[0]).toBe(originalA)
    expect(business.offers[0].enabled).toBe(true)
    expect(ui.promotionListState.promotions[0]).not.toBe(originalA)
    expect(ui.promotionListState.promotions[1]).toBe(promotions[1])
  })

  it('works without handleSuccessUpdate', async () => {
    await draw({ promotions: [{ ...PROMO_A }] })
    let result
    await act(async () => { result = await ui.handleChangePromotionActiveState(false, 1) })
    expect(result.ok).toBe(true)
  })

  it('inlineError: success with no toast at all', async () => {
    const { props } = withBusiness()
    await draw(props)
    let result
    await act(async () => { result = await ui.handleChangePromotionActiveState(false, 1, { inlineError: true }) })

    expect(result.ok).toBe(true)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('two switches pressed one after the other both land (each write starts from the latest list)', async () => {
    const { props, handleSuccessUpdate } = withBusiness()
    await draw(props)
    let release
    const pending = []
    mocks.fetch.mockImplementation((url, options) => new Promise(resolve => {
      const id = Number(url.split('/').pop())
      pending.push(() => resolve({ ok: true, json: async () => ({ error: false, result: { id, enabled: false } }) }))
      release = () => pending.forEach(go => go())
    }))
    let first
    let second
    await act(async () => {
      first = ui.handleChangePromotionActiveState(false, 1, { inlineError: true })
      second = ui.handleChangePromotionActiveState(false, 2, { inlineError: true })
      release()
      await Promise.all([first, second])
    })

    expect(ui.promotionListState.promotions.map(promotion => promotion.enabled)).toEqual([false, false])
    expect(handleSuccessUpdate.mock.calls.at(-1)[0].offers.map(offer => offer.enabled)).toEqual([false, false])
  })

  it('API error: { ok: false, error }, list untouched, nothing stuck and the callback is skipped', async () => {
    const { props, handleSuccessUpdate, promotions } = withBusiness()
    await draw(props)
    routes.put = reply({ error: true, result: ['FORBIDDEN'] })
    let result
    await act(async () => { result = await ui.handleChangePromotionActiveState(false, 1) })

    expect(result).toEqual({ ok: false, error: ['FORBIDDEN'] })
    expect(ui.promotionListState.promotions).toEqual(promotions)
    expect(ui.promotionListState.promotions[0].enabled).toBe(true)
    expect(ui.actionState.loading).toBe(false)
    expect(handleSuccessUpdate).not.toHaveBeenCalled()
    expect(toastTypes()).not.toContain('success')
    expect(toastTypes()).toContain('error')
  })

  it('API error with inlineError: no toast at all', async () => {
    const { props } = withBusiness()
    await draw(props)
    routes.put = reply({ error: true, result: ['FORBIDDEN'] })
    let result
    await act(async () => { result = await ui.handleChangePromotionActiveState(false, 1, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: ['FORBIDDEN'] })
    expect(ui.actionState.loading).toBe(false)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('non-ok response: { ok: false, error }', async () => {
    const { props, promotions } = withBusiness()
    await draw(props)
    routes.put = reply({ result: 'SERVER' }, false)
    let result
    await act(async () => { result = await ui.handleChangePromotionActiveState(false, 1, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: 'SERVER' })
    expect(ui.promotionListState.promotions).toEqual(promotions)
    expect(ui.actionState.loading).toBe(false)
  })

  it('non-ok response that is not JSON does not throw out of the handler', async () => {
    const { props } = withBusiness()
    await draw(props)
    routes.put = replyNotJson(false)
    let result
    await act(async () => { result = await ui.handleChangePromotionActiveState(false, 1, { inlineError: true }) })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(ui.actionState.loading).toBe(false)
  })

  it('network failure: { ok: false, error: message } and actionState settles', async () => {
    const { props } = withBusiness()
    await draw(props)
    routes.put = boom('Network down')
    let result
    await act(async () => { result = await ui.handleChangePromotionActiveState(false, 1, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.actionState.loading).toBe(false)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('network failure without options keeps the same toast path as an API error', async () => {
    const { props } = withBusiness()
    await draw(props)
    routes.put = boom('Network down')
    await act(async () => { await ui.handleChangePromotionActiveState(false, 1) })

    expect(ui.actionState).toEqual({ loading: false, error: ['Network down'] })
    expect(toastTypes()).toEqual(['info', 'error'])
  })
})

describe('BusinessPromotionList controller · handleDeletePromotion', () => {
  it('success: { ok: true, result }, removes the promotion immutably and flags isSuccessDeleted', async () => {
    const { props, business, handleSuccessUpdate, promotions } = withBusiness()
    await draw(props)
    expect(ui.isSuccessDeleted).toBe(false)
    let result
    await act(async () => { result = await ui.handleDeletePromotion(1) })

    expect(result).toEqual({ ok: true, result: true })
    const [url, options] = callsOf('DELETE')[0]
    expect(url).toBe(`${BASE}/1`)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(ui.promotionListState.promotions).toEqual([PROMO_B])
    expect(promotions).toHaveLength(2)
    expect(business.offers).toHaveLength(2)
    expect(ui.isSuccessDeleted).toBe(true)
    expect(ui.actionState).toEqual({ loading: false, error: null })
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ ...business, offers: [PROMO_B] })
    expect(mocks.showToast.mock.calls).toEqual([['info', 'Loading'], ['success', 'Promotion deleted']])
  })

  it('inlineError: success with no toast at all', async () => {
    const { props } = withBusiness()
    await draw(props)
    let result
    await act(async () => { result = await ui.handleDeletePromotion(1, { inlineError: true }) })

    expect(result.ok).toBe(true)
    expect(ui.isSuccessDeleted).toBe(true)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('API error: { ok: false, error }, list kept, not flagged as deleted and nothing stuck', async () => {
    const { props, handleSuccessUpdate, promotions } = withBusiness()
    await draw(props)
    routes.delete = reply({ error: true, result: ['IN_USE'] })
    let result
    await act(async () => { result = await ui.handleDeletePromotion(1) })

    expect(result).toEqual({ ok: false, error: ['IN_USE'] })
    expect(ui.promotionListState.promotions).toEqual(promotions)
    expect(ui.isSuccessDeleted).toBe(false)
    expect(ui.actionState.loading).toBe(false)
    expect(handleSuccessUpdate).not.toHaveBeenCalled()
    expect(toastTypes()).toEqual(['info', 'error'])
  })

  it('API error with inlineError: no toast at all', async () => {
    const { props } = withBusiness()
    await draw(props)
    routes.delete = reply({ error: true, result: ['IN_USE'] })
    let result
    await act(async () => { result = await ui.handleDeletePromotion(1, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: ['IN_USE'] })
    expect(ui.actionState.loading).toBe(false)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('non-ok response: { ok: false, error }', async () => {
    const { props, promotions } = withBusiness()
    await draw(props)
    routes.delete = reply({ result: 'SERVER' }, false)
    let result
    await act(async () => { result = await ui.handleDeletePromotion(1, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: 'SERVER' })
    expect(ui.promotionListState.promotions).toEqual(promotions)
    expect(ui.actionState.loading).toBe(false)
  })

  it('ok response that is not JSON is a success', async () => {
    const { props } = withBusiness()
    await draw(props)
    routes.delete = replyNotJson(true)
    let result
    await act(async () => { result = await ui.handleDeletePromotion(1, { inlineError: true }) })

    expect(result.ok).toBe(true)
    expect(ui.promotionListState.promotions).toEqual([PROMO_B])
  })

  it('network failure: { ok: false, error: message } and actionState settles', async () => {
    const { props } = withBusiness()
    await draw(props)
    routes.delete = boom('Network down')
    let result
    await act(async () => { result = await ui.handleDeletePromotion(1, { inlineError: true }) })

    expect(result).toEqual({ ok: false, error: 'Network down' })
    expect(ui.actionState.loading).toBe(false)
    expect(ui.isSuccessDeleted).toBe(false)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })
})
