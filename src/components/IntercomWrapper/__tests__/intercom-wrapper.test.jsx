import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IntercomWrapper } from '..'
import { setIntercomSettings } from '../../Utils'
import { setAssistantIntercomHidden } from '../../../@/components-dashboard/src/ui/src/utils/assistantIntercom'

const { state, supportSettings } = vi.hoisted(() => ({
  state: { session: {}, config: {}, project: {} },
  supportSettings: { intercom_app_id: 'demo-intercom-app' }
}))
vi.mock('../../../config', async (importOriginal) => {
  const { default: settings } = await importOriginal()
  return { default: { ...settings, get intercom_app_id () { return supportSettings.intercom_app_id } } }
})
vi.mock('~components', () => ({
  useSession: () => [state.session],
  useConfig: () => [state.config],
  useApi: () => [{ root: 'https://api.test/v400', project: state.project.project?.code }]
}))
vi.mock('~ui', () => ({ useProjectState: () => [state.project] }))

const widget = () => document.querySelector('script[src*="widget.intercom.io"]')
const renderWrapper = () => render(<IntercomWrapper><span>Dashboard</span></IntercomWrapper>)
const rerender = view => view.rerender(<IntercomWrapper><span>Dashboard</span></IntercomWrapper>)
const queuedCalls = () => window.Intercom?.q?.map(args => Array.from(args)) || []
const resolveHash = hash => ({ ok: true, json: async () => ({ error: false, result: { intercom_hash: hash } }) })

beforeEach(() => {
  supportSettings.intercom_app_id = 'demo-intercom-app'
  state.session = { auth: true, token: 'token-a', user: { id: 1, level: 0, email: 'owner@example.test' }, loading: false }
  state.config = { loading: false, configs: {} }
  state.project = { loading: false, intercomAllowed: true, planResolved: true, project: { id: 1, code: 'alpha' }, plan: { id: 100 } }
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' })
})

afterEach(() => {
  cleanup()
  setAssistantIntercomHidden(false)
  document.querySelectorAll('script[src*="widget.intercom.io"], #intercom_widget').forEach(el => el.remove())
  delete window.Intercom
  delete window.intercomSettings
  vi.unstubAllGlobals()
})

describe('Intercom project eligibility with real settings utility', () => {
  it('does not initialize without a configured app ID', async () => {
    supportSettings.intercom_app_id = ''
    fetch.mockResolvedValue(resolveHash('available-hash'))
    renderWrapper()
    await act(async () => {})
    expect(widget()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(window.intercomSettings).toBeUndefined()
  })

  it.each([581, '581'])('does not load, boot or request a hash for excluded plan %s', planId => {
    state.project.plan.id = planId
    state.project.intercomAllowed = false
    window.Intercom = vi.fn()
    const intercom = window.Intercom
    renderWrapper()
    setIntercomSettings({ project_plan: planId, user_hash: 'late-hash' }, state.session.user)
    expect(widget()).toBeNull()
    expect(intercom.mock.calls.filter(([command]) => command === 'boot' || command === 'update')).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
    expect(window.intercomSettings).toBeUndefined()
  })

  it.each([572, 100])('loads verified support for an internal email on permitted plan %s', async planId => {
    state.session.user.email = 'example-staff@ordering.co'
    state.project.plan.id = planId
    fetch.mockResolvedValue(resolveHash('internal-hash'))
    renderWrapper()
    await act(async () => {})
    expect(widget()?.src).toBe('https://widget.intercom.io/widget/demo-intercom-app')
    expect(queuedCalls()).toContainEqual(['boot', expect.objectContaining({ email: 'example-staff@ordering.co', user_hash: 'internal-hash' })])
  })

  it('uses the active workspace for the first SDK load and verified boot', async () => {
    state.session.user.email = 'example-staff@ordering.co'
    state.project.plan.id = 572
    fetch.mockResolvedValue(resolveHash('active-workspace-hash'))
    renderWrapper()
    await act(async () => {})
    expect(widget()?.src).toBe('https://widget.intercom.io/widget/demo-intercom-app')
    expect(window.intercomSettings).toMatchObject({ app_id: 'demo-intercom-app', email: 'example-staff@ordering.co', user_hash: 'active-workspace-hash' })
    const boots = queuedCalls().filter(([command]) => command === 'boot')
    expect(boots).toHaveLength(1)
    expect(boots[0][1]).toMatchObject({ app_id: 'demo-intercom-app', user_hash: 'active-workspace-hash' })
  })

  it.each([581, '581'])('excludes internal emails on plan %s', planId => {
    state.session.user.email = 'example-staff@ordering.co'
    state.project.plan.id = planId
    state.project.intercomAllowed = false
    renderWrapper()
    expect(widget()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(queuedCalls()).toEqual([])
  })

  it('does not load the SDK or boot while the identity hash is pending', () => {
    renderWrapper()
    expect(widget()).toBeNull()
    expect(queuedCalls().filter(([command]) => command === 'boot')).toEqual([])
  })

  it.each([
    { ok: true, json: async () => ({ error: true, result: null }) },
    { ok: true, json: async () => ({ error: false, result: {} }) },
    { ok: false, json: async () => ({ error: false, result: { intercom_hash: 'untrusted-http-hash' } }) }
  ])('does not initialize support after a failed or missing identity hash (%#)', async response => {
    fetch.mockResolvedValue(response)
    renderWrapper()
    await act(async () => {})
    expect(widget()).toBeNull()
    expect(queuedCalls().filter(([command]) => command === 'boot')).toEqual([])
  })

  it('makes the first SDK boot with the verified hash and current profile metadata', async () => {
    let completeHash
    fetch.mockImplementationOnce(() => new Promise(resolve => { completeHash = resolve }))
    const view = renderWrapper()
    state.session = { ...state.session, user: { ...state.session.user, first_name: 'Current' } }
    rerender(view)
    await act(async () => completeHash(resolveHash('verified-first-hash')))
    const boots = queuedCalls().filter(([command]) => command === 'boot')
    expect(boots).toHaveLength(1)
    expect(boots[0][1]).toMatchObject({ user_hash: 'verified-first-hash', name: 'Current', app_id: 'demo-intercom-app' })
  })

  it('ignores a hash that resolves after the project is changed to plan 581', async () => {
    let completeHash
    fetch.mockImplementationOnce(() => new Promise(resolve => { completeHash = resolve }))
    const view = renderWrapper()
    state.project = { ...state.project, intercomAllowed: false, plan: { id: 581 } }
    rerender(view)
    await act(async () => completeHash(resolveHash('excluded-hash')))
    expect(widget()).toBeNull()
    expect(window.Intercom).toBeUndefined()
    expect(window.intercomSettings).toBeUndefined()
  })

  it('does not let settings updates boot an unverified identity, including internal users', () => {
    state.session.user.email = 'example-staff@ordering.co'
    renderWrapper()
    window.Intercom = vi.fn()
    setIntercomSettings({ email: 'example-staff@ordering.co' }, state.session.user)
    expect(window.Intercom).not.toHaveBeenCalled()
    setIntercomSettings({ user_hash: 'verified-utils-hash' }, state.session.user)
    expect(window.Intercom).toHaveBeenCalledWith('boot', expect.objectContaining({ email: 'example-staff@ordering.co', user_hash: 'verified-utils-hash' }))
  })

  it('waits for project support resolution before loading support', () => {
    state.project = { loading: true, planResolved: false, project: {}, plan: null }
    const view = renderWrapper()
    expect(widget()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    state.project = { loading: false, planResolved: false, billingUnavailable: true, project: { id: 1 } }
    rerender(view)
    expect(widget()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('loads verified support without billing access for a project-local Supportadmin', async () => {
    state.session.user = { id: 44, level: 0, email: 'supportadmin@ordering.co' }
    state.project = { ...state.project, plan: null, planResolved: false, billingUnavailable: true }
    fetch.mockResolvedValue(resolveHash('supportadmin-hash'))
    renderWrapper()
    await act(async () => {})
    expect(widget()?.src).toBe('https://widget.intercom.io/widget/demo-intercom-app')
    expect(queuedCalls()).toContainEqual(['boot', expect.objectContaining({ email: 'supportadmin@ordering.co', user_hash: 'supportadmin-hash' })])
  })

  it.each([null, undefined, 'true', 1, false])('does not accept unresolved or malformed support eligibility %j', allowed => {
    state.project.intercomAllowed = allowed
    renderWrapper()
    expect(widget()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not reload verified support when billing plan metadata changes', async () => {
    fetch.mockResolvedValue(resolveHash('stable-hash'))
    const view = renderWrapper()
    await act(async () => {})
    const script = widget()
    state.project = { ...state.project, plan: { id: 101 } }
    rerender(view)
    await act(async () => {})
    expect(widget()).toBe(script)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(window.intercomSettings.user_hash).toBe('stable-hash')
  })

  it('boots other plans even when they have a one_time_payment flag', async () => {
    state.project.plan.one_time_payment = true
    fetch.mockResolvedValue(resolveHash('other-plan-hash'))
    renderWrapper()
    await act(async () => {})
    expect(widget()).not.toBeNull()
    expect(queuedCalls()).toContainEqual(['boot', expect.objectContaining({ email: 'owner@example.test' })])
  })

  it('retains support when a readable billing response confirms no plan', async () => {
    state.project.plan = null
    fetch.mockResolvedValue(resolveHash('verified-no-plan-hash'))
    renderWrapper()
    await act(async () => {})
    expect(widget()).not.toBeNull()
  })

  it.each([581, '581'])('also excludes trial subscriptions on plan %s', planId => {
    state.project.plan = null
    state.project.trialSubscription = { status: 'trialing', plan: { plan: { id: planId } } }
    state.project.intercomAllowed = false
    renderWrapper()
    expect(widget()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['past_due', 'unpaid', 'canceled'])('excludes the current billing relation on plan 581 with %s status', status => {
    state.project.plan = null
    state.project.intercomAllowed = false
    state.project.project.current_status = status
    renderWrapper()
    expect(widget()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shuts down and clears identity on project change, then restores an eligible project', async () => {
    fetch.mockResolvedValue(resolveHash('old-hash'))
    const view = renderWrapper()
    await act(async () => {})
    window.Intercom = vi.fn()
    const intercom = window.Intercom
    window.intercomSettings.user_hash = 'old-hash'
    state.project = { ...state.project, intercomAllowed: false, project: { id: 2, code: 'beta' }, plan: { id: 581 } }
    rerender(view)
    setAssistantIntercomHidden(true)
    setAssistantIntercomHidden(false)
    setIntercomSettings({ user_hash: 'old-hash' })
    expect(intercom).toHaveBeenCalledWith('shutdown')
    expect(widget()).toBeNull()
    expect(window.intercomSettings).toBeUndefined()
    expect(intercom.mock.calls.filter(([command]) => command === 'boot' || command === 'update')).toEqual([])
    fetch.mockResolvedValue(resolveHash('new-project-hash'))
    state.project = { ...state.project, intercomAllowed: true, plan: { id: 101 } }
    rerender(view)
    expect(widget()).toBeNull()
    expect(window.intercomSettings.user_hash).toBeUndefined()
    await act(async () => {})
    expect(widget()).not.toBeNull()
    expect(window.intercomSettings.user_hash).toBe('new-project-hash')
  })

  it('restores support visibility when Assistant opened before support finished resolving', async () => {
    fetch.mockResolvedValue(resolveHash('assistant-hash'))
    state.project = { ...state.project, loading: true, intercomAllowed: null, planResolved: false }
    const view = renderWrapper()
    setAssistantIntercomHidden(true)
    state.project = { ...state.project, loading: false, intercomAllowed: true, planResolved: true }
    rerender(view)
    await act(async () => {})
    expect(widget()).not.toBeNull()
    expect(window.intercomSettings.hide_default_launcher).toBe(true)
    setAssistantIntercomHidden(false)
    expect(window.intercomSettings.hide_default_launcher).toBe(false)
    expect(window.intercomSettings.hide_notifications).toBe(false)
  })

  it('boots a verified SDK for managers already permitted by the widget config', async () => {
    state.session.user = { ...state.session.user, level: 2 }
    state.config.configs = { ordering_support_widget: { value: '0' } }
    fetch.mockResolvedValue(resolveHash('verified-manager-hash'))
    renderWrapper()
    await act(async () => {})
    expect(widget()?.src).toBe('https://widget.intercom.io/widget/demo-intercom-app')
    expect(queuedCalls()).toContainEqual(['boot', expect.objectContaining({ level: 2, user_hash: 'verified-manager-hash' })])
  })

  it('loads support when a permitted manager becomes an admin in the same session', async () => {
    state.session.user = { ...state.session.user, level: 2 }
    fetch.mockResolvedValue(resolveHash('verified-hash'))
    const view = renderWrapper()
    await act(async () => {})
    expect(widget()).not.toBeNull()
    state.session = { ...state.session, user: { ...state.session.user, level: 0 } }
    rerender(view)
    await act(async () => {})
    expect(widget()).not.toBeNull()
    expect(window.intercomSettings.user_hash).toBe('verified-hash')
  })

  it('updates a profile without reloading the SDK or losing its verified hash', async () => {
    fetch.mockResolvedValue(resolveHash('verified-hash'))
    const view = renderWrapper()
    await act(async () => {})
    const script = widget()
    expect(window.intercomSettings.user_hash).toBe('verified-hash')
    state.session = { ...state.session, user: { ...state.session.user, first_name: 'Changed' } }
    rerender(view)
    expect(widget()).toBe(script)
    expect(window.intercomSettings).toMatchObject({ name: 'Changed', user_hash: 'verified-hash' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ignores a previous login hash that resolves after logout and another login', async () => {
    let finishOldHash
    let finishNewHash
    fetch.mockImplementationOnce(() => new Promise(resolve => { finishOldHash = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { finishNewHash = resolve }))
    const view = renderWrapper()
    state.session = { auth: false, user: null, token: null }
    rerender(view)
    state.session = { auth: true, token: 'token-b', user: { id: 2, level: 0, email: 'new@example.test' } }
    rerender(view)
    await act(async () => finishOldHash(resolveHash('old-user-hash')))
    expect(window.intercomSettings.email).toBe('new@example.test')
    expect(window.intercomSettings.user_hash).toBeUndefined()
    expect(widget()).toBeNull()
    expect(queuedCalls().filter(([command, settings]) => command === 'boot' && settings?.user_hash === 'old-user-hash')).toEqual([])
    await act(async () => finishNewHash(resolveHash('new-user-hash')))
    expect(queuedCalls().filter(([command]) => command === 'boot')).toEqual([['boot', expect.objectContaining({ email: 'new@example.test', user_hash: 'new-user-hash' })]])
  })

  it('does not allow an SDK load callback to revive a newly excluded project', async () => {
    fetch.mockResolvedValue(resolveHash('verified-sdk-hash'))
    const view = renderWrapper()
    await act(async () => {})
    const loadingScript = widget()
    state.project = { ...state.project, intercomAllowed: false, plan: { id: 581 } }
    rerender(view)
    window.Intercom = vi.fn()
    const loadedSdk = window.Intercom
    act(() => loadingScript.dispatchEvent(new Event('load')))
    expect(loadedSdk).toHaveBeenCalledWith('shutdown')
    expect(window.Intercom).toBeUndefined()
  })

  it('shuts down a late SDK from a previous login while the next identity hash is pending', async () => {
    let finishNewHash
    fetch.mockResolvedValueOnce(resolveHash('first-user-hash'))
      .mockImplementationOnce(() => new Promise(resolve => { finishNewHash = resolve }))
    const view = renderWrapper()
    await act(async () => {})
    const oldScript = widget()
    state.session = { auth: false, user: null, token: null }
    rerender(view)
    state.session = { auth: true, token: 'new-token', user: { id: 2, level: 0, email: 'next@ordering.co' } }
    rerender(view)
    window.Intercom = vi.fn()
    const lateSdk = window.Intercom
    act(() => oldScript.dispatchEvent(new Event('load')))
    expect(lateSdk).toHaveBeenCalledWith('shutdown')
    expect(window.Intercom).toBeUndefined()
    await act(async () => finishNewHash(resolveHash('next-user-hash')))
    expect(queuedCalls().filter(([command]) => command === 'boot')).toEqual([['boot', expect.objectContaining({ email: 'next@ordering.co', user_hash: 'next-user-hash' })]])
  })

  it('preserves the next verified identity when a previous SDK finishes loading', async () => {
    fetch.mockResolvedValueOnce(resolveHash('first-user-hash'))
      .mockResolvedValueOnce(resolveHash('next-user-hash'))
    const view = renderWrapper()
    await act(async () => {})
    const oldScript = widget()
    state.session = { auth: false, user: null, token: null }
    rerender(view)
    state.session = { auth: true, token: 'new-token', user: { id: 2, level: 0, email: 'next@ordering.co' } }
    rerender(view)
    await act(async () => {})
    window.Intercom = vi.fn()
    const lateSdk = window.Intercom
    act(() => oldScript.dispatchEvent(new Event('load')))
    expect(lateSdk).not.toHaveBeenCalledWith('shutdown')
    expect(window.intercomSettings).toMatchObject({ email: 'next@ordering.co', user_hash: 'next-user-hash' })
  })

  it('removes pending page-load listeners when access is revoked before the page loads', async () => {
    fetch.mockResolvedValue(resolveHash('verified-pageload-hash'))
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' })
    const view = renderWrapper()
    await act(async () => {})
    state.project = { ...state.project, intercomAllowed: false, plan: { id: 581 } }
    rerender(view)
    act(() => window.dispatchEvent(new Event('load')))
    expect(widget()).toBeNull()
    expect(window.intercomSettings).toBeUndefined()
  })

  it.each([
    { user: { id: 2, level: 2, email: 'manager@example.test' }, configs: { ordering_support_widget: { value: '1' } } }
  ])('preserves existing support restrictions for $user.email', ({ user, configs }) => {
    state.session.user = user
    state.config.configs = configs || {}
    renderWrapper()
    expect(widget()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
