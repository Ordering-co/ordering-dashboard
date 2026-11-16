import React, { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign W1-1 (T1-2): the driver / contact orders panel is a Product Sheet; widths are data-* state, Escape closes
// only the layer on top, and the focus goes back to the button that opened it.
const runtime = vi.hoisted(() => ({ width: 1280, managerProps: null }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback || key],
  useUtils: () => [{ optimizeImage: value => value }]
}))
vi.mock('../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: runtime.width }) }))
// The real OrdersManager opens the order as a Sheet over the panel (OrderDetails); the stub does the same.
vi.mock('../OrdersManager', async () => {
  const React = await import('react')
  const { Sheet } = await import('../../Shared/Product')
  return {
    OrdersManager: props => {
      runtime.managerProps = props
      const [order, setOrder] = React.useState(false)
      const toggle = next => { setOrder(next); props.handleCustomOrderDetail(next) }
      return (
        <div>
          <button type='button' onClick={() => toggle(true)}>Open order</button>
          {order && (
            <Sheet open onOpenChange={next => { if (!next) toggle(false) }} title='Order 1' closeLabel='Close order'>
              <p>Order content</p>
            </Sheet>
          )}
        </div>
      )
    }
  }
})

import { ContactOrdersSheet } from '../ContactOrdersSheet'

const Harness = ({ onClose, ...props }) => {
  const [open, setOpen] = useState(false)
  return (
    <ThemeProvider theme={{ images: {}, colors: {} }}>
      <button type='button' onClick={() => setOpen(true)}>Show orders</button>
      <ContactOrdersSheet
        isDriver
        open={open}
        user={{ id: 7, name: 'Marcus', lastname: 'Hill' }}
        onClose={() => { onClose?.(); setOpen(false) }}
        {...props}
      />
    </ThemeProvider>
  )
}

// the layer under another one is aria-hidden while the other is open
const panel = () => screen.getByRole('dialog', { name: 'Marcus Hill', hidden: true })

beforeEach(() => { runtime.width = 1280; runtime.managerProps = null })
afterEach(() => { document.getElementById('app-modals')?.remove() })

describe('ContactOrdersSheet (W1-1 T1-2)', () => {
  it('names the panel with the person, keeps the role under it, and mounts the orders of that driver', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Show orders' }))
    expect(panel()).toHaveTextContent('Driver')
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(runtime.managerProps).toMatchObject({ isLateralBar: true, isSelectedOrders: true, driverId: 7, customerId: null, businessId: null, disableSocketRoomDriver: true })
  })

  it('has no id to look up and no inline width: the width is a data-* state (normal, wide with an order open)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Show orders' }))
    expect(document.getElementById('driver_lateral_bar')).toBeNull()
    expect(panel().getAttribute('style') || '').not.toMatch(/width/)
    expect(panel()).not.toHaveAttribute('data-wide')
    await user.click(screen.getByRole('button', { name: 'Open order' }))
    expect(panel()).toHaveAttribute('data-wide')
    expect(panel().getAttribute('style') || '').not.toMatch(/width/)
  })

  it('does not widen below 1000px', async () => {
    runtime.width = 800
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Show orders' }))
    await user.click(screen.getByRole('button', { name: 'Open order' }))
    expect(panel()).not.toHaveAttribute('data-wide')
  })

  it('Escape closes only the layer on top, once, whatever the width', async () => {
    runtime.width = 800
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Harness onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Show orders' }))
    await user.click(screen.getByRole('button', { name: 'Open order' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('Order content')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    expect(panel()).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Marcus Hill' })).toBeNull())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('the expand button toggles the expanded state and tells its state', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Show orders' }))
    const expand = screen.getByRole('button', { name: 'Expand' })
    await user.click(expand)
    expect(panel()).toHaveAttribute('data-expanded')
    expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(panel()).not.toHaveAttribute('data-expanded')
  })

  it('moves the focus in when it opens and back to the opener when it closes', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Show orders' })
    await user.click(opener)
    await waitFor(() => expect(panel().contains(document.activeElement)).toBe(true))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Marcus Hill' })).toBeNull())
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('names a business by its name and says Business', async () => {
    const user = userEvent.setup()
    render(<Harness isDriver={false} isBusiness user={undefined} business={{ id: 3, name: 'Subway' }} />)
    await user.click(screen.getByRole('button', { name: 'Show orders' }))
    expect(screen.getByRole('dialog', { name: 'Subway' })).toHaveTextContent('Business')
    expect(runtime.managerProps).toMatchObject({ businessId: 3, driverId: null })
  })

  // redesign drivers-dashboard B2 (DD-06): `statusGroup` is opt-in; without it Messages and /all-in-one get exactly the props of today.
  it('forwards statusGroup to the orders manager when it comes', async () => {
    const user = userEvent.setup()
    render(<Harness statusGroup='inProgress' />)
    await user.click(screen.getByRole('button', { name: 'Show orders' }))
    expect(runtime.managerProps).toMatchObject({ statusGroup: 'inProgress', driverId: 7 })
  })

  it('does not pass statusGroup at all (not even undefined) when it does not come', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Show orders' }))
    expect('statusGroup' in runtime.managerProps).toBe(false)
  })

  it('remounts the orders manager when the group changes, because OrdersManage reads statusGroup only on mount', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Harness statusGroup='pending' />)
    await user.click(screen.getByRole('button', { name: 'Show orders' }))
    expect(runtime.managerProps.statusGroup).toBe('pending')
    await user.click(screen.getByRole('button', { name: 'Open order' }))
    expect(screen.getByText('Order content')).toBeInTheDocument()
    rerender(<Harness statusGroup='completed' />)
    expect(runtime.managerProps.statusGroup).toBe('completed')
    // the remount drops the stub's own state (the order opened inside)
    expect(screen.queryByText('Order content')).toBeNull()
  })
})
