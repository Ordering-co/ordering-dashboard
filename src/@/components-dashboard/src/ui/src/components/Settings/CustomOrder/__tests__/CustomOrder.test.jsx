import React from 'react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, mockFetch } from '~/__tests__/helpers/testUtils'

const push = vi.fn()

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useApi: () => [{ root: 'https://api.test/v400/en/demo', project: 'demo' }],
  useSession: () => [{ token: 'token', user: { level: 0 } }],
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Success: 'success' }
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useHistory: () => ({ push, replace: vi.fn() })
  }
})

import { CustomOrder } from '../index'

describe('CustomOrder', () => {
  afterEach(() => {
    push.mockReset()
    vi.unstubAllGlobals()
  })

  it('stays in the hub when the plugin is not installed', async () => {
    mockFetch({ error: true, result: 'Not found' })

    renderWithProviders(<CustomOrder hideHeader />, {
      initialEntries: ['/settings?group=developers&category=custom_order']
    })

    expect(await screen.findByText('The custom orders plugin is not installed on this project.')).toBeInTheDocument()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
    expect(push).not.toHaveBeenCalled()
  })

  it('opens plugins from the empty state', async () => {
    mockFetch({ error: true, result: 'Not found' })

    renderWithProviders(<CustomOrder hideHeader />, {
      initialEntries: ['/settings?group=developers&category=custom_order']
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Go to plugins' }))
    expect(push).toHaveBeenCalledWith('/settings?group=developers&category=developers&id=plugins')
  })
})
