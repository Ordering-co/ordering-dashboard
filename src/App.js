import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Switch,
  Route,
  Link,
  Redirect,
  useLocation,
  useHistory
} from 'react-router-dom'
import {
  useSession,
  useLanguage,
  useConfig,
  // GoogleTagManager,
  useEvent,
  useApi,
  useSite,
  ASSISTANT_ALLOWED_LEVELS
} from '~components'

import {
  NotNetworkConnectivity,
  useOnlineStatus,
  useWindowSize,
  useProjectState,
  SidebarMenu,
  Layout,
  Banners,
  BannerStack,
  WebsocketConnectionBanner,
  TrialExtensionProvider,
  TrialExtensionBanner,
  TrialExtensionModal,
  AppBootLoader,
  resolveBootDensity,
  resolveBootVariant,
  ProtectedRoute,
  QueryLogin,
  Modal,
  BillingPaymentOptions,
  getConnectAllowedLevels,
  getConnectVisualAccess,
  useTheme,
  getUserType,
  SCHOOLS_ALLOWED_LEVELS,
  AssistantPanel,
  CommandPalette,
  CommandPaletteProvider,
  CommandPaletteRouteBoundary,
  DashboardDestinationsProvider
} from '~ui'

import { PageNotFound } from './pages/PageNotFound'
import { Assistant } from './pages/Assistant'
import { Home } from './pages/Home'
import { Settings } from './pages/Settings'
import { SettingsLegacyRedirect } from './pages/Settings/LegacyRedirect'
import { Login } from './pages/Login'
import { ForgotPassword } from './pages/ForgotPassword'
import { OrdersList } from './pages/OrdersList'
import { DeliveriesManager } from './pages/DeliveriesManager'
import { DriversList } from './pages/DriversList'
import { AllInOne } from './pages/AllInOne'
import { CustomersList } from './pages/CustomersList'
import { BusinessOwnersList } from './pages/BusinessOwnersList'
import { CallcenterAgentsList } from './pages/CallcenterAgentsList'
import { ManagersList } from './pages/ManagersList'
import { BusinessesList } from './pages/BusinessesList'
import { BrandManager } from './pages/BrandManager'
import { BusinessProductsList } from './pages/BusinessProductsList'
import { BusinessAnalytics } from './pages/BusinessAnalytics'
import { MessagesList } from './pages/MessagesList'
import { DriverAnalytics } from './pages/DriverAnalytics'
import { DriverStoreStatus } from './pages/DriverStoreStatus'
import { InvoiceManager } from './pages/InvoiceManager'
import { ReviewsList } from './pages/ReviewsList'
import { DeliveryDriversList } from './pages/DeliveryDriversList'
import { DriversManagersList } from './pages/DriversManagersList'
import { DriversCompaniesList } from './pages/DriversCompaniesList'
import { DriversGroupsList } from './pages/DriversGroupsList'
import { Support } from './pages/Support'
import { AdvancedReports } from './pages/AdvancedReports'
import { EnterprisePromotionList } from './pages/EnterprisePromotionList'
import { CampaignListing } from './pages/CampaignListing'
import { OpenCarts } from './pages/OpenCarts'
import { RecoveryActionListing } from './pages/RecoveryActionListing'
import { OrderingProducts } from './pages/OrderingProducts'
import { Professionals } from './pages/Professionals'
import { Appointments } from './pages/Appointments'
import { Schools } from './pages/Schools'
import { Builder } from './pages/Builder'
import { BuilderProduct } from './pages/BuilderProduct'
import { GiftCardsList } from './pages/GiftCardsList'
import { Markups } from './pages/Markups'
import { ResetPassword } from './pages/ResetPassword'
import { Profile } from './pages/Profile'
import { OrderingWebsite } from './pages/OrderingWebsite'
import { FranchisesWebsite } from './pages/FranchisesWebsite'
import { Dashboard } from './pages/Dashboard'
import { ProductsBuilderList } from './pages/ProductsList'
import { BusinessAdd } from './pages/BusinessAdd'
import { AdBannersList } from './pages/AdBannersList'
import { BusinessDevicesList } from './pages/BusinessDevicesList'
import { ConnectOverview } from './pages/ConnectOverview'
import { DeliveryServices } from './pages/DeliveryServices'
import { Importers } from './pages/Importers'
import { PosMenu } from './pages/PosMenu'
import { SalesChannels } from './pages/SalesChannels'

import { ScrollToTop } from './components/ScrollToTop'
import { ListenPageChanges } from './components/ListenPageChanges'
import { HelmetTags } from './components/HelmetTags'
import { StoreOnboardingGate } from './components/StoreOnboardingGate'
import { IntercomWrapper } from './components/IntercomWrapper'
import settings from './config'
import { firebasePushSetup, getFirebaseWebConfig, isFirebasePushEnabled, getOpenedPushOrderUuid } from './utils/firebaseWebPush'
import { getDashboardFaviconUrl } from './utils/dashboardBranding'
import { useDashboardBootReveal } from './utils/useDashboardBootReveal'
import { SettingsLogs } from './pages/SettingsLogs'
import { PurchaseAddons } from './pages/PurchaseAddons'
import { FreeProductsList } from './pages/FreeProductsList'
import { OpenSourceCode } from './pages/OpenSourceCode'
import { DriversTimeDisplay } from './pages/DriverTimeDisplay'
import { EcommerceReports } from './pages/EcommerceReports'
import { BusinessPaymentReports } from './pages/BusinessPaymentReports'
import { DocsConnection, docsConnectMode } from '~components/components/DocsConnection'
import { isBuilderProject } from '~components/utils/dashboardFeatureAccess'
import { DocsConnectionConsent } from '~ui/src/components/DocsConnectionConsent'

/**
 * docs.ordering.co connection popup (`/login?docs_connect=<nonce>`): a focused,
 * OAuth-style page instead of the Dashboard shell. No sidebar, home, chat,
 * assistant, push prompts or billing modals; the bridge in DocsConnection is
 * unchanged.
 */
const DocsConnectApp = () => {
  const [{ auth, loading }] = useSession()
  const [{ configs, loading: configLoading }] = useConfig()
  const [theme, { update }] = useTheme()
  const [, t] = useLanguage()
  const [notificationState, setNotificationState] = useState({
    notification_app: settings.notification_app
  })
  const loaded = useDashboardBootReveal({
    sessionLoading: loading,
    configLoading,
    configs,
    theme,
    update
  })

  return (
    <>
      <HelmetTags page='login' />
      <DocsConnection
        UIComponent={DocsConnectionConsent}
        loaded={loaded}
        purpose={docsConnectMode.purpose}
        signInElement={(
          <Login
            useLoginByEmail
            notice={t('DOCS_CONNECT_SIGN_IN_NOTICE', 'Sign in to connect to docs.ordering.co')}
            elementLinkToForgotPassword={<a href='/password/forgot' target='_blank' rel='noopener noreferrer'>{t('RESET_PASSWORD', 'Reset password')}</a>}
            notificationState={notificationState}
            setNotificationState={setNotificationState}
          />
        )}
      />
      {!loaded && (
        <AppBootLoader
          variant={resolveBootVariant(auth)}
          density={resolveBootDensity(auth)}
        />
      )}
    </>
  )
}

export const App = () => docsConnectMode.active ? <DocsConnectApp /> : <DashboardApp />

const DashboardApp = () => {
  const history = useHistory()
  const [events] = useEvent()
  const [{ auth, loading, user, token }] = useSession()
  const [projectStatus] = useProjectState()
  const [{ configs, loading: configLoading }] = useConfig()
  const [ordering] = useApi()
  const [{ sites, loading: siteLoading }] = useSite()
  const [theme, { update }] = useTheme()
  const [isShowBillingPayment, setShowBillingPayment] = useState({ open: false, from: '', showInformation: false })

  const loaded = useDashboardBootReveal({
    sessionLoading: loading,
    configLoading,
    configs,
    theme,
    update
  })

  const [oneSignalState, setOneSignalState] = useState({
    notification_app: settings.notification_app
  })
  const firebasePushSetupRef = useRef(false)

  const [, t] = useLanguage()
  const onlineStatus = useOnlineStatus()

  const franchiseSites = useMemo(() => sites?.filter(site => site?.type === 'franchiseweb') ?? [], [sites])
  const readOnlyBusinessOwner = getUserType('readOnlyBusinessOwner') || getUserType('viewOnlyBusinessOwner')
  const readOnlyDeliveryManager = getUserType('readOnlyDeliveryManager')
  const readOnlyAdmin = getUserType('readOnlyAdmin')

  const isPastDue = projectStatus.project?.current_status === 'past_due'
  const showBanner = auth && isPastDue && user?.user_system_id && !projectStatus.loading && !configLoading && !loading && !isShowBillingPayment?.open
  const {
    showConnectTab,
    connectDeliveryServices: deliveryServices,
    connectPosMenuSync,
    connectImporters,
    connectSalesChannels
  } = getConnectVisualAccess({ configs })

  const { height } = useWindowSize()
  const { search } = useLocation()
  let queryProject
  let queryToken
  if (search) {
    const query = new URLSearchParams(search)
    queryProject = query.get('project')
    queryToken = query.get('token')
  }

  useEffect(() => {
    if (height) {
      const vh = height * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }
  }, [height])

  const oneSignalSetup = () => {
    if (import.meta.env.DEV || ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) return
    const oneSignalId = configs?.onesignal_default_enabled?.value === '1' ? configs?.onesignal_default_dashboardweb_id?.value : configs?.onesignal_dashboardweb_id?.value
    if (!oneSignalId) {
      setOneSignalState({
        notification_app: settings.notification_app
      })
      return
    }
    const OneSignal = window.OneSignal || []
    const initConfig = {
      appId: oneSignalId,
      // allowLocalhostAsSecureOrigin: true,
      notificationClickHandlerAction: 'navigate'
    }

    OneSignal.push(function () {
      OneSignal.SERVICE_WORKER_PARAM = { scope: '/push/onesignal/' }
      OneSignal.SERVICE_WORKER_PATH = 'push/onesignal/OneSignalSDKWorker.js'
      OneSignal.SERVICE_WORKER_UPDATER_PATH = 'push/onesignal/OneSignalSDKWorker.js'
      if (!OneSignal._initCalled) {
        OneSignal.init(initConfig)
      }

      if (typeof OneSignal.getNotificationPermission === 'function' && typeof OneSignal.registerForPushNotifications === 'function') {
        OneSignal.getNotificationPermission().then((permission) => {
          if (permission === 'default') {
            OneSignal.registerForPushNotifications()
          }
        })
      }

      const onNotificationClicked = function (data) {
        if (data?.data?.order_uuid) {
          history.push(`/orders?id=${data?.data?.order_uuid}`)
        }
      }
      const handler = function (data) {
        onNotificationClicked(data)
        if (typeof OneSignal.addListenerForNotificationOpened === 'function') {
          OneSignal.addListenerForNotificationOpened(handler)
        }
      }
      if (typeof OneSignal.addListenerForNotificationOpened === 'function') {
        OneSignal.addListenerForNotificationOpened(handler)
      }

      OneSignal.on('subscriptionChange', function (isSubscribed) {
        if (isSubscribed) {
          OneSignal.getUserId((userId) => {
            const data = {
              ...oneSignalState,
              notification_token: userId
            }
            setOneSignalState(data)
          })
        }
      })

      OneSignal.getUserId((userId) => {
        const data = {
          ...oneSignalState,
          notification_token: userId
        }
        setOneSignalState(data)
      })
    })
  }

  const firebaseWebPushSetup = () => {
    if (firebasePushSetupRef.current) return
    firebasePushSetupRef.current = true
    firebasePushSetup({
      config: getFirebaseWebConfig(configs),
      onToken: (fcmToken) => {
        setOneSignalState({
          ...oneSignalState,
          notification_token: fcmToken,
          notification_provider: 'fcm'
        })
      },
      onNotificationClick: (data) => {
        const orderUuid = getOpenedPushOrderUuid(data)
        if (orderUuid) {
          history.push(`/orders?id=${orderUuid}`)
        }
      }
    }).catch((error) => {
      firebasePushSetupRef.current = false
      console.log('Firebase push setup error:', error)
    })
  }

  useEffect(() => {
    if (configLoading) return
    if (isFirebasePushEnabled(configs)) {
      firebaseWebPushSetup()
      return
    }
    oneSignalSetup()
  }, [configLoading, events])

  useEffect(() => {
    if (!showBanner) return
    setShowBillingPayment((prevState) => ({ ...prevState, open: true, from: 'past_due' }))
  }, [configLoading, loading, projectStatus.loading])

  useEffect(() => {
    const updateNotificationToken = async () => {
      try {
        const body = {
          token: oneSignalState.notification_token,
          user_id: user?.id,
          app: settings.notification_app,
          ...(oneSignalState.notification_provider
            ? { provider: oneSignalState.notification_provider }
            : {})
        }
        await fetch(`${ordering.root}/users/${user?.id}/notification_tokens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(body)
        })
      } catch (err) {
      }
    }
    if (auth && !oneSignalState.subscribed && oneSignalState.notification_token && loaded) {
      updateNotificationToken()
    }
  }, [auth, oneSignalState.subscribed, oneSignalState.notification_token, loaded])

  useEffect(() => {
    const faviconHref = getDashboardFaviconUrl(configs)

    let favicon = document.getElementById('favicon')
    if (!favicon) {
      favicon = document.createElement('link')
      favicon.id = 'favicon'
      favicon.rel = 'icon'
      favicon.type = 'image/png'
      document.head.appendChild(favicon)
    }

    if (favicon.getAttribute('href') !== faviconHref) {
      favicon.setAttribute('href', faviconHref)
    }
  }, [configs?.dashboard_favicon?.value])

  return (
    <TrialExtensionProvider config={settings?.trial_extension} isWhiteLabel={settings?.is_white_label}>
      <ListenPageChanges />
      {
        !loaded && (
          <AppBootLoader
            variant={resolveBootVariant(auth)}
            density={resolveBootDensity(auth)}
          />
        )
      }
      {
        loaded && (
          <StoreOnboardingGate><IntercomWrapper>
            <CommandPaletteProvider enabled={!!auth}>
            <DashboardDestinationsProvider>
            <NotNetworkConnectivity />
            {/* <GoogleTagManager tagId={configs?.google_tag_manager?.value ?? settings?.google_tag_manager} /> */}
            {(showBanner || auth) && (
              <BannerStack>
                {showBanner && (
                  <Banners setShowBillingPayment={setShowBillingPayment} />
                )}
                {auth && <WebsocketConnectionBanner />}
              </BannerStack>
            )}
            {/* In normal flow (not in the sticky BannerStack) so it never covers a modal. */}
            {auth && <TrialExtensionBanner />}
            <Layout>
              {auth && (
                <SidebarMenu billingUrl={settings?.billing_url} setShowBillingPayment={setShowBillingPayment} />
              )}
              {onlineStatus && (
                <ScrollToTop>
                  <HelmetTags />
                  <CommandPaletteRouteBoundary>
                  <Switch>
                    <Route exact path='/'>
                      {
                        auth
                          ? ((user?.level !== 5 && user?.level !== 8) && !(readOnlyAdmin || readOnlyDeliveryManager || readOnlyBusinessOwner))
                              ? <Redirect to='/home' />
                              : user?.level === 8 ? <Redirect to='/profile' /> : <Redirect to='/orders' />
                          : (queryProject && queryToken)
                              ? <QueryLogin project={queryProject} token={queryToken} />
                              : <Redirect to='/login' />
                      }
                    </Route>

                    <Route exact path='/login'>
                      {
                        !auth
                          ? (
                            <Login
                              useLoginByEmail
                              elementLinkToForgotPassword={<Link to='/password/forgot'>{t('RESET_PASSWORD', 'Reset password')}</Link>}
                              notificationState={oneSignalState}
                              setNotificationState={setOneSignalState}
                            />
                            )
                          : (
                            <Redirect to='/home' />
                            )
                      }
                    </Route>

                    <Route exact path='/password/forgot'>
                      {
                        !auth
                          ? (
                            <ForgotPassword
                              elementLinkToLogin={<Link to='/login'>{t('SIGN_IN', 'Sign in')}</Link>}
                            />
                            )
                          : <Redirect to='/home' />
                      }
                    </Route>

                    <Route exact path='/password/reset'>
                      {auth
                        ? (
                          <Redirect to='/' />
                          )
                        : (
                          <ResetPassword
                            elementLinkToLogin={<Link to='/login'>{t('SIGN_IN', 'Sign in')}</Link>}
                          />
                          )}
                    </Route>

                    <Route exact path='/reset_password'>
                      {auth
                        ? (
                          <Redirect to='/' />
                          )
                        : (
                          <ResetPassword
                            elementLinkToLogin={<Link to='/login'>{t('SIGN_IN', 'Sign in')}</Link>}
                          />
                          )}
                    </Route>

                    <Route exact path='/onboarding/store'><Redirect to='/home' /></Route>
                    <Route exact path='/home'>
                      {
                        auth
                          ? ((user?.level !== 5 && user?.level !== 8) && !(readOnlyAdmin || readOnlyDeliveryManager || readOnlyBusinessOwner))
                              ? <Home />
                              : user?.level === 8 ? <Redirect to='/profile' /> : <Redirect to='/orders' />
                          : <Redirect to='/login' />
                      }
                    </Route>

                    <ProtectedRoute path='/orders' allowedLevels={[0, 2, 5]}>
                      <OrdersList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/deliveries' allowedLevels={[0, 2, 5]}>
                      <DeliveriesManager />
                    </ProtectedRoute>
                    <ProtectedRoute path='/drivers-dashboard' allowedLevels={[0, 5]}>
                      <DriversList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/driver-store-status' allowedLevels={[0, 5]}>
                      <DriverStoreStatus />
                    </ProtectedRoute>
                    <ProtectedRoute path='/all-in-one' allowedLevels={[0, 2, 5]}>
                      <AllInOne />
                    </ProtectedRoute>
                    <ProtectedRoute path='/appointments' allowedLevels={[0, 2]}>
                      <Appointments />
                    </ProtectedRoute>

                    <ProtectedRoute path='/schools' allowedLevels={SCHOOLS_ALLOWED_LEVELS}>
                      <Schools />
                    </ProtectedRoute>

                    <ProtectedRoute path='/messages' allowedLevels={[0, 2]}>
                      <MessagesList />
                    </ProtectedRoute>

                    <ProtectedRoute path='/stores/list' allowedLevels={[0, 2]}>
                      <BusinessesList setShowBillingPayment={setShowBillingPayment} />
                    </ProtectedRoute>
                    <ProtectedRoute path='/stores/products/:store?' allowedLevels={[0, 2]}>
                      <BusinessProductsList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/stores/brand' allowedLevels={[0]}>
                      <BrandManager />
                    </ProtectedRoute>
                    <ProtectedRoute path='/stores/devices' allowedLevels={[0]}>
                      <BusinessDevicesList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/stores/add' allowedLevels={[0, 2]}>
                      <BusinessAdd setShowBillingPayment={setShowBillingPayment} />
                    </ProtectedRoute>

                    <ProtectedRoute path='/connect/overview' allowedLevels={getConnectAllowedLevels('connect_overview')}>
                      {showConnectTab ? <ConnectOverview /> : <Redirect to='/home' />}
                    </ProtectedRoute>
                    <ProtectedRoute path='/connect/delivery-services' allowedLevels={getConnectAllowedLevels('delivery_services')}>
                      {deliveryServices ? <DeliveryServices /> : <Redirect to='/home' />}
                    </ProtectedRoute>
                    <ProtectedRoute path='/connect/importers' allowedLevels={getConnectAllowedLevels('importers')}>
                      {connectImporters ? <Importers /> : <Redirect to='/home' />}
                    </ProtectedRoute>
                    <ProtectedRoute path='/connect/pos-menu' allowedLevels={getConnectAllowedLevels('pos_menu')}>
                      {connectPosMenuSync ? <PosMenu /> : <Redirect to='/home' />}
                    </ProtectedRoute>
                    <ProtectedRoute path='/connect/sales-channels' allowedLevels={getConnectAllowedLevels('sales_channels')}>
                      {connectSalesChannels ? <SalesChannels /> : <Redirect to='/home' />}
                    </ProtectedRoute>

                    <ProtectedRoute path='/users/customers' allowedLevels={[0]}>
                      <CustomersList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/users/business-owners' allowedLevels={[0]}>
                      <BusinessOwnersList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/users/callcenter-agents' allowedLevels={[0]}>
                      <CallcenterAgentsList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/users/admins' allowedLevels={[0]}>
                      <ManagersList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/users/professionals' allowedLevels={[0, 2, 5]}>
                      <Professionals />
                    </ProtectedRoute>

                    <ProtectedRoute path='/intelligence/business' allowedLevels={[0, 2]}>
                      <BusinessAnalytics />
                    </ProtectedRoute>
                    <ProtectedRoute path='/intelligence/drivers' allowedLevels={[0]}>
                      <DriverAnalytics />
                    </ProtectedRoute>
                    <ProtectedRoute path='/intelligence/invoice' allowedLevels={[0]}>
                      <InvoiceManager />
                    </ProtectedRoute>
                    <ProtectedRoute path='/intelligence/reviews' allowedLevels={[0]}>
                      <ReviewsList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/intelligence/reports' allowedLevels={[0]}>
                      <AdvancedReports />
                    </ProtectedRoute>
                    <ProtectedRoute path='/intelligence/ecommerce_reports' allowedLevels={[0]}>
                      <EcommerceReports />
                    </ProtectedRoute>
                    <ProtectedRoute path='/intelligence/business-payments' allowedLevels={[0, 2]}>
                      <BusinessPaymentReports />
                    </ProtectedRoute>
                    <ProtectedRoute path='/delivery/drivers-list' allowedLevels={[0, 5, 2]}>
                      <DeliveryDriversList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/delivery/drivers-managers' allowedLevels={[0]}>
                      <DriversManagersList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/delivery/drivers-companies' allowedLevels={[0]}>
                      <DriversCompaniesList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/delivery/drivers-groups' allowedLevels={[0, 5]}>
                      <DriversGroupsList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/delivery/drivers-time-display' allowedLevels={[0, 5]}>
                      <DriversTimeDisplay />
                    </ProtectedRoute>

                    <ProtectedRoute path='/marketing/promotions-enterprise' allowedLevels={[0]}>
                      <EnterprisePromotionList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/marketing/campaign' allowedLevels={[0]}>
                      <CampaignListing />
                    </ProtectedRoute>
                    <ProtectedRoute path='/marketing/ad-banners' allowedLevels={[0]}>
                      <AdBannersList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/stores/markups' allowedLevels={[0]}>
                      <Markups />
                    </ProtectedRoute>
                    <ProtectedRoute path='/loyalty/rewards-programs' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/loyalty/rewards-programs' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/gift-cards' allowedLevels={[0]}>
                      <GiftCardsList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/loyalty/wallets-refunds' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/loyalty/wallets-refunds' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/gift-cards-settings' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/gift-cards-settings' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/catering' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/catering' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/multi-business-checkout' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/multi-business-checkout' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/stripe-connect' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/stripe-connect' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/reservations' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/reservations' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/cart-recovery/open-carts' allowedLevels={[0]}>
                      <OpenCarts />
                    </ProtectedRoute>
                    <ProtectedRoute path='/cart-recovery/recovery-actions' allowedLevels={[0]}>
                      <RecoveryActionListing />
                    </ProtectedRoute>

                    <ProtectedRoute path='/my-products/ordering-website' allowedLevels={[0]}>
                      <OrderingWebsite />
                    </ProtectedRoute>

                    {(!!configs?.web_marketplace_26?.value || configLoading || siteLoading) && (
                      <ProtectedRoute path='/my-products/ordering-website-2' allowedLevels={[0]}>
                        <OrderingWebsite
                          pageName='ordering_website_2'
                          appId='web_marketplace_26'
                          type='web_marketplace_26'
                        />
                      </ProtectedRoute>
                    )}
                    {(configs?.web_franchises_x?.value || configLoading || siteLoading || franchiseSites?.length > 1) && (
                      <ProtectedRoute path='/my-products/franchises-website' allowedLevels={[0]}>
                        <FranchisesWebsite />
                      </ProtectedRoute>
                    )}

                    {(configs?.web_dashboard_x?.value || configLoading) && (
                      <ProtectedRoute path='/my-products/dashboard' allowedLevels={[0]}>
                        <Dashboard />
                      </ProtectedRoute>
                    )}

                    <ProtectedRoute path='/my-products' allowedLevels={[0]}>
                      <ProductsBuilderList />
                    </ProtectedRoute>

                    {isBuilderProject(ordering?.project) && (
                      <ProtectedRoute path='/builder/:productId' allowedLevels={[0]}>
                        <BuilderProduct />
                      </ProtectedRoute>
                    )}
                    {isBuilderProject(ordering?.project) && (
                      <ProtectedRoute path='/builder' allowedLevels={[0]}>
                        <Builder />
                      </ProtectedRoute>
                    )}

                    <ProtectedRoute exact path='/settings' allowedLevels={[0]}>
                      <Settings />
                    </ProtectedRoute>
                    <ProtectedRoute path='/all-settings' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/all-settings' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/settings/basic' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/settings/basic' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/settings/standard' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/settings/standard' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/settings/operation' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/settings/operation' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/settings/pro' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/settings/pro' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/settings/plugin' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/settings/plugin' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/settings/pages' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/settings/pages' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/settings/places' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/settings/places' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/settings/integrations' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/settings/integrations' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/settings/language' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/settings/language' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/settings/logs' allowedLevels={[0]}>
                      <SettingsLogs />
                    </ProtectedRoute>
                    <ProtectedRoute path='/settings/enterprise' allowedLevels={[0]}>
                      <SettingsLegacyRedirect from='/settings/enterprise' />
                    </ProtectedRoute>
                    <ProtectedRoute path='/open-source-code' allowedLevels={[0]}>
                      <OpenSourceCode />
                    </ProtectedRoute>
                    <ProtectedRoute path='/free-downloads' allowedLevels={[0]}>
                      <FreeProductsList />
                    </ProtectedRoute>
                    <ProtectedRoute path='/purchase/addons' allowedLevels={[0]}>
                      <PurchaseAddons />
                    </ProtectedRoute>
                    <ProtectedRoute path='/support' allowedLevels={[0]}>
                      <Support />
                    </ProtectedRoute>

                    <ProtectedRoute path='/ordering-products' allowedLevels={[0]}>
                      <OrderingProducts />
                    </ProtectedRoute>

                    <ProtectedRoute path='/profile' allowedLevels={[0, 2, 5, 8]}>
                      <Profile />
                    </ProtectedRoute>

                    <ProtectedRoute path='/assistant' allowedLevels={ASSISTANT_ALLOWED_LEVELS}>
                      <Assistant />
                    </ProtectedRoute>

                    <Route path='*'>
                      <PageNotFound />
                    </Route>
                  </Switch>
                  </CommandPaletteRouteBoundary>
                </ScrollToTop>
              )}
            </Layout>
            {auth && <AssistantPanel />}
            {isShowBillingPayment?.open && !projectStatus.loading && (
              <Modal
                width='55%'
                padding='30px'
                title={t('PAYMENTS', 'Payments')}
                open={isShowBillingPayment?.open}
                onClose={() => setShowBillingPayment((prevState) => ({ ...prevState, open: false, from: '' }))}
              >
                <BillingPaymentOptions
                  isUpgradeToPro={isShowBillingPayment?.from === 'upgrade_pro'}
                  setShowBillingPayment={setShowBillingPayment}
                  upgradeProPlanId={[projectStatus?.plan?.upgrade_plan_id]}
                  showPlanInformation={isShowBillingPayment?.showInformation}
                />
              </Modal>
            )}
            {auth && <TrialExtensionModal />}
            {auth && <CommandPalette />}
            </DashboardDestinationsProvider>
            </CommandPaletteProvider>
          </IntercomWrapper></StoreOnboardingGate>
        )
      }
    </TrialExtensionProvider>
  )
}
