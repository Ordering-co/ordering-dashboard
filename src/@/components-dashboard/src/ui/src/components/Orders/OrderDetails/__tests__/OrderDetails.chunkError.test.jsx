// redesign tramo B r2 (W0-PB1-01): if the OrderDetailsPanel chunk fails to load, the failure stays in the panel.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('~components', async (importOriginal) => ({
  ...(await importOriginal()),
  useLanguage: () => [null, (_key, fallback) => fallback]
}))
// The import of the panel chunk rejects the way a missing file does. `lazyWithReload` is the wrapper of utils/chunkReload.js standing for
// «the tab after the reload, where the chunk is still gone»: its guard refuses a second reload, so it throws the error to the boundary
// (the wrapper itself is tested in src/utils/__tests__/chunkReload.test.js).
vi.mock('~/utils/chunkReload', async (importOriginal) => ({
  ...(await importOriginal()),
  lazyWithReload: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/OrderDetailsPanel-x.js'))
}))

import { OrderDetailsUI } from '../OrderDetailsLazy'

beforeEach(() => {
  window.reportError = vi.fn() // the boundary reports what it catches (W0-PB2-02); a spy keeps vitest from counting it as uncaught
})
afterEach(() => {
  delete window.reportError
})

describe('OrderDetailsLazy with a chunk that does not load', () => {
  it('shows the error state inside the panel frame, not a blank app', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onClose = vi.fn()
    const { container } = renderWithProviders(
      <div><p>page behind</p><OrderDetailsUI layout='split' onClose={onClose} /></div>
    )
    const alert = await screen.findByRole('alert')
    // redesign tramo B r3 (W0-QB2-07): the title is the panel's, not a page's; the text is the load failure one
    expect(alert).toHaveTextContent('This order could not be opened')
    expect(alert).not.toHaveTextContent(/page/i)
    expect(alert).toHaveTextContent('The dashboard may have been updated')
    expect(screen.getByText('page behind')).toBeInTheDocument()
    expect(container.querySelector('#orderDetails')).toContainElement(alert)
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
    expect(window.reportError).toHaveBeenCalledTimes(1)
  })
})
