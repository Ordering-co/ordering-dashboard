import { describe, expect, it } from 'vitest'

import { getLogoutClickEffects } from '../logoutClickEffects'

describe('getLogoutClickEffects', () => {
  it('clears the local session even when the logout API failed', () => {
    expect(getLogoutClickEffects({
      useDefaultSessionManager: true,
      apiFailed: true
    })).toEqual({
      shouldClearLocalSession: true,
      shouldNotifySuccess: true
    })
  })

  it('clears the local session when the logout API succeeded', () => {
    expect(getLogoutClickEffects({
      useDefaultSessionManager: true,
      apiFailed: false
    })).toEqual({
      shouldClearLocalSession: true,
      shouldNotifySuccess: true
    })
  })

  it('does not call default logout when a custom session manager is used', () => {
    expect(getLogoutClickEffects({
      useDefaultSessionManager: false,
      apiFailed: true
    })).toEqual({
      shouldClearLocalSession: false,
      shouldNotifySuccess: true
    })
  })
})
