import { describe, expect, it, vi } from 'vitest'
import {
  consumeAutologinNotice,
  DASHBOARD_AUTOLOGIN_LEVELS,
  exchangeHandoffCode,
  getAutologinApplyResult,
  setAutologinNotice
} from '../autologinSession'

describe('getAutologinApplyResult', () => {
  it('keeps the existing tenant when autologin fails', () => {
    expect(getAutologinApplyResult({
      queryProject: 'project-b',
      queryToken: 'bad-token',
      apiError: true,
      user: {},
      fallbackProject: 'project-a'
    })).toEqual({
      persistSession: false,
      providerProject: 'project-a'
    })
  })

  it('persists a level 8 session, matching LoginForm allowedLevels', () => {
    expect(DASHBOARD_AUTOLOGIN_LEVELS).toEqual([0, 2, 5, 8])
    expect(getAutologinApplyResult({
      queryProject: 'project-b',
      queryToken: 'level-8-token',
      apiError: false,
      user: { id: 8, level: 8 },
      fallbackProject: 'project-a'
    })).toEqual({
      persistSession: true,
      providerProject: 'project-b'
    })
  })

  it('persists an admin session and applies the query tenant', () => {
    expect(getAutologinApplyResult({
      queryProject: 'project-b',
      queryToken: 'admin-token',
      apiError: false,
      user: { id: 1, level: 0 },
      fallbackProject: 'project-a'
    })).toEqual({
      persistSession: true,
      providerProject: 'project-b'
    })
  })
})

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(body)
})

describe('exchangeHandoffCode', () => {
  it('posts the code without authorization and returns the session token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {
      error: false,
      result: { id: 1, level: 0, session: { access_token: 'handoff-jwt', token_type: 'bearer', expires_in: 3600 } }
    }))

    await expect(exchangeHandoffCode({ apiRoot: 'https://api.test/v400/en/tenant', code: 'code-ok', fetchImpl }))
      .resolves.toBe('handoff-jwt')
    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/v400/en/tenant/auth/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'code-ok' })
    })
  })

  it('posts a code only once even when asked twice', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {
      error: false,
      result: { session: { access_token: 'single-jwt' } }
    }))

    const first = exchangeHandoffCode({ apiRoot: 'https://api.test', code: 'code-once', fetchImpl })
    const second = exchangeHandoffCode({ apiRoot: 'https://api.test', code: 'code-once', fetchImpl })

    await expect(first).resolves.toBe('single-jwt')
    await expect(second).resolves.toBe('single-jwt')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns null for an expired, used or unknown code', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, {
      error: true,
      result: ['The access link expired.'],
      error_codes: ['auth_handoff.invalid']
    }))

    await expect(exchangeHandoffCode({ apiRoot: 'https://api.test', code: 'code-expired', fetchImpl }))
      .resolves.toBeNull()
  })

  it('returns null when the request fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))

    await expect(exchangeHandoffCode({ apiRoot: 'https://api.test', code: 'code-offline', fetchImpl }))
      .resolves.toBeNull()
  })
})

describe('autologin notice', () => {
  it('is read only once', () => {
    setAutologinNotice('handoff_expired')

    expect(consumeAutologinNotice()).toBe('handoff_expired')
    expect(consumeAutologinNotice()).toBeNull()
  })
})
