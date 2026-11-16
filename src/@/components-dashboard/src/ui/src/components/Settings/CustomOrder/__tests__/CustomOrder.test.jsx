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

  // a failed settings request used to leave an empty section with a loose Save.
  const mockPlugin = (settingsResponses) => {
    const queue = [...settingsResponses]
    global.fetch = vi.fn((url) => {
      if (url.includes('/plugins/key/')) {
        return Promise.resolve({ json: async () => ({ error: false, result: { root: 'https://plugin.test/orderingv1' } }) })
      }
      const next = queue.length > 1 ? queue.shift() : queue[0]
      return next instanceof Error ? Promise.reject(next) : Promise.resolve({ json: async () => next })
    })
  }
  const SETTINGS_OK = {
    error: false,
    result: { settings: { max_weight: { name: 'Max weight', description: 'Heaviest order', type: 'float', value: 12 } } }
  }

  it.each([
    ['the request fails', new Error('Network down')],
    ['the plugin answers with an error', { error: true, result: ['Forbidden'] }],
    ['the plugin answers without settings', { error: false, result: {} }]
  ])('shows an error with Retry and no Save when %s', async (_name, response) => {
    mockPlugin([response])

    renderWithProviders(<CustomOrder hideHeader />, {
      initialEntries: ['/settings?group=developers&category=custom_order']
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('The Custom Order settings could not be loaded. Try again.')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('loads the settings again on Retry', async () => {
    mockPlugin([new Error('Network down'), SETTINGS_OK])

    renderWithProviders(<CustomOrder hideHeader />, {
      initialEntries: ['/settings?group=developers&category=custom_order']
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Max weight')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
