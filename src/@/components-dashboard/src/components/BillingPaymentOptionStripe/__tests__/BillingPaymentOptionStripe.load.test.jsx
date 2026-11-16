/* eslint-disable import/first */
// (purchase-addons P-2): opening the card selection (/purchase/addons, the Billing modal) must not change the account's
// billing. main marked the only card as the default as soon as the list loaded (POST /billing/paymethods/:id/default). Loading now
// only reads: the default card is preselected, and a single card that is not the default waits for the user to choose it, which
// still writes the default as in main.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// stable objects, as the real contexts give them (the controller loads again when `user` changes)
const mocks = vi.hoisted(() => ({
  api: [{ root: 'https://api.test' }],
  session: [{ user: { id: 9, email: 'owner@example.test' }, token: 'test-token' }]
}))

vi.mock('~components', () => ({
  useApi: () => mocks.api,
  useSession: () => mocks.session
}))

import { BillingPaymentOptionStripe } from '../index'

let ui
let calls
let cards
let deletes

const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

beforeEach(() => {
  ui = null
  calls = []
  cards = []
  deletes = []
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    const path = url.replace('https://api.test', '')
    calls.push({ method, path })
    if (path === '/billing/paymethods') return answer({ error: false, result: cards })
    if (path === '/billing/paymethods/requirements') return answer({ error: false, result: { client_secret: 'seti', publishable_key: 'pk' } })
    if (method === 'DELETE' && deletes.length) return answer(deletes.shift())
    return answer({ error: false, result: { id: 5 } })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const mount = (props = {}) => render(<BillingPaymentOptionStripe {...props} UIComponent={(uiProps) => { ui = uiProps; return null }} />)
const writes = () => calls.filter((call) => call.method !== 'GET')

describe('BillingPaymentOptionStripe · load', () => {
  it('a single card that is not the default: nothing is written and nothing is chosen', async () => {
    cards = [{ id: 5, default: false }]
    const onSelectCard = vi.fn()
    mount({ onSelectCard })
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    expect(writes()).toEqual([])
    expect(ui.cardSelected).toBeNull()
    expect(onSelectCard).toHaveBeenCalledWith(null)
  })

  it('the default card is preselected without writing', async () => {
    cards = [{ id: 4, default: false }, { id: 5, default: true }]
    const onSelectCard = vi.fn()
    mount({ onSelectCard })
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    expect(writes()).toEqual([])
    expect(ui.cardSelected).toMatchObject({ id: 5 })
    expect(onSelectCard).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }))
  })

  it('choosing the card still makes it the default (as main)', async () => {
    cards = [{ id: 5, default: false }]
    mount()
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    await act(async () => { await ui.handleCardClick(cards[0]) })
    expect(writes()).toEqual([{ method: 'POST', path: '/billing/paymethods/5/default' }])
    expect(ui.cardSelected).toMatchObject({ id: 5 })
  })
})

// Owner decision 17 B (2026-10-21): when /default fails the card that will be charged is the one the person had, and they are told.
describe('BillingPaymentOptionStripe · a default that fails goes back (owner decision 17)', () => {
  it('the API refuses: the previous card is selected again, the parent is told and the state says it went back', async () => {
    cards = [{ id: 4, default: false }, { id: 5, default: true }]
    const onSelectCard = vi.fn()
    mount({ onSelectCard })
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    expect(ui.cardSelected).toMatchObject({ id: 5 })
    onSelectCard.mockClear()
    fetch.mockImplementationOnce(() => answer({ error: true, result: 'Card is expired' }))
    await act(async () => { await ui.handleCardClick(cards[0]) })
    expect(ui.cardSelected).toMatchObject({ id: 5 })
    expect(onSelectCard).toHaveBeenLastCalledWith(expect.objectContaining({ id: 5 }))
    expect(onSelectCard).not.toHaveBeenCalledWith(expect.objectContaining({ id: 4 }))
    expect(ui.cardDefaultState).toMatchObject({ loading: false, error: 'Card is expired', reverted: true })
    expect(ui.cardsList.cards.find((card) => card.default).id).toBe(5)
  })

  it('the network fails: the same, never the clicked card', async () => {
    cards = [{ id: 4, default: false }, { id: 5, default: true }]
    const onSelectCard = vi.fn()
    mount({ onSelectCard })
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    onSelectCard.mockClear()
    fetch.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    await act(async () => { await ui.handleCardClick(cards[0]) })
    expect(ui.cardSelected).toMatchObject({ id: 5 })
    expect(onSelectCard).toHaveBeenLastCalledWith(expect.objectContaining({ id: 5 }))
    expect(ui.cardDefaultState).toMatchObject({ loading: false, reverted: true })
  })

  it('deleting or adding a card clears the mark (review of W2)', async () => {
    cards = [{ id: 4, default: false }, { id: 5, default: true }, { id: 6, default: false }]
    mount()
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    fetch.mockImplementationOnce(() => answer({ error: true, result: 'Card is expired' }))
    await act(async () => { await ui.handleCardClick(cards[0]) })
    expect(ui.cardDefaultState.reverted).toBe(true)
    await act(async () => { await ui.deleteCard({ id: 6 }) })
    expect(ui.cardDefaultState.reverted).toBeFalsy()

    fetch.mockImplementationOnce(() => answer({ error: true, result: 'Card is expired' }))
    await act(async () => { await ui.handleCardClick(cards[0]) })
    expect(ui.cardDefaultState.reverted).toBe(true)
    await act(async () => { await ui.handleNewCard({ id: 9 }) })
    expect(ui.cardDefaultState.reverted).toBeFalsy()
  })

  it('a default that works clears the mark', async () => {
    cards = [{ id: 4, default: false }, { id: 5, default: true }]
    mount()
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    fetch.mockImplementationOnce(() => answer({ error: true, result: 'Card is expired' }))
    await act(async () => { await ui.handleCardClick(cards[0]) })
    await act(async () => { await ui.handleCardClick(cards[0]) })
    expect(ui.cardSelected).toMatchObject({ id: 4 })
    expect(ui.cardDefaultState.reverted).toBeFalsy()
    expect(ui.cardDefaultState.error).toBeNull()
  })
})

describe('BillingPaymentOptionStripe · deleting a card (R1-2, main-2)', () => {
  it('R1-2: the error of a failed delete is gone after a delete that works', async () => {
    cards = [{ id: 4, default: false }, { id: 6, default: false }, { id: 5, default: true }]
    deletes = [{ error: true, result: 'Cannot delete this card' }, { error: false, result: 'ok' }]
    mount()
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    await act(async () => { await ui.deleteCard({ id: 4 }) })
    expect(ui.cardsList.error).toBe('Cannot delete this card')
    expect(ui.cardsList.cards.map((card) => card.id)).toEqual([4, 6, 5])
    await act(async () => { await ui.deleteCard({ id: 6 }) })
    expect(ui.cardsList.error).toBeNull()
    expect(ui.cardsList.cards.map((card) => card.id)).toEqual([4, 5])
  })

  it('main-2: deleting the selected card clears the selection and tells the parent (Pay waits for a new choice)', async () => {
    cards = [{ id: 4, default: false }, { id: 5, default: true }]
    const onSelectCard = vi.fn()
    mount({ onSelectCard })
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    await act(async () => { await ui.handleCardClick(cards[0]) })
    expect(ui.cardSelected).toMatchObject({ id: 4 })
    onSelectCard.mockClear()
    await act(async () => { await ui.deleteCard({ id: 4 }) })
    expect(ui.cardsList.cards.map((card) => card.id)).toEqual([5])
    expect(ui.cardSelected).toBeNull()
    expect(onSelectCard).toHaveBeenCalledTimes(1)
    expect(onSelectCard).toHaveBeenCalledWith(null)
  })

  it('main-2: deleting another card keeps the selection and does not call the parent', async () => {
    cards = [{ id: 4, default: false }, { id: 5, default: true }]
    const onSelectCard = vi.fn()
    mount({ onSelectCard })
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    expect(ui.cardSelected).toMatchObject({ id: 5 })
    onSelectCard.mockClear()
    await act(async () => { await ui.deleteCard({ id: 4 }) })
    expect(ui.cardSelected).toMatchObject({ id: 5 })
    expect(onSelectCard).not.toHaveBeenCalled()
  })

  it('main-2: a delete the API refuses keeps the selected card selected', async () => {
    cards = [{ id: 4, default: false }, { id: 5, default: true }]
    deletes = [{ error: true, result: 'Cannot delete this card' }]
    const onSelectCard = vi.fn()
    mount({ onSelectCard })
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    await act(async () => { await ui.handleCardClick(cards[0]) })
    onSelectCard.mockClear()
    await act(async () => { await ui.deleteCard({ id: 4 }) })
    expect(ui.cardSelected).toMatchObject({ id: 4 })
    expect(onSelectCard).not.toHaveBeenCalled()
  })

  it('main-2: works without a parent callback', async () => {
    cards = [{ id: 4, default: false }, { id: 5, default: true }]
    mount()
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    await act(async () => { await ui.handleCardClick(cards[0]) })
    await act(async () => { await ui.deleteCard({ id: 4 }) })
    expect(ui.cardSelected).toBeNull()
  })
})

// redesign (n.º 5, P-2, M-BM14): the Billing picker opens with the saved cards only. GET /billing/paymethods/requirements
// (a Stripe client_secret and a Rewardful conversion) runs when «Add card» is pressed, once.
describe('BillingPaymentOptionStripe · requirements on demand (n.º 5, P-2)', () => {
  const requirementCalls = () => calls.filter((call) => call.path === '/billing/paymethods/requirements')

  it('opening loads the saved cards and does not ask for the requirements, nor counts a Rewardful conversion', async () => {
    const convert = vi.fn()
    vi.stubGlobal('rewardful', convert)
    window.rewardful = convert
    cards = [{ id: 5, default: true }]
    mount({ requirementsOnDemand: true })
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    expect(calls.map((call) => call.path)).toEqual(['/billing/paymethods'])
    expect(ui.publicKey).toBeUndefined()
    expect(ui.requirementsState).toEqual({ requested: false, loading: false })
    expect(convert).not.toHaveBeenCalled()
    delete window.rewardful
  })

  it('loadRequirements fetches once, sets the key and the secret, and a second press does not fetch again', async () => {
    mount({ requirementsOnDemand: true })
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    await act(async () => { await ui.loadRequirements(); await ui.loadRequirements() })
    expect(requirementCalls()).toHaveLength(1)
    expect(ui.publicKey).toBe('pk')
    expect(ui.requirements).toBe('seti')
    expect(ui.requirementsState).toEqual({ requested: true, loading: false })
  })

  it('a failed request still ends the loading state, with no key', async () => {
    mount({ requirementsOnDemand: true })
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    fetch.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    await act(async () => { await ui.loadRequirements() })
    expect(ui.publicKey).toBeUndefined()
    expect(ui.requirementsState).toEqual({ requested: true, loading: false })
    // review L2 #2: a failed request can be tried again; the retry keeps `requested` while it runs
    await act(async () => { await ui.loadRequirements() })
    expect(requirementCalls()).toHaveLength(1)
    expect(ui.publicKey).toBe('pk')
    expect(ui.requirementsState).toEqual({ requested: true, loading: false })
  })

  it('without the prop (the /purchase/addons Stripe UI) the requirements are still fetched on open, as in main', async () => {
    mount()
    await waitFor(() => expect(ui.cardsList.loading).toBe(false))
    expect(requirementCalls()).toHaveLength(1)
    expect(ui.publicKey).toBe('pk')
    expect(ui.requirementsState).toEqual({ requested: true, loading: false })
  })
})
