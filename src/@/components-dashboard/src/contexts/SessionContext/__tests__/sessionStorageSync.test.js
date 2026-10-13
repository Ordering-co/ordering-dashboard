import { describe, expect, it } from 'vitest'

import { getSessionStorageSyncAction } from '../sessionStorageSync'

describe('getSessionStorageSyncAction', () => {
  it('logs out when storage was cleared but this tab still has a session token', () => {
    expect(getSessionStorageSyncAction({
      storageToken: null,
      sessionToken: 'tab-b-token'
    })).toBe('logout')
  })

  it('logs in when another tab persisted a token this tab does not have yet', () => {
    expect(getSessionStorageSyncAction({
      storageToken: 'new-token',
      sessionToken: null
    })).toBe('login')
  })

  it('does nothing when storage and memory already match', () => {
    expect(getSessionStorageSyncAction({
      storageToken: 'same-token',
      sessionToken: 'same-token'
    })).toBe('none')
    expect(getSessionStorageSyncAction({
      storageToken: null,
      sessionToken: null
    })).toBe('none')
  })

  it('replaces this tab session when another tab stored a different token', () => {
    expect(getSessionStorageSyncAction({
      storageToken: 'new-token',
      sessionToken: 'old-token'
    })).toBe('login')
  })

  it('reloads when another tab logged into a different project', () => {
    expect(getSessionStorageSyncAction({
      storageToken: 'new-token',
      sessionToken: null,
      storageProject: 'new-project',
      sessionProject: 'old-project'
    })).toBe('reload')
  })

  it('reloads when this tab is logged in and another tab switched project', () => {
    expect(getSessionStorageSyncAction({
      storageToken: 'new-token',
      sessionToken: 'old-token',
      storageProject: 'new-project',
      sessionProject: 'old-project'
    })).toBe('reload')
  })

  it('logs in without reload when the other tab used the same project', () => {
    expect(getSessionStorageSyncAction({
      storageToken: 'new-token',
      sessionToken: null,
      storageProject: 'same-project',
      sessionProject: 'same-project'
    })).toBe('login')
  })

  it('does not reload when only the stored project changed and the token did not', () => {
    expect(getSessionStorageSyncAction({
      storageToken: 'same-token',
      sessionToken: 'same-token',
      storageProject: 'typed-on-login-form',
      sessionProject: 'old-project'
    })).toBe('none')
  })
})
