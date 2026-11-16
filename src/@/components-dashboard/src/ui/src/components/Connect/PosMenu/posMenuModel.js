// Pure model of /connect/pos-menu: decides what the list row and the store
// panel show. No React, no t(): it returns translation keys and data.
import {
  POS_SETUP_CALL_PROVIDERS,
  POS_SETUP_CALL_URL,
  SALES_CHANNEL_CONTACT_URL,
  isCalendlyUrl,
  isContactUsSalesChannel,
  isSetupCallIntegration
} from '../../../utils/connectAccess'
import { getPluginSetupPath } from '../../../../../utils/posPluginCatalog'
import { INTEGRATION_SETUP_STATES, isIntegrationPluginAvailable, normalizeIntegrationSetupStatus } from '../../../../../utils/integrationSetupStatus'
import { getPluginInstallState } from '../../../../../utils/pluginInstall'
import { connectKind } from './connectKinds'

const asArray = (value) => (Array.isArray(value) ? value : [])

// Every business link of an integration type, `pos` unless told otherwise (mirrors SingleBusiness:39 for business_id).
// redesign SC-A: the type is an argument so /connect/sales-channels reads its own links with the same rule.
export const connectedLinks = (business, integrations, type = 'pos') => {
  if (!business) return []
  const catalog = asArray(integrations)
  return asArray(business.third_party_integrations)
    .filter((link) => link && (link.business_id == null || link.business_id === business.id))
    .map((link) => {
      const fromCatalog = catalog.find((item) => item?.id === link.third_party_integration_id)
      const nested = link.third_party_integration || null
      const isOfType = nested?.type === type || fromCatalog?.type === type
      return isOfType ? { link, integration: fromCatalog || nested || null } : null
    })
    .filter(Boolean)
}

export const connectedPosLinks = (business, integrations) => connectedLinks(business, integrations, 'pos')

// The integrations of a type linked to a store, for the cells of the table. `name` is null when nothing names it (the UI says what to show).
export const linkedIntegrations = (business, integrations, type) => (
  connectedLinks(business, integrations, type).map(({ link, integration }) => ({
    id: integration?.id ?? link.third_party_integration_id ?? null,
    name: integration?.name || null,
    logo: integration?.logo ?? null,
    enabled: link.enabled !== false
  }))
)

// (main #390/#394, owner decision D1 = C): the state of a link is main's (utils/integrationSetupStatus, api-core keeps
// setup_status to pending | success | failed); an unknown word is pending. D1 option C: no reported status is «Connected». The labels are translated, never the raw text. «Turned off»
// (a link with enabled false) is the redesign's and goes first. The family is the Product Status one.
const SETUP_STATES = {
  [INTEGRATION_SETUP_STATES.PENDING]: { statusKey: 'INTEGRATION_STATUS_PENDING', statusDefault: 'Setup pending', family: 'pending' },
  [INTEGRATION_SETUP_STATES.CONNECTED]: { statusKey: 'INTEGRATION_STATUS_CONNECTED', statusDefault: 'Connected', family: 'done' },
  [INTEGRATION_SETUP_STATES.FAILED]: { statusKey: 'INTEGRATION_STATUS_FAILED', statusDefault: 'Needs attention', family: 'cancel' }
}

export const linkSetupState = (link) => {
  if (link?.enabled === false) {
    return { state: 'off', statusKey: 'POS_MENU_STATUS_OFF', statusDefault: 'Turned off', family: 'cancel' }
  }
  const reported = normalizeIntegrationSetupStatus(link?.setup_status)
  // D1 (option C): a link with no reported status is connected (the links made before api-core#3587 never got one)
  const state = reported === INTEGRATION_SETUP_STATES.NOT_CONNECTED ? INTEGRATION_SETUP_STATES.CONNECTED : reported
  return { state, ...SETUP_STATES[state] }
}

export const posSummary = (business, integrations) => {
  const links = connectedPosLinks(business, integrations)
  if (!links.length) {
    return {
      state: 'none',
      statusKey: 'BUSINESS_POS_STATUS_NOT_CONNECTED',
      statusDefault: 'Not connected',
      family: null,
      pos: []
    }
  }

  const pos = links.map(({ link, integration }) => ({
    id: integration?.id ?? link.third_party_integration_id ?? null,
    name: integration?.name || 'POS',
    logo: integration?.logo ?? null
  }))

  // The state is the first POS's (a store has one POS; the API refuses a second). Its link and catalog entry go along (main #394:
  // the list reads the reason, the date, the warning and the fix action from them)
  const [{ link, integration }] = links
  return { ...linkSetupState(link), pos, link, integration }
}

// main, a plugin link that is already absolute (https://, http:// or //) is used as it is; only a relative one
// goes after the plugin root (main: BusinessIntegration.handleOpenPluginDetails)
export const pluginLinkUrl = (root, link) => (/^(?:https?:)?\/\//i.test(link) ? link : root + link)

// main, Calendly pages are for administrators (session level 0). Sales channels are exempt (main:
// `!fromSalesChannels`). The model never reads the session: the caller says `isAdmin` and `kind`.
const calendlyApplies = ({ isAdmin, kind } = {}) => !isAdmin && connectKind(kind).kind !== 'sales_channel'

// main (BusinessSummary.isCalendlyRestricted): the setup page of the plugin is a Calendly page, or there is no plugin (`!plugin_id`) and
// its plugin_root is. Restricted: the action reads a disabled «Contact admin».
export const isCalendlyRestricted = (integration, access) => (
  calendlyApplies(access) && (
    isCalendlyUrl(getPluginSetupPath(integration?.plugin), integration?.plugin?.root) ||
    (!integration?.plugin_id && isCalendlyUrl(integration?.plugin_root))
  )
)

// main (BusinessIntegration.isCalendlyRestricted): a button of a plugin link whose link is a Calendly page
export const isPluginLinkRestricted = (plugin, link, access) => (
  calendlyApplies(access) && isCalendlyUrl(link, plugin?.root)
)

const actionFor = (integration, connected, isBusinessOwner) => {
  if (!integration.plugin_id) {
    return isBusinessOwner
      ? { action: 'contact_admin', noteKey: 'CONTACT_ADMINISTRATOR', noteDefault: 'Contact administrator' }
      : { action: 'install', noteKey: 'POS_MENU_NOTE_NOT_INSTALLED', noteDefault: 'Not installed · installs for the whole project' }
  }
  if (!connected) {
    return { action: 'connect', noteKey: 'POS_MENU_NOTE_INSTALLED', noteDefault: 'Installed' }
  }
  // Connected without a setup path: no button, as main
  return { action: getPluginSetupPath(integration.plugin) ? 'setup' : null, noteKey: null, noteDefault: null }
}

// Same order as main (BusinessSummary:368-427): call providers first, then the
// API integrations and catalog stubs without the call ones.
// redesign SC-A: a kind without call providers (sales channels) lists the controller's integrations as they come, with no
// call options and no call filter (main, BusinessSummary:392, let them all through with fromSalesChannels).
export const catalogOptions = ({
  business,
  integrations,
  isBusinessOwner,
  installingPluginRoot,
  formLoading,
  businessLoading,
  // main, session user.level === 0. Not an administrator unless the caller says so.
  isAdmin = false,
  kind = 'pos',
  // main #399: the root of the plugin whose install «Check again» is reading (PosMenuBusinessList.handleCheckPluginInstall)
  checkingPluginRoot = null
} = {}) => {
  const access = { isAdmin, kind }
  const withCallProviders = connectKind(kind).callProviders !== false
  const callOptions = (withCallProviders ? POS_SETUP_CALL_PROVIDERS : []).map((provider) => ({
    key: `call:${provider.name.toLowerCase()}`,
    kind: 'call',
    integration: null,
    connected: false,
    link: null,
    action: 'book_call',
    href: POS_SETUP_CALL_URL,
    // main, the setup call is a Calendly page; it is a link for administrators and «Contact admin» for the rest
    restricted: calendlyApplies(access),
    name: provider.name,
    logoKey: provider.logoKey,
    disabled: calendlyApplies(access),
    busy: false,
    noteKey: 'POS_MENU_NOTE_SETUP_CALL',
    noteDefault: 'We set it up with you on a call'
  }))

  const links = asArray(business?.third_party_integrations)
  const anyLoading = !!(businessLoading || formLoading || installingPluginRoot || checkingPluginRoot)
  // main #394: one POS per store (the API refuses a second one): with a POS connected, another installed POS cannot be connected
  // (installing one is still for the whole project). Sales channels allow several.
  const currentPos = connectKind(kind).kind === 'pos' ? connectedPosLinks(business, integrations)[0] || null : null
  const isSalesChannel = connectKind(kind).kind === 'sales_channel'

  const integrationOptions = asArray(integrations)
    .filter((integration) => integration && (!withCallProviders || !isSetupCallIntegration(integration)))
    .map((integration) => {
      const link = links.find((item) => item?.third_party_integration_id === integration.id) || null
      const connected = !!link
      if (isSalesChannel && !connected && isContactUsSalesChannel(integration)) {
        return {
          key: `integration:${integration.id}`,
          kind: 'integration',
          integration,
          connected,
          link,
          action: 'contact_us',
          href: SALES_CHANNEL_CONTACT_URL,
          restricted: false,
          disabled: false,
          busy: false,
          noteKey: 'SALES_CHANNELS_NOTE_CONTACT_US',
          noteDefault: 'We check availability and set it up with you',
          installState: null,
          installMessage: null,
          checking: false
        }
      }
      const { action, noteKey, noteDefault } = actionFor(integration, connected, isBusinessOwner)
      // main, an action on a Calendly setup is «Contact admin», disabled, for anyone but an administrator; a
      // connected integration with no setup button (action null) keeps none
      const restricted = action !== null && isCalendlyRestricted(integration, access)
      const busy = !!installingPluginRoot && installingPluginRoot === integration.plugin_root
      const option = {
        key: `integration:${integration.id}`,
        kind: 'integration',
        integration,
        connected,
        link,
        action,
        restricted,
        disabled: restricted || (action === 'contact_admin' ? false : anyLoading),
        busy,
        noteKey,
        noteDefault,
        installState: null,
        installMessage: null,
        checking: false
      }
      if (connected || restricted || action === 'contact_admin') return option
      // main #399: a plugin still finishing its install offers «Check again»; one whose install failed keeps Connect off and says why
      const install = busy ? null : getPluginInstallState(integration)
      if (install?.state === 'installing') {
        return {
          ...option,
          action: 'check_again',
          installState: 'installing',
          checking: !!checkingPluginRoot && checkingPluginRoot === integration.plugin_root,
          noteKey: 'INTEGRATION_PLUGIN_INSTALLING_NOTE',
          noteDefault: 'Still finishing its install. It can take a few minutes.'
        }
      }
      if (install?.state === 'failed') {
        return {
          ...option,
          action: 'connect',
          disabled: true,
          installState: 'failed',
          installMessage: install.message,
          noteKey: 'INTEGRATION_PLUGIN_INSTALL_FAILED_HELP',
          noteDefault: 'Uninstall it from Plugins and install it again, or contact support.'
        }
      }
      if (action !== 'connect') return option
      // main #394: a plugin that is disabled cannot serve a connection; and a store keeps one POS
      if (integration.plugin && !isIntegrationPluginAvailable(integration)) {
        return { ...option, disabled: true, noteKey: 'INTEGRATION_PLUGIN_DISABLED_NOTE', noteDefault: 'Plugin disabled' }
      }
      return currentPos ? { ...option, disabled: true, blockedByPos: true } : option
    })

  return [...callOptions, ...integrationOptions]
}

// main a sync or a push is a task the POS runs; the toast says it started, not that it is done
const SYNC_COPY = {
  sync_menu: {
    buttonKey: 'SYNC_MENU',
    buttonDefault: 'Sync menu',
    titleKey: 'POS_MENU_SYNC_MENU_TITLE',
    titleDefault: "Sync _store_'s menu with _pos_?",
    bodyKey: 'POS_MENU_SYNC_MENU_BODY',
    bodyDefault: "Ordering asks _pos_ to sync this store's menu now. The menu your customers see can change.",
    confirmKey: 'POS_MENU_SYNC_MENU_CONFIRM',
    confirmDefault: 'Sync menu with _pos_',
    doneKey: 'MENU_SYNC_STARTED',
    doneDefault: 'Menu sync started. It can take a few minutes.'
  },
  sync_business: {
    buttonKey: 'SYNC_BUSINESS',
    buttonDefault: 'Sync business',
    titleKey: 'POS_MENU_SYNC_BUSINESS_TITLE',
    titleDefault: "Sync _store_'s details with _pos_?",
    bodyKey: 'POS_MENU_SYNC_BUSINESS_BODY',
    bodyDefault: "Ordering asks _pos_ to sync this store's details now. The details your customers see can change.",
    confirmKey: 'POS_MENU_SYNC_BUSINESS_CONFIRM',
    confirmDefault: 'Sync details with _pos_',
    doneKey: 'BUSINESS_SYNC_STARTED',
    doneDefault: 'Business sync started. It can take a few minutes.'
  },
  // redesign SC-A: own keys, the existing PUSH_MENU is mistranslated in the catalog («menú push», «Menù a pressione»)
  push_menu: {
    buttonKey: 'SALES_CHANNELS_PUSH_MENU',
    buttonDefault: 'Push menu',
    titleKey: 'SALES_CHANNELS_PUSH_MENU_TITLE',
    titleDefault: "Push _store_'s menu to _pos_?",
    bodyKey: 'SALES_CHANNELS_PUSH_MENU_BODY',
    bodyDefault: "Ordering sends this store's menu to _pos_. The menu customers see on _pos_ can change.",
    confirmKey: 'SALES_CHANNELS_PUSH_MENU_CONFIRM',
    confirmDefault: 'Push menu to _pos_',
    doneKey: 'MENU_PUSH_STARTED',
    doneDefault: 'Menu push started. It can take a few minutes.'
  }
}

export const syncCopy = (action) => (
  Object.prototype.hasOwnProperty.call(SYNC_COPY, action) ? { ...SYNC_COPY[action] } : null
)

// redesign D-8 (owner, 2026-10-19): Disconnect asks first (C8, decision 25); main disconnected at once. The same texts serve a
// POS and a sales channel: `_pos_` is the name of the integration, as in syncCopy.
const DISCONNECT_COPY = {
  titleKey: 'POS_MENU_DISCONNECT_TITLE',
  titleDefault: 'Disconnect _store_ from _pos_?',
  bodyKey: 'POS_MENU_DISCONNECT_BODY',
  bodyDefault: '_store_ stops syncing with _pos_. To connect it again you will need its credentials.',
  confirmKey: 'POS_MENU_DISCONNECT_CONFIRM',
  confirmDefault: 'Disconnect _pos_'
}

export const disconnectCopy = () => ({ ...DISCONNECT_COPY })

// One pass with a replacer function: "$&" in a name stays literal and a name
// that contains "_pos_" is not substituted again.
export const fillName = (template, { store, pos } = {}) => (
  typeof template === 'string'
    ? template.replace(/_store_|_pos_/g, (token) => String((token === '_store_' ? store : pos) ?? ''))
    : ''
)
