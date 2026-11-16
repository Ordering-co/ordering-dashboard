import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { createGlobalStyle } from 'styled-components'
import { withOrderingMode } from '~/brand/adapter'
import darkRoutes from '~/brand/darkRoutes.json'
import { useTheme } from '../ThemeContext'

/**
 * · Color mode (decision 28): System, Light or Dark, chosen in the account menu and kept in this browser.
 *
 * Behind `dashboard_dark_mode` in src/config.json, off by default. Off, the provider renders its children and nothing else:
 * no selector, no attribute on the root, no stylesheet, and System never turns dark. On, the resolved mode reaches the theme
 * (`theme.ordering` and the `--od-*` the ThemeContext writes on :root) and, in dark, the root gets `data-ordering-brand` and
 * `data-od-theme='dark'`, so the release and the `--od-x-*` candidates switch too. Routes outside src/brand/darkRoutes.json
 * have no dark variant and stay light (scripts/redesign/dark-routes.mjs).
 */

export const COLOR_MODE_STORAGE_KEY = 'dashboard_color_mode'
export const COLOR_MODES = ['system', 'light', 'dark']
const SCHEME_QUERY = '(prefers-color-scheme: dark)'

const DISABLED = { enabled: false, preference: 'light', mode: 'light', setPreference: () => {} }
const ColorModeContext = createContext(DISABLED)

const readPreference = () => {
  try {
    const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)
    return COLOR_MODES.includes(stored) ? stored : 'system'
  } catch (error) {
    return 'system'
  }
}

const storePreference = value => {
  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, value)
  } catch (error) {
    // Blocked storage (private mode, policy): the choice lasts for this visit only.
  }
}

const schemeQuery = () => (typeof window.matchMedia === 'function' ? window.matchMedia(SCHEME_QUERY) : null)

const useSystemDark = () => {
  const [dark, setDark] = useState(() => schemeQuery()?.matches === true)
  useEffect(() => {
    const query = schemeQuery()
    if (!query) return undefined
    const sync = () => setDark(query.matches === true)
    sync()
    if (query.addEventListener) {
      query.addEventListener('change', sync)
      return () => query.removeEventListener('change', sync)
    }
    query.addListener?.(sync)
    return () => query.removeListener?.(sync)
  }, [])
  return dark
}

export const isDarkRoute = pathname => darkRoutes.routes.some(path => matchPath(pathname, { path, exact: true }))

// The body and the scrollbar of the ThemeContext read the legacy theme, which only has light values.
const DarkRootStyle = createGlobalStyle`
  html[data-od-theme='dark'] {
    color-scheme: dark;
  }

  html[data-od-theme='dark'] body {
    background-color: var(--od-bg);
    color: var(--od-text);
  }

  html[data-od-theme='dark'] * {
    scrollbar-color: var(--od-border-strong) var(--od-surface-subtle) !important;
  }

  html[data-od-theme='dark'] ::-webkit-scrollbar-thumb {
    background: var(--od-border-strong);
  }

  html[data-od-theme='dark'] ::-webkit-scrollbar-thumb:hover {
    background: var(--od-text-subtle);
  }

  html[data-od-theme='dark'] ::-webkit-scrollbar-thumb:active {
    background: var(--od-text-muted);
  }

  html[data-od-theme='dark'] ::-webkit-scrollbar-track {
    background: var(--od-surface-subtle);
  }
`

const EnabledColorMode = ({ children }) => {
  const [preference, setPreferenceState] = useState(readPreference)
  const systemDark = useSystemDark()
  const { pathname } = useLocation()
  const [, { update }] = useTheme()
  const wantsDark = preference === 'dark' || (preference === 'system' && systemDark)
  const mode = wantsDark && isDarkRoute(pathname) ? 'dark' : 'light'

  useLayoutEffect(() => {
    update(current => withOrderingMode(current, mode))
    if (mode !== 'dark') return undefined
    const root = document.documentElement
    root.setAttribute('data-ordering-brand', '')
    root.setAttribute('data-od-theme', 'dark')
    return () => {
      root.removeAttribute('data-ordering-brand')
      root.removeAttribute('data-od-theme')
    }
  }, [mode])

  const setPreference = value => {
    if (!COLOR_MODES.includes(value)) return
    setPreferenceState(value)
    storePreference(value)
  }

  return (
    <ColorModeContext.Provider value={{ enabled: true, preference, mode, setPreference }}>
      {mode === 'dark' && <DarkRootStyle />}
      {children}
    </ColorModeContext.Provider>
  )
}

export const ColorModeProvider = ({ enabled = false, children }) => (
  enabled ? <EnabledColorMode>{children}</EnabledColorMode> : children
)

/** `{ enabled, preference, mode, setPreference }`; `enabled` is false (and the mode light) while the flag is off. */
export const useColorMode = () => useContext(ColorModeContext)
