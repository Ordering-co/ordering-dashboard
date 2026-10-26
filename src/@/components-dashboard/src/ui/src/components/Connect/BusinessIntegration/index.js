import React, { useEffect, useRef, useState } from 'react'
import { usePluginMessages } from '../../../hooks/usePluginMessages'
import { pluginModalSize } from '../../../../../utils/pluginMessages'
import { PluginPageFrame } from '../PluginPageFrame'
import { useShowPluginPage } from '../../../hooks/usePluginPage'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import { ThreeDots } from 'react-bootstrap-icons'
import { useTheme } from 'styled-components'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { useLanguage, useUtils } from '../../../../../index'
import { Button, Input, Switch } from '../../../styles'
import { Confirm, Modal, IntegrationLogs } from '../../Shared'
import { MORE_SIDEBAR_MODAL_MAX_WIDTH } from '../../Shared/MoreSidebarLayout/constants'
import { useSession } from '../../../../../index'
import { capitalize, isSalesCallRestricted } from '../../../utils'
import {
  getIntegrationSetupStatus,
  getIntegrationSetupWarning,
  getIntegrationSetupAction,
  getIntegrationPluginLinkKeys,
  isIntegrationPluginAvailable,
  INTEGRATION_SETUP_STATES
} from '../../../../../utils/integrationSetupStatus'
import { IntegrationStatusBadge } from '../IntegrationStatusBadge'
import { WrapperImage, PosImage, StatusCell } from '../shared/styles'

import {
  BusinessOrderingChannelsContainer,
  Title,
  FormControl,
  Label,
  IntegrationContainer,
  IntegrationActions,
  TitleWrapper,
  ActionSelectorWrapper,
  StatusCard,
  SyncActions,
  MoreActions
} from './styles'

export const BusinessIntegration = (props) => {
  const {
    onClose,
    business,
    handleConnectBusiness,
    handleDisconnectBusiness,
    getIntegrations,
    updateBusiness,
    selectedIntegration,
    handleSucessUpdateBusiness,
    handlePushAction: propHandlePushAction,
    fromSalesChannels,
    formState,
    setFormState,
    integrationActionLoading
  } = props

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const theme = useTheme()
  // Same breakpoint as MoreSidebarLayout, which opens the detail in a Modal below it.
  const { width } = useWindowSize()
  const inModal = width <= MORE_SIDEBAR_MODAL_MAX_WIDTH
  const [{ user }] = useSession()
  const isCalendlyRestricted = (plugin, link) => isSalesCallRestricted(user, link, plugin?.root, fromSalesChannels)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [externalId, setExternalId] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [openIntegrationLogs, setOpenIntegrationLogs] = useState(false)
  const [pluginSelected, setPluginSelected] = useState({
    open: false,
    url: null
  })
  // The plugin page reports its result to the API, not to this page, so
  // read the store again when it closes: its state shows without a reload.
  const reloadStore = () => {
    updateBusiness && updateBusiness()
    getIntegrations && getIntegrations()
  }
  const handleClosePluginModal = () => {
    setPluginSelected(prev => ({ ...prev, open: false }))
    reloadStore()
  }
  // The plugin page can also say it finished, or ask to close
  // (docs/PLUGIN_PAGES.md).
  const pluginFrameRef = useRef(null)
  const pluginFrame = usePluginMessages({
    open: pluginSelected.open,
    iframeRef: pluginFrameRef,
    url: pluginSelected.url,
    businessId: business?.id ?? null,
    name: pluginSelected.title,
    closeModal: handleClosePluginModal,
    reload: reloadStore,
    fits: Boolean(pluginSelected.fits),
    frameKey: pluginSelected.frameKey ?? null
  })
  const pluginModal = pluginModalSize({ fits: Boolean(pluginSelected.fits), ...pluginFrame })

  const showPluginPage = useShowPluginPage(setPluginSelected)

  const businessIntegration = business?.third_party_integrations?.find(
    item => item?.third_party_integration_id === selectedIntegration?.id
  )
  const setupStatus = getIntegrationSetupStatus(businessIntegration, t)
  const needsSetup = setupStatus.state !== INTEGRATION_SETUP_STATES.CONNECTED
  const setupWarning = getIntegrationSetupWarning(businessIntegration, selectedIntegration, t)
  const statusUpdatedAt = businessIntegration?.setup_status_updated_at
    ? parseDate(businessIntegration.setup_status_updated_at)
    : null
  // Same rule as the business panel (getIntegrationSetupAction): the card
  // offers Reconnect, Continue setup or Setup. A setup that is a sales call
  // only opens for admins.
  const setupAction = getIntegrationSetupAction(businessIntegration, selectedIntegration, t)
  const setupRestricted = !!setupAction && isCalendlyRestricted(selectedIntegration?.plugin, setupAction.path)
  // The plugin's own pages (none while it is unavailable); Logs stays, it reads
  // the API's own logs.
  const plugin = selectedIntegration?.plugin
  const pluginAvailable = isIntegrationPluginAvailable(selectedIntegration)
  const pluginLinkKeys = getIntegrationPluginLinkKeys(selectedIntegration)

  // A sync runs the plugin's hook: it needs the plugin enabled and, when its
  // hooks are loaded, a hook for that action.
  const pluginSupports = (hook) => !Array.isArray(plugin?.hooks) || plugin.hooks.some(item => item?.hook === hook)
  const syncActions = [
    {
      hook: 'sync_business',
      name: t('SYNC_BUSINESS', 'Sync business'),
      hint: t('SYNC_BUSINESS_HINT', 'Name, address, schedule and settings from the POS.'),
      startedMessage: t('BUSINESS_SYNC_STARTED', 'Business sync started. It can take a few minutes.'),
      supported: pluginSupports('sync_business')
    },
    {
      hook: 'sync_menu',
      name: t('SYNC_MENU', 'Sync menu'),
      hint: t('SYNC_MENU_HINT', 'Products, options and prices from the POS.'),
      startedMessage: t('MENU_SYNC_STARTED', 'Menu sync started. It can take a few minutes.'),
      supported: pluginSupports('sync_menu')
    }
  ]

  const handleOpenSetup = async () => {
    await showPluginPage(plugin, 'setup', { businessId: business?.id ?? null })
  }

  const handleSaveIntegration = (paramEnabled) => {
    if (!selectedIntegration) return

    return handleConnectBusiness(selectedIntegration.id, {
      external_id: externalId,
      enabled: paramEnabled ?? enabled
    }, () => {
      const updatedBusiness = {
        ...business,
        third_party_integrations: business.third_party_integrations.map(integration =>
          integration.third_party_integration_id === selectedIntegration.id
            ? { ...integration, external_id: externalId, enabled: paramEnabled ?? enabled }
            : integration
        )
      }
      handleSucessUpdateBusiness && handleSucessUpdateBusiness(updatedBusiness)
    }, t('INTEGRATION_UPDATED', 'Integration updated successfully'))
  }

  const handleDisconnectIntegration = () => {
    handleDisconnectBusiness(selectedIntegration?.id, () => {
      getIntegrations && getIntegrations()
      updateBusiness && updateBusiness()
      onClose()
    })
  }

  const handleOpenPluginDetails = async (e, plugin, linkKey = 'general_settings') => {
    const link = plugin?.links?.[linkKey]
    if (!link || isCalendlyRestricted(plugin, link)) return
    e.stopPropagation()
    await showPluginPage(plugin, linkKey, { businessId: business?.id ?? null })
  }

  const handlePushAction = async (integrationId, action = 'push_menu', message) => {
    try {
      setFormState({ ...formState, loading: true })
      await propHandlePushAction(integrationId, action, message)
    } finally {
      setFormState({ ...formState, loading: false })
    }
  }

  useEffect(() => {
    if (business && selectedIntegration) {
      const existingIntegration = business?.third_party_integrations?.find(
        item => item?.third_party_integration_id === selectedIntegration?.id
      )
      if (existingIntegration) {
        setExternalId(existingIntegration.external_id || '')
        setEnabled(existingIntegration.enabled)
      } else if (!externalId && !enabled) {
        setExternalId('')
        setEnabled(false)
      }
    }
  }, [business, selectedIntegration])

  return (
    <>
      <BusinessOrderingChannelsContainer inModal={inModal}>
        <TitleWrapper inModal={inModal}>
          <div className='title-wrapper'>
            <Title>{selectedIntegration?.name || 'Integration'}</Title>
            <Switch
              defaultChecked={enabled}
              checked={enabled}
              disabled={formState?.loading || integrationActionLoading}
              onChange={async (value) => {
                setEnabled(value)
                const saved = await handleSaveIntegration(value)
                if (!saved) setEnabled(!value)
              }}
            />
          </div>
          <ActionSelectorWrapper>
            <DropdownButton
              menuAlign={theme?.rtl ? 'left' : 'right'}
              title={<ThreeDots />}
              id={theme?.rtl ? 'dropdown-menu-align-left' : 'dropdown-menu-align-right'}
              disabled={formState?.loading || integrationActionLoading}
            >
              <Dropdown.Item
                onClick={() => setConfirmDisconnect(true)}
                disabled={formState?.loading || integrationActionLoading}
              >
                {t('DISCONNECT', 'Disconnect')}
              </Dropdown.Item>
            </DropdownButton>
          </ActionSelectorWrapper>
        </TitleWrapper>
        {fromSalesChannels && (
          <div className='integration-actions'>
            <Button
              color='lightPrimary'
              borderRadius='8px'
              disabled={formState?.loading}
              onClick={() => handlePushAction(selectedIntegration?.id, 'push_menu', t('MENU_PUSH_STARTED', 'Menu push started. It can take a few minutes.'))}
            >
              {t('PUSH_MENU', 'Push menu')}
            </Button>
          </div>
        )}

        <StatusCard tone={setupStatus.tone}>
          {/* Same layout as the integration's row in the business panel. */}
          <div className='status-row'>
            <WrapperImage>
              <PosImage bgimage={selectedIntegration?.logo || theme.images?.dummies?.businessLogo} />
            </WrapperImage>
            <StatusCell>
              <p className='integration-name'>{selectedIntegration?.name}</p>
              <IntegrationStatusBadge row={businessIntegration} integration={selectedIntegration} />
              {statusUpdatedAt && <p className='status-detail'>{statusUpdatedAt}</p>}
            </StatusCell>
            {setupAction && (
              <Button
                color='lightPrimary'
                borderRadius='8px'
                disabled={formState?.loading || setupRestricted}
                onClick={setupRestricted ? undefined : handleOpenSetup}
              >
                {setupRestricted ? t('CONTACT_ADMIN', 'Contact admin') : setupAction.label}
              </Button>
            )}
          </div>
          <p className='status-message'>
            {setupWarning
              ? needsSetup
                ? t('INTEGRATION_STATUS_PLUGIN_DISABLED_SETUP_HELP', 'The plugin of this integration is disabled. Enable it to finish or resume the connection.')
                : t('INTEGRATION_STATUS_PLUGIN_DISABLED_HELP', 'The plugin of this integration is disabled, so syncing is paused.')
              : setupStatus.message || (
                setupStatus.state === INTEGRATION_SETUP_STATES.CONNECTED
                  ? t('INTEGRATION_STATUS_CONNECTED_HELP', 'The POS is connected and syncing with this store.')
                  : setupStatus.state === INTEGRATION_SETUP_STATES.FAILED
                    ? t('INTEGRATION_STATUS_FAILED_HELP', 'The connection stopped working. Reconnect to resume orders and menu sync.')
                    : t('INTEGRATION_STATUS_PENDING_HELP', 'The connection was started but not finished.')
              )}
          </p>
        </StatusCard>
        <IntegrationContainer>
          <IntegrationActions noMargin>
            <FormControl>
              <Label>{fromSalesChannels ? t('EXTERNAL_ID', 'External ID') : t('POS_LOCATION_ID', 'POS location ID')}</Label>
              <Input
                disabled={!fromSalesChannels}
                type='text'
                value={externalId}
                placeholder={fromSalesChannels ? t('EXTERNAL_ID', 'External ID') : t('POS_LOCATION_ID', 'POS location ID')}
                onChange={(e) => setExternalId(e.target.value)}
              />
            </FormControl>
            {fromSalesChannels && (
              <Button color='primary' onClick={() => handleSaveIntegration()}>
                {t('SAVE', 'Save')}
              </Button>
            )}
          </IntegrationActions>
        </IntegrationContainer>
        {!fromSalesChannels && (
          <>
            <IntegrationContainer>
              <SyncActions>
                <p className='title'>{t('SYNCHRONIZE', 'Synchronize')}</p>
                {syncActions.map(action => (
                  <div className='sync-action' key={action.hook}>
                    <div>
                      <p className='name'>{action.name}</p>
                      <p className='hint'>{action.hint}</p>
                      {!needsSetup && pluginAvailable && !action.supported && (
                        <p className='hint'>{t('SYNC_NOT_SUPPORTED', 'This integration does not support it.')}</p>
                      )}
                    </div>
                    <Button
                      color='lightPrimary'
                      borderRadius='8px'
                      disabled={needsSetup || !pluginAvailable || !action.supported || formState?.loading}
                      onClick={() => handlePushAction(selectedIntegration?.id, action.hook, action.startedMessage)}
                    >
                      {t('SYNC_NOW', 'Sync now')}
                    </Button>
                  </div>
                ))}
                {needsSetup && <p className='hint'>{t('SYNC_DISABLED_UNTIL_CONNECTED', 'Available once the POS is connected.')}</p>}
                {!needsSetup && !pluginAvailable && (
                  <p className='hint'>{t('SYNC_PLUGIN_UNAVAILABLE', 'The plugin of this integration is disabled or uninstalled.')}</p>
                )}
              </SyncActions>
            </IntegrationContainer>

          </>
        )}
        <MoreActions>
          {pluginLinkKeys.map(key => (
            <Button
              key={key}
              color='lightPrimary'
              borderRadius='8px'
              disabled={formState?.loading || isCalendlyRestricted(plugin, plugin?.links[key])}
              onClick={(e) => handleOpenPluginDetails(e, plugin, key)}
            >
              {isCalendlyRestricted(plugin, plugin?.links[key]) ? t('CONTACT_ADMIN', 'Contact admin') : t(key?.replace(/ /g, '_'), capitalize(key?.replace(/_/g, ' ')))}
            </Button>
          ))}
          <Button color='lightPrimary' borderRadius='8px' onClick={() => setOpenIntegrationLogs(true)}>
            {t('LOGS', 'Logs')}
          </Button>
        </MoreActions>
      </BusinessOrderingChannelsContainer>
      <Confirm
        title={selectedIntegration?.name || t('WEB_APPNAME', 'Ordering')}
        content={t('INTEGRATION_DISCONNECT_CONFIRM', 'Disconnect _name_ from this store? Orders and menu sync stop until you connect it again.').replace('_name_', selectedIntegration?.name || '')}
        acceptText={t('DISCONNECT', 'Disconnect')}
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onCancel={() => setConfirmDisconnect(false)}
        onAccept={() => {
          setConfirmDisconnect(false)
          handleDisconnectIntegration()
        }}
        closeOnBackdrop={false}
      />
      <Modal
        open={pluginSelected.open}
        title={pluginSelected.title}
        onClose={handleClosePluginModal}
        height={pluginModal.height}
        width={pluginModal.width}
        anchorTop
      >
        <PluginPageFrame
          ref={pluginFrameRef}
          url={pluginSelected.url}
          name={pluginSelected.title}
          height={pluginFrame.height}
          fits={pluginSelected.fits}
          initialHeight={pluginSelected.initialHeight}
        />
      </Modal>
      <Modal
        open={openIntegrationLogs}
        title={t('LOGS', 'Logs')}
        onClose={() => setOpenIntegrationLogs(false)}
        height='80vh'
        width='80vw'
      >
        <IntegrationLogs model='Business' modelId={business?.id} pluginId={selectedIntegration?.plugin_id} />
      </Modal>
    </>
  )
}
