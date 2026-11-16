import React from 'react'
import moment from 'moment'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// redesign (B2): the sessions card of /profile. The controller is outside this file: the UI is rendered with the
// props the controller gives it. `parseDate` formats for real (a fixed UTC format), so a date that reaches the screen is a
// date that was formatted, and it honours `outputFormat` as the project's one does.
const state = vi.hoisted(() => ({ user: { id: 7, level: 0, session_strategy: 'jwt_session' }, controllerProps: null }))
const parseDateSpy = vi.hoisted(() => vi.fn())

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: state.user }],
  useUtils: () => [{ parseDate: parseDateSpy }],
  Sessions: (props) => {
    state.controllerProps = props
    return null
  }
}))

vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback]
}))

import { Sessions, SessionsUI } from '../Sessions'

const FORMAT_IN = 'YYYY-MM-DD HH:mm:ss'

// ids go up with the date, so the newest session is the last one of the array: the list has to turn it around
const makeSessions = (count, { current = 0 } = {}) => Array.from({ length: count }, (_, index) => ({
  id: index + 1,
  created_at: moment.utc('2026-10-01 02:00:00', FORMAT_IN).add(index, 'minutes').format(FORMAT_IN),
  valid_thru: moment.utc('2027-10-01 02:00:00', FORMAT_IN).add(index, 'minutes').format(FORMAT_IN),
  current: index === current
}))

const shown = (value) => moment.utc(value, FORMAT_IN).format('DD MMM YYYY hh:mm A')

const setup = (overrides = {}) => {
  const props = {
    sessionsList: { sessions: makeSessions(3), loading: false, error: null },
    actionState: { loading: false, error: null },
    handleDeleteSession: vi.fn(),
    handleDeleteAllSessions: vi.fn(),
    handleReloadSessions: vi.fn(),
    ...overrides
  }
  const view = render(<SessionsUI {...props} />)
  return { props, user: userEvent.setup(), ...view }
}

const rows = (container) => Array.from(container.querySelectorAll("[data-slot='profile-session']"))
const rowIds = (container, sessions) => rows(container).map(row => {
  const started = row.querySelector('time').getAttribute('datetime')
  return sessions.find(session => session.created_at === started).id
})

beforeEach(() => {
  state.user = { id: 7, level: 0, session_strategy: 'jwt_session' }
  state.controllerProps = null
  parseDateSpy.mockReset()
  parseDateSpy.mockImplementation((value, options = {}) => (
    options.outputFormat
      ? moment.utc(value, FORMAT_IN).format(options.outputFormat)
      : shown(value)
  ))
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('Sessions card · list (D2 A)', () => {
  it('shows the total as a figure with its plural and the sessions from the newest to the oldest', () => {
    const sessions = makeSessions(3)
    const { container } = setup({ sessionsList: { sessions, loading: false, error: null } })
    expect(screen.getByRole('heading', { level: 2, name: 'Sessions' })).toBeInTheDocument()
    const summary = container.querySelector('.odc-profile-summary')
    expect(summary.querySelector('.odc-figure').textContent).toBe('3')
    expect(summary).toHaveTextContent('3 signed-in sessions')
    expect(rowIds(container, sessions)).toEqual([3, 2, 1])
  })

  it('says «signed-in session» for one', () => {
    const { container } = setup({ sessionsList: { sessions: makeSessions(1), loading: false, error: null } })
    expect(container.querySelector('.odc-profile-summary')).toHaveTextContent('1 signed-in session')
    expect(container.querySelector('.odc-profile-summary')).not.toHaveTextContent('sessions')
  })

  it('never mutates the array the controller gave (PF-05)', () => {
    const sessions = makeSessions(5)
    const before = [...sessions]
    setup({ sessionsList: { sessions, loading: false, error: null } })
    expect(sessions).toEqual(before)
    expect(sessions.map(session => session.id)).toEqual([1, 2, 3, 4, 5])
  })

  it('labels Started and Expires and formats each date with parseDate and no outputFormat (PF-01)', () => {
    const sessions = makeSessions(1)
    const { container } = setup({ sessionsList: { sessions, loading: false, error: null } })
    const row = rows(container)[0]
    expect(within(row).getByText('Started')).toBeInTheDocument()
    expect(within(row).getByText('Expires')).toBeInTheDocument()
    const times = row.querySelectorAll('time.odc-figure')
    expect(times).toHaveLength(2)
    expect(times[0]).toHaveTextContent(shown(sessions[0].created_at))
    expect(times[0]).toHaveAttribute('datetime', sessions[0].created_at)
    expect(times[1]).toHaveTextContent(shown(sessions[0].valid_thru))
    expect(parseDateSpy.mock.calls.length).toBeGreaterThan(0)
    for (const [, options] of parseDateSpy.mock.calls) expect(options?.outputFormat).toBeUndefined()
    // main painted MM/DD/YY · hh:mm A here
    expect(container).not.toHaveTextContent('·')
  })

  it('marks the current session with «This browser»', () => {
    const { container } = setup({ sessionsList: { sessions: makeSessions(3, { current: 1 }), loading: false, error: null } })
    const marked = container.querySelectorAll("[data-slot='profile-session'][data-current='true']")
    expect(marked).toHaveLength(1)
    expect(within(marked[0]).getByText('This browser')).toBeInTheDocument()
    expect(screen.getAllByText('This browser')).toHaveLength(1)
  })

  it('names each sign-out button with the date of its session', () => {
    const sessions = makeSessions(2)
    setup({ sessionsList: { sessions, loading: false, error: null } })
    expect(screen.getByRole('button', { name: `Log out the session started ${shown(sessions[1].created_at)}` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Log out this browser (session started ${shown(sessions[0].created_at)})` })).toBeInTheDocument()
  })

  // (b): the name of a ✕ is how a screen reader tells the rows apart
  it('says the ✕ of the current session is this browser, and does not repeat the name of another', () => {
    const sessions = makeSessions(3, { current: 1 })
    setup({ sessionsList: { sessions, loading: false, error: null } })
    expect(screen.getByRole('button', { name: `Log out this browser (session started ${shown(sessions[1].created_at)})` })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Log out the session started/ })).toHaveLength(2)
  })

  it('gives sessions that started in the same minute different names, by their place in the list', () => {
    const base = moment.utc('2026-10-20 18:43:05', FORMAT_IN)
    const sessions = [
      { id: 1, created_at: base.format(FORMAT_IN), valid_thru: '2027-10-20 18:43:05', current: false },
      { id: 2, created_at: base.clone().add(20, 'seconds').format(FORMAT_IN), valid_thru: '2027-10-20 18:43:25', current: false },
      { id: 3, created_at: base.clone().add(40, 'seconds').format(FORMAT_IN), valid_thru: '2027-10-20 18:43:45', current: true },
      { id: 4, created_at: base.clone().add(5, 'minutes').format(FORMAT_IN), valid_thru: '2027-10-20 18:48:05', current: false }
    ]
    const { container } = setup({ sessionsList: { sessions, loading: false, error: null } })
    const names = Array.from(container.querySelectorAll("[data-slot='profile-session'] button")).map(button => button.getAttribute('aria-label'))
    expect(new Set(names).size).toBe(4)
    const minute = shown(sessions[0].created_at)
    // newest first: 4 (alone in its minute), 3 (this browser), 2, 1
    expect(names[0]).toBe(`Log out the session started ${shown(sessions[3].created_at)}`)
    expect(names[1]).toBe(`Log out this browser (session started ${minute})`)
    expect(names[2]).toBe(`Log out the session started ${minute} (session 3 of 4)`)
    expect(names[3]).toBe(`Log out the session started ${minute} (session 4 of 4)`)
  })
})

describe('Sessions card · pages', () => {
  it('paints nothing of the list for 0 sessions: the empty text of main', () => {
    const { container } = setup({ sessionsList: { sessions: [], loading: false, error: null } })
    expect(screen.getByText("You don't have any sessions")).toBeInTheDocument()
    expect(rows(container)).toHaveLength(0)
    expect(screen.queryByRole('navigation', { name: 'Sessions pages' })).toBeNull()
  })

  it('shows 10 rows for 10 sessions and 10 plus one on the second page for 11', async () => {
    const ten = setup({ sessionsList: { sessions: makeSessions(10), loading: false, error: null } })
    expect(rows(ten.container)).toHaveLength(10)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    ten.unmount()

    const sessions = makeSessions(11)
    const { container, user } = setup({ sessionsList: { sessions, loading: false, error: null } })
    expect(rows(container)).toHaveLength(10)
    expect(rowIds(container, sessions)[0]).toBe(11)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(rows(container)).toHaveLength(1)
    expect(rowIds(container, sessions)).toEqual([1])
  })

  it('shows 10 rows, then 2 on the second page for 12 sessions, with the range in figures', async () => {
    const { container, user } = setup({ sessionsList: { sessions: makeSessions(12), loading: false, error: null } })
    const nav = screen.getByRole('navigation', { name: 'Sessions pages' })
    expect(nav).toHaveTextContent('1–10 of 12')
    expect(nav.querySelectorAll('.odc-figure').length).toBeGreaterThanOrEqual(3)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(rows(container)).toHaveLength(2)
    expect(nav).toHaveTextContent('11–12 of 12')
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(rows(container)).toHaveLength(10)
  })

  it('has a page field, so the oldest of 612 does not cost 61 clicks', () => {
    setup({ sessionsList: { sessions: makeSessions(612), loading: false, error: null } })
    expect(screen.getByRole('textbox', { name: 'Page' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Sessions pages' })).toHaveTextContent('1–10 of 612')
  })

  it('goes down to the last page that exists when closing sessions empties the page', async () => {
    const eleven = makeSessions(11)
    const props = {
      sessionsList: { sessions: eleven, loading: false, error: null },
      actionState: { loading: false, error: null },
      handleDeleteSession: vi.fn(),
      handleDeleteAllSessions: vi.fn(),
      handleReloadSessions: vi.fn()
    }
    const user = userEvent.setup()
    const { container, rerender } = render(<SessionsUI {...props} />)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(rows(container)).toHaveLength(1)
    rerender(<SessionsUI {...props} sessionsList={{ sessions: eleven.slice(1), loading: false, error: null }} />)
    expect(rows(container)).toHaveLength(10)
    expect(screen.getByRole('navigation', { name: 'Sessions pages' })).toHaveTextContent('1–10 of 10')
  })
})

describe('Sessions card · confirmations (D4)', () => {
  it('closing another session says what ends and calls handleDeleteSession(session) on accept', async () => {
    const sessions = makeSessions(3)
    const { props, user, container } = setup({ sessionsList: { sessions, loading: false, error: null } })
    const target = sessions[1]
    await user.click(screen.getByRole('button', { name: `Log out the session started ${shown(target.created_at)}` }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Log out this session?' })
    expect(dialog).toHaveTextContent(`The session that started on ${shown(target.created_at)} ends now. Anyone using it has to sign in again.`)
    await user.click(within(dialog).getByRole('button', { name: 'Log out session' }))
    expect(props.handleDeleteSession).toHaveBeenCalledTimes(1)
    expect(props.handleDeleteSession).toHaveBeenCalledWith(target)
    expect(props.handleDeleteAllSessions).not.toHaveBeenCalled()
    // closes on accept, as in main
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(rows(container)).toHaveLength(3)
  })

  it('closing the current session says it is this browser and calls handleDeleteSession(session)', async () => {
    const sessions = makeSessions(3, { current: 2 })
    const { props, user } = setup({ sessionsList: { sessions, loading: false, error: null } })
    await user.click(screen.getByRole('button', { name: `Log out this browser (session started ${shown(sessions[2].created_at)})` }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Log out this browser?' })
    expect(dialog).toHaveTextContent('This is the session you are using. You will go back to the sign-in page.')
    await user.click(within(dialog).getByRole('button', { name: 'Log out' }))
    expect(props.handleDeleteSession).toHaveBeenCalledWith(sessions[2])
    expect(props.handleDeleteSession).toHaveBeenCalledTimes(1)
  })

  it('«Log out other sessions» counts the others and calls handleDeleteAllSessions(false)', async () => {
    const { props, user } = setup({ sessionsList: { sessions: makeSessions(4), loading: false, error: null } })
    await user.click(screen.getByRole('button', { name: 'Log out other sessions' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Log out 3 other sessions?' })
    expect(dialog).toHaveTextContent('You stay signed in here.')
    await user.click(within(dialog).getByRole('button', { name: 'Log out other sessions' }))
    expect(props.handleDeleteAllSessions).toHaveBeenCalledTimes(1)
    expect(props.handleDeleteAllSessions).toHaveBeenCalledWith(false)
  })

  it('counts the others, not N - 1, when the current session is not in the list', async () => {
    const sessions = makeSessions(3).map(session => ({ ...session, current: false }))
    const { user } = setup({ sessionsList: { sessions, loading: false, error: null } })
    await user.click(screen.getByRole('button', { name: 'Log out other sessions' }))
    expect(await screen.findByRole('alertdialog', { name: 'Log out 3 other sessions?' })).toBeInTheDocument()
  })

  it('says «1 other session» in the singular', async () => {
    const { user } = setup({ sessionsList: { sessions: makeSessions(2), loading: false, error: null } })
    await user.click(screen.getByRole('button', { name: 'Log out other sessions' }))
    expect(await screen.findByRole('alertdialog', { name: 'Log out 1 other session?' })).toBeInTheDocument()
  })

  it('«Log out everywhere» warns about this browser and calls handleDeleteAllSessions(true)', async () => {
    const { props, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Log out everywhere' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Log out everywhere?' })
    expect(dialog).toHaveTextContent('All your sessions end, this one too. You will go back to the sign-in page.')
    await user.click(within(dialog).getByRole('button', { name: 'Log out everywhere' }))
    expect(props.handleDeleteAllSessions).toHaveBeenCalledTimes(1)
    expect(props.handleDeleteAllSessions).toHaveBeenCalledWith(true)
  })

  it('starts the focus on Cancel, and Cancel calls nothing', async () => {
    const { props, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Log out everywhere' }))
    const dialog = await screen.findByRole('alertdialog')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(props.handleDeleteSession).not.toHaveBeenCalled()
    expect(props.handleDeleteAllSessions).not.toHaveBeenCalled()
  })

  it('goes back to the first page after «Log out other sessions»', async () => {
    const { container, user } = setup({ sessionsList: { sessions: makeSessions(25), loading: false, error: null } })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('navigation', { name: 'Sessions pages' })).toHaveTextContent('21–25 of 25')
    await user.click(screen.getByRole('button', { name: 'Log out other sessions' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Log out other sessions' }))
    expect(screen.getByRole('navigation', { name: 'Sessions pages' })).toHaveTextContent('1–10 of 25')
    expect(rows(container)).toHaveLength(10)
  })
})

describe('Sessions card · group actions and busy state', () => {
  it('«Log out other sessions» is off when the only session is this one', () => {
    setup({ sessionsList: { sessions: makeSessions(1), loading: false, error: null } })
    expect(screen.getByRole('button', { name: 'Log out other sessions' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Log out everywhere' })).toBeEnabled()
  })

  it('turns the row buttons and both group buttons off while an action runs (PF-11)', () => {
    const sessions = makeSessions(3)
    setup({ sessionsList: { sessions, loading: false, error: null }, actionState: { loading: true, error: null } })
    for (const session of sessions) {
      const name = session.current ? `Log out this browser (session started ${shown(session.created_at)})` : `Log out the session started ${shown(session.created_at)}`
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    const others = screen.getByRole('button', { name: 'Log out other sessions' })
    const everywhere = screen.getByRole('button', { name: 'Log out everywhere' })
    expect(others).toBeDisabled()
    expect(everywhere).toBeDisabled()
    // redesign (review r1, F3): disabled while anything runs, but only the action that runs shows it is working
    // (Sessions.focus.test.jsx); an action this card did not start marks neither group button
    expect(others).not.toHaveAttribute('aria-busy')
    expect(everywhere).not.toHaveAttribute('aria-busy')
  })
})

describe('Sessions card · states', () => {
  it('paints five skeleton rows while loading, and no list', () => {
    const { container } = setup({ sessionsList: { sessions: [], loading: true, error: null } })
    expect(container.querySelectorAll("[data-slot='profile-session-skeleton']")).toHaveLength(5)
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThanOrEqual(5)
    expect(rows(container)).toHaveLength(0)
    expect(screen.queryByText("You don't have any sessions")).toBeNull()
  })

  it('says it could not read the sessions, with the API message and «Try again» (D7, PF-02)', async () => {
    const { props, user } = setup({ sessionsList: { sessions: [], loading: false, error: ['Server is on fire'] } })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load your sessions")
    expect(alert).toHaveTextContent('Server is on fire')
    // never the false «You don't have any sessions»
    expect(screen.queryByText("You don't have any sessions")).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.handleReloadSessions).toHaveBeenCalledTimes(1)
  })

  // (a): the browser's text for a request that never arrived is not shown to the person
  it('says to check the connection, not «Failed to fetch», when the read never reached the API', () => {
    setup({ sessionsList: { sessions: [], loading: false, error: ['Failed to fetch'] } })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load your sessions")
    expect(alert).toHaveTextContent('Check your connection and try again.')
    expect(alert).not.toHaveTextContent('Failed to fetch')
  })

  it('takes the error as text too', () => {
    setup({ sessionsList: { sessions: [], loading: false, error: 'Unauthorized' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized')
  })

  it('does not paint «Try again» when the controller gives no handleReloadSessions', () => {
    setup({ sessionsList: { sessions: [], loading: false, error: ['x'] }, handleReloadSessions: undefined })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load your sessions")
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('shows the loading state, not the error, while a reload runs', () => {
    setup({ sessionsList: { sessions: [], loading: true, error: ['old'] } })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Sessions card · session_strategy not jwt_session (as main)', () => {
  it.each(['jwt', undefined])('says tracking is off for %s and offers «Active sessions» only', async (strategy) => {
    state.user = { id: 7, level: 0, session_strategy: strategy }
    const { props, user, container } = setup({ sessionsList: { sessions: [], loading: false, error: null } })
    expect(screen.getByRole('heading', { level: 2, name: 'Sessions' })).toBeInTheDocument()
    expect(screen.getByText("You don't have enabled the sessions, please active them to have a better control of your sessions.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out everywhere' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Sessions pages' })).toBeNull()
    expect(rows(container)).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Active sessions' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Active sessions' })
    expect(dialog).toHaveTextContent('Are you sure to enable all sessions?')
    await user.click(within(dialog).getByRole('button', { name: 'Active sessions' }))
    expect(props.handleDeleteAllSessions).toHaveBeenCalledTimes(1)
    expect(props.handleDeleteAllSessions).toHaveBeenCalledWith(false)
  })
})

describe('Sessions card · error of an action', () => {
  it('opens an alertdialog with the error, and again for the next error', async () => {
    const base = {
      sessionsList: { sessions: makeSessions(2), loading: false, error: null },
      handleDeleteSession: vi.fn(),
      handleDeleteAllSessions: vi.fn(),
      handleReloadSessions: vi.fn()
    }
    const user = userEvent.setup()
    const { rerender } = render(<SessionsUI {...base} actionState={{ loading: false, error: null }} />)
    expect(screen.queryByRole('alertdialog')).toBeNull()

    rerender(<SessionsUI {...base} actionState={{ loading: false, error: ['Session not found'] }} />)
    const dialog = await screen.findByRole('alertdialog', { name: 'Sessions' })
    expect(dialog).toHaveTextContent('Session not found')
    await user.click(within(dialog).getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    rerender(<SessionsUI {...base} actionState={{ loading: false, error: ['Another failure'] }} />)
    expect(await screen.findByRole('alertdialog', { name: 'Sessions' })).toHaveTextContent('Another failure')
  })

  it('says to check the connection, not «Failed to fetch», when the action never reached the API', async () => {
    const base = {
      sessionsList: { sessions: makeSessions(2), loading: false, error: null },
      handleDeleteSession: vi.fn(),
      handleDeleteAllSessions: vi.fn(),
      handleReloadSessions: vi.fn()
    }
    const { rerender } = render(<SessionsUI {...base} actionState={{ loading: false, error: null }} />)
    rerender(<SessionsUI {...base} actionState={{ loading: false, error: ['Failed to fetch'] }} />)
    const dialog = await screen.findByRole('alertdialog', { name: 'Sessions' })
    expect(dialog).toHaveTextContent('Check your connection and try again.')
    expect(dialog).not.toHaveTextContent('Failed to fetch')
  })
})

describe('Sessions · controller wiring', () => {
  it('mounts the controller with SessionsUI as its UIComponent and passes the props through', () => {
    render(<Sessions foo='bar' />)
    expect(state.controllerProps.UIComponent).toBe(SessionsUI)
    expect(state.controllerProps.foo).toBe('bar')
  })
})

describe('Sessions card · no residue', () => {
  it('has no «More info» and no modal of main', () => {
    setup({ sessionsList: { sessions: makeSessions(12), loading: false, error: null } })
    expect(screen.queryByText('More info')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not open a dialog until something asks for it', async () => {
    setup()
    await act(async () => {})
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
