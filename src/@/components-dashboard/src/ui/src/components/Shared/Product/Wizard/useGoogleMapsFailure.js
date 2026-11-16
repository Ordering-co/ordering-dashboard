import { useEffect, useState } from 'react'

const GOOGLE_LOAD_ERROR = /Google Maps JavaScript API could not load/i

/**
 * True once the Google loader reports that the Maps script could not load (blocked by the network, an
 * extension or a policy). The loader reports it as an uncaught error outside React, so the only way to
 * hear it is the window. Listens while the caller is mounted; the caller shows its own "unavailable" state.
 */
export const useGoogleMapsFailure = () => {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const onFailure = (event) => {
      if (GOOGLE_LOAD_ERROR.test(String(event?.message ?? event?.reason?.message ?? event?.reason ?? ''))) setFailed(true)
    }
    window.addEventListener('error', onFailure)
    window.addEventListener('unhandledrejection', onFailure)
    return () => {
      window.removeEventListener('error', onFailure)
      window.removeEventListener('unhandledrejection', onFailure)
    }
  }, [])
  return failed
}
