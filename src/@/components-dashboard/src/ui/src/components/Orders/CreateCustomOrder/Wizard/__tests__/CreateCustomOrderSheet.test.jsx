/* eslint-disable import/first */
import React, { useEffect } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ level: 0, withField: true, details: { current: null } }))

vi.mock('../../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: mocks.level } }]
}))

// The wizard content is covered by CustomOrderWizard.test.jsx; here it is a probe that
// reports data the way the real one does and lets the test finish the order.
vi.mock('../../CustomOrderDetails', () => ({
  CustomOrderDetails: props => {
    mocks.details.current = props
    useEffect(() => {
      props.onDirtyChange?.(false)
      return () => props.onDirtyChange?.(false)
    }, [])
    return (
      <div>
        <button type='button' onClick={() => props.onDirtyChange?.(true)}>Pick a customer</button>
        <button type='button' onClick={() => props.onClose?.()}>Finish order</button>
        <h3 tabIndex={-1} data-wizard-step-title=''>Customer</h3>
        {/* redesign F6e (Q4-06): the field the real SelectCustomer marks as where typing starts */}
        {mocks.withField && <input aria-label='Phone number' data-wizard-initial-focus='' />}
      </div>
    )
  }
}))

import { CreateCustomOrder } from '../../index'

const openSheet = async user => {
  await user.click(screen.getByRole('button', { name: 'Create custom order' }))
  const dialog = await screen.findByRole('dialog', { name: 'Create custom order' })
  // redesign N-05: the wizard is a lazy chunk; the Sheet is open before its content, so wait for the content
  await within(dialog).findByRole('button', { name: 'Finish order' })
  return dialog
}

beforeEach(() => {
  mocks.level = 0
  mocks.withField = true
  mocks.details.current = null
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('CreateCustomOrder · Sheet container', () => {
  it('shows the opener only for administrators', () => {
    mocks.level = 2
    renderWithProviders(<CreateCustomOrder />)
    expect(screen.queryByRole('button', { name: 'Create custom order' })).not.toBeInTheDocument()
  })

  it('opens a Sheet named "Create custom order" with the id the specs look for and a visible h2', async () => {
    renderWithProviders(<CreateCustomOrder />)
    const user = userEvent.setup()
    const dialog = await openSheet(user)
    expect(dialog).toHaveAttribute('id', 'custom_order_details')
    expect(dialog).toHaveAttribute('data-side', 'end')
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Create custom order' })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Phone number' })).toBeInTheDocument()
  })

  // redesign F6e (Q4-06): the focus used to start on the «Customer» heading, so what the operator typed at once was lost.
  it('starts the focus on the customer search field when the Sheet opens, and what is typed lands in it', async () => {
    renderWithProviders(<CreateCustomOrder />)
    const user = userEvent.setup()
    const dialog = await openSheet(user)
    const field = within(dialog).getByRole('textbox', { name: 'Phone number' })
    await waitFor(() => expect(field).toHaveFocus())
    await user.keyboard('5550')
    expect(field).toHaveValue('5550')
    // the heading stays where the step changes send the focus
    expect(within(dialog).getByRole('heading', { name: 'Customer', level: 3 })).toHaveAttribute('data-wizard-step-title')
  })

  it('starts the focus on the step title when there is no search field (a customer is already picked)', async () => {
    mocks.withField = false
    renderWithProviders(<CreateCustomOrder />)
    const dialog = await openSheet(userEvent.setup())
    await waitFor(() => expect(within(dialog).getByRole('heading', { name: 'Customer', level: 3 })).toHaveFocus())
  })

  it('hands the wizard a footer host inside the Sheet and the dirty callback', async () => {
    renderWithProviders(<CreateCustomOrder handleOpenOrderDetail={vi.fn()} />)
    const dialog = await openSheet(userEvent.setup())
    await waitFor(() => expect(dialog.contains(mocks.details.current.footerHost)).toBe(true))
    expect(typeof mocks.details.current.onDirtyChange).toBe('function')
    expect(mocks.details.current.handleOpenOrderDetail).toBeDefined()
  })

  it('opens from the command palette link ?add=custom_order', async () => {
    renderWithProviders(<CreateCustomOrder />, { initialEntries: ['/orders?add=custom_order'] })
    expect(await screen.findByRole('dialog', { name: 'Create custom order' })).toBeInTheDocument()
  })

  it('closes straight away with Escape and with the close button when nothing was picked', async () => {
    renderWithProviders(<CreateCustomOrder />)
    const user = userEvent.setup()
    await openSheet(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create custom order' })).not.toBeInTheDocument())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await openSheet(user)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create custom order' })).not.toBeInTheDocument())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('returns focus to the opener when it closes', async () => {
    renderWithProviders(<CreateCustomOrder />)
    const user = userEvent.setup()
    const opener = screen.getByRole('button', { name: 'Create custom order' })
    await openSheet(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(opener).toHaveFocus())
  })
})

describe('CreateCustomOrder · discard confirmation', () => {
  const pickCustomerThen = async (user, close) => {
    await openSheet(user)
    await user.click(screen.getByRole('button', { name: 'Pick a customer' }))
    await close()
    return screen.findByRole('alertdialog', { name: 'Discard this order?' })
  }

  it('asks before discarding once there is a customer (Escape)', async () => {
    renderWithProviders(<CreateCustomOrder />)
    const user = userEvent.setup()
    const confirm = await pickCustomerThen(user, () => user.keyboard('{Escape}'))
    expect(within(confirm).getByText('The customer, business and products you picked are cleared.')).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument()
    // The Sheet stays underneath until the answer.
    expect(screen.getByRole('dialog', { name: 'Create custom order', hidden: true })).toBeInTheDocument()
  })

  it('asks before discarding with the close button too', async () => {
    renderWithProviders(<CreateCustomOrder />)
    const user = userEvent.setup()
    await pickCustomerThen(user, () => user.click(screen.getByRole('button', { name: 'Close' })))
    expect(screen.getByRole('alertdialog', { name: 'Discard this order?' })).toBeInTheDocument()
  })

  it('Keep editing leaves the order as it was', async () => {
    renderWithProviders(<CreateCustomOrder />)
    const user = userEvent.setup()
    const confirm = await pickCustomerThen(user, () => user.keyboard('{Escape}'))
    await user.click(within(confirm).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Create custom order' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Phone number' })).toBeInTheDocument()
  })

  it('Escape on the confirmation keeps editing and does not close the Sheet', async () => {
    renderWithProviders(<CreateCustomOrder />)
    const user = userEvent.setup()
    const confirm = await pickCustomerThen(user, () => user.keyboard('{Escape}'))
    // The confirmation takes the focus on its safe action, never on Discard.
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Keep editing' })).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Create custom order' })).toBeInTheDocument()
  })

  it('Discard closes the Sheet', async () => {
    renderWithProviders(<CreateCustomOrder />)
    const user = userEvent.setup()
    const confirm = await pickCustomerThen(user, () => user.keyboard('{Escape}'))
    await user.click(within(confirm).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create custom order' })).not.toBeInTheDocument())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('does not ask after the order is placed (the wizard closes itself)', async () => {
    renderWithProviders(<CreateCustomOrder />)
    const user = userEvent.setup()
    await openSheet(user)
    await user.click(screen.getByRole('button', { name: 'Pick a customer' }))
    await user.click(screen.getByRole('button', { name: 'Finish order' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create custom order' })).not.toBeInTheDocument())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('forgets the data on close, so the next opening starts without a confirmation', async () => {
    renderWithProviders(<CreateCustomOrder />)
    const user = userEvent.setup()
    const confirm = await pickCustomerThen(user, () => user.keyboard('{Escape}'))
    await user.click(within(confirm).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create custom order' })).not.toBeInTheDocument())
    await openSheet(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create custom order' })).not.toBeInTheDocument())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
