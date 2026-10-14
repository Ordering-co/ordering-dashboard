import React, { useState, useEffect } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import BsChevronRight from '@meronex/icons/bs/BsChevronRight'
import { useTheme } from 'styled-components'
import { XLg, ThreeDots, ArrowsAngleExpand, ArrowsAngleContract, Circle, RecordCircleFill } from 'react-bootstrap-icons'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'

import { useLanguage, useSession, useToast, ToastType, useApi } from '~components'
import { Button, ButtonLink, IconButton, Switch } from '../../../styles'
import {
  isSetupCallIntegration,
  parseTemplate,
  POS_SETUP_CALL_PROVIDERS,
  POS_SETUP_CALL_URL
} from '../../../utils'
import { findConnectedPosIntegration, getPluginSetupPath } from '../../../../../utils/posPluginCatalog'

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
  SyncMenuWrapper
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
    extraOpen,
    isExpand,
    setIsExpand,
    formState,
    setFormState,
    handleSync,
    fromSalesChannels,
    integrationsList,
    getIntegrations,
    updateBusiness,
    integrationActionLoading,
    installingPluginRoot,
    handleInstallPosIntegration
  } = props

  const isHideSetupForm = true

  const [languageState, t] = useLanguage()
  const [ordering] = useApi()
  const theme = useTheme()
  const { width } = useWindowSize()
  const [sessionState] = useSession()
  const isBusinessOwner = sessionState?.user?.level === 2
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

  const [pendingToOpenIntegration, setPendingToOpenIntegration] = useState(null)

  const variables = {
    project_code: ordering.project,
    access_token: sessionState?.token,
    language_code: languageState?.language?.code
  }

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

  const getButtonText = (integration) => {
    if (!integration?.plugin_id) {
      return t('INSTALL', 'Install')
    }

    const isConnected = businessState?.business?.third_party_integrations?.find(
      item => item?.third_party_integration_id === integration?.id
    )
    return isConnected ? t('SETUP', 'Setup') : t('CONNECT', 'Connect')
  }

  const getHideSetupButton = (integration) => {
    const isConnected = businessState?.business?.third_party_integrations?.some(
      item => item?.third_party_integration_id === integration?.id
    )
    return isConnected && !getPluginSetupPath(integration?.plugin)
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

  const handleButtonClick = (integration, e) => {
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
    const url = await handleSync(getPluginSetupPath(plugin), plugin?.root)
    if (!url) {
      showToast(ToastType.Error, t('INTEGRATION_SETUP_NOT_AVAILABLE', 'This integration has no setup page. Contact support to finish the connection.'))
      return
    }
    setPluginSelected({
      open: true,
      title: plugin.name,
      url
    })
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
            {!fromSalesChannels && POS_SETUP_CALL_PROVIDERS.map(integration => (
              <BusinessDetailsContent key={integration.name}>
                <div className='connect-pos-wrapper'>
                  <div className='connect-pos'>
                    <img
                      className='setup-call-logo'
                      src={theme.images.general[integration.logoKey]}
                      alt={integration.name}
                    />
                    <p>{integration.name}</p>
                  </div>
                  <ButtonLink
                    color='primary'
                    borderRadius='8px'
                    href={POS_SETUP_CALL_URL}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-label={`${t('CONNECT', 'Connect')} ${integration.name}`}
                  >
                    {t('CONNECT', 'Connect')}
                  </ButtonLink>
                </div>
              </BusinessDetailsContent>
            ))}
            {integrationsList?.thirdPartyIntegrations?.filter(integration => fromSalesChannels || !isSetupCallIntegration(integration)).map(integration => (
              <BusinessDetailsContent key={integration.id} fromSalesChannels={fromSalesChannels} hasIntegration={businessState?.business?.third_party_integrations?.find(
                item => item?.third_party_integration_id === integration?.id
              )}
              >
                <div className='connect-pos-wrapper' onClick={() => handleIntegrationClick(integration)}>
                  <div className='connect-pos'>
                    {integration?.logo && <img src={integration?.logo} alt={integration?.name} />}
                    <p>{t(integration.name.toUpperCase() || 'INTEGRATION', integration.name || 'Integration')}</p>
                  </div>
                  {!getHideSetupButton(integration) && (
                    isBusinessOwner && !integration?.plugin_id
                      ? (
                        <Button
                          color='secundary'
                          borderRadius='8px'
                          disabled
                        >
                          {t('CONTACT_ADMINISTRATOR', 'Contact administrator')}
                        </Button>
                        )
                      : (
                        <Button
                          color={integration?.plugin_id ? 'green' : 'primary'}
                          borderRadius='8px'
                          onClick={(e) => handleButtonClick(integration, e)}
                          disabled={businessState?.loading || formState?.loading || integrationActionLoading || !!installingPluginRoot}
                        >
                          {installingPluginRoot && installingPluginRoot === integration?.plugin_root ? t('INSTALLING', 'Installing...') : getButtonText(integration)}
                        </Button>
                        )
                  )}
                </div>
              </BusinessDetailsContent>
            ))}
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
        onClose={() => setPluginSelected({ ...pluginSelected, open: false })}
        height='80vh'
        width='80vw'
      >
        <iframe
          src={parseTemplate(pluginSelected.url, variables, /@\{([^}]+)\}/g)}
          style={{ width: '100%', height: '85%' }}
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
