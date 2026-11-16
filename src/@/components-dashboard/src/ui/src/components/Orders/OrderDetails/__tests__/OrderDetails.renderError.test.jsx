// redesign tramo B r3 (W0-PB2-02, W0-QB2-07): a bug while drawing the order panel is not a load failure: generic text, the panel's own
// title, and the error is reported to the window (DashboardAnalytics captures `error` there as dashboard_runtime_error).
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('~components', async (importOriginal) => ({
  ...(await importOriginal()),
  useLanguage: () => [null, (_key, fallback) => fallback]
}))
vi.mock('../OrderDetailsPanel', () => ({
  default: () => { throw new TypeError("Cannot read properties of undefined (reading 'products')") }
}))

import { OrderDetailsUI } from '../OrderDetailsLazy'

afterEach(() => vi.restoreAllMocks())

describe('OrderDetailsLazy with a panel that throws while drawing', () => {
  it('says something went wrong (not that the dashboard was updated), in the panel frame, and reports the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    window.reportError = vi.fn()
    try {
      const { container } = renderWithProviders(<OrderDetailsUI layout='split' onClose={vi.fn()} />)
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('This order could not be opened')
      expect(alert).toHaveTextContent('An unexpected error stopped this from showing')
      expect(alert).not.toHaveTextContent('may have been updated')
      expect(container.querySelector('#orderDetails')).toContainElement(alert)
      expect(window.reportError).toHaveBeenCalledTimes(1)
      expect(window.reportError.mock.calls[0][0]).toBeInstanceOf(TypeError)
    } finally {
      delete window.reportError
    }
  })
})
