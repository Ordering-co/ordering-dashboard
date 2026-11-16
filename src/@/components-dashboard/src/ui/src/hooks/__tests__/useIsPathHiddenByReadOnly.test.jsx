/* eslint-disable import/first */
// (R-4): the shortcuts to Settings ask this hook, which is the guard of (`isHiddenByReadOnly`) with the
// user, the configs and the project read the way src/App.js reads them. It does not change which levels see what.
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ user: null, configs: {}, project: 'demo' }))

vi.mock('../../../../index', () => ({
  useSession: () => [{ user: mockState.user }],
  useConfig: () => [{ configs: mockState.configs }],
  useApi: () => [{ project: mockState.project }]
}))

import { useIsPathHiddenByReadOnly } from '../useIsPathHiddenByReadOnly'

const SLA = '/settings?group=orders&category=enterprise_orders_slas'
const MAPS = '/settings?group=locations&category=google_maps'

describe('useIsPathHiddenByReadOnly', () => {
  beforeEach(() => {
    mockState.user = null
    mockState.configs = {}
    mockState.project = 'demo'
  })

  it('hides the Settings paths from a readOnlyAdmin', () => {
    mockState.user = { level: 0, readOnlyAdmin: true }
    expect(renderHook(() => useIsPathHiddenByReadOnly(SLA)).result.current).toBe(true)
    expect(renderHook(() => useIsPathHiddenByReadOnly(MAPS)).result.current).toBe(true)
  })

  it('keeps the Settings paths for the admin of level 0', () => {
    mockState.user = { level: 0 }
    expect(renderHook(() => useIsPathHiddenByReadOnly(SLA)).result.current).toBe(false)
    expect(renderHook(() => useIsPathHiddenByReadOnly(MAPS)).result.current).toBe(false)
  })

  it('does not hide a page the read-only admin still has', () => {
    mockState.user = { level: 0, readOnlyAdmin: true }
    expect(renderHook(() => useIsPathHiddenByReadOnly('/orders')).result.current).toBe(false)
  })

  it('is false while there is no user', () => {
    expect(renderHook(() => useIsPathHiddenByReadOnly(SLA)).result.current).toBe(false)
  })
})
