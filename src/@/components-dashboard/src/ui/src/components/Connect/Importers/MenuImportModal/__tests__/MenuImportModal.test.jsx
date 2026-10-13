/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const { fetchMenuImportSync } = vi.hoisted(() => ({
  fetchMenuImportSync: vi.fn()
}))

vi.mock('~components', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { email: 'owner@test.com' }, token: 'token' }],
  useApi: () => [{ project: 'demo', root: 'https://api.example.com' }],
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Error: 'ERROR', Success: 'SUCCESS' }
}))

vi.mock('../useMenuImport', () => ({
  useMenuImport: () => ({
    triggerImport: vi.fn(),
    isImporting: false,
    error: null
  })
}))

vi.mock('../../logMenuImportSync', async () => {
  const actual = await vi.importActual('../../logMenuImportSync')
  return {
    ...actual,
    fetchMenuImportSync
  }
})

vi.mock('../../../../Shared', () => ({
  Modal: ({ open, title, children }) => (
    open ? <div data-testid='menu-import-modal'><h2>{title}</h2>{children}</div> : null
  ),
  SpinnerLoader: () => <div data-testid='spinner'>Loading</div>
}))

vi.mock('../../../../../styles', () => ({
  Button: ({ children, onClick, disabled, ...props }) => (
    <button type='button' onClick={onClick} disabled={disabled} {...props}>{children}</button>
  )
}))

import { MenuImportModal } from '../index'
import { IMPORTER_CARDS } from '../../importerCards'

const business = { id: 42, name: 'Pizza Pro', slug: 'pizza-pro' }
const doordashCard = IMPORTER_CARDS.find((card) => card.id === 'doordash')

describe('MenuImportModal', () => {
  beforeEach(() => {
    fetchMenuImportSync.mockReset()
    fetchMenuImportSync.mockResolvedValue(null)
  })

  it('renders selected business and keeps import disabled until URL is valid', () => {
    renderWithProviders(
      <MenuImportModal
        open
        card={doordashCard}
        business={business}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Import from DoorDash')).toBeInTheDocument()
    expect(screen.getByText('Pizza Pro')).toBeInTheDocument()

    const importButton = screen.getByRole('button', { name: 'Import' })
    expect(importButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('DoorDash store URL'), {
      target: { value: 'https://www.doordash.com/store/test' }
    })

    expect(importButton).not.toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
  })

  it('renders Uber Eats URL field for Uber Eats card', () => {
    const ubereatsCard = IMPORTER_CARDS.find((card) => card.id === 'ubereats')

    renderWithProviders(
      <MenuImportModal
        open
        card={ubereatsCard}
        business={business}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Uber Eats store URL')).toBeInTheDocument()
  })

  it('shows Clear after fetched url and clears the input', async () => {
    fetchMenuImportSync.mockResolvedValue({
      source_url: 'https://www.doordash.com/store/saved'
    })

    renderWithProviders(
      <MenuImportModal
        open
        card={doordashCard}
        business={business}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('DoorDash store URL')).toHaveValue(
        'https://www.doordash.com/store/saved'
      )
    })

    const clearButton = screen.getByRole('button', { name: 'Clear' })
    fireEvent.click(clearButton)

    expect(screen.getByLabelText('DoorDash store URL')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
  })
})
