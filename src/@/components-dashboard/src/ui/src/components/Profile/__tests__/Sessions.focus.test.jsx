import React, { useState } from 'react'
import moment from 'moment'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// redesign (review r1: F1, F2, F3): where the keyboard focus lands after an action of the sessions card, the
// count a closing dialog keeps, and which control shows that it is working.
const state = vi.hoisted(() => ({ user: { id: 7, level: 0, session_strategy: 'jwt_session' } }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: state.user }],
  useUtils: () => [{ parseDate: (value) => moment.utc(value, 'YYYY-MM-DD HH:mm:ss').format('DD MMM YYYY hh:mm A') }],
  Sessions: () => null
}))

vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback]
}))

import { SessionsUI } from '../Sessions'

const FORMAT_IN = 'YYYY-MM-DD HH:mm:ss'
// ids go up with the date: on screen the newest (highest id) comes first
const makeSessions = (count, { current = 0 } = {}) => Array.from({ length: count }, (_, index) => ({
  id: index + 1,
  created_at: moment.utc('2026-10-01 02:00:00', FORMAT_IN).add(index, 'minutes').format(FORMAT_IN),
  valid_thru: moment.utc('2027-10-01 02:00:00', FORMAT_IN).add(index, 'minutes').format(FORMAT_IN),
  current: index === current
}))

const baseProps = (overrides = {}) => ({
  sessionsList: { sessions: makeSessions(4), loading: false, error: null },
  actionState: { loading: false, error: null },
  handleDeleteSession: vi.fn(),
  handleDeleteAllSessions: vi.fn(),
  handleReloadSessions: vi.fn(),
  ...overrides
})

// (4): stands in for the Sessions controller. Like components/Sessions/index.js, an action goes busy in the
// same click that confirms it, so the card never sees «dialog closed, nothing running» before the request starts.
// Rerendering `loading: true` after the click left that gap open: when the dialog finished leaving first, the card put the
// focus on the ✕ of the row that was about to go, and the focus fell to <body> (failed 1/20 under load).
const renderWithController = (props) => {
  const controller = {}
  const Harness = () => {
    const [sessionsList, setSessionsList] = useState(props.sessionsList)
    const [actionState, setActionState] = useState(props.actionState)
    const goBusy = () => setActionState({ loading: true, error: null })
    controller.finish = (sessions) => {
      setSessionsList({ sessions, loading: false, error: null })
      setActionState({ loading: false, error: null })
    }
    return (
      <SessionsUI
        {...props}
        sessionsList={sessionsList}
        actionState={actionState}
        handleDeleteSession={(session) => { props.handleDeleteSession(session); goBusy() }}
        handleDeleteAllSessions={(all) => { props.handleDeleteAllSessions(all); goBusy() }}
      />
    )
  }
  render(<Harness />)
  return controller
}

const closeButtons = () => screen.getAllByRole('button', { name: /^Log out (the session started|this browser)/ })
const noDialog = () => expect(screen.queryByRole('alertdialog')).toBeNull()

beforeEach(() => {
  state.user = { id: 7, level: 0, session_strategy: 'jwt_session' }
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('Sessions card · focus after an action (F1)', () => {
  it('after signing out a session, the focus goes to the ✕ of the row that takes its place', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const controller = renderWithController(props)
    // rows: ids 4, 3, 2, 1 (1 is current). Log out the second row (id 3)
    await user.click(closeButtons()[1])
    await user.click(await screen.findByRole('button', { name: 'Log out session' }))
    expect(props.handleDeleteSession).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }))
    const remaining = props.sessionsList.sessions.filter(session => session.id !== 3)
    act(() => controller.finish(remaining))
    await waitFor(noDialog)
    await waitFor(() => expect(document.activeElement).toBe(closeButtons()[1]))
    expect(document.activeElement.getAttribute('aria-label')).toContain('02:01')
  })

  it('after signing out the last row of the list, the focus goes to the new last ✕', async () => {
    const user = userEvent.setup()
    const props = baseProps({ sessionsList: { sessions: makeSessions(3, { current: 2 }), loading: false, error: null } })
    const controller = renderWithController(props)
    // rows: ids 3 (current), 2, 1. Log out the last one (id 1)
    await user.click(closeButtons()[2])
    await user.click(await screen.findByRole('button', { name: 'Log out session' }))
    // a slow request: the dialog is gone and a few frames pass before the answer (the order that failed under load)
    await waitFor(noDialog)
    await act(() => new Promise(resolve => setTimeout(resolve, 100)))
    const remaining = props.sessionsList.sessions.filter(session => session.id !== 1)
    act(() => controller.finish(remaining))
    await waitFor(() => expect(document.activeElement).toBe(closeButtons()[1]))
  })

  it('after «Log out other sessions», the focus goes to the card heading', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const controller = renderWithController(props)
    await user.click(screen.getByRole('button', { name: 'Log out other sessions' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(screen.getAllByRole('button', { name: 'Log out other sessions' }).find(button => dialog.contains(button)))
    const onlyCurrent = props.sessionsList.sessions.filter(session => session.current)
    act(() => controller.finish(onlyCurrent))
    await waitFor(noDialog)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Sessions' })))
  })

  it('after «Try again» loads, the focus goes to the card heading', async () => {
    const user = userEvent.setup()
    const props = baseProps({ sessionsList: { sessions: [], loading: false, error: ['Network error'] } })
    const { rerender } = render(<SessionsUI {...props} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.handleReloadSessions).toHaveBeenCalledTimes(1)
    rerender(<SessionsUI {...props} sessionsList={{ sessions: [], loading: true, error: null }} />)
    rerender(<SessionsUI {...props} sessionsList={{ sessions: makeSessions(2), loading: false, error: null }} />)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Sessions' })))
  })
})

describe('Sessions card · the dialog keeps its count while it closes (F2)', () => {
  it('the «other sessions» title keeps the count it opened with', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const { rerender } = render(<SessionsUI {...props} />)
    await user.click(screen.getByRole('button', { name: 'Log out other sessions' }))
    expect(await screen.findByRole('alertdialog', { name: 'Log out 3 other sessions?' })).toBeInTheDocument()
    const onlyCurrent = props.sessionsList.sessions.filter(session => session.current)
    rerender(<SessionsUI {...props} sessionsList={{ sessions: onlyCurrent, loading: false, error: null }} />)
    expect(screen.getByRole('alertdialog', { name: 'Log out 3 other sessions?' })).toBeInTheDocument()
  })
})

describe('Sessions card · only the running action says it is working (F3)', () => {
  it('signing out one session marks its ✕, not the group buttons', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const { rerender } = render(<SessionsUI {...props} />)
    await user.click(closeButtons()[1])
    await user.click(await screen.findByRole('button', { name: 'Log out session' }))
    rerender(<SessionsUI {...props} actionState={{ loading: true, error: null }} />)
    expect(screen.getByRole('button', { name: 'Log out everywhere' })).not.toHaveAttribute('aria-busy')
    expect(screen.getByRole('button', { name: 'Log out other sessions' })).not.toHaveAttribute('aria-busy')
    expect(closeButtons()[1]).toHaveAttribute('aria-busy', 'true')
    expect(closeButtons()[0]).not.toHaveAttribute('aria-busy')
    // every control still waits: nothing else can start meanwhile
    closeButtons().forEach(button => expect(button).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Log out everywhere' })).toBeDisabled()
  })

  it('«Log out other sessions» marks only its own button', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const { rerender } = render(<SessionsUI {...props} />)
    await user.click(screen.getByRole('button', { name: 'Log out other sessions' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(screen.getAllByRole('button', { name: 'Log out other sessions' }).find(button => dialog.contains(button)))
    rerender(<SessionsUI {...props} actionState={{ loading: true, error: null }} />)
    await waitFor(noDialog)
    expect(screen.getByRole('button', { name: 'Log out other sessions' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Log out everywhere' })).not.toHaveAttribute('aria-busy')
  })
})
