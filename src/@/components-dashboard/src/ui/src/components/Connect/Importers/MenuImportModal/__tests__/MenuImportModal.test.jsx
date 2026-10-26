/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import dayjs from 'dayjs'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const { fetchMenuImportSync } = vi.hoisted(() => ({
  fetchMenuImportSync: vi.fn()
}))

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
  ToastType: { Error: 'ERROR', Success: 'SUCCESS' }
}))

vi.mock('../../useMenuImport', () => ({
  useMenuImport: () => menuImportHook
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
  AppBootLoader: () => <div data-testid='boot-auth' role='status' />
}))

vi.mock('../../../../../styles', () => ({
  Button: ({ children, onClick, disabled, ...props }) => (
    <button type='button' onClick={onClick} disabled={disabled} {...props}>{children}</button>
  )
}))

import { MenuImportModal } from '../index'
import { IMPORTER_CARDS } from '../../importerCards'
import { getRun, saveRun } from '../../menuImportRuns'

const business = { id: 42, name: 'Pizza Pro', slug: 'pizza-pro' }
const doordashCard = IMPORTER_CARDS.find((card) => card.id === 'doordash')
const runRef = { project: 'demo', businessId: 42, source: 'doordash' }
const storedRun = (status) => ({
  status,
  startedAt: '2026-10-13T18:28:00.000Z',
  finishedAt: null,
  sourceUrl: 'https://www.doordash.com/store/saved',
  appliedCount: null,
  errorMessage: null,
  menuBefore: null,
  menuAfter: null
})

describe('MenuImportModal', () => {
  beforeEach(() => {
    window.localStorage.clear()
    fetchMenuImportSync.mockReset()
    fetchMenuImportSync.mockResolvedValue(null)
    menuImportHook.triggerImport.mockReset()
    menuImportHook.reset.mockReset()
    menuImportHook.isImporting = false
    menuImportHook.status = 'idle'
    menuImportHook.error = null
    menuImportHook.result = null
    menuImportHook.startedAt = null
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

  it('shows a failed import with retry and returns to the same URL', () => {
    const view = renderWithProviders(
      <MenuImportModal
        open
        card={doordashCard}
        business={business}
        onClose={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('DoorDash store URL'), {
      target: { value: 'https://www.doordash.com/store/test' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    const firstCall = menuImportHook.triggerImport.mock.calls[0]

    menuImportHook.status = 'failed'
    menuImportHook.error = {
      message: 'The menu source is not available right now. Try again later.',
      retryable: true
    }
    view.rerender(
      <MenuImportModal
        open
        card={doordashCard}
        business={business}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('The DoorDash menu was not imported')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The menu source is not available right now. Try again later.'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(menuImportHook.triggerImport.mock.calls[1][0]).toEqual(firstCall[0])

    fireEvent.click(screen.getByRole('button', { name: 'Edit URL' }))
    expect(screen.getByLabelText('DoorDash store URL')).toHaveValue(
      'https://www.doordash.com/store/test'
    )
  })

  it('shows an unknown result without the success copy', () => {
    menuImportHook.status = 'unknown'
    menuImportHook.error = { message: 'lost', retryable: true }

    renderWithProviders(
      <MenuImportModal
        open
        card={doordashCard}
        business={business}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('We lost the connection to the importer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check products' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('Menu imported successfully')).not.toBeInTheDocument()
  })

  it('shows the applied count and import another resets', () => {
    menuImportHook.status = 'success'
    menuImportHook.result = { appliedCount: 2, jobId: 'job-1' }

    renderWithProviders(
      <MenuImportModal
        open
        card={doordashCard}
        business={business}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Menu imported to 2 store(s)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Import another menu' }))
    expect(menuImportHook.reset).toHaveBeenCalled()
  })

  it('hands Go to products to the caller when it is already on the store products', () => {
    menuImportHook.status = 'success'
    menuImportHook.result = { appliedCount: 1, jobId: 'job-1' }
    const onClose = vi.fn()
    const onGoToProducts = vi.fn()

    renderWithProviders(
      <MenuImportModal
        open
        card={doordashCard}
        business={business}
        onClose={onClose}
        onGoToProducts={onGoToProducts}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Go to products' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onGoToProducts).toHaveBeenCalledTimes(1)
  })

  it('shows the import start time while importing', () => {
    const startedAt = '2026-10-13T18:28:00.000Z'
    menuImportHook.status = 'importing'
    menuImportHook.isImporting = true
    menuImportHook.startedAt = startedAt

    renderWithProviders(
      <MenuImportModal
        open
        card={doordashCard}
        business={business}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByTestId('boot-auth')).toBeInTheDocument()
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
    expect(screen.getByText('Importing menu from DoorDash... This may take a few minutes.')).toBeInTheDocument()
    expect(screen.getByText(dayjs(startedAt).format('MMM D, YYYY h:mm A'))).toBeInTheDocument()
  })

  describe('stored run', () => {
    const renderModal = () => renderWithProviders(
      <MenuImportModal open card={doordashCard} business={business} onClose={vi.fn()} />
    )

    // Runs expire a day after their last activity: read the clock near the fixtures.
    beforeEach(() => {
      vi.useFakeTimers({ now: Date.parse(storedRun('unknown').startedAt) + 60_000, toFake: ['Date'] })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('reopens on the unknown block instead of the form', () => {
      saveRun(runRef, storedRun('unknown'))

      renderModal()

      expect(screen.getByText('We lost the connection to the importer')).toBeInTheDocument()
      expect(screen.queryByLabelText('DoorDash store URL')).not.toBeInTheDocument()
      expect(screen.queryByText('Menu imported successfully')).not.toBeInTheDocument()
    })

    it('reopens on the importing overlay with the stored start time', () => {
      vi.useFakeTimers({ now: Date.parse(storedRun('importing').startedAt) + 60_000, toFake: ['Date'] })
      saveRun(runRef, storedRun('importing'))

      renderModal()

      expect(screen.getByText('Importing menu from DoorDash... This may take a few minutes.')).toBeInTheDocument()
      expect(screen.getByText(dayjs(storedRun('importing').startedAt).format('MMM D, YYYY h:mm A'))).toBeInTheDocument()
      vi.useRealTimers()
    })

    it('does not reopen on a finished run', () => {
      saveRun(runRef, { ...storedRun('success'), appliedCount: 1 })

      renderModal()

      expect(screen.getByLabelText('DoorDash store URL')).toBeInTheDocument()
      expect(screen.queryByText('Menu imported successfully')).not.toBeInTheDocument()
    })

    it('does not reopen on a lost-connection run already resolved by a menu check', () => {
      vi.useFakeTimers({ now: Date.parse('2026-10-13T18:40:00.000Z'), toFake: ['Date'] })
      saveRun(runRef, {
        ...storedRun('unknown'),
        checkedAt: '2026-10-13T18:35:00.000Z',
        menuBefore: { categories: 1, products: 10 },
        menuAfter: { categories: 2, products: 36 }
      })

      renderModal()

      expect(screen.getByLabelText('DoorDash store URL')).toBeInTheDocument()
      expect(screen.queryByText('We lost the connection to the importer')).not.toBeInTheDocument()
      vi.useRealTimers()
    })

    it('Retry on a resumed unknown run clears it and returns to the form', () => {
      saveRun(runRef, storedRun('unknown'))

      renderModal()
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

      expect(getRun(runRef)).toBeNull()
      expect(screen.getByLabelText('DoorDash store URL')).toBeInTheDocument()
      expect(menuImportHook.triggerImport).not.toHaveBeenCalled()
    })

    it('Import another menu clears the stored run', () => {
      menuImportHook.status = 'success'
      menuImportHook.result = { appliedCount: 1, jobId: 'job-1' }
      saveRun(runRef, { ...storedRun('success'), appliedCount: 1 })

      renderModal()
      fireEvent.click(screen.getByRole('button', { name: 'Import another menu' }))

      expect(getRun(runRef)).toBeNull()
    })

    it('Edit URL clears the stored run', () => {
      menuImportHook.status = 'failed'
      menuImportHook.error = { message: 'Check the import details and try again.', retryable: false }
      saveRun(runRef, { ...storedRun('failed'), errorMessage: 'Check the import details and try again.' })

      renderModal()
      fireEvent.click(screen.getByRole('button', { name: 'Edit URL' }))

      expect(getRun(runRef)).toBeNull()
    })
  })
})
