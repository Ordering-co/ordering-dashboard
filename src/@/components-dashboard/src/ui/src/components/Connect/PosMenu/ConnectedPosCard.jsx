import React, { useEffect, useId, useState } from 'react'
import { useTheme } from 'styled-components'

import { useLanguage, useUtils } from '../../../../../index'
import {
  INTEGRATION_SETUP_STATES,
  getIntegrationPluginLinkKeys,
  getIntegrationSetupAction,
  getIntegrationSetupStatus,
  getIntegrationSetupWarning,
  isIntegrationPluginAvailable
} from '../../../../../utils/integrationSetupStatus'
import { getPluginInstallState } from '../../../../../utils/pluginInstall'
import { useShowPluginPage } from '../../../hooks/usePluginPage'
import { capitalize } from '../../../utils/capitalize'
import { Ellipsis } from '../../Shared/Icon'
import { AsyncSwitch, Button, ConfirmDialog, Dialog, Menu, StatusBadge, TextField } from '../../Shared/Product'
import { IntegrationLogs } from '../../Shared'
import { connectKind } from './connectKinds'
import { PluginFrameDialog } from './PluginFrameDialog'
import { SetupWarning } from './SetupWarning'
import { disconnectCopy, fillName, isPluginLinkRestricted, linkSetupState, syncCopy } from './posMenuModel'
import './pos-store-panel.css'

// redesign bugs-d row 84: the label of a plugin link is built from its API key, which no catalog can list. The known keys are literal
// t() calls (the key scanner and i18n:generate see them); any other key keeps the dynamic label below.
const KNOWN_LINK_LABELS = {
  general_settings: t => t('PLUGIN_LINK_GENERAL_SETTINGS', 'General settings')
}

/**
 * A POS the store is connected to (redesign G1, decision 3): everything the second panel of main (BusinessIntegration) had, in a card
 * under «Connected POS»: its status, the on/off switch, Sync menu and Sync business (each asks first, H1), Setup, a button per link of
 * the plugin, Logs, ⋯ Disconnect (asks first, C8) and the external id as text. One card per connected POS (C22).
 *
 * `link` is the business's link to the integration (`business.third_party_integrations[n]`); `integration` is the catalog entry the
 * model resolved (or the one nested in the link, or null: the card still paints with what the link has). Every handler is the
 * controller's: `handleConnectBusiness`, `handleDisconnectBusiness` and `handlePushAction`; `handleUpdateBusinessState` is how the
 * controller takes the new link (and tells the list). A call that throws goes to `onRequestError` (PM-15).
 *
 * main #394 and #400, the integration detail of main in this card:
 *  - the state of the link with the date it was reported and its reason (setup_message, or main's help for the state), and a warning
 *    when the plugin is uninstalled, disabled or not done installing;
 *  - one setup action, main's rule (getIntegrationSetupAction): Reconnect (failed), Continue setup (pending) or Setup (connected),
 *    only while the plugin can serve it and has a setup page;
 *  - Sync menu and Sync business only for a connected integration whose plugin is available and has that hook, with a note saying
 *    why when they are off (Push menu of a sales channel is as it was);
 *  - the plugin's own pages, none while the plugin is unavailable and never its reserved links (launch, connection_status, setup);
 *  - every page opens through useShowPluginPage (links.launch gives a one-time URL; no session token in it) in PluginFrameDialog,
 *    which reads the store again when it closes;
 *  - a POS reads «POS location ID».
 *
 * redesign SC-A: `kind` ('pos' by default, or 'sales_channel', see connectKinds) decides the actions and the external id.
 * A sales channel has Push menu as its one action and an external id the user edits and saves here; a POS is as it always was.
 */
export const ConnectedPosCard = ({
  business,
  link,
  integration,
  formState,
  setFormState,
  handleConnectBusiness,
  handleDisconnectBusiness,
  handlePushAction,
  handleUpdateBusinessState,
  getIntegrations,
  updateBusiness,
  titleRef,
  onRequestError,
  // main, session user.level === 0, from the panel. Calendly links and setup are for administrators only.
  isAdmin = false,
  kind = 'pos'
}) => {
  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const theme = useTheme()
  const titleId = useId()
  const { actions, externalIdEditable } = connectKind(kind)
  // What is open stays set while its dialog fades out
  const [syncDialog, setSyncDialog] = useState({ open: false, action: actions[0] })
  const [syncing, setSyncing] = useState(false)
  // redesign D-8 (owner, 2026-10-19): ⋯ Disconnect opens a confirmation instead of disconnecting at once (main did)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [frame, setFrame] = useState({ open: false, title: '', url: null })
  const showPluginPage = useShowPluginPage(setFrame)
  const [logsOpen, setLogsOpen] = useState(false)

  const plugin = integration?.plugin || null
  const integrationId = integration?.id ?? link.third_party_integration_id
  // redesign SC-R1: a channel with no name reads «Sales channel», not «POS»
  const unnamed = kind === 'sales_channel' ? t('SALES_CHANNELS_UNNAMED', 'Sales channel') : 'POS'
  const name = integration?.name ? t(integration.name.toUpperCase(), integration.name) : unnamed
  const externalId = link.external_id || ''
  const busy = !!formState?.loading
  // redesign SC-02: the draft of the editable external id; it starts again when the saved one changes
  const [draft, setDraft] = useState(externalId)
  useEffect(() => { setDraft(externalId) }, [externalId])

  // (main #390/#394, owner decision D1 = C): main's state and words, «Turned off» first (posMenuModel.linkSetupState)
  const setupState = linkSetupState(link)
  const status = { family: setupState.family, label: t(setupState.statusKey, setupState.statusDefault) }
  // main #394: the reason under the state, the date it was reported and the warning of a plugin that cannot serve the integration
  const setupStatus = getIntegrationSetupStatus(link, t)
  const needsSetup = setupStatus.state !== INTEGRATION_SETUP_STATES.CONNECTED
  // Review r1: the state of the plugin is only known from a catalog entry that carries it. Main never paints a link
  // without one; the redesign does (a POS resolved from its link when the catalog failed or has not arrived, PM-15; a setup-call
  // provider connected through the API, PM-18): then nothing warns and nothing is turned off because of the plugin.
  const pluginKnown = !!integration?.plugin
  const setupWarning = pluginKnown ? getIntegrationSetupWarning(link, integration, t) : null
  // main #399: the reason the API gave for an install that failed
  const installFailure = pluginKnown && getPluginInstallState(integration)?.state === 'failed' ? getPluginInstallState(integration).message : null
  const statusDate = link.setup_status_updated_at ? parseDate(link.setup_status_updated_at) : null
  const statusReason = setupWarning
    ? needsSetup
      ? t('INTEGRATION_STATUS_PLUGIN_DISABLED_SETUP_HELP', 'The plugin of this integration is disabled. Enable it to finish or resume the connection.')
      : t('INTEGRATION_STATUS_PLUGIN_DISABLED_HELP', 'The plugin of this integration is disabled, so syncing is paused.')
    : setupStatus.message || (
      setupStatus.state === INTEGRATION_SETUP_STATES.CONNECTED
        // main: a connected sales channel is not called a POS
        ? kind === 'sales_channel'
          ? t('INTEGRATION_STATUS_SALES_CHANNEL_CONNECTED_HELP', 'The sales channel is connected and syncing with this store.')
          : t('INTEGRATION_STATUS_CONNECTED_HELP', 'The POS is connected and syncing with this store.')
        : setupStatus.state === INTEGRATION_SETUP_STATES.FAILED
          ? t('INTEGRATION_STATUS_FAILED_HELP', 'The connection stopped working. Reconnect to resume orders and menu sync.')
          : t('INTEGRATION_STATUS_PENDING_HELP', 'The connection was started but not finished.')
    )
  // main #394: a sync runs the plugin's hook; it needs the integration connected, its plugin available and, when its hooks are loaded,
  // a hook for that action
  const pluginAvailable = pluginKnown ? isIntegrationPluginAvailable(integration) : true
  const pluginSupports = (hook) => !Array.isArray(plugin?.hooks) || plugin.hooks.some(item => item?.hook === hook)
  // main: Push menu follows the same rules as the POS syncs (not while the connection is pending or the plugin is off)
  const syncOff = (action) => needsSetup || !pluginAvailable || !pluginSupports(action)
  const unsupported = actions.filter(action => !needsSetup && pluginAvailable && !pluginSupports(action))

  // The store with this link changed, as BusinessIntegration:81-89 builds it
  const withLink = (changes) => ({
    ...business,
    third_party_integrations: (business?.third_party_integrations || []).map(item => (
      item?.third_party_integration_id === link.third_party_integration_id ? { ...item, ...changes } : item
    ))
  })

  // The switch sends the SAVED external id (link.external_id), never the draft of the field: main sent the draft (BusinessIntegration:74-91)
  const toggle = async (next) => {
    try {
      await handleConnectBusiness(
        integrationId,
        { external_id: externalId, enabled: next },
        () => handleUpdateBusinessState?.(withLink({ external_id: externalId, enabled: next })),
        t('INTEGRATION_UPDATED', 'Integration updated successfully')
      )
    } catch (error) {
      onRequestError?.(error)
    }
  }

  // redesign SC-02: the external id of a sales channel is edited here, in the card (it lived in a second panel on main);
  // same call and arguments as BusinessIntegration:74-91
  const saveExternalId = async (event) => {
    event.preventDefault()
    try {
      await handleConnectBusiness(
        integrationId,
        { external_id: draft, enabled: link.enabled },
        () => handleUpdateBusinessState?.(withLink({ external_id: draft, enabled: link.enabled })),
        t('INTEGRATION_UPDATED', 'Integration updated successfully')
      )
    } catch (error) {
      onRequestError?.(error)
    }
  }

  const disconnect = async () => {
    setDisconnecting(true)
    try {
      await handleDisconnectBusiness(integrationId, () => {
        getIntegrations?.()
        updateBusiness?.()
      })
    } catch (error) {
      onRequestError?.(error)
    } finally {
      setDisconnecting(false)
      setDisconnectOpen(false)
    }
  }

  const runSync = async (action) => {
    const copy = syncCopy(action)
    setSyncing(true)
    setFormState({ ...formState, loading: true })
    try {
      await handlePushAction(integrationId, action, t(copy.doneKey, copy.doneDefault))
    } finally {
      // redesign PM-12: main put back the formState it had read before the sync; this one only clears the flag
      setFormState(previous => ({ ...previous, loading: false }))
      setSyncing(false)
      setSyncDialog(previous => ({ ...previous, open: false }))
    }
  }

  // main #394: one setup action for the list, the panel and this card; main #400: it opens through links.launch when the plugin has it
  const setupAction = getIntegrationSetupAction(link, integration, t)
  const openPage = (page) => showPluginPage(plugin, page, { businessId: business?.id ?? null }).catch(onRequestError)
  // The plugin page reports its result to the API, not to this page: the store and its integrations are read again
  const reloadStore = () => {
    updateBusiness?.()
    getIntegrations?.()
  }

  // redesign PM-14: each link opens its own route (main opened general_settings for all of them); main #394: none while the
  // plugin is unavailable, never the setup page nor the reserved keys
  const linkKeys = getIntegrationPluginLinkKeys(integration)
  // main, for someone who is not an administrator a Calendly link (and a Calendly setup) is a disabled «Contact admin»
  // (sales channels are exempt, the model decides)
  const access = { isAdmin, kind }
  const linkRestricted = (key) => isPluginLinkRestricted(plugin, plugin?.links?.[key], access)
  const setupRestricted = !!setupAction && isPluginLinkRestricted(plugin, setupAction.path, access)

  // main #399: a logo that does not load shows the default logo, once; then nothing (PM-07)
  const logoFailed = (event) => {
    const image = event.currentTarget
    const fallback = theme?.images?.dummies?.businessLogo
    if (fallback && !image.dataset.fallback) {
      image.dataset.fallback = 'true'
      image.src = fallback
      return
    }
    image.hidden = true
  }

  const copy = syncCopy(syncDialog.action)
  const leaveCopy = disconnectCopy()

  return (
    <article className='psp-card' aria-labelledby={titleId}>
      <header className='psp-card-head'>
        {/* redesign PM-07: a logo that does not load leaves no broken icon; main #399: the default logo first */}
        {integration?.logo && <img className='psp-logo' src={integration.logo} alt='' onError={logoFailed} />}
        <h4 id={titleId} ref={titleRef} tabIndex={-1} className='psp-card-name'>{name}</h4>
        <StatusBadge family={status.family} label={status.label} />
        <SetupWarning warning={setupWarning} />
        <AsyncSwitch
          className='psp-card-switch'
          checked={link.enabled !== false}
          disabled={busy}
          // redesign PM-R1: no fixed «On» beside a switch that can be off; the badge says the state
          label={fillName(t('POS_MENU_INTEGRATION_SWITCH', 'Turn _pos_ on or off'), { pos: name })}
          failureText={t('STORES_CHANGE_FAILED', "We couldn't save the change.")}
          onToggle={toggle}
        />
      </header>

      {/* main #394: when the state was reported and why (the plugin's message, or what the state means) */}
      <p className='psp-card-status'>
        {statusDate && <><span className='psp-card-status-date'>{statusDate}</span>{' · '}</>}
        <span dir='auto'>{statusReason}</span>
      </p>
      {installFailure && <p className='psp-card-status psp-note-danger' dir='auto'>{installFailure}</p>}

      <div className='psp-card-actions'>
        {/* The first action of the kind is the primary one (C8): Sync menu for a POS, Push menu for a sales channel */}
        {actions.map((action, index) => {
          const actionCopy = syncCopy(action)
          return (
            <Button
              key={action}
              variant={index === 0 ? 'primary' : 'secondary'}
              disabled={busy || syncOff(action)}
              onClick={() => setSyncDialog({ open: true, action })}
            >
              {t(actionCopy.buttonKey, actionCopy.buttonDefault)}
            </Button>
          )
        })}
        {/* main, Calendly setup is «Contact admin», disabled, for anyone but an administrator */}
        {setupAction && (setupRestricted
          ? (
            <Button disabled aria-label={`${t('CONTACT_ADMIN', 'Contact admin')} · ${setupAction.label}`}>{t('CONTACT_ADMIN', 'Contact admin')}</Button>
            )
          : <Button disabled={busy} onClick={() => openPage('setup')}>{setupAction.label}</Button>)}
        {linkKeys.map(key => (linkRestricted(key)
          ? (
            <Button key={key} disabled>{t('CONTACT_ADMIN', 'Contact admin')}</Button>
            )
          : (
            <Button key={key} disabled={busy} onClick={() => openPage(key)}>
              {Object.hasOwn(KNOWN_LINK_LABELS, key) ? KNOWN_LINK_LABELS[key](t) : t(key.replace(/ /g, '_'), capitalize(key.replace(/_/g, ' ')))}
            </Button>
            )
        ))}
        {/* Always, as BusinessIntegration:205-212 (the logs filter by the store and, when there is one, the plugin) */}
        <Button disabled={busy} onClick={() => setLogsOpen(true)}>{t('LOGS', 'Logs')}</Button>
        <Menu
          label={fillName(t('POS_MENU_MORE_FOR', 'More for _pos_'), { pos: name })}
          icon={Ellipsis}
          triggerProps={{ disabled: busy }}
          items={[{
            key: 'disconnect',
            label: t('DISCONNECT', 'Disconnect'),
            tone: 'danger',
            disabled: busy,
            onSelect: () => setDisconnectOpen(true)
          }]}
        />
      </div>

      {/* main #394: why Sync menu and Sync business are off; main: and Push menu */}
      {(needsSetup || !pluginAvailable || unsupported.length > 0) && (
        <p className='psp-card-status'>
          {needsSetup
            ? kind === 'sales_channel'
              ? t('SYNC_DISABLED_UNTIL_SALES_CHANNEL_CONNECTED', 'Available once the sales channel is connected.')
              : t('SYNC_DISABLED_UNTIL_CONNECTED', 'Available once the POS is connected.')
            : !pluginAvailable
                ? t('SYNC_PLUGIN_UNAVAILABLE', 'The plugin of this integration is disabled or uninstalled.')
                : unsupported.map(action => `${t(syncCopy(action).buttonKey, syncCopy(action).buttonDefault)}: ${t('SYNC_NOT_SUPPORTED', 'This integration does not support it.')}`).join(' ')}
        </p>
      )}

      {externalIdEditable
        ? (
          <form className='psp-card-form' onSubmit={saveExternalId}>
            <TextField
              fieldClassName='psp-card-form-field'
              label={t('EXTERNAL_ID', 'External ID')}
              value={draft}
              onChange={setDraft}
              autoComplete='off'
            />
            {/* main: Save only once the external id changed */}
            <Button type='submit' disabled={busy || draft === externalId}>{t('SAVE', 'Save')}</Button>
          </form>
          )
        : (
          <dl className='psp-card-data'>
            <div>
              {/* main #394: a POS names it as its location */}
              <dt>{kind === 'pos' ? t('POS_LOCATION_ID', 'POS location ID') : t('EXTERNAL_ID', 'External ID')}</dt>
              <dd><bdi>{externalId || '—'}</bdi></dd>
            </div>
          </dl>
          )}

      <ConfirmDialog
        open={syncDialog.open}
        tone='primary'
        title={fillName(t(copy.titleKey, copy.titleDefault), { store: business?.name, pos: name })}
        confirmLabel={fillName(t(copy.confirmKey, copy.confirmDefault), { store: business?.name, pos: name })}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={syncing}
        onConfirm={() => runSync(syncDialog.action)}
        onCancel={() => setSyncDialog(previous => ({ ...previous, open: false }))}
      >
        <span className='psp-confirm-line'>{fillName(t(copy.bodyKey, copy.bodyDefault), { store: business?.name, pos: name })}</span>
        {/* main #394: what each sync brings from the POS */}
        {syncDialog.action === 'sync_business' && <span className='psp-confirm-line'>{t('SYNC_BUSINESS_HINT', 'Name, address, schedule and settings from the POS.')}</span>}
        {syncDialog.action === 'sync_menu' && <span className='psp-confirm-line'>{t('SYNC_MENU_HINT', 'Products, options and prices from the POS.')}</span>}
      </ConfirmDialog>

      <ConfirmDialog
        open={disconnectOpen}
        tone='danger'
        title={fillName(t(leaveCopy.titleKey, leaveCopy.titleDefault), { store: business?.name, pos: name })}
        confirmLabel={fillName(t(leaveCopy.confirmKey, leaveCopy.confirmDefault), { store: business?.name, pos: name })}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={disconnecting}
        onConfirm={disconnect}
        onCancel={() => setDisconnectOpen(false)}
      >
        {fillName(t(leaveCopy.bodyKey, leaveCopy.bodyDefault), { store: business?.name, pos: name })}
      </ConfirmDialog>

      <PluginFrameDialog
        frame={frame}
        businessId={business?.id}
        onClose={() => setFrame(previous => ({ ...previous, open: false }))}
        onReload={reloadStore}
      />

      <Dialog
        open={logsOpen}
        onOpenChange={setLogsOpen}
        size='lg'
        title={t('LOGS', 'Logs')}
        closeLabel={t('CLOSE', 'Close')}
      >
        <IntegrationLogs model='Business' modelId={business?.id} pluginId={integration?.plugin_id} />
      </Dialog>
    </article>
  )
}
