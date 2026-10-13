import { beforeEach, describe, expect, it } from 'vitest'
import { getStoredLanguageCode, resolveInitialProject } from '../storage'

describe('getStoredLanguageCode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the persisted language code', () => {
    localStorage.setItem('language', JSON.stringify({ code: 'es' }))

    expect(getStoredLanguageCode()).toBe('es')
  })

  it('falls back to English and removes a corrupt language value', () => {
    localStorage.setItem('language', '[object Object]')
    localStorage.setItem('token', 'valid-token')

    expect(getStoredLanguageCode()).toBe('en')
    expect(localStorage.getItem('language')).toBeNull()
    expect(localStorage.getItem('token')).toBe('valid-token')
  })

  it('removes a valid JSON value with an invalid language shape', () => {
    localStorage.setItem('language', JSON.stringify({ id: 1 }))

    expect(getStoredLanguageCode()).toBe('en')
    expect(localStorage.getItem('language')).toBeNull()
  })
})

describe('resolveInitialProject', () => {
  it('uses the stored project when present', () => {
    expect(resolveInitialProject({
      auth: null,
      storedProject: 'tenant-a',
      settingsProject: 'orderingplus',
      useProjectDomain: false
    })).toBe('tenant-a')
  })

  it('falls back to the config project in a clean browser', () => {
    expect(resolveInitialProject({
      auth: null,
      storedProject: null,
      settingsProject: 'orderingplus',
      useProjectDomain: false
    })).toBe('orderingplus')
  })

  it('keeps project null while resolving a project-domain host', () => {
    expect(resolveInitialProject({
      auth: null,
      storedProject: null,
      settingsProject: 'orderingplus',
      useProjectDomain: true
    })).toBeNull()
  })
})
