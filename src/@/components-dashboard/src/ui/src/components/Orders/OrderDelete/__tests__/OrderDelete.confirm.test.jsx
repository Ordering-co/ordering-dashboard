/* eslint-disable import/first */
// redesign fix-qa E5: the confirmation says what is being deleted. OrderDelete hands ConfirmAdmin a title
// with the number of orders and the consequence; the handler and the flow (open, confirm, delete once)
// are the ones asserted in OrderDelete.test.jsx.
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))
vi.mock('../../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: 1200 })
}))
vi.mock('../../../Shared', () => ({
  ConfirmAdmin: ({ open, title, description, confirmLabel, onConfirm }) => open
    ? (
      <div role='dialog' aria-label={title || 'Confirm password'} aria-description={description}>
        {/* the real ConfirmAdmin calls onConfirm() with no argument after check_password, and onConfirm(code) with an OTP */}
        <button type='button' onClick={() => onConfirm()}>Confirm delete</button>
        <button type='button' onClick={() => onConfirm('482915')}>Confirm with OTP</button>
        <output data-testid='confirm-label'>{confirmLabel}</output>
      </div>
      )
    : null
}))

import { OrderDelete } from '..'

const openDelete = async (props) => {
  const user = userEvent.setup()
  const handleDeleteMultiOrders = vi.fn()
  render(<OrderDelete triggerVariant='selection' handleDeleteMultiOrders={handleDeleteMultiOrders} {...props} />)
  await user.click(screen.getByRole('button', { name: 'Delete…' }))
  return { user, handleDeleteMultiOrders }
}

describe('OrderDelete · what the confirmation says', () => {
  it('names the number of orders and says it cannot be undone', async () => {
    await openDelete({ count: 3 })
    const dialog = screen.getByRole('dialog', { name: 'Delete 3 orders?' })
    expect(dialog).toHaveAttribute('aria-description', 'Type your password to confirm. This can’t be undone.')
  })

  it('reads in the singular for one order', async () => {
    await openDelete({ count: 1 })
    expect(screen.getByRole('dialog', { name: 'Delete 1 order?' })).toBeInTheDocument()
  })

  it('without a count it still names what is deleted: the selected orders', async () => {
    await openDelete({})
    expect(screen.getByRole('dialog', { name: 'Delete the selected orders?' })).toBeInTheDocument()
  })

  it('confirming still calls the handler once', async () => {
    const { user, handleDeleteMultiOrders } = await openDelete({ count: 3 })
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(handleDeleteMultiOrders).toHaveBeenCalledTimes(1)
    expect(handleDeleteMultiOrders).toHaveBeenCalledWith()
  })

  // redesign W0-12 (T0-48): the method chosen in ConfirmAdmin is the one that applies. With an OTP the
  // code reaches the handler (it ends in deleted_action_code on the DELETE); with the password it does not.
  it('with an OTP, hands the code to the handler', async () => {
    const { user, handleDeleteMultiOrders } = await openDelete({ count: 3 })
    await user.click(screen.getByRole('button', { name: 'Confirm with OTP' }))
    expect(handleDeleteMultiOrders).toHaveBeenCalledTimes(1)
    expect(handleDeleteMultiOrders).toHaveBeenCalledWith('482915')
  })

  it('with the password, calls the handler with no code', async () => {
    const { user, handleDeleteMultiOrders } = await openDelete({ count: 3 })
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(handleDeleteMultiOrders.mock.calls[0]).toEqual([])
  })

  // redesign F6d (Q3-13, C8): the button of the confirmation says the verb with the object.
  it('asks for «Delete 3 orders» on the confirm button of the bulk delete', async () => {
    await openDelete({ count: 3 })
    expect(screen.getByTestId('confirm-label')).toHaveTextContent('Delete 3 orders')
  })

  it('asks for «Delete order» when only one order is selected', async () => {
    await openDelete({ count: 1 })
    expect(screen.getByTestId('confirm-label')).toHaveTextContent('Delete order')
  })

  it('asks for «Delete selected orders» when the count is not known', async () => {
    await openDelete({})
    expect(screen.getByTestId('confirm-label')).toHaveTextContent('Delete selected orders')
  })
})
