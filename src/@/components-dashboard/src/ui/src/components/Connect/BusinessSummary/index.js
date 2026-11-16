// No consumer since Connect/BusinessDetails was removed. P10: its automatic menu sync form is gone (api-core has none)
import React, { useState, useEffect } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useTheme } from 'styled-components'
import { XLg, ThreeDots, ArrowsAngleExpand, ArrowsAngleContract } from 'react-bootstrap-icons'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'

import { useLanguage, useSession, useToast, ToastType, useApi } from '~components'
import { Button, ButtonLink, IconButton, Switch } from '../../../styles'
import {
  isCalendlyUrl,
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
  ActionSelectorWrapper
} from './styles'

export const BusinessSummary = (props) => {
  const {
    businessState,
    actionSidebar,
    handleChangeActiveBusiness,
    handleSelectedItem,
    handleConnectBusiness,
    handleSelectIntegration,
    extraOpen,
    isExpand,
    setIsExpand,
    formState,
    handleSync,
    fromSalesChannels,
    integrationsList,
    getIntegrations,
    updateBusiness,
    integrationActionLoading,
    installingPluginRoot,
    handleInstallPosIntegration
  } = props

  const [languageState, t] = useLanguage()
  const [ordering] = useApi()
  const theme = useTheme()
  const { width } = useWindowSize()
  const [sessionState] = useSession()
  const isBusinessOwner = sessionState?.user?.level === 2
  const isAdmin = sessionState?.user?.level === 0
  const isCalendlyRestricted = (integration) => !fromSalesChannels && !isAdmin && (
    isCalendlyUrl(getPluginSetupPath(integration?.plugin), integration?.plugin?.root) ||
    (!integration?.plugin_id && isCalendlyUrl(integration?.plugin_root))
  )
  const [, { showToast }] = useToast()
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [alertState, setAlertState] = useState({ open: false, content: [], success: false })

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

  const closeAlert = () => {
    setAlertState({
      ...alertState,
      open: false,
      content: []
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
                  {isAdmin
                    ? (
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
                      )
                    : (
                    <Button color='secundary' borderRadius='8px' disabled>
                      {t('CONTACT_ADMIN', 'Contact admin')}
                    </Button>
                      )}
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
                    isCalendlyRestricted(integration) || (isBusinessOwner && !integration?.plugin_id)
                      ? (
                        <Button
                          color='secundary'
                          borderRadius='8px'
                          disabled
                        >
                          {isCalendlyRestricted(integration)
                            ? t('CONTACT_ADMIN', 'Contact admin')
                            : t('CONTACT_ADMINISTRATOR', 'Contact administrator')}
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
