/* eslint-disable import/first */
// redesign F6i-3 (A3-03): a refund error is told by one surface, the bill (see OrderBill.f6i3.test.jsx). The panel's
// alert keeps telling the other errors and leaves the refund's alone, so no second modal stacks over the first.
import React from 'react'
import { screen, waitFor } from '@testing-library/react'
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

beforeEach(() => { runtime.tabProps = {} })
afterEach(() => document.getElementById('app-modals')?.remove())

describe('OrderDetails · alert of the detail and the refund error', () => {
  it('opens no alert for an error that comes from a refund: the bill tells it', async () => {
    await mount(vi.fn(), { actionStatus: { loading: false, error: ['Failed to fetch'], errorSource: 'refund', errorKind: 'network' } })
    // The alert opens after an effect and the layer of the dialog; give it the time main's alert needs (the test below).
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(screen.queryByRole('alertdialog', { name: 'Order details' })).toBeNull() // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
    expect(screen.queryByText('Failed to fetch')).toBeNull()
  })

  it('still tells the other errors, as main does', async () => {
    await mount(vi.fn(), { actionStatus: { loading: false, error: ['The order could not be updated'] } })
    expect(await screen.findByRole('alertdialog', { name: 'Order details' })).toBeInTheDocument() // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
  })
})
