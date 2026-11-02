import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const api = vi.hoisted(() => ({ ordering: { project: 'orderingv1' } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useApi: () => [api.ordering]
}))

vi.mock('../../SettingsList', () => ({
  SettingsList: ({ category, focus }) => (
    <div data-testid='stripe-connect-settings' data-category={category?.key} data-focus={focus} />
  )
}))

vi.mock('../../../Shared/PayoutRuleForm', () => ({
  PayoutRuleForm: ({ scope }) => <div data-testid={`payout-rule-${scope}`} />
}))

import { SettingsStripeConnect } from '../index'

const category = { key: 'addon_stripe_connect', configs: [{ key: 'stripe_connect_sandbox' }] }

describe('SettingsStripeConnect', () => {
  beforeEach(() => {
    api.ordering = { project: 'orderingv1' }
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } })
  })

  it('opens on Settings with the section configs', () => {
    renderWithProviders(<SettingsStripeConnect category={category} focus='stripe_connect_client_id' />)

    expect(screen.getByRole('tablist', { name: 'Stripe Connect' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Settings', 'Configuration'])
    expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true')

    const settings = screen.getByTestId('stripe-connect-settings')
    expect(settings).toHaveAttribute('data-category', 'addon_stripe_connect')
    expect(settings).toHaveAttribute('data-focus', 'stripe_connect_client_id')
  })

  it('leaves the configs when another tab is chosen and brings them back', () => {
    renderWithProviders(<SettingsStripeConnect category={category} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Configuration' }))
    expect(screen.getByRole('tab', { name: 'Configuration' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('stripe-connect-settings')).not.toBeInTheDocument()
    expect(screen.getByTestId('payout-rule-platform')).toBeInTheDocument()
    expect(screen.getByTestId('payout-rule-driver')).toBeInTheDocument()
    expect(screen.getByText('Changes apply only to orders placed after you save.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(screen.getByTestId('stripe-connect-settings')).toBeInTheDocument()
    expect(screen.queryByTestId('payout-rule-platform')).not.toBeInTheDocument()
  })

  it('shows the OAuth redirect URI of the project to register in Stripe, and copies it', async () => {
    renderWithProviders(<SettingsStripeConnect category={category} />)

    const uri = 'https://apiv4.ordering.co/v400/en/orderingv1/stripe_connect_accounts/callback'
    const card = screen.getByText('OAuth redirect URI').closest('section')
    expect(within(card).getByText(uri)).toBeInTheDocument()
    expect(within(card).getByText(/Test mode and live mode keep separate lists/)).toBeInTheDocument()
    expect(within(card).getByText(/Drivers use Express accounts/)).toBeInTheDocument()

    fireEvent.click(within(card).getByRole('button', { name: 'Copy OAuth redirect URI' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(uri)
    await waitFor(() => expect(within(card).getByText('Copied')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Configuration' }))
    expect(screen.queryByText('OAuth redirect URI')).not.toBeInTheDocument()
  })

  it('shows no redirect URI while the project is unknown', () => {
    api.ordering = { project: null }
    renderWithProviders(<SettingsStripeConnect category={category} />)

    expect(screen.queryByText('OAuth redirect URI')).not.toBeInTheDocument()
    expect(screen.getByTestId('stripe-connect-settings')).toBeInTheDocument()
  })
})
