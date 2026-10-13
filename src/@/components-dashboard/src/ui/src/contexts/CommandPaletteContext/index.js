import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getCommandPaletteShortcut, isCommandPaletteShortcut } from '../../../../utils/commandPaletteShortcut'

const CommandPaletteContext = createContext(null)

/**
 * Open state and the global ⌘K / Ctrl+K shortcut of the command palette.
 * `enabled` is false on public pages (login, password reset).
 */
export const CommandPaletteProvider = ({ enabled = false, children }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [routeKey, setRouteKey] = useState(0)
  const [initialRequest, setInitialRequest] = useState(null)
  const returnFocusRef = useRef(null)
  const shortcut = useMemo(() => getCommandPaletteShortcut(), [])

  // Remember where focus was so closing can give it back (Radix only
  // returns focus to its own Dialog.Trigger)
  const setOpen = useCallback((next) => {
    setIsOpen(prev => {
      const value = typeof next === 'function' ? next(prev) : next
      if (!value) setInitialRequest(null)
      if (value && !prev && typeof document !== 'undefined') {
        returnFocusRef.current = document.activeElement
      }
      return value
    })
  }, [])

  const discardReturnFocus = useCallback(() => {
    returnFocusRef.current = null
  }, [])

  const restoreFocus = useCallback(() => {
    const element = returnFocusRef.current
    returnFocusRef.current = null
    if (element && element.isConnected && typeof element.focus === 'function') {
      element.focus()
      return true
    }
    return false
  }, [])

  useEffect(() => {
    if (!enabled) {
      setOpen(false)
      return undefined
    }
    const onKeyDown = (event) => {
      if (!isCommandPaletteShortcut(event, shortcut.isMac)) return
      event.preventDefault()
      setOpen(prev => !prev)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, shortcut.isMac, setOpen])

  const open = useCallback((request = null) => {
    setInitialRequest(request && typeof request === 'object'
      ? {
          query: typeof request.query === 'string' ? request.query.slice(0, 200) : '',
          fromAssistant: request.fromAssistant === true,
          destinationId: typeof request.destinationId === 'string' ? request.destinationId.slice(0, 160) : null
        }
      : null)
    setOpen(true)
  }, [setOpen])
  const close = useCallback(() => setOpen(false), [setOpen])
  const remountRoute = useCallback(() => setRouteKey(key => key + 1), [])

  const value = useMemo(() => ({
    isAvailable: enabled,
    isOpen: enabled && isOpen,
    initialRequest,
    open,
    close,
    setOpen,
    shortcut,
    routeKey,
    remountRoute,
    restoreFocus,
    discardReturnFocus
  }), [enabled, isOpen, initialRequest, open, close, setOpen, shortcut, routeKey, remountRoute, restoreFocus, discardReturnFocus])

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  )
}

const unavailable = {
  isAvailable: false,
  isOpen: false,
  open: () => {},
  close: () => {},
  setOpen: () => {},
  shortcut: getCommandPaletteShortcut(false),
  routeKey: 0,
  remountRoute: () => {},
  restoreFocus: () => false,
  discardReturnFocus: () => {}
}

export const useCommandPalette = () => useContext(CommandPaletteContext) || unavailable

/**
 * Remounts the routed page when the palette opens a destination on the page
 * already shown. Many panels read their query (`?id=`, `?section=`) only on
 * mount; a remount opens them through that same flow, like a fresh visit.
 */
export const CommandPaletteRouteBoundary = ({ children }) => {
  const { routeKey } = useCommandPalette()
  return <React.Fragment key={routeKey}>{children}</React.Fragment>
}
