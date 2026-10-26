import { describe, expect, it } from 'vitest'

import { AI_AGENTS_UPGRADE_URL, AI_AGENTS_URL, buildAiAgentsUpgradeUrl, buildAiAgentsUrl } from '../aiAgentsUrl'

describe('buildAiAgentsUrl', () => {
  it('builds the AI dashboard URL with the session token and project', () => {
    const url = buildAiAgentsUrl({
      accessToken: 'session-token',
      project: 'orderingplus'
    })

    const parsed = new URL(url)
    expect(`${parsed.origin}${parsed.pathname}`).toBe(AI_AGENTS_URL)
    expect(parsed.searchParams.get('access_token')).toBe('session-token')
    expect(parsed.searchParams.get('project')).toBe('orderingplus')
    expect(parsed.searchParams.get('token')).toBeNull()
  })

  it('encodes reserved characters in the token and project', () => {
    const url = buildAiAgentsUrl({
      accessToken: 'abc&def=ghi',
      project: 'ordering plus'
    })

    const parsed = new URL(url)
    expect(parsed.searchParams.get('access_token')).toBe('abc&def=ghi')
    expect(parsed.searchParams.get('project')).toBe('ordering plus')
    expect(url).not.toContain('access_token=abc&def')
  })

  it('returns null when the token or project is missing or blank', () => {
    expect(buildAiAgentsUrl({ accessToken: '', project: 'orderingplus' })).toBeNull()
    expect(buildAiAgentsUrl({ accessToken: '   ', project: 'orderingplus' })).toBeNull()
    expect(buildAiAgentsUrl({ accessToken: 'session-token', project: '' })).toBeNull()
    expect(buildAiAgentsUrl({ accessToken: 'session-token', project: '   ' })).toBeNull()
    expect(buildAiAgentsUrl({ project: 'orderingplus' })).toBeNull()
    expect(buildAiAgentsUrl({ accessToken: 'session-token' })).toBeNull()
    expect(buildAiAgentsUrl({})).toBeNull()
  })
})

describe('buildAiAgentsUpgradeUrl', () => {
  it('builds the upgrade form URL with the campaign, user email and project', () => {
    const url = buildAiAgentsUpgradeUrl({
      email: 'admin@example.com',
      project: 'orderingplus'
    })

    const parsed = new URL(url)
    expect(`${parsed.origin}${parsed.pathname}`).toBe(AI_AGENTS_UPGRADE_URL)
    expect(parsed.searchParams.get('utm_source')).toBe('ordering_dashboard')
    expect(parsed.searchParams.get('utm_medium')).toBe('sidebar')
    expect(parsed.searchParams.get('utm_campaign')).toBe('ai_agents_upgrade')
    expect(parsed.searchParams.get('email')).toBe('admin@example.com')
    expect(parsed.searchParams.get('ref')).toBe('orderingplus')
  })

  it('encodes reserved characters in the email', () => {
    const parsed = new URL(buildAiAgentsUpgradeUrl({ email: 'a+b@example.com', project: 'orderingplus' }))

    expect(parsed.searchParams.get('email')).toBe('a+b@example.com')
  })

  it('omits the email and project when they are missing or blank', () => {
    const parsed = new URL(buildAiAgentsUpgradeUrl({ email: '   ' }))

    expect(parsed.searchParams.has('email')).toBe(false)
    expect(parsed.searchParams.has('ref')).toBe(false)
    expect(parsed.searchParams.get('utm_campaign')).toBe('ai_agents_upgrade')
    expect(new URL(buildAiAgentsUpgradeUrl()).searchParams.has('email')).toBe(false)
  })

  it('never carries the session token', () => {
    const url = buildAiAgentsUpgradeUrl({ email: 'admin@example.com', project: 'orderingplus', accessToken: 'session-token' })

    expect(url).not.toContain('session-token')
  })
})
