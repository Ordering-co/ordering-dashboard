/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ businessController: null, messagesController: null, usersController: null, inboxProps: null, width: 1280, user: { id: 1, level: 0 } }))
vi.mock('react-router-dom', () => ({ useLocation: () => ({ search: '' }) }))
vi.mock('../../../../../index', () => ({
  DashboardBusinessList: props => { runtime.businessController = props; return <div /> },
  OrdersManage: props => { runtime.messagesController = props; return <div /> },
  UsersList: props => { runtime.usersController = props; return <div /> },
  useLanguage: () => [{}, (key, fallback) => fallback || key],
  useSession: () => [{ user: runtime.user }], // redesign messages B3b (decision 2A): the page decides showBusiness from the user's level
  useUtils: () => [{ optimizeImage: value => value }]
}))
vi.mock('../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: runtime.width }) }))
vi.mock('../../../utils', () => ({ addQueryToUrl: vi.fn(), removeQueryToUrl: vi.fn(), learnOptionsValues: () => [] }))
vi.mock('../../Orders', () => ({
  // redesign messages B3b (decision 1A): the page no longer mounts the old chat (Messages) nor the old list (OrdersDashboardList); it mounts the Inbox
  OrderDetails: ({ orderId, onClose }) => <div data-testid='order-details'>{orderId}<button type='button' onClick={onClose}>Close details</button></div>,
  OrderNotification: () => <div data-testid='notification' />,
  OrdersContentHeader: () => <div data-testid='orders-header' />,
  // redesign W1-1 (T1-2): the Sheet stays mounted while its entity is set, so the mock follows `open` like the real one
  ContactOrdersSheet: ({ business, user, open }) => (open ? <div role='dialog'>{business?.name || user?.name}</div> : null)
}))
// redesign messages B3b (decision 1A): the inbox is imported by file; its own behaviour is pinned in Orders/Messages/__tests__/Inbox.test.jsx
vi.mock('../../Orders/Messages/Inbox', () => ({
  Inbox: props => {
    runtime.inboxProps = props
    return <button type='button' onClick={() => props.onOpenOrder({ id: 41 })}>Select order</button>
  }
}))
// redesign W0-12 (T0-46): MessagesListing mounts the notification slot by file
vi.mock('../../Orders/OrderNotification', () => ({ OrderNotificationSlot: () => <div data-testid='notification-slot' /> }))
vi.mock('../AutoScroll', () => ({ AutoScroll: ({ children }) => <div>{children}</div> }))
vi.mock('../PaginationButton', () => ({
  PaginationButton: ({ nextPaginate, prevPaginate }) => <><button type='button' onClick={prevPaginate}>Business previous</button><button type='button' onClick={nextPaginate}>Business next</button></>
}))

import { ChatBusinessesList, ChatBusinessesListUI } from './ChatBusinessesList'
import { ChatContactList, ChatContactListUI } from './ChatContactList'
import { MessagesListing, MessagesListingUI } from './MessagesListing'

const source = name => readFileSync(new URL(name, import.meta.url), 'utf8')
const theme = { rtl: false, images: { dummies: { businessLogo: '/business.png' }, icons: { noDriver: '/driver.png' } }, colors: {} }
const renderUI = node => render(<ThemeProvider theme={theme}>{node}</ThemeProvider>)

beforeEach(() => {
  runtime.businessController = runtime.messagesController = runtime.usersController = runtime.inboxProps = null
  runtime.width = 1280
  runtime.user = { id: 1, level: 0 }
  document.body.style.overflow = ''
})

describe('L2e-E6 Messages', () => {
  it('preserves all controller wiring contracts', () => {
    renderUI(<><ChatBusinessesList marker='b' /><ChatContactList isDriver marker='u' /><MessagesListing marker='m' /></>)
    expect(runtime.businessController).toMatchObject({ marker: 'b', UIComponent: ChatBusinessesListUI, asDashboard: true, initialPageSize: 50, loadMorePageSize: 10, isSearchByBusinessName: true, isSearchByBusinessEmail: true, isSearchByBusinessPhone: true })
    expect(runtime.usersController).toMatchObject({ marker: 'u', UIComponent: ChatContactListUI, defaultUserTypesSelected: [4], propsToFetch: ['name', 'lastname', 'photo', 'assigned_orders_count'] })
    expect(runtime.messagesController.UIComponent).toBe(MessagesListingUI)
    expect(runtime.messagesController.driversPropsToFetch).toHaveLength(15)
  })

  it('preserves business local paging, lazy boundary and original-reference order opening', async () => {
    const user = userEvent.setup()
    const businesses = Array.from({ length: 11 }, (_, index) => ({ id: index + 1, name: `Business ${index + 1}` }))
    const loadMoreBusinesses = vi.fn()
    renderUI(<ChatBusinessesListUI businessList={{ loading: false, businesses }} pagination={{ total: 21 }} loadMoreBusinesses={loadMoreBusinesses} />)
    await user.click(screen.getAllByRole('button', { name: 'Orders' })[0])
    expect(screen.getByRole('dialog')).toHaveTextContent('Business 1')
    await user.click(screen.getByRole('button', { name: 'Business next' }))
    expect(screen.getByText('Business 11')).toBeInTheDocument()
    expect(loadMoreBusinesses).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Business next' }))
    expect(loadMoreBusinesses).toHaveBeenCalledOnce()
  })

  it('preserves contact disabled and prev/next payloads', async () => {
    const user = userEvent.setup()
    const getUsers = vi.fn()
    renderUI(<ChatContactListUI isDriver usersList={{ loading: false, users: [{ id: 1, name: 'No orders', assigned_orders_count: 0 }, { id: 2, name: 'Driver', assigned_orders_count: 2 }] }} paginationProps={{ currentPage: 2, totalPages: 3 }} paginationDetail={{ from: 11, to: 12, total: 22 }} getUsers={getUsers} />)
    expect(screen.getAllByRole('button', { name: /Orders/ })[0]).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(getUsers).toHaveBeenNthCalledWith(1, false, false)
    expect(getUsers).toHaveBeenNthCalledWith(2, false, true)
    await user.click(screen.getAllByRole('button', { name: /2 Orders/ })[0])
    expect(screen.getByRole('dialog')).toHaveTextContent('Driver')
  })

  const listingProps = { searchValue: 'ada', driverGroupList: {}, driversList: { drivers: [] }, paymethodsList: {}, businessesList: {}, filterValues: { statuses: [1] }, selectedSubOrderStatus: [], handleChangeSearch: () => {}, handleChangeFilterValues: () => {} }

  // redesign messages B3b (decision 1A): the page mounts the two-pane inbox. The single «Orders» tab and «Contacts» are gone from the
  // page (Contacts never mounted in main, W1-D-17), and «View order» opens the order panel with the same callbacks as before.
  it('mounts the inbox and keeps the exact owned detail callbacks', async () => {
    const user = userEvent.setup()
    renderUI(<MessagesListingUI {...listingProps} isUseQuery />)
    expect(document.querySelector('[data-slot="messages-listing"]')).toBeInTheDocument()
    expect(screen.getByTestId('orders-header')).toBeInTheDocument()
    expect(screen.getByTestId('notification-slot')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Contacts' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Contacts' })).not.toBeInTheDocument()
    expect(runtime.inboxProps).toMatchObject({ searchValue: 'ada', filterValues: { statuses: [1] }, isUseQuery: true, orderDetailOpen: false })
    await user.click(screen.getByRole('button', { name: 'Select order' }))
    expect(screen.getByTestId('order-details')).toHaveTextContent('41')
    expect(runtime.inboxProps.orderDetailOpen).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Close details' }))
    expect(screen.queryByTestId('order-details')).not.toBeInTheDocument()
    expect(runtime.inboxProps.orderDetailOpen).toBe(false)
  })

  // redesign messages B3b (decision 1A): Newest / Order number moved into the list's own sort menu (ConversationList)
  it('no longer draws the sort control, the tab or the old chat', () => {
    renderUI(<MessagesListingUI {...listingProps} />)
    expect(screen.queryByRole('group', { name: 'Sort orders by' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Newest' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('messages-pane')).not.toBeInTheDocument()
  })

  // redesign messages B3b (decision 2A)
  it.each([
    ['an admin', { level: 0 }, {}, true],
    ['a single-store owner', { level: 2 }, { businesses: [{ id: 1 }] }, false],
    ['an owner of two stores', { level: 2 }, { businesses: [{ id: 1 }, { id: 2 }] }, true],
    ['an owner whose stores are still loading', { level: 2 }, { businesses: [] }, false]
  ])('passes showBusiness for %s', (_, sessionUser, businessesList, expected) => {
    runtime.user = { id: 1, ...sessionUser }
    renderUI(<MessagesListingUI {...listingProps} businessesList={businessesList} />)
    expect(runtime.inboxProps.showBusiness).toBe(expected)
  })

  // redesign W1-6 (T1-6-4, W1-D-16)
  describe('page scroll lock while the order panel is open below 768px', () => {
    const listing = <MessagesListingUI searchValue='' driverGroupList={{}} driversList={{ drivers: [] }} paymethodsList={{}} businessesList={{}} filterValues={{}} selectedSubOrderStatus={[]} handleChangeSearch={() => {}} handleChangeFilterValues={() => {}} />

    it('locks on open and unlocks on close, as main does', async () => {
      const user = userEvent.setup()
      runtime.width = 390
      renderUI(listing)
      expect(document.body.style.overflow).toBe('auto')
      await user.click(screen.getByRole('button', { name: 'Select order' }))
      expect(document.body.style.overflow).toBe('hidden')
      await user.click(screen.getByRole('button', { name: 'Close details' }))
      expect(document.body.style.overflow).toBe('auto')
    })

    it('puts the previous value back when the page unmounts with the panel open', async () => {
      const user = userEvent.setup()
      runtime.width = 390
      document.body.style.overflow = 'scroll'
      const { unmount } = renderUI(listing)
      await user.click(screen.getByRole('button', { name: 'Select order' }))
      expect(document.body.style.overflow).toBe('hidden')
      unmount()
      expect(document.body.style.overflow).toBe('scroll')
    })

    it('does not touch the page from 768px up', async () => {
      const user = userEvent.setup()
      runtime.width = 1280
      renderUI(listing)
      await user.click(screen.getByRole('button', { name: 'Select order' }))
      expect(document.body.style.overflow).toBe('')
    })
  })

  // redesign W1-6 (T1-6-4, D-24): the pressed page arrow draws the inverse token on the action fill, instantly. The contrast itself
  // is measured in a browser by e2e/brand-system/messages-shell.spec.js ("contact pagination pressed SVG remains readable").
  it('draws the pressed contact page arrow with the inverse token, not the action content token', () => {
    const chatContactCss = source('./chat-contact.css')
    const chatContactStyles = source('./chat-contact-styles.js')
    expect(chatContactCss).toMatch(/\.od-chat-page-action:active > svg \{ color: var\(--od-text-inverse\); transition: none; \}/)
    const pressed = chatContactStyles.slice(chatContactStyles.indexOf('&:active'), chatContactStyles.indexOf('&:disabled'))
    expect(pressed).toContain('background: var(--od-entity-selector-action)')
    expect(pressed).toContain('color: var(--od-text-inverse)')
    expect(pressed).not.toContain('action-content')
  })
})
