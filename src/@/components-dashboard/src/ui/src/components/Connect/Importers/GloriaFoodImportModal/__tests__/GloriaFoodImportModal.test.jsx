/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const { menuImportHook } = vi.hoisted(() => ({
  menuImportHook: {
    triggerImport: vi.fn(),
    reset: vi.fn(),
    isImporting: false,
    status: 'idle',
    error: null,
    result: null,
    startedAt: null
  }
}))

vi.mock('~components', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { email: 'owner@test.com' }, token: 'token' }],
  useApi: () => [{ project: 'demo', root: 'https://api.example.com' }],
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Info: 'INFO', Success: 'SUCCESS', Error: 'ERROR' }
}))

vi.mock('../../useMenuImport', () => ({
  useMenuImport: () => menuImportHook
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
  AppBootLoader: () => <div data-testid='boot-auth' role='status' />
}))

vi.mock('../../../../../styles', () => ({
  Button: ({ children, onClick, disabled, ...props }) => (
    <button type='button' onClick={onClick} disabled={disabled} {...props}>{children}</button>
  )
}))

import { GloriaFoodImportModal } from '../index'
import { getRun, saveRun } from '../../menuImportRuns'

const business = { id: 42, name: 'Pizza Pro', slug: 'pizza-pro' }
const runRef = { project: 'demo', businessId: 42, source: 'gloriafood' }

describe('GloriaFoodImportModal', () => {
  beforeEach(() => {
    window.localStorage.clear()
    menuImportHook.triggerImport.mockReset()
    menuImportHook.triggerImport.mockResolvedValue({})
    menuImportHook.reset.mockReset()
    menuImportHook.isImporting = false
    menuImportHook.status = 'idle'
    menuImportHook.error = null
    menuImportHook.result = null
    menuImportHook.startedAt = null
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
      expect(menuImportHook.triggerImport).toHaveBeenCalledWith(
        expect.objectContaining({
          gloriafoodRestaurantKey: 'restaurant-key',
          gloriafoodMasterKey: 'master-key',
          ignoreGloriaFoodForceLimits: true,
          businessIds: [42],
          project: 'demo',
          orderingApiBaseUrl: 'https://api.example.com'
        })
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
      expect(menuImportHook.triggerImport).toHaveBeenCalledWith(
        expect.objectContaining({
          ignoreGloriaFoodForceLimits: false
        })
      )
    })
  })

  it('shows a failed GloriaFood import inside the modal', () => {
    menuImportHook.status = 'failed'
    menuImportHook.error = {
      message: 'GloriaFood is not available right now. Try again later.',
      retryable: false
    }

    renderWithProviders(
      <GloriaFoodImportModal
        open
        business={business}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('The GloriaFood menu was not imported')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'GloriaFood is not available right now. Try again later.'
    )
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit URL' })).toBeInTheDocument()
    expect(screen.queryByTitle('GloriaFood setup guide')).not.toBeInTheDocument()
  })

  it('shows an unknown GloriaFood result with check and retry', () => {
    menuImportHook.status = 'unknown'

    renderWithProviders(
      <GloriaFoodImportModal
        open
        business={business}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('We lost the connection to the importer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check products' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('Menu imported successfully')).not.toBeInTheDocument()
  })

  it('reopens on the unknown block when the stored run is unknown and Edit URL clears it', () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-13T18:40:00.000Z'), toFake: ['Date'] })
    saveRun(runRef, {
      status: 'unknown',
      startedAt: '2026-10-13T18:28:00.000Z',
      finishedAt: null,
      sourceUrl: null,
      appliedCount: null,
      errorMessage: null,
      menuBefore: null,
      menuAfter: null
    })

    renderWithProviders(
      <GloriaFoodImportModal
        open
        business={business}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('We lost the connection to the importer')).toBeInTheDocument()
    expect(screen.queryByTitle('GloriaFood setup guide')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(getRun(runRef)).toBeNull()
    expect(screen.getByLabelText('Restaurant Key')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('does not reopen on a lost-connection run already resolved by a menu check', () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-13T18:40:00.000Z'), toFake: ['Date'] })
    saveRun(runRef, {
      status: 'unknown',
      startedAt: '2026-10-13T18:28:00.000Z',
      finishedAt: null,
      sourceUrl: null,
      appliedCount: null,
      errorMessage: null,
      checkedAt: '2026-10-13T18:35:00.000Z',
      menuBefore: { categories: 1, products: 10 },
      menuAfter: { categories: 2, products: 36 }
    })

    renderWithProviders(
      <GloriaFoodImportModal
        open
        business={business}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByTitle('GloriaFood setup guide')).toBeInTheDocument()
    expect(screen.queryByText('We lost the connection to the importer')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
