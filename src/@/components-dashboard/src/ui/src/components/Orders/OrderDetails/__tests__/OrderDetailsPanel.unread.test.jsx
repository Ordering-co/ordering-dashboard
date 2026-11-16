/* eslint-disable import/first */
// redesign messages B1 (decision 7A, B1-6): the Chat tab of the order panel counts the messages people wrote
// (`unread_direct_count`), not the order events; it falls back to `unread_count` only when the API sends no direct count.
// The tab contents are mocked: this file only looks at the tab strip.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { SplitView } from '../../../Shared/Product'

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
vi.mock('../DetailsTab', () => ({ DetailsTab: () => <div data-testid='tab-details' /> }))
vi.mock('../ActivityTab', () => ({ ActivityTab: () => <div data-testid='tab-activity' /> }))
vi.mock('../ChatTab', () => ({ ChatTab: () => <div data-testid='tab-chat' /> }))
vi.mock('../OrderMessages', () => ({ OrderMessagesProvider: ({ children }) => children }))
vi.mock('../FieldsTab', () => ({ FieldsTab: () => <div data-testid='tab-fields' /> }))
vi.mock('../DetailsFooter', () => ({ DetailsFooter: () => <div data-testid='footer' /> }))
vi.mock('../../CloneOrder', () => ({ CloneOrder: () => null }))
vi.mock('../../OrderToPrint', () => ({ OrderToPrint: React.forwardRef(function OrderToPrintMock () { return null }) }))
vi.mock('../../OrderToPrintTicket', () => ({ OrderToPrintTicket: React.forwardRef(function OrderToPrintTicketMock () { return null }) }))
vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => open ? <div role='dialog' aria-label='legacy'>{children}</div> : null,
  Alert: () => null
}))
vi.mock('../../../../styles', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  TextArea: (props) => <textarea {...props} />
}))

import { OrderDetails } from '..'

const order = { id: 42, status: 7, delivery_type: 1, customer_id: 5, products: [], summary: { total: 0 }, customer: { id: 5, name: 'Ada' }, business: { name: 'Fast Bite' } }

const renderPanel = async (orderOverrides = {}) => {
  const onClose = vi.fn()
  const view = renderWithProviders(
    <SplitView
      open
      onClose={onClose}
      panelLabel='Order 42'
      resizeLabel='Resize'
      list={<div>list</div>}
      panel={(
        <OrderDetails
          open
          layout='split'
          order={{ loading: false, order: { ...order, ...orderOverrides } }}
          messages={{ messages: [] }}
          setIsTourFlag={vi.fn()}
          handleCloneOrder={vi.fn()}
          setCloneState={vi.fn()}
          cloneState={{ type: 1, loading: false }}
          setCurrentTourStep={vi.fn()}
          setIsTourOpen={vi.fn()}
          onClose={onClose}
          handleBackRedirect={onClose}
        />
      )}
    />,
    { initialEntries: ['/orders?id=42'] }
  )
  await waitFor(() => expect(document.querySelector('#orderDetails:not([aria-busy])')).not.toBeNull())
  return view
}

describe('Order panel: the unread count of the Chat tab counts what people wrote (B1-6)', () => {
  beforeEach(() => {
    runtime.user = { id: 1, level: 0 }
    window.innerWidth = 1400
  })

  it('shows unread_direct_count, not unread_count, when the API sends both (8 and 2 shows 2)', async () => {
    await renderPanel({ unread_count: 8, unread_direct_count: 2 })
    const tab = screen.getByRole('tab', { name: /Chat/ })
    expect(tab).toHaveTextContent('2 unread messages')
    expect(tab).not.toHaveTextContent('8')
  })

  it('shows no count when the people wrote nothing, even if order events are unread', async () => {
    await renderPanel({ unread_count: 8, unread_direct_count: 0 })
    expect(screen.getByRole('tab', { name: /Chat/ })).not.toHaveTextContent(/unread/)
  })

  it('falls back to unread_count only when unread_direct_count is undefined', async () => {
    await renderPanel({ unread_count: 3 })
    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveTextContent('3 unread messages')
  })
})
