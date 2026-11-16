// Narrow in-memory providers for the feedback fixture. No SDK, storage, or service side effects.
import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import translations from '../../../i18n/translations.json'
import { ToastProvider, ToastType, useToast } from '../../../src/@/components-dashboard/src/contexts/ToastContext'

export { ToastType, useToast }

class FixtureEvents {
  constructor () {
    this.listeners = new Map()
  }

  on (name, listener) {
    const listeners = this.listeners.get(name) || new Set()
    listeners.add(listener)
    this.listeners.set(name, listeners)
  }

  off (name, listener) {
    this.listeners.get(name)?.delete(listener)
  }

  emit (name, ...args) {
    this.listeners.get(name)?.forEach(listener => listener(...args))
  }
}

const FeedbackContext = createContext(null)

export const FeedbackFixtureProvider = ({ children }) => {
  const events = useRef(new FixtureEvents()).current
  const value = useMemo(() => ({
    api: [null, { configurations: { subdomain: 'ordering' } }],
    events: [events],
    // redesign NF: `session=out` renders the logged-out case of the 404
    session: [new URLSearchParams(window.location.search).get('session') === 'out'
      ? { auth: false, loading: false, user: null }
      : { auth: true, loading: false, user: { level: 0, name: 'Avery' } }]
  }), [events])

  return React.createElement(
    FeedbackContext.Provider,
    { value },
    React.createElement(ToastProvider, null, children)
  )
}

const useFeedbackContext = () => {
  const value = useContext(FeedbackContext)
  if (!value) throw new Error('FeedbackFixtureProvider is required for this fixture')
  return value
}

export const useApi = () => useFeedbackContext().api
export const useEvent = () => useFeedbackContext().events
export const useSession = () => useFeedbackContext().session

export const useLanguage = () => {
  const locale = new URLSearchParams(window.location.search).get('locale') || 'en'
  const dictionary = useMemo(() => Object.fromEntries(
    Object.entries(translations).map(([key, values]) => [key, values[locale]])
  ), [locale])
  const translate = useCallback((key, fallback) => dictionary[key] || fallback || key, [dictionary])
  return [{ dictionary, loading: false }, translate]
}
