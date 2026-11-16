import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicAssetUrl } from '../publicAssetUrl'

describe('publicAssetUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('applies a subpath exactly once to both public and already resolved assets', () => {
    vi.stubEnv('BASE_URL', '/pilot/')
    expect(publicAssetUrl('/brand/logo.svg')).toBe('/pilot/brand/logo.svg')
    expect(publicAssetUrl('/pilot/brand/logo.svg')).toBe('/pilot/brand/logo.svg')
    expect(publicAssetUrl('/pilot-other/logo.svg')).toBe('/pilot/pilot-other/logo.svg')
    expect(publicAssetUrl('https://tenant.example/pilot/logo.svg')).toBe('https://tenant.example/pilot/logo.svg')
  })
  it('returns empty values unchanged', () => {
    expect(publicAssetUrl('')).toBe('')
    expect(publicAssetUrl(null)).toBe(null)
  })

  it('leaves absolute and data URLs unchanged', () => {
    expect(publicAssetUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png')
    expect(publicAssetUrl('//cdn.example/a.png')).toBe('//cdn.example/a.png')
    expect(publicAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })

  it('prefixes root-relative paths with base', () => {
    expect(publicAssetUrl('/img/a.png')).toMatch(/\/img\/a\.png$/)
    expect(publicAssetUrl('img/a.png')).toMatch(/img\/a\.png$/)
  })
})
