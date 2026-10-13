import React from 'react'
import { webcrypto } from 'node:crypto'
import { act, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { catalogResponse, jsonResponse, sourceProduct, zipResponse } from './fixtures'

const state = vi.hoisted(() => ({ session: {}, language: {}, logout: vi.fn() }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [state.session, { logout: state.logout }] }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [state.language, (_key, fallback) => fallback] }))

import { SourceCodeDownloads, formatSourceCodeProduct, readSourceCodeCatalog, sourceRequestHeaders } from '../index'

let latest
const CaptureUI = props => { latest = props; return <div>{props.catalogStatus}</div> }
const renderController = () => renderWithProviders(<SourceCodeDownloads UIComponent={CaptureUI} />)
const authenticated = (overrides = {}) => ({ auth: true, token: 'controlled-session-token', loading: false, project: 'test', user: { id: 1, level: 0 }, ...overrides })
const deferred = () => { let complete; const promise = new Promise(resolve => { complete = resolve }); return { promise, resolve: complete } }
const errorResponse = status => jsonResponse({ error: { code: 'CONTROLLED_ERROR', message: 'Do not leak controlled-session-token' } }, status)

beforeEach(() => {
  latest = null
  state.session = authenticated()
  state.language = { language: { code: 'en' } }
  state.logout.mockReset()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(catalogResponse())))
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:controlled-test-archive')
    static revokeObjectURL = vi.fn()
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('source downloads controller', () => {
  it('sends the selected project only on exact shared Dashboard hosts', () => {
    const session = authenticated({ project: 'orderingv1' })
    expect(sourceRequestHeaders(session, 'application/json', 'dashboard.orderingplus.com')).toEqual({
      Authorization: 'Bearer controlled-session-token',
      Accept: 'application/json',
      'x-ordering-project': 'orderingv1'
    })
    expect(sourceRequestHeaders(session, 'application/zip', 'tenant.example.test')).toEqual({
      Authorization: 'Bearer controlled-session-token',
      Accept: 'application/zip'
    })
    expect(sourceRequestHeaders(session, 'application/json', 'dashboard.orderingplus.com.evil.test')).not.toHaveProperty('x-ordering-project')
  })

  it.each([0, 2])('loads the same-origin catalog with the real session header for role %s', async level => {
    state.session = authenticated({ user: { id: 1, level } })
    renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe('ready'))
    expect(fetch).toHaveBeenCalledWith('/api/source-catalog', expect.objectContaining({
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      headers: { Authorization: 'Bearer controlled-session-token', Accept: 'application/json' }
    }))
    expect(JSON.stringify(latest)).not.toContain('controlled-session-token')
    expect(latest.product.version).toBe(sourceProduct.version)
  })

  it('waits for session resolution and blocks missing/forbidden sessions without a request', () => {
    state.session = { loading: true }
    const view = renderController()
    expect(latest.catalogStatus).toBe('loading')
    state.session = { auth: false, loading: false }
    view.rerender(<SourceCodeDownloads UIComponent={CaptureUI} />)
    expect(latest.catalogStatus).toBe('sessionExpired')
    state.session = authenticated({ user: { id: 2, level: 5 } })
    view.rerender(<SourceCodeDownloads UIComponent={CaptureUI} />)
    expect(latest.catalogStatus).toBe('forbidden')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([[401, 'sessionExpired'], [403, 'forbidden'], [404, 'error'], [503, 'error']])('handles catalog HTTP %s without exposing the response message', async (code, status) => {
    fetch.mockResolvedValue(errorResponse(code))
    renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe(status))
    expect(latest.product).toBeNull()
    expect(JSON.stringify(latest)).not.toContain('controlled-session-token')
  })

  it('keeps an empty catalog honest and reloads after a temporary failure', async () => {
    fetch.mockResolvedValueOnce(errorResponse(503)).mockResolvedValueOnce(jsonResponse(catalogResponse([])))
    renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe('error'))
    await act(() => latest.reloadCatalog())
    expect(latest.catalogStatus).toBe('empty')
    expect(latest.product).toBeNull()
  })

  it('allows only Website Marketplace and rejects unsafe/incomplete producer metadata', () => {
    expect(readSourceCodeCatalog(catalogResponse([{ ...sourceProduct, id: 'driver-app' }]))).toEqual([])
    expect(() => readSourceCodeCatalog({ schemaVersion: 2, products: [] })).toThrow('invalidCatalog')
    expect(() => readSourceCodeCatalog(catalogResponse([{ ...sourceProduct, timezone: 'America/Chicago' }]))).toThrow('invalidCatalog')
    expect(() => readSourceCodeCatalog(catalogResponse([{ ...sourceProduct, artifact: { ...sourceProduct.artifact, filename: '../private.zip' } }]))).toThrow('invalidCatalog')
    expect(() => readSourceCodeCatalog(catalogResponse([{ ...sourceProduct, instructionsByLocale: {} }]))).toThrow('invalidCatalog')
  })

  it('renders a CST-fixed summer date and selects locale/English content without a refetch', async () => {
    expect(formatSourceCodeProduct(sourceProduct, 'en').publishedLabel).toContain('12:00:00')
    expect(formatSourceCodeProduct(sourceProduct, 'fr').instructionsFallback).toBe(true)
    const view = renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe('ready'))
    state.language = { language: { code: 'es-MX' } }
    view.rerender(<SourceCodeDownloads UIComponent={CaptureUI} />)
    expect(latest.product.description).toBe(sourceProduct.descriptionByLocale.es)
    expect(latest.product.instructions).toBe(sourceProduct.instructionsByLocale.es)
    expect(latest.product.license.text).toBe(sourceProduct.license.text)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('downloads the displayed version once using Bearer, saves its metadata filename, and releases the blob URL', async () => {
    const pending = deferred()
    fetch.mockResolvedValueOnce(jsonResponse(catalogResponse())).mockReturnValueOnce(pending.promise)
    renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe('ready'))
    vi.useFakeTimers()
    let downloading
    act(() => { downloading = latest.downloadSource(); latest.downloadSource() })
    expect(latest.downloadState.status).toBe('pending')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenLastCalledWith(`/api/source-downloads/website-marketplace/${sourceProduct.version}`, expect.objectContaining({
      headers: { Authorization: 'Bearer controlled-session-token', Accept: 'application/zip' }, redirect: 'error'
    }))
    await act(async () => { pending.resolve(zipResponse()); await downloading })
    const anchor = HTMLAnchorElement.prototype.click.mock.instances[0]
    expect(anchor.download).toBe(sourceProduct.artifact.filename)
    expect(anchor.href).toBe('blob:controlled-test-archive')
    expect(latest.downloadState.status).toBe('success')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1000))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:controlled-test-archive')
  })

  it.each([[401, 'sessionExpired'], [403, 'forbidden'], [404, 'ready'], [503, 'ready']])('handles download HTTP %s without saving an error payload', async (code, status) => {
    fetch.mockResolvedValueOnce(jsonResponse(catalogResponse())).mockResolvedValueOnce(errorResponse(code))
    renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe('ready'))
    await act(() => latest.downloadSource())
    expect(latest.catalogStatus).toBe(status)
    expect(latest.downloadState.status).toBe('error')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    if (code === 404) expect(latest.downloadState.error).toBe('notFound')
  })

  it.each([zipResponse(1), zipResponse(4, 'application/json')])('does not save an archive that contradicts the displayed artifact', async response => {
    fetch.mockResolvedValueOnce(jsonResponse(catalogResponse())).mockResolvedValueOnce(response)
    renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe('ready'))
    await act(() => latest.downloadSource())
    expect(latest.downloadState.status).toBe('error')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('rejects a same-size corrupt ZIP by digest, preserves metadata, and permits a verified retry', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(catalogResponse()))
      .mockResolvedValueOnce(zipResponse(4, 'application/zip', 'yyyy'))
      .mockResolvedValueOnce(zipResponse())
    renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe('ready'))
    await act(() => latest.downloadSource())
    expect(latest.downloadState).toEqual({ status: 'error', error: 'integrityMismatch' })
    expect(latest.product.artifact.sha256).toBe(sourceProduct.artifact.sha256)
    expect(latest.catalogStatus).toBe('ready')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    vi.useFakeTimers()
    await act(() => latest.downloadSource())
    expect(latest.downloadState.status).toBe('success')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(1000))
  })

  it.each(['insecure', 'missing', 'failed'])('denies a false success when WebCrypto is %s', async scenario => {
    fetch.mockResolvedValueOnce(jsonResponse(catalogResponse())).mockResolvedValueOnce(zipResponse())
    if (scenario === 'insecure') vi.stubGlobal('isSecureContext', false)
    if (scenario === 'missing') vi.stubGlobal('crypto', {})
    if (scenario === 'failed') vi.stubGlobal('crypto', { subtle: { digest: vi.fn().mockRejectedValue(new Error('controlled digest failure')) } })
    renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe('ready'))
    await act(() => latest.downloadSource())
    expect(latest.downloadState).toEqual({ status: 'error', error: 'verificationUnavailable' })
    expect(latest.catalogStatus).toBe('ready')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('does not save a valid ZIP when the session changes during its SHA-256 verification', async () => {
    const pending = deferred()
    const digest = vi.fn().mockReturnValue(pending.promise)
    vi.stubGlobal('crypto', { subtle: { digest } })
    fetch.mockResolvedValueOnce(jsonResponse(catalogResponse())).mockResolvedValueOnce(zipResponse())
    const view = renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe('ready'))
    let downloading
    act(() => { downloading = latest.downloadSource() })
    await waitFor(() => expect(digest).toHaveBeenCalledTimes(1))
    expect(digest.mock.calls[0][0]).toBe('SHA-256')
    state.session = { auth: false, loading: false }
    view.rerender(<SourceCodeDownloads UIComponent={CaptureUI} />)
    await act(async () => { pending.resolve(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode('xxxx'))); await downloading })
    expect(latest.catalogStatus).toBe('sessionExpired')
    expect(latest.product).toBeNull()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('aborts a previous catalog when the identity changes and ignores its late response', async () => {
    const old = deferred()
    fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(jsonResponse(catalogResponse([])))
    const view = renderController()
    const signal = fetch.mock.calls[0][1].signal
    state.session = authenticated({ token: 'other-controlled-token', user: { id: 2, level: 2 } })
    view.rerender(<SourceCodeDownloads UIComponent={CaptureUI} />)
    await waitFor(() => expect(latest.catalogStatus).toBe('empty'))
    await act(async () => old.resolve(jsonResponse(catalogResponse())))
    expect(signal.aborted).toBe(true)
    expect(latest.catalogStatus).toBe('empty')
    expect(latest.product).toBeNull()
  })

  it('cancels an in-flight download when the session disappears', async () => {
    const old = deferred()
    fetch.mockResolvedValueOnce(jsonResponse(catalogResponse())).mockReturnValueOnce(old.promise)
    const view = renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe('ready'))
    let downloading
    act(() => { downloading = latest.downloadSource() })
    const signal = fetch.mock.calls[1][1].signal
    state.session = { auth: false, loading: false }
    view.rerender(<SourceCodeDownloads UIComponent={CaptureUI} />)
    await act(async () => { old.resolve(zipResponse()); await downloading })
    expect(signal.aborted).toBe(true)
    expect(latest.catalogStatus).toBe('sessionExpired')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('clears the stale session only on the explicit sign-in action', async () => {
    fetch.mockResolvedValue(errorResponse(401))
    renderController()
    await waitFor(() => expect(latest.catalogStatus).toBe('sessionExpired'))
    expect(state.logout).not.toHaveBeenCalled()
    await act(() => latest.signInAgain())
    expect(state.logout).toHaveBeenCalledTimes(1)
  })
})
