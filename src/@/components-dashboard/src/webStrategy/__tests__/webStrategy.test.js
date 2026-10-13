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
