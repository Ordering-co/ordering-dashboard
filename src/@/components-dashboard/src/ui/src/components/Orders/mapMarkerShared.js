import { useEffect, useId, useRef, useState } from 'react'
import { css } from 'styled-components'

// redesign W1-2 (T1-2-4): the state of a map marker, its colour and its show/hide
// behaviour live here once for DriverMapMarkerAndInfo and InterActOrderMarker.
// The one place that maps a marker state to a product status token. The marker button carries
// data-status; WrapperMapMarker of both markers reads --od-marker-status from here.
// A marker without a driver (customer, business) has no data-status and keeps the neutral colour.
export const markerStatusColor = css`
  --od-marker-status: var(--od-border-strong);

  &[data-status='delayed'] { --od-marker-status: var(--od-danger-signal); }
  &[data-status='offline'] { --od-marker-status: var(--od-border-strong); }
  &[data-status='busy'] { --od-marker-status: var(--od-x-info-signal, var(--od-text)); }
  &[data-status='available'] { --od-marker-status: var(--od-x-marker-available); } /* : 3:1 against white and map land (WCAG 1.4.11) */
`

// 'delayed' | 'offline' | 'busy' | 'available' | null (no driver: customer or business marker)
export const getMarkerStatus = ({ timeStatus, driver }) => {
  if (timeStatus === 'delayed') return 'delayed'
  if (!driver) return null
  if (!driver.enabled || !driver.available) return 'offline'
  if (driver.busy) return 'busy'
  return 'available'
}

export const useMarkerDisclosure = () => {
  const [infoShow, setInfoShow] = useState(false)
  const infoRef = useRef(null)
  const markerRef = useRef(null)
  const focusOpenedRef = useRef(false)
  const [infoTop, setInfoTop] = useState('0px')
  const infoId = useId()

  useEffect(() => {
    if (!infoShow) return
    setInfoTop(`-${infoRef.current.scrollHeight + 55}px`)
  }, [infoShow])

  const handlers = {
    onMouseEnter: () => setInfoShow(true),
    onMouseLeave: () => {
      if (document.activeElement !== markerRef.current) setInfoShow(false)
    },
    onFocus: () => {
      focusOpenedRef.current = true
      setInfoShow(true)
    },
    onBlur: () => {
      focusOpenedRef.current = false
      setInfoShow(false)
    },
    onClick: () => {
      if (focusOpenedRef.current) {
        focusOpenedRef.current = false
        setInfoShow(true)
        return
      }
      setInfoShow(current => !current)
    },
    onKeyDown: (event) => {
      if (event.key === 'Escape') {
        focusOpenedRef.current = false
        setInfoShow(false)
      }
    }
  }

  return { infoShow, infoId, infoRef, infoTop, markerRef, handlers }
}
