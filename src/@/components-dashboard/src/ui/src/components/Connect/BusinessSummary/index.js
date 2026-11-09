import React, { useState, useEffect, useRef } from 'react'
import { usePluginMessages } from '../../../hooks/usePluginMessages'
import { pluginModalSize } from '../../../../../utils/pluginMessages'
import { PluginPageFrame } from '../PluginPageFrame'
import { useShowPluginPage } from '../../../hooks/usePluginPage'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import BsChevronRight from '@meronex/icons/bs/BsChevronRight'
import { useTheme } from 'styled-components'
import { XLg, ThreeDots, ArrowsAngleExpand, ArrowsAngleContract, Circle, RecordCircleFill } from 'react-bootstrap-icons'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'

import { useLanguage, useSession, useToast, ToastType, useUtils } from '~components'
import { Button, ButtonLink, IconButton, Switch } from '../../../styles'
import {
  isSalesCallRestricted,
  isSetupCallIntegration,
  POS_SETUP_CALL_PROVIDERS,
  POS_SETUP_CALL_URL
} from '../../../utils'
import { findConnectedPosIntegration, getPluginSetupPath } from '../../../../../utils/posPluginCatalog'
import { getIntegrationSetupStatus, getIntegrationSetupAction, getIntegrationPluginNote, isIntegrationPluginAvailable } from '../../../../../utils/integrationSetupStatus'
import { WrapperImage, StatusCell } from '../shared/styles'
import { IntegrationStatusBadge } from '../IntegrationStatusBadge'
import { FeaturedWrapper } from '../IntegrationStatusBadge/styles'
import { getPluginInstallState } from '../../../../../utils/pluginInstall'

import { Confirm, Alert, Modal, useWindowSize } from '~ui'

import {
  BusinessDetailsContainer,
  DetailsHeader,
  BusinessName,
  LeftHeader,
  RightHeader,
  BusinessDetailsContent,
  BusinessConfigsContainer,
  BusinessConfigItem,
  ActionSelectorWrapper,
  RadioButton,
  MenuStatusWrapper,
  SyncMenuWrapper,
  IntegrationSection,
  IntegrationRow,
  LogoImage
} from './styles'

export const BusinessSummary = (props) => {
  const {
    businessState,
    actionSidebar,
    handleChangeActiveBusiness,
    selectedItem,
    handleSelectedItem,
    handleDeleteBusiness,
    handleUpdateBusinessClick,
    handleConnectBusiness,
    handleSelectIntegration,
    selectedIntegration,
    extraOpen,
    isExpand,
    setIsExpand,
    formState,
    setFormState,
    fromSalesChannels,
    integrationsList,
    getIntegrations,
    updateBusiness,
    integrationActionLoading,
    installingPluginRoot,
    handleInstallPosIntegration,
    checkingPluginRoot,
    handleCheckPluginInstall
  } = props

  const isHideSetupForm = true

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const theme = useTheme()
  const { width } = useWindowSize()
  const [sessionState] = useSession()
  const isBusinessOwner = sessionState?.user?.level === 2
  const isAdmin = sessionState?.user?.level === 0
  const isCalendlyRestricted = (integration) =>
    isSalesCallRestricted(sessionState?.user, getPluginSetupPath(integration?.plugin), integration?.plugin?.root, fromSalesChannels) ||
    (!integration?.plugin_id && isSalesCallRestricted(sessionState?.user, integration?.plugin_root, '', fromSalesChannels))
  const [, { showToast }] = useToast()
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [alertState, setAlertState] = useState({ open: false, content: [], success: false })

  const [dailyTime, setDailyTime] = useState('12:00')
  const [weeklySchedule, setWeeklySchedule] = useState({ day: 'Monday', time: '12:00' })
  const [monthlySchedule, setMonthlySchedule] = useState({ day: '1', time: '12:00' })
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
    businessId: businessState?.business?.id ?? null,
    name: pluginSelected.title,
    closeModal: handleClosePluginModal,
    reload: reloadStore,
    fits: Boolean(pluginSelected.fits),
    frameKey: pluginSelected.frameKey ?? null
  })
  const pluginModal = pluginModalSize({ fits: Boolean(pluginSelected.fits), ...pluginFrame })

  const [pendingToOpenIntegration, setPendingToOpenIntegration] = useState(null)

  const showPluginPage = useShowPluginPage(setPluginSelected)

  const daysOfWeek = [
    { id: 'sunday', label: t('S', 'S') },
    { id: 'monday', label: t('M', 'M') },
    { id: 'tuesday', label: t('T', 'T') },
    { id: 'wednesday', label: t('W', 'W') },
    { id: 'thursday', label: t('TH', 'Th') },
    { id: 'friday', label: t('F', 'F') },
    { id: 'saturday', label: t('SA', 'Sa') }
  ]

  const handleDailyTimeChange = (e) => {
    setDailyTime(e.target.value)
    setFormState && setFormState(prevState => ({
      ...prevState,
      changes: { ...prevState?.changes, daily_schedule: e.target.value }
    }))
  }

  const handleWeeklyScheduleChange = (e) => {
    const { name, value } = e.target
    setWeeklySchedule(prev => ({
      ...prev,
      [name]: value
    }))
    setFormState && setFormState(prevState => ({
      ...prevState,
      changes: { ...prevState?.changes, weekly_schedule: { ...weeklySchedule, [name]: value } }
    }))
  }

  const handleMonthlyScheduleChange = (e) => {
    const { name, value } = e.target
    setMonthlySchedule(prev => ({
      ...prev,
      [name]: value
    }))
    setFormState && setFormState(prevState => ({
      ...prevState,
      changes: { ...prevState?.changes, monthly_schedule: { ...monthlySchedule, [name]: value } }
    }))
  }

  const handleCheckboxChange = (e, day) => {
    setWeeklySchedule(prev => {
      const newDays = e.target.checked
        ? [...(prev.days || []), day]
        : prev.days.filter(d => d !== day)

      setFormState && setFormState(prevState => ({
        ...prevState,
        changes: { ...prevState?.changes, weekly_schedule: { ...prev, days: newDays } }
      }))
      return { ...prev, days: newDays }
    })
  }

  const closeAlert = () => {
    setAlertState({
      ...alertState,
      open: false,
      content: []
    })
  }
  const businessConfigs = [
    {
      key: 'schedule',
      value: t('SCHEDULE', 'Schedule'),
      enabled: true
    }
  ]

  const menuTimeOptions = [
    { type: 'daily', content: t('DAILY', 'Daily'), enabled: true },
    { type: 'weekly', content: t('WEEKLY', 'Weekly'), enabled: true },
    { type: 'monthly', content: t('MONTHLY', 'Monthly'), enabled: true },
    { type: 'manual', content: t('MANUAL_ONLY', 'Manual only'), enabled: true }
  ]

  const onClickDeleteBusiness = () => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_BUSINESS', 'Are you sure that you want to delete this business?'),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleDeleteBusiness()
      }
    })
  }

  const expandSideBar = () => {
    const element = document.getElementById('business_details_bar')
    if (!element) return

    if (isExpand) element.style.width = '500px'
    else element.style.width = 'var(--app-width, 100vw)'
    setIsExpand(prev => !prev)
  }

  // The integrations this store is connected to go first, with their state;
  // the rest are the ones it can connect.
  const visibleIntegrations = integrationsList?.thirdPartyIntegrations?.filter(integration => fromSalesChannels || !isSetupCallIntegration(integration)) || []
  const connectedIntegrations = visibleIntegrations
    .map(integration => {
      const row = businessState?.business?.third_party_integrations?.find(item => item?.third_party_integration_id === integration?.id)
      return row ? { integration, row, status: getIntegrationSetupStatus(row, t), setupAction: getIntegrationSetupAction(row, integration, t) } : null
    })
    .filter(Boolean)
  // A store has one POS: while one is connected, another installed POS cannot
  // connect directly. Installing one still works (it keeps the current POS).
  // The detail open on the right already shows the POS's logo, state and
  // action, so the panel stops repeating it meanwhile. Sales channels are a
  // list to move through: they all stay, with the open one marked.
  const isIntegrationDetailOpen = !!extraOpen && selectedItem === 'integration'
  const isOpenIntegration = (integration) => isIntegrationDetailOpen && selectedIntegration?.id === integration?.id
  const listedConnectedIntegrations = fromSalesChannels
    ? connectedIntegrations
    : connectedIntegrations.filter(({ integration }) => !isOpenIntegration(integration))
  // In the POS view every integration listed is a POS.
  const currentPos = !fromSalesChannels ? connectedIntegrations[0] || null : null
  const blocksConnect = (integration) => !!currentPos && !!integration?.plugin_id
  // An installed integration whose plugin is disabled, or failed its install,
  // cannot be connected: nothing would answer its setup or syncs. Installing
  // one is unaffected.
  const isPluginDisabled = (integration) => !!integration?.plugin_id && !!integration?.plugin && !isIntegrationPluginAvailable(integration)

  const availableIntegrations = visibleIntegrations.filter(integration =>
    !connectedIntegrations.some(connected => connected.integration.id === integration.id)
  )
  // The POS list always has its setup-call providers. Sales channels can run
  // out: say so instead of leaving the section's title alone.
  const hasNoAvailableSalesChannels = fromSalesChannels &&
    availableIntegrations.length === 0 &&
    !integrationsList?.loading &&
    !integrationsList?.error

  const getButtonText = (integration) => {
    if (!integration?.plugin_id) {
      return t('INSTALL', 'Install')
    }

    const isConnected = businessState?.business?.third_party_integrations?.find(
      item => item?.third_party_integration_id === integration?.id
    )
    return isConnected ? t('SETUP', 'Setup') : t('CONNECT', 'Connect')
  }

  const handleInstallAndConnect = async (integration) => {
    const { installed, integration: installedIntegration } = await handleInstallPosIntegration(integration)
    if (!installed) return
    if (!installedIntegration) {
      updateBusiness && updateBusiness()
      return
    }
    handleConnectBusiness(installedIntegration.id, { enabled: true }, () => {
      updateBusiness && updateBusiness()
      setPendingToOpenIntegration(installedIntegration)
    })
  }

  // A logo URL that does not load shows the default logo, not its alt text
  // spilling out of the frame. Once only, in case the default fails too.
  const handleLogoError = (e) => {
    const fallback = theme.images?.dummies?.businessLogo
    if (!fallback || e.currentTarget.dataset.fallback) return
    e.currentTarget.dataset.fallback = 'true'
    e.currentTarget.src = fallback
  }

  // "Check again" on a plugin still finishing its install. Once it is done,
  // the store connects to it as after a quick install, unless it already
  // uses another POS.
  const handleCheckAgain = async (integration, e) => {
    e?.stopPropagation()
    if (!handleCheckPluginInstall) return
    const { integration: installedIntegration } = await handleCheckPluginInstall(integration)
    if (!installedIntegration) return
    if (currentPos) {
      updateBusiness && updateBusiness()
      return
    }
    handleConnectBusiness(installedIntegration.id, { enabled: true }, () => {
      updateBusiness && updateBusiness()
      setPendingToOpenIntegration(installedIntegration)
    })
  }

  const handleButtonClick = (integration, e) => {
    if (isCalendlyRestricted(integration)) return
    if (integration?.plugin_root && !integration?.plugin_id) {
      e?.stopPropagation()
      const connectedPos = integration?.type === 'pos'
        ? findConnectedPosIntegration(businessState?.business, integrationsList?.thirdPartyIntegrations)
        : null
      setConfirm({
        open: true,
        content: connectedPos
          ? t('INSTALL_POS_PLUGIN_KEEP_CURRENT_CONFIRM', 'This installs _name_ for the whole project. This store stays connected to _current_.').replace('_name_', integration?.name).replace('_current_', connectedPos.name)
          : t('INSTALL_POS_PLUGIN_CONFIRM', 'This installs _name_ for the whole project and connects it to this store.').replace('_name_', integration?.name),
        handleOnAccept: () => {
          setConfirm({ ...confirm, open: false })
          connectedPos ? handleInstallPosIntegration(integration) : handleInstallAndConnect(integration)
        }
      })
      return
    }

    if (!integration?.plugin_root && !integration?.plugin_id) {
      showToast(ToastType.Error, t('INTEGRATION_PLUGIN_NOT_FOUND', 'Plugin is needed to connect to this integration'))
      return
    }

    if (integration?.plugin_id) {
      const found = businessState?.business?.third_party_integrations?.find(
        item => item?.third_party_integration_id === integration?.id
      )
      if (!found) {
        return handleConnectBusiness(integration?.id, { enabled: true }, () => {
          getIntegrations && getIntegrations()
          updateBusiness && updateBusiness()
          setPendingToOpenIntegration(integration)
        })
      }
    }
    return handleOpenPluginDetails(e, integration?.plugin)
  }

  const handleIntegrationClick = async (integration) => {
    const found = businessState?.business?.third_party_integrations?.find(
      item => item?.third_party_integration_id === integration?.id
    )
    if (found) {
      handleSelectedItem('integration')
      handleSelectIntegration(integration)
    }
  }

  const handleOpenPluginDetails = async (e, plugin) => {
    if (!plugin) return
    e.stopPropagation()
    await showPluginPage(plugin, 'setup', { businessId: businessState?.business?.id ?? null })
  }

  useEffect(() => {
    if (pendingToOpenIntegration && businessState?.business) {
      const found = businessState.business.third_party_integrations?.find(
        item => item?.third_party_integration_id === pendingToOpenIntegration?.id
      )
      if (found) {
        handleIntegrationClick(pendingToOpenIntegration)
        setPendingToOpenIntegration(null)
      }
    }
  }, [businessState?.business])

  return (
    <>
      <BusinessDetailsContainer>
        <DetailsHeader>
          <LeftHeader>
            {businessState?.loading
              ? (
              <BusinessName>
                <Skeleton width={100} />
              </BusinessName>
                )
              : (
              <BusinessName>
                {businessState?.business?.name}
              </BusinessName>
                )}
            {businessState?.loading
              ? (
              <Skeleton width={50} />
                )
              : (
              <Switch
                defaultChecked={businessState?.business?.enabled}
                onChange={handleChangeActiveBusiness}
              />
                )}
          </LeftHeader>
          <RightHeader>
            {sessionState?.user?.level === 0 && !isHideSetupForm && (
              <Button
                className='sync-button'
                color='lightPrimary'
                borderRadius='8px'
                disabled={businessState?.loading || formState?.loading}
              >
                {t('SYNC_NOW', 'Sync now')}
              </Button>
            )}
            {width > 576 && !extraOpen && (
              <IconButton
                color='black'
                onClick={() => expandSideBar()}
              >
                {isExpand ? <ArrowsAngleContract /> : <ArrowsAngleExpand />}
              </IconButton>
            )}
            <ActionSelectorWrapper>
              <DropdownButton
                menuAlign={theme?.rtl ? 'left' : 'right'}
                title={<ThreeDots />}
                id={theme?.rtl ? 'dropdown-menu-align-left' : 'dropdown-menu-align-right'}
              >
                <Dropdown.Item
                  onClick={() => handleSelectedItem('custom_fields')}
                >
                  {t('CUSTOM_FIELDS', 'Custom fields')}
                </Dropdown.Item>
                {!isHideSetupForm && (
                  <Dropdown.Item
                    className='danger'
                    onClick={() => onClickDeleteBusiness()}
                  >
                    {t('DELETE', 'Delete')}
                  </Dropdown.Item>
                )}
              </DropdownButton>
            </ActionSelectorWrapper>
            <IconButton
              color='black'
              onClick={() => actionSidebar(false)}
            >
              <XLg />
            </IconButton>
          </RightHeader>
        </DetailsHeader>
        {isHideSetupForm && (
          <>
            {listedConnectedIntegrations.length > 0 && (
              <IntegrationSection>
                <p className='section-title'>{t('CONNECTED', 'Connected')}</p>
                {listedConnectedIntegrations.map(({ integration, row, status, setupAction }) => (
                  <IntegrationRow
                    key={integration.id}
                    className='connect-pos-wrapper'
                    clickable
                    active={isOpenIntegration(integration)}
                    aria-current={isOpenIntegration(integration) ? 'true' : undefined}
                    onClick={() => handleIntegrationClick(integration)}
                  >
                    <div className='integration-info'>
                      <WrapperImage>
                        <LogoImage src={integration?.logo || theme.images?.dummies?.businessLogo} alt={integration?.name} onError={handleLogoError} />
                      </WrapperImage>
                      <StatusCell>
                        <p className='integration-name'>{integration.name}</p>
                        <IntegrationStatusBadge row={row} integration={integration} />
                        {status.message && <p className='status-detail'>{status.message}</p>}
                        {getPluginInstallState(integration)?.state === 'failed' && getPluginInstallState(integration).message && (
                          <p className='status-detail danger'>{getPluginInstallState(integration).message}</p>
                        )}
                        {row?.setup_status_updated_at && <p className='status-detail'>{parseDate(row.setup_status_updated_at)}</p>}
                      </StatusCell>
                    </div>
                    {setupAction && (
                      isCalendlyRestricted(integration)
                        ? (
                          <Button color='lightPrimary' borderRadius='8px' disabled>
                            {t('CONTACT_ADMIN', 'Contact admin')}
                          </Button>
                          )
                        : (
                          <Button
                            color='lightPrimary'
                            borderRadius='8px'
                            disabled={businessState?.loading || formState?.loading || integrationActionLoading}
                            onClick={(e) => handleOpenPluginDetails(e, integration?.plugin)}
                          >
                            {setupAction.label}
                          </Button>
                          )
                    )}
                  </IntegrationRow>
                ))}
              </IntegrationSection>
            )}
            <IntegrationSection>
              <p className='section-title'>
                {fromSalesChannels
                  ? t('AVAILABLE_SALES_CHANNELS', 'Available sales channels')
                  : t('AVAILABLE_POS', 'Available POS')}
              </p>
              {currentPos && (
                <p className='section-note'>
                  {t('POS_ALREADY_CONNECTED_NOTE', 'This store already uses _name_. Disconnect it to switch POS.').replace('_name_', currentPos.integration?.name)}
                </p>
              )}
              {hasNoAvailableSalesChannels && (
                <p className='section-note'>
                  {connectedIntegrations.length > 0
                    ? t('ALL_SALES_CHANNELS_CONNECTED', 'All available sales channels are connected.')
                    : t('NO_SALES_CHANNELS_AVAILABLE', 'No sales channels available.')}
                </p>
              )}
              {!fromSalesChannels && POS_SETUP_CALL_PROVIDERS.map(integration => (
                <IntegrationRow key={integration.name} className='connect-pos-wrapper'>
                  <div className='integration-info'>
                    <WrapperImage>
                      <LogoImage src={theme.images.general[integration.logoKey]} alt={integration.name} />
                    </WrapperImage>
                    <p className='integration-name'>{integration.name}</p>
                  </div>
                  {isAdmin
                    ? (
                    <ButtonLink
                      color='lightPrimary'
                      borderRadius='8px'
                      href={POS_SETUP_CALL_URL}
                      target='_blank'
                      rel='noopener noreferrer'
                      aria-label={`${t('CONNECT', 'Connect')} ${integration.name}`}
                    >
                      {t('CONNECT', 'Connect')}
                    </ButtonLink>
                      )
                    : (
                    <Button color='lightPrimary' borderRadius='8px' disabled>
                      {t('CONTACT_ADMIN', 'Contact admin')}
                    </Button>
                      )}
                </IntegrationRow>
              ))}
              {availableIntegrations.map(integration => {
                const installState = getPluginInstallState(integration)
                const isInstallingThis = !!installingPluginRoot && installingPluginRoot === integration?.plugin_root
                const isCheckingThis = !!checkingPluginRoot && checkingPluginRoot === integration?.plugin_root
                const pluginNote = getIntegrationPluginNote(integration, t)
                return (
                  <IntegrationRow key={integration.id} className='connect-pos-wrapper'>
                    <div className='integration-info'>
                      <WrapperImage>
                        <LogoImage src={integration?.logo || theme.images?.dummies?.businessLogo} alt={integration?.name} onError={handleLogoError} />
                      </WrapperImage>
                      <StatusCell>
                        <p className='integration-name'>{t(integration.name.toUpperCase() || 'INTEGRATION', integration.name || 'Integration')}</p>
                        {isInstallingThis && (
                          <p className='status-detail'>{t('INTEGRATION_PLUGIN_INSTALLING_REQUEST', 'Installing plugin...')}</p>
                        )}
                        {!isInstallingThis && installState?.state === 'installing' && (
                          <>
                            <FeaturedWrapper tone='warning'><p>{t('INTEGRATION_PLUGIN_INSTALLING', 'Installing')}</p></FeaturedWrapper>
                            <p className='status-detail'>{t('INTEGRATION_PLUGIN_INSTALLING_NOTE', 'Still finishing its install. It can take a few minutes.')}</p>
                          </>
                        )}
                        {!isInstallingThis && installState?.state === 'failed' && (
                          <>
                            <FeaturedWrapper tone='danger'><p>{t('INTEGRATION_PLUGIN_INSTALL_FAILED_NOTE', 'Install failed')}</p></FeaturedWrapper>
                            {installState.message && <p className='status-detail danger'>{installState.message}</p>}
                            <p className='status-detail'>{t('INTEGRATION_PLUGIN_INSTALL_FAILED_HELP', 'Uninstall it from Plugins and install it again, or contact support.')}</p>
                          </>
                        )}
                        {!installState && pluginNote && (
                          <p className='status-detail'>{pluginNote}</p>
                        )}
                      </StatusCell>
                    </div>
                    {isCalendlyRestricted(integration) || (isBusinessOwner && !integration?.plugin_id)
                      ? (
                        <Button color='lightPrimary' borderRadius='8px' disabled>
                          {isCalendlyRestricted(integration)
                            ? t('CONTACT_ADMIN', 'Contact admin')
                            : t('CONTACT_ADMINISTRATOR', 'Contact administrator')}
                        </Button>
                        )
                      : !isInstallingThis && installState?.state === 'installing'
                          ? (
                            <Button
                              color='lightPrimary'
                              borderRadius='8px'
                              onClick={(e) => handleCheckAgain(integration, e)}
                              disabled={businessState?.loading || formState?.loading || integrationActionLoading || !!installingPluginRoot || !!checkingPluginRoot}
                            >
                              {isCheckingThis ? t('CHECKING', 'Checking...') : t('CHECK_AGAIN', 'Check again')}
                            </Button>
                            )
                          : !isInstallingThis && installState?.state === 'failed'
                              ? (
                              <Button color='lightPrimary' borderRadius='8px' disabled>
                                {t('CONNECT', 'Connect')}
                              </Button>
                                )
                              : (
                              <Button
                                color='lightPrimary'
                                borderRadius='8px'
                                onClick={(e) => handleButtonClick(integration, e)}
                                disabled={businessState?.loading || formState?.loading || integrationActionLoading || !!installingPluginRoot || !!checkingPluginRoot || blocksConnect(integration) || isPluginDisabled(integration)}
                              >
                                {isInstallingThis ? t('INSTALLING', 'Installing...') : getButtonText(integration)}
                              </Button>
                                )}
                  </IntegrationRow>
                )
              })}
            </IntegrationSection>
          </>
        )}
        {!isHideSetupForm && (
          <>
            <BusinessDetailsContent>
              <MenuStatusWrapper
                onClick={() => setFormState({
                  ...formState,
                  changes: {
                    ...formState?.changes,
                    menu_type: 'menu_sync_send_order'
                  }
                })}
              >
                <RadioButton
                  active={formState?.changes?.menu_type === 'menu_sync_send_order' || businessState?.business?.menu_type === 'menu_sync_send_order' || (!businessState?.business?.menu_type && !formState?.changes?.menu_type)}
                >
                  {
                    (formState?.changes?.menu_type === 'menu_sync_send_order' || businessState?.business?.menu_type === 'menu_sync_send_order' || (!businessState?.business?.menu_type && !formState?.changes?.menu_type))
                      ? (
                        <RecordCircleFill />
                        )
                      : (
                        <Circle />
                        )
                  }
                </RadioButton>
                <span>{t('MENU_SYNC_SEND_ORDER', 'Menu Sync & Send Order')}</span>
              </MenuStatusWrapper>
              <MenuStatusWrapper
                onClick={() => setFormState({
                  ...formState,
                  changes: {
                    ...formState?.changes,
                    menu_type: 'menu_sync'
                  }
                })}
              >
                <RadioButton
                  active={formState?.changes?.menu_type === 'menu_sync' || businessState?.business?.menu_type === 'menu_sync'}
                >
                  {
                    ((formState?.changes?.menu_type === 'menu_sync' || businessState?.business?.menu_type === 'menu_sync'))
                      ? (
                        <RecordCircleFill />
                        )
                      : (
                        <Circle />
                        )
                  }
                </RadioButton>
                <span>{t('MENU_SYNC', 'Menu Sync')}</span>
              </MenuStatusWrapper>
              <SyncMenuWrapper>
                {t('SYNC_AUTOMATICALLY', 'Sync automatically')}
              </SyncMenuWrapper>

              {menuTimeOptions.map((option, i) => (
                <>
                  <MenuStatusWrapper
                    key={i}
                    onClick={() => setFormState({
                      ...formState,
                      changes: { menu_time_type: option.type }
                    })}
                  >
                    <RadioButton
                      active={formState?.changes?.menu_time_type === option.type || businessState?.business?.menu_time_type === option.type || (!businessState?.business?.menu_time_type && !formState?.changes?.menu_time_type && i === 0) }
                    >
                      {
                        (formState?.changes?.menu_time_type === option.type || businessState?.business?.menu_time_type === option.type || (!businessState?.business?.menu_time_type && !formState?.changes?.menu_time_type && i === 0))
                          ? (
                            <RecordCircleFill />
                            )
                          : (
                            <Circle />
                            )
                      }
                    </RadioButton>
                    <span>{option.content}</span>
                  </MenuStatusWrapper>
                  {(formState?.changes?.menu_time_type === 'daily' || (!businessState?.business?.menu_time_type && !formState?.changes?.menu_time_type)) && i === 0 && (
                    <div className='daily-wrap'>
                      <input
                        type="time"
                        value={dailyTime}
                        onChange={handleDailyTimeChange}
                      />
                    </div>
                  )}

                  {formState?.changes?.menu_time_type === 'weekly' && i === 1 && (
                    <div className='weekly-wrap'>
                      {daysOfWeek.map(day => (
                        <label key={day.id}>
                          <input
                            type="checkbox"
                            value={day.label}
                            checked={weeklySchedule.days?.includes(day.label)}
                            onChange={(e) => handleCheckboxChange(e, day.label)}
                          />
                          <div>{day.label}</div>
                        </label>
                      ))}
                      <input
                        type="time"
                        name="time"
                        value={weeklySchedule.time}
                        onChange={handleWeeklyScheduleChange}
                      />
                    </div>
                  )}

                  {formState?.changes?.menu_time_type === 'monthly' && i === 2 && (
                    <div className='monthly-wrap'>
                      <label>{t('THE_DAY', 'The day')}</label>
                      <select
                        value={monthlySchedule.day}
                        name="day"
                        onChange={handleMonthlyScheduleChange}
                      >
                        {Array.from({ length: 31 }, (_, index) => (
                          <option key={index + 1} value={index + 1}>
                            {index + 1}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={monthlySchedule.time}
                        name="time"
                        onChange={handleMonthlyScheduleChange}
                      />
                    </div>
                  )}

                </>
              ))}

              <BusinessConfigsContainer hidden isLoading={businessState?.loading}>
                {businessConfigs.map(config => (
                  config.enabled && (
                    <BusinessConfigItem
                      key={config.key}
                      active={selectedItem === config.key}
                      onClick={() => handleSelectedItem(config.key)}
                    >
                      <span>{config.value}</span>
                      <BsChevronRight />
                    </BusinessConfigItem>
                  ))
                )}
              </BusinessConfigsContainer>
            </BusinessDetailsContent>
            <div className='sticky-buttons'>
              <div>
                <Button
                  borderRadius='8px'
                  color='lightPrimary'
                  /* onClick={() => handleUpdateBusinessClick()} */
                >
                  {t('DISCONNECT', 'Disconnect')}
                </Button>
              </div>
              <div className='save-button'>
                <Button
                  borderRadius='8px'
                  color='primary'
                  disabled={Object.keys(formState?.changes).length === 0}
                  onClick={() => handleUpdateBusinessClick()}
                >
                  {t('SAVE', 'Save')}
                </Button>
              </div>
            </div>
          </>
        )}
      </BusinessDetailsContainer>
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
      <Confirm
        width='700px'
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
      <Alert
        title={t('BUSINESS', 'Business')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </>
  )
}
