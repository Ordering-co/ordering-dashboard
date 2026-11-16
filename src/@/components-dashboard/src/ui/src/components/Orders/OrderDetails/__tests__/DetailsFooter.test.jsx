/* eslint-disable import/first */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const flags = vi.hoisted(() => ({ readOnlyAdmin: false, readOnlyDeliveryManager: false, readOnlyBusinessOwner: false, viewOnlyBusinessOwner: false }))
const session = vi.hoisted(() => ({ level: 0 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }],
  useSession: () => [{ user: { level: session.level } }]
}))

vi.mock('../../../../utils', async (importOriginal) => ({
  ...(await importOriginal()),
  getUserType: type => !!flags[type]
}))

// The selector keeps its own regression flow (OrderStatusTypeSelector…regression.test.jsx);
// here we only check that the footer keeps it as the secondary action and wires it.
vi.mock('../../OrderStatusTypeSelector', () => ({
  OrderStatusTypeSelector: ({ orderId, defaultValue, handleUpdateOrderStatus, viewOnly, placement }) => (
    <button
      type='button'
      data-testid='status-selector'
      data-order={orderId}
      data-status={defaultValue}
      data-view-only={String(!!viewOnly)}
      data-placement={placement}
      onClick={() => handleUpdateOrderStatus({ id: orderId, newStatus: 9 })}
    >
      Change status
    </button>
  )
}))

vi.mock('../../OrderStatusRegressionModal', () => ({
  OrderStatusRegressionModal: ({ open, newStatus, onSubmit, onClose }) => open
    ? (
      <div role='dialog' aria-label='Regression'>
        <span>{`new:${newStatus}`}</span>
        <button type='button' onClick={() => onSubmit('customer asked')}>Send reason</button>
        <button type='button' onClick={onClose}>Dismiss reason</button>
      </div>
      )
    : null
}))

import { DetailsFooter } from '../DetailsFooter'

const baseOrder = { id: 42, delivery_type: 1, customer: { name: 'Ada', lastname: 'Lovelace' } }

const renderFooter = (status, extra = {}) => {
  const handleUpdateOrderStatus = extra.handleUpdateOrderStatus ?? vi.fn().mockResolvedValue({ error: false })
  const utils = renderWithProviders(
    <DetailsFooter
      order={{ loading: false, order: { ...baseOrder, status } }}
      handleUpdateOrderStatus={handleUpdateOrderStatus}
      {...extra}
    />
  )
  return { ...utils, handleUpdateOrderStatus }
}

afterEach(() => {
  flags.readOnlyAdmin = false
  flags.readOnlyDeliveryManager = false
  flags.readOnlyBusinessOwner = false
  flags.viewOnlyBusinessOwner = false
  session.level = 0
  document.getElementById('app-modals')?.remove()
})

describe('DetailsFooter — one primary action by state', () => {
  it('pending (0): Accept order PUTs status 7 and the selector stays as secondary', async () => {
    const { handleUpdateOrderStatus } = renderFooter(0)
    expect(screen.getByTestId('status-selector')).toHaveAttribute('data-status', '0')
    expect(screen.queryByRole('button', { name: 'Mark as ready' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Accept order' }))
    await waitFor(() => expect(handleUpdateOrderStatus).toHaveBeenCalledTimes(1))
    expect(handleUpdateOrderStatus).toHaveBeenCalledWith({ id: 42, newStatus: 7 })
  })

  it.each([[7], [14]])('status %i: Mark as ready PUTs status 4 and there is no Accept', async (status) => {
    const { handleUpdateOrderStatus } = renderFooter(status)
    expect(screen.queryByRole('button', { name: 'Accept order' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject…' })).toBeNull()
    expect(screen.getByTestId('status-selector')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mark as ready' }))
    await waitFor(() => expect(handleUpdateOrderStatus).toHaveBeenCalledWith({ id: 42, newStatus: 4 }))
    expect(handleUpdateOrderStatus).toHaveBeenCalledTimes(1)
  })

  it.each([[4], [8], [9], [23]])('other in-progress status %i: only the selector', (status) => {
    renderFooter(status)
    expect(screen.getByTestId('status-selector')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept order' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark as ready' })).toBeNull()
  })

  // redesign fix (owner report 2026-10-06): closed orders used to render no footer, so their status
  // could not be changed; in main the selector was in the header for every order. It is back, as the
  // only control (no primary action, no accept/reject), and sends through the same handler.
  it.each([[1], [11], [15], [2], [5], [16]])('closed status %i: the selector is the only control', (status) => {
    renderFooter(status)
    const selector = screen.getByTestId('status-selector')
    expect(selector).toHaveAttribute('data-status', String(status))
    expect(selector).toHaveAttribute('data-view-only', 'false')
    expect(screen.queryByRole('button', { name: 'Accept order' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject…' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark as ready' })).toBeNull()
    expect(document.querySelectorAll('.odt-foot [data-variant="primary"]')).toHaveLength(0)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it.each([[1], [2]])('closed status %i: the selector reaches handleUpdateOrderStatus with the same payload', async (status) => {
    const { handleUpdateOrderStatus } = renderFooter(status)
    fireEvent.click(screen.getByTestId('status-selector'))
    await waitFor(() => expect(handleUpdateOrderStatus).toHaveBeenCalledWith({ id: 42, newStatus: 9 }))
    expect(handleUpdateOrderStatus).toHaveBeenCalledTimes(1)
  })

  // redesign fix (owner report 2026-10-06): main showed the selector DISABLED (viewOnly) to the
  // read-only profiles instead of hiding it; the footer does the same and offers no action.
  it.each([
    ['readOnlyAdmin'],
    ['readOnlyDeliveryManager'],
    ['readOnlyBusinessOwner']
  ])('read-only profile %s: the selector is shown disabled and no action is offered', (flag) => {
    flags[flag] = true
    renderFooter(0)
    expect(screen.getByTestId('status-selector')).toHaveAttribute('data-view-only', 'true')
    expect(screen.queryByRole('button', { name: 'Accept order' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject…' })).toBeNull()
  })

  it('a view-only business owner is not read-only (same exception as main)', () => {
    flags.readOnlyBusinessOwner = true
    flags.viewOnlyBusinessOwner = true
    renderFooter(0)
    expect(screen.getByTestId('status-selector')).toHaveAttribute('data-view-only', 'false')
    expect(screen.getByRole('button', { name: 'Accept order' })).toBeInTheDocument()
  })

  it('read-only profile on a closed order: still the disabled selector only', () => {
    flags.readOnlyAdmin = true
    renderFooter(1)
    expect(screen.getByTestId('status-selector')).toHaveAttribute('data-view-only', 'true')
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it.each([[0], [7], [14], [4], [1], [2]])('status %i: the selector opens with its own placement so it never falls under the viewport', (status) => {
    renderFooter(status)
    expect(screen.getByTestId('status-selector')).toHaveAttribute('data-placement', 'auto')
  })

  it.each([[3], [13], [21]])('service order: status %i keeps the selector as in main', (status) => {
    renderFooter(status, { isServiceOrder: true })
    expect(screen.getByTestId('status-selector')).toBeInTheDocument()
  })

  it('shows Accept and Mark as ready as the primary button (one per view)', () => {
    renderFooter(0)
    const primary = screen.getByRole('button', { name: 'Accept order' })
    expect(primary).toHaveAttribute('data-variant', 'primary')
    expect(primary).toHaveAttribute('data-size', 'lg')
  })

  it('the selector reaches handleUpdateOrderStatus with the same payload as before', async () => {
    const { handleUpdateOrderStatus } = renderFooter(8)
    fireEvent.click(screen.getByTestId('status-selector'))
    await waitFor(() => expect(handleUpdateOrderStatus).toHaveBeenCalledWith({ id: 42, newStatus: 9 }))
  })
})

describe('DetailsFooter — Reject needs a confirmation', () => {
  // redesign fix-qa E6 (owner decision 2026-10-06): rejecting from the footer sends status 2
  // (rejected by admin) when the user is an admin (level 0) and 5 (rejected by business) for any
  // other level, and the confirmation names the status the order is going to.
  it('opens the confirmation naming the order and the target status, and never sends before it', async () => {
    const { handleUpdateOrderStatus } = renderFooter(0)
    fireEvent.click(screen.getByRole('button', { name: 'Reject…' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Reject order #42?' })
    expect(within(dialog).getByText('The order moves to Rejected by Admin.')).toBeInTheDocument()
    expect(handleUpdateOrderStatus).not.toHaveBeenCalled()
  })

  it.each([[2], [1], [3]])('level %i is not an admin: the confirmation names Rejected by business', async (level) => {
    session.level = level
    renderFooter(0)
    fireEvent.click(screen.getByRole('button', { name: 'Reject…' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Reject order #42?' })
    expect(within(dialog).getByText('The order moves to Rejected by business.')).toBeInTheDocument()
  })

  it('Keep order closes without sending', async () => {
    const { handleUpdateOrderStatus } = renderFooter(0)
    fireEvent.click(screen.getByRole('button', { name: 'Reject…' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep order' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handleUpdateOrderStatus).not.toHaveBeenCalled()
  })

  it('Escape closes without sending', async () => {
    const { handleUpdateOrderStatus } = renderFooter(0)
    fireEvent.click(screen.getByRole('button', { name: 'Reject…' }))
    await screen.findByRole('alertdialog')
    fireEvent.keyDown(document.activeElement, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handleUpdateOrderStatus).not.toHaveBeenCalled()
  })

  it('an admin (level 0): Reject order PUTs status 2 once and closes the dialog', async () => {
    const { handleUpdateOrderStatus } = renderFooter(0)
    fireEvent.click(screen.getByRole('button', { name: 'Reject…' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject order' }))
    await waitFor(() => expect(handleUpdateOrderStatus).toHaveBeenCalledWith({ id: 42, newStatus: 2 }))
    expect(handleUpdateOrderStatus).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it.each([[1], [2], [5]])('level %i: Reject order PUTs status 5 once and closes the dialog', async (level) => {
    session.level = level
    const { handleUpdateOrderStatus } = renderFooter(0)
    fireEvent.click(screen.getByRole('button', { name: 'Reject…' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject order' }))
    await waitFor(() => expect(handleUpdateOrderStatus).toHaveBeenCalledWith({ id: 42, newStatus: 5 }))
    expect(handleUpdateOrderStatus).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})

describe('DetailsFooter — busy while the call is in flight', () => {
  it('blocks a second Accept while the first PUT is pending', async () => {
    let resolve
    const pending = new Promise(_resolve => { resolve = _resolve })
    const handleUpdateOrderStatus = vi.fn(() => pending)
    renderFooter(0, { handleUpdateOrderStatus })
    const accept = screen.getByRole('button', { name: 'Accept order' })
    fireEvent.click(accept)
    await waitFor(() => expect(accept).toHaveAttribute('aria-busy', 'true'))
    fireEvent.click(accept)
    expect(handleUpdateOrderStatus).toHaveBeenCalledTimes(1)
    resolve({ error: false })
    await waitFor(() => expect(accept).not.toHaveAttribute('aria-busy'))
  })
})

describe('DetailsFooter — status regression keeps its reason flow', () => {
  it('asks for the reason when the controller says a regression needs one, then repeats with it', async () => {
    const handleUpdateOrderStatus = vi.fn()
      .mockResolvedValueOnce({ error: true, regressionRequired: true, result: [] })
      .mockResolvedValueOnce({ error: false })
    renderFooter(14, { handleUpdateOrderStatus })
    fireEvent.click(screen.getByRole('button', { name: 'Mark as ready' }))
    const dialog = await screen.findByRole('dialog', { name: 'Regression' })
    expect(within(dialog).getByText('new:4')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send reason' }))
    await waitFor(() => expect(handleUpdateOrderStatus).toHaveBeenLastCalledWith({ id: 42, newStatus: 4, reasons: 'customer asked' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Regression' })).toBeNull())
  })
})
