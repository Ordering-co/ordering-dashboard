import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useConfig: () => [{
    configs: {
      stripe_publishable: { key: 'stripe_publishable', value: 'pk_live' }
    }
  }]
}))

vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: 1200 })
}))

vi.mock('../../../Settings', () => ({
  FilterSettings: () => <div>legacy-filter-settings</div>
}))

vi.mock('../../../Shared', () => ({
  Confirm: () => null
}))

import { PaymentOptionGlobal } from '../index'

describe('PaymentOptionGlobal', () => {
  it('shows a Settings link for gateway keys instead of editing them here', async () => {
    renderWithProviders(
      <PaymentOptionGlobal
        open
        onClose={() => {}}
        orderTypes={[]}
        sitesState={{ sites: [] }}
        changesState={{}}
        handleChangeBusinessPaymentState={() => {}}
        cleanChangesState={() => {}}
        actionState={{ loading: false }}
        handleSaveClick={() => {}}
        businessPaymethod={{ allowed_order_types: [], sites: [] }}
        handleDeletePaymethod={() => {}}
        selectedPaymethodGateway='stripe'
      />,
      {
        theme: {
          colors: {
            primary: '#000000',
            backgroundPage: '#ffffff',
            headingColor: '#000000',
            lightGray: '#f5f5f5',
            borderColor: '#e9ecef',
            secundary: '#f5f5f5'
          }
        }
      }
    )

    await waitFor(() => {
      expect(screen.getByText('API keys configured')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Edit in Settings' }))
      .toHaveAttribute('href', '/settings?group=payments&category=stripe')
    expect(screen.queryByText('legacy-filter-settings')).not.toBeInTheDocument()
  })
})
