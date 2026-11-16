import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const stripe = vi.hoisted(() => ({ confirmCardPayment: vi.fn() }))

vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'http://api' }] }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok' }] }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, text) => text] }))
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: vi.fn(async () => ({ confirmCardPayment: stripe.confirmCardPayment })) }))

import { BillingPaymentOptions } from '../index'

// redesign BM-A (D5, M-BM4, M-BM21): this is real money. The tests pin two things: the requests, bodies and order main
// sends (parity), and which of the two failures the controller reports: `declined` (nothing was charged, retry is safe)
// or `uncertain` (the charge was sent and its outcome is unknown, never retry).
const PROJECT = 7
const SUBS_LIST = [{ id: 9001, status: 'past_due', plan: { plan: { id: 3, name: 'Pro' } } }]

let calls
let routes

const answer = (body, status = 200) => Promise.resolve({ status, ok: status < 400, json: async () => body })

const installFetch = () => {
  calls = []
  global.fetch = vi.fn((url, options = {}) => {
    const path = String(url).replace('http://api', '')
    const method = options.method || 'GET'
    calls.push({ method, path, body: options.body ? JSON.parse(options.body) : undefined })
    const route = routes[`${method} ${path}`] ?? routes[`${method} *`]
    if (route === undefined) throw new Error(`unexpected request ${method} ${path}`)
    return typeof route === 'function' ? route(path) : route
  })
}

const charges = () => calls.filter(call => call.method === 'POST' && !call.path.endsWith('/sync'))

const mountController = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => { ui.current = uiProps; return null }
  render(<BillingPaymentOptions projectId={PROJECT} settings={{ stripe_public_key: 'pk' }} UIComponent={UIComponent} {...props} />)
  await waitFor(() => expect(ui.current.subscriptionsState.subscriptions.length).toBeGreaterThan(0))
  return ui
}

const pay = (ui, args) => act(async () => { await ui.current.handlePlaceOrder(args) })

const choosePaymethod = (ui) => act(async () => { ui.current.handlePaymethodChange({ id: 'pm1' }) })

const chargeRoute = 'POST /billing/subscriptions/plans'

describe('BillingPaymentOptions controller · request parity', () => {
  beforeEach(() => {
    routes = { 'GET /billing/subscriptions': answer({ error: false, result: SUBS_LIST }) }
    installFetch()
    stripe.confirmCardPayment.mockReset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('(e) pays a past_due subscription with POST /billing/subscriptions/9001 and only the paymethod', async () => {
    routes['POST /billing/subscriptions/9001'] = answer({ error: false, result: { subscriptions: [{ id: 9001, status: 'active' }] } })
    const ui = await mountController()
    await choosePaymethod(ui)
    await pay(ui, { propPlanId: 3, period: 'monthly', subscription: SUBS_LIST[0] })
    expect(charges()).toEqual([{ method: 'POST', path: '/billing/subscriptions/9001', body: { user_paymethod_id: 'pm1' } }])
  })

  it('(f) upgrades with POST /billing/subscriptions/plans and plan, period, replace and paymethod', async () => {
    routes['GET /billing/plans/public'] = answer({ error: false, result: [{ id: 12, rank: 1, prices: {} }] })
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 1, status: 'active' }] } })
    const ui = await mountController({ isUpgradeToPro: true, upgradeProPlanId: [12] })
    await choosePaymethod(ui)
    await pay(ui, { propPlanId: 12, period: 'annual', subscription: { id: 1, status: 'active' } })
    expect(charges()).toEqual([{ method: 'POST', path: '/billing/subscriptions/plans', body: { plan_id: 12, period: 'annual', replace: true, user_paymethod_id: 'pm1' } }])
  })

  // An `incomplete` attempt of the target plan (Pro monthly) left by an earlier upgrade, next to the active Basic: paying from
  // it is a retry of that attempt (main's behaviour; was cancelled with billing-api #91).
  describe('upgrade with a pending incomplete attempt of the target plan', () => {
    const basic = { id: 2001, status: 'active', interval: 'year', plan: { plan: { id: 3, name: 'Basic' } } }
    const proMonthly = { id: 2002, status: 'incomplete', interval: 'month', plan: { plan: { id: 12, name: 'Pro' } } }

    beforeEach(() => {
      routes['GET /billing/subscriptions'] = answer({ error: false, result: [proMonthly, basic] })
      routes['GET /billing/plans/public'] = answer({ error: false, result: [{ id: 12, rank: 1, prices: {} }] })
      routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 2003, status: 'active' }] } })
      routes['POST /billing/subscriptions/2002'] = answer({ error: false, result: { subscriptions: [{ id: 2002, status: 'active' }] } })
    })

    const upgrade = async (period) => {
      const ui = await mountController({ isUpgradeToPro: true, upgradeProPlanId: [12], settings: { stripe_public_key: 'pk' } })
      await choosePaymethod(ui)
      await pay(ui, { propPlanId: 12, period, subscription: proMonthly })
      return charges()
    }

    it('retries that attempt, whatever period the dialog asks for', async () => {
      expect(await upgrade('annual')).toEqual([
        { method: 'POST', path: '/billing/subscriptions/2002', body: { user_paymethod_id: 'pm1' } }
      ])
    })

    it('pays that same attempt when the dialog asks for its plan and period', async () => {
      expect(await upgrade('monthly')).toEqual([
        { method: 'POST', path: '/billing/subscriptions/2002', body: { user_paymethod_id: 'pm1' } }
      ])
    })

    it('still pays a past_due subscription through the retry route', async () => {
      routes['GET /billing/subscriptions'] = answer({ error: false, result: SUBS_LIST })
      routes['POST /billing/subscriptions/9001'] = answer({ error: false, result: { subscriptions: [{ id: 9001, status: 'active' }] } })
      const ui = await mountController({ settings: { stripe_public_key: 'pk' } })
      await choosePaymethod(ui)
      await pay(ui, { propPlanId: 3, period: 'monthly', subscription: SUBS_LIST[0] })
      expect(charges()).toEqual([{ method: 'POST', path: '/billing/subscriptions/9001', body: { user_paymethod_id: 'pm1' } }])
    })
  })

  it('on success keeps main order: charge, then reload the subscriptions, and reports no error', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 1, status: 'active' }] } })
    const ui = await mountController()
    await pay(ui, { propPlanId: 3, period: 'monthly', subscription: { id: 1, status: 'active' } })
    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'GET /billing/subscriptions',
      'POST /billing/subscriptions/plans',
      'GET /billing/subscriptions'
    ])
    expect(ui.current.placeOrderState).toMatchObject({ loading: false, error: null, kind: null, messages: [] })
    expect(ui.current.placeOrderState.result).toEqual([{ id: 1, status: 'active' }])
  })

  it('after 3DS keeps main order: charge, sync, Stripe, sync, reload; sync carries project and subscription ids', async () => {
    const needsAction = { id: 9001, project_id: PROJECT, status: 'incomplete', data: { status: 'requires_action', client_secret: 'cs_1' } }
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [needsAction] } })
    routes['POST /billing/subscriptions/9001/sync'] = answer({ error: false, result: { id: 9001, status: 'active' } })
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
    const ui = await mountController()
    await pay(ui, { propPlanId: 3, period: 'monthly', subscription: { id: 1, status: 'active' } })
    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'GET /billing/subscriptions',
      'POST /billing/subscriptions/plans',
      'POST /billing/subscriptions/9001/sync',
      'POST /billing/subscriptions/9001/sync',
      'GET /billing/subscriptions'
    ])
    expect(calls[2].body).toEqual({ project_id: PROJECT, subscription_id: 9001 })
    expect(stripe.confirmCardPayment).toHaveBeenCalledWith('cs_1')
    expect(ui.current.placeOrderState).toMatchObject({ error: null, kind: null })
    expect(ui.current.placeOrderState.result).toEqual([{ id: 9001, status: 'active' }])
  })
})

describe('BillingPaymentOptions controller · declined or uncertain', () => {
  beforeEach(() => {
    routes = { 'GET /billing/subscriptions': answer({ error: false, result: SUBS_LIST }) }
    installFetch()
    stripe.confirmCardPayment.mockReset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  const payUpgrade = async () => {
    const ui = await mountController()
    await pay(ui, { propPlanId: 3, period: 'monthly', subscription: { id: 1, status: 'active' } })
    return ui.current.placeOrderState
  }

  it('(a) a network failure at the charge is uncertain, not a plain error', async () => {
    routes[chargeRoute] = () => Promise.reject(new TypeError('Failed to fetch'))
    expect(await payUpgrade()).toMatchObject({ loading: false, kind: 'uncertain', error: 'Failed to fetch', messages: ['Failed to fetch'], result: null })
  })

  it('(a2) a response whose body cannot be read is uncertain', async () => {
    routes[chargeRoute] = Promise.resolve({ status: 200, json: async () => { throw new SyntaxError('Unexpected end of JSON input') } })
    expect(await payUpgrade()).toMatchObject({ kind: 'uncertain', error: 'Unexpected end of JSON input' })
  })

  it('(b) an API error with HTTP 400 is declined, with the API text', async () => {
    routes[chargeRoute] = answer({ error: true, result: ['Your card was declined.'] }, 400)
    expect(await payUpgrade()).toMatchObject({ loading: false, kind: 'declined', error: 'Your card was declined.', messages: ['Your card was declined.'] })
  })

  it('(b2) an API error given as text is declined and keeps the text', async () => {
    routes[chargeRoute] = answer({ error: true, result: 'Card expired' }, 402)
    expect(await payUpgrade()).toMatchObject({ kind: 'declined', error: 'Card expired', messages: ['Card expired'] })
  })

  it('(c) a subscription requiring another paymethod, with nothing active, is declined', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 1, status: 'incomplete', data: { status: 'requires_payment_method' } }] } })
    expect(await payUpgrade()).toMatchObject({ kind: 'declined', error: 'Subscription status requires payment method' })
  })

  it('(c1) a canceled subscription, with nothing active, is declined', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 1, status: 'canceled', data: { status: 'canceled' } }] } })
    expect(await payUpgrade()).toMatchObject({ kind: 'declined' })
  })

  it('(c2) an API error with HTTP 500 is uncertain', async () => {
    routes[chargeRoute] = answer({ error: true, result: ['Internal error'] }, 500)
    expect(await payUpgrade()).toMatchObject({ kind: 'uncertain', error: 'Internal error', messages: ['Internal error'] })
  })

  it('(c3) the API accepting but leaving the subscription incomplete is uncertain', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 1, status: 'incomplete' }] } })
    expect(await payUpgrade()).toMatchObject({ kind: 'uncertain', error: 'Payment Failed' })
  })

  it('(c4) 3DS succeeded but the sync fails is uncertain', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 9001, project_id: PROJECT, status: 'incomplete', data: { status: 'requires_action', client_secret: 'cs_1' } }] } })
    routes['POST /billing/subscriptions/9001/sync'] = answer({ error: true, result: ['sync down'] })
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
    expect(await payUpgrade()).toMatchObject({ kind: 'uncertain', result: null })
  })

  it('(c4b) 3DS succeeded but the subscription does not end up active is uncertain', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 9001, project_id: PROJECT, status: 'incomplete', data: { status: 'requires_action', client_secret: 'cs_1' } }] } })
    routes['POST /billing/subscriptions/9001/sync'] = answer({ error: false, result: { id: 9001, status: 'incomplete' } })
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
    expect(await payUpgrade()).toMatchObject({ kind: 'uncertain', error: 'Payment Failed' })
  })

  it('(c4c) an exception during 3DS is uncertain', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 9001, project_id: PROJECT, status: 'incomplete', data: { status: 'requires_action', client_secret: 'cs_1' } }] } })
    routes['POST /billing/subscriptions/9001/sync'] = answer({ error: false, result: { id: 9001, status: 'incomplete' } })
    stripe.confirmCardPayment.mockRejectedValue(new Error('stripe.js crashed'))
    expect(await payUpgrade()).toMatchObject({ kind: 'uncertain' })
  })

  it('(c5) 3DS rejected by Stripe, with no succeeded payment intent, is declined', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 9001, project_id: PROJECT, status: 'incomplete', data: { status: 'requires_action', client_secret: 'cs_1' } }] } })
    routes['POST /billing/subscriptions/9001/sync'] = answer({ error: false, result: { id: 9001, status: 'incomplete' } })
    stripe.confirmCardPayment.mockResolvedValue({ error: { message: 'Authentication failed' }, paymentIntent: { status: 'requires_payment_method' } })
    const ui = await mountController()
    await pay(ui, { propPlanId: 3, period: 'monthly', subscription: { id: 1, status: 'active' } })
    expect(ui.current.placeOrderState).toMatchObject({ loading: false, kind: 'declined', result: null })
    expect(ui.current.confirmState.error).toBe('Authentication failed')
  })

  it('(c5b) 3DS rejected and the sync also failing is still declined', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 9001, project_id: PROJECT, status: 'incomplete', data: { status: 'requires_action', client_secret: 'cs_1' } }] } })
    routes['POST /billing/subscriptions/9001/sync'] = answer({ error: true, result: ['sync down'] })
    stripe.confirmCardPayment.mockResolvedValue({ error: { message: 'Authentication failed' } })
    expect(await payUpgrade()).toMatchObject({ kind: 'declined' })
  })

  it('(c6) two subscriptions, one active and one not, is uncertain', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 1, status: 'active' }, { id: 2, status: 'incomplete' }] } })
    expect(await payUpgrade()).toMatchObject({ kind: 'uncertain', error: 'Payment Failed' })
  })

  it('(c6b) one active and one requiring another paymethod is uncertain, not declined', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 1, status: 'active' }, { id: 2, status: 'incomplete', data: { status: 'requires_payment_method' } }] } })
    expect(await payUpgrade()).toMatchObject({ kind: 'uncertain' })
  })

  it('the checks before sending are declined and send nothing', async () => {
    routes['GET /billing/plans/public'] = answer({ error: false, result: [] })
    const ui = await mountController({ isUpgradeToPro: true, upgradeProPlanId: [3], projectId: PROJECT })
    await pay(ui, { propPlanId: 3, period: 'monthly', subscription: {} })
    expect(ui.current.placeOrderState).toMatchObject({ kind: 'declined', error: 'Please pay your current subscription before you upgrade to Pro' })
    await pay(ui, { propPlanId: undefined, period: 'monthly', subscription: { id: 1, status: 'active' } })
    expect(ui.current.placeOrderState).toMatchObject({ kind: 'declined', error: 'Project plan id is missing', messages: ['Project plan id is missing'] })
    expect(charges()).toEqual([])
  })

  it('a missing project id is declined and sends nothing', async () => {
    const ui = { current: null }
    render(<BillingPaymentOptions UIComponent={(props) => { ui.current = props; return null }} />)
    await pay(ui, { propPlanId: 3, period: 'monthly', subscription: { id: 1, status: 'active' } })
    expect(ui.current.placeOrderState).toMatchObject({ kind: 'declined', error: 'Project id is missing' })
    expect(calls).toEqual([])
  })

  it('starts a new attempt with no kind and no messages', async () => {
    routes[chargeRoute] = answer({ error: true, result: ['Your card was declined.'] }, 400)
    const ui = await mountController()
    await pay(ui, { propPlanId: 3, period: 'monthly', subscription: { id: 1, status: 'active' } })
    expect(ui.current.placeOrderState.kind).toBe('declined')
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [{ id: 1, status: 'active' }] } })
    await pay(ui, { propPlanId: 3, period: 'monthly', subscription: { id: 1, status: 'active' } })
    expect(ui.current.placeOrderState).toMatchObject({ kind: null, messages: [], error: null })
  })
})

// the answers of billing-api#100. A plan change keeps the paid plan active until the new one is paid: the new
// subscription carries `data.plan_change` pending, next to the old one still active. Two new refusals come as 409.
describe('BillingPaymentOptions controller · plan change answers of billing-api#100', () => {
  const oldPlan = { id: 501, status: 'active', interval: 'month', plan: { plan: { id: 3, name: 'Basic' } } }
  const pendingChange = { status: 'pending', replaces: [501] }
  const newPlan = (data) => ({ id: 600, project_id: PROJECT, status: 'incomplete', interval: 'year', data: { plan_change: pendingChange, ...data } })

  beforeEach(() => {
    routes = { 'GET /billing/subscriptions': answer({ error: false, result: [oldPlan] }) }
    installFetch()
    stripe.confirmCardPayment.mockReset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  const upgrade = async () => {
    const ui = await mountController()
    await choosePaymethod(ui)
    await pay(ui, { propPlanId: 12, period: 'annual', subscription: oldPlan })
    return ui
  }

  it.each(['plan_change.pending_modify_unsupported', 'plan_change.mixed_interval_pending', 'plan_change.payment_pending'])('a 409 %s is declined with its code, sent once', async (code) => {
    routes[chargeRoute] = answer({ error: true, result: [code] }, 409)
    const ui = await upgrade()
    expect(ui.current.placeOrderState).toMatchObject({ loading: false, kind: 'declined', error: code, messages: [code] })
    expect(charges()).toHaveLength(1)
  })

  it('a card rejected on the new plan, with the old one still active, is declined: nothing was charged', async () => {
    routes[chargeRoute] = answer({ error: false, result: { payment: null, subscriptions: [oldPlan, newPlan({ status: 'requires_payment_method' })] } })
    const ui = await upgrade()
    expect(ui.current.placeOrderState).toMatchObject({ kind: 'declined', error: 'Subscription status requires payment method' })
  })

  it('a 3DS that Stripe rejects on the new plan, with the old one still active, is declined', async () => {
    routes[chargeRoute] = answer({ error: false, result: { payment: null, subscriptions: [oldPlan, newPlan({ status: 'requires_action', client_secret: 'cs_1' })] } })
    routes['POST /billing/subscriptions/600/sync'] = answer({ error: false, result: newPlan({ status: 'requires_payment_method' }) })
    stripe.confirmCardPayment.mockResolvedValue({ error: { message: 'Authentication failed' }, paymentIntent: { status: 'requires_payment_method' } })
    const ui = await upgrade()
    expect(ui.current.placeOrderState).toMatchObject({ kind: 'declined' })
  })

  it('an earlier plan change already applied does not count as this request', async () => {
    const applied = { ...oldPlan, data: { plan_change: { status: 'applied', replaces: [400] } } }
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [applied, newPlan({ status: 'requires_payment_method' })] } })
    const ui = await upgrade()
    expect(ui.current.placeOrderState).toMatchObject({ kind: 'declined' })
  })

  it('with today\'s API (no plan_change), one active and one requiring another card stays uncertain', async () => {
    routes[chargeRoute] = answer({ error: false, result: { subscriptions: [oldPlan, { id: 600, status: 'incomplete', data: { status: 'requires_payment_method' } }] } })
    const ui = await upgrade()
    expect(ui.current.placeOrderState).toMatchObject({ kind: 'uncertain', error: 'Subscription status requires payment method' })
  })

  it('paying the pending attempt the dialog offers after the 409 goes to the retry route of that subscription', async () => {
    const pendingAttempt = { id: 2002, status: 'incomplete', interval: 'month', plan: { plan: { id: 12, name: 'Pro' } } }
    routes[chargeRoute] = answer({ error: true, result: ['plan_change.mixed_interval_pending'] }, 409)
    routes['POST /billing/subscriptions/2002'] = answer({ error: false, result: { subscriptions: [{ id: 2002, status: 'active' }] } })
    routes['GET /billing/plans/public'] = answer({ error: false, result: [{ id: 12, rank: 1, prices: {} }] })
    const ui = await mountController({ isUpgradeToPro: true, upgradeProPlanId: [12], settings: { stripe_public_key: 'pk' } })
    await choosePaymethod(ui)
    await pay(ui, { propPlanId: 12, period: 'annual', subscription: oldPlan })
    await pay(ui, { propPlanId: 12, period: 'monthly', subscription: pendingAttempt })
    expect(charges()).toEqual([
      { method: 'POST', path: '/billing/subscriptions/plans', body: { plan_id: 12, period: 'annual', replace: true, user_paymethod_id: 'pm1' } },
      { method: 'POST', path: '/billing/subscriptions/2002', body: { user_paymethod_id: 'pm1' } }
    ])
  })
})

// (billing-api#103): a plan change by modify keeps the subscription active, with the change pending in `data` until
// the invoice of the change is paid. `data.status` says whether the card failed or 3DS is needed.
describe('BillingPaymentOptions controller · plan change by modify (billing-api#103)', () => {
  const modifyChange = { status: 'pending', kind: 'modify', stripe_subscription: 'sub_basic', invoice: 'in_sub_basic' }
  const modified = (data) => ({ id: 501, project_id: PROJECT, status: 'active', interval: 'year', data: { plan_change: modifyChange, ...data } })

  beforeEach(() => {
    routes = { 'GET /billing/subscriptions': answer({ error: false, result: [modified({})] }) }
    installFetch()
    stripe.confirmCardPayment.mockReset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  const upgrade = async () => {
    const ui = await mountController()
    await choosePaymethod(ui)
    await pay(ui, { propPlanId: 12, period: 'annual', subscription: { id: 501, status: 'active' } })
    return ui
  }

  it('a card rejected on the change is declined although the subscription stays active', async () => {
    routes[chargeRoute] = answer({ error: false, result: { payment: null, subscriptions: [modified({ status: 'requires_payment_method', client_secret: 'cs_modify' })] } })
    const ui = await upgrade()
    expect(ui.current.placeOrderState).toMatchObject({ kind: 'declined', error: 'Subscription status requires payment method' })
  })

  it('a change that needs 3DS follows today\'s flow: Stripe confirms, sync, and it ends paid', async () => {
    routes[chargeRoute] = answer({ error: false, result: { payment: null, subscriptions: [modified({ status: 'requires_action', client_secret: 'cs_modify' })] } })
    routes['POST /billing/subscriptions/501/sync'] = answer({ error: false, result: modified({ status: 'succeeded', plan_change: { ...modifyChange, status: 'applied' } }) })
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
    routes['GET /billing/subscriptions'] = answer({ error: false, result: [modified({})] })
    const ui = await upgrade()
    expect(stripe.confirmCardPayment).toHaveBeenCalledWith('cs_modify')
    expect(ui.current.placeOrderState).toMatchObject({ error: null, kind: null })
    expect(ui.current.placeOrderState.result).toHaveLength(1)
  })

  it('3DS failed and the sync still shows the change pending is not a success, whatever data.status says', async () => {
    routes[chargeRoute] = answer({ error: false, result: { payment: null, subscriptions: [modified({ status: 'requires_action', client_secret: 'cs_modify' })] } })
    routes['POST /billing/subscriptions/501/sync'] = answer({ error: false, result: modified({ status: 'canceled' }) })
    stripe.confirmCardPayment.mockResolvedValue({ error: { message: 'Authentication failed' }, paymentIntent: { status: 'requires_payment_method' } })
    const ui = await upgrade()
    expect(ui.current.placeOrderState.result).toBeNull()
    expect(ui.current.placeOrderState.kind).not.toBeNull()
  })

  it('after a 3DS that failed on the change, «Pay the pending payment» pays that subscription with the chosen card', async () => {
    routes[chargeRoute] = answer({ error: false, result: { payment: null, subscriptions: [modified({ status: 'requires_action', client_secret: 'cs_modify' })] } })
    routes['POST /billing/subscriptions/501/sync'] = answer({ error: false, result: modified({ status: 'requires_payment_method' }) })
    routes['POST /billing/subscriptions/501'] = answer({ error: false, result: { subscriptions: [modified({ status: 'succeeded', plan_change: { ...modifyChange, status: 'applied' } })] } })
    stripe.confirmCardPayment.mockResolvedValue({ error: { message: 'Authentication failed' }, paymentIntent: { status: 'requires_payment_method' } })
    const ui = await upgrade()
    expect(ui.current.placeOrderState.kind).toBe('declined')
    const pending = ui.current.subscriptionsState.subscriptions.find(sub => sub.id === 501)
    await pay(ui, { propPlanId: 3, period: 'annual', subscription: pending, payPending: true })
    expect(charges()).toEqual([
      { method: 'POST', path: '/billing/subscriptions/plans', body: { plan_id: 12, period: 'annual', replace: true, user_paymethod_id: 'pm1' } },
      { method: 'POST', path: '/billing/subscriptions/501', body: { user_paymethod_id: 'pm1' } }
    ])
    expect(ui.current.placeOrderState).toMatchObject({ error: null, kind: null })
  })

  it('a 3DS that Stripe rejects on the change is declined, never taken as paid', async () => {
    routes[chargeRoute] = answer({ error: false, result: { payment: null, subscriptions: [modified({ status: 'requires_action', client_secret: 'cs_modify' })] } })
    routes['POST /billing/subscriptions/501/sync'] = answer({ error: false, result: modified({ status: 'requires_payment_method' }) })
    stripe.confirmCardPayment.mockResolvedValue({ error: { message: 'Authentication failed' }, paymentIntent: { status: 'requires_payment_method' } })
    const ui = await upgrade()
    expect(ui.current.placeOrderState).toMatchObject({ kind: 'declined', result: null })
  })
})

describe('BillingPaymentOptions controller · double submit', () => {
  beforeEach(() => {
    routes = { 'GET /billing/subscriptions': answer({ error: false, result: SUBS_LIST }) }
    installFetch()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('(d) two calls in a row send a single charge', async () => {
    let finish
    routes[chargeRoute] = new Promise(resolve => { finish = () => resolve({ status: 200, json: async () => ({ error: false, result: { subscriptions: [{ id: 1, status: 'active' }] } }) }) })
    const ui = await mountController()
    const args = { propPlanId: 3, period: 'monthly', subscription: { id: 1, status: 'active' } }
    await act(async () => {
      const first = ui.current.handlePlaceOrder(args)
      const second = ui.current.handlePlaceOrder(args)
      finish()
      await Promise.all([first, second])
    })
    expect(charges()).toHaveLength(1)
  })

  it('(d2) once the first charge ends, a declined one can be tried again', async () => {
    routes[chargeRoute] = answer({ error: true, result: ['Your card was declined.'] }, 400)
    const ui = await mountController()
    const args = { propPlanId: 3, period: 'monthly', subscription: { id: 1, status: 'active' } }
    await pay(ui, args)
    await pay(ui, args)
    expect(charges()).toHaveLength(2)
  })
})
