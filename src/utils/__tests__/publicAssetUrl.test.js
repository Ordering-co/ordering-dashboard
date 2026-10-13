import { describe, expect, it } from 'vitest'
import { publicAssetUrl } from '../publicAssetUrl'

describe('publicAssetUrl', () => {
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
