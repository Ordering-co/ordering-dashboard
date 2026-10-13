/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mockTriggerImport = vi.fn()

vi.mock('~components', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { email: 'owner@test.com' }, token: 'token' }],
  useApi: () => [{ project: 'demo', root: 'https://api.example.com' }],
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Info: 'INFO', Success: 'SUCCESS', Error: 'ERROR' }
}))

vi.mock('../../useMenuImport', () => ({
  useMenuImport: () => ({
    triggerImport: mockTriggerImport,
    isImporting: false,
    error: null
  })
}))

vi.mock('../../menuImportConfig', () => ({
  getMenuImportUseFixture: () => false
}))

vi.mock('../../logMenuImportSync', () => ({
  fetchMenuImportSync: vi.fn().mockResolvedValue(null)
}))

vi.mock('../../../../Shared', () => ({
  Modal: ({ open, title, children }) => (
    open ? <div data-testid='gloriafood-modal'><h2>{title}</h2>{children}</div> : null
  ),
  SpinnerLoader: () => <div data-testid='spinner'>Loading</div>
}))

vi.mock('../../../../../styles', () => ({
  Button: ({ children, onClick, disabled, ...props }) => (
    <button type='button' onClick={onClick} disabled={disabled} {...props}>{children}</button>
  )
}))

import { GloriaFoodImportModal } from '../index'

const business = { id: 42, name: 'Pizza Pro', slug: 'pizza-pro' }

describe('GloriaFoodImportModal', () => {
  beforeEach(() => {
    mockTriggerImport.mockReset()
    mockTriggerImport.mockResolvedValue({})
  })

  it('shows help video step before credential fields', () => {
    renderWithProviders(
      <GloriaFoodImportModal
        open
        business={business}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByTitle('GloriaFood setup guide')).toBeInTheDocument()
    expect(screen.queryByLabelText('Restaurant Key')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('renders credential fields and keeps sync disabled until both keys are set', async () => {
    renderWithProviders(
      <GloriaFoodImportModal
        open
        business={business}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText('Synchronize')).toBeInTheDocument()
    expect(screen.getByText('Pizza Pro')).toBeInTheDocument()
    expect(screen.getByLabelText('Restaurant Key')).toBeInTheDocument()
    expect(screen.getByLabelText('Master Key')).toBeInTheDocument()
    expect(screen.getByLabelText(/Allow customers to choose more than one option/i)).toBeChecked()

    const syncButton = screen.getByRole('button', { name: 'Synchronize Menu' })
    expect(syncButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Restaurant Key'), {
      target: { value: 'restaurant-key' }
    })
    expect(syncButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Master Key'), {
      target: { value: 'master-key' }
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Synchronize Menu' })).not.toBeDisabled()
    })
  })

  it('calls menu-import with gloriafood restaurant and master keys', async () => {
    renderWithProviders(
      <GloriaFoodImportModal
        open
        business={business}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.change(screen.getByLabelText('Restaurant Key'), {
      target: { value: 'restaurant-key' }
    })
    fireEvent.change(screen.getByLabelText('Master Key'), {
      target: { value: 'master-key' }
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Synchronize Menu' })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Synchronize Menu' }))

    await waitFor(() => {
      expect(mockTriggerImport).toHaveBeenCalledWith(
        expect.objectContaining({
          gloriafoodRestaurantKey: 'restaurant-key',
          gloriafoodMasterKey: 'master-key',
          ignoreGloriaFoodForceLimits: true,
          businessIds: [42],
          project: 'demo',
          orderingApiBaseUrl: 'https://api.example.com'
        }),
        expect.any(Object)
      )
    })
  })

  it('sends ignoreGloriaFoodForceLimits false when the checkbox is turned off', async () => {
    renderWithProviders(
      <GloriaFoodImportModal
        open
        business={business}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.change(screen.getByLabelText('Restaurant Key'), {
      target: { value: 'restaurant-key' }
    })
    fireEvent.change(screen.getByLabelText('Master Key'), {
      target: { value: 'master-key' }
    })
    fireEvent.click(screen.getByLabelText(/Allow customers to choose more than one option/i))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Synchronize Menu' })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Synchronize Menu' }))

    await waitFor(() => {
      expect(mockTriggerImport).toHaveBeenCalledWith(
        expect.objectContaining({
          ignoreGloriaFoodForceLimits: false
        }),
        expect.any(Object)
      )
    })
  })
})
