import { useEffect, useRef } from 'react'
import { captureDashboardOperation } from './posthog'

export const useTrackedLoadState = ({ loading, error, module, action, once = false }) => {
  const previousLoading = useRef(false)
  const completed = useRef(false)

  useEffect(() => {
    if (once && completed.current) {
      previousLoading.current = loading
      return
    }
    if (loading && !previousLoading.current) {
      captureDashboardOperation({ status: 'started', module, action })
    }
    if (!loading && previousLoading.current) {
      captureDashboardOperation({
        status: error ? 'failed' : 'succeeded',
        module,
        action,
        ...(error && { failureType: 'api' })
      })
      completed.current = true
    }
    previousLoading.current = loading
  }, [loading, error, module, action, once])
}
