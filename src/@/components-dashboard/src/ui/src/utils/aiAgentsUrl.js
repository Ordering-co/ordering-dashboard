export const AI_AGENTS_URL = 'https://ai.ordering.co/'

const present = (value) => (typeof value === 'string' ? value.trim() : '')

// ai.ordering.co opens with a one-time code (POST session_codes), never the session token.
// `session_code`, not `code`: ai.ordering.co's /reset-password reads `code`.
export const buildAiAgentsUrl = ({ code, project } = {}) => {
  const oneTimeCode = present(code)
  const tenant = present(project)
  if (!oneTimeCode || !tenant) return null

  const url = new URL(AI_AGENTS_URL)
  url.searchParams.set('session_code', oneTimeCode)
  url.searchParams.set('project', tenant)
  return url.toString()
}

const buildUpgradeFormUrl = ({ email, project, medium, campaign }) => {
  const destination = present(import.meta.env.VITE_DASHBOARD_UPGRADE_FORM_URL)
  if (!destination) return null

  let url
  try {
    url = new URL(destination)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null

  url.searchParams.delete('email')
  url.searchParams.delete('ref')
  url.searchParams.set('utm_source', 'ordering_dashboard')
  url.searchParams.set('utm_medium', medium)
  url.searchParams.set('utm_campaign', campaign)
  if (import.meta.env.VITE_DASHBOARD_UPGRADE_FORM_PREFILL === 'true') {
    if (present(email)) url.searchParams.set('email', present(email))
    if (present(project)) url.searchParams.set('ref', present(project))
  }
  return url.toString()
}

export const buildAiAgentsUpgradeUrl = (options) =>
  buildUpgradeFormUrl({ ...options, medium: 'sidebar', campaign: 'ai_agents_upgrade' })

export const buildDashboardUpgradeUrl = (options) =>
  buildUpgradeFormUrl({ ...options, medium: 'dashboard', campaign: 'legacy_plan_upgrade' })
