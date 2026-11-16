/* eslint-disable import/first */
import React, { useState } from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign F6c (Q2-08): the header draws the create button in one place on desktop and in another on phones
// (a hidden host for the «+»). The form must not live in either: resizing across 768px keeps the form and
// what was picked in it.
const mocks = vi.hoisted(() => ({ level: 0, viewport: { phone: false, listeners: new Set() } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: mocks.level } }]
}))

// The controller of the form keeps the chosen customer in its own state, as the real one does.
vi.mock('../CustomOrderDetails', async () => {
  const React = await import('react')
  return {
    CustomOrderDetails: ({ onDirtyChange }) => {
      const [customer, setCustomer] = React.useState(null)
      React.useEffect(() => { onDirtyChange?.(!!customer) }, [customer])
      return (
        <div data-testid='wizard-body'>
          <button type='button' onClick={() => setCustomer('Customer Demo')}>Pick customer</button>
          <p data-testid='picked'>{customer ?? 'nobody'}</p>
        </div>
      )
    }
  }
})

import { CreateCustomOrder, CreateCustomOrderProvider } from '..'

const subscribe = (listener) => {
  mocks.viewport.listeners.add(listener)
  return () => mocks.viewport.listeners.delete(listener)
}

// The two places the header draws the button (OrdersDashboardControls).
const Controls = () => {
  const [, force] = useState(0)
  React.useEffect(() => subscribe(() => force(value => value + 1)), [])
  return mocks.viewport.phone
    ? <div data-phone=''><div hidden><CreateCustomOrder /></div></div>
    : <div data-action='create'><CreateCustomOrder /></div>
}

const resizeTo = (phone) => act(() => {
  mocks.viewport.phone = phone
  mocks.viewport.listeners.forEach(listener => listener())
})

describe('CreateCustomOrder · resizing across 768px (Q2-08)', () => {
  it('keeps the form open and the customer picked when the header switches from desktop to phone and back', async () => {
    mocks.viewport.phone = false
    const user = userEvent.setup()
    renderWithProviders(
      <CreateCustomOrderProvider>
        <Controls />
      </CreateCustomOrderProvider>
    )

    await user.click(screen.getByRole('button', { name: 'Create custom order' }))
    const sheet = await screen.findByRole('dialog', { name: 'Create custom order' })
    // redesign N-05: the wizard is a lazy chunk, so it is found, not assumed
    await user.click(await within(sheet).findByRole('button', { name: 'Pick customer' }))
    expect(within(sheet).getByTestId('picked')).toHaveTextContent('Customer Demo')

    resizeTo(true)
    const afterPhone = screen.getByRole('dialog', { name: 'Create custom order' })
    expect(afterPhone).toBe(sheet)
    expect(within(afterPhone).getByTestId('picked')).toHaveTextContent('Customer Demo')

    resizeTo(false)
    const afterDesktop = screen.getByRole('dialog', { name: 'Create custom order' })
    expect(afterDesktop).toBe(sheet)
    expect(within(afterDesktop).getByTestId('picked')).toHaveTextContent('Customer Demo')
  })

  // redesign F6d (Q3-09): the focus is inside the wizard dialog before and after the header changes layout.
  it('keeps the focus inside the wizard dialog when the header switches layout', async () => {
    mocks.viewport.phone = false
    const user = userEvent.setup()
    renderWithProviders(
      <CreateCustomOrderProvider>
        <Controls />
      </CreateCustomOrderProvider>
    )
    await user.click(screen.getByRole('button', { name: 'Create custom order' }))
    const sheet = await screen.findByRole('dialog', { name: 'Create custom order' })
    const pick = await within(sheet).findByRole('button', { name: 'Pick customer' }) // redesign N-05: lazy chunk
    await user.click(pick)
    expect(pick).toHaveFocus()

    resizeTo(true)
    expect(sheet).toContainElement(document.activeElement)
    resizeTo(false)
    expect(sheet).toContainElement(document.activeElement)
    expect(pick).toHaveFocus()
  })

  it('still asks before discarding after the switch, because the customer is still known', async () => {
    mocks.viewport.phone = false
    const user = userEvent.setup()
    renderWithProviders(
      <CreateCustomOrderProvider>
        <Controls />
      </CreateCustomOrderProvider>
    )
    await user.click(screen.getByRole('button', { name: 'Create custom order' }))
    const sheet = await screen.findByRole('dialog', { name: 'Create custom order' })
    // redesign N-05: the wizard is a lazy chunk, so it is found, not assumed
    await user.click(await within(sheet).findByRole('button', { name: 'Pick customer' }))
    resizeTo(true)
    await user.click(within(screen.getByRole('dialog', { name: 'Create custom order' })).getByRole('button', { name: 'Close' }))
    expect(await screen.findByRole('alertdialog', { name: 'Discard this order?' })).toBeInTheDocument()
  })

  it('without a host above (any other page) the button keeps its own form, as before', async () => {
    mocks.viewport.phone = false
    const user = userEvent.setup()
    renderWithProviders(<CreateCustomOrder />)
    await user.click(screen.getByRole('button', { name: 'Create custom order' }))
    expect(await screen.findByRole('dialog', { name: 'Create custom order' })).toBeInTheDocument()
  })

  it('draws no button below manager level, and the host opens nothing by itself', () => {
    mocks.level = 5
    renderWithProviders(
      <CreateCustomOrderProvider>
        <Controls />
      </CreateCustomOrderProvider>
    )
    mocks.level = 0
    expect(screen.queryByRole('button', { name: 'Create custom order' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens from ?add=custom_order once, through the host, whichever branch the header is in', async () => {
    mocks.viewport.phone = true
    renderWithProviders(
      <CreateCustomOrderProvider>
        <Controls />
      </CreateCustomOrderProvider>,
      { initialEntries: ['/orders?add=custom_order'] }
    )
    expect(await screen.findByRole('dialog', { name: 'Create custom order' })).toBeInTheDocument()
  })
})
