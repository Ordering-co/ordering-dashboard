import { describe, expect, it } from 'vitest'

import { AI_AGENTS_URL, buildAiAgentsUrl } from '../aiAgentsUrl'

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
