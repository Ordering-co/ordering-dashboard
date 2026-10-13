import { describe, expect, it, vi } from 'vitest'
import { openBuildLogs } from '../buildLogs'

const root = 'https://api.example.com/v400/en/demo'
const jsonResponse = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

const makeWin = (tab = { close: vi.fn() }) => ({ open: vi.fn(() => tab), tab })

describe('openBuildLogs', () => {
  it('opens the tab before the request, then points it at the signed URL', async () => {
    const win = makeWin()
    const fetchImpl = vi.fn(() => {
      expect(win.open).toHaveBeenCalledWith('', '_blank')
      return jsonResponse({ error: false, result: { log_token: 'a.b+c/=', expires_at: '2026-10-06 12:05:00' } })
    })

    const res = await openBuildLogs({ root, appId: 7, platform: 'ios', token: 'session-token', fetchImpl, win })

    expect(fetchImpl).toHaveBeenCalledWith(`${root}/builder/apps/7/ios/logs/link`, {
      method: 'GET',
      headers: { Authorization: 'Bearer session-token' }
    })
    const url = `${root}/builder/apps/7/ios/logs?log_token=a.b%2Bc%2F%3D`
    expect(win.tab.location).toBe(url)
    expect(win.tab.opener).toBeNull()
    expect(win.tab.close).not.toHaveBeenCalled()
    expect(res).toEqual({ error: false, url })
  })

  it('requests a fresh token on every click', async () => {
    const win = makeWin()
    const fetchImpl = vi.fn(() => jsonResponse({ error: false, result: { log_token: 't' } }))

    await openBuildLogs({ root, appId: 7, platform: 'android', token: 's', fetchImpl, win })
    await openBuildLogs({ root, appId: 7, platform: 'android', token: 's', fetchImpl, win })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('closes the tab and returns the API error when the app is not in the project', async () => {
    const win = makeWin()
    const fetchImpl = vi.fn(() => jsonResponse({ error: true, result: ['App not found.'] }))

    const res = await openBuildLogs({ root, appId: 99, platform: 'web', token: 's', fetchImpl, win })

    expect(win.tab.close).toHaveBeenCalled()
    expect(win.tab.location).toBeUndefined()
    expect(res).toEqual({ error: true, message: 'App not found.' })
  })

  it('closes the tab when the request fails', async () => {
    const win = makeWin()
    const fetchImpl = vi.fn(() => Promise.reject(new Error('Failed to fetch')))

    const res = await openBuildLogs({ root, appId: 7, platform: 'ios', token: 's', fetchImpl, win })

    expect(win.tab.close).toHaveBeenCalled()
    expect(res).toEqual({ error: true, message: 'Failed to fetch' })
  })

  it('falls back to opening the signed URL when the blank tab was blocked', async () => {
    const win = { open: vi.fn(() => null) }
    const fetchImpl = vi.fn(() => jsonResponse({ error: false, result: { log_token: 't' } }))

    const res = await openBuildLogs({ root, appId: 7, platform: 'ios', token: 's', fetchImpl, win })

    expect(win.open).toHaveBeenLastCalledWith(`${root}/builder/apps/7/ios/logs?log_token=t`, '_blank', 'noopener')
    expect(res.error).toBe(false)
  })
})
