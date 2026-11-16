/* eslint-disable import/first */
// Batch 5.4-A · the status regression reason on Product Dialog (C8): role and name, the transition with
// the two status badges, the labelled textarea, initial focus, Escape, footer order, and the same
// `onSubmit(reason.trim())` as before. The Product wrappers are real here.
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { OrderStatusRegressionModal } from '..'

const TITLE = 'Reason required to change the status'

const mount = (props = {}) => {
  const onSubmit = vi.fn()
  const onClose = vi.fn()
  const view = renderWithProviders(
    <OrderStatusRegressionModal open orderId={123} currentStatus={11} newStatus={7} onSubmit={onSubmit} onClose={onClose} {...props} />
  )
  return { onSubmit, onClose, ...view }
}
const footerButtons = dialog => within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button').map(button => button.textContent)

afterEach(() => document.getElementById('app-modals')?.remove())

describe('OrderStatusRegressionModal · dialog', () => {
  it('is a medium dialog named by its title and described by the explanation', async () => {
    mount()
    const dialog = await screen.findByRole('dialog', { name: TITLE })
    expect(dialog).toHaveAttribute('data-size', 'md')
    expect(screen.getByRole('heading', { level: 2, name: TITLE })).toBeInTheDocument()
    expect(dialog).toHaveAccessibleDescription(/Moving an order back to a previous status requires a reason/)
  })

  it('renders nothing while closed', () => {
    mount({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows Order #id and the two statuses, each as a badge of its own family', async () => {
    mount()
    const dialog = await screen.findByRole('dialog')
    const transition = dialog.querySelector('.odc-regression-transition')
    expect(transition).toHaveTextContent('Order #123')
    const badges = [...transition.querySelectorAll('.odc-badge')]
    expect(badges.map(badge => [badge.textContent, badge.dataset.family])).toEqual([
      ['Delivery completed by driver', 'done'],
      ['Accepted by business', 'progress']
    ])
    expect(transition.querySelector('.odc-mono')).toHaveTextContent('#123')
  })

  it('reads the direction of the change to a screen reader, not only an arrow', async () => {
    mount()
    const dialog = await screen.findByRole('dialog')
    const transition = dialog.querySelector('.odc-regression-transition')
    expect(transition).toHaveTextContent(/Delivery completed by driver\s*to\s*Accepted by business/)
    expect(transition.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('for a batch shows the count and only the new status', async () => {
    mount({ ordersCount: 3, orderId: undefined, currentStatus: undefined })
    const dialog = await screen.findByRole('dialog')
    const transition = dialog.querySelector('.odc-regression-transition')
    expect(transition).toHaveTextContent(/^3 Orders/)
    expect([...transition.querySelectorAll('.odc-badge')].map(badge => badge.textContent)).toEqual(['Accepted by business'])
  })

  it('labels the reason field with visible text and puts the focus there', async () => {
    mount()
    const field = await screen.findByLabelText('Reason')
    expect(field.tagName).toBe('TEXTAREA')
    expect(screen.getByText('Reason', { selector: 'label' })).toBeVisible()
    expect(field).toHaveAttribute('placeholder', 'Write the reason')
    await waitFor(() => expect(field).toHaveFocus())
  })

  it('footer reads Cancel then Confirm; Confirm is off until there is a reason', async () => {
    const user = userEvent.setup()
    const { onSubmit } = mount()
    const dialog = await screen.findByRole('dialog')
    expect(footerButtons(dialog)).toEqual(['Cancel', 'Confirm'])
    const confirm = within(dialog).getByRole('button', { name: 'Confirm' })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText('Reason'), '   ')
    expect(confirm).toBeDisabled()
    await user.click(confirm)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('says a reason is required once the field was touched and left empty, tied to the field', async () => {
    const user = userEvent.setup()
    mount()
    const field = await screen.findByLabelText('Reason')
    expect(screen.queryByText('A reason is required.')).not.toBeInTheDocument()
    expect(field).not.toHaveAttribute('aria-invalid')
    await user.type(field, 'x')
    await user.clear(field)
    const error = screen.getByText('A reason is required.')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(expect.stringContaining('A reason is required.'))
    expect(error).toBeVisible()
    await user.type(field, 'ok')
    expect(screen.queryByText('A reason is required.')).not.toBeInTheDocument()
  })

  it('Confirm sends the trimmed reason, once, the same call as before', async () => {
    const user = userEvent.setup()
    const { onSubmit } = mount()
    await user.type(await screen.findByLabelText('Reason'), '  customer asked  ')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('customer asked')
  })

  it('Enter in the field adds a line; it does not confirm', async () => {
    const user = userEvent.setup()
    const { onSubmit } = mount()
    const field = await screen.findByLabelText('Reason')
    await user.type(field, 'first{Enter}second')
    expect(field).toHaveValue('first\nsecond')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Cancel, the close button and Escape all call onClose and never onSubmit', async () => {
    const user = userEvent.setup()
    const { onSubmit, onClose } = mount()
    const dialog = await screen.findByRole('dialog')
    await user.type(screen.getByLabelText('Reason'), 'reason')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(3)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('while loading both footer buttons are off and Confirm shows it is busy', async () => {
    const user = userEvent.setup()
    mount({ loading: true })
    await user.type(await screen.findByLabelText('Reason'), 'reason')
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(confirm).toBeDisabled()
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('forgets the reason when it is closed and opened again', async () => {
    const user = userEvent.setup()
    const { rerender, onSubmit, onClose } = mount()
    await user.type(await screen.findByLabelText('Reason'), 'old reason')
    const element = open => (
      <OrderStatusRegressionModal open={open} orderId={123} currentStatus={11} newStatus={7} onSubmit={onSubmit} onClose={onClose} />
    )
    rerender(element(false))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    rerender(element(true))
    expect(await screen.findByLabelText('Reason')).toHaveValue('')
  })
})
