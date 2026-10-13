/* eslint-disable import/first */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { showToast, t } = vi.hoisted(() => ({
  showToast: vi.fn(),
  t: (_key, fallback) => fallback
}))

vi.mock('~components', () => ({
  useLanguage: () => [null, t],
  useSession: () => [{ token: 'test-token' }],
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

import { useImportRawLogs } from '../useImportRawLogs'

describe('useImportRawLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('lists logs with Bearer auth and query params', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        logs: [
          {
            id: 'log-1',
            source: 'gloriafood',
            status: 'ready',
            downloadable: true,
            businessId: 42
          }
        ]
      })
    })

    const { result } = renderHook(() =>
      useImportRawLogs({ businessId: 42, enabled: true })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://menu-import.test/api/import-logs?businessId=42&project=demo&orderingApiBaseUrl=https%3A%2F%2Fapi.example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token'
        })
      })
    )
    expect(result.current.logs).toHaveLength(1)
    expect(result.current.logs[0].id).toBe('log-1')
  })

  it('downloads a log file via the proxy endpoint', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logs: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['{"ok":true}'], { type: 'application/json' }),
        headers: {
          get: (name) => (
            name === 'Content-Disposition'
              ? 'attachment; filename="gloriafood-42-20260728T120000Z.json"'
              : null
          )
        }
      })

    const click = vi.fn()
    const remove = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return { href: '', download: '', click, remove }
      }
      return originalCreateElement(tag)
    })
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()

    const { result } = renderHook(() =>
      useImportRawLogs({ businessId: 42, enabled: true })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.downloadLog({
        id: 'log-2',
        source: 'gloriafood',
        downloadable: true,
        businessId: 42
      })
    })

    expect(global.fetch).toHaveBeenLastCalledWith(
      'https://menu-import.test/api/import-logs/log-2/download?orderingApiBaseUrl=https%3A%2F%2Fapi.example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token'
        })
      })
    )
    expect(click).toHaveBeenCalled()
    expect(global.URL.createObjectURL).toHaveBeenCalled()
    createElementSpy.mockRestore()
  })

  it('deletes selected logs via DELETE /api/import-logs', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logs: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: 1, ids: ['log-9'] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logs: [] })
      })

    const { result } = renderHook(() =>
      useImportRawLogs({ businessId: 42, enabled: true })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteLogs(['log-9'])
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://menu-import.test/api/import-logs',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          logIds: ['log-9'],
          businessId: 42,
          project: 'demo',
          orderingApiBaseUrl: 'https://api.example.com'
        })
      })
    )
    expect(showToast).toHaveBeenCalledWith('SUCCESS', 'Log deleted.')
  })
})
