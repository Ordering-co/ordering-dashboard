import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() }
}))

import posthog from 'posthog-js'
import * as posthogAnalytics from '../posthog'
import {
  captureDashboardEvent,
  captureDashboardOperation,
  captureDashboardWebVital,
  getDashboardCommonProperties,
  getDashboardRoute,
  getDashboardUserProperties,
  sanitizeAnalyticsProperties,
  sanitizeDashboardEventForSending,
  sanitizePersonProperties,
  shouldCaptureDashboardAnalytics
} from '../posthog'

vi.mock('../../config', async importOriginal => {
  const original = await importOriginal()
  return { ...original, default: { ...original.default, posthog_analytics_enabled: true } }
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('dashboard PostHog analytics', () => {
  it('captures on every official production dashboard hostname when the kill switch is enabled', () => {
    expect(shouldCaptureDashboardAnalytics({ posthog_analytics_enabled: true }, 'dashboard.ordering.co')).toBe(true)
    expect(shouldCaptureDashboardAnalytics({ posthog_analytics_enabled: true }, 'dashboard.orderingplus.com')).toBe(true)
    expect(shouldCaptureDashboardAnalytics({ posthog_analytics_enabled: true }, 'dashboard.tryordering.com')).toBe(true)
    expect(shouldCaptureDashboardAnalytics({ posthog_analytics_enabled: true }, 'dashboardcf.orderingplus.com')).toBe(true)
    expect(shouldCaptureDashboardAnalytics({ posthog_analytics_enabled: true }, '127.0.0.1')).toBe(false)
    expect(shouldCaptureDashboardAnalytics({ posthog_analytics_enabled: false }, 'dashboard.ordering.co')).toBe(false)
  })

  it('captures custom production domains while excluding worker previews', () => {
    const config = { posthog_analytics_enabled: true, use_project_domain: true }

    expect(shouldCaptureDashboardAnalytics(config, 'dashboard.customer.com')).toBe(true)
    expect(shouldCaptureDashboardAnalytics(config, 'branch-preview.workers.dev')).toBe(false)
    expect(shouldCaptureDashboardAnalytics(config, 'branch-preview.pages.dev')).toBe(false)
    expect(shouldCaptureDashboardAnalytics(config, 'localhost')).toBe(false)
  })

  it('does not send events from an environment without an explicit opt-in', () => {
    vi.stubGlobal('location', { hostname: 'preview.local' })

    expect(captureDashboardEvent('dashboard_module_viewed', { module: 'orders' })).toBe(false)
    expect(posthog.capture).not.toHaveBeenCalled()
  })

  it('sends the standardized operation state without arbitrary properties', () => {
    vi.stubGlobal('location', { hostname: 'dashboard.ordering.co' })

    expect(captureDashboardOperation({
      status: 'failed',
      module: 'orders',
      action: 'load_orders',
      failureType: 'api'
    })).toBe(true)
    expect(posthog.capture).toHaveBeenCalledWith('dashboard_operation_failed', {
      app_surface: 'ordering_dashboard',
      environment: 'production',
      status: 'failed',
      module: 'orders',
      action: 'load_orders',
      failure_type: 'api'
    })
  })

  it('captures Web Vitals as numeric measurements without browser details', () => {
    vi.stubGlobal('location', { hostname: 'dashboard.ordering.co' })

    expect(captureDashboardWebVital({ name: 'LCP', value: 1234.56789, rating: 'needs-improvement' })).toBe(true)
    expect(posthog.capture).toHaveBeenCalledWith('dashboard_web_vital', {
      app_surface: 'ordering_dashboard',
      environment: 'production',
      metric: 'LCP',
      value: 1234.568,
      rating: 'needs-improvement'
    })
  })

  it('registers Web Vitals only after an enabled production PostHog client loads', () => {
    const report = vi.fn()
    const client = { capture: vi.fn() }
    const registerDashboardWebVitals = posthogAnalytics.registerDashboardWebVitals

    expect(registerDashboardWebVitals).toBeTypeOf('function')
    expect(registerDashboardWebVitals({
      client,
      config: { posthog_analytics_enabled: false },
      hostname: 'dashboard.ordering.co',
      reportWebVitals: report
    })).toBe(false)
    expect(registerDashboardWebVitals({
      client,
      config: { posthog_analytics_enabled: true },
      hostname: 'dashboard.ordering.co',
      reportWebVitals: report
    })).toBe(true)
    expect(report).toHaveBeenCalledTimes(1)
  })

  it('keeps approved dimensions and rejects PII, identifiers and nested payloads', () => {
    expect(sanitizeAnalyticsProperties({
      module: 'orders',
      project_id: '301605',
      email: 'private@example.com',
      phone: '+10000000000',
      promotion_id: 99,
      response: { result: 'secret' },
      fields: ['name', 'rate']
    })).toEqual({
      module: 'orders',
      project_id: '301605',
      promotion_id: 99,
      fields: ['name', 'rate']
    })
  })

  it('preserves PostHog transport properties while removing URL, browser and PII enrichment', () => {
    expect(sanitizeDashboardEventForSending({
      event: 'dashboard_module_viewed',
      properties: {
        token: 'phc_public',
        distinct_id: '42',
        $session_id: 'session-1',
        $device_id: 'device-1',
        $lib: 'web',
        app_surface: 'ordering_dashboard',
        module: 'orders',
        $current_url: 'https://dashboard.ordering.co/orders?token=secret',
        $browser: 'Chrome',
        email: 'private@example.com'
      }
    })).toEqual({
      event: 'dashboard_module_viewed',
      properties: {
        token: 'phc_public',
        distinct_id: '42',
        $session_id: 'session-1',
        $device_id: 'device-1',
        $lib: 'web',
        app_surface: 'ordering_dashboard',
        module: 'orders'
      }
    })
  })

  it('keeps PostHog system events on hosts where custom dashboard analytics is disabled', () => {
    const preparePostHogEventForSending = posthogAnalytics.preparePostHogEventForSending
    expect(preparePostHogEventForSending).toBeTypeOf('function')

    const identifyEvent = {
      event: '$identify',
      properties: { token: 'phc_public', distinct_id: '42' }
    }

    expect(preparePostHogEventForSending(
      identifyEvent,
      { posthog_analytics_enabled: true, use_project_domain: false },
      'tenant.example.com'
    )).toBe(identifyEvent)
    expect(preparePostHogEventForSending(
      { event: 'dashboard_module_viewed', properties: { token: 'phc_public' } },
      { posthog_analytics_enabled: true, use_project_domain: false },
      'tenant.example.com'
    )).toBeNull()
    expect(preparePostHogEventForSending(
      identifyEvent,
      { posthog_analytics_enabled: true },
      'localhost'
    )).toBeNull()
    expect(preparePostHogEventForSending(
      identifyEvent,
      { posthog_analytics_enabled: true },
      'branch-preview.workers.dev'
    )).toBeNull()
  })

  it('preserves identify events so approved person properties reach PostHog', () => {
    const identifyEvent = {
      event: '$identify',
      properties: { $set: { email: 'owner@example.com', name: 'Ada' } }
    }

    expect(sanitizeDashboardEventForSending(identifyEvent)).toBe(identifyEvent)
  })

  it('restores approved PostHog person properties without allowing them on events', () => {
    const userProperties = getDashboardUserProperties({
      id: 17,
      email: 'owner@example.com',
      name: 'Ada',
      lastname: 'Lovelace',
      cellphone: 5551234,
      country_phone_code: '+1',
      level: 0,
      created_at: '2024-01-02T03:04:05Z',
      user_system_id: 99,
      email_verified: true,
      language_id: 1,
      password: 'secret'
    })

    expect(sanitizePersonProperties(userProperties)).toEqual({
      billing_user_id: 99,
      email: 'owner@example.com',
      created_at: '2024-01-02T03:04:05Z',
      dashboard_user_id: 17,
      email_verified: true,
      is_billing_user: true,
      language_id: 1,
      level: 0,
      name: 'Ada',
      lastname: 'Lovelace',
      cellphone: '5551234',
      phone: '+1 5551234',
      user_id: 'owner@example.com',
      user_level: 0
    })
    expect(sanitizeAnalyticsProperties(userProperties)).toEqual({})
  })

  it('builds the legacy projects group schema without copying API payloads', () => {
    const getDashboardGroupProperties = posthogAnalytics.getDashboardGroupProperties
    expect(getDashboardGroupProperties).toBeTypeOf('function')
    expect(getDashboardGroupProperties({
      project: {
        id: 12,
        code: 'demo',
        current_status: 'active',
        project_current_status_until: '2026-12-31'
      },
      planId: 401,
      projectOwnerId: 99,
      addons: ['addon_loyalty', 'addon_connect'],
      response: { private: true }
    })).toEqual({
      project_addons: ['addon_connect', 'addon_loyalty'],
      project_code: 'demo',
      project_current_status: 'active',
      project_current_status_until: '2026-12-31',
      project_owner_id: 99,
      project_plan: 401
    })
  })

  it('normalizes alternate user field names used by the dashboard session', () => {
    expect(getDashboardUserProperties({
      email: 'manager@example.com',
      first_name: 'Grace',
      last_name: 'Hopper',
      cellphone: '5559876'
    })).toEqual({
      email: 'manager@example.com',
      name: 'Grace',
      lastname: 'Hopper',
      cellphone: '5559876',
      phone: '5559876',
      user_id: 'manager@example.com'
    })
  })

  it('groups dynamic URLs without sending record identifiers', () => {
    expect(getDashboardRoute('/free-downloads')).toEqual({ route: '/free-downloads', module: 'my_products' })
    expect(getDashboardRoute('/builder')).toEqual({ route: '/builder', module: 'my_products' })
    expect(getDashboardRoute('/builder/41')).toEqual({ route: '/builder', module: 'my_products' })
    expect(getDashboardRoute('/open-source-code')).toEqual({ route: '/open-source-code', module: 'my_products' })
    expect(getDashboardRoute('/open-source-code/private-version')).toEqual({ route: '/open-source-code', module: 'my_products' })
    expect(getDashboardRoute('/settings')).toEqual({ route: '/settings', module: 'settings' })
    expect(getDashboardRoute('/settings/logs')).toEqual({ route: '/settings', module: 'settings' })
    expect(getDashboardRoute('/all-settings')).toEqual({ route: '/all-settings', module: 'settings' })
    expect(getDashboardRoute('/orders/12345')).toEqual({ route: '/orders', module: 'orders' })
    expect(getDashboardRoute('/onboarding/store')).toEqual({ route: '/onboarding', module: 'stores' })
    expect(getDashboardRoute('/stores/products/987')).toEqual({ route: '/stores', module: 'stores' })
    expect(getDashboardRoute('/connect/sales-channels')).toEqual({ route: '/connect', module: 'connect' })
    expect(getDashboardRoute('/not-a-dashboard-route/secret')).toEqual({
      route: '/not-a-dashboard-route',
      module: 'other'
    })
    expect(getDashboardRoute('/stripe-connect/accounts')).toEqual({ route: '/stripe-connect', module: 'connect' })
    expect(getDashboardRoute('/messages/123')).toEqual({ route: '/messages', module: 'messages' })
    expect(getDashboardRoute('/assistant')).toEqual({ route: '/assistant', module: 'assistant' })
  })

  it('builds safe runtime-error signatures and admits each one once up to the session cap', () => {
    const getDashboardErrorSignature = posthogAnalytics.getDashboardErrorSignature
    const shouldCaptureDashboardRuntimeError = posthogAnalytics.shouldCaptureDashboardRuntimeError
    expect(getDashboardErrorSignature).toBeTypeOf('function')
    expect(shouldCaptureDashboardRuntimeError).toBeTypeOf('function')

    const first = getDashboardErrorSignature({
      failureType: 'runtime_error',
      message: 'Private customer value',
      source: 'https://dashboard.ordering.co/private.js'
    })
    const second = getDashboardErrorSignature({
      failureType: 'runtime_error',
      message: 'A different error',
      source: 'https://dashboard.ordering.co/private.js'
    })
    expect(first).toMatch(/^[a-f0-9]{8}$/)
    expect(second).not.toBe(first)

    const seen = new Set()
    expect(shouldCaptureDashboardRuntimeError(seen, first, 2)).toBe(true)
    expect(shouldCaptureDashboardRuntimeError(seen, first, 2)).toBe(false)
    expect(shouldCaptureDashboardRuntimeError(seen, second, 2)).toBe(true)
    expect(shouldCaptureDashboardRuntimeError(seen, 'third', 2)).toBe(false)
  })

  it('builds a common context without user profile fields', () => {
    vi.stubGlobal('location', { hostname: 'dashboard.ordering.co' })

    expect(getDashboardCommonProperties({
      project: { id: 12, code: 'demo', name: 'Private project name' },
      plan: { id: 401 },
      user: { id: 9, level: 0, email: 'private@example.com' }
    })).toEqual({
      app_surface: 'ordering_dashboard',
      environment: 'production',
      project_id: '12',
      project_code: 'demo',
      user_role: '0',
      plan_id: '401'
    })
  })
})

describe('login v2 privacy and compatibility', () => {
  it('bounds new enum and duration properties without changing legacy operation dimensions', () => {
    expect(sanitizeAnalyticsProperties({
      schema_version: 2,
      capability: 'login',
      actor_type: 'unknown',
      context_state: 'pre_auth',
      operation_kind: 'technical',
      trigger: 'user',
      duration_ms: 12,
      cancel_reason: 'superseded',
      validation_code: 'captcha_required',
      module: 'authentication',
      action: 'login_cellphone',
      email: 'private@customer.test',
      password: 'secret',
      one_time_password: '123456',
      payload: { code: '123456' }
    })).toEqual({
      schema_version: 2,
      capability: 'login',
      actor_type: 'unknown',
      context_state: 'pre_auth',
      operation_kind: 'technical',
      trigger: 'user',
      duration_ms: 12,
      cancel_reason: 'superseded',
      validation_code: 'captcha_required',
      module: 'authentication',
      action: 'login_cellphone'
    })
    expect(sanitizeAnalyticsProperties({
      schema_version: '2',
      capability: 'private text',
      actor_type: 'private actor',
      context_state: 'private context',
      operation_kind: 'private kind',
      trigger: 'private trigger',
      duration_ms: Infinity,
      cancel_reason: 'private reason',
      validation_code: 'private error'
    })).toEqual({})
    expect(sanitizeAnalyticsProperties({ duration_ms: -1 })).toEqual({})
    expect(sanitizeAnalyticsProperties({ duration_ms: '12' })).toEqual({})
  })

  it('keeps legacy authentication context and SDK identity/flag events unchanged', () => {
    const config = { posthog_analytics_enabled: true }
    const properties = {
      token: 'sdk-token',
      distinct_id: 'user',
      project_id: 'old-id',
      project_code: 'old-code',
      $groups: { project: 'old' },
      user_role: '0'
    }
    const legacy = { event: 'dashboard_operation_started', properties: { ...properties, module: 'authentication', action: 'login_email' } }
    expect(posthogAnalytics.preparePostHogEventForSending(legacy, config, 'dashboard.ordering.co')).toEqual(legacy)
    for (const event of ['$identify', '$set', '$groupidentify', '$feature_flag_called']) {
      const sdkEvent = { event, properties }
      expect(posthogAnalytics.preparePostHogEventForSending(sdkEvent, config, 'dashboard.ordering.co')).toBe(sdkEvent)
    }
  })

  it('gates the new login emitter on existing host settings', () => {
    vi.stubGlobal('location', { hostname: 'localhost' })
    expect(posthogAnalytics.captureDashboardLoginOperation({ status: 'started', action: 'login_email', projectCode: 'customer' })).toBe(false)
    expect(posthog.capture).not.toHaveBeenCalled()
    vi.stubGlobal('location', { hostname: 'branch.workers.dev' })
    expect(posthogAnalytics.captureDashboardLoginValidation({ action: 'login_otp', validationCode: 'form_invalid' })).toBe(false)
    expect(posthog.capture).not.toHaveBeenCalled()
  })

  it.each([{ private: 'secret' }, ['private']])('does not reintroduce a non-scalar pre-auth project code after sanitization: %j', projectCode => {
    vi.stubGlobal('location', { hostname: 'dashboard.ordering.co' })
    captureDashboardEvent('dashboard_operation_started', {
      schema_version: 2,
      module: 'authentication',
      capability: 'login',
      context_state: 'pre_auth',
      action: 'login_email',
      project_code: projectCode
    })
    expect(posthog.capture.mock.calls[0][1].project_code).toBeNull()
  })
})
