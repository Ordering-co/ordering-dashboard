import React, { createContext, useContext, useState } from 'react'
import { useLanguage as useBaseLanguage } from './language'

const FixtureSessionContext = createContext()
const initialSessions = [
  { id: 11, created_at: '2026-09-01 08:00:00', valid_thru: '2026-10-01 08:00:00', current: false },
  { id: 13, created_at: '2026-09-03 10:00:00', valid_thru: '2026-10-03 10:00:00', current: true },
  { id: 12, created_at: '2026-09-02 09:00:00', valid_thru: '2026-10-02 09:00:00', current: false }
]
// redesign many sessions (oldest first, so the card has to sort them) for the pagination; the current one is the 20th
const manySessions = count => Array.from({ length: count }, (_, index) => {
  const day = String(index + 1).padStart(2, '0')
  return { id: 100 + index + 1, created_at: `2026-09-${day} 10:00:00`, valid_thru: `2026-10-${day} 10:00:00`, current: index + 1 === 20 }
})
const actionError = ['Fixture session action error']
const readError = ['Fixture session read error']
const record = (kind, payload) => {
  globalThis.__OD_PROFILE_RECEIPTS__ = [...(globalThis.__OD_PROFILE_RECEIPTS__ || []), { kind, payload }]
}

export const ProfileSessionProvider = ({ children, initialUser }) => {
  const [user, setUser] = useState(initialUser)
  const value = [{ token: 'fixture-profile-token', user }, {
    login: payload => {
      record('session-login', payload)
      setUser(payload.user)
    },
    logout: () => record('session-logout'),
    setFixtureUser: setUser
  }]
  return <FixtureSessionContext.Provider value={value}>{children}</FixtureSessionContext.Provider>
}

export const useProfileFixtureSession = () => useContext(FixtureSessionContext)
export const useSession = () => useContext(FixtureSessionContext)
export const useLanguage = () => useBaseLanguage()
export const useUtils = () => [{
  parseDate: (value, options = {}) => {
    record('parse-date', { value, options })
    return `DATE:${value}` // redesign the card asks for the project's own format, so no options are expected
  }
}]

export const UserDetails = ({ UIComponent, userId, ...props }) => {
  globalThis.__OD_PROFILE_USER_DETAILS__ = { userId }
  return React.createElement(UIComponent, {
    ...props,
    // redesign `popup=blocked` answers what the real controller answers when the browser blocks the window (B1-2)
    handleGoogleAccountLink: () => {
      record('google-link', { args: [] })
      return new URLSearchParams(window.location.search).get('popup') === 'blocked' ? { ok: false, reason: 'popup-blocked' } : undefined
    }
  })
}

export const Sessions = ({ UIComponent, ...props }) => {
  const query = new URLSearchParams(window.location.search)
  const state = query.get('state') || 'populated'
  const count = Number(query.get('count') || 0)
  const [sessions] = useState(() => {
    if (state === 'current') return initialSessions.filter(session => session.current).map(session => ({ ...session }))
    return (count > 0 ? manySessions(count) : initialSessions).map(session => ({ ...session }))
  })
  globalThis.__OD_PROFILE_SESSION_SOURCE__ = sessions
  const sessionsList = {
    loading: state === 'loading',
    error: state === 'error' ? readError : null,
    sessions: state === 'empty' ? [] : sessions
  }
  const actionState = {
    loading: query.get('actionLoading') === '1',
    error: query.get('actionError') === '1' ? actionError : null
  }
  return React.createElement(UIComponent, {
    ...props,
    sessionsList,
    actionState,
    handleReloadSessions: () => record('reload-sessions', {}),
    handleDeleteSession: session => record('delete-session', {
      id: session.id,
      sameReference: sessions.includes(session)
    }),
    handleDeleteAllSessions: deleteCurrent => record('delete-all', { deleteCurrent })
  })
}
