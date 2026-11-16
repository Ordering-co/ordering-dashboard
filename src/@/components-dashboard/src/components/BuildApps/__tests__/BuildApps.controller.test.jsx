/* eslint-disable import/first */
// redesign my-products B1 (M-MP-06 / M-MP-13): the socket updates the build, not the root of the app, and always
// with the latest app; «Delete certificates» tells when it fails. Requests, endpoints, room and event are main's.
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => {
  const handlers = {}
  return {
    handlers,
    showToast: vi.fn(),
    socket: {
      on: vi.fn((event, handler) => { handlers[event] = handler }),
      off: vi.fn((event) => { delete handlers[event] }),
      join: vi.fn(),
      leave: vi.fn()
    },
    io: { connected: true, on: vi.fn(), off: vi.fn() },
    ui: null
  }
})

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'tok', user: { id: 7 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'http://api/v400/en/development', project: 'development' }]
}))
vi.mock('../../../contexts/WebsocketContext', () => ({
  useWebsocket: () => runtime.socket,
  useSocketInstance: () => runtime.io
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [null, { showToast: runtime.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))

import { BuildApps } from '../index'

const UI = (props) => { runtime.ui = props; return null }

const baseApp = () => ({
  id: 310,
  status: 'draft',
  app_version: '1.0.0',
  builds: [{ platform: 'android', status: 'building', app_version: '0.9.0' }]
})

const mountWith = (app, updateAppValues, appId = 310) => {
  const view = render(<BuildApps UIComponent={UI} appId={appId} app={app} updateAppValues={updateAppValues} />)
  const rerender = (nextApp) => view.rerender(<BuildApps UIComponent={UI} appId={appId} app={nextApp} updateAppValues={updateAppValues} />)
  return { ...view, rerender }
}

const emit = (event) => act(() => { runtime.handlers.app_build_change(event) })

const fetchMock = vi.fn()

beforeEach(() => {
  runtime.showToast.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('BuildApps controller · app_build_change', () => {
  it('updates the build of that platform and puts nothing on the root of the app', () => {
    const updateAppValues = vi.fn()
    mountWith(baseApp(), updateAppValues)
    emit({
      builder_app_id: 310,
      platform: 'android',
      changes: [{ attribute: 'status', old: 'building', new: 'successful' }]
    })
    expect(updateAppValues).toHaveBeenCalledTimes(1)
    const values = updateAppValues.mock.calls[0][0]
    expect(values).toEqual({
      builds: [{ platform: 'android', status: 'successful', app_version: '0.9.0' }]
    })
    expect(values).not.toHaveProperty('status')
    expect(values).not.toHaveProperty('app_version')
  })

  it('does not mutate the builds of the app it was given', () => {
    const app = baseApp()
    const updateAppValues = vi.fn()
    mountWith(app, updateAppValues)
    emit({ builder_app_id: 310, platform: 'android', changes: [{ attribute: 'status', new: 'successful' }] })
    expect(app.builds).toEqual([{ platform: 'android', status: 'building', app_version: '0.9.0' }])
  })

  it('keeps the previous value of an attribute whose new value is null', () => {
    const updateAppValues = vi.fn()
    mountWith(baseApp(), updateAppValues)
    emit({
      builder_app_id: 310,
      platform: 'android',
      changes: [{ attribute: 'status', old: 'building', new: null }, { attribute: 'job_id', new: 'j1' }]
    })
    expect(updateAppValues.mock.calls[0][0].builds[0]).toEqual({ platform: 'android', status: 'building', app_version: '0.9.0', job_id: 'j1' })
  })

  it('uses the new app after a re-render with other builds (no stale closure)', () => {
    const updateAppValues = vi.fn()
    const { rerender } = mountWith(baseApp(), updateAppValues)
    rerender({ ...baseApp(), builds: [{ platform: 'android', status: 'queued', mode: 'release' }] })
    emit({ builder_app_id: 310, platform: 'android', changes: [{ attribute: 'status', new: 'successful' }] })
    expect(updateAppValues).toHaveBeenCalledWith({
      builds: [{ platform: 'android', status: 'successful', mode: 'release' }]
    })
  })

  it('adds the build when that platform had none', () => {
    const updateAppValues = vi.fn()
    mountWith(baseApp(), updateAppValues)
    emit({ builder_app_id: 310, platform: 'ios', changes: [{ attribute: 'status', new: 'queued' }] })
    expect(updateAppValues).toHaveBeenCalledWith({
      builds: [
        { platform: 'android', status: 'building', app_version: '0.9.0' },
        { platform: 'ios', status: 'queued' }
      ]
    })
  })

  it('adds the build when the app had no builds at all', () => {
    const updateAppValues = vi.fn()
    mountWith({ id: 310 }, updateAppValues)
    emit({ builder_app_id: 310, platform: 'ios', changes: [{ attribute: 'status', new: 'queued' }] })
    expect(updateAppValues).toHaveBeenCalledWith({ builds: [{ platform: 'ios', status: 'queued' }] })
  })

  it('sends built_apps too when the changes bring it', () => {
    const updateAppValues = vi.fn()
    mountWith(baseApp(), updateAppValues)
    const builtApps = { android: { release: { assemble: { apk: 'u' } } } }
    emit({
      builder_app_id: 310,
      platform: 'android',
      changes: [{ attribute: 'status', new: 'successful' }, { attribute: 'built_apps', new: builtApps }]
    })
    const values = updateAppValues.mock.calls[0][0]
    expect(values.built_apps).toEqual(builtApps)
    expect(values.builds[0]).toMatchObject({ platform: 'android', status: 'successful', built_apps: builtApps })
    expect(Object.keys(values).sort()).toEqual(['builds', 'built_apps'])
  })

  it('ignores the events of another app', () => {
    const updateAppValues = vi.fn()
    mountWith(baseApp(), updateAppValues)
    emit({ builder_app_id: 999, platform: 'android', changes: [{ attribute: 'status', new: 'successful' }] })
    expect(updateAppValues).not.toHaveBeenCalled()
  })
})

describe('BuildApps controller · deleteCertificates', () => {
  const certificatesUrl = 'http://api/v400/en/development/builder/apps/310/credentials/ios/run/remove_local'

  it('says what the API said when it answers with an error', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: true, result: ['Nope'] }) })
    mountWith(baseApp(), vi.fn())
    await act(async () => { await runtime.ui.deleteCertificates({ platform: 'ios' }) })
    expect(fetchMock).toHaveBeenCalledWith(certificatesUrl, expect.objectContaining({ method: 'POST' }))
    expect(runtime.showToast).toHaveBeenCalledTimes(1)
    expect(runtime.showToast).toHaveBeenCalledWith('error', 'Nope')
  })

  it('says what the API said when the error is not a list', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: true, result: 'Plain' }) })
    mountWith(baseApp(), vi.fn())
    await act(async () => { await runtime.ui.deleteCertificates({ platform: 'ios' }) })
    expect(runtime.showToast).toHaveBeenCalledWith('error', 'Plain')
  })

  it('says so when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    mountWith(baseApp(), vi.fn())
    await act(async () => { await runtime.ui.deleteCertificates({ platform: 'ios' }) })
    expect(runtime.showToast).toHaveBeenCalledTimes(1)
    expect(runtime.showToast).toHaveBeenCalledWith('error', 'Failed to fetch')
  })

  it('keeps the success toast as it was', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result: 'Removed' }) })
    mountWith(baseApp(), vi.fn())
    await act(async () => { await runtime.ui.deleteCertificates({ platform: 'ios' }) })
    expect(runtime.showToast).toHaveBeenCalledTimes(1)
    expect(runtime.showToast).toHaveBeenCalledWith('success', 'Removed')
  })
})

describe('BuildApps controller · buildApp', () => {
  it('without builds on the app it does not throw and sends { builds: [result] }', async () => {
    const result = { platform: 'ios', status: 'queued' }
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result }) })
    const updateAppValues = vi.fn()
    mountWith({ id: 310 }, updateAppValues)
    await act(async () => { await runtime.ui.buildApp({ appId: 310, platform: 'ios', mode: 'ad-hoc' }) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api/v400/en/development/builder/apps/310/run/build')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ platform: 'ios', mode: 'ad-hoc' })
    expect(updateAppValues).toHaveBeenCalledWith({ builds: [result] })
    expect(runtime.ui.buildAppState).toMatchObject({ loading: false, error: null, result })
  })

  it('replaces the build of that platform without mutating the app\'s builds', async () => {
    const app = baseApp()
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result: { platform: 'android', status: 'queued' } }) })
    const updateAppValues = vi.fn()
    mountWith(app, updateAppValues)
    await act(async () => { await runtime.ui.buildApp({ appId: 310, platform: 'android', mode: 'release', type: 'assemble' }) })
    expect(updateAppValues).toHaveBeenCalledWith({
      builds: [{ platform: 'android', status: 'queued', app_version: '0.9.0' }]
    })
    expect(app.builds).toEqual([{ platform: 'android', status: 'building', app_version: '0.9.0' }])
  })
})

// My Products asks with the session for the signed links of its QR and its downloads, never the public `downloads/*` route.
describe('BuildApps controller · signed links', () => {
  const linkResult = { url: 'https://api/builder/install/9/apk?expires=1&signature=s', expires_at: '2026-11-11T12:00:00+00:00', platform: 'android', mode: 'release', file: 'apk' }

  it('asks for the install link of the platform, mode and file with the session', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: linkResult }) })
    mountWith(baseApp(), vi.fn())
    let answer
    await act(async () => { answer = await runtime.ui.createInstallLink({ platform: 'android', mode: 'release', file: 'apk' }) })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api/v400/en/development/builder/apps/310/install-link/android/release/apk',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer tok' }) })
    )
    expect(answer).toEqual({ ok: true, result: linkResult, errorCodes: [] })
  })

  it('answers the error codes of a refused install link', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: true, result: ['No'], error_codes: ['build.not_installable'] }) })
    mountWith(baseApp(), vi.fn())
    let answer
    await act(async () => { answer = await runtime.ui.createInstallLink({ platform: 'android', mode: 'release', file: 'aab' }) })
    expect(answer).toEqual({ ok: false, result: null, errorCodes: ['build.not_installable'] })
  })

  it('downloads through a link of its own, asked for on click, and marks it busy meanwhile', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    let resolve
    fetchMock.mockReturnValue(new Promise(_resolve => { resolve = _resolve }))
    mountWith(baseApp(), vi.fn())
    let pending
    act(() => { pending = runtime.ui.downloadApp({ type: 'aabpro', platform: 'android', mode: 'release', file: 'aab' }) })
    expect(runtime.ui.downloadAppState).toMatchObject({ loading: true, type: 'aabpro' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api/v400/en/development/builder/apps/310/download-link/android/release/aab',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer tok' }) })
    )
    let answer
    await act(async () => {
      resolve({ ok: true, json: async () => ({ error: false, result: { ...linkResult, url: 'https://files/app.aab?signed', file: 'aab' } }) })
      answer = await pending
    })
    expect(answer).toEqual({ ok: true, errorCodes: [] })
    expect(click).toHaveBeenCalledTimes(1)
    expect(click.mock.contexts[0].href).toBe('https://files/app.aab?signed')
    expect(runtime.ui.downloadAppState).toMatchObject({ loading: false, error: null })
    click.mockRestore()
  })

  it('opens nothing and answers the error codes when the download is refused or the request fails', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: true, error_codes: ['build.artifact_missing'] }) })
    mountWith(baseApp(), vi.fn())
    let answer
    await act(async () => { answer = await runtime.ui.downloadApp({ type: 'pro', platform: 'android', mode: 'release', file: 'apk' }) })
    expect(answer).toEqual({ ok: false, errorCodes: ['build.artifact_missing'] })
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await act(async () => { answer = await runtime.ui.downloadApp({ type: 'pro', platform: 'android', mode: 'release', file: 'apk' }) })
    expect(answer).toEqual({ ok: false, errorCodes: [] })
    expect(click).not.toHaveBeenCalled()
    click.mockRestore()
  })

  // One download at a time, as the Builder's Builds card: with two on their way the busy state was of neither
  it('ignores a download asked for while another is in progress, and keeps that one marked busy until it ends', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const answers = []
    fetchMock.mockImplementation(() => new Promise(resolve => { answers.push(resolve) }))
    const file = (url) => ({ ok: true, json: async () => ({ error: false, result: { ...linkResult, url } }) })
    mountWith(baseApp(), vi.fn())

    let first
    let second
    act(() => { first = runtime.ui.downloadApp({ type: 'pro', platform: 'android', mode: 'release', file: 'apk' }) })
    act(() => { second = runtime.ui.downloadApp({ type: 'aabpro', platform: 'android', mode: 'release', file: 'aab' }) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('http://api/v400/en/development/builder/apps/310/download-link/android/release/apk')
    expect(runtime.ui.downloadAppState).toMatchObject({ loading: true, type: 'pro' })
    // it answers nothing: there is no failure to tell
    await expect(second).resolves.toBeNull()

    await act(async () => {
      answers[0](file('https://files/app.apk?signed'))
      await first
    })
    expect(click).toHaveBeenCalledTimes(1)
    expect(click.mock.contexts[0].href).toBe('https://files/app.apk?signed')
    expect(runtime.ui.downloadAppState).toMatchObject({ loading: false, error: null })

    // once it ended, the next one goes
    let third
    act(() => { third = runtime.ui.downloadApp({ type: 'aabpro', platform: 'android', mode: 'release', file: 'aab' }) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(runtime.ui.downloadAppState).toMatchObject({ loading: true, type: 'aabpro' })
    await act(async () => {
      answers[1](file('https://files/app.aab?signed'))
      await third
    })
    expect(click).toHaveBeenCalledTimes(2)
    expect(runtime.ui.downloadAppState).toMatchObject({ loading: false, error: null })
    click.mockRestore()
  })

  it('takes the next download after one that was refused or whose request failed', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    mountWith(baseApp(), vi.fn())
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await act(async () => { await runtime.ui.downloadApp({ type: 'pro', platform: 'android', mode: 'release', file: 'apk' }) })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ error: false, result: { ...linkResult, url: 'https://files/app.apk?signed' } }) })
    let answer
    await act(async () => { answer = await runtime.ui.downloadApp({ type: 'pro', platform: 'android', mode: 'release', file: 'apk' }) })
    expect(answer).toEqual({ ok: true, errorCodes: [] })
    expect(click).toHaveBeenCalledTimes(1)
    click.mockRestore()
  })

  // The link is opened in this tab, on purpose (see `downloadApp`): no new tab or window (after the request Safari blocks it as a
  // pop-up) and no frame (a file that failed there would say nothing).
  it('opens the download link in the same tab: no new tab, no window, no frame', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { ...linkResult, url: 'https://files/app.apk?signed' } }) })
    mountWith(baseApp(), vi.fn())
    await act(async () => { await runtime.ui.downloadApp({ type: 'pro', platform: 'android', mode: 'release', file: 'apk' }) })

    expect(click).toHaveBeenCalledTimes(1)
    const link = click.mock.contexts[0]
    expect(link.href).toBe('https://files/app.apk?signed')
    expect(link.hasAttribute('target')).toBe(false)
    // the storage is not told which page of the Dashboard asked for the file
    expect(link.rel).toBe('noopener noreferrer')
    expect(open).not.toHaveBeenCalled()
    expect(document.querySelector('iframe')).toBeNull()
    click.mockRestore()
    open.mockRestore()
  })
})

// The attempts of the app (the last builds of each file type), for the tabs of the Builds section: asked for when the section asks,
// once per app, and read again when a build is asked for or ends.
describe('BuildApps controller · build attempts', () => {
  const attemptsUrl = 'http://api/v400/en/development/builder/apps/310/builds?page=1&page_size=50'
  const attempts = [{ id: 9, platform: 'ios', mode: 'ad-hoc', type: null, status: 'successful' }]
  const answerWith = (result) => ({ ok: true, json: async () => ({ error: false, result }) })

  afterEach(() => vi.useRealTimers())

  it('asks for nothing until the section asks, then once however many times it asks', async () => {
    fetchMock.mockResolvedValue(answerWith(attempts))
    mountWith(baseApp(), vi.fn())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(runtime.ui.buildAttemptsState).toEqual({ loading: false, attempts: null, error: false })

    await act(async () => {
      runtime.ui.loadBuildAttempts()
      runtime.ui.loadBuildAttempts()
    })
    await act(async () => { await runtime.ui.loadBuildAttempts() })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(attemptsUrl, expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer tok' })
    }))
    expect(runtime.ui.buildAttemptsState).toEqual({ loading: false, attempts, error: false })
  })

  it('still gets them when React mounts the section twice (StrictMode in development): the first answer is not waited for ever', async () => {
    fetchMock.mockResolvedValue(answerWith(attempts))
    // the Builds section asks when it is mounted
    const Section = (props) => {
      runtime.ui = props
      React.useEffect(() => { props.loadBuildAttempts() }, [])
      return null
    }
    await act(async () => {
      render(
        <React.StrictMode>
          <BuildApps UIComponent={Section} appId={310} app={baseApp()} updateAppValues={vi.fn()} />
        </React.StrictMode>
      )
    })
    expect(runtime.ui.buildAttemptsState).toEqual({ loading: false, attempts, error: false })
  })

  it('keeps the attempts it had when a read fails, and says so', async () => {
    fetchMock.mockResolvedValueOnce(answerWith(attempts))
    mountWith(baseApp(), vi.fn())
    await act(async () => { await runtime.ui.loadBuildAttempts() })

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await act(async () => { await runtime.ui.loadBuildAttempts({ reload: true }) })
    expect(runtime.ui.buildAttemptsState).toEqual({ loading: false, attempts, error: true })
  })

  it('reads them again, once, after a build ends or a new one arrives, only when the section had asked for them', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(answerWith(attempts))
    mountWith(baseApp(), vi.fn())

    // nobody asked for them: the socket reads nothing
    emit({ builder_app_id: 310, platform: 'android', changes: [{ attribute: 'status', new: 'successful' }] })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => { await runtime.ui.loadBuildAttempts() })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // a status in between reads nothing
    emit({ builder_app_id: 310, platform: 'android', changes: [{ attribute: 'status', new: 'building' }] })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // a burst (the new attempt, then its end) is one read
    emit({ builder_app_id: 310, platform: 'android', changes: [{ attribute: 'attempt_id', new: 10 }, { attribute: 'status', new: 'pending' }] })
    emit({ builder_app_id: 310, platform: 'android', changes: [{ attribute: 'status', new: 'successful' }] })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe(attemptsUrl)
  })

  it('answers whether the build was taken, and reads the attempts again when it was', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(answerWith(attempts))
    mountWith(baseApp(), vi.fn())
    await act(async () => { await runtime.ui.loadBuildAttempts() })

    fetchMock.mockResolvedValueOnce({ json: async () => ({ error: false, result: { platform: 'ios', status: 'pending', attempt_id: 11 } }) })
    let answer
    await act(async () => { answer = await runtime.ui.buildApp({ appId: 310, platform: 'ios', mode: 'ad-hoc' }) })
    expect(answer).toEqual({ ok: true })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([attemptsUrl, 'http://api/v400/en/development/builder/apps/310/run/build', attemptsUrl])

    fetchMock.mockResolvedValueOnce({ json: async () => ({ error: true, result: ['Nope'] }) })
    await act(async () => { answer = await runtime.ui.buildApp({ appId: 310, platform: 'ios', mode: 'ad-hoc' }) })
    expect(answer).toEqual({ ok: false })
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await act(async () => { answer = await runtime.ui.buildApp({ appId: 310, platform: 'ios', mode: 'ad-hoc' }) })
    expect(answer).toEqual({ ok: false })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})
