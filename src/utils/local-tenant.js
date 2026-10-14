// Local configuration is authoritative only in development. Hosted dashboards
// retain Worker/domain discovery and the existing project selection behavior.
export const getLocalProjectPin = (settings, isDevelopment) => {
  const project = settings?.project?.trim()
  return isDevelopment && project && project !== 'your-project-slug' ? project : null
}

// Scope browser identity and provider caches to the API and tenant. Never clear
// global localStorage: another dashboard or tenant may still own those entries.
export const getDashboardStorageKey = (settings, key) => {
  if (!settings?.local_project_pin || key === 'language') return key
  const scope = [settings.api?.url, settings.api?.version, settings.local_project_pin]
    .map(value => encodeURIComponent(value || '')).join(':')
  return `ordering-dashboard:${scope}:${key}`
}
