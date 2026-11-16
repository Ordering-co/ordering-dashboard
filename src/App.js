import React, { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react'
import styled from 'styled-components'
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

// by file, not from the ~ui index, so the entry stylesheet carries only the shell's CSS (see src/index.js).
import { NotNetworkConnectivity } from '~ui/src/components/NotNetworkConnectivity'
import { useOnlineStatus } from '~ui/src/hooks/useOnlineStatus'
import { useWindowSize } from '~ui/src/hooks/useWindowSize'
import { useProjectState } from '~ui/src/contexts/ProjectContext'
import { SidebarMenu } from '~ui/src/components/SidebarMenu'
import { Layout } from '~ui/src/components/Layout'
import { Banners, BannerStack, LegacyDashboardNotice, PhoneNotice } from '~ui/src/components/Banners'
import { WebsocketConnectionBanner } from '~ui/src/components/WebsocketConnectionBanner'
import { TrialExtensionProvider } from '~ui/src/contexts/TrialExtensionContext'
import { TrialExtensionBanner, TrialExtensionModal } from '~ui/src/components/TrialExtension'
import { UpgradeOfferProvider } from '~ui/src/contexts/UpgradeOfferContext'
import { UpgradeOfferModal } from '~ui/src/components/Billing/UpgradeOfferModal'
import { AppBootLoader, resolveBootDensity, resolveBootVariant } from '~ui/src/components/Shared/AppBootLoader'
import { ProtectedRoute } from '~ui/src/components/Shared/ProtectedRoute'
import { ChunkErrorBoundary } from '~ui/src/components/Shared/ChunkErrorBoundary'
import { QueryLogin } from '~ui/src/components/Login/QueryLogin'
import { BillingPaymentOptions } from '~ui/src/components/Billing'
import { getConnectAllowedLevels, getConnectVisualAccess, SCHOOLS_ALLOWED_LEVELS } from '~ui/src/utils'
import { useTheme } from '~ui/src/contexts/ThemeContext'
import { AssistantPanel } from '~ui/src/components/Assistant'
import { LegacyPlanUpgradeProvider } from '~ui/src/contexts/LegacyPlanUpgradeContext'
import { CommandPalette } from '~ui/src/components/CommandPalette'
import { CommandPaletteProvider, CommandPaletteRouteBoundary } from '~ui/src/contexts/CommandPaletteContext'
import { DashboardDestinationsProvider } from '~ui/src/contexts/DashboardDestinationsContext'

import { getDashboardStartPath, isHiddenByReadOnly } from '~components/utils/dashboardNavigation'
import { getEcommerceReportsRedirectPath } from '~components/utils/ecommerceReports'
import { ScrollToTop } from './components/ScrollToTop'
import { ShellMain } from './components/ShellMain'
import { OfflineRouteGate, useRoutesLocation } from './components/OfflineRouteGate'
import { ListenPageChanges } from './components/ListenPageChanges'
import { HelmetTags } from './components/HelmetTags'
import { StoreOnboardingGate } from './components/StoreOnboardingGate'
import { RegisterStoresGate } from './components/RegisterStoresGate'
import { IntercomWrapper } from './components/IntercomWrapper'
import settings from './config'
import { firebasePushSetup, getFirebaseWebConfig, isFirebasePushEnabled, getOpenedPushOrderUuid } from './utils/firebaseWebPush'
import { getDashboardFaviconUrl } from './utils/dashboardBranding'
import { useDashboardBootReveal } from './utils/useDashboardBootReveal'
import { lazyWithReload } from './utils/chunkReload'
import { DocsConnection, docsConnectMode } from '~components/components/DocsConnection'
import { DocsConnectionConsent } from '~ui/src/components/DocsConnectionConsent'
import { BillingResultNotice } from '~ui/src/components/Billing/BillingResultNotice' // redesign BM-C (M-BM5)
import { peekBillingResult } from '~ui/src/components/Billing/BillingPaymentOptions/billingModel' // redesign BM-C (M-BM20)

// redesign W0-10b (T0-41, decision 33): every page is its own chunk, loaded when its route is first visited. The shell (Layout,
// SidebarMenu, ProtectedRoute, providers, command palette, banners) stays static. One Suspense around the routes paints the boot
// skeleton while a chunk is on its way. Written as `const X = lazy(() => lazyWithReload(() => import('./pages/…')).then(m => ({ default: m.X })))`: the
// residue scan (scripts/redesign/residue-scan.mjs) reads that shape to map each route to its page.
const PageNotFound = lazy(() => lazyWithReload(() => import('./pages/PageNotFound')).then(m => ({ default: m.PageNotFound })))
const Assistant = lazy(() => lazyWithReload(() => import('./pages/Assistant')).then(m => ({ default: m.Assistant })))
const Home = lazy(() => lazyWithReload(() => import('./pages/Home')).then(m => ({ default: m.Home })))
const Settings = lazy(() => lazyWithReload(() => import('./pages/Settings')).then(m => ({ default: m.Settings })))
const SettingsLegacyRedirect = lazy(() => lazyWithReload(() => import('./pages/Settings/LegacyRedirect')).then(m => ({ default: m.SettingsLegacyRedirect })))
const Login = lazy(() => lazyWithReload(() => import('./pages/Login')).then(m => ({ default: m.Login })))
const ForgotPassword = lazy(() => lazyWithReload(() => import('./pages/ForgotPassword')).then(m => ({ default: m.ForgotPassword })))
const OrdersList = lazy(() => lazyWithReload(() => import('./pages/OrdersList')).then(m => ({ default: m.OrdersList })))
const DeliveriesManager = lazy(() => lazyWithReload(() => import('./pages/DeliveriesManager')).then(m => ({ default: m.DeliveriesManager })))
const DriversList = lazy(() => lazyWithReload(() => import('./pages/DriversList')).then(m => ({ default: m.DriversList })))
const AllInOne = lazy(() => lazyWithReload(() => import('./pages/AllInOne')).then(m => ({ default: m.AllInOne })))
const CustomersList = lazy(() => lazyWithReload(() => import('./pages/CustomersList')).then(m => ({ default: m.CustomersList })))
const BusinessOwnersList = lazy(() => lazyWithReload(() => import('./pages/BusinessOwnersList')).then(m => ({ default: m.BusinessOwnersList })))
const CallcenterAgentsList = lazy(() => lazyWithReload(() => import('./pages/CallcenterAgentsList')).then(m => ({ default: m.CallcenterAgentsList })))
const ManagersList = lazy(() => lazyWithReload(() => import('./pages/ManagersList')).then(m => ({ default: m.ManagersList })))
const BusinessesList = lazy(() => lazyWithReload(() => import('./pages/BusinessesList')).then(m => ({ default: m.BusinessesList })))
const BrandManager = lazy(() => lazyWithReload(() => import('./pages/BrandManager')).then(m => ({ default: m.BrandManager })))
const BusinessProductsList = lazy(() => lazyWithReload(() => import('./pages/BusinessProductsList')).then(m => ({ default: m.BusinessProductsList })))
const BusinessAnalytics = lazy(() => lazyWithReload(() => import('./pages/BusinessAnalytics')).then(m => ({ default: m.BusinessAnalytics })))
const MessagesList = lazy(() => lazyWithReload(() => import('./pages/MessagesList')).then(m => ({ default: m.MessagesList })))
const DriverAnalytics = lazy(() => lazyWithReload(() => import('./pages/DriverAnalytics')).then(m => ({ default: m.DriverAnalytics })))
const DriverStoreStatus = lazy(() => lazyWithReload(() => import('./pages/DriverStoreStatus')).then(m => ({ default: m.DriverStoreStatus })))
const InvoiceManager = lazy(() => lazyWithReload(() => import('./pages/InvoiceManager')).then(m => ({ default: m.InvoiceManager })))
const ReviewsList = lazy(() => lazyWithReload(() => import('./pages/ReviewsList')).then(m => ({ default: m.ReviewsList })))
const DeliveryDriversList = lazy(() => lazyWithReload(() => import('./pages/DeliveryDriversList')).then(m => ({ default: m.DeliveryDriversList })))
const DriversManagersList = lazy(() => lazyWithReload(() => import('./pages/DriversManagersList')).then(m => ({ default: m.DriversManagersList })))
const DriversCompaniesList = lazy(() => lazyWithReload(() => import('./pages/DriversCompaniesList')).then(m => ({ default: m.DriversCompaniesList })))
const DriversGroupsList = lazy(() => lazyWithReload(() => import('./pages/DriversGroupsList')).then(m => ({ default: m.DriversGroupsList })))
const Support = lazy(() => lazyWithReload(() => import('./pages/Support')).then(m => ({ default: m.Support })))
const AdvancedReports = lazy(() => lazyWithReload(() => import('./pages/AdvancedReports')).then(m => ({ default: m.AdvancedReports })))
const EnterprisePromotionList = lazy(() => lazyWithReload(() => import('./pages/EnterprisePromotionList')).then(m => ({ default: m.EnterprisePromotionList })))
const CampaignListing = lazy(() => lazyWithReload(() => import('./pages/CampaignListing')).then(m => ({ default: m.CampaignListing })))
const OpenCarts = lazy(() => lazyWithReload(() => import('./pages/OpenCarts')).then(m => ({ default: m.OpenCarts })))
const RecoveryActionListing = lazy(() => lazyWithReload(() => import('./pages/RecoveryActionListing')).then(m => ({ default: m.RecoveryActionListing })))
const OrderingProducts = lazy(() => lazyWithReload(() => import('./pages/OrderingProducts')).then(m => ({ default: m.OrderingProducts })))
const Professionals = lazy(() => lazyWithReload(() => import('./pages/Professionals')).then(m => ({ default: m.Professionals })))
const Appointments = lazy(() => lazyWithReload(() => import('./pages/Appointments')).then(m => ({ default: m.Appointments })))
const Schools = lazy(() => lazyWithReload(() => import('./pages/Schools')).then(m => ({ default: m.Schools })))
const Builder = lazy(() => lazyWithReload(() => import('./pages/Builder')).then(m => ({ default: m.Builder })))
const BuilderProduct = lazy(() => lazyWithReload(() => import('./pages/BuilderProduct')).then(m => ({ default: m.BuilderProduct })))
const GiftCardsList = lazy(() => lazyWithReload(() => import('./pages/GiftCardsList')).then(m => ({ default: m.GiftCardsList })))
const Markups = lazy(() => lazyWithReload(() => import('./pages/Markups')).then(m => ({ default: m.Markups })))
const ResetPassword = lazy(() => lazyWithReload(() => import('./pages/ResetPassword')).then(m => ({ default: m.ResetPassword })))
const Profile = lazy(() => lazyWithReload(() => import('./pages/Profile')).then(m => ({ default: m.Profile })))
const OrderingWebsite = lazy(() => lazyWithReload(() => import('./pages/OrderingWebsite')).then(m => ({ default: m.OrderingWebsite })))
const FranchisesWebsite = lazy(() => lazyWithReload(() => import('./pages/FranchisesWebsite')).then(m => ({ default: m.FranchisesWebsite })))
const Dashboard = lazy(() => lazyWithReload(() => import('./pages/Dashboard')).then(m => ({ default: m.Dashboard })))
const ProductsBuilderList = lazy(() => lazyWithReload(() => import('./pages/ProductsList')).then(m => ({ default: m.ProductsBuilderList })))
const BusinessAdd = lazy(() => lazyWithReload(() => import('./pages/BusinessAdd')).then(m => ({ default: m.BusinessAdd })))
const AdBannersList = lazy(() => lazyWithReload(() => import('./pages/AdBannersList')).then(m => ({ default: m.AdBannersList })))
const BusinessDevicesList = lazy(() => lazyWithReload(() => import('./pages/BusinessDevicesList')).then(m => ({ default: m.BusinessDevicesList })))
const DeliveryServices = lazy(() => lazyWithReload(() => import('./pages/DeliveryServices')).then(m => ({ default: m.DeliveryServices })))
const Importers = lazy(() => lazyWithReload(() => import('./pages/Importers')).then(m => ({ default: m.Importers })))
const PosMenu = lazy(() => lazyWithReload(() => import('./pages/PosMenu')).then(m => ({ default: m.PosMenu })))
const SalesChannels = lazy(() => lazyWithReload(() => import('./pages/SalesChannels')).then(m => ({ default: m.SalesChannels })))
const WhatsAppBots = lazy(() => lazyWithReload(() => import('./pages/WhatsAppBots')).then(m => ({ default: m.WhatsAppBots })))
const OrderWithGoogle = lazy(() => lazyWithReload(() => import('./pages/OrderWithGoogle')).then(m => ({ default: m.OrderWithGoogle })))
const SettingsLogs = lazy(() => lazyWithReload(() => import('./pages/SettingsLogs')).then(m => ({ default: m.SettingsLogs })))
const FreeProductsList = lazy(() => lazyWithReload(() => import('./pages/FreeProductsList')).then(m => ({ default: m.FreeProductsList })))
const OpenSourceCode = lazy(() => lazyWithReload(() => import('./pages/OpenSourceCode')).then(m => ({ default: m.OpenSourceCode })))
const DriversTimeDisplay = lazy(() => lazyWithReload(() => import('./pages/DriverTimeDisplay')).then(m => ({ default: m.DriversTimeDisplay })))
const BusinessPaymentReports = lazy(() => lazyWithReload(() => import('./pages/BusinessPaymentReports')).then(m => ({ default: m.BusinessPaymentReports })))

// The boot skeleton, resolved from the path being opened (Home's or the shell's), so the screen does not change while the chunk loads.
// The real SidebarMenu is already on screen around the routes, so the skeleton is asked for no sidebar column (`shell={false}`):
// the content area is the boot's content area, and the sidebar is not drawn twice. Without a session the boot is the sign-in splash.
const RouteFallbackFrame = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`

const RouteFallback = ({ auth }) => {
  const { pathname } = useLocation()
  return (
    <RouteFallbackFrame>
      <AppBootLoader
        variant={resolveBootVariant(auth)}
        density={resolveBootDensity(auth)}
        route={pathname}
        shell={false}
      />
    </RouteFallbackFrame>
  )
}

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
          // redesign W0-PB1-03 (T0-50): Login is a lazy page drawn outside the routes, so it brings its own boundary and boot skeleton.
          <ChunkErrorBoundary>
            <Suspense
              fallback={(
                <AppBootLoader
                  variant={resolveBootVariant(auth)}
                  density={resolveBootDensity(auth)}
                />
              )}
            >
              <Login
                useLoginByEmail
                notice={t('DOCS_CONNECT_SIGN_IN_NOTICE', 'Sign in to connect to docs.ordering.co')}
                elementLinkToForgotPassword={<a href='/password/forgot' target='_blank' rel='noopener noreferrer'>{t('RESET_PASSWORD', 'Reset password')}</a>}
                notificationState={notificationState}
                setNotificationState={setNotificationState}
              />
            </Suspense>
          </ChunkErrorBoundary>
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
  // offline the routes keep the last location they had with the network (no page chunk is fetched without it)
  const routesLocation = useRoutesLocation(onlineStatus)

  const franchiseSites = useMemo(() => sites?.filter(site => site?.type === 'franchiseweb') ?? [], [sites])

  // (#76b): where `/` and `/home` send this user (one answer, so the two routes cannot send it in a loop)
  const startPath = getDashboardStartPath(user)

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

  // redesign BM-C (M-BM20): a page that reloaded because a payment went through does not open the payment again by itself while the
  // account still reads past due (the shell notice stays on screen). Read once at start: BillingResultNotice takes the mark later.
  const [reloadedAfterPayment] = useState(() => peekBillingResult() === 'paid')
  useEffect(() => {
    if (!showBanner || reloadedAfterPayment) return
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
    {/* (sidebar follow-up): one shared fetch for the sidebar card and the modal below. */}
    <UpgradeOfferProvider>
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
          <StoreOnboardingGate><IntercomWrapper><LegacyPlanUpgradeProvider>
            <CommandPaletteProvider enabled={!!auth}>
            <DashboardDestinationsProvider>
            {/* <GoogleTagManager tagId={configs?.google_tag_manager?.value ?? settings?.google_tag_manager} /> */}
            {(showBanner || auth) && (
              <BannerStack>
                {showBanner && (
                  <Banners setShowBillingPayment={setShowBillingPayment} />
                )}
                {auth && <WebsocketConnectionBanner />}
                {auth && <PhoneNotice />}
                {auth && <LegacyDashboardNotice config={settings?.legacy_dashboard} />}
              </BannerStack>
            )}
            {/* In normal flow (not in the sticky BannerStack) so it never covers a modal. */}
            {auth && <TrialExtensionBanner />}
            <Layout>
              {auth && (
                <SidebarMenu billingUrl={settings?.billing_url} setShowBillingPayment={setShowBillingPayment} />
              )}
              {/* (#76a): the shell's one <main id='main-content'> (display: contents, so the flex layout is the same). The offline page
                  (R1-03) lives inside Layout, next to the menu, instead of a loose block above it that pushed the menu below the fold. */}
              <ShellMain>
              <NotNetworkConnectivity />
              {/* the routes stay mounted (hidden and inert) while there is no network, so a short cut does not erase what was typed; the offline page above shows in their place. */}
              <OfflineRouteGate online={onlineStatus}>
                <ScrollToTop>
                  <HelmetTags />
                  <CommandPaletteRouteBoundary>
                  {/* redesign tramo B r2 (W0-PB1-01): a page chunk that fails to load stays inside the content area (the menu stays) and offers «Reload»; it draws again when the path changes. */}
                  <ChunkErrorBoundary resetKey={routesLocation.pathname}>
                  <Suspense fallback={<RouteFallback auth={auth} />}>
                  <Switch location={routesLocation}>
                    {/* (D-68): a page the menu hides from readOnlyAdmin or readOnlyDeliveryManager is not reachable by URL or ⌘K either */}
                    {auth && isHiddenByReadOnly({ path: routesLocation.pathname, user, configs, project: ordering?.project }) && (
                      <Route>
                        <PageNotFound />
                      </Route>
                    )}
                    <Route exact path='/'>
                      {
                        auth
                          ? <Redirect to={startPath} />
                          : (queryProject && queryToken && (!settings.local_project_pin || queryProject === settings.local_project_pin))
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
                          ? startPath === '/home' ? <Home /> : <Redirect to={startPath} />
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
                      <BusinessesList />
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
                      <RegisterStoresGate>
                        <BusinessAdd />
                      </RegisterStoresGate>
                    </ProtectedRoute>

                    <Route exact path='/connect/overview'><Redirect to='/connect/pos-menu' /></Route>
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
                    <ProtectedRoute path='/connect/whatsapp-bots' allowedLevels={getConnectAllowedLevels('whatsapp_bots')}>
                      {showConnectTab ? <WhatsAppBots /> : <Redirect to='/home' />}
                    </ProtectedRoute>
                    <ProtectedRoute path='/connect/order-with-google' allowedLevels={[0, 2]}>
                      <OrderWithGoogle />
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
                    {/* redesign (n.º 21, ecommerce P2): merged into Enterprise reports; ?id=1-3 keeps the report, ?id=4 (Clicks) is report 22 */}
                    <ProtectedRoute path='/intelligence/ecommerce_reports' allowedLevels={[0]}>
                      <Redirect to={getEcommerceReportsRedirectPath(search)} />
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

                    <ProtectedRoute path='/builder/:productId' allowedLevels={[0]}>
                      <BuilderProduct />
                    </ProtectedRoute>
                    <ProtectedRoute path='/builder' allowedLevels={[0]}>
                      <Builder />
                    </ProtectedRoute>

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
                    <Route exact path='/purchase/addons'><Redirect to='/home' /></Route>
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
                  </Suspense>
                  </ChunkErrorBoundary>
                  </CommandPaletteRouteBoundary>
                </ScrollToTop>
              </OfflineRouteGate>
              </ShellMain>
            </Layout>
            {auth && <AssistantPanel />}
            {/* redesign BM-C (D1, C-4): the legacy Modal is gone; the dialog is a Product Dialog and gives the focus back itself (it is unmounted in the render that closes it) */}
            {isShowBillingPayment?.open && !projectStatus.loading && (
              <BillingPaymentOptions
                open={isShowBillingPayment?.open}
                onClose={() => setShowBillingPayment((prevState) => ({ ...prevState, open: false, from: '' }))}
                isUpgradeToPro={isShowBillingPayment?.from === 'upgrade_pro'}
                setShowBillingPayment={setShowBillingPayment}
                upgradeProPlanId={[projectStatus?.plan?.upgrade_plan_id]}
                showPlanInformation={isShowBillingPayment?.showInformation}
              />
            )}
            {/* redesign BM-C (M-BM5): reads the one-shot mark the dialog leaves before its reload and says what happened, once */}
            {auth && <BillingResultNotice />}
            {auth && <TrialExtensionModal />}
            {auth && <UpgradeOfferModal />}
            {auth && <CommandPalette />}
            </DashboardDestinationsProvider>
            </CommandPaletteProvider>
          </LegacyPlanUpgradeProvider></IntercomWrapper></StoreOnboardingGate>
        )
      }
    </UpgradeOfferProvider>
    </TrialExtensionProvider>
  )
}
