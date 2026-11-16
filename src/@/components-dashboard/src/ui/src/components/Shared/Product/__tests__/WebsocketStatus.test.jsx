/* eslint-disable import/first */
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The controller is covered in components/WebsocketStatus; here it only hands its state to the UI.
const runtime = vi.hoisted(() => ({
  state: { socketStatus: 1, connectedDate: '2026-10-05T09:30:00Z', isConnectionDegraded: false },
  emit: vi.fn()
}))

// (row 32): the piece imports each context and the controller by file, so each file is mocked
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_key, fallback) => fallback] }))
vi.mock('../../../../../../contexts/UtilsContext', () => ({ useUtils: () => [{ parseDate: date => `parsed(${date})` }] }))
vi.mock('../../../../../../contexts/EventContext', () => ({ useEvent: () => [{ emit: runtime.emit }] }))
vi.mock('../../../../../../components/WebsocketStatus', () => ({
  WebsocketStatus: ({ UIComponent, ...props }) => <UIComponent {...props} {...runtime.state} />
}))

import { WebsocketStatus, RECONNECT_GRACE_MS, NOTICE_GRACE_MS } from '../WebsocketStatus'
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names these tests look up changed.

const CONNECTION_LOST = 'Connection lost. The list may be out of date; it refreshes when the connection is back.'

const setState = (state) => { runtime.state = { connectedDate: '2026-10-05T09:30:00Z', isConnectionDegraded: false, ...state } }

describe('WebsocketStatus UI · live indicator', () => {
  beforeEach(() => { setState({ socketStatus: 1 }) })
  afterEach(() => { document.getElementById('app-modals')?.remove() })

  it('connected: a quiet button that says Live, announced as a status', () => {
    render(<WebsocketStatus />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Live')
    expect(within(status).getByRole('button', { name: 'Live' })).toHaveAttribute('aria-haspopup', 'dialog')
    expect(status).toHaveAttribute('data-state', 'live')
    expect(screen.queryByText('Connection')).not.toBeInTheDocument()
  })

  it('connecting: says Connecting', () => {
    setState({ socketStatus: 0 })
    render(<WebsocketStatus />)
    expect(screen.getByRole('status')).toHaveTextContent('Connecting')
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'connecting')
  })

  // redesign F6d (D-21): a socket that was connected and drops says it at once; one that never connected waits (see below).
  it('disconnected: says Reconnecting… with the off icon, never a bare color', () => {
    setState({ socketStatus: 1 })
    const { container, rerender } = render(<WebsocketStatus />)
    setState({ socketStatus: 2 })
    rerender(<WebsocketStatus />)
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…')
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'off')
    expect(container.querySelector('svg.odc-icon')).toBeInTheDocument()
  })

  it('degraded reads the same as disconnected', () => {
    setState({ socketStatus: 1, isConnectionDegraded: true })
    render(<WebsocketStatus />)
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…')
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'off')
  })

  it('has no motion or color literal of its own: state lives in a data attribute', () => {
    const { container } = render(<WebsocketStatus />)
    expect(container.querySelector('[style]')).toBeNull()
  })
})

describe('WebsocketStatus UI · detail dialog', () => {
  afterEach(() => { document.getElementById('app-modals')?.remove() })

  const open = async (state, from) => {
    const user = userEvent.setup()
    if (from !== undefined) {
      setState({ socketStatus: from })
      const { rerender } = render(<WebsocketStatus />)
      setState(state)
      rerender(<WebsocketStatus />)
    } else {
      setState(state)
      render(<WebsocketStatus />)
    }
    await user.click(screen.getByRole('button', { name: /Live|Connecting|Reconnecting/ }))
    return { user, dialog: await screen.findByRole('dialog', { name: 'Connection status' }) }
  }

  // parity audit 2 (B6): main's dialog explained the three states (STATUS_ITEMS); the redesign had dropped them.
  it('lists the three states with their label and what each means, as main did', async () => {
    const { dialog } = await open({ socketStatus: 1 })
    const legend = within(dialog).getByRole('list')
    const items = within(legend).getAllByRole('listitem')
    expect(items.map(item => item.textContent)).toEqual([
      'OkThe websocket works normally.',
      'ConnectingThe websocket is connecting.',
      // redesign fix-qa: the legend's «Disconnected» agrees with the in-line notice (main said «The server is slow»).
      'DisconnectedLive updates are paused until the connection is back.'
    ])
  })

  it.each([
    [1, 'Ok'],
    [0, 'Connecting'],
    [2, 'Disconnected']
  ])('socket status %i marks only %s as the current state', async (socketStatus, current) => {
    // redesign F6d (D-21): «disconnected» is only drawn as such after a connection (or the grace), so it comes from a connected state
    const { dialog } = await open({ socketStatus }, socketStatus === 2 ? 1 : undefined)
    const items = within(within(dialog).getByRole('list')).getAllByRole('listitem')
    expect(items.filter(item => item.getAttribute('aria-current') === 'true').map(item => item.firstChild.textContent)).toEqual([current])
  })

  it('a degraded connection marks Disconnected as the current state', async () => {
    const { dialog } = await open({ socketStatus: 1, isConnectionDegraded: true })
    const items = within(within(dialog).getByRole('list')).getAllByRole('listitem')
    expect(items.filter(item => item.getAttribute('aria-current') === 'true').map(item => item.firstChild.textContent)).toEqual(['Disconnected'])
  })

  it('every legend state has an icon or dot of its own, never only a color', async () => {
    const { dialog } = await open({ socketStatus: 1 })
    const items = within(within(dialog).getByRole('list')).getAllByRole('listitem')
    expect(items.map(item => item.getAttribute('data-status'))).toEqual(['live', 'connecting', 'off'])
    items.forEach(item => expect(item.querySelector('.odc-live-dot, svg.odc-icon')).not.toBeNull())
    expect(items[2].querySelector('svg.odc-icon')).not.toBeNull()
  })

  it('the lead sentence is not repeated: connected and connecting leave it to the legend', async () => {
    const connected = await open({ socketStatus: 1 })
    expect(within(connected.dialog).getAllByText('The websocket works normally.')).toHaveLength(1)
  })

  // redesign 5.2 audit-1: the lead sentence of the dialog repeats the in-line notice. The legend below it is the
  // generic explanation of each state (main's wording), so it does not count as a wording for the current one.
  it('disconnected leads with what the in-line notice says', async () => {
    const { dialog } = await open({ socketStatus: 2 }, 1)
    expect(within(dialog).getByText(CONNECTION_LOST)).toBeInTheDocument()
    expect(dialog).toHaveAccessibleDescription(CONNECTION_LOST)
  })

  it('shows the last update and the explanation once', async () => {
    const { dialog } = await open({ socketStatus: 1 })
    expect(within(dialog).getByText('Last update: parsed(2026-10-05T09:30:00Z)')).toBeInTheDocument()
    expect(within(dialog).getAllByText(/Check the server connection by date and time/)).toHaveLength(1)
  })

  it('does not show troubleshooting unless the connection is degraded', async () => {
    const { dialog } = await open({ socketStatus: 2 })
    expect(within(dialog).queryByText('Troubleshooting')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Customer support' })).not.toBeInTheDocument()
  })

  it('degraded: troubleshooting block, and Customer support goes to the support page', async () => {
    const { user, dialog } = await open({ socketStatus: 2, isConnectionDegraded: true })
    expect(within(dialog).getByText('Troubleshooting')).toBeInTheDocument()
    expect(within(dialog).getByText(/Real-time updates are unavailable/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Customer support' }))
    expect(runtime.emit).toHaveBeenCalledWith('go_to_page', { page: 'support' })
  })

  it('footer has Close and Update; Close dismisses and returns the focus to the live button', async () => {
    const { user, dialog } = await open({ socketStatus: 1 })
    const footerClose = within(dialog).getAllByRole('button', { name: 'Close' }).at(-1)
    expect(within(dialog).getByRole('button', { name: 'Update' })).toBeInTheDocument()
    await user.click(footerClose)
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Live' })).toHaveFocus()
  })

  it('Update reloads the page, like before', async () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
    try {
      const { user, dialog } = await open({ socketStatus: 1 })
      await user.click(within(dialog).getByRole('button', { name: 'Update' }))
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })
})

describe('WebsocketStatus UI · renderNotice', () => {
  beforeEach(() => { runtime.emit.mockClear() })

  it('hands the page a warning notice only while disconnected', () => {
    const renderNotice = vi.fn(notice => <div data-testid='slot'>{notice}</div>)
    setState({ socketStatus: 1 })
    const { rerender } = render(<WebsocketStatus renderNotice={renderNotice} />)
    expect(renderNotice).not.toHaveBeenCalled()
    expect(screen.queryByTestId('slot')).not.toBeInTheDocument()

    setState({ socketStatus: 2 })
    rerender(<WebsocketStatus renderNotice={renderNotice} />)
    const slot = screen.getByTestId('slot')
    const notice = within(slot).getByText(/Connection lost\. The list may be out of date/)
    expect(notice.closest('[data-tone]')).toHaveAttribute('data-tone', 'warning')
    expect(within(slot).getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('the notice Update button reloads the page', async () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
    try {
      // redesign F6c (D-20): a socket that never connected says nothing until its grace is over; the notice here is a lost connection.
      setState({ socketStatus: 1 })
      const { rerender } = render(<WebsocketStatus renderNotice={notice => <div data-testid='slot'>{notice}</div>} />)
      setState({ socketStatus: 2 })
      rerender(<WebsocketStatus renderNotice={notice => <div data-testid='slot'>{notice}</div>} />)
      await userEvent.setup().click(within(screen.getByTestId('slot')).getByRole('button', { name: 'Update' }))
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })

  it('without renderNotice nothing extra is drawn (other screens)', () => {
    setState({ socketStatus: 2 })
    render(<WebsocketStatus />)
    expect(screen.queryByText(/Connection lost/)).not.toBeInTheDocument()
  })
})

// redesign 5.2 audit-1 (FC): a socket that never connects is shown as offline after the grace period,
// and the pill, the dialog and the in-line notice say the same thing for the same state.
describe('WebsocketStatus UI · grace period before connecting reads as offline', () => {
  const slot = notice => <div data-testid='slot'>{notice}</div>

  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    vi.useRealTimers()
    document.getElementById('app-modals')?.remove()
  })

  // The in-line notice is a status too, so the pill is found by its own class.
  const pill = () => document.querySelector('.odc-live')
  const advance = ms => act(() => { vi.advanceTimersByTime(ms) })

  it('the grace period is 10 seconds', () => {
    expect(RECONNECT_GRACE_MS).toBe(10000)
  })

  it('stays Connecting, with no notice, until the grace period ends', () => {
    setState({ socketStatus: 0 })
    render(<WebsocketStatus renderNotice={slot} />)
    advance(RECONNECT_GRACE_MS - 1)
    expect(pill()).toHaveAttribute('data-state', 'connecting')
    expect(pill()).toHaveTextContent('Connecting')
    expect(screen.queryByTestId('slot')).not.toBeInTheDocument()
  })

  it('past the grace period it reads as offline: pill, icon and the same in-line notice as disconnected', () => {
    setState({ socketStatus: 0 })
    const { container } = render(<WebsocketStatus renderNotice={slot} />)
    advance(RECONNECT_GRACE_MS)
    expect(pill()).toHaveAttribute('data-state', 'off')
    expect(pill()).toHaveTextContent('Reconnecting…')
    expect(container.querySelector('svg.odc-icon')).toBeInTheDocument()
    const notice = within(screen.getByTestId('slot')).getByText(CONNECTION_LOST)
    expect(notice.closest('[data-tone]')).toHaveAttribute('data-tone', 'warning')
    expect(within(screen.getByTestId('slot')).getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('connecting that connects in time never goes offline, and a later connecting restarts nothing once connected', () => {
    setState({ socketStatus: 0 })
    const { rerender } = render(<WebsocketStatus renderNotice={slot} />)
    advance(RECONNECT_GRACE_MS - 1000)
    setState({ socketStatus: 1 })
    rerender(<WebsocketStatus renderNotice={slot} />)
    advance(RECONNECT_GRACE_MS * 2)
    expect(pill()).toHaveAttribute('data-state', 'live')
    expect(screen.queryByTestId('slot')).not.toBeInTheDocument()
  })

  it('connected after being offline goes back to Live and the notice goes away', () => {
    setState({ socketStatus: 0 })
    const { rerender } = render(<WebsocketStatus renderNotice={slot} />)
    advance(RECONNECT_GRACE_MS)
    expect(screen.getByTestId('slot')).toBeInTheDocument()
    setState({ socketStatus: 1 })
    rerender(<WebsocketStatus renderNotice={slot} />)
    expect(pill()).toHaveAttribute('data-state', 'live')
    expect(screen.queryByTestId('slot')).not.toBeInTheDocument()
  })

  it('a new connecting stretch after a connection gets its own grace period', () => {
    setState({ socketStatus: 1 })
    const { rerender } = render(<WebsocketStatus renderNotice={slot} />)
    advance(RECONNECT_GRACE_MS * 3)
    setState({ socketStatus: 0 })
    rerender(<WebsocketStatus renderNotice={slot} />)
    expect(pill()).toHaveAttribute('data-state', 'connecting')
    advance(RECONNECT_GRACE_MS)
    expect(pill()).toHaveAttribute('data-state', 'off')
  })

  it('the dialog leads with the pill label and, offline, the in-line notice; the legend marks Disconnected', async () => {
    setState({ socketStatus: 0 })
    render(<WebsocketStatus renderNotice={slot} />)
    advance(RECONNECT_GRACE_MS)
    vi.useRealTimers()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reconnecting…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Connection status' })
    expect(within(dialog).getByText('Reconnecting…')).toBeInTheDocument()
    expect(within(dialog).getByText(CONNECTION_LOST)).toBeInTheDocument()
    const current = within(within(dialog).getByRole('list')).getAllByRole('listitem').filter(item => item.getAttribute('aria-current') === 'true')
    expect(current.map(item => item.getAttribute('data-status'))).toEqual(['off'])
  })
})

// redesign F6c (D-20): the socket starts «disconnected» before it binds, so on load the page notice flashed for a second.
// The notice waits NOTICE_GRACE_MS when the socket has not been connected yet; once it has been, a loss shows at once.
describe('WebsocketStatus UI · the connection notice does not flash on load (D-20)', () => {
  const slot = notice => <div data-testid='slot'>{notice}</div>

  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  const advance = ms => act(() => { vi.advanceTimersByTime(ms) })

  it('the grace of the notice is 3 seconds, shorter than the 10 of «connecting»', () => {
    expect(NOTICE_GRACE_MS).toBe(3000)
    expect(NOTICE_GRACE_MS).toBeLessThan(RECONNECT_GRACE_MS)
  })

  it('a socket that starts disconnected shows no notice for the first seconds, and then it does', () => {
    setState({ socketStatus: 2 })
    render(<WebsocketStatus renderNotice={slot} />)
    expect(screen.queryByTestId('slot')).not.toBeInTheDocument()
    advance(NOTICE_GRACE_MS - 1)
    expect(screen.queryByTestId('slot')).not.toBeInTheDocument()
    advance(1)
    expect(within(screen.getByTestId('slot')).getByText(CONNECTION_LOST)).toBeInTheDocument()
  })

  it('a socket that connects within the grace never shows it', () => {
    setState({ socketStatus: 2 })
    const { rerender } = render(<WebsocketStatus renderNotice={slot} />)
    advance(1000)
    setState({ socketStatus: 1 })
    rerender(<WebsocketStatus renderNotice={slot} />)
    advance(NOTICE_GRACE_MS * 3)
    expect(screen.queryByTestId('slot')).not.toBeInTheDocument()
  })

  it('a connection that was there and drops shows the notice at once', () => {
    setState({ socketStatus: 1 })
    const { rerender } = render(<WebsocketStatus renderNotice={slot} />)
    setState({ socketStatus: 2 })
    rerender(<WebsocketStatus renderNotice={slot} />)
    expect(screen.getByTestId('slot')).toBeInTheDocument()
  })

  it('keeps the live region of the pill while the notice waits', () => {
    setState({ socketStatus: 2 })
    render(<WebsocketStatus renderNotice={slot} />)
    expect(document.querySelector('.odc-live')).toHaveAttribute('role', 'status')
  })

  it('once the socket has connected, a later loss never waits again', () => {
    setState({ socketStatus: 2 })
    const { rerender } = render(<WebsocketStatus renderNotice={slot} />)
    advance(NOTICE_GRACE_MS)
    setState({ socketStatus: 1 })
    rerender(<WebsocketStatus renderNotice={slot} />)
    expect(screen.queryByTestId('slot')).not.toBeInTheDocument()
    setState({ socketStatus: 2 })
    rerender(<WebsocketStatus renderNotice={slot} />)
    expect(screen.getByTestId('slot')).toBeInTheDocument()
  })
})

// redesign F6d (D-21): the pill used to say «Reconnecting…» from the first frame, before the socket had bound. It takes the
// same grace as the page notice: until the socket has connected once or NOTICE_GRACE_MS has passed it reads as «Connecting».
describe('WebsocketStatus UI · the pill does not say Reconnecting on load (D-21)', () => {
  const slot = notice => <div data-testid='slot'>{notice}</div>

  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  const pill = () => document.querySelector('.odc-live')
  const advance = ms => act(() => { vi.advanceTimersByTime(ms) })

  it('a socket that starts disconnected is drawn as Connecting, with the same grace as the notice, and then as offline', () => {
    setState({ socketStatus: 2 })
    render(<WebsocketStatus renderNotice={slot} />)
    expect(pill()).toHaveAttribute('data-state', 'connecting')
    expect(pill()).toHaveTextContent('Connecting')
    expect(pill()).not.toHaveTextContent('Reconnecting')
    advance(NOTICE_GRACE_MS - 1)
    expect(pill()).toHaveAttribute('data-state', 'connecting')
    advance(1)
    expect(pill()).toHaveAttribute('data-state', 'off')
    expect(pill()).toHaveTextContent('Reconnecting…')
    expect(screen.getByTestId('slot')).toBeInTheDocument()
  })

  it('never says Reconnecting when the socket connects inside the grace', () => {
    setState({ socketStatus: 2 })
    const { rerender } = render(<WebsocketStatus renderNotice={slot} />)
    advance(1000)
    setState({ socketStatus: 1 })
    rerender(<WebsocketStatus renderNotice={slot} />)
    advance(NOTICE_GRACE_MS * 3)
    expect(pill()).toHaveAttribute('data-state', 'live')
  })

  it('a connection that was there and drops reads as offline at once (no grace)', () => {
    setState({ socketStatus: 1 })
    const { rerender } = render(<WebsocketStatus renderNotice={slot} />)
    setState({ socketStatus: 2 })
    rerender(<WebsocketStatus renderNotice={slot} />)
    expect(pill()).toHaveAttribute('data-state', 'off')
  })

  it('a degraded connection is real, so it does not wait', () => {
    setState({ socketStatus: 2, isConnectionDegraded: true })
    render(<WebsocketStatus renderNotice={slot} />)
    expect(pill()).toHaveAttribute('data-state', 'off')
  })

  it('the pill keeps its title and its name, so when the head shrinks it to the mark it is still named', () => {
    setState({ socketStatus: 1 })
    render(<WebsocketStatus />)
    const button = within(pill()).getByRole('button', { name: 'Live' })
    expect(button).toHaveAttribute('title', 'Live')
  })
})
