/* eslint-disable import/first */
// Batch 5.4-B · the image preview and the alert of the messages as Product Dialogs (C8): role and name,
// the image described by its file name or its author, the title kept for assistive technology but not
// drawn, Escape and the focus back on the thumbnail, and the alert with one OK. The callbacks of the
// messages stay in Messages.accessibility.test.jsx. The Product wrappers are real here.
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

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

vi.mock('../../../../utils', () => ({ addQueryToUrl: vi.fn() }))

// The legacy shell stays a stub; the dialogs under test are the Product ones.
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Image: ({ src, fallback }) => src ? <img src={src} alt='' /> : fallback,
  Modal: ({ children, open, title }) => open ? <div role='dialog' aria-label={`legacy ${title}`}>{children}</div> : null
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

const baseProps = {
  canRead: { administrator: true, business: true, customer: true, driver: true },
  getHistoryComment: () => '',
  handleMessageOrderDetail: vi.fn(),
  handleReadMessages: vi.fn(),
  handleSend: vi.fn(),
  image: null,
  isChat: true,
  message: '',
  messageDashboardView: true,
  sendMessage: { loading: false, error: null },
  order: {
    id: 42,
    status: 0,
    created_at: '2026-09-15T00:00:00Z',
    app_id: 'web',
    business: { name: 'Long business name' },
    customer: { name: 'Ada', lastname: 'Lovelace' }
  },
  setCanRead: vi.fn(),
  setImage: vi.fn(),
  setMessage: vi.fn()
}

const withImage = (source) => ({
  loading: false,
  messages: [{
    id: 8,
    type: 3,
    author_id: 1,
    author: { id: 1, name: 'Admin', level: 0 },
    can_see: [2, 3],
    source,
    created_at: '2026-09-15T00:00:00Z'
  }]
})

const footerButtons = dialog => within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button').map(button => button.textContent)

afterEach(() => document.getElementById('app-modals')?.remove())

describe('Messages · image preview', () => {
  it('opens a large dialog named Image preview, with the image described by its author', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MessagesUI {...baseProps} messages={withImage('data:image/png;base64,AA')} />)
    await user.click(screen.getByRole('button', { name: 'Click to expand' }))
    const dialog = await screen.findByRole('dialog', { name: 'Image preview' })
    expect(dialog).toHaveAttribute('data-size', 'lg')
    expect(within(dialog).getByRole('img', { name: 'Image from Admin' })).toHaveAttribute('src', 'data:image/png;base64,AA')
    expect(within(dialog).getByRole('link', { name: 'Open original image' })).toHaveAttribute('href', 'data:image/png;base64,AA')
  })

  it('describes a hosted image by its file name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MessagesUI {...baseProps} messages={withImage('https://cdn.test/uploads/door%20photo.png?v=2')} />)
    await user.click(screen.getByRole('button', { name: 'Click to expand' }))
    const dialog = await screen.findByRole('dialog', { name: 'Image preview' })
    expect(within(dialog).getByRole('img', { name: 'door photo.png' })).toBeInTheDocument()
  })

  it('keeps the title for assistive technology and does not draw it', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MessagesUI {...baseProps} messages={withImage('data:image/png;base64,AA')} />)
    await user.click(screen.getByRole('button', { name: 'Click to expand' }))
    const dialog = await screen.findByRole('dialog', { name: 'Image preview' })
    expect(dialog).toHaveClass('odc-image-dialog')
    expect(within(dialog).getByRole('heading', { name: 'Image preview' })).toBeInTheDocument()
  })

  it('Escape closes it and gives the focus back to the thumbnail', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MessagesUI {...baseProps} messages={withImage('data:image/png;base64,AA')} />)
    const thumb = screen.getByRole('button', { name: 'Click to expand' })
    await user.click(thumb)
    await screen.findByRole('dialog', { name: 'Image preview' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(thumb).toHaveFocus()
  })
})

describe('Messages · alert', () => {
  it('shows what a failed send answered in a dialog named Error, with one OK', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MessagesUI {...baseProps} messages={{ loading: false, messages: [] }} sendMessage={{ loading: false, error: ['The message could not be sent'] }} />)
    const alert = await screen.findByRole('alertdialog', { name: 'Error' }) // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
    expect(within(alert).getByText('The message could not be sent')).toBeInTheDocument()
    expect(footerButtons(alert)).toEqual(['OK'])
    await user.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull()) // redesign W0-2 r3 (W0-P2-01): the alert is an alertdialog, so closing is told by that role
  })
})
