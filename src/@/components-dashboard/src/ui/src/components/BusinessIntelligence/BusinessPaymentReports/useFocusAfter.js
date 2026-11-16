import { useCallback, useEffect, useRef } from 'react'

// redesign the same contract as `useFocusAfter` of Home (`HomePage.jsx`, not exported from there): a «Try again» removes the
// button that had the focus and the focus fell to <body>. `arm()` is called by the action; when `ready` is true the focus goes to `ref`
// once. A block that loads on its own, with no action asked, never takes the focus.
export const useFocusAfter = (ref, ready) => {
  const armed = useRef(false)
  useEffect(() => {
    if (!armed.current || !ready || !ref.current) return
    armed.current = false
    ref.current.focus()
  })
  return useCallback(() => { armed.current = true }, [])
}
