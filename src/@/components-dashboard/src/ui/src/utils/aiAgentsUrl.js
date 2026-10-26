export const AI_AGENTS_URL = 'https://ai.ordering.co/'
export const AI_AGENTS_UPGRADE_URL = 'https://forms.ordering.co/r/A7GDBo'

const present = (value) => (typeof value === 'string' ? value.trim() : '')

export const buildAiAgentsUrl = ({ accessToken, project } = {}) => {
  const token = present(accessToken)
  const tenant = present(project)
  if (!token || !tenant) return null

  const url = new URL(AI_AGENTS_URL)
  url.searchParams.set('access_token', token)
  url.searchParams.set('project', tenant)
  return url.toString()
}

export const buildAiAgentsUpgradeUrl = ({ email, project } = {}) => {
  const url = new URL(AI_AGENTS_UPGRADE_URL)
  url.searchParams.set('utm_source', 'ordering_dashboard')
  url.searchParams.set('utm_medium', 'sidebar')
  url.searchParams.set('utm_campaign', 'ai_agents_upgrade')
  if (present(email)) url.searchParams.set('email', present(email))
  if (present(project)) url.searchParams.set('ref', present(project))
  return url.toString()
}
