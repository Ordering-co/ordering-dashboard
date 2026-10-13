import { useContext, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { usePostHog } from 'posthog-js/react'
import { useSession } from '~components'
import { ConfigFileContext, useProjectState } from '~ui'
import {
  captureDashboardEvent,
  captureDashboardOperation,
  getDashboardErrorSignature,
  getDashboardCommonProperties,
  getDashboardRoute,
  shouldCaptureDashboardRuntimeError
} from '~/analytics/posthog'
import { getDashboardRouteFingerprint, isDashboardAnalyticsReady } from './analytics'

export { getDashboardRouteFingerprint, isDashboardAnalyticsReady } from './analytics'

export const DashboardAnalytics = () => {
  const location = useLocation()
  const posthog = usePostHog()
  const [{ auth, user }] = useSession()
  const [configFile] = useContext(ConfigFileContext)
  const [projectStatus] = useProjectState()
  const project = projectStatus?.project
  const projectId = project?.id
  const projectCode = project?.code ?? configFile?.project
  const planId = projectStatus?.plan?.id
  const userRole = user?.level
  const lastRouteFingerprint = useRef(null)
  const runtimeErrorSignatures = useRef(new Set())

  useEffect(() => {
    if (!isDashboardAnalyticsReady({ auth, projectLoading: projectStatus?.loading, projectId })) return
    const routeFingerprint = getDashboardRouteFingerprint(projectId, location.pathname)
    if (lastRouteFingerprint.current === routeFingerprint) return
    lastRouteFingerprint.current = routeFingerprint
    const route = getDashboardRoute(location.pathname)
    const commonProperties = getDashboardCommonProperties({
      project: { id: projectId, code: projectCode },
      plan: { id: planId },
      user: { level: userRole },
      config: configFile
    })
    captureDashboardEvent('dashboard_module_viewed', { ...commonProperties, ...route }, posthog)
    if (route.module === 'connect') {
      captureDashboardOperation({
        status: 'succeeded',
        module: 'connect',
        action: 'open_connect_module'
      }, posthog)
    }
  }, [
    auth,
    configFile,
    location.pathname,
    planId,
    posthog,
    projectCode,
    projectId,
    projectStatus?.loading,
    userRole
  ])

  useEffect(() => {
    const captureRuntimeError = (event) => {
      const failureType = 'runtime_error'
      const errorSignature = getDashboardErrorSignature({
        failureType,
        message: event?.message,
        source: event?.filename
      })
      if (!shouldCaptureDashboardRuntimeError(runtimeErrorSignatures.current, errorSignature)) return
      captureDashboardEvent('dashboard_runtime_error', {
        failure_type: failureType,
        error_signature: errorSignature
      }, posthog)
    }
    const captureUnhandledRejection = (event) => {
      const failureType = 'unhandled_rejection'
      const errorSignature = getDashboardErrorSignature({
        failureType,
        message: event?.reason?.message ?? String(event?.reason ?? ''),
        source: event?.reason?.name
      })
      if (!shouldCaptureDashboardRuntimeError(runtimeErrorSignatures.current, errorSignature)) return
      captureDashboardEvent('dashboard_runtime_error', {
        failure_type: failureType,
        error_signature: errorSignature
      }, posthog)
    }
    window.addEventListener('error', captureRuntimeError)
    window.addEventListener('unhandledrejection', captureUnhandledRejection)
    return () => {
      window.removeEventListener('error', captureRuntimeError)
      window.removeEventListener('unhandledrejection', captureUnhandledRejection)
    }
  }, [posthog])

  return null
}
