/* eslint-disable import/first */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../config', () => ({
  default: { api: { url: 'https://api.test', version: 'v1' } }
}))

import { getIntercomHash, setIntercomSettings } from '..'
import { setIntercomAccess } from '../../../@/components-dashboard/src/ui/src/utils/assistantIntercom'

describe('Intercom support helpers', () => {
  beforeEach(() => {
    setIntercomAccess(true, 'utils-fixture')
    window.intercomSettings = { existing: 'kept' }
    window.Intercom = vi.fn()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    setIntercomAccess(false)
    delete window.intercomSettings
    delete window.Intercom
    vi.unstubAllGlobals()
  })

  // main the payload merges as before, Intercom boots only with a verified user_hash, nothing is written while
  // Intercom is not allowed or for plan 581, and Ordering.co staff are no longer skipped
  it('merges the legacy user payload and boots only with a verified hash', () => {
    const user = {
      id: 7,
      user_system_id: 99,
      created_at: '2024-01-02 03:04:05',
      email_verified: true,
      language_id: 1,
      level: 0
    }
    setIntercomSettings({ email: 'owner@example.com', name: 'Ada' }, user)

    expect(window.intercomSettings).toEqual(expect.objectContaining({
      existing: 'kept',
      email: 'owner@example.com',
      name: 'Ada',
      billing_user_id: 99,
      is_billing_user: true,
      dashboard_user_id: 7,
      created_at: '2024-01-02 03:04:05',
      email_verified: true,
      language_id: 1,
      level: 0
    }))
    expect(window.Intercom).not.toHaveBeenCalled()

    setIntercomSettings({ user_hash: 'hash-7' })
    expect(window.intercomSettings.user_hash).toBe('hash-7')
    expect(window.Intercom).toHaveBeenCalledWith('boot', window.intercomSettings)
  })

  it('writes nothing for plan 581 or while Intercom is not allowed', () => {
    const before = window.intercomSettings
    setIntercomSettings({ email: 'owner@example.com', project_plan: 581, user_hash: 'hash-7' })
    expect(window.intercomSettings).toBe(before)
    setIntercomAccess(false)
    setIntercomSettings({ email: 'owner@example.com', user_hash: 'hash-7' })
    expect(window.intercomSettings?.user_hash).toBeUndefined()
  })

  it('requests and returns the hash without making incomplete or failed requests observable', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ error: false, result: { intercom_hash: 'hash-7' } })
    })

    await expect(getIntercomHash({ userId: 'owner@example.com', token: 'token-7' })).resolves.toBe('hash-7')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/v1/system/integrations/intercom/hash',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-7'
        },
        body: JSON.stringify({ user_email: 'owner@example.com' })
      }
    )

    fetch.mockClear()
    await expect(getIntercomHash({ userId: '', token: 'token-7' })).resolves.toBeNull()
    await expect(getIntercomHash({ userId: 'owner@example.com', token: '' })).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()

    fetch.mockRejectedValueOnce(new Error('offline'))
    await expect(getIntercomHash({ userId: 'owner@example.com', token: 'token-7' })).resolves.toBeNull()
  })
})
