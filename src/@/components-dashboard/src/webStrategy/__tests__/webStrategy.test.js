import { beforeEach, describe, expect, it } from 'vitest'
import { getLocalStorageItem, WebStrategy } from '..'

describe('WebStrategy', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reads valid JSON values', async () => {
    const strategy = new WebStrategy()
    localStorage.setItem('language', JSON.stringify({ code: 'es' }))

    expect(getLocalStorageItem('language', true)).toEqual({ code: 'es' })
    expect(await strategy.getItem('language', true)).toEqual({ code: 'es' })
  })

  it.each(['', 'undefined', '[object Object]', '{"code":"es"'])(
    'removes a malformed JSON value without clearing other keys',
    (value) => {
      localStorage.setItem('language', value)
      localStorage.setItem('project', 'rokys')

      expect(getLocalStorageItem('language', true)).toBeNull()
      expect(localStorage.getItem('language')).toBeNull()
      expect(localStorage.getItem('project')).toBe('rokys')
    }
  )

  it('returns null when the key is absent', () => {
    expect(getLocalStorageItem('user', true)).toBeNull()
  })
})

describe('local project storage isolation', () => {
  it('never consumes or deletes another tenant global identity and restores only its scoped session', async () => {
    localStorage.clear()
    localStorage.setItem('token', 'other-token')
    localStorage.setItem('user', JSON.stringify({ id: 99, level: 0 }))
    localStorage.setItem('project', 'tenant-b')
    localStorage.setItem('drivers_cache_99', 'other-cache')
    const settings = { localProjectConfigured: true, local_project_pin: 'tenant-a', api: { url: 'https://api.test', version: 'v400' } }
    const a = new WebStrategy(settings)
    const b = new WebStrategy({ ...settings, localProjectConfigured: true, local_project_pin: 'tenant-b' })
    expect(await a.getItem('token')).toBeNull()
    await a.setItem('token', 'a-token')
    await a.setItem('user', { id: 1 }, true)
    expect(await new WebStrategy(settings).getItem('token')).toBe('a-token')
    expect(await a.getItem('user', true)).toEqual({ id: 1 })
    expect(await b.getItem('token')).toBeNull()
    await a.removeItem('token')
    expect(localStorage.getItem('token')).toBe('other-token')
    expect(localStorage.getItem('drivers_cache_99')).toBe('other-cache')
  })
})
