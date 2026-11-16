/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign UC-B1 (M-C3, decision 4A): wallet controller waits for the user, exposes walletUsers/refreshWallet
// and resolves the outcome of add/reduce money
const mocks = vi.hoisted(() => ({
  chain: null,
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'token' }] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.chain] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { UserWallet } from '..'

const WALLET = { id: 9, type: 'cash', balance: 10 }
const OTHER_WALLET = { id: 8, type: 'credit_point', balance: 3 }
const EVENT = { id: 1, event_type: 'manual', event: 'movement', amount: 5, author_id: 3 }
const AUTHOR = { id: 3, name: 'Zoe', lastname: 'Quinn' }

const makeChain = () => {
  const chain = { root: 'https://api.test', appId: 'app-1', appInternalName: 'dashboard' }
  chain.setAccessToken = vi.fn(() => chain)
  chain.users = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.where = vi.fn(() => chain)
  chain.get = vi.fn(async () => ({ content: { error: false, result: [{ ...AUTHOR }] } }))
  return chain
}

let eventPost
const json = (content) => ({ json: async () => content })

const fetchMock = vi.fn(async (url, options) => {
  const method = options?.method
  if (method === 'POST') return eventPost(url, options)
  if (/\/wallets\/\d+\/events/.test(url)) return json({ error: false, result: [EVENT] })
  if (/\/wallets$/.test(url)) return json({ error: false, result: [OTHER_WALLET, WALLET] })
  throw new Error(`unexpected fetch ${url}`)
})

const walletCalls = () => fetchMock.mock.calls.filter(([url]) => /\/wallets$/.test(url))

const makeUi = () => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  return { ui, UIComponent }
}

const renderWallet = (props = { userId: 4 }) => {
  const { ui, UIComponent } = makeUi()
  const view = render(<UserWallet UIComponent={UIComponent} walletType='cash' {...props} />)
  return { ui, UIComponent, ...view }
}

const loaded = async (ui) => waitFor(() => expect(ui.current.walletState.wallet?.id).toBe(9))

const typeAmount = (ui, amount, isAdd) => act(async () => {
  ui.current.handleChangeInput({ target: { name: 'amount', value: amount } }, isAdd)
})

describe('UserWallet (UC-B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain()
    eventPost = async () => json({ error: false, result: { amount: 5 } })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('waits for the user', () => {
    it.each([[undefined], [null]])('makes no request at all while userId is %s', async (userId) => {
      const { ui } = renderWallet({ userId })
      await act(async () => {})

      expect(fetchMock).not.toHaveBeenCalled()
      expect(mocks.chain.get).not.toHaveBeenCalled()
      expect(ui.current.walletState).toEqual({ loading: false, wallet: {}, error: null })
    })

    it('fetches the wallet of the user once it arrives', async () => {
      const { ui, UIComponent, rerender } = renderWallet({ userId: undefined })
      await act(async () => {})
      expect(fetchMock).not.toHaveBeenCalled()

      rerender(<UserWallet UIComponent={UIComponent} walletType='cash' userId={4} />)
      await loaded(ui)

      expect(walletCalls().map(([url]) => url)).toEqual(['https://api.test/users/4/wallets'])
      expect(ui.current.walletState.wallet).toEqual(WALLET)
    })

    it('still fetches at once when the userId is there on mount (today)', async () => {
      const { ui } = renderWallet({ userId: 4 })
      await loaded(ui)

      expect(walletCalls()).toHaveLength(1)
    })
  })

  describe('what the UI receives', () => {
    it('passes walletUsers (the authors of the events) and refreshWallet', async () => {
      const { ui } = renderWallet()
      expect(ui.current.walletUsers).toEqual([])
      await loaded(ui)
      await waitFor(() => expect(ui.current.walletUsers).toEqual([AUTHOR]))

      expect(mocks.chain.where).toHaveBeenCalledWith([{ attribute: 'id', value: [3] }])
      expect(typeof ui.current.refreshWallet).toBe('function')
    })

    it('refreshWallet reads the wallet again', async () => {
      const { ui } = renderWallet()
      await loaded(ui)
      expect(walletCalls()).toHaveLength(1)

      await act(async () => { await ui.current.refreshWallet() })

      expect(walletCalls()).toHaveLength(2)
    })

    it('keeps passing the props it already passed', async () => {
      const { ui } = renderWallet()
      await loaded(ui)
      await waitFor(() => expect(ui.current.walletUsers).toHaveLength(1))

      expect(ui.current.parseEvent(EVENT)).toBe('<strong>Zoe Quinn</strong> add money')
      for (const key of ['walletEventsState', 'addWalletState', 'reduceWalletState', 'actionState', 'handleChangeInput', 'handleAddWalletMoney', 'handleReduceWalletMoney']) {
        expect(ui.current[key]).toBeDefined()
      }
    })
  })

  describe('handleAddWalletMoney', () => {
    it('resolves { ok: true, error: null }, posts the amount as typed (text) and adds it to the balance', async () => {
      const { ui } = renderWallet()
      await loaded(ui)
      await typeAmount(ui, '5', true)

      let outcome
      await act(async () => { outcome = await ui.current.handleAddWalletMoney() })

      expect(outcome).toEqual({ ok: true, error: null })
      const [url, options] = fetchMock.mock.calls.find(([, opts]) => opts?.method === 'POST')
      expect(url).toBe('https://api.test/users/4/wallets/9/events')
      expect(JSON.parse(options.body)).toEqual({ amount: '5' })
      expect(ui.current.walletState.wallet.balance).toBe(15)
      expect(ui.current.actionState).toEqual({ loading: false, error: null })
      expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Wallet money added')
    })

    it('resolves { ok: false, error } with the API strings on an API error', async () => {
      eventPost = async () => json({ error: true, result: ['Not enough rights'] })
      const { ui } = renderWallet()
      await loaded(ui)
      await typeAmount(ui, '5', true)

      let outcome
      await act(async () => { outcome = await ui.current.handleAddWalletMoney() })

      expect(outcome).toEqual({ ok: false, error: ['Not enough rights'] })
      expect(ui.current.walletState.wallet.balance).toBe(10)
      expect(ui.current.actionState).toEqual({ loading: false, error: ['Not enough rights'] })
      expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Wallet money added')
    })

    it('resolves { ok: false, error: null } when the request throws, and never an object as error', async () => {
      eventPost = async () => { throw new Error('network down') }
      const { ui } = renderWallet()
      await loaded(ui)
      await typeAmount(ui, '5', true)

      let outcome
      await act(async () => { outcome = await ui.current.handleAddWalletMoney() })
      expect(outcome).toEqual({ ok: false, error: null })
      expect(ui.current.actionState).toEqual({ loading: false, error: ['network down'] })

      eventPost = async () => json({ error: true, result: { message: 'x' } })
      await act(async () => { outcome = await ui.current.handleAddWalletMoney() })
      expect(outcome).toEqual({ ok: false, error: null })
    })
  })

  describe('handleReduceWalletMoney', () => {
    it('resolves { ok: true, error: null } and posts the amount with a «-» prefix, as text', async () => {
      eventPost = async () => json({ error: false, result: { amount: -4 } })
      const { ui } = renderWallet()
      await loaded(ui)
      await typeAmount(ui, '4', false)

      let outcome
      await act(async () => { outcome = await ui.current.handleReduceWalletMoney() })

      expect(outcome).toEqual({ ok: true, error: null })
      const [, options] = fetchMock.mock.calls.find(([, opts]) => opts?.method === 'POST')
      expect(JSON.parse(options.body)).toEqual({ amount: '-4' })
      expect(ui.current.walletState.wallet.balance).toBe(6)
      expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Wallet money reduced')
    })

    it('resolves { ok: false, error } on an API error, and { ok: false, error: null } on a throw', async () => {
      eventPost = async () => json({ error: true, result: ['Insufficient balance'] })
      const { ui } = renderWallet()
      await loaded(ui)
      await typeAmount(ui, '40', false)

      let outcome
      await act(async () => { outcome = await ui.current.handleReduceWalletMoney() })
      expect(outcome).toEqual({ ok: false, error: ['Insufficient balance'] })
      expect(ui.current.walletState.wallet.balance).toBe(10)

      eventPost = async () => { throw new Error('network down') }
      await act(async () => { outcome = await ui.current.handleReduceWalletMoney() })
      expect(outcome).toEqual({ ok: false, error: null })
    })
  })
})
