import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useConfig: () => [{
    configs: {
      stripe_publishable: { key: 'stripe_publishable', value: 'pk_live' }
    }
  }]
}))

import { PaymentOptionGlobal } from '../index'

describe('PaymentOptionGlobal', () => {
  it('shows a Settings link for gateway keys instead of editing them here', async () => {
    renderWithProviders(
      <PaymentOptionGlobal
        paymethod={{ id: 1, gateway: 'stripe', name: 'Stripe', data_template: [] }}
        businessPaymethod={{ allowed_order_types: [], sites: [] }}
        gatewayName='Stripe'
        storeName='Burger Hub'
        sites={[]}
        devices={[]}
        orderTypes={[]}
        onSave={() => {}}
      />,
      { theme }
    )

    await waitFor(() => {
      expect(screen.getByText('API keys configured')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Edit in Settings' }))
      .toHaveAttribute('href', '/settings?group=payments&category=stripe')
  })
})
