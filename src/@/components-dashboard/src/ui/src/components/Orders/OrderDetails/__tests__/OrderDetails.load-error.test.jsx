/* eslint-disable import/first */
// (review R1): when `GET /orders/:id` fails (a 5xx, the network) the panel said «Sorry, we couldn't find the
// requested order.» with «Go to Orders» only: a passing failure read as an order that does not exist, with no way to try
// again and no Close. A failed load now has its own state, like the list's: «We couldn’t load the order», the server line
// and «Try again», which asks the controller for the order again. Both states (failed, not found) keep a Close button.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ user: { id: 1, level: 0 } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: value => String(value) }],
  useSession: () => [{ user: runtime.user, token: null }],
  useApi: () => [null],
  OrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../../utils', () => ({
  getOrderStatuPickUp: () => ({ percentage: 20 }),
  getOrderStatus: () => ({ percentage: 20 }),
  getOrderStatusPrefix: () => 'Pending',
  getCurrenySymbol: () => '$',
  addQueryToUrl: vi.fn(),
  removeQueryToUrl: vi.fn(),
  getUserType: () => false
}))

vi.mock('react-hook-form', () => ({
  useForm: () => ({ register: vi.fn(), handleSubmit: fn => fn, formState: { errors: {} } })
}))
vi.mock('../../OrderDetailsHeader', () => ({ OrderDetailsHeader: () => <div data-testid='header' /> }))
vi.mock('../DetailsTab', () => ({ DetailsTab: () => null }))
vi.mock('../ActivityTab', () => ({ ActivityTab: () => null }))
vi.mock('../ChatTab', () => ({ ChatTab: () => null }))
vi.mock('../OrderMessages', () => ({ OrderMessagesProvider: ({ children }) => children }))
vi.mock('../FieldsTab', () => ({ FieldsTab: () => null }))
vi.mock('../DetailsFooter', () => ({ DetailsFooter: () => null }))
vi.mock('../../CloneOrder', () => ({ CloneOrder: () => null }))
vi.mock('../../OrderToPrint', () => {
  const OrderToPrint = React.forwardRef(function OrderToPrintMock () { return null })
  return { OrderToPrint }
})
vi.mock('../../OrderToPrintTicket', () => {
  const OrderToPrintTicket = React.forwardRef(function OrderToPrintTicketMock () { return null })
  return { OrderToPrintTicket }
})
vi.mock('../../../Shared', () => ({ Modal: () => null, Alert: () => null }))
vi.mock('../../../../styles', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  TextArea: (props) => <textarea {...props} />
}))

import { OrderDetails } from '..'

const renderPanel = async (orderState, props = {}) => {
  const handlers = { onClose: vi.fn(), handleBackRedirect: vi.fn(), handleRetryOrder: vi.fn() }
  renderWithProviders(
    <OrderDetails
      open
      layout='split'
      order={orderState}
      messages={{ messages: [] }}
      setIsTourFlag={vi.fn()}
      handleCloneOrder={vi.fn()}
      setCloneState={vi.fn()}
      cloneState={{ type: 1, loading: false }}
      setCurrentTourStep={vi.fn()}
      setIsTourOpen={vi.fn()}
      {...handlers}
      {...props}
    />,
    { initialEntries: ['/orders?id=13861'] }
  )
  await act(async () => { await import('../OrderDetailsPanel') })
  return handlers
}

describe('OrderDetails panel · a failed load is not «not found»', () => {
  beforeEach(() => { runtime.user = { id: 1, level: 0 } })

  it('says the order could not be loaded and offers Try again, which asks for the order again', async () => {
    const handlers = await renderPanel({ loading: false, order: null, error: ['Internal error'] })
    expect(screen.getByText('We couldn’t load the order')).toBeInTheDocument()
    expect(screen.getByText('The server didn’t answer. Check your connection and try again.')).toBeInTheDocument()
    expect(screen.queryByText('Sorry, we couldn\'t find the requested order.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(handlers.handleRetryOrder).toHaveBeenCalledTimes(1)
  })

  it('keeps a Close button on a failed load', async () => {
    const handlers = await renderPanel({ loading: false, order: null, error: ['Internal error'] })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(handlers.onClose).toHaveBeenCalled()
  })

  it('an order the API does not return is still «not found», with Go to Orders and now a Close button', async () => {
    const handlers = await renderPanel({ loading: false, order: null, error: null })
    expect(screen.getByText('Sorry, we couldn\'t find the requested order.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to Orders' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(handlers.onClose).toHaveBeenCalled()
  })

  it('a refresh that fails after the order loaded keeps the order on screen', async () => {
    await renderPanel({ loading: false, order: { id: 13861, status: 0 }, error: ['Internal error'] })
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.queryByText('We couldn’t load the order')).toBeNull()
  })
})
