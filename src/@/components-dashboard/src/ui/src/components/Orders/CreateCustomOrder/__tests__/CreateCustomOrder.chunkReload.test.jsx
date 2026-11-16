/* eslint-disable import/first */
import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// the wizard is a lazy chunk. `useOneShotQuery` removes `?add=custom_order` from the URL as soon as the sheet opens, so a
// reload caused by a chunk that does not arrive would come back without it. The import of the wizard asks `lazyWithReload` to write
// the param back right before the reload; the real `lazyWithReload` runs here with a guard whose `reload` is a spy.
const mocks = vi.hoisted(() => ({ reload: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }]
}))

vi.mock('~/utils/chunkReload', async (importOriginal) => {
  const actual = await importOriginal()
  const store = new Map()
  const win = {
    sessionStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    location: { reload: () => mocks.reload(window.location.search) }
  }
  const guard = actual.createChunkReloadGuard({ win, reload: win.location.reload })
  return {
    ...actual,
    // Same factory options as the component, but the chunk is gone and the reload is observable.
    lazyWithReload: (_factory, _guard, options) => actual.lazyWithReload(
      () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/CustomOrderDetails-x.js')),
      guard,
      options
    )
  }
})

import { CreateCustomOrder } from '..'

beforeEach(() => {
  window.history.replaceState(null, '', '/orders')
  window.reportError = vi.fn()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  delete window.reportError
  vi.restoreAllMocks()
  mocks.reload.mockClear()
})

describe('CreateCustomOrder · chunk reload keeps the wizard open', () => {
  it('writes ?add=custom_order back into the URL right before the reload', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateCustomOrder />)
    expect(window.location.search).toBe('')

    await user.click(screen.getByRole('button', { name: 'Create custom order' }))

    await vi.waitFor(() => expect(mocks.reload).toHaveBeenCalledTimes(1))
    expect(new URLSearchParams(mocks.reload.mock.calls[0][0]).get('add')).toBe('custom_order')
    expect(new URLSearchParams(window.location.search).get('add')).toBe('custom_order')
  })
})
