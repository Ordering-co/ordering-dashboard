import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AI_AGENTS_URL, buildAiAgentsUpgradeUrl, buildAiAgentsUrl, buildDashboardUpgradeUrl } from '../aiAgentsUrl'

describe('buildAiAgentsUrl', () => {
  it('builds the AI dashboard URL with the one-time code and project, never a session token', () => {
    const url = buildAiAgentsUrl({
      code: 'one-time-code',
      project: 'example-tenant',
      accessToken: 'session-token'
    })

    const parsed = new URL(url)
    expect(`${parsed.origin}${parsed.pathname}`).toBe(AI_AGENTS_URL)
    expect(parsed.searchParams.get('session_code')).toBe('one-time-code')
    expect(parsed.searchParams.has('code')).toBe(false)
    expect(parsed.searchParams.get('project')).toBe('example-tenant')
    expect(parsed.searchParams.has('access_token')).toBe(false)
    expect(parsed.searchParams.has('token')).toBe(false)
    expect(url).not.toContain('session-token')
  })

  it('encodes reserved characters in the code and project', () => {
    const url = buildAiAgentsUrl({
      code: 'abc&def=ghi',
      project: 'example tenant'
    })

    const parsed = new URL(url)
    expect(parsed.searchParams.get('session_code')).toBe('abc&def=ghi')
    expect(parsed.searchParams.get('project')).toBe('example tenant')
    expect(url).not.toContain('session_code=abc&def')
  })

  it('returns null when the code or project is missing or blank', () => {
    expect(buildAiAgentsUrl({ code: '', project: 'example-tenant' })).toBeNull()
    expect(buildAiAgentsUrl({ code: '   ', project: 'example-tenant' })).toBeNull()
    expect(buildAiAgentsUrl({ code: 'one-time-code', project: '' })).toBeNull()
    expect(buildAiAgentsUrl({ code: 'one-time-code', project: '   ' })).toBeNull()
    expect(buildAiAgentsUrl({ project: 'example-tenant' })).toBeNull()
    expect(buildAiAgentsUrl({ code: null, project: 'example-tenant' })).toBeNull()
    expect(buildAiAgentsUrl({ code: 'one-time-code' })).toBeNull()
    expect(buildAiAgentsUrl({ accessToken: 'session-token', project: 'example-tenant' })).toBeNull()
    expect(buildAiAgentsUrl({})).toBeNull()
  })
})

describe('upgrade form URLs', () => {
  const destination = 'https://forms.example.test/upgrade'
  const details = { email: 'dashboard@example.test', project: 'example-tenant', accessToken: 'test-session-token' }

  beforeEach(() => {
    vi.stubEnv('VITE_DASHBOARD_UPGRADE_FORM_URL', '')
    vi.stubEnv('VITE_DASHBOARD_UPGRADE_FORM_PREFILL', '')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('does not choose a third-party form without configured HTTPS', () => {
    expect(buildAiAgentsUpgradeUrl(details)).toBeNull()
    expect(buildDashboardUpgradeUrl(details)).toBeNull()
    for (const invalid of ['http://forms.example.test/upgrade', 'https://user:password@forms.example.test/', '/upgrade']) {
      vi.stubEnv('VITE_DASHBOARD_UPGRADE_FORM_URL', invalid)
      expect(buildAiAgentsUpgradeUrl(details)).toBeNull()
    }
  })

  it('retains both campaigns and keeps personal data out by default', () => {
    vi.stubEnv('VITE_DASHBOARD_UPGRADE_FORM_URL', destination + '?email=old%40example.test&ref=old-tenant')
    for (const [build, medium, campaign] of [
      [buildAiAgentsUpgradeUrl, 'sidebar', 'ai_agents_upgrade'],
      [buildDashboardUpgradeUrl, 'dashboard', 'legacy_plan_upgrade']
    ]) {
      const url = new URL(build(details))
      expect(url.origin + url.pathname).toBe(destination)
      expect(Object.fromEntries(url.searchParams)).toEqual({
        utm_source: 'ordering_dashboard',
        utm_medium: medium,
        utm_campaign: campaign
      })
    }
  })

  it('encodes the opt-in email and project and never forwards a session token', () => {
    vi.stubEnv('VITE_DASHBOARD_UPGRADE_FORM_URL', destination)
    vi.stubEnv('VITE_DASHBOARD_UPGRADE_FORM_PREFILL', 'true')
    const url = new URL(buildAiAgentsUpgradeUrl({ ...details, email: 'dashboard+qa@example.test' }))
    expect(url.searchParams.get('email')).toBe('dashboard+qa@example.test')
    expect(url.searchParams.get('ref')).toBe('example-tenant')
    expect(url.toString()).not.toContain('test-session-token')
    expect(new URL(buildDashboardUpgradeUrl({ email: '   ' })).searchParams.has('email')).toBe(false)
  })
})
