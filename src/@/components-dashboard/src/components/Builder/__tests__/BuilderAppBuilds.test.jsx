import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({
  getBuilderProduct: vi.fn(),
  getBuilderAppChecks: vi.fn(),
  getBuilderLatestBuilds: vi.fn(),
  requestBuilderBuild: vi.fn(),
  cancelBuilderBuild: vi.fn(),
  updateBuilderProductStatus: vi.fn(),
  listBuilderBuilds: vi.fn()
}))

const sockets = vi.hoisted(() => {
  const handlers = {}
  return {
    handlers,
    socket: {
      on: vi.fn((event, handler) => { handlers[event] = handler }),
      off: vi.fn((event) => { delete handlers[event] }),
      join: vi.fn(),
      leave: vi.fn()
    },
    io: { connected: true, on: vi.fn(), off: vi.fn() }
  }
})

vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'http://api/v400/en/development', project: 'development' }] }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok', user: { id: 7 } }] }))
vi.mock('../../../contexts/WebsocketContext', () => ({
  useWebsocket: () => sockets.socket,
  useSocketInstance: () => sockets.io
}))
vi.mock('../builderApi', async () => {
  const actual = await vi.importActual('../builderApi')
  const wrapped = Object.fromEntries(Object.keys(api).map(name => [name, (...args) => api[name](...args)]))
  return { ...actual, ...wrapped }
})

import { BuilderProductDetail } from '../BuilderProductDetail'
import { BuilderAppBuilds } from '../BuilderAppBuilds'

const ok = (result, extra = {}) => ({ error: false, status: 200, result, errorCodes: [], ...extra })
const fail = (status, errorCodes, checks) => ({ error: true, status, result: ['x'], errorCodes, checks })
const product = { id: 41, name: 'Repartidores', product_status: 'draft', apps: [{ id: 310 }] }
const attempt = (fields) => ({ id: 1, platform: 'ios', mode: 'ad-hoc', type: null, status: 'pending', ...fields })
const latest = {
  app_id: 310,
  platforms: {
    ios: { latest: attempt({ id: 5, status: 'building' }), successful: null, pending_changes: null },
    android: { latest: null, successful: null, pending_changes: null }
  }
}

const renderDetail = async () => {
  const ui = { current: null }
  const UIComponent = (props) => { ui.current = props; return null }
  render(<BuilderProductDetail UIComponent={UIComponent} productId='41' />)
  await waitFor(() => expect(ui.current.latestBuildsState.platforms).toBeTruthy())
  return ui
}

describe('BuilderProductDetail builds', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset())
    api.getBuilderProduct.mockResolvedValue(ok(product))
    api.getBuilderAppChecks.mockResolvedValue(ok({ platforms: {} }))
    api.getBuilderLatestBuilds.mockResolvedValue(ok(latest))
    sockets.socket.join.mockClear()
  })

  afterEach(() => vi.useRealTimers())

  it('loads where each platform stands and joins the builds room', async () => {
    const ui = await renderDetail()
    expect(api.getBuilderLatestBuilds).toHaveBeenCalledWith(expect.anything(), 'tok', '41', 310)
    expect(ui.current.latestBuildsState.platforms.ios.latest.status).toBe('building')
    expect(sockets.socket.join).toHaveBeenCalledWith({ project: 'development', room: 'builder_app_builds', user_id: 7, role: 'manager' })
    expect(ui.current.adHocInstallUrl).toBe('http://api/v400/en/development/builder/apps/310/downloads/ios/ad-hoc/ipa')
  })

  it('shows a requested build as the latest and reloads the history', async () => {
    api.requestBuilderBuild.mockResolvedValueOnce(ok(attempt({ id: 6, platform: 'android', mode: 'release', type: 'bundle' })))
    const ui = await renderDetail()
    const version = ui.current.buildsHistoryVersion
    let answer
    await act(async () => { answer = await ui.current.requestBuild('android', { mode: 'release', type: 'bundle' }) })
    expect(api.requestBuilderBuild).toHaveBeenCalledWith(expect.anything(), 'tok', '41', 310, { platform: 'android', mode: 'release', type: 'bundle' })
    expect(answer.ok).toBe(true)
    expect(ui.current.latestBuildsState.platforms.android.latest.id).toBe(6)
    expect(ui.current.buildsHistoryVersion).toBe(version + 1)
  })

  it('answers what blocks a build, and reloads when the screen was behind', async () => {
    const checks = [{ code: 'missing_file', level: 'warning', platform: 'android' }]
    api.requestBuilderBuild.mockResolvedValueOnce(fail(400, ['build.blocked'], checks))
    const ui = await renderDetail()
    let answer
    await act(async () => { answer = await ui.current.requestBuild('android', { mode: 'release', type: 'assemble' }) })
    expect(answer).toEqual({ ok: false, result: null, errorCodes: ['build.blocked'], checks })
    expect(api.getBuilderLatestBuilds).toHaveBeenCalledTimes(1)

    api.requestBuilderBuild.mockResolvedValueOnce(fail(400, ['build.in_progress']))
    await act(async () => { await ui.current.requestBuild('ios', { mode: 'ad-hoc' }) })
    expect(api.getBuilderLatestBuilds).toHaveBeenCalledTimes(2)
  })

  it('cancels and keeps the cancelled attempt as the latest', async () => {
    api.cancelBuilderBuild.mockResolvedValueOnce(ok(attempt({ id: 5, status: 'cancelled' })))
    const ui = await renderDetail()
    await act(async () => { await ui.current.cancelBuild(attempt({ id: 5, status: 'building' })) })
    expect(api.cancelBuilderBuild).toHaveBeenCalledWith(expect.anything(), 'tok', '41', 310, 5)
    expect(ui.current.latestBuildsState.platforms.ios.latest.status).toBe('cancelled')
  })

  it('answers what an app misses when activating is refused', async () => {
    const checks = [{ app_id: 310, errors: 0, warnings: 1, platforms: { ios: { problems: [] } } }]
    api.updateBuilderProductStatus.mockResolvedValueOnce(fail(400, ['product.incomplete'], checks))
    const ui = await renderDetail()
    let result
    await act(async () => { result = await ui.current.changeStatus('active') })
    expect(result).toEqual({ product: null, errorKind: 'incomplete', checks, missing: [] })
    expect(ui.current.productState.product.product_status).toBe('draft')
  })

  it('answers what a website misses itself when activating is refused', async () => {
    api.updateBuilderProductStatus.mockResolvedValueOnce({ ...fail(400, ['product.incomplete'], []), missing: ['name'] })
    const ui = await renderDetail()
    let result
    await act(async () => { result = await ui.current.changeStatus('active') })
    expect(result).toEqual({ product: null, errorKind: 'incomplete', checks: [], missing: ['name'] })
  })

  it('follows app_build_change: patches a status and reloads once a build ends', async () => {
    const ui = await renderDetail()
    vi.useFakeTimers()
    act(() => { sockets.handlers.app_build_change({ builder_app_id: 999, platform: 'ios', changes: [{ attribute: 'status', new: 'failed' }] }) })
    expect(ui.current.latestBuildsState.platforms.ios.latest.status).toBe('building')

    act(() => { sockets.handlers.app_build_change({ builder_app_id: 310, platform: 'ios', changes: [{ attribute: 'status', old: 'building', new: 'finishing' }] }) })
    expect(ui.current.latestBuildsState.platforms.ios.latest.status).toBe('finishing')
    expect(api.getBuilderLatestBuilds).toHaveBeenCalledTimes(1)

    act(() => { sockets.handlers.app_build_change({ builder_app_id: 310, platform: 'ios', changes: [{ attribute: 'status', new: 'successful' }] }) })
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(api.getBuilderLatestBuilds).toHaveBeenCalledTimes(2)
  })

  it('shows a build cancelled elsewhere as cancelled, not failed', async () => {
    const ui = await renderDetail()
    vi.useFakeTimers()
    act(() => {
      sockets.handlers.app_build_change({
        builder_app_id: 310,
        platform: 'ios',
        changes: [{ attribute: 'status', old: 'building', new: 'failed' }, { attribute: 'error_code', old: null, new: 'build_cancelled' }]
      })
    })
    expect(ui.current.latestBuildsState.platforms.ios.latest.status).toBe('cancelled')
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(api.getBuilderLatestBuilds).toHaveBeenCalledTimes(2)
  })

  it('checks again for pending changes after a save, only when a build could be behind', async () => {
    api.getBuilderLatestBuilds.mockResolvedValue(ok({
      platforms: { ios: { latest: attempt({ status: 'successful' }), successful: attempt({ status: 'successful' }), pending_changes: false } }
    }))
    const ui = await renderDetail()
    vi.useFakeTimers()
    act(() => { ui.current.onAppChanged() })
    act(() => { ui.current.onAppChanged() })
    await act(async () => { vi.advanceTimersByTime(1500) })
    expect(api.getBuilderLatestBuilds).toHaveBeenCalledTimes(2)
  })
})

describe('BuilderAppBuilds history controller', () => {
  beforeEach(() => {
    api.listBuilderBuilds.mockReset().mockResolvedValue(ok([attempt({ id: 3 })], { pagination: { total_pages: 3 } }))
  })

  const renderHistory = async (props = {}) => {
    const ui = { current: null }
    const UIComponent = (uiProps) => { ui.current = uiProps; return null }
    const view = render(<BuilderAppBuilds UIComponent={UIComponent} productId={41} appId={310} version={0} {...props} />)
    await waitFor(() => expect(ui.current.historyState.loading).toBe(false))
    return { ui, view }
  }

  it('lists the first page, and filters from the first page again', async () => {
    const { ui } = await renderHistory()
    expect(api.listBuilderBuilds).toHaveBeenLastCalledWith(expect.anything(), 'tok', 41, 310, { page: 1, pageSize: 10, platform: null, statuses: [] })
    expect(ui.current.historyState.builds).toHaveLength(1)

    await act(async () => { ui.current.changePage(2) })
    await act(async () => { ui.current.changeFilters({ statuses: ['pending', 'queued'] }) })
    expect(api.listBuilderBuilds).toHaveBeenLastCalledWith(expect.anything(), 'tok', 41, 310, { page: 1, pageSize: 10, platform: null, statuses: ['pending', 'queued'] })
  })

  it('reloads when the version moves', async () => {
    const { view } = await renderHistory()
    const calls = api.listBuilderBuilds.mock.calls.length
    const UIComponent = () => null
    await act(async () => { view.rerender(<BuilderAppBuilds UIComponent={UIComponent} productId={41} appId={310} version={1} />) })
    expect(api.listBuilderBuilds.mock.calls.length).toBe(calls + 1)
  })
})
