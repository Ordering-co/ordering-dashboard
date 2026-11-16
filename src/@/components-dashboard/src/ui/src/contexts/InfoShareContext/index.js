import React, { useState, createContext } from 'react'
/**
 * Create InfoShareContext
 * This context will manage the info between pages and provide an easy interface
 */
export const InfoShareContext = createContext()

// The collapsed sidebar rail (C11) is a per-browser preference. Storage can be
// missing or throw (private mode, blocked site data): the rail then starts off.
export const SIDEBAR_RAIL_STORAGE_KEY = 'od.sidebar.rail'
const readRail = () => {
  try {
    return window.localStorage.getItem(SIDEBAR_RAIL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
const writeRail = (value) => {
  try {
    window.localStorage.setItem(SIDEBAR_RAIL_STORAGE_KEY, value ? '1' : '0')
  } catch {}
}

/**
  * Custom provider to mange shared info
  * @param {props} props
  */
export const InfoShareProvider = ({ children }) => {
  const [infoState, setInfoState] = useState(() => ({
    // `isCollapse`: the sidebar is hidden (below 1024px, or closed as a drawer).
    // Page headers show their menu button when it is true.
    isCollapse: false,
    // `isRail`: from 1024px, the sidebar shows only its icon rail.
    isRail: typeof window === 'undefined' ? false : readRail()
  }))

  const handleMenuCollapse = (val) => {
    setInfoState(state => ({ ...state, isCollapse: val }))
  }

  const handleMenuRail = (val) => {
    writeRail(val)
    setInfoState(state => ({ ...state, isRail: val }))
  }

  const functions = {
    handleMenuCollapse,
    handleMenuRail
  }

  return (
    <InfoShareContext.Provider value={[infoState, functions]}>
      {children}
    </InfoShareContext.Provider>
  )
}

// hook context

export function useInfoShare () {
  const infoShareManager = React.useContext(InfoShareContext)
  return infoShareManager || [{}, () => {}]
}
