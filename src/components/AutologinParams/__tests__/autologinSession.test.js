import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_AUTOLOGIN_LEVELS,
  getAutologinApplyResult
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
