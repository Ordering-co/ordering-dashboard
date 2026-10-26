// State of a business's connection to a POS or sales channel, from
// `business_third_party_integrations.setup_status` (api-core keeps it to
// pending | success | failed, plus a `setup_message` saying why).
//
// The column was free text before, and an API that predates the enum can
// still answer `completed` or `complete`, so values are mapped the same way
// api-core maps them (BusinessIntegrationSetupStatusEnum::normalize).

import { getPluginSetupPath } from './posPluginCatalog'
import { getPluginPageLinkKeys } from './pluginPages'
import { isPluginInstallFailed, isPluginInstalling } from './pluginInstall'

export const INTEGRATION_SETUP_STATES = {
  NOT_CONNECTED: 'not_connected',
  PENDING: 'pending',
  CONNECTED: 'connected',
  FAILED: 'failed'
}

const STATUS_ALIASES = {
  pending: INTEGRATION_SETUP_STATES.PENDING,
  success: INTEGRATION_SETUP_STATES.CONNECTED,
  complete: INTEGRATION_SETUP_STATES.CONNECTED,
  completed: INTEGRATION_SETUP_STATES.CONNECTED,
  connected: INTEGRATION_SETUP_STATES.CONNECTED,
  failed: INTEGRATION_SETUP_STATES.FAILED,
  error: INTEGRATION_SETUP_STATES.FAILED
}

const STATE_TONES = {
  [INTEGRATION_SETUP_STATES.NOT_CONNECTED]: 'neutral',
  [INTEGRATION_SETUP_STATES.PENDING]: 'warning',
  [INTEGRATION_SETUP_STATES.CONNECTED]: 'success',
  [INTEGRATION_SETUP_STATES.FAILED]: 'danger'
}

// Literal t() calls so `pnpm i18n:generate` finds the keys.
const STATE_LABELS = {
  [INTEGRATION_SETUP_STATES.NOT_CONNECTED]: t => t('BUSINESS_POS_STATUS_NOT_CONNECTED', 'Not connected'),
  [INTEGRATION_SETUP_STATES.PENDING]: t => t('INTEGRATION_STATUS_PENDING', 'Setup pending'),
  [INTEGRATION_SETUP_STATES.CONNECTED]: t => t('INTEGRATION_STATUS_CONNECTED', 'Connected'),
  [INTEGRATION_SETUP_STATES.FAILED]: t => t('INTEGRATION_STATUS_FAILED', 'Needs attention')
}

export const normalizeIntegrationSetupStatus = (status) => {
  if (status === null || status === undefined) return INTEGRATION_SETUP_STATES.NOT_CONNECTED
  const value = String(status).trim().toLowerCase()
  if (!value) return INTEGRATION_SETUP_STATES.NOT_CONNECTED
  // An unknown word does not prove the setup finished.
  return STATUS_ALIASES[value] || INTEGRATION_SETUP_STATES.PENDING
}

/**
 * What to show for a business integration row: no row is not connected, a
 * row without a reported status is pending.
 * @param {object|null} integration row of business.third_party_integrations
 * @param {function} t translate function from useLanguage()
 * @returns {{ state: string, label: string, tone: string, message: string|null }}
 */
export const getIntegrationSetupStatus = (integration, t) => {
  const reported = integration ? normalizeIntegrationSetupStatus(integration.setup_status) : INTEGRATION_SETUP_STATES.NOT_CONNECTED
  // The row exists once the connection is started (the Connect button
  // creates it empty), so a row the plugin has not reported on yet is a
  // setup in progress, not a business without a POS.
  const state = integration && reported === INTEGRATION_SETUP_STATES.NOT_CONNECTED
    ? INTEGRATION_SETUP_STATES.PENDING
    : reported
  const message = state !== INTEGRATION_SETUP_STATES.NOT_CONNECTED && typeof integration?.setup_message === 'string' && integration.setup_message.trim()
    ? integration.setup_message.trim()
    : null
  return { state, label: STATE_LABELS[state](t), tone: STATE_TONES[state], message }
}

/**
 * Warning for a business integration whose plugin is uninstalled or
 * disabled: in any state, nothing can set it up or sync it. Null when there
 * is nothing to warn about.
 * @param {object|null} row row of business.third_party_integrations
 * @param {object|null} integration the catalog integration, with its plugin
 * @param {function} t translate function from useLanguage()
 * @returns {string|null}
 */
export const getIntegrationSetupWarning = (row, integration, t) => {
  if (!row || !integration) return null
  if (isPluginInstallFailed(integration.plugin)) {
    return t('INTEGRATION_PLUGIN_INSTALL_FAILED_WARNING', 'The plugin of this integration did not finish installing.')
  }
  if (isPluginInstalling(integration.plugin)) {
    return t('INTEGRATION_PLUGIN_INSTALLING_WARNING', 'The plugin of this integration is still finishing its install.')
  }
  return isIntegrationPluginAvailable(integration)
    ? null
    : t('INTEGRATION_PLUGIN_DISABLED_WARNING', 'The plugin of this integration is disabled.')
}

/**
 * Whether the plugin behind an integration can serve it: installed, enabled
 * and done with its install (not installing, not failed). Its pages, its
 * setup and its syncs all need it.
 * @param {object|null} integration the catalog integration, with its plugin
 * @returns {boolean}
 */
export const isIntegrationPluginAvailable = (integration) =>
  !!integration?.plugin && integration.plugin.enabled !== false &&
  !isPluginInstallFailed(integration.plugin) && !isPluginInstalling(integration.plugin)

/**
 * Short note under an installed integration that cannot be connected because
 * of its plugin. Null when its plugin can serve it, or while it is still
 * installing (the row shows that state itself, getPluginInstallState).
 * @param {object|null} integration the catalog integration, with its plugin
 * @param {function} t translate function from useLanguage()
 * @returns {string|null}
 */
export const getIntegrationPluginNote = (integration, t) => {
  if (!integration?.plugin_id || !integration?.plugin || isIntegrationPluginAvailable(integration)) return null
  if (isPluginInstalling(integration.plugin)) return null
  return isPluginInstallFailed(integration.plugin)
    ? t('INTEGRATION_PLUGIN_INSTALL_FAILED_NOTE', 'Install failed')
    : t('INTEGRATION_PLUGIN_DISABLED_NOTE', 'Plugin disabled')
}

/**
 * The plugin's own pages (plugin.links) the integration detail offers: none
 * while the plugin is unavailable, never the setup page, which the setup
 * action offers instead, nor the reserved keys (getPluginPageLinkKeys).
 * @param {object|null} integration the catalog integration, with its plugin
 * @returns {Array<string>} keys of plugin.links
 */
export const getIntegrationPluginLinkKeys = (integration) => {
  if (!isIntegrationPluginAvailable(integration)) return []
  return getPluginPageLinkKeys(integration.plugin)
}

/**
 * The setup action a business integration offers, one rule for the business
 * panel, the list and the detail. The setup page is the plugin's
 * (getPluginSetupPath: setup_url, else links.setup):
 * - plugin uninstalled or disabled, or no setup page: none;
 * - failed: "fix" (Reconnect); pending: "fix" (Continue setup);
 * - connected: "setup" (Setup).
 * @param {object|null} row row of business.third_party_integrations
 * @param {object|null} integration the catalog integration, with its plugin
 * @param {function} t translate function from useLanguage()
 * @returns {{ kind: 'fix'|'setup', path: string, label: string }|null}
 */
export const getIntegrationSetupAction = (row, integration, t) => {
  const path = getPluginSetupPath(integration?.plugin)
  if (!row || !isIntegrationPluginAvailable(integration) || !path) return null
  const { state } = getIntegrationSetupStatus(row, t)
  if (state === INTEGRATION_SETUP_STATES.FAILED) return { kind: 'fix', path, label: t('RECONNECT', 'Reconnect') }
  if (state === INTEGRATION_SETUP_STATES.PENDING) return { kind: 'fix', path, label: t('CONTINUE_SETUP', 'Continue setup') }
  return { kind: 'setup', path, label: t('SETUP', 'Setup') }
}
