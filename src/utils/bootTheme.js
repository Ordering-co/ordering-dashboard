import { getDashboardStorageKey } from './local-tenant'

export const shouldResolveDashboardProject = ({
  auth,
  isOrderingSubdomain,
  useProjectDomain,
  useProjectSubdomain
} = {}) => Boolean(
  useProjectDomain &&
  !auth &&
  (!isOrderingSubdomain || useProjectSubdomain)
)

export const shouldResolveDashboardProjectAtBoot = ({
  auth,
  isOrderingSubdomain,
  useProjectDomain,
  useProjectSubdomain,
  storedProject,
  firstLoadConfigs,
  localProjectPin
} = {}) => !localProjectPin && (shouldResolveDashboardProject({
  auth,
  isOrderingSubdomain,
  useProjectDomain,
  useProjectSubdomain
}) || Boolean(
  useProjectDomain &&
  !auth &&
  !storedProject &&
  !firstLoadConfigs
))

export const readStoredDashboardAuth = (win = window, settings) => {
  const read = key => win?.localStorage?.getItem(getDashboardStorageKey(settings, key))
  const token = read('token')
  const project = read('project')
  if (!token || !project || (settings?.local_project_pin && project !== settings.local_project_pin)) return null

  try {
    const user = JSON.parse(read('user'))
    return user && typeof user === 'object' && !Array.isArray(user) ? token : null
  } catch {
    return null
  }
}

export const resolveInitialDashboardProject = ({
  settings,
  auth,
  storedProject,
  isDevelopment = false,
  isOrderingSubdomain
} = {}) => {
  if (settings?.local_project_pin) return settings.local_project_pin
  const shouldResolveProject = shouldResolveDashboardProject({
    auth,
    isOrderingSubdomain,
    useProjectDomain: settings?.use_project_domain,
    useProjectSubdomain: settings?.use_project_subdomain
  })
  if (shouldResolveProject) return null
  const canUseConfiguredProject = !settings?.use_project_domain || isDevelopment
  return storedProject ?? (canUseConfiguredProject ? settings?.project : null) ?? null
}

export const readFirstLoadConfigs = (win = window) => {
  const payload = win?.__FIRST_LOAD__
  if (!payload || typeof payload !== 'object') return null
  if (payload.configs && typeof payload.configs === 'object') return payload.configs
  if (payload.result?.configs && typeof payload.result.configs === 'object') {
    return payload.result.configs
  }
  return null
}

const normalizeProject = (project) => {
  if (typeof project !== 'string') return null
  const trimmed = project.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

// The Worker fetches first_load for the project it resolves from the host and
// injects that same project as window.__CONFIG__.project.
export const readFirstLoadProject = (win = window) => normalizeProject(win?.__CONFIG__?.project)

// On an Ordering host the Worker falls back to the default project, while the
// session may belong to another one; its configs (and dashboard color) must not
// hydrate the active project. Custom domains resolve the same project, so they
// keep the first_load hydrate.
export const readFirstLoadConfigsForProject = (project, win = window) => {
  const configs = readFirstLoadConfigs(win)
  const activeProject = normalizeProject(project)
  const firstLoadProject = readFirstLoadProject(win)
  if (!configs || !activeProject || !firstLoadProject) return configs
  return activeProject === firstLoadProject ? configs : null
}

export const readDashboardPrimary = (configs) => {
  const value = configs?.dashboard_buttons_colors?.value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const mergeThemePrimary = (theme, primary) => {
  if (!primary) return theme
  return {
    ...theme,
    colors: {
      ...theme?.colors,
      primary
    }
  }
}

export const canRevealDashboard = ({
  sessionLoading,
  configLoading
} = {}) => !sessionLoading && !configLoading

export const resolveBootRevealAction = ({
  canReveal,
  loaded,
  primary,
  currentPrimary
} = {}) => {
  if (loaded) return 'idle'
  if (!canReveal) return 'hold'
  if (primary && primary !== currentPrimary) return 'apply-primary'
  return 'reveal'
}
