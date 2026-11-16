/* eslint-disable import/first */
// Batch 5.4-B · logic of the driver assignment comment. Written green against the legacy Modal and kept
// green after the move to a Product Dialog: the comment is required, `handleUpdateComment` receives
// `{ comment, driverId }` and the dialog closes. Only the names of the dialog's buttons are looked up
// by pattern so the same file runs before and after (the names are pinned in the dialog test).
import React from 'react'
import { act, screen, waitFor } from '@testing-library/react'
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
vi.mock('../DetailsTab', () => ({
  DetailsTab: (props) => { runtime.tabProps = props; return <div data-testid='tab-details' /> }
}))
vi.mock('../ActivityTab', () => ({ ActivityTab: () => null }))
vi.mock('../ChatTab', () => ({ ChatTab: () => null }))
// The panel's one Messages controller (parity audit 2) is not under test here: the tabs are mocked.
vi.mock('../OrderMessages', () => ({ OrderMessagesProvider: ({ children }) => children }))
vi.mock('../FieldsTab', () => ({ FieldsTab: () => null }))
vi.mock('../DetailsFooter', () => ({ DetailsFooter: () => null }))
vi.mock('../../CloneOrder', () => ({ CloneOrder: () => null }))
vi.mock('../../OrderToPrint', () => ({ OrderToPrint: React.forwardRef(function OrderToPrintMock () { return null }) }))
vi.mock('../../OrderToPrintTicket', () => ({ OrderToPrintTicket: React.forwardRef(function OrderToPrintTicketMock () { return null }) }))

// The legacy shell stays a stub: a visible dialog only while open.
vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => (open ? <div role='dialog'>{children}</div> : null),
  Alert: () => null
}))

// The legacy styled controls, with the ref the form needs to read the textarea.
vi.mock('../../../../styles', () => ({
  Button: ({ children, color, borderRadius, ...props }) => <button {...props}>{children}</button>,
  TextArea: React.forwardRef(function TextAreaMock (props, ref) { return <textarea ref={ref} {...props} /> })
}))

import { OrderDetails } from '..'

const order = { id: 42, customer_id: 7, products: [], delivery_type: 1, status: 0, unread_count: 0 }
const submitName = /^(Accept|Assign driver)$/

const renderMount = (handleUpdateComment) => renderWithProviders(
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

describe('OrderDetails · driver assignment comment', () => {
  it('opens only when a driver was chosen and asks for the comment', async () => {
    await mount(vi.fn())
    expect(screen.queryByRole('textbox')).toBeNull()
    openComment()
    expect(await screen.findByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: submitName })).toBeInTheDocument()
  })

  it('does not assign without a comment and says the field is required', async () => {
    const handleUpdateComment = vi.fn()
    const user = userEvent.setup()
    await mount(handleUpdateComment)
    openComment()
    await screen.findByRole('textbox')
    await user.click(screen.getByRole('button', { name: submitName }))
    expect(await screen.findByText('This field is required')).toBeInTheDocument()
    expect(handleUpdateComment).not.toHaveBeenCalled()
  })

  it('assigns once with the comment and the chosen driver, then closes', async () => {
    const handleUpdateComment = vi.fn()
    const user = userEvent.setup()
    await mount(handleUpdateComment)
    openComment(9)
    await user.type(await screen.findByRole('textbox'), 'Pick up at the side door')
    await user.click(screen.getByRole('button', { name: submitName }))
    await vi.waitFor(() => expect(handleUpdateComment).toHaveBeenCalledTimes(1))
    expect(handleUpdateComment).toHaveBeenCalledWith({ comment: 'Pick up at the side door', driverId: 9 })
    await vi.waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
  })
})
