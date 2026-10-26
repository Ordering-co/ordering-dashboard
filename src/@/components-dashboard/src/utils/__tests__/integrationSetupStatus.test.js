import { describe, expect, it } from 'vitest'
import {
  INTEGRATION_SETUP_STATES,
  getIntegrationSetupStatus,
  getIntegrationSetupWarning,
  getIntegrationSetupAction,
  getIntegrationPluginLinkKeys,
  normalizeIntegrationSetupStatus
} from '../integrationSetupStatus'

const t = (key, fallback) => `${key}|${fallback}`

describe('integrationSetupStatus', () => {
  it('maps the three API values to their state', () => {
    expect(normalizeIntegrationSetupStatus('pending')).toBe(INTEGRATION_SETUP_STATES.PENDING)
    expect(normalizeIntegrationSetupStatus('success')).toBe(INTEGRATION_SETUP_STATES.CONNECTED)
    expect(normalizeIntegrationSetupStatus('failed')).toBe(INTEGRATION_SETUP_STATES.FAILED)
  })

  it('maps the words plugins wrote before the enum', () => {
    expect(normalizeIntegrationSetupStatus('completed')).toBe(INTEGRATION_SETUP_STATES.CONNECTED)
    expect(normalizeIntegrationSetupStatus(' Complete ')).toBe(INTEGRATION_SETUP_STATES.CONNECTED)
    expect(normalizeIntegrationSetupStatus('ERROR')).toBe(INTEGRATION_SETUP_STATES.FAILED)
  })

  it('treats nothing reported as not connected and an unknown word as pending', () => {
    expect(normalizeIntegrationSetupStatus(null)).toBe(INTEGRATION_SETUP_STATES.NOT_CONNECTED)
    expect(normalizeIntegrationSetupStatus('')).toBe(INTEGRATION_SETUP_STATES.NOT_CONNECTED)
    expect(normalizeIntegrationSetupStatus('in_progress')).toBe(INTEGRATION_SETUP_STATES.PENDING)
  })

  // Regression: any non-empty setup_status used to be painted as connected,
  // so a failed business showed in green.
  it('never shows a failed integration as connected', () => {
    const status = getIntegrationSetupStatus({ setup_status: 'failed', setup_message: 'Clover token revoked' }, t)

    expect(status).toEqual({
      state: INTEGRATION_SETUP_STATES.FAILED,
      label: 'INTEGRATION_STATUS_FAILED|Needs attention',
      tone: 'danger',
      message: 'Clover token revoked'
    })
  })

  it('shows a business without an integration row as not connected', () => {
    expect(getIntegrationSetupStatus(null, t)).toMatchObject({
      state: INTEGRATION_SETUP_STATES.NOT_CONNECTED,
      label: 'BUSINESS_POS_STATUS_NOT_CONNECTED|Not connected',
      tone: 'neutral',
      message: null
    })
  })

  // A row is created when the connection starts and the plugin reports on it
  // later: until then it is a setup in progress, not "Not connected".
  it('shows a row without a reported status as pending', () => {
    expect(getIntegrationSetupStatus({ setup_status: null }, t)).toMatchObject({
      state: INTEGRATION_SETUP_STATES.PENDING,
      label: 'INTEGRATION_STATUS_PENDING|Setup pending',
      tone: 'warning'
    })
    expect(getIntegrationSetupStatus({ setup_status: '  ' }, t).state).toBe(INTEGRATION_SETUP_STATES.PENDING)
  })

  it('ignores a blank message', () => {
    expect(getIntegrationSetupStatus({ setup_status: 'success', setup_message: '  ' }, t).message).toBeNull()
  })

  // Whatever its state, an integration whose plugin is disabled cannot be set
  // up or synced: the badge warns next to the state the plugin last reported.
  it('warns about an integration whose plugin is disabled, in any state', () => {
    const disabled = { id: 8, plugin: { enabled: false } }

    expect(getIntegrationSetupWarning({ setup_status: 'success' }, disabled, t)).toBe('INTEGRATION_PLUGIN_DISABLED_WARNING|The plugin of this integration is disabled.')
    expect(getIntegrationSetupWarning({ setup_status: 'success' }, { id: 8, plugin: null }, t)).not.toBeNull()
    expect(getIntegrationSetupWarning({ setup_status: 'success' }, { id: 8, plugin: { enabled: true } }, t)).toBeNull()
    expect(getIntegrationSetupWarning({ setup_status: 'failed' }, disabled, t)).not.toBeNull()
    expect(getIntegrationSetupWarning({ setup_status: null }, disabled, t)).not.toBeNull()
    expect(getIntegrationSetupWarning(null, disabled, t)).toBeNull()
  })

  // One rule for the business panel, the list and the detail.
  it('offers the plugin setup page only when the plugin can run it', () => {
    const integration = { id: 9, plugin: { root: 'https://clover.test', setup_url: '/setup', links: {} } }

    expect(getIntegrationSetupAction({ setup_status: 'failed' }, integration, t)).toEqual({ kind: 'fix', path: '/setup', label: 'RECONNECT|Reconnect' })
    expect(getIntegrationSetupAction({ setup_status: null }, integration, t)).toEqual({ kind: 'fix', path: '/setup', label: 'CONTINUE_SETUP|Continue setup' })
    expect(getIntegrationSetupAction({ setup_status: 'success' }, integration, t)).toEqual({ kind: 'setup', path: '/setup', label: 'SETUP|Setup' })
    expect(getIntegrationSetupAction({ setup_status: 'success' }, { id: 9, plugin: { links: { setup: '/views/setup' } } }, t).path).toBe('/views/setup')

    expect(getIntegrationSetupAction({ setup_status: 'success' }, { ...integration, plugin: { ...integration.plugin, enabled: false } }, t)).toBeNull()
    expect(getIntegrationSetupAction({ setup_status: 'failed' }, { id: 9, plugin: null }, t)).toBeNull()
    expect(getIntegrationSetupAction({ setup_status: 'failed' }, { id: 9, plugin: { root: 'https://x.test' } }, t)).toBeNull()
    expect(getIntegrationSetupAction(null, integration, t)).toBeNull()
  })

  it('offers the plugin pages, without its setup page, only while the plugin is available', () => {
    const plugin = { setup_url: '/views/setup', links: { general_settings: '/views/settings', setup: '/views/setup' } }

    expect(getIntegrationPluginLinkKeys({ id: 16, plugin })).toEqual(['general_settings'])
    expect(getIntegrationPluginLinkKeys({ id: 16, plugin: { ...plugin, enabled: false } })).toEqual([])
    expect(getIntegrationPluginLinkKeys({ id: 16, plugin: null })).toEqual([])
  })
})
