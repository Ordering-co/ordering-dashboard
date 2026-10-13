import React, { useEffect, useContext, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LogoutButton } from '../LogoutButton'
import {
  ListCheck,
  HouseDoor,
  PersonFill,
  Cash,
  Shop as ShopIcon,
  Mortarboard as SchoolIcon,
  People as PeopleIcon,
  BarChartLine as BarChartLineIcon,
  Gear as GearIcon,
  StarFill,
  Truck,
  GraphUp,
  BoxArrowUpRight,
  BagCheck,
  BagPlus,
  X as CloseIcon,
  FileEarmarkTextFill as LogsIcon,
  InfoCircle,
  Lightbulb,
  Download,
  BoundingBox,
  Stars,
  Phone
} from 'react-bootstrap-icons'
import { Accordion, Image, Button, AccordionContext, useAccordionToggle } from 'react-bootstrap'
import { useTheme } from 'styled-components'
import { SidebarMenu as SidebarMenuController, useEvent, useLanguage, useSession, useConfig, useApi, useSite, useAssistantDock } from '../../../../index'
import { useWindowSize } from '../../hooks/useWindowSize'
import { useInfoShare } from '../../contexts/InfoShareContext'
import { useProjectState } from '../../contexts/ProjectContext'

import { LanguageSelector } from '../LanguageSelector'
import { CommandPaletteTrigger } from '../CommandPalette'
import { firstLetterCapital, getDashboardLogoUrl, getUserType } from '../../utils'
import { buildAiAgentsUrl } from '../../utils/aiAgentsUrl'
import { getEnabledProductApps, isMyProductsPath, isProductAppActive } from '../../../../utils/myProductsNav'
import { ASSISTANT_NAME, ASSISTANT_STAGE } from '../../../../contexts/AssistantContext/name'
import { getDashboardNavSections } from '../../../../utils/dashboardNavigation'
import { getPreferredSiteDestinations } from '../../utils/getPreferredSiteUrl'
import { useSourceCodeTranslator } from '../../../../components/SourceCodeDownloads/useSourceCodeTranslator'
import {
  SidebarContainer,
  SidebarInnerContainer,
  SidebarHeader,
  BurgerButton,
  SidebarMainContent,
  SidebarContent,
  UserInfo,
  MenuContainer,
  MenuContent,
  SubMenu,
  LanguageSelectorContainer,
  LogoWrapper,
  MobileMessage,
  AiBadge,
  StageBadge
} from './styles'

const SidebarMenuUI = (props) => {
  const { productsState, getBillingToken, billingUrl, setShowBillingPayment } = props

  const location = useLocation()
  const [events] = useEvent()
  const [languageState, apiTranslator] = useLanguage()
  const t = useSourceCodeTranslator(apiTranslator, languageState.language)
  const [sessionState] = useSession()
  const [{ sites, loading: sitesLoading }] = useSite()
  const [{ configs }] = useConfig()
  const theme = useTheme()
  const [ordering, { configurations }] = useApi()
  const [projectStatus] = useProjectState()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const windowSize = useWindowSize()
  const assistant = useAssistantDock()
  const isAssistantActive = assistant.isOpen && location.pathname !== '/assistant'

  const [showMessage, setShowMessage] = useState(false)
  const [authenticateCannyLink, setAuthenticateCannyLink] = useState('')
  const isEnabledWhiteLabelModule = configs?.white_label_module?.value
  const enabledProductApps = getEnabledProductApps(productsState.apps)
  const readOnlyBusinessOwner = getUserType('readOnlyBusinessOwner') || getUserType('viewOnlyBusinessOwner')
  const readOnlyDeliveryManager = getUserType('readOnlyDeliveryManager')
  const readOnlyAdmin = getUserType('readOnlyAdmin')
  const isCannyActivated = false

  // Same sections the command palette searches (utils/dashboardNavigation)
  const navSections = getDashboardNavSections({ t, user: sessionState?.user, configs, project: ordering?.project })
  const ordersSubMenus = navSections.orders.items
  const deliverySubmenus = navSections.delivery.items
  const storesSubMenus = navSections.stores.items
  const visibleConnectSubMenus = navSections.connect.items
  const usersSubMenus = navSections.users.items
  const myProductMenus = navSections.myProducts.items
  const businessIntelligenceSubMenus = navSections.intelligence.items
  const marketingSubmenus = navSections.marketing.items
  const logsSubMenus = navSections.logs.items

  const websiteDestinations = getPreferredSiteDestinations({
    sites,
    configurations,
    ordering,
    websiteProduct: projectStatus?.websiteProduct
  })

  const handleGoToPage = (e, data) => {
    e.preventDefault()
    if (windowSize.width < 768) {
      handleMenuCollapse(true)
    }
    events.emit('go_to_page', data)
  }

  useEffect(() => {
    if (windowSize.width < 1024) {
      handleMenuCollapse(true)
    }
  }, [windowSize.width])

  const handleClickBilling = async () => {
    const billingState = await getBillingToken()
    if (!billingState?.error && billingState?.result?.access_token) {
      window.location.assign(
        `${billingState?.result?.referer_url
          ? `https://${billingState?.result?.referer_url}`
          : billingUrl}?token=${billingState?.result?.access_token}`
      )
    }
  }

  useEffect(() => {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      setShowMessage(true)
    }
  }, [])

  useEffect(() => {
    if (window.Canny && isCannyActivated && sessionState?.user?.user_system_id) {
      const authenticateCallback = () => {
        const _authenticatedLink = window.Canny('authenticateCannyLink', 'orderingplus.canny.io')
        setAuthenticateCannyLink(`https://${_authenticatedLink}`)
      }
      window.Canny('identify', {
        appID: '66a7d2eae6f021c079288dc9',
        user: {
          email: sessionState?.user?.email,
          name: `${sessionState?.user?.name} ${sessionState?.user?.lastname}`,
          id: sessionState?.user?.user_system_id,
          avatarURL: sessionState?.user?.photo
        }
      }, authenticateCallback)
    }
  }, [sessionState?.user?.user_system_id, isCannyActivated])

  return (
    <>
      {showMessage && (
        <MobileMessage>
          <div>
            <CloseIcon onClick={() => setShowMessage(false)} />
            {t('FOR_THE_BEST_EXPERIENCE_WHILE_SETTING_UP', 'For the best experience while setting up your project, we recommend using a computer.')}
          </div>
        </MobileMessage>
      )}
      <SidebarContainer
        id='side_bar'
        isCollapse={isCollapse}
      >
        <SidebarInnerContainer
          className='d-flex flex-column'
        >
          <SidebarHeader>
            <LogoWrapper>
              <Image
                src={getDashboardLogoUrl(configs, theme?.images?.logos?.logotype)}
                onClick={(e) => handleGoToPage(e, { page: 'home' })}
              />
              <BurgerButton
                onClick={() => handleMenuCollapse(true)}
              >
                <svg viewBox='0 0 50 32'>
                  <path d='M49,4H19c-0.6,0-1-0.4-1-1s0.4-1,1-1h30c0.6,0,1,0.4,1,1S49.6,4,49,4z' />
                  <path d='M49,16H19c-0.6,0-1-0.4-1-1s0.4-1,1-1h30c0.6,0,1,0.4,1,1S49.6,16,49,16z' />
                  <path d='M49,28H19c-0.6,0-1-0.4-1-1s0.4-1,1-1h30c0.6,0,1,0.4,1,1S49.6,28,49,28z' />
                  <path d='M8.1,22.8c-0.3,0-0.5-0.1-0.7-0.3L0.7,15l6.7-7.8c0.4-0.4,1-0.5,1.4-0.1c0.4,0.4,0.5,1,0.1,1.4L3.3,15l5.5,6.2 c0.4,0.4,0.3,1-0.1,1.4C8.6,22.7,8.4,22.8,8.1,22.8z' />
                </svg>
              </BurgerButton>
            </LogoWrapper>
            <CommandPaletteTrigger />
          </SidebarHeader>
          <SidebarMainContent>
            <SidebarContent
              className='d-flex flex-column justify-content-between p-1 pt-0'
              data-testid='sidebar-scroll-content'
            >
              <div className='d-flex flex-column'>
                <Accordion>
                  {sessionState?.user?.level === 0 && (sitesLoading || !projectStatus?.websiteProduct || websiteDestinations.length > 0) && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='website'
                        disabled={sitesLoading || !projectStatus?.websiteProduct || websiteDestinations.length === 0}
                      >
                        <BoxArrowUpRight />
                        <span>{t('MY_WEBSITE', 'My Website')}</span>
                      </ContextAwareToggle>
                      <Accordion.Collapse eventKey='website'>
                        <MenuContent>
                          {websiteDestinations.map((destination) => (
                            <SubMenu
                              key={destination.key}
                              href={destination.url}
                              target='_blank'
                              rel='noopener noreferrer'
                            >
                              {destination.key === 'live'
                                ? t('LIVE_WEBSITE', 'Live website')
                                : t('TEMPORARY_WEBSITE', 'Temporary website')}
                            </SubMenu>
                          ))}
                        </MenuContent>
                      </Accordion.Collapse>
                    </MenuContainer>
                  )}
                  {/* {sessionState?.user?.level === 0 && (
                    <Button
                      className='d-flex align-items-center'
                      variant={false}
                      onClick={() => handleGoToLink(`https://apps.{configurations?.subdomain}.com/store/marketplace`)}
                    >
                      <BoxArrowUpRight />
                      <span>{t('MARKETPLACE', 'Marketplace')}</span>
                    </Button>
                  )} */}

                  {navSections.home.visible && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='0'
                        active={
                          location.pathname === '/home'
                        }
                        page='home'
                        role='link'
                        href='/home'
                        handleGoToPage={handleGoToPage}
                      >
                        <HouseDoor />
                        <span>{t('HOME', 'Home')}</span>
                      </ContextAwareToggle>
                    </MenuContainer>
                  )}

                  {navSections.orders.visible && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='1'
                        active={
                          location.pathname === '/orders' ||
                          location.pathname === '/cart-recovery/open-carts' ||
                          location.pathname === '/messages' ||
                          location.pathname === '/appointments' ||
                          (location.pathname === '/all-in-one' && (readOnlyAdmin || readOnlyDeliveryManager || readOnlyBusinessOwner)) ||
                          (location.pathname === '/deliveries' && (readOnlyAdmin || readOnlyDeliveryManager || readOnlyBusinessOwner)) ||
                          location.pathname === '/gift-cards'
                        }
                      >
                        <ListCheck />
                        <span>{t('ORDERS', 'Orders')}</span>
                      </ContextAwareToggle>
                      <Accordion.Collapse eventKey='1'>
                        <MenuContent>
                          {ordersSubMenus.map(item => (
                            item.enabled && (
                              <SubMenu
                                key={item.id}
                                active={location.pathname.includes(item.url)}
                                onClick={(e) => handleGoToPage(e, { page: item.pageName })}
                                href={item.url}
                                role='link'
                              >
                                {firstLetterCapital(item.title)}
                              </SubMenu>
                            )
                          ))}
                        </MenuContent>
                      </Accordion.Collapse>
                    </MenuContainer>
                  )}

                  {navSections.delivery.visible && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='2'
                        active={
                          location.pathname === '/delivery/drivers-list' ||
                          location.pathname === '/delivery/drivers-managers' ||
                          location.pathname === '/delivery/drivers-groups' ||
                          location.pathname === '/delivery/drivers-companies' ||
                          location.pathname === '/delivery/drivers-time-display' ||
                          location.pathname === '/all-in-one' ||
                          location.pathname === '/deliveries' ||
                          location.pathname === '/drivers-dashboard'
                        }
                      >
                        <Truck />
                        <span>{t('DELIVERY', 'Delivery')}</span>
                      </ContextAwareToggle>
                      <Accordion.Collapse eventKey='2'>
                        <MenuContent>
                          {deliverySubmenus.map(item => (
                            item.enabled && (
                              <SubMenu
                                key={item.id}
                                active={location.pathname.includes(item.pageName) || location.pathname.includes(item?.url)}
                                onClick={(e) => handleGoToPage(e, { page: item.pageName })}
                                href={item.url}
                                role='link'
                              >
                                {firstLetterCapital(item.title)}
                              </SubMenu>
                            )
                          ))}
                        </MenuContent>
                      </Accordion.Collapse>
                    </MenuContainer>
                  )}

                  {/* {(sessionState?.user?.level !== 5 && sessionState?.user?.level !== 8) && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='2'
                        page='messages'
                        handleGoToPage={handleGoToPage}
                        active={location.pathname === '/messages'}
                      >
                        <ChatIcon />
                        <span>{t('MESSAGES', 'Messages')}</span>
                      </ContextAwareToggle>
                    </MenuContainer>
                  )} */}

                  {navSections.stores.visible && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='3'
                        active={
                          location.pathname.includes('stores')
                        }
                      >
                        <ShopIcon />
                        <span>{t('STORES', 'Stores')}</span>
                      </ContextAwareToggle>
                      <Accordion.Collapse eventKey='3'>
                        <MenuContent>
                          {storesSubMenus.map(item => (
                            item.enabled && (
                              <SubMenu
                                key={item.id}
                                active={location.pathname.includes(item.url)}
                                onClick={(e) => handleGoToPage(e, { page: item.pageName })}
                                href={item.url}
                                role='link'
                              >
                                {item.title}
                              </SubMenu>
                            )
                          ))}
                        </MenuContent>
                      </Accordion.Collapse>
                    </MenuContainer>
                  )}

                  {navSections.connect.visible && (
                      <MenuContainer>
                        <ContextAwareToggle
                          eventKey='7'
                          active={
                            location.pathname.includes('connect')
                          }
                        >
                          <BoundingBox />
                          <span>{t('DASHBOARD_CONNECT', 'Connect')}</span>
                        </ContextAwareToggle>
                        <Accordion.Collapse eventKey='7'>
                          <MenuContent>
                            {visibleConnectSubMenus.map(item => (
                              item.enabled && (
                                <SubMenu
                                  key={item.id}
                                  active={location.pathname.includes(item.url)}
                                  onClick={(e) => handleGoToPage(e, { page: item.pageName })}
                                  href={item.url}
                                  role='link'
                                >
                                  {item.title}
                                </SubMenu>
                              )
                            ))}
                          </MenuContent>
                        </Accordion.Collapse>
                      </MenuContainer>
                  )}

                  {navSections.users.visible && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='4'
                        active={
                          location.pathname === '/users/customers' ||
                          location.pathname === '/users/business-owners' ||
                          location.pathname === '/users/callcenter-agents' ||
                          location.pathname === '/users/professionals' ||
                          location.pathname === '/users/managers'
                        }
                      >
                        <PeopleIcon />
                        <span>{t('USERS', 'Users')}</span>
                      </ContextAwareToggle>
                      <Accordion.Collapse eventKey='4'>
                        <MenuContent>
                          {usersSubMenus.map(item => (
                            item.enabled && (
                              <SubMenu
                                key={item.id}
                                active={location.pathname.includes(item.pageName) || location.pathname.includes(item.url)}
                                onClick={(e) => handleGoToPage(e, { page: item.pageName })}
                                href={item.url}
                                role='link'
                              >
                                {item.title}
                              </SubMenu>
                            )
                          ))}
                        </MenuContent>
                      </Accordion.Collapse>
                    </MenuContainer>
                  )}

                  {navSections.marketing.visible && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='6'
                        active={
                          location.pathname === '/marketing/promotions-enterprise' ||
                          location.pathname === '/marketing/campaign' ||
                          location.pathname === '/marketing/ad-banners' ||
                          location.pathname === '/cart-recovery/recovery-actions'
                        }
                      >
                        <GraphUp />
                        <span>{t('MARKETING', 'Marketing')}</span>
                      </ContextAwareToggle>
                      <Accordion.Collapse eventKey='6'>
                        <MenuContent>
                          {marketingSubmenus.map(item => (
                            item.enabled && (
                              <SubMenu
                                key={item.id}
                                active={location.pathname.includes(item.pageName) || location.pathname.includes(item?.url)}
                                onClick={(e) => handleGoToPage(e, { page: item.pageName })}
                                href={item.url}
                                role='link'
                              >
                                {firstLetterCapital(item.title)}
                              </SubMenu>
                            )
                          ))}
                        </MenuContent>
                      </Accordion.Collapse>
                    </MenuContainer>
                  )}

                  {navSections.intelligence.visible && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='5'
                        active={
                          location.pathname === '/intelligence/business' ||
                          location.pathname === '/intelligence/drivers' ||
                          location.pathname.includes('/intelligence/reviews') ||
                          location.pathname === '/intelligence/invoice' ||
                          location.pathname === '/intelligence/reports' ||
                          location.pathname === '/intelligence/business-payments'
                        }
                      >
                        <BarChartLineIcon />
                        <span>{firstLetterCapital(t('REPORTS', 'Reports'))}</span>
                      </ContextAwareToggle>
                      <Accordion.Collapse eventKey='5'>
                        <MenuContent>
                          {businessIntelligenceSubMenus.map(item => (
                            item.enabled && (
                              <SubMenu
                                key={item.id}
                                active={location.pathname.includes(item.pageName) || location.pathname === item?.url}
                                onClick={(e) => handleGoToPage(e, { page: item.pageName })}
                                href={item.url}
                                role='link'
                              >
                                {firstLetterCapital(item.title)}
                              </SubMenu>
                            )
                          ))}
                        </MenuContent>
                      </Accordion.Collapse>
                    </MenuContainer>
                  )}

                  {/* {sessionState?.user?.level === 0 && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='9'
                        active={
                          location.pathname === '/loyalty/rewards-programs' ||
                          location.pathname === '/loyalty/levels' ||
                          location.pathname === '/loyalty/reports'
                        }
                      >
                        <Award />
                        <span>{t('LOYALTY', 'Loyalty')}</span>
                      </ContextAwareToggle>
                      <Accordion.Collapse eventKey='9'>
                        <MenuContent>
                          {loyaltySubMenus.map(item => (
                            <SubMenu
                              key={item.id}
                              active={location.pathname.includes(item.url)}
                              onClick={() => handleGoToPage({ page: item.pageName })}
                            >
                              {firstLetterCapital(item.title)}
                            </SubMenu>
                          ))}
                        </MenuContent>
                      </Accordion.Collapse>
                    </MenuContainer>
                  )}

                  {sessionState?.user?.level === 0 && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='10'
                        active={
                          location.pathname === '/cart-recovery/open-carts' ||
                          location.pathname === '/cart-recovery/recovery-actions'
                        }
                      >
                        <Cart3 />
                        <span>{t('CART_RECOVERY', 'Cart recovery')}</span>
                      </ContextAwareToggle>
                      <Accordion.Collapse eventKey='10'>
                        <MenuContent>
                          {cartRecoveryMenus.map(item => (
                            <SubMenu
                              key={item.id}
                              active={location.pathname.includes(item.url)}
                              onClick={() => handleGoToPage({ page: item.pageName })}
                            >
                              {firstLetterCapital(item.title)}
                            </SubMenu>
                          ))}
                        </MenuContent>
                      </Accordion.Collapse>
                    </MenuContainer>
                  )} */}
                  {navSections.myProducts.visible && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='9'
                        active={isMyProductsPath(location.pathname)}
                      >
                        <BagCheck />
                        <span>{t('MY_PRODUCTS', 'My products')}</span>
                      </ContextAwareToggle>
                      <Accordion.Collapse eventKey='9'>
                        <MenuContent>
                          {myProductMenus.map(item => (
                            item.enabled && (
                              <SubMenu
                                key={item.id}
                                active={location.pathname === item.url || location.pathname.startsWith(item.url + '/')}
                                onClick={(e) => handleGoToPage(e, { page: item.pageName })}
                                href={item.url}
                                role='link'
                              >
                                {item.title}
                              </SubMenu>
                            )
                          ))}
                          {enabledProductApps.map(item => (
                            <SubMenu
                              key={item.id}
                              active={isProductAppActive({
                                app: item,
                                search: location.search,
                                state: location.state
                              })}
                              onClick={(e) => isProductAppActive({
                                app: item,
                                search: location.search,
                                state: location.state
                              })
                                ? e.preventDefault()
                                : handleGoToPage(e, { page: 'products', state: { productId: item.id, type: item.type } })
                              }
                              href={`/my-products?id=${item.id}`}
                            >
                              {item.title}
                            </SubMenu>
                          ))}
                        </MenuContent>
                      </Accordion.Collapse>
                    </MenuContainer>
                  )}
                  {navSections.builder.visible && (
                    <MenuContainer>
                      <ContextAwareToggle
                        eventKey='builder'
                        active={location.pathname === '/builder' || location.pathname.startsWith('/builder/')}
                        page='builder'
                        role='link'
                        href='/builder'
                        handleGoToPage={handleGoToPage}
                      >
                        <Phone />
                        <span>{t('BUILDER', 'Builder')}</span>
                        <AiBadge $active={location.pathname.startsWith('/builder')}>{t('NEW', 'New')}</AiBadge>
                      </ContextAwareToggle>
                    </MenuContainer>
                  )}
                </Accordion>
              </div>
              {([0, 2].includes(sessionState?.user?.level) || !(readOnlyAdmin || readOnlyDeliveryManager || readOnlyBusinessOwner)) && (
                <div className='d-flex flex-column mt-4'>
                  {!(readOnlyAdmin || readOnlyDeliveryManager || readOnlyBusinessOwner) && (
                    <>
                      {navSections.schools.visible && (
                        <Button
                          active={location.pathname.includes('schools')}
                          className='d-flex align-items-center'
                          variant={location.pathname.includes('schools') ? 'primary' : false}
                          onClick={(e) => handleGoToPage(e, { page: 'schools' })}
                          href='/schools'
                          role='link'
                        >
                          <SchoolIcon />
                          <span>{t('SCHOOLS', 'Schools')}</span>
                        </Button>
                      )}
                      <LanguageSelectorContainer>
                        <LanguageSelector />
                      </LanguageSelectorContainer>
                      {/* {sessionState?.user?.level === 0 && (
                        <Button
                          className='d-flex align-items-center'
                          variant={location.pathname === '/ordering-products' && 'primary'}
                          onClick={() => handleGoToPage({ page: 'ordering_products' })}
                        >
                          <WindowDock />
                          <span>{t('ORDERING_PRODUCTS', 'Ordering products')}</span>
                        </Button>
                      )} */}
                      {/* {sessionState?.user?.level === 0 && (
                        <Button
                          className='d-flex align-items-center'
                          variant={location.pathname === '/support' && 'primary'}
                          onClick={() => handleGoToPage({ page: 'support' })}
                        >
                          <HeadsetIcon />
                          <span>{t('SUPPORT', 'Support')}</span>
                        </Button>
                      )} */}
                      {sessionState?.user?.level === 0 && sessionState?.user?.user_system_id && (
                        <Button
                          className='d-flex align-items-center'
                          variant={false}
                          onClick={() => handleClickBilling()}
                        >
                          <Cash />
                          <span>{t('BILLING', 'Billing')}</span>
                        </Button>
                      )}
                    </>
                  )}
                  {sessionState?.user?.level === 0 && (
                    <Button
                      className='d-flex align-items-center'
                      variant={location.pathname === '/free-downloads' && 'primary'}
                      onClick={(e) => handleGoToPage(e, { page: 'free_products' })}
                      href='/free-downloads'
                      role='link'
                    >
                      <Download />
                      <span>{t('FREE_DOWNLOADS', 'Free downloads')}</span>
                    </Button>
                  )}
                  {[0, 2].includes(sessionState?.user?.level) && (
                    <Button
                      as={Link}
                      to='/open-source-code'
                      className='d-flex align-items-center'
                      variant={location.pathname === '/open-source-code' ? 'primary' : false}
                      aria-current={location.pathname === '/open-source-code' ? 'page' : undefined}
                      onClick={() => { if (windowSize.width < 768) handleMenuCollapse(true) }}
                    >
                      <Download aria-hidden='true' />
                      <span>{t('SOURCE_CODE_TITLE', 'Open Source Code')}</span>
                    </Button>
                  )}
                  {!(readOnlyAdmin || readOnlyDeliveryManager || readOnlyBusinessOwner) && (
                    <>
                      {sessionState?.user?.level === 0 && sessionState?.user?.user_system_id && (
                        <Button
                          className='d-flex align-items-center'
                          variant={false}
                          onClick={(e) => handleGoToPage(e, { page: 'purchase_addons' })}
                          href='/purchase_addons'
                          role='link'
                        >
                          <BagPlus />
                          <span>{t('APPS_AND_ADDONS', 'Apps & Addons')}</span>
                        </Button>
                      )}
                      {sessionState?.user?.level === 0 && sessionState?.user?.user_system_id && projectStatus?.plan?.upgrade_plan_id && (
                        <Button
                          className='d-flex align-items-center upgrade-to-pro-button'
                          variant={false}
                          onClick={() => setShowBillingPayment((prevState) => ({ ...prevState, open: true, from: 'upgrade_pro' }))}
                        >
                          <StarFill />
                          <span>{t('UPGRADE_TO_PRO', 'Upgrade to Pro')}</span>
                        </Button>
                      )}
                      {sessionState?.user?.level === 0 && (
                        <Button
                          active={location.pathname === '/settings'}
                          className='d-flex align-items-center'
                          variant={location.pathname === '/settings' ? 'primary' : false}
                          onClick={(e) => handleGoToPage(e, { page: 'settings' })}
                          href='/settings'
                          role='link'
                        >
                          <GearIcon />
                          <span>{t('SETTINGS', 'Settings')}</span>
                        </Button>
                      )}
                      {navSections.logs.visible && (
                        <Accordion data-testid='logs-audit-menu'>
                          <MenuContainer>
                            <ContextAwareToggle
                              eventKey='11'
                              active={
                                location.pathname === '/settings/logs'
                              }
                            >
                              <LogsIcon />
                              <span>{t('LOGS_AUDIT', 'Logs Audit')}</span>
                            </ContextAwareToggle>
                            <Accordion.Collapse eventKey='11'>
                              <MenuContent>
                                {logsSubMenus.map(item => (
                                  item.enabled && (
                                    <SubMenu
                                      key={item.id}
                                      active={location.pathname.includes(item.url)}
                                      onClick={(e) => handleGoToPage(e, { page: item.pageName })}
                                      href={item.url}
                                      role='link'
                                    >
                                      {firstLetterCapital(item.title)}
                                    </SubMenu>
                                  )
                                ))}
                              </MenuContent>
                            </Accordion.Collapse>
                          </MenuContainer>
                        </Accordion>
                      )}
                      {sessionState?.user?.level === 0 && (
                        <Button
                          className='d-flex align-items-center'
                          variant={false}
                          href='https://tally.so/r/WO4pdJ'
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          <Lightbulb aria-hidden />
                          <span>{t('SHARE_IDEAS', 'Share ideas')}</span>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </SidebarContent>
            <UserInfo
              id='user_info'
              className='d-flex flex-column px-1'
            >
              <Button
                className='d-000flex align-items-center'
                variant={location.pathname === '/profile' && 'primary'}
                onClick={(e) => handleGoToPage(e, { page: 'profile' })}
                role='link'
                href='/profile'
              >
                {sessionState?.user?.photo
                  ? (
                    <Image src={sessionState?.user?.photo} width='30px' height='30px' roundedCircle />
                    )
                  : (
                    <PersonFill />
                    )}
                <span>{sessionState?.user?.name} {sessionState?.user?.lastname}</span>
              </Button>
              {assistant.isAvailable && (
                <Button
                  className='d-000flex align-items-center sidebar-footer-link'
                  variant={isAssistantActive ? 'primary' : ''}
                  onClick={() => assistant.setOpen(prev => !prev)}
                  aria-pressed={assistant.isOpen}
                  aria-keyshortcuts='Meta+J Control+J'
                  title={`${ASSISTANT_NAME} (⌘J / Ctrl+J)`}
                >
                  <Stars size={20} />
                  <span>
                    {ASSISTANT_NAME}
                  </span>
                  <AiBadge $active={isAssistantActive} aria-hidden='true'>AI</AiBadge>
                  <StageBadge $active={isAssistantActive} aria-hidden='true'>{ASSISTANT_STAGE}</StageBadge>
                </Button>
              )}
              {sessionState?.user?.level === 0 && (
                <Button
                  className='d-000flex align-items-center sidebar-footer-link ai-agents-sidebar-button'
                  variant=''
                  onClick={() => {
                    const url = buildAiAgentsUrl({
                      accessToken: sessionState?.token,
                      project: ordering?.project
                    })
                    if (!url) return
                    window.open(url, '_blank', 'noopener,noreferrer')
                  }}
                >
                  <StarFill size={20} />
                  <span>
                    {t('AI_AGENTS', 'AI Agents')}
                  </span>
                </Button>
              )}
              {!(sessionState?.user?.level === 2 && isEnabledWhiteLabelModule) && (
                <Button
                  className='d-000flex align-items-center sidebar-footer-link'
                  variant=''
                  href='https://docs.ordering.co'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <InfoCircle size={20} />
                  <span>
                    {t('HELP', 'Help')}
                  </span>
                </Button>
              )}
              {sessionState?.user?.level === 0 && sessionState?.user?.user_system_id && !!authenticateCannyLink && (
                <Button
                  className='d-000flex align-items-center'
                  variant=''
                  role='link'
                  href={authenticateCannyLink}
                  data-canny-link
                  target='_blank noopener'
                >
                  <span>
                    {t('REQUEST_FEATURES', 'Request Features')}
                  </span>
                </Button>
              )}
              <LogoutButton />
            </UserInfo>
          </SidebarMainContent>
        </SidebarInnerContainer>
      </SidebarContainer>
    </>
  )
}

const ContextAwareToggle = ({ children, eventKey, callback, page, handleGoToPage, active, href, disabled }) => {
  const currentEventKey = useContext(AccordionContext)
  const decoratedOnClick = useAccordionToggle(
    eventKey,
    () => callback && callback(eventKey)
  )
  const isCurrentEventKey = currentEventKey === eventKey

  const handleButtonClick = (e) => {
    e.preventDefault()
    if (disabled) return
    if (page) {
      handleGoToPage(e, { page })
    }
    decoratedOnClick()
  }
  return (
    <Button
      variant={active
        ? 'primary'
        : isCurrentEventKey && 'light'}
      onClick={handleButtonClick}
      href={href}
      disabled={disabled}
    >
      {children}
    </Button>
  )
}

export const SidebarMenu = (props) => {
  const sidebarMenu = {
    ...props,
    UIComponent: SidebarMenuUI
  }
  return <SidebarMenuController {...sidebarMenu} />
}
