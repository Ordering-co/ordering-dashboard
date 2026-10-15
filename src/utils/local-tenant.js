// Only an explicit source-file setup marker can enable the development pin.
// Hosted dashboards and unmarked historical configs retain their resolver.
export const getLocalProjectPin = (settings, isDevelopment) => {
  if (!isDevelopment || settings?.localProjectConfigured !== true) return null
  const project = typeof settings.project === 'string' ? settings.project.trim() : null
  return project && project !== 'your-project-slug' ? project : null
}

// Context updates can change normal selections, but cannot turn on local mode.
// Both fields are derived from config.js, which reads the marker from source.
export const applyLocalProjectPin = (settings, next) => {
  const project = settings?.localProjectConfigured === true ? settings.local_project_pin : null
  return {
    ...next,
    localProjectConfigured: settings?.localProjectConfigured === true,
    local_project_pin: project || null,
    ...(project ? { project } : {})
  }
}

// Scope browser identity and provider caches to the API and tenant. Never clear
// global localStorage: another dashboard or tenant may still own those entries.
export const getDashboardStorageKey = (settings, key) => {
  if (settings?.localProjectConfigured !== true || !settings?.local_project_pin || key === 'language') return key
  const scope = [settings.api?.url, settings.api?.version, settings.local_project_pin]
    .map(value => encodeURIComponent(value || '')).join(':')
  return `ordering-dashboard:${scope}:${key}`
}
