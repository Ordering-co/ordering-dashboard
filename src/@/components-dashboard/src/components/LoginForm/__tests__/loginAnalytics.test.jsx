/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

vi.mock('~/config', async importOriginal => {
  const original = await importOriginal()
  return { ...original, default: { ...original.default, posthog_analytics_enabled: true } }
})

const effectControl = vi.hoisted(() => ({ suppressLoginCancellation: false }))

vi.mock('react', async importOriginal => {
  const original = await importOriginal()
  return {
    ...original,
    useEffect: (effect, dependencies) => original.useEffect(
      effectControl.suppressLoginCancellation && dependencies?.length === 3 ? () => {} : effect,
      dependencies
    )
  }
})

const auth = vi.fn()
const login = vi.fn()
const logout = vi.fn()
const emit = vi.fn()
let project = 'current_project'
let configs
let probe
const sdk = { language: 'en', get project () { return project }, setLanguage: vi.fn(), users: () => ({ auth, logout }), setAccessToken: () => sdk }

vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{}, { login, logout }] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [sdk, {}] }))
vi.mock('../../../contexts/EventContext', () => ({ useEvent: () => [{ emit }] }))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_key, fallback) => fallback] }))
vi.mock('../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs }] }))

import posthog from 'posthog-js'
import { preparePostHogEventForSending } from '~/analytics/posthog'
import { LoginForm } from '..'

const credentials = { email: 'private@customer.test', password: 'secret-pass', cellphone: '5551234567', code: '123456' }
const response = (overrides = {}) => ({ status: 200, content: { error: false, result: { id: 9, level: 0, email: credentials.email, session: { access_token: 'secret-token' } }, ...overrides } })
const deferred = () => { let resolve; let reject; const promise = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject }); return { promise, resolve, reject } }
const Probe = props => { probe = props; return null }
const renderController = props => render(<LoginForm UIComponent={Probe} allowedLevels={[0, 2, 5, 8]} {...props} />)
const submit = () => probe.handleButtonLoginClick(credentials)
const events = () => posthog.capture.mock.calls.map(([event, properties]) => ({ event, properties }))
const statuses = () => events().map(({ properties }) => properties.status)

beforeEach(() => {
  vi.clearAllMocks()
  effectControl.suppressLoginCancellation = false
  localStorage.clear()
  vi.stubGlobal('location', { hostname: 'dashboard.ordering.co' })
  project = 'current_project'
  configs = { email_password_login_enabled: { value: '1' }, phone_password_login_enabled: { value: '1' }, opt_email_enabled: { value: '1' }, otp_cellphone_enabled: { value: '1' } }
  auth.mockResolvedValue(response())
  logout.mockResolvedValue({ content: { error: false } })
  login.mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals() })

describe('interactive login outcomes at the authentication boundary', () => {
  it.each(['email', 'cellphone', 'otp'])('captures one %s success before session navigation immediately unmounts', async tab => {
    const view = renderController()
    act(() => probe.handleChangeTab(tab))
    login.mockImplementation(() => {
      expect(statuses()).toEqual(['started', 'succeeded'])
      view.unmount()
    })
    await act(async () => { await submit() })
    expect(statuses()).toEqual(['started', 'succeeded'])
    expect(auth).toHaveBeenCalledTimes(1)
    expect(login).toHaveBeenCalledWith({ user: expect.objectContaining({ id: 9 }), token: 'secret-token', project: 'current_project' })
    for (const event of events()) {
      expect(event.properties).toMatchObject({ schema_version: 2, module: 'authentication', capability: 'login', action: `login_${tab}`, operation_kind: 'technical', trigger: 'user', context_state: 'pre_auth', actor_type: 'unknown', project_code: 'current_project' })
    }
    expect(events()[0].properties).not.toHaveProperty('duration_ms')
    expect(events()[1].properties.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('does not count generating or resending OTP as authentication', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ error: false, result: { sent: true } }) }))
    renderController()
    act(() => probe.handleChangeTab('otp'))
    await act(async () => { await probe.generateOtpCode(credentials); await probe.generateOtpCode(credentials) })
    expect(posthog.capture).not.toHaveBeenCalled()
    expect(auth).not.toHaveBeenCalled()
    await act(async () => { await submit() })
    expect(statuses()).toEqual(['started', 'succeeded'])
  })

  it('reports captcha validation without dispatch or a failed operation', async () => {
    configs.security_recaptcha_auth = { value: '1' }
    renderController()
    await act(async () => { await submit() })
    expect(auth).not.toHaveBeenCalled()
    expect(events()).toEqual([{ event: 'dashboard_validation_failed', properties: expect.objectContaining({ validation_code: 'captcha_required', action: 'login_email', schema_version: 2 }) }])
  })

  it.each([
    ['api', () => Promise.resolve(response({ error: true, result: ['private server message'] }))],
    ['network', () => Promise.reject(new ProgressEvent('error'))],
    ['timeout', () => Promise.reject(new DOMException('private url', 'TimeoutError'))],
    ['permission', () => Promise.resolve({ status: 403, content: { error: true, result: ['private denial'] } })],
    ['api', () => Promise.reject(new Error('Internal error'))]
  ])('pairs a dispatched %s failure without recording raw errors', async (failureType, outcome) => {
    auth.mockImplementation(outcome)
    renderController()
    await act(async () => { await submit() })
    expect(statuses()).toEqual(['started', 'failed'])
    expect(events()[1].properties.failure_type).toBe(failureType)
    expect(login).not.toHaveBeenCalled()
    expect(JSON.stringify(events())).not.toMatch(/private|secret|5551234567|123456/)
  })

  it('records permission rejection even when cleanup logout fails', async () => {
    auth.mockResolvedValue(response({ result: { id: 9, level: 3, session: { access_token: 'secret-token' } } }))
    logout.mockRejectedValue(new Error('private cleanup error'))
    renderController()
    await act(async () => { await submit() })
    expect(statuses()).toEqual(['started', 'failed'])
    expect(events()[1].properties.failure_type).toBe('permission')
    expect(login).not.toHaveBeenCalled()
  })

  it('does not call missing-session responses successful authentication', async () => {
    auth.mockResolvedValue(response({ result: { id: 9, level: 0 } }))
    renderController()
    await act(async () => { await submit() })
    expect(statuses()).toEqual(['started', 'failed'])
    expect(login).not.toHaveBeenCalled()
  })

  it('ignores double submit while the real request is pending, then allows a retry', async () => {
    const pending = deferred()
    auth.mockReturnValueOnce(pending.promise)
    renderController()
    let first
    act(() => { first = submit(); submit() })
    expect(auth).toHaveBeenCalledTimes(1)
    expect(statuses()).toEqual(['started'])
    await act(async () => { pending.resolve(response({ error: true, result: ['invalid'] })); await first })
    await act(async () => { await submit() })
    expect(statuses()).toEqual(['started', 'failed', 'started', 'succeeded'])
  })

  it.each(['method', 'project', 'cancel'])('does not cross-pair a late response after %s changes the flow', async change => {
    const old = deferred()
    const next = deferred()
    auth.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    const view = renderController()
    let first
    act(() => { first = submit() })
    act(() => {
      if (change === 'method') probe.handleChangeTab('cellphone')
      if (change === 'project') { project = 'next_project'; view.rerender(<LoginForm UIComponent={Probe} allowedLevels={[0, 2, 5, 8]} />) }
      if (change === 'cancel') probe.handleCancelLogin?.('user_cancel')
    })
    expect(statuses()).toEqual(['started', 'cancelled'])
    let second
    act(() => { second = submit() })
    await act(async () => { old.resolve(response()); await first })
    expect(login).not.toHaveBeenCalled()
    expect(probe.formState.loading).toBe(true)
    expect(statuses()).toEqual(['started', 'cancelled', 'started'])
    await act(async () => { next.resolve(response()); await second })
    expect(statuses()).toEqual(['started', 'cancelled', 'started', 'succeeded'])
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('releases loading when a stale project response settles before the passive cancellation effect', async () => {
    const pending = deferred()
    auth.mockReturnValueOnce(pending.promise)
    const view = renderController()
    let first
    act(() => { first = submit() })
    effectControl.suppressLoginCancellation = true
    act(() => {
      project = 'next_project'
      view.rerender(<LoginForm UIComponent={Probe} allowedLevels={[0, 2, 5, 8]} />)
    })
    await act(async () => { pending.resolve(response()); await first })

    expect(statuses()).toEqual(['started', 'cancelled'])
    expect(probe.formState.loading).toBe(false)
    expect(login).not.toHaveBeenCalled()
  })

  it('rejects a stale OTP response when the OTP type changes before the passive cancellation effect', async () => {
    const pending = deferred()
    auth.mockReturnValueOnce(pending.promise)
    renderController()
    act(() => probe.handleChangeTab('otp'))
    let first
    act(() => { first = submit() })
    effectControl.suppressLoginCancellation = true
    act(() => { probe.setOtpType('cellphone') })
    await act(async () => { pending.resolve(response()); await first })

    expect(statuses()).toEqual(['started', 'cancelled'])
    expect(probe.formState.loading).toBe(false)
    expect(login).not.toHaveBeenCalled()
  })

  it('clears a consumed reCAPTCHA token when a login is superseded', async () => {
    configs.security_recaptcha_auth = { value: '1' }
    const pending = deferred()
    auth.mockReturnValueOnce(pending.promise)
    const reset = vi.fn()
    vi.stubGlobal('grecaptcha', { reset })
    renderController()
    act(() => { probe.handleReCaptcha({ code: 'consumed-token', version: 'v2' }) })

    let first
    act(() => { first = submit() })
    act(() => { probe.handleChangeTab('cellphone') })
    expect(reset).toHaveBeenCalledTimes(1)

    await act(async () => { await submit() })
    expect(auth).toHaveBeenCalledTimes(1)
    expect(events().at(-1)).toEqual({
      event: 'dashboard_validation_failed',
      properties: expect.objectContaining({ validation_code: 'captcha_required', action: 'login_cellphone' })
    })

    await act(async () => { pending.resolve(response()); await first })
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('does not trust a failed HTTP response even when the body claims success', async () => {
    auth.mockResolvedValue({ ...response(), status: 403 })
    renderController()
    await act(async () => { await submit() })
    expect(statuses()).toEqual(['started', 'failed'])
    expect(events()[1].properties.failure_type).toBe('permission')
    expect(login).not.toHaveBeenCalled()
  })

  it('does not block a new flow while a rejected-role logout is still pending', async () => {
    const cleanup = deferred()
    logout.mockReturnValueOnce(cleanup.promise)
    auth.mockResolvedValueOnce(response({ result: { id: 9, level: 3, session: { access_token: 'secret-token' } } }))
    const view = renderController()
    let first
    await act(async () => { first = submit(); await Promise.resolve() })
    act(() => { project = 'next_project'; view.rerender(<LoginForm UIComponent={Probe} allowedLevels={[0, 2, 5, 8]} />) })
    await act(async () => { await submit() })
    expect(statuses()).toEqual(['started', 'failed', 'started', 'succeeded'])
    await act(async () => { cleanup.resolve({ content: { error: false } }); await first })
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('releases loading when the OTP type changes during rejected-role cleanup', async () => {
    const cleanup = deferred()
    logout.mockReturnValueOnce(cleanup.promise)
    auth.mockResolvedValueOnce(response({ result: { id: 9, level: 3, session: { access_token: 'secret-token' } } }))
    renderController()
    act(() => probe.handleChangeTab('otp'))
    let first
    await act(async () => { first = submit(); await Promise.resolve() })
    effectControl.suppressLoginCancellation = true
    act(() => { probe.setOtpType('cellphone') })
    await act(async () => { cleanup.resolve({ content: { error: false } }); await first })

    expect(statuses()).toEqual(['started', 'failed'])
    expect(probe.formState.loading).toBe(false)
    expect(login).not.toHaveBeenCalled()
  })

  it('does not emit a second terminal event if a success callback throws', async () => {
    renderController({ handleSuccessLogin: () => { throw new Error('private callback error') } })
    await act(async () => { await submit() })
    expect(statuses()).toEqual(['started', 'succeeded'])
  })

  it('keeps authentication functional if analytics transport throws', async () => {
    posthog.capture.mockImplementationOnce(() => { throw new Error('transport') })
    renderController()
    await act(async () => { await submit() })
    expect(login).toHaveBeenCalledTimes(1)
    expect(probe.formState.result.error).toBe(false)
  })

  it('clears SDK-registered code when the current pre-auth project is unknown', async () => {
    project = null
    renderController()
    await act(async () => { await submit() })
    expect(events()).toHaveLength(2)
    const { event, properties } = events()[0]
    const sent = preparePostHogEventForSending({ event, properties: { project_code: 'previous', distinct_id: 'device', ...properties } }, { posthog_analytics_enabled: true }, 'dashboard.ordering.co')
    expect(sent.properties).not.toHaveProperty('project_code')
    expect(sent.properties.distinct_id).toBe('device')
  })

  it('does not infer interactive login from mounting with a stored user or external handler', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, session: { access_token: 'stored' } }))
    const external = vi.fn()
    renderController({ handleButtonLoginClick: external })
    await act(async () => { await submit() })
    expect(external).toHaveBeenCalledWith(credentials)
    expect(posthog.capture).not.toHaveBeenCalled()
    expect(auth).not.toHaveBeenCalled()
  })

  it('preserves the SDK envelope and current code while dropping inherited tenant/PII at before_send', async () => {
    renderController()
    await act(async () => { await submit() })
    expect(events()).toHaveLength(2)
    for (const { event, properties } of events()) {
      const envelope = { event, timestamp: '2026-09-12T00:00:00Z', properties: { token: 'sdk-token', distinct_id: 'anonymous-device', $session_id: 'session', $device_id: 'device', $groups: { project: 'old' }, project_id: 'old-id', project_name: 'old-name', project_code: 'old-code', user_role: '0', plan_id: 'old-plan', email: 'private@person.test', $current_url: 'https://host/login?token=secret', ...properties } }
      const sent = preparePostHogEventForSending(envelope, { posthog_analytics_enabled: true }, 'dashboard.ordering.co')
      expect(sent.timestamp).toBe(envelope.timestamp)
      expect(sent.properties).toMatchObject({ token: 'sdk-token', distinct_id: 'anonymous-device', $session_id: 'session', $device_id: 'device', project_code: 'current_project' })
      for (const key of ['$groups', 'project_id', 'project_name', 'user_role', 'plan_id', 'email', '$current_url']) expect(sent.properties).not.toHaveProperty(key)
    }
  })
})
