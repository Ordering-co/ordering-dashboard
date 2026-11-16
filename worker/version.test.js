import { describe, expect, it } from 'vitest'

import worker from './index.js'
import { buildVersionPayload } from './version.js'

describe('buildVersionPayload', () => {
  it('passes through a valid 40-hex commit SHA and formats built_at without milliseconds', () => {
    const sha = 'a'.repeat(40)
    const payload = buildVersionPayload({ WORKERS_CI_COMMIT_SHA: sha }, new Date('2026-11-09T12:34:56.789Z'))
    expect(payload).toEqual({ commit: sha, built_at: '2026-11-09T12:34:56Z' })
  })

  it('falls back to a null commit when the var is missing or not 40 lowercase hex chars', () => {
    expect(buildVersionPayload({}).commit).toBeNull()
    expect(buildVersionPayload({ WORKERS_CI_COMMIT_SHA: 'ABCDEF' }).commit).toBeNull()
    expect(buildVersionPayload({ WORKERS_CI_COMMIT_SHA: 'a'.repeat(39) }).commit).toBeNull()
  })
})

describe('GET /version', () => {
  const call = assets => worker.fetch(new Request('https://dashboard.ordering.co/version'), { ASSETS: { fetch: assets } }, {})

  it('serves dist/version.json with no-store, bypassing the SPA/asset pipeline', async () => {
    const sha = 'b'.repeat(40)
    const response = await call(async request => {
      expect(new URL(request.url).pathname).toBe('/version.json')
      return Response.json({ commit: sha, built_at: '2026-11-09T12:00:00Z' })
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(await response.json()).toEqual({ commit: sha, built_at: '2026-11-09T12:00:00Z' })
  })

  it('answers unknown when the build wrote no version.json', async () => {
    const response = await call(async () => new Response('not found', { status: 404 }))
    expect(await response.json()).toEqual({ commit: null, built_at: null })
  })
})
