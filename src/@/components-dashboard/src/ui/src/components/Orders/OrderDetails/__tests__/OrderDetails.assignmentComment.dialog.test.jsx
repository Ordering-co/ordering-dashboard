/* eslint-disable import/first */
// Batch 5.4-B · the driver assignment comment and the alert of the detail as Product Dialogs (C8): role
// and name, where the focus starts, Escape, the footer in order, the required field with its error tied
// to it, and the same `handleUpdateComment` payload. The Product wrappers are real here.
import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ tabProps: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: value => String(value) }],
  useSession: () => [{ user: { id: 1, level: 0 }, token: null }],
  useApi: () => [null],
  OrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../../utils', () => ({
  getOrderStatuPickUp: () => ({ percentage: 20 }),
  getOrderStatus: () => ({ percentage: 20 }),
  addQueryToUrl: vi.fn(),
  removeQueryToUrl: vi.fn()
}))

vi.mock('../../OrderDetailsHeader', () => ({ OrderDetailsHeader: () => null }))
// redesign bugs-d row 58: the tab carries the real FirstSelect the DriverSelector draws (class `driver-select`), so the panel's
// returnFocus selector is checked against the real trigger; picking a driver opens the comment, as DriverSelector's changeDriver does.
// The selector is rebuilt when the comment state changes (OrderContactInformation feeds its defaultValue from commentInfoState.driverId),
// so the trigger that had the focus is gone once the dialog closes (review r1 R-3: activeElement was <body>).
vi.mock('../DetailsTab', async () => {
  const { Select } = await import('../../../../styles/Select/FirstSelect')
  return {
    DetailsTab: (props) => {
      runtime.tabProps = props
      return (
        <div data-testid='tab-details'>
          <Select
            key={String(props.commentInfoState?.driverId ?? 'none')}
            className='driver-select'
            ariaLabel='Driver'
            defaultValue='default'
            options={[{ value: 'default', content: 'Select driver' }, { value: 9, content: 'Ana Driver' }]}
            onChange={(driverId) => driverId !== 'default' && props.setCommentInfostate({ open: true, driverId })}
          />
        </div>
      )
    }
  }
})
vi.mock('../ActivityTab', () => ({ ActivityTab: () => null }))
vi.mock('../ChatTab', () => ({ ChatTab: () => null }))
// The panel's one Messages controller (parity audit 2) is not under test here: the tabs are mocked.
vi.mock('../OrderMessages', () => ({ OrderMessagesProvider: ({ children }) => children }))
vi.mock('../FieldsTab', () => ({ FieldsTab: () => null }))
vi.mock('../DetailsFooter', () => ({ DetailsFooter: () => null }))
vi.mock('../../CloneOrder', () => ({ CloneOrder: () => null }))
vi.mock('../../OrderToPrint', () => ({ OrderToPrint: React.forwardRef(function OrderToPrintMock () { return null }) }))
vi.mock('../../OrderToPrintTicket', () => ({ OrderToPrintTicket: React.forwardRef(function OrderToPrintTicketMock () { return null }) }))

// The legacy shell and controls stay stubs so the panel renders without them; the dialogs under test are the Product ones.
vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => (open ? <div role='dialog' aria-label='legacy'>{children}</div> : null),
  Alert: () => null
}))
vi.mock('../../../../styles', () => ({
  Button: ({ children, color, borderRadius, ...props }) => <button {...props}>{children}</button>,
  TextArea: React.forwardRef(function TextAreaMock (props, ref) { return <textarea ref={ref} {...props} /> })
}))

import { OrderDetails } from '..'

const order = { id: 42, customer_id: 7, products: [], delivery_type: 1, status: 0, unread_count: 0 }
const footerButtons = dialog => within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button').map(button => button.textContent)

const renderMount = (handleUpdateComment, props = {}) => renderWithProviders(
  <OrderDetails
    open
    layout='split'
    order={{ loading: false, order }}
    messages={{ messages: [] }}
    handleUpdateComment={handleUpdateComment}
    handleCloneOrder={vi.fn()}
    setCloneState={vi.fn()}
    cloneState={{ type: 1, loading: false }}
    onClose={vi.fn()}
    setCurrentTourStep={vi.fn()}
    setIsTourOpen={vi.fn()}
    setIsTourFlag={vi.fn()}
    {...props}
  />
)

// redesign N-05: the panel is a lazy chunk; it is on screen once the skeleton (aria-busy) is gone.
const panelLoaded = () => waitFor(() => expect(document.querySelector('#orderDetails:not([aria-busy])')).not.toBeNull())
const mount = async (...args) => {
  const view = renderMount(...args)
  await panelLoaded()
  return view
}

const openComment = (driverId = 9) => act(() => runtime.tabProps.setCommentInfostate({ open: true, driverId }))

beforeEach(() => { runtime.tabProps = {} })
afterEach(() => document.getElementById('app-modals')?.remove())

describe('OrderDetails · driver assignment comment dialog', () => {
  it('is a dialog named Assignment comment with Cancel first and Assign driver last', async () => {
    await mount(vi.fn())
    expect(screen.queryByRole('dialog')).toBeNull()
    openComment()
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    expect(footerButtons(dialog)).toEqual(['Cancel', 'Assign driver'])
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('starts the focus on the comment, which has a visible label', async () => {
    await mount(vi.fn())
    openComment()
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    const field = within(dialog).getByRole('textbox', { name: /^Manual driver assigment comment/ })
    await waitFor(() => expect(field).toHaveFocus())
  })

  it('Escape and Cancel close it without assigning', async () => {
    const handleUpdateComment = vi.fn()
    const user = userEvent.setup()
    await mount(handleUpdateComment)
    openComment()
    await screen.findByRole('dialog', { name: 'Assignment comment' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    openComment()
    await user.click(within(await screen.findByRole('dialog', { name: 'Assignment comment' })).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(handleUpdateComment).not.toHaveBeenCalled()
  })

  it('an empty comment is not sent: the field is invalid and the error is tied to it', async () => {
    const handleUpdateComment = vi.fn()
    const user = userEvent.setup()
    await mount(handleUpdateComment)
    openComment()
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    await user.click(within(dialog).getByRole('button', { name: 'Assign driver' }))
    const field = await within(dialog).findByRole('textbox', { name: /^Manual driver assigment comment/ })
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'))
    expect(field).toHaveAccessibleDescription('This field is required')
    expect(handleUpdateComment).not.toHaveBeenCalled()
    expect(field).toHaveFocus() // review r1 R-2: as react-hook-form did before P/AssignCommentDialog
  })

  // redesign deliveries-followups P3: the panel uses P/AssignCommentDialog, which takes spaces only as empty (as the board did)
  it('a comment of spaces only is not sent either', async () => {
    const handleUpdateComment = vi.fn()
    const user = userEvent.setup()
    await mount(handleUpdateComment)
    openComment()
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    const field = within(dialog).getByRole('textbox', { name: /Manual driver assigment comment/ })
    await user.type(field, '   ')
    await user.click(within(dialog).getByRole('button', { name: 'Assign driver' }))
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'))
    expect(handleUpdateComment).not.toHaveBeenCalled()
  })

  it('Assign driver sends the comment and the driver once, and closes', async () => {
    const handleUpdateComment = vi.fn()
    const user = userEvent.setup()
    await mount(handleUpdateComment)
    openComment(9)
    const dialog = await screen.findByRole('dialog', { name: 'Assignment comment' })
    await user.type(within(dialog).getByRole('textbox'), 'Pick up at the side door')
    await user.click(within(dialog).getByRole('button', { name: 'Assign driver' }))
    await waitFor(() => expect(handleUpdateComment).toHaveBeenCalledTimes(1))
    expect(handleUpdateComment).toHaveBeenCalledWith({ comment: 'Pick up at the side door', driverId: 9 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

// redesign bugs-d row 58 (deliveries-followups R-3): the driver is picked from a listbox option, which unmounts, so the dialog has no
// opener to give the focus back to. It goes to the driver selector's trigger, not <body>.
describe('OrderDetails · driver assignment comment · focus on close', () => {
  const pickDriver = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Select driver' }))
    await user.click(await screen.findByRole('option', { name: /Ana Driver/ }))
    return screen.findByRole('dialog', { name: 'Assignment comment' })
  }
  const closers = {
    Escape: async (user) => { await user.keyboard('{Escape}') },
    Cancel: async (user, dialog) => { await user.click(within(dialog).getByRole('button', { name: 'Cancel' })) }
  }

  it.each(Object.keys(closers))('on %s the focus is on the driver trigger, not <body>', async (way) => {
    const user = userEvent.setup()
    await mount(vi.fn())
    const dialog = await pickDriver(user)
    await closers[way](user, dialog)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const trigger = document.querySelector('.driver-select [aria-haspopup="listbox"]')
    expect(trigger).not.toBeNull()
    await waitFor(() => expect(document.activeElement).not.toBe(document.body))
    expect(document.activeElement).toBe(trigger)
  })
})

describe('OrderDetails · alert of the detail', () => {
  it('shows what the action answered in a dialog named Order details, with one OK', async () => {
    const user = userEvent.setup()
    await mount(vi.fn(), { actionStatus: { loading: false, error: ['The order could not be updated'] } })
    const alert = await screen.findByRole('alertdialog', { name: 'Order details' }) // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
    expect(within(alert).getByText('The order could not be updated')).toBeInTheDocument()
    expect(footerButtons(alert)).toEqual(['OK'])
    await waitFor(() => expect(within(alert).getByRole('button', { name: 'OK' })).toHaveFocus())
    await user.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull()) // redesign W0-2 r3 (W0-P2-01): the alert is an alertdialog, so closing is told by that role
  })
})
