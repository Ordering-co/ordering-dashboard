/* eslint-disable import/first */
import React from 'react'
import { act, configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign N-05 (wave 6, performance): the order panel and the create-order wizard are not on the first paint of /orders,
// so each is its own chunk, loaded when it is asked for. The modules are mocked behind a gate: a mocked module's factory
// runs when the module is first imported, so «factory has not run» means «nobody imported it yet», and a gate that is
// still shut holds the chunk «on the network». With a static import (the code before N-05) the factory runs at import
// time and the first assertions of each block fail.
const gate = vi.hoisted(() => {
  const make = () => {
    const state = { loads: 0 }
    state.reset = () => {
      state.loads = 0
      state.promise = new Promise(resolve => { state.release = resolve })
    }
    state.reset()
    return state
  }
  return { panel: make(), wizard: make(), level: 0 }
})

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: gate.level } }],
  OrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

// `vi.doMock` after `vi.resetModules()`: every test gets a fresh registry, so the factory runs again for each one.
beforeEach(() => {
  gate.panel.reset()
  gate.wizard.reset()
  gate.level = 0
  vi.resetModules()
  vi.doMock('../OrderDetails/OrderDetailsPanel', async () => {
    gate.panel.loads += 1
    await gate.panel.promise
    return { default: props => <div data-testid='panel-probe' data-layout={props.layout}>Order {props.orderId}</div> }
  })
  vi.doMock('../CreateCustomOrder/CustomOrderDetails', async () => {
    gate.wizard.loads += 1
    await gate.wizard.promise
    return {
      CustomOrderDetails: () => (
        <div data-testid='wizard-probe'>
          <h3 tabIndex={-1} data-wizard-step-title=''>Customer</h3>
          <input aria-label='Phone number' data-wizard-initial-focus='' />
        </div>
      )
    }
  })
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

// FL-4: `vi.resetModules()` above makes every test import the whole module graph of the panel or the wizard again, so
// the first import of a test is legitimately heavy (about 1.5 s alone, 4 s on a loaded machine, against the 5 s default). The
// tests wait on states (the gate, the skeleton, the probe), never on time, so the longer limits only stop the cold import
// from being mistaken for a failure; every assertion stays as it was.
const HEAVY_IMPORT_MS = 30_000
let previousAsyncUtilTimeout
beforeAll(() => {
  previousAsyncUtilTimeout = getConfig().asyncUtilTimeout
  configure({ asyncUtilTimeout: 10_000 })
})
afterAll(() => {
  configure({ asyncUtilTimeout: previousAsyncUtilTimeout })
})

describe('the order panel is a lazy chunk', { timeout: HEAVY_IMPORT_MS }, () => {
  const panelProps = { open: true, layout: 'split', orderId: 42, onClose: vi.fn() }

  it('is not loaded by importing the entry of the panel', async () => {
    const entry = await import('../OrderDetails')
    expect(typeof entry.OrderDetails).toBe('function')
    expect(gate.panel.loads).toBe(0)
  })

  it('is asked for when the panel is drawn, shows the panel skeleton while it loads and the panel once it is in', async () => {
    const { OrderDetails } = await import('../OrderDetails')
    renderWithProviders(<OrderDetails {...panelProps} />, { initialEntries: ['/orders?id=42'] })

    await waitFor(() => expect(gate.panel.loads).toBe(1))
    const frame = document.getElementById('orderDetails')
    expect(frame).toHaveAttribute('aria-busy', 'true')
    expect(frame.querySelector('.odc-od-frame[data-skeleton]')).not.toBeNull()
    expect(screen.queryByTestId('panel-probe')).toBeNull()

    await act(async () => { gate.panel.release() })
    const probe = await screen.findByTestId('panel-probe')
    expect(probe).toHaveTextContent('Order 42')
    expect(probe).toHaveAttribute('data-layout', 'split')
    expect(document.querySelector('[data-skeleton]')).toBeNull()
  })

  it('keeps the way out of the skeleton: Close calls onClose while the chunk is loading', async () => {
    const onClose = vi.fn()
    const { OrderDetails } = await import('../OrderDetails')
    renderWithProviders(<OrderDetails {...panelProps} onClose={onClose} />, { initialEntries: ['/orders?id=42'] })
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await act(async () => { gate.panel.release() })
  })

  it('draws the overlay panels (deliveries, appointments) in their lateral Sheet while it loads', async () => {
    const { OrderDetails } = await import('../OrderDetails')
    renderWithProviders(<OrderDetails open orderId={7} onClose={vi.fn()} />, { initialEntries: ['/deliveries'] })
    const sheet = await screen.findByRole('dialog', { name: 'Loading' })
    expect(sheet.querySelector('[data-skeleton]')).not.toBeNull()
    await act(async () => { gate.panel.release() })
    expect(await screen.findByTestId('panel-probe')).toBeInTheDocument()
  })
})

describe('the create-order wizard is a lazy chunk', { timeout: HEAVY_IMPORT_MS }, () => {
  it('is not loaded by importing the entry, nor by drawing the closed button', async () => {
    const { CreateCustomOrder } = await import('../CreateCustomOrder')
    expect(gate.wizard.loads).toBe(0)
    renderWithProviders(<CreateCustomOrder />)
    expect(screen.getByRole('button', { name: 'Create custom order' })).toBeInTheDocument()
    expect(gate.wizard.loads).toBe(0)
  })

  it('is asked for when the Sheet opens: the Sheet and the ghost rows come first, the wizard when the chunk is in', async () => {
    const { CreateCustomOrder } = await import('../CreateCustomOrder')
    renderWithProviders(<CreateCustomOrder />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create custom order' }))

    const sheet = await screen.findByRole('dialog', { name: 'Create custom order' })
    await waitFor(() => expect(gate.wizard.loads).toBe(1))
    expect(sheet.querySelector('.odc-steps[aria-busy="true"] .odc-steps-skeleton-row')).not.toBeNull()
    expect(within(sheet).queryByTestId('wizard-probe')).toBeNull()

    await act(async () => { gate.wizard.release() })
    expect(await within(sheet).findByTestId('wizard-probe')).toBeInTheDocument()
    expect(sheet.querySelector('.odc-steps-skeleton-row')).toBeNull()
  })

  // F6e (Q4-06): the customer field takes the focus when the form opens. The Sheet asks for the focus before the chunk is in,
  // so it is the arrival of the content that has to give it.
  it('gives the focus to the customer field when the chunk arrives, not to the Close button the Sheet started on', async () => {
    const { CreateCustomOrder } = await import('../CreateCustomOrder')
    renderWithProviders(<CreateCustomOrder />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create custom order' }))
    const sheet = await screen.findByRole('dialog', { name: 'Create custom order' })
    await waitFor(() => expect(gate.wizard.loads).toBe(1))
    await waitFor(() => expect(sheet).toContainElement(document.activeElement))

    await act(async () => { gate.wizard.release() })
    const field = await within(sheet).findByLabelText('Phone number')
    await waitFor(() => expect(field).toHaveFocus())
  })

  it('is asked for right away by the ?add=custom_order deep link', async () => {
    const { CreateCustomOrder } = await import('../CreateCustomOrder')
    renderWithProviders(<CreateCustomOrder />, { initialEntries: ['/orders?add=custom_order'] })
    const sheet = await screen.findByRole('dialog', { name: 'Create custom order' })
    await waitFor(() => expect(gate.wizard.loads).toBe(1))
    await act(async () => { gate.wizard.release() })
    expect(await within(sheet).findByTestId('wizard-probe')).toBeInTheDocument()
  })
})
