/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false, user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))

import { StripeConnectAccount } from '../index'

const account = {
  id: 7,
  owner_type: 'business',
  owner_id: 41,
  account_id: 'acct_test',
  sandbox: true,
  details_submitted: true,
  payouts_enabled: true,
  transfers_enabled: true,
  requirements: { currently_due: [], past_due: [], disabled_reason: null }
}

let lastResult
const UI = ({ accountState, handleOpenStripe, handleGetStripeLink, handleDisconnect }) => (
  <>
    <output data-testid='state'>{JSON.stringify(accountState)}</output>
    <button onClick={async () => { lastResult = await handleOpenStripe() }}>open</button>
    <button onClick={async () => { lastResult = await handleGetStripeLink() }}>link</button>
    {handleDisconnect && (
      <button onClick={async () => { lastResult = await handleDisconnect() }}>disconnect</button>
    )}
  </>
)

const answer = (result, error = false) => ({ ok: !error, json: async () => ({ error, result }) })
const readState = () => JSON.parse(screen.getByTestId('state').textContent)

describe('StripeConnectAccount controller', () => {
  const fetchMock = vi.fn()
  const openMock = vi.fn()

  beforeEach(() => {
    lastResult = undefined
    fetchMock.mockReset()
    openMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('open', openMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reads the account of a business, null while it has none', async () => {
    fetchMock.mockResolvedValue(answer(null))

    render(<StripeConnectAccount UIComponent={UI} ownerType='business' ownerId={41} />)

    await waitFor(() => expect(readState().loading).toBe(false))
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/business/41/stripe_connect_account')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(readState()).toEqual({ loading: false, error: null, account: null })
  })

  it('reads the account of a driver from the users endpoint and offers no disconnect', async () => {
    fetchMock.mockResolvedValue(answer({ ...account, owner_type: 'driver', owner_id: 6 }))

    render(<StripeConnectAccount UIComponent={UI} ownerType='driver' ownerId={6} />)

    await waitFor(() => expect(readState().loading).toBe(false))
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/v400/en/demo/users/6/stripe_connect_account')
    expect(readState().account.account_id).toBe('acct_test')
    expect(screen.queryByText('disconnect')).not.toBeInTheDocument()
  })

  it('opens Stripe in a window of its own and reads the account again when that window says it is done', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    openMock.mockReturnValue(popup)
    fetchMock
      .mockResolvedValueOnce(answer(null))
      .mockResolvedValueOnce(answer({ url: 'https://connect.stripe.com/oauth/authorize?x=1' }))
      .mockResolvedValueOnce(answer(account))

    render(<StripeConnectAccount UIComponent={UI} ownerType='business' ownerId={41} />)
    await waitFor(() => expect(readState().loading).toBe(false))

    await act(async () => { screen.getByText('open').click() })

    expect(openMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/v400/en/demo/business/41/stripe_connect_account/link')
    expect(fetchMock.mock.calls[1][1].method).toBe('POST')
    expect(popup.location.href).toBe('https://connect.stripe.com/oauth/authorize?x=1')
    expect(lastResult).toEqual({ error: false, result: { url: 'https://connect.stripe.com/oauth/authorize?x=1', opened: true } })

    // A message from anywhere else is not the answer
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.test', data: { type: 'stripe_connect_account', connected: true } }))
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { origin: 'https://api.test', data: { type: 'stripe_connect_account', connected: true } }))
    })
    await waitFor(() => expect(readState().account).toEqual(account))
    expect(fetchMock).toHaveBeenCalledTimes(3)

    // The window closes itself and the focus comes back: the account was already read
    popup.closed = true
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('asks for the onboarding form of a driver', async () => {
    openMock.mockReturnValue({ closed: false, close: vi.fn(), location: { href: '' } })
    fetchMock
      .mockResolvedValueOnce(answer(null))
      .mockResolvedValueOnce(answer({ url: 'https://connect.stripe.com/setup/e/acct_x' }))

    render(<StripeConnectAccount UIComponent={UI} ownerType='driver' ownerId={6} />)
    await waitFor(() => expect(readState().loading).toBe(false))

    await act(async () => { screen.getByText('open').click() })

    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/v400/en/demo/users/6/stripe_connect_account/onboarding')
    expect(fetchMock.mock.calls[1][1].method).toBe('POST')
  })

  it('gives the onboarding address of a driver without opening a window, to hand it over', async () => {
    fetchMock
      .mockResolvedValueOnce(answer(null))
      .mockResolvedValueOnce(answer({ url: 'https://connect.stripe.com/setup/e/acct_x' }))

    render(<StripeConnectAccount UIComponent={UI} ownerType='driver' ownerId={6} />)
    await waitFor(() => expect(readState().loading).toBe(false))

    await act(async () => { screen.getByText('link').click() })

    expect(openMock).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/v400/en/demo/users/6/stripe_connect_account/onboarding')
    expect(lastResult).toEqual({ error: false, result: { url: 'https://connect.stripe.com/setup/e/acct_x' } })

    // Nobody left for Stripe from this window: coming back to it reads nothing
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reads the account again when the Stripe window is closed without a message', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    openMock.mockReturnValue(popup)
    fetchMock
      .mockResolvedValueOnce(answer(null))
      .mockResolvedValueOnce(answer({ url: 'https://connect.stripe.com/oauth/authorize' }))
      .mockResolvedValueOnce(answer(account))

    render(<StripeConnectAccount UIComponent={UI} ownerType='business' ownerId={41} />)
    await waitFor(() => expect(readState().loading).toBe(false))
    await act(async () => { screen.getByText('open').click() })

    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    popup.closed = true
    await waitFor(() => expect(readState().account).toEqual(account), { timeout: 2000 })
  })

  it('reads the account once when closing the Stripe window also brings the focus back', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    openMock.mockReturnValue(popup)
    fetchMock
      .mockResolvedValueOnce(answer(null))
      .mockResolvedValueOnce(answer({ url: 'https://connect.stripe.com/oauth/authorize' }))
      .mockResolvedValue(answer(null))

    render(<StripeConnectAccount UIComponent={UI} ownerType='business' ownerId={41} />)
    await waitFor(() => expect(readState().loading).toBe(false))
    await act(async () => { screen.getByText('open').click() })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    popup.closed = true
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 700)) })
    await act(async () => { window.dispatchEvent(new Event('focus')) })

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('waits for the person to come back when the Stripe window only looks closed', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    openMock.mockReturnValue(popup)
    fetchMock
      .mockResolvedValueOnce(answer(null))
      .mockResolvedValueOnce(answer({ url: 'https://connect.stripe.com/oauth/authorize' }))
      .mockResolvedValueOnce(answer(account))

    render(<StripeConnectAccount UIComponent={UI} ownerType='business' ownerId={41} />)
    await waitFor(() => expect(readState().loading).toBe(false))
    await act(async () => { screen.getByText('open').click() })

    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    popup.closed = true
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 700)) })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await waitFor(() => expect(readState().account).toEqual(account))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('hands the address over when the browser blocks the window, and reads the account again on coming back', async () => {
    openMock.mockReturnValue(null)
    fetchMock
      .mockResolvedValueOnce(answer(null))
      .mockResolvedValueOnce(answer({ url: 'https://connect.stripe.com/oauth/authorize' }))
      .mockResolvedValueOnce(answer(account))

    render(<StripeConnectAccount UIComponent={UI} ownerType='business' ownerId={41} />)
    await waitFor(() => expect(readState().loading).toBe(false))
    await act(async () => { screen.getByText('open').click() })

    expect(lastResult).toEqual({ error: false, result: { url: 'https://connect.stripe.com/oauth/authorize', opened: false } })

    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await waitFor(() => expect(readState().account).toEqual(account))
  })

  it('closes the window and answers the error when Stripe cannot be opened', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    openMock.mockReturnValue(popup)
    fetchMock
      .mockResolvedValueOnce(answer(null))
      .mockResolvedValueOnce(answer(['Stripe Connect payouts are off'], true))

    render(<StripeConnectAccount UIComponent={UI} ownerType='business' ownerId={41} />)
    await waitFor(() => expect(readState().loading).toBe(false))
    await act(async () => { screen.getByText('open').click() })

    expect(popup.close).toHaveBeenCalled()
    expect(lastResult).toEqual({ error: true, result: ['Stripe Connect payouts are off'] })
  })

  it('disconnects the account of a business', async () => {
    fetchMock
      .mockResolvedValueOnce(answer(account))
      .mockResolvedValueOnce(answer(true))

    render(<StripeConnectAccount UIComponent={UI} ownerType='business' ownerId={41} />)
    await waitFor(() => expect(readState().account).toEqual(account))

    await act(async () => { screen.getByText('disconnect').click() })

    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/v400/en/demo/business/41/stripe_connect_account')
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
    expect(lastResult.error).toBe(false)
    expect(readState().account).toBeNull()
  })
})
