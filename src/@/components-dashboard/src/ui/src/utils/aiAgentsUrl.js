export const AI_AGENTS_URL = 'https://ai.ordering.co/'

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
