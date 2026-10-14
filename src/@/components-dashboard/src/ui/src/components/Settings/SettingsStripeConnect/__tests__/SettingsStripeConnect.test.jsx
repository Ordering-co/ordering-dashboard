import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
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
})
