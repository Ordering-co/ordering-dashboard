import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchProjectCode } from '../resolveProjectCode'

describe('fetchProjectCode', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('resolves the internal code behind an alias', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ error: false, result: { code: 'internal-code' } })
    }))
    expect(await fetchProjectCode('https://api.test/v400/en/public-alias')).toBe('internal-code')
  })

  it('returns null when the API reports an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ error: true, result: ['not found'] })
    }))
    expect(await fetchProjectCode('https://api.test/v400/en/missing')).toBeNull()
  })

  it('returns null when the response has no code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ error: false, result: { id: 1 } })
    }))
    expect(await fetchProjectCode('https://api.test/v400/en/demo')).toBeNull()
  })

  it('returns null without blocking on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await fetchProjectCode('https://api.test/v400/en/demo')).toBeNull()
  })
})
