/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const { addQueryToUrl } = vi.hoisted(() => ({ addQueryToUrl: vi.fn() }))

vi.mock('../../../../../../index', () => {
  const config = [{ configs: {} }]
  const session = [{ user: { id: 1, level: 0 } }]
  const utils = [{
    getTimeAgo: () => 'just now',
    optimizeImage: value => value,
    parseDate: value => value
  }]
  return {
    Messages: ({ UIComponent, ...props }) => <UIComponent {...props} />,
    useConfig: () => config,
    useLanguage: () => [null, (_key, fallback) => fallback],
    useSession: () => session,
    useUtils: () => utils
  }
})

vi.mock('../../../../utils', () => ({ addQueryToUrl }))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Image: ({ src, fallback }) => src ? <img src={src} alt='' /> : fallback,
  Modal: ({ children, open, title }) => open ? <div role='dialog' aria-label={title}>{children}</div> : null
}))

vi.mock('../../../../styles', () => ({
  Button: React.forwardRef(function ButtonMock ({ children, ...props }, ref) {
    const domProps = { ...props }
    delete domProps.borderRadius
    delete domProps.circle
    delete domProps.color
    return <button ref={ref} {...domProps}>{children}</button>
  }),
  Input: React.forwardRef(function InputMock (props, ref) {
    return <input ref={ref} {...props} />
  })
}))

vi.mock('react-bootstrap', () => ({
  OverlayTrigger: ({ children }) => children,
  Tooltip: ({ children }) => <span>{children}</span>
}))

vi.mock('../../Logistics', () => ({ Logistics: () => null }))
vi.mock('../../OrderLogisticInformation', () => ({ OrderLogisticInformation: () => null }))

import { MessagesUI } from '..'
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names these tests look up changed.

const baseProps = {
  canRead: { administrator: true, business: true, customer: true, driver: true },
  getHistoryComment: () => '',
  handleMessageOrderDetail: vi.fn(),
  handleReadMessages: vi.fn(),
  handleSend: vi.fn(),
  image: null,
  isChat: false,
  message: '',
  messages: { loading: false, messages: [] },
  order: {
    id: 42,
    status: 0,
    created_at: '2026-09-15T00:00:00Z',
    app_id: 'web',
    business: { name: 'Long business name' },
    customer: { name: 'Ada', lastname: 'Lovelace' }
  },
  sendMessage: { loading: false, error: null },
  setCanRead: vi.fn(),
  setImage: vi.fn(),
  setMessage: vi.fn()
}

afterEach(() => document.getElementById('app-modals')?.remove())

describe('Orders Messages accessibility', () => {
  it('uses native pressed-state controls for history sections without changing query callbacks', () => {
    renderWithProviders(<MessagesUI {...baseProps} history />)

    const history = screen.getByRole('button', { name: 'Order History' })
    const logistics = screen.getByRole('button', { name: 'Logistics' })
    const information = screen.getByRole('button', { name: 'Logistics information' })

    expect(history).toHaveAttribute('aria-pressed', 'true')
    expect(logistics).toHaveAttribute('aria-pressed', 'false')
    expect(information).toHaveAttribute('aria-pressed', 'false')
    expect(getComputedStyle(history).minHeight).toBe('44px')

    fireEvent.click(logistics)
    expect(addQueryToUrl).toHaveBeenLastCalledWith({ tab: 'logistics' })
    expect(logistics).toHaveAttribute('aria-pressed', 'true')
  })

  // redesign W1-6 (W1-QB1-04): the chat scrolls, so axe asks for a focusable, named region (scrollable-region-focusable)
  it('names the scrollable chat and makes it reachable by keyboard, in the chat and in the history', () => {
    const { unmount } = renderWithProviders(<MessagesUI {...baseProps} isChat />)
    const chat = screen.getByRole('region', { name: 'Chat' })
    expect(chat).toHaveAttribute('id', 'chat')
    expect(chat).toHaveAttribute('tabindex', '0')
    unmount()
    renderWithProviders(<MessagesUI {...baseProps} history />)
    expect(screen.getByRole('region', { name: 'Order History' })).toHaveAttribute('tabindex', '0')
  })

  // redesign bugs-d row 36c (W1-D-26): the time of a bubble was a hover-only react-bootstrap tooltip; now Tab reaches it and the full date shows on focus
  it('reaches the time of a bubble by Tab and shows its full date on focus', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <MessagesUI
        {...baseProps}
        isChat
        messages={{
          loading: false,
          messages: [{
            id: 9,
            type: 2,
            author_id: 1,
            author: { id: 1, name: 'Admin', level: 0 },
            comment: 'On my way',
            can_see: [2, 3],
            created_at: '2026-09-15T00:00:00Z'
          }]
        }}
      />
    )

    const time = screen.getByText('just now')
    expect(time).toHaveAttribute('tabindex', '0')
    expect(screen.queryByRole('tooltip')).toBeNull()
    for (let step = 0; step < 20 && document.activeElement !== time; step++) await user.tab()
    expect(time).toHaveFocus()
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('2026-09-15T00:00:00Z')
    expect(time.getAttribute('aria-describedby')).toContain(tip.id)
  })

  it('keeps recipient and send payload callbacks while naming image and detail controls', async () => {
    const setCanRead = vi.fn()
    const handleMessageOrderDetail = vi.fn()
    renderWithProviders(
      <MessagesUI
        {...baseProps}
        isChat
        message='Ready'
        setCanRead={setCanRead}
        handleMessageOrderDetail={handleMessageOrderDetail}
        messageDashboardView
        messages={{
          loading: false,
          messages: [{
            id: 8,
            type: 3,
            author_id: 1,
            author: { id: 1, name: 'Admin', level: 0 },
            can_see: [2, 3],
            source: 'data:image/png;base64,AA',
            created_at: '2026-09-15T00:00:00Z'
          }]
        }}
      />
    )

    const business = screen.getByRole('button', { name: 'Business: Long business name' })
    const identifier = screen.getByText('42', { exact: true })
    expect(identifier).toHaveClass('order-identifier')
    expect(identifier.parentElement).toHaveTextContent('Order number 42')
    expect(business).toHaveAttribute('aria-pressed', 'true')
    expect(getComputedStyle(business).minHeight).toBe('44px')
    fireEvent.click(business)
    expect(setCanRead).toHaveBeenCalledWith({ administrator: true, business: false, customer: true, driver: true })

    fireEvent.click(screen.getByRole('button', { name: 'Order details' }))
    expect(handleMessageOrderDetail).toHaveBeenCalledWith(true)
    expect(screen.getByLabelText('Insert image')).toHaveAttribute('type', 'file')

    fireEvent.click(screen.getByRole('button', { name: 'Click to expand' }))
    expect(screen.getByRole('dialog', { name: 'Image preview' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open original image' })).toHaveAttribute('href', 'data:image/png;base64,AA')
    // redesign 5.4: the preview is a Product Dialog now and it makes the page behind inert, so it
    // is closed (Escape) before the send button behind it is read.
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Image preview' }), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const send = screen.getByRole('button', { name: 'send' })
    expect(send).toHaveAttribute('aria-busy', 'false')
    expect(getComputedStyle(send).minHeight).toBe('44px')
  })
})
