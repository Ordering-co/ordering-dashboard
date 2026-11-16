import React, { useCallback, useEffect, useRef, useState } from 'react'

import { MapPin } from '../Icon'
import { cx } from './classNames'
import { EmptyState } from './Feedback'
import { StepBoundary } from './Wizard/StepBoundary'
import { useGoogleMapsFailure } from './Wizard/useGoogleMapsFailure'
import './product.css'
import './feedback.css'
import './map-frame.css'

export const MAP_FRAME_SIZES = ['default', 'compact', 'fill']

/**
 * redesign W0-7 (T0-25) · C19. The slot of an embedded map. It fills the width of its container and never more, takes its
 * height from a token (`size`: `default` --od-x-map-height, `compact` --od-x-map-height-compact, `fill` the height the container
 * gives it), and has the brand radius and border with `overflow: hidden`. Form actions go below the frame; it paints none.
 *
 * `children` is the real map (GoogleMapReact or another). It is drawn only when the provider is there: with no `apiKey`, with
 * `unavailable`, or once the Google loader reports that its script could not load (blocked by the network, an extension or a
 * policy: `useGoogleMapsFailure`), the frame draws `unavailableTitle` (+ `unavailableDescription`) in the same slot, with
 * role=status, and nothing else on the page changes. A map that throws while it renders is caught by its own boundary
 * (`StepBoundary`) and gives the same notice, so a map failure never blanks the page. If the focus was inside the map it moves
 * to the frame, not to <body>.
 *
 * Needs `label` (the name of the map region) and `unavailableTitle`: both arrive translated, the component has no text of its
 * own. `apiKey` is the key of the provider: a map that does not need one passes any truthy value. `unavailable` lets the
 * consumer report a failure the frame cannot see (the provider answered but its classes are missing). `onError` receives what
 * the boundary caught; `resetKey` changing makes the frame try the map again. State: `data-state` (`ready` or `unavailable`),
 * `data-size`.
 */
export const MapFrame = React.forwardRef(function ProductMapFrame ({
  label,
  apiKey,
  unavailable = false,
  unavailableTitle,
  unavailableDescription,
  size = 'default',
  onError,
  resetKey,
  className,
  children,
  ...props
}, ref) {
  if (label == null) throw new Error('MapFrame needs a label')
  if (unavailableTitle == null) throw new Error('MapFrame needs an unavailableTitle')
  if (!MAP_FRAME_SIZES.includes(size)) throw new Error(`MapFrame size must be one of ${MAP_FRAME_SIZES.join(', ')}`)

  const frameRef = useRef(null)
  // Stable: a new callback per render would detach the ref and attach it after the boundary has already asked for the frame.
  const setRef = useCallback(node => {
    frameRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }, [ref])
  const loadFailed = useGoogleMapsFailure()
  // The boundary draws the notice when the map throws; `crashed` keeps data-state honest about it.
  const [crashed, setCrashed] = useState(false)
  const seenResetKey = useRef(resetKey)
  useEffect(() => {
    if (seenResetKey.current === resetKey) return
    seenResetKey.current = resetKey
    setCrashed(false)
  }, [resetKey])
  const handleError = (error, info) => {
    setCrashed(true)
    onError?.(error, info)
  }
  const missing = unavailable || loadFailed || !apiKey

  const notice = (
    <EmptyState
      role='status'
      icon={MapPin}
      title={unavailableTitle}
      description={unavailableDescription}
    />
  )

  return (
    <div
      ref={setRef}
      role='region'
      aria-label={label}
      tabIndex={-1}
      className={cx('odc-map-frame', className)}
      data-state={missing || crashed ? 'unavailable' : 'ready'}
      data-size={size}
      {...props}
    >
      {missing
        ? notice
        : (
          <StepBoundary fallback={notice} focusOnError={() => frameRef.current} onError={handleError} resetKey={resetKey}>
            <div className='odc-map-frame-map'>{children}</div>
          </StepBoundary>
          )}
    </div>
  )
})
