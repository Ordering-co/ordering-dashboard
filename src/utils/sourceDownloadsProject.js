const SHARED_DASHBOARD_HOSTS = new Set([
  'dashboard.orderingplus.com',
  'dashboard.tryordering.com',
  'dashboard.ordering.co',
  'dashboardcf.orderingplus.com'
])

export const SOURCE_PROJECT_HEADER = 'x-ordering-project'

export const isOfficialOrderingDashboardHost = hostname =>
  SHARED_DASHBOARD_HOSTS.has(String(hostname || '').toLowerCase())

export const isValidSourceProjectSlug = project =>
  typeof project === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(project)
