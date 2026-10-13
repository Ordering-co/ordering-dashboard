import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({
  getBuilderProductDomain: vi.fn(),
  saveBuilderProductDomain: vi.fn(),
  removeBuilderProductDomain: vi.fn(),
  verifyBuilderProductDomain: vi.fn()
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

import { BuilderProductDomain, DOMAIN_POLL_MS } from '../BuilderProductDomain'

const ok = (result) => ({ error: false, status: 200, result, errorCodes: [] })
const fail = (status, errorCodes, extra = {}) => ({ error: true, status, result: ['x'], errorCodes, ...extra })
const domain = (own = null) => ({ domain: { temporal_domain: 'fleet-mountain-7zoeit-stores.my-sites.app', cname_target: 'cname.my-sites.app', own } })
const pending = { name: 'shop.burgertown.com', status: 'pending', error_code: null }

const renderController = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => { ui.current = uiProps; return null }
  const view = render(<BuilderProductDomain UIComponent={UIComponent} productId={43} {...props} />)
  await waitFor(() => expect(ui.current.domainState.loading).toBe(false))
  return { ui, view }
}

describe('BuilderProductDomain controller', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset())
    sockets.socket.join.mockClear()
    sockets.socket.leave.mockClear()
    api.getBuilderProductDomain.mockResolvedValue(ok(domain()))
  })
  afterEach(() => { vi.useRealTimers() })

  it('loads the domains and joins the sites room', async () => {
    const { ui } = await renderController()
    expect(api.getBuilderProductDomain).toHaveBeenCalledWith(expect.anything(), 'tok', 43)
    expect(ui.current.domainState.domain.temporal_domain).toBe('fleet-mountain-7zoeit-stores.my-sites.app')
    expect(sockets.socket.join).toHaveBeenCalledWith({ project: 'development', room: 'sites', user_id: 7, role: 'manager' })
  })

  it('saves a domain and takes the answer as the state', async () => {
    api.saveBuilderProductDomain.mockResolvedValueOnce(ok(domain(pending)))
    const { ui } = await renderController()
    let answer
    await act(async () => { answer = await ui.current.saveDomain('https://Shop.Burgertown.com/') })
    expect(api.saveBuilderProductDomain).toHaveBeenCalledWith(expect.anything(), 'tok', 43, 'https://Shop.Burgertown.com/')
    expect(answer).toEqual({ ok: true, errorCodes: [], cnameTarget: null, own: pending })
    expect(ui.current.domainState.domain.own).toEqual(pending)
    expect(ui.current.domainAction).toBe(null)
  })

  it('answers a missing CNAME record with where it must point', async () => {
    api.saveBuilderProductDomain.mockResolvedValueOnce(fail(400, ['domain.cname_missing'], { cnameTarget: 'cname.my-sites.app' }))
    const { ui } = await renderController()
    let answer
    await act(async () => { answer = await ui.current.saveDomain('shop.burgertown.com') })
    expect(answer).toEqual({ ok: false, errorCodes: ['domain.cname_missing'], cnameTarget: 'cname.my-sites.app', own: null })
    expect(ui.current.domainState.domain.own).toBe(null)
  })

  it('replaces the page when the product is gone', async () => {
    const onPageFailure = vi.fn()
    api.removeBuilderProductDomain.mockResolvedValueOnce(fail(404, ['product.not_found']))
    const { ui } = await renderController({ onPageFailure })
    await act(async () => { await ui.current.removeDomain() })
    expect(onPageFailure).toHaveBeenCalledWith('not_found')
  })

  it('reads again when verifying finds no domain any more', async () => {
    api.getBuilderProductDomain.mockResolvedValueOnce(ok(domain({ ...pending, status: 'error', error_code: 'validation_timeout' })))
    api.verifyBuilderProductDomain.mockResolvedValueOnce(fail(400, ['domain.not_set']))
    const { ui } = await renderController()
    await act(async () => { await ui.current.verifyDomain() })
    await waitFor(() => expect(ui.current.domainState.domain.own).toBe(null))
    expect(api.getBuilderProductDomain).toHaveBeenCalledTimes(2)
  })

  it('reads a pending domain again every 30 s until it is active', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getBuilderProductDomain.mockResolvedValueOnce(ok(domain(pending)))
    const { ui } = await renderController()
    api.getBuilderProductDomain.mockResolvedValueOnce(ok(domain({ ...pending, status: 'active' })))
    await act(async () => { vi.advanceTimersByTime(DOMAIN_POLL_MS) })
    expect(api.getBuilderProductDomain).toHaveBeenCalledTimes(2)
    expect(ui.current.domainState.domain.own.status).toBe('active')
    expect(ui.current.domainState.loading).toBe(false)

    await act(async () => { vi.advanceTimersByTime(DOMAIN_POLL_MS * 2) })
    expect(api.getBuilderProductDomain).toHaveBeenCalledTimes(2)
  })

  it('reads again when its site brings certificate changes', async () => {
    await renderController()
    vi.useFakeTimers()
    act(() => { sockets.handlers.sites_update({ id: 99, ssl_status: 'issued' }) })
    act(() => { sockets.handlers.sites_update({ id: 43, name: 'Burger Town' }) })
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(api.getBuilderProductDomain).toHaveBeenCalledTimes(1)

    act(() => { sockets.handlers.sites_update({ id: 43, ssl_status: 'issued' }) })
    act(() => { sockets.handlers.sites_update({ id: 43, ssl_process_status: 'ended' }) })
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(api.getBuilderProductDomain).toHaveBeenCalledTimes(2)
  })

  it('keeps what it shows when a background read fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getBuilderProductDomain.mockResolvedValueOnce(ok(domain(pending)))
    const { ui } = await renderController()
    api.getBuilderProductDomain.mockResolvedValueOnce(fail(0, []))
    await act(async () => { vi.advanceTimersByTime(DOMAIN_POLL_MS) })
    expect(api.getBuilderProductDomain).toHaveBeenCalledTimes(2)
    expect(ui.current.domainState).toEqual({ loading: false, domain: domain(pending).domain, error: false })
  })

  it('leaves the sites room on unmount', async () => {
    const { view } = await renderController()
    view.unmount()
    expect(sockets.socket.leave).toHaveBeenCalledWith({ project: 'development', room: 'sites', user_id: 7, role: 'manager' })
  })
})
