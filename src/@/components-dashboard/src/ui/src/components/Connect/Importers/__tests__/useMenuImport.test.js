/* eslint-disable import/first */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { showToast } = vi.hoisted(() => ({
  showToast: vi.fn()
}))

vi.mock('~components', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ token: 'test-token', user: { email: 'owner@test.com' } }],
  useApi: () => [{ project: 'demo', root: 'https://api.example.com' }],
  useToast: () => [null, { showToast }],
  ToastType: {
    Error: 'ERROR',
    Success: 'SUCCESS'
  }
}))

vi.mock('../menuImportConfig.js', () => ({
  getMenuImportApiUrl: () => 'https://menu-import.test'
}))

const { logMenuImportSync } = vi.hoisted(() => ({
  logMenuImportSync: vi.fn()
}))

vi.mock('../logMenuImportSync.js', () => ({
  logMenuImportSync
}))

import { useMenuImport } from '../useMenuImport'

describe('useMenuImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('posts import params to the menu-import service', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    })

    const { result } = renderHook(() => useMenuImport('doordash'))
    const params = {
      doordashUrl: 'https://www.doordash.com/store/test',
      businessIds: [42],
      project: 'demo',
      orderingApiBaseUrl: 'https://api.example.com',
      useFixture: false
    }

    await act(async () => {
      await result.current.triggerImport(params)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://menu-import.test/api/import/doordash',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token'
        })
      })
    )
    expect(logMenuImportSync).toHaveBeenCalledWith({
      token: 'test-token',
      source: 'doordash',
      params
    })
    expect(showToast).toHaveBeenCalledWith(
      'SUCCESS',
      'Menu imported successfully'
    )
  })

  it('strips gloriafoodMasterKey from the menu-import API body', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    })

    const { result } = renderHook(() => useMenuImport('gloriafood'))

    await act(async () => {
      await result.current.triggerImport({
        gloriafoodRestaurantKey: 'res-1',
        gloriafoodMasterKey: 'mas-1',
        ignoreGloriaFoodForceLimits: true,
        businessIds: [7],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com'
      })
    })

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.gloriafoodRestaurantKey).toBe('res-1')
    expect(body.gloriafoodMasterKey).toBeUndefined()
    expect(body.ignoreGloriaFoodForceLimits).toBe(true)
    expect(logMenuImportSync).toHaveBeenCalled()
  })
})
