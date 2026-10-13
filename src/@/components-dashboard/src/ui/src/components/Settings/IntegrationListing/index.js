import React, { useState, useEffect } from 'react'
import HubspotForm from 'react-hubspot-form'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useLocation, useHistory } from 'react-router-dom'
import { List as MenuIcon, PuzzleFill, Display, KeyFill, ChevronRight, Robot } from 'react-bootstrap-icons'
import { useLanguage, useSession } from '../../../../../index'
import { MCP_ALLOWED_LEVELS } from '../../../../../components/McpTokens'
import { Button, IconButton } from '../../../styles'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { SideBar, Modal } from '../../Shared'
import { PluginList } from '../PluginList'
import { WebhookList } from '../WebhookList'
import { ApiKeysList } from '../ApiKeysList'
import { McpTokens } from '../McpTokens'
import { DoordashConnect } from '../DoordashConnect'
import { useTheme } from 'styled-components'
import { LalaMoveConnect } from '../LalaMoveConnect'
import { Deliverect } from '../Deliverect'
import { ItsaCheckmate } from '../ItsaCheckmate'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { buildSettingsPath } from '../../../../../utils/settingsRedirects'
import { PickerExpress } from '../PickerExpress'
import { PaymentGateway } from './PaymentGateway'
import { Analytics } from './Analytics'
import {
  IntegrationsContainer,
  Header,
  SettingItemContainer,
  IconWrapper,
  SettingItemContent,
  CategorySection,
  CategorGroup,
  SettingList,
  SpecialPartnerWrapper,
  CloseButtonWrapper,
  HubspotFormWrapper,
  TabWrapper,
  Tabs,
  Tab
} from './styles'

export const IntegrationListing = (props) => {
  const {
    avoidExpand
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const { pathname, search } = useLocation()
  const query = new URLSearchParams(search)
  const theme = useTheme()
  const { width } = useWindowSize()
  const history = useHistory()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [showOption, setShowOption] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [selectedTab, setSelectedTab] = useState(2)

  const deliveryPlatformList = [
    { key: 'doordash', title: t('CONNECT_WITH_DOORDASH', 'Connect with Doordash'), icon: <img src={theme.images.general.doordash} />, description: t('CONNECT_DOORDASH_DESCRIPTION', 'Send orders directly to your driver in Doordash and keep customers happy with their deliveries.') },
    { key: 'lalamove', title: t('CONNECT_WITH_LALAMOVE', 'Connect with Lalamove'), icon: <img src={theme.images.general.lalamove} />, description: t('CONNECT_LALAMOVE_DESCRIPTION', 'Send orders directly to your drivers in LalaMove and keep customers happy with their deliveries.') },
    { key: 'picker_express', title: t('CONNECT_WITH_PICKER_EXPRESS', 'Connect with Picker Express'), icon: <img src={theme.images.general.pickerExpress} />, description: t('CONNECT_PICKER_EXPRESS_DESCRIPTION', 'Picker express connect you with +200 hundred thousand driver from +10 delivery companies from your city.') }
  ]

  const orderingDevelopers = [
    { key: 'plugins', title: t('PLUGINS', 'Plugins'), icon: <PuzzleFill />, description: t('PLUGIN_DESCRIPTION', 'This functionality serves to extend the Ordering API functionalities to anything you want without any restriction.') },
    { key: 'webhooks', title: t('WEBHOOKS', 'Webhooks'), icon: <Display />, description: t('WEBHOOK_DESCRIPTION', 'Unlike business webhooks, global webhooks listen to the events of the entire project.') },
    { key: 'apiKeys', title: t('KEYS', 'Api Keys'), icon: <KeyFill />, description: t('APIKEYS_DESCRIPTION', 'These keys serve to obtain a direct connection to the API without the need for authentication.') },
    MCP_ALLOWED_LEVELS.includes(user?.level) && { key: 'mcpTokens', title: t('MCP_TITLE', 'MCP (Claude Code & Codex)'), icon: <Robot />, description: t('MCP_TILE_DESCRIPTION', 'Connect Claude Code or Codex to this project with your own MCP key.') }
  ].filter(Boolean)

  const tabList = [
    { key: 2, name: t('ORDERING_DEVELOPERS', 'Ordering developers'), enabled: true },
    { key: 3, name: t('DELIVERY_PLATFORM', 'Delivery Platform'), enabled: false },
    { key: 4, name: t('POS_INTEGRATIONS', 'POS Integrations'), enabled: false },
    { key: 5, name: t('PAYMENT_GETWAYS', 'Payment Gateways'), enabled: false },
    { key: 6, name: t('ANALYTICS', 'Analytics'), enabled: false }
  ]

  const tabListLength = tabList.filter(tab => tab.enabled).length

  const settingId = query.get('id')

  const onBasicSettingsRedirect = ({ id }, isInitialRender) => {
    if (avoidExpand) {
      const next = buildSettingsPath({
        group: query.get('group') || 'developers',
        category: 'developers',
        id: id || undefined,
        q: query.get('q') || undefined
      })
      if (`${pathname}${search}` !== next) {
        history.replace(next)
      }
      return
    }
    const params = id ? `?category=developers&id=${id}` : '?category=developers'
    if (!id) {
      history.replace(`${pathname}${params}`)
      return
    }
    if (id && !isInitialRender) {
      history.replace(`${pathname}${params}`)
    }
  }

  const handleOpenSetting = (id) => {
    onBasicSettingsRedirect({ id })
    setShowOption(id)
  }

  const handleCloseSettings = () => {
    onBasicSettingsRedirect({ id: null })
    setShowOption(null)
  }

  useEffect(() => {
    setShowOption(settingId || null)
  }, [settingId])

  const FormLoading = () => {
    return (
      <div>
        <div>
          <Skeleton height={20} width={300} style={{ marginBottom: 20 }} />
        </div>
        {[...Array(4).keys()].map(key => (
          <React.Fragment key={key}>
            <Skeleton height={15} width={300} style={{ marginBottom: 10 }} />
            <Skeleton height={35} style={{ marginBottom: 30 }} />
          </React.Fragment>
        ))}
      </div>
    )
  }

  const renderSettingItem = (item, key) => (
    <SettingItemContainer
      key={key}
      $stack={avoidExpand}
      onClick={() => handleOpenSetting(item.key)}
    >
      <IconWrapper $compact={avoidExpand}>
        {item?.icon}
      </IconWrapper>
      <SettingItemContent $stack={avoidExpand}>
        <h5>{item?.title}</h5>
        <p>{item?.description}</p>
      </SettingItemContent>
      {avoidExpand && <ChevronRight />}
    </SettingItemContainer>
  )

  return (
    <>
      <IntegrationsContainer $embedded={avoidExpand}>
        {!avoidExpand && (
          <Header>
            {isCollapse && (
              <IconButton
                color='black'
                onClick={() => handleMenuCollapse(false)}
              >
                <MenuIcon />
              </IconButton>
            )}
            <h1>{t('DEVELOPERS', 'Developers')}</h1>
          </Header>
        )}
        {width > 768 && tabList?.filter((tab) => tab.enabled).length > 1 && (
          <TabWrapper>
            <Tabs>
              {tabList.map(tab => (
                tab.enabled && (
                  <Tab
                    key={tab.key}
                    active={tab.key === selectedTab}
                    onClick={() => setSelectedTab(tab.key)}
                  >
                    {tab.name}
                  </Tab>
                )
              ))}
            </Tabs>
          </TabWrapper>
        )}
        <CategorGroup $embedded={avoidExpand}>
          <CategorySection style={{ order: selectedTab === 2 ? 1 : selectedTab }}>
            {!avoidExpand && (
              <h2>{t('ORDERING_DEVELOPERS', 'Ordering developers')}</h2>
            )}
            <SettingList $stack={avoidExpand}>
              {orderingDevelopers.map((item, i) => renderSettingItem(item, i))}
            </SettingList>
          </CategorySection>
          {tabListLength > 1 && (
            <>
              <CategorySection style={{ order: selectedTab === 3 ? 1 : selectedTab }}>
                <h2>{t('DELIVERY_PLATFORM', 'Delivery Platform')}</h2>
                <SpecialPartnerWrapper>
                  <Button
                    color='primary'
                    onClick={() => setShowForm(true)}
                  >
                    {t('LOOKING_FOR_SPECIFIC_PARTNER', 'Looking for a specific partner?')}
                  </Button>
                </SpecialPartnerWrapper>
                <SettingList $stack={avoidExpand}>
                  {deliveryPlatformList.map((item, i) => renderSettingItem(item, i))}
                </SettingList>
              </CategorySection>
              <CategorySection style={{ order: selectedTab === 4 ? 1 : selectedTab }}>
                <h2>{t('POS_INTEGRATIONS', 'POS Integrations')}</h2>
                <SettingList $stack={avoidExpand}>
                  {renderSettingItem({
                    key: 'deliverect',
                    title: t('DELIVERECT', 'Deliverect'),
                    icon: <img src={theme.images.general.deliverect} />,
                    description: t('SYNC_DEC_FIRST', 'The easiest way to manage all your online orders.')
                  }, 'deliverect')}
                  {renderSettingItem({
                    key: 'itsacheckmate',
                    title: t('ITSACHECKMATE', 'ItsaCheckmate'),
                    icon: <img src={theme.images.general.ItsaCheckmateLogo} />,
                    description: t('ITSACHECKMATE_SUB_HEADER', 'Take control of all your Ordering Platform Menus in one place!')
                  }, 'itsacheckmate')}
                </SettingList>
              </CategorySection>
              <div style={{ order: selectedTab === 5 ? 1 : selectedTab }}>
                <PaymentGateway
                  showOption={showOption}
                  setShowOption={setShowOption}
                  handleCloseSettings={handleCloseSettings}
                  handleOpenBasicSetting={handleOpenSetting}
                />
              </div>
              <div style={{ order: selectedTab === 6 ? 1 : selectedTab }}>
                <Analytics
                  showOption={showOption}
                  setShowOption={setShowOption}
                />
              </div>
            </>
          )}
        </CategorGroup>
      </IntegrationsContainer>

      {showOption === 'plugins' && (
        <SideBar
          sidebarId='plugins-integrations'
          defaultSideBarWidth={600}
          open={showOption === 'plugins'}
          onClose={() => handleCloseSettings()}
          showExpandIcon
        >
          <PluginList />
        </SideBar>
      )}

      {showOption === 'webhooks' && (
        <SideBar
          sidebarId='webhooks-integrations'
          defaultSideBarWidth={768}
          open={showOption === 'webhooks'}
          onClose={() => handleCloseSettings()}
          showExpandIcon
        >
          <WebhookList />
        </SideBar>
      )}

      {showOption === 'apiKeys' && (
        <SideBar
          sidebarId='apikeys-integrations'
          defaultSideBarWidth={700}
          open={showOption === 'apiKeys'}
          onClose={() => handleCloseSettings()}
          showExpandIcon
        >
          <ApiKeysList />
        </SideBar>
      )}

      {showOption === 'mcpTokens' && (
        <SideBar
          sidebarId='mcp-tokens-integrations'
          defaultSideBarWidth={760}
          open={showOption === 'mcpTokens'}
          onClose={() => handleCloseSettings()}
          showExpandIcon
        >
          <McpTokens />
        </SideBar>
      )}

      {showOption === 'doordash' && <DoordashConnect onClose={() => handleCloseSettings()} />}

      {showOption === 'lalamove' && <LalaMoveConnect onClose={() => handleCloseSettings()} />}

      {showOption === 'picker_express' && <PickerExpress onClose={() => handleCloseSettings()} />}

      {showOption === 'deliverect' && <Deliverect onClose={() => handleCloseSettings()} />}

      {showOption === 'itsacheckmate' && <ItsaCheckmate onClose={() => handleCloseSettings()} />}

      {showForm && (
        <Modal
          width='769px'
          padding='30px'
          title={t('LOOKING_FOR_SPECIFIC_PARTNER', 'Looking for a specific partner?')}
          open={showForm}
          onClose={() => {
            setIsSubmitted(false)
            setShowForm(false)
          }}
        >
          <HubspotFormWrapper>
            <HubspotForm
              region='na1'
              portalId='6130635'
              formId='cb51d3cb-f9ed-4162-9479-d4cf164c391d'
              onFormSubmitted={() => setIsSubmitted(true)}
              loading={<FormLoading />}
            />
            {isSubmitted && (
              <CloseButtonWrapper>
                <Button
                  color='primary'
                  onClick={() => {
                    setIsSubmitted(false)
                    setShowForm(false)
                  }}
                >
                  {t('CLOSE', 'Close')}
                </Button>
              </CloseButtonWrapper>
            )}
          </HubspotFormWrapper>
        </Modal>
      )}
    </>
  )
}
