import React, { useEffect, useState } from 'react'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import { ThreeDots, Circle, RecordCircleFill } from 'react-bootstrap-icons'
import { useTheme } from 'styled-components'
import { useLanguage } from '../../../../../index'
import { Button, Input, Switch } from '../../../styles'
import { Alert, Modal, IntegrationLogs } from '../../Shared'
import { useApi, useSession } from '../../../../../index'
import { parseTemplate, capitalize } from '../../../utils'

import {
  BusinessOrderingChannelsContainer,
  Title,
  FormControl,
  Label,
  IntegrationContainer,
  IntegrationActions,
  TitleWrapper,
  ActionSelectorWrapper,
  MenuStatusWrapper,
  RadioButton,
  SyncButtonsContainer,
  StickyButtons
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
    setFormState
  } = props

  const [languageState, t] = useLanguage()
  const theme = useTheme()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [alertState, setAlertState] = useState({ open: false, content: [], success: false })
  const [externalId, setExternalId] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [openIntegrationLogs, setOpenIntegrationLogs] = useState(false)
  const [pluginSelected, setPluginSelected] = useState({
    open: false,
    url: null
  })
  const [selectedAction, setSelectedAction] = useState('sync_business')

  const variables = {
    project_code: ordering.project,
    access_token: token,
    language_code: languageState?.language?.code
  }

  const setupStatus = business?.third_party_integrations?.find(
    item => item?.third_party_integration_id === selectedIntegration?.id
  )?.setup_status

  const closeAlert = () => {
    setAlertState({
      ...alertState,
      open: false,
      content: []
    })
  }

  const handleSaveIntegration = (paramEnabled) => {
    if (!selectedIntegration) return

    handleConnectBusiness(selectedIntegration.id, {
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

  const handleOpenPluginDetails = (e, plugin) => {
    if (!plugin?.links?.general_settings) return
    e.stopPropagation()
    setPluginSelected({
      open: true,
      title: plugin.name,
      url: plugin.root + plugin.links.general_settings
    })
  }

  const handlePushAction = async (integrationId, action = 'push_menu', message) => {
    try {
      setFormState({ ...formState, loading: true })
      await propHandlePushAction(integrationId, action, message)
    } finally {
      setFormState({ ...formState, loading: false })
    }
  }

  const handleActionSelect = (action) => {
    setSelectedAction(action)
  }

  const handleSaveAction = () => {
    if (!selectedAction) return
    const message = selectedAction === 'sync_business'
      ? t('BUSINESS_SYNCED', 'Business synced')
      : fromSalesChannels
        ? t('MENU_PUSHED', 'Menu pushed')
        : t('MENU_SYNCED', 'Menu synced')
    handlePushAction(selectedIntegration?.id, selectedAction, message)
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
      <BusinessOrderingChannelsContainer>
        <TitleWrapper>
          <div className='title-wrapper'>
            <Title>{selectedIntegration?.name || 'Integration'}</Title>
            <Switch
              defaultChecked={enabled}
              checked={enabled}
              disabled={formState?.loading}
              onChange={(value) => {
                setEnabled(value)
                handleSaveIntegration(value)
              }}
            />
          </div>
          <ActionSelectorWrapper>
            <DropdownButton
              menuAlign={theme?.rtl ? 'left' : 'right'}
              title={<ThreeDots />}
              id={theme?.rtl ? 'dropdown-menu-align-left' : 'dropdown-menu-align-right'}
              disabled={formState?.loading}
            >
              <Dropdown.Item
                onClick={() => handleDisconnectIntegration()}
                disabled={formState?.loading}
              >
                {t('DISCONNECT', 'Disconnect')}
              </Dropdown.Item>
            </DropdownButton>
          </ActionSelectorWrapper>
        </TitleWrapper>
        <div className='integration-actions'>
          {fromSalesChannels && (
            <>
            <Button
              color='lightPrimary'
              borderRadius='8px'
              disabled={formState?.loading}
              onClick={() => handlePushAction(selectedIntegration?.id, fromSalesChannels ? 'push_menu' : 'sync_menu', fromSalesChannels ? t('MENU_PUSHED', 'Menu pushed') : t('MENU_SYNCED', 'Menu synced'))}
            >
              {fromSalesChannels ? t('PUSH_MENU', 'Push menu') : t('SYNC_MENU', 'Sync menu')}
            </Button>
            </>
          )}
          {selectedIntegration?.plugin?.links && Object.keys(selectedIntegration?.plugin?.links).map(key => (
            <Button
              color='lightPrimary'
              borderRadius='8px'
              key={key}
              disabled={formState?.loading}
              onClick={(e) => handleOpenPluginDetails(e, selectedIntegration?.plugin)}
            >
              {t(key?.replace(/ /g, '_'), capitalize(key?.replace(/_/g, ' ')))}
            </Button>
          ))}
          <Button
            color='lightPrimary'
            borderRadius='8px'
            disabled={formState?.loading}
            onClick={() => setOpenIntegrationLogs(true)}
          >
            {t('LOGS', 'Logs')}
          </Button>
        </div>

        {setupStatus && <p>{t('SETUP_STATUS', 'Setup status')}: {setupStatus}</p>}
        <IntegrationContainer>
          <IntegrationActions noMargin>
            <FormControl>
              <Label>{t('EXTERNAL_ID', 'External ID')}</Label>
              <Input
                disabled={!fromSalesChannels}
                type='text'
                value={externalId}
                placeholder={t('EXTERNAL_ID', 'External ID')}
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
              <SyncButtonsContainer>
                <MenuStatusWrapper
                  onClick={() => handleActionSelect('sync_business')}
                >
                  <RadioButton
                    active={selectedAction === 'sync_business'}
                  >
                    {selectedAction === 'sync_business' ? <RecordCircleFill /> : <Circle />}
                  </RadioButton>
                  <span>{t('SYNC_BUSINESS', 'Sync business')}</span>
                </MenuStatusWrapper>
                <MenuStatusWrapper
                  onClick={() => handleActionSelect(fromSalesChannels ? 'push_menu' : 'sync_menu')}
                >
                  <RadioButton
                    active={selectedAction === (fromSalesChannels ? 'push_menu' : 'sync_menu')}
                  >
                    {selectedAction === (fromSalesChannels ? 'push_menu' : 'sync_menu') ? <RecordCircleFill /> : <Circle />}
                  </RadioButton>
                  <span>{fromSalesChannels ? t('PUSH_MENU', 'Push menu') : t('SYNC_MENU', 'Sync menu')}</span>
                </MenuStatusWrapper>
              </SyncButtonsContainer>

              <StickyButtons>
                <div className='save-button'>
                  <Button
                    color='primary'
                    borderRadius='8px'
                    disabled={!selectedAction || formState?.loading}
                    onClick={handleSaveAction}
                  >
                    {t('SAVE', 'Save')}
                  </Button>
                </div>
              </StickyButtons>
            </IntegrationContainer>

          </>
        )}
      </BusinessOrderingChannelsContainer>
      <Alert
        title={t('EXTENSION', 'Extension')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
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
