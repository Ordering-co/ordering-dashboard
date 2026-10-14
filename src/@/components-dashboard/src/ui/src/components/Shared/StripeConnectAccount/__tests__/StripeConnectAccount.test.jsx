import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const showToast = vi.fn()
const handleOpenStripe = vi.fn()
const handleDisconnect = vi.fn()
const handleGetStripeLink = vi.fn()
let accountState
let canDisconnect

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast }],
  ToastType: { Success: 'success' },
  StripeConnectAccount: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      accountState={accountState}
      actionState={{ loading: false, error: null }}
      handleOpenStripe={handleOpenStripe}
      handleGetStripeLink={handleGetStripeLink}
      handleDisconnect={canDisconnect ? handleDisconnect : undefined}
    />
  )
}))

vi.mock('../../Confirm', () => {
  const Dialog = ({ open, content, onAccept }) => open
    ? (
      <div role='alertdialog'>
        {Array.isArray(content) ? content.join(' ') : content}
        <button type='button' onClick={onAccept}>Accept</button>
      </div>
      )
    : null
  return { Alert: Dialog, Confirm: Dialog }
})

vi.mock('../../../../styles', () => ({
  Button: ({ children, color, ...props }) => <button type='button' {...props}>{children}</button>
}))

import { StripeConnectAccount, getStripeConnectAccountStatus } from '../index'

const ready = {
  account_id: 'acct_test',
  sandbox: true,
  details_submitted: true,
  payouts_enabled: true,
  transfers_enabled: true,
  requirements: { currently_due: [], past_due: [], disabled_reason: null }
}

describe('StripeConnectAccount card', () => {
  beforeEach(() => {
    showToast.mockReset()
    handleOpenStripe.mockReset()
    handleDisconnect.mockReset()
    handleGetStripeLink.mockReset()
    canDisconnect = true
    accountState = { loading: false, error: null, account: null }
  })

  it('tells where an account stands', () => {
    expect(getStripeConnectAccountStatus(null)).toBe('none')
    expect(getStripeConnectAccountStatus({ details_submitted: false, transfers_enabled: false })).toBe('pending')
    expect(getStripeConnectAccountStatus({ details_submitted: true, transfers_enabled: false })).toBe('review')
    expect(getStripeConnectAccountStatus(ready)).toBe('ready')
  })

  it('offers to connect while there is no account', async () => {
    handleOpenStripe.mockResolvedValue({ error: false, result: { url: 'https://connect.stripe.com/x', opened: true } })
    renderWithProviders(<StripeConnectAccount ownerType='business' ownerId={41} />)

    expect(screen.getByText('Not connected')).toBeInTheDocument()
    expect(screen.getByText('No Stripe account is connected. Its share of each order waits until one is.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Connect with Stripe' }))
    await waitFor(() => expect(handleOpenStripe).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('link', { name: 'Open Stripe' })).not.toBeInTheDocument()
  })

  it('gives a link to Stripe when the browser blocked the window', async () => {
    handleOpenStripe.mockResolvedValue({ error: false, result: { url: 'https://connect.stripe.com/x', opened: false } })
    renderWithProviders(<StripeConnectAccount ownerType='business' ownerId={41} />)

    fireEvent.click(screen.getByRole('button', { name: 'Connect with Stripe' }))

    const link = await screen.findByRole('link', { name: 'Open Stripe' })
    expect(link).toHaveAttribute('href', 'https://connect.stripe.com/x')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('shows why Stripe could not be opened', async () => {
    handleOpenStripe.mockResolvedValue({ error: true, result: ['Stripe Connect payouts are off'] })
    renderWithProviders(<StripeConnectAccount ownerType='business' ownerId={41} />)

    fireEvent.click(screen.getByRole('button', { name: 'Connect with Stripe' }))

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Stripe Connect payouts are off')
  })

  it('shows a connected account that can receive payments', () => {
    accountState = { loading: false, error: null, account: ready }
    renderWithProviders(<StripeConnectAccount ownerType='business' ownerId={41} />)

    expect(screen.getByText('Ready to receive payments')).toBeInTheDocument()
    expect(screen.getByText('Test mode')).toBeInTheDocument()
    expect(screen.getByText('acct_test')).toBeInTheDocument()
    expect(screen.getByText('Can receive transfers')).toBeInTheDocument()
    expect(screen.queryByText('Stripe is asking this account for more information.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect with Stripe' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue in Stripe' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
  })

  it('tells that a store account that is not ready is completed on Stripe, with no way back from here', () => {
    accountState = {
      loading: false,
      error: null,
      account: { ...ready, sandbox: false, details_submitted: false, transfers_enabled: false, requirements: { currently_due: ['external_account'], past_due: [] } }
    }
    renderWithProviders(<StripeConnectAccount ownerType='business' ownerId={41} />)

    expect(screen.getByText('Details pending')).toBeInTheDocument()
    expect(screen.queryByText('Test mode')).not.toBeInTheDocument()
    expect(screen.getByText('Stripe is asking this account for more information.')).toBeInTheDocument()
    expect(screen.getByText('This account cannot receive payments yet. Its owner completes it from their own Stripe dashboard.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue in Stripe' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect with Stripe' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
  })

  it('sends a driver whose account is not ready back to the onboarding form', async () => {
    canDisconnect = false
    accountState = {
      loading: false,
      error: null,
      account: { ...ready, details_submitted: true, transfers_enabled: false }
    }
    handleOpenStripe.mockResolvedValue({ error: false, result: { url: 'https://connect.stripe.com/setup', opened: true } })
    renderWithProviders(<StripeConnectAccount ownerType='driver' ownerId={6} />)

    expect(screen.getByText('Not ready to receive payments')).toBeInTheDocument()
    expect(screen.queryByText('This account cannot receive payments yet. Its owner completes it from their own Stripe dashboard.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continue in Stripe' }))
    await waitFor(() => expect(handleOpenStripe).toHaveBeenCalledTimes(1))
  })

  it('disconnects only after it is confirmed', async () => {
    accountState = { loading: false, error: null, account: ready }
    handleDisconnect.mockResolvedValue({ error: false, result: true })
    renderWithProviders(<StripeConnectAccount ownerType='business' ownerId={41} />)

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(handleDisconnect).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Disconnect this Stripe account?')

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('success', 'Stripe account disconnected'))
    expect(handleDisconnect).toHaveBeenCalledTimes(1)
  })

  it('lets an administrator start the onboarding of a driver or copy its link for them', async () => {
    canDisconnect = false
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    handleGetStripeLink.mockResolvedValue({ error: false, result: { url: 'https://connect.stripe.com/setup/e/acct_x' } })
    renderWithProviders(<StripeConnectAccount ownerType='driver' ownerId={6} />)

    expect(screen.getByText(/The driver can also connect it from the Driver App\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start onboarding' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect with Stripe' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copy onboarding link' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('success', 'Onboarding link copied'))
    expect(writeText).toHaveBeenCalledWith('https://connect.stripe.com/setup/e/acct_x')
    expect(handleOpenStripe).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('shows the onboarding link when it cannot be copied', async () => {
    canDisconnect = false
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    handleGetStripeLink.mockResolvedValue({ error: false, result: { url: 'https://connect.stripe.com/setup/e/acct_x' } })
    renderWithProviders(<StripeConnectAccount ownerType='driver' ownerId={6} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy onboarding link' }))

    expect(await screen.findByRole('link', { name: 'Open Stripe' })).toHaveAttribute('href', 'https://connect.stripe.com/setup/e/acct_x')
    expect(screen.queryByText(/Your browser blocked the Stripe window/)).not.toBeInTheDocument()
    expect(showToast).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('offers a store no onboarding link to copy', () => {
    renderWithProviders(<StripeConnectAccount ownerType='business' ownerId={41} />)

    expect(screen.queryByRole('button', { name: 'Copy onboarding link' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Driver App/)).not.toBeInTheDocument()
  })

  it('offers no disconnect where the controller gives none', () => {
    canDisconnect = false
    accountState = { loading: false, error: null, account: ready }
    renderWithProviders(<StripeConnectAccount ownerType='driver' ownerId={6} />)

    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument()
  })

  it('shows the error of an account that could not be read', () => {
    accountState = { loading: false, error: ['Not allowed'], account: null }
    renderWithProviders(<StripeConnectAccount ownerType='business' ownerId={41} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Not allowed')
    expect(screen.queryByRole('button', { name: 'Connect with Stripe' })).not.toBeInTheDocument()
  })
})
