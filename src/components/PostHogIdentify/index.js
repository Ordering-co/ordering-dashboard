import { useContext, useEffect, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { useConfig, useSession } from '~components'
import { ConfigFileContext, useProjectState } from '~ui'
import {
  getDashboardCommonProperties,
  getDashboardGroupProperties,
  getDashboardUserProperties,
  sanitizeAnalyticsProperties,
  sanitizeGroupProperties,
  sanitizePersonProperties
} from '~/analytics/posthog'

export const PostHogIdentify = () => {
  const posthog = usePostHog()
  const [{ user, auth: isAuthenticated }] = useSession()
  const [{ configs }] = useConfig()
  const [configFile] = useContext(ConfigFileContext)
  const [projectStatus] = useProjectState()
  const project = projectStatus?.project
  const projectId = project?.id
  const projectCode = project?.code ?? configFile?.project ?? window.localStorage.getItem('project') ?? null
  const planId = projectStatus?.plan?.id
  const userId = user?.id
  const userLevel = user?.level
  const projectCurrentStatus = project?.current_status
  const projectCurrentStatusUntil = project?.project_current_status_until
  const projectAddonsKey = Object.entries(configs || {})
    .filter(([key, config]) => key.startsWith('addon_') && ['1', 1, true].includes(config?.value))
    .map(([key]) => key)
    .sort()
    .join('|')
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!posthog) return
    if (posthog.__loaded) {
      setIsInitialized(true)
      return
    }
    return posthog.onFeatureFlags?.(() => {
      setIsInitialized(true)
    })
  }, [posthog])

  useEffect(() => {
    if (isInitialized && isAuthenticated && userId !== null && userId !== undefined) {
      const safePersonProperties = sanitizePersonProperties({
        ...getDashboardUserProperties(user),
        ...(projectCode && { project_code: projectCode })
      })
      posthog.identify(String(userId), safePersonProperties)

      if (projectCode) {
        try {
          posthog?.setPersonPropertiesForFlags?.({ project_code: projectCode }, false)
        } catch (error) {
          console.warn('PostHog setPersonPropertiesForFlags error:', error)
        }
      }
    } else if (isInitialized && !isAuthenticated) {
      posthog.reset()
    }
  }, [
    isInitialized,
    isAuthenticated,
    userId,
    user?.email,
    user?.name,
    user?.first_name,
    user?.lastname,
    user?.last_name,
    user?.cellphone,
    user?.country_phone_code,
    user?.phone_country_code,
    user?.level,
    user?.created_at,
    user?.user_system_id,
    user?.email_verified,
    user?.language_id,
    projectCode,
    posthog
  ])

  useEffect(() => {
    if (isInitialized && isAuthenticated && userId !== null && userId !== undefined) {
      const commonProperties = getDashboardCommonProperties({
        project: { id: projectId, code: projectCode },
        plan: { id: planId },
        user: { level: userLevel },
        config: configFile
      })
      const safeProperties = sanitizeAnalyticsProperties(commonProperties)
      posthog.register(safeProperties)

      if (projectId && projectCode) {
        const groupProperties = sanitizeGroupProperties(getDashboardGroupProperties({
          project: {
            code: projectCode,
            current_status: projectCurrentStatus,
            project_current_status_until: projectCurrentStatusUntil
          },
          planId,
          projectOwnerId: user?.user_system_id,
          addons: projectAddonsKey ? projectAddonsKey.split('|') : []
        }))
        posthog.group('projects', `${projectCode} (${projectId})`, groupProperties)
      }
    }
  }, [
    isInitialized,
    isAuthenticated,
    userId,
    userLevel,
    user?.user_system_id,
    projectCode,
    projectId,
    projectCurrentStatus,
    projectCurrentStatusUntil,
    planId,
    projectAddonsKey,
    configFile?.posthog_analytics_enabled,
    posthog
  ])

  return null
}
