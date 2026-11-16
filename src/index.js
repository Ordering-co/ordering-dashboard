import './polyfills/resizeObserver'
import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { StyleSheetManager } from 'styled-components'
import * as Sentry from '@sentry/react'
import { PostHogProvider } from 'posthog-js/react'

import './index.css'
import './brand/ordering.tokens.generated.css'
import './brand/candidates.css'
// bootstrap.css arrived through the ~ui index and every screen relies on it (its reboot sets the body), so the
// entry keeps it explicitly, ahead of the shell's stylesheets, now that the shell no longer imports that index.
import 'bootstrap/dist/css/bootstrap.css'
import { createDashboardTheme } from './brand/adapter'
import reportWebVitals from './reportWebVitals'
import { Router } from './router'
import { OrderingProvider, AssistantProvider } from '~components'
// the shell imports ~ui pieces by file. The ~ui index reaches every component, and with it every
// stylesheet, so importing it here put the whole app's CSS in the entry stylesheet that blocks the first paint.
import { ThemeProvider } from '~ui/src/contexts/ThemeContext'
import { ConfigFileContext } from '~ui/src/contexts/ConfigFileContext'
import { ProjectProvider } from '~ui/src/contexts/ProjectContext'
import { InfoShareProvider } from '~ui/src/contexts/InfoShareContext'
import { FilterValuesProvider } from '~ui/src/contexts/FilterValuesContext'
import { Alert } from '~ui/src/components/Shared/Confirm'
import { Toast } from '~ui/src/styles/Toast'
import { getOrderingSubdomains } from '~ui/src/utils'

import theme from './theme.json'
import notificationMp3 from './assets/sounds/notification.mp3'
import notificationOgg from './assets/sounds/notification.ogg'
import settings from './config'
import { publicAssetUrl } from './utils/publicAssetUrl'
import { getStoredLanguageCode } from './utils/storage'
import { applyLocalProjectPin } from './utils/local-tenant'
import { getDashboardEnvironment } from './utils/dashboardBranding'
import {
  readFirstLoadConfigs,
  readStoredDashboardAuth,
  resolveInitialDashboardProject,
  shouldNormalizeStoredProjectAlias,
  shouldResolveDashboardProjectAtBoot
} from './utils/bootTheme'
import { fetchProjectCode } from './@/components-dashboard/src/utils/resolveProjectCode'
import { AutologinParams } from './components/AutologinParams'
import { AutologinNotice } from './components/AutologinParams/AutologinNotice'
import { PostHogIdentify } from './components/PostHogIdentify'
import {
  preparePostHogEventForSending,
  registerDashboardWebVitals
} from './analytics/posthog'

/**
 * Theme images
 */
// Ordering.co brand masters (brand.ordering.co release 1.3.1, sha256-verified):
// color lockup for light fields, reversed for dark fields (login).
import logotype from './assets/images/ordering-lockup-color.svg'
import logotypeInvert from './assets/images/ordering-lockup-color-reversed.svg'
import isotype from './assets/images/isotype.svg'
import isotypeInvert from './assets/images/isotype-invert.svg'
import logoPdf from './assets/images/logo-pdf.png'

import notFound from './assets/images/not-found.svg'
import personalization from './assets/images/personalization.svg'
import mobileCase from './assets/images/mobile-case.png'
import mobileMask from './assets/images/mobile-mask.png'
import registerOrder from './assets/images/register-order.png'
import level from './assets/images/level.png'
import mobileHalfMask from './assets/images/mobile-half-mask.png'
import whatsappHeader from './assets/images/whatsapp-header.png'
import appStore from './assets/images/app-store.png'
import googlePlay from './assets/images/google-play.png'
import deliverect from './assets/images/deliverect.png'
import ItsaCheckmateLogo from './assets/images/ItsaCheckmateLogo.png'
import doordash from './assets/images/door-dash.png'
import lalamove from './assets/images/lala-move.png'
import importMenu from './assets/images/import-menu.png'
import importedMenu from './assets/images/imported-menu.png'
import pickerExpress from './assets/images/picker-express.png'
import googleCalendarIcon from './assets/images/google-calendar-icon.png'

/**
 * project statuses
 */

/**
   * sales channels
   */

/**
 * Theme apps
 */
import storeApp from './assets/images/store-app.png'
import driverApp from './assets/images/driver-app.png'
import posApp from './assets/images/pos-app.png'
import kioskApp from './assets/images/kiosk-app.png'
import callCenterApp from './assets/images/call-center-app.png'

/**
 * business tutorials
 */
import businessTutorial1 from './assets/images/tutorials/business-tutorial-1.png'
import businessTutorial2 from './assets/images/tutorials/business-tutorial-2.png'

/**
 * dummies
 */
import storeDummy from './assets/images/dummies/store.png'
import noOrders from './assets/images/dummies/no-orders.png'
import promotionDummy from './assets/images/dummies/promotion.png'
import productDummy from './assets/images/dummies/product.png'
import noBusinesses from './assets/images/dummies/no-businesses.png'

/**
 * icons
 */
import search from './assets/images/icons/search.svg'
import calendar from './assets/images/icons/calendar.svg'
import help from './assets/images/icons/help.svg'
import mapMarker from './assets/images/icons/marker.png'
import sixDots from './assets/images/icons/sixDots.svg'
import shopToShop from './assets/images/icons/shopToShop.svg'
import homeToHome from './assets/images/icons/homeToHome.svg'
import oneByOne from './assets/images/icons/one-by-one.svg'
import sendToAll from './assets/images/icons/send-to-all.svg'
import nearestAvailable from './assets/images/icons/nearest-available.svg'
import batchWise from './assets/images/icons/batch-wise.svg'
import roundRobin from './assets/images/icons/round-robin.svg'
import leftArrow from './assets/images/icons/left-arrow.svg'
import rightArrow from './assets/images/icons/right-arrow.svg'
import facebook from './assets/images/icons/facebook.svg'
import tiktok from './assets/images/icons/tiktok.svg'
import instagram from './assets/images/icons/instagram.svg'
import businessGoogle from './assets/images/icons/business-google.svg'

import noDriver from './assets/images/avatars/noDriver.png'

import orderStatus0 from './assets/images/order/status-0.svg'
import orderStatus1 from './assets/images/order/status-1.svg'
import orderStatus2 from './assets/images/order/status-2.svg'
import orderStatus3 from './assets/images/order/status-3.svg'
import orderStatus4 from './assets/images/order/status-4.svg'
import orderStatus5 from './assets/images/order/status-5.svg'
import orderStatus6 from './assets/images/order/status-6.svg'
import orderStatus7 from './assets/images/order/status-7.svg'
import orderStatus8 from './assets/images/order/status-8.svg'
import orderStatus9 from './assets/images/order/status-9.svg'
import orderStatus10 from './assets/images/order/status-10.svg'
import orderStatus11 from './assets/images/order/status-11.svg'
import orderStatus12 from './assets/images/order/status-12.svg'
import orderStatus13 from './assets/images/order/status-13.svg'
import orderStatus14 from './assets/images/order/status-14.svg'
import orderStatus15 from './assets/images/order/status-15.svg'
import orderStatus16 from './assets/images/order/status-16.svg'
import orderStatus17 from './assets/images/order/status-17.svg'
import orderStatus18 from './assets/images/order/status-18.svg'
import orderStatus19 from './assets/images/order/status-19.svg'
import orderStatus20 from './assets/images/order/status-20.svg'
import orderStatus21 from './assets/images/order/status-21.svg'

import categoryAll from './assets/images/categories/category-all.png'
import delivery from './assets/images/icons/delivery.svg'
import poster from './assets/images/icons/poster.svg'
import posTerminal from './assets/images/icons/pos-terminal.svg'
import apple from './assets/images/icons/apple.svg'
import android from './assets/images/icons/android.svg'
/**
 * my products
 */
import myCustomerApp from './assets/images/myProducts/customer-app.png'
import myStoreApp from './assets/images/myProducts/store-app.png'
import myDriverApp from './assets/images/myProducts/driver-app.png'
import orderingWebsite from './assets/images/myProducts/ordering-website.png'
import myCallcenterAppBrand from './assets/images/myProducts/my-callcenter-app-brand.png'
import myCallcenterAppLive from './assets/images/myProducts/my-callcenter-app-live.png'
import myKioskAppBrand from './assets/images/myProducts/my-kiosk-app-brand.png'
import myKioskAppLive from './assets/images/myProducts/my-kiosk-app-live.png'
import myPosAppBrand from './assets/images/myProducts/my-pos-app-brand.png'
import myPosAppLive from './assets/images/myProducts/my-pos-app-live.png'
import storeAppFree from './assets/images/myProducts/store-app-free.png'
import storeAppBrand from './assets/images/myProducts/store-app-brand.png'
import driverAppFree from './assets/images/myProducts/driver-app-free.png'
import driverAppBrand from './assets/images/myProducts/driver-app-brand.png'
import multiStoreCustomerApp from './assets/images/myProducts/multi-store-customer-app.png'
import singleStoreCustomerApp from './assets/images/myProducts/single-store-customer-app.png'
import appStoreSmall from './assets/images/myProducts/app-store.png'
import playStoreSmall from './assets/images/myProducts/play-store.png'
import customProject from './assets/images/myProducts/custom-project.png'

/**
 * pos
 */
import square from './assets/images/pos/square.png'
import clover from './assets/images/pos/clover.png'
import toast from './assets/images/pos/toast.png'
import vectron from './assets/images/pos/vectron.png'
import par from './assets/images/pos/par.png'
import fourSoft from './assets/images/pos/4-soft.png'
import auphan from './assets/images/pos/auphan.png'
import cake from './assets/images/pos/cake.png'
import edgeServ from './assets/images/pos/edge-serv.png'
import brinkCertified from './assets/images/pos/brink-certified.png'
import elCheff from './assets/images/pos/el-cheff.png'
import emaginePos from './assets/images/pos/emagine-pos.png'
import eposNow from './assets/images/pos/epos-now.png'
import focus from './assets/images/pos/focus.png'
import foodics from './assets/images/pos/foodics.png'
import upserve from './assets/images/pos/upserve.png'
import givex from './assets/images/pos/givex.png'
import heartLand from './assets/images/pos/heart-land.png'
import hippos from './assets/images/pos/hippos.png'
import hungerRush from './assets/images/pos/hunger-rush.png'
import infocaja from './assets/images/pos/infocaja.png'
import iTabPos from './assets/images/pos/i-tab-pos.png'
import lightSpeed from './assets/images/pos/light-speed.png'
import linga from './assets/images/pos/linga.png'
import maitre from './assets/images/pos/maitre.png'
import microsRes from './assets/images/pos/micros-res.png'
import microsSimphony from './assets/images/pos/micros-simphony.png'
import mobileBytes from './assets/images/pos/mobile-bytes.png'
import nationalSoft from './assets/images/pos/national-soft.png'
import ncrAloha from './assets/images/pos/ncr-aloha.png'
import ncrSilver from './assets/images/pos/ncr-silver.png'
import northStar from './assets/images/pos/north-star.png'
import onePos from './assets/images/pos/one-pos.png'
import orderCounter from './assets/images/pos/order-counter.png'
import ovvi from './assets/images/pos/ovvi.png'
import paradisePos from './assets/images/pos/paradise-pos.png'
import pixelPoint from './assets/images/pos/pixel-point.png'
import posist from './assets/images/pos/posist.png'
import posIst from './assets/images/pos/pos-ist.png'
import prism from './assets/images/pos/prism.png'
import prologicFirst from './assets/images/pos/prologic-first.png'
import quBeyondPos from './assets/images/pos/qu-beyond-pos.png'
import rbbtTech from './assets/images/pos/rbbt-tech.png'
import restPro from './assets/images/pos/rest-pro.png'
import revel from './assets/images/pos/revel.png'
import rezku from './assets/images/pos/rezku.png'
import salido from './assets/images/pos/salido.png'
import snappy from './assets/images/pos/snappy.png'
import softRestaurant from './assets/images/pos/soft-restaurant.png'
import solutionDelivery from './assets/images/pos/solution-delivery.png'
import speedLine from './assets/images/pos/speed-line.png'
import spotOn from './assets/images/pos/spot-on.png'
import sunamiPos from './assets/images/pos/sunami-pos.png'
import superMenu from './assets/images/pos/super-menu.png'
import talech from './assets/images/pos/talech.png'
import telnet from './assets/images/pos/telnet.png'
import tidThree from './assets/images/pos/tid-3.png'
import touchBistro from './assets/images/pos/touch-bistro.png'
import union from './assets/images/pos/union.png'
import vistaEntertainment from './assets/images/pos/vista-entertainment-solutions.png'
import xenial from './assets/images/pos/xenial.png'
import xetux from './assets/images/pos/xetux.png'
import dinerWare from './assets/images/pos/diner-ware.png'
import digitalDining from './assets/images/pos/digital-dining.png'
import foodTec from './assets/images/pos/food-tec.png'

// preview
import marketplace from './assets/images/preview/marketplace.avif'
import franchise from './assets/images/preview/franchise.png'
import singleStore from './assets/images/preview/single-store.png'

if (import.meta.env.VITE_SENTRY_RELEASE) {
  Sentry.init({
    // «beta» on dashboard-beta.ordering.co, «production» everywhere else
    environment: getDashboardEnvironment(),
    release: `dashboard@${import.meta.env.VITE_SENTRY_RELEASE}`,
    dsn: settings.sentry_key,
    integrations: [
      Sentry.browserTracingIntegration()
    ],
    tracesSampleRate: 0.1,
    autoSessionTracking: true
  })
}

// redesign tramo B r3 (W0-PB2-01): no global `vite:preloadError` listener here. A page or panel chunk that no longer exists (a deploy
// under an open tab) reloads the page once through `lazyWithReload` (utils/chunkReload.js), which wraps only those imports; the
// other dynamic imports (pdf, web-vitals) keep their own `catch`, as in main.

const logos = {
  logotype,
  logotypeInvert,
  isotype,
  isotypeInvert,
  logoPdf
}

theme.images = {
  logos,
  general: {
    notFound,
    personalization,
    mobileCase,
    mobileMask,
    registerOrder,
    level,
    mobileHalfMask,
    whatsappHeader,
    appStore,
    googlePlay,
    deliverect,
    ItsaCheckmateLogo,
    doordash,
    lalamove,
    pickerExpress,
    importMenu,
    importedMenu,
    googleCalendarIcon
  },
  apps: {
    storeApp,
    driverApp,
    posApp,
    kioskApp,
    callCenterApp
  },
  order: {
    status0: orderStatus0,
    status1: orderStatus1,
    status2: orderStatus2,
    status3: orderStatus3,
    status4: orderStatus4,
    status5: orderStatus5,
    status6: orderStatus6,
    status7: orderStatus7,
    status8: orderStatus8,
    status9: orderStatus9,
    status10: orderStatus10,
    status11: orderStatus11,
    status12: orderStatus12,
    status13: orderStatus13,
    status14: orderStatus14,
    status15: orderStatus15,
    status16: orderStatus16,
    status17: orderStatus17,
    status18: orderStatus18,
    status19: orderStatus19,
    status20: orderStatus20,
    status21: orderStatus21
  },
  categories: {
    all: categoryAll
  },
  myProducts: {
    customerApp: myCustomerApp,
    storeApp: myStoreApp,
    driverApp: myDriverApp,
    orderingWebsite,
    myCallcenterAppBrand,
    myCallcenterAppLive,
    myKioskAppBrand,
    myKioskAppLive,
    myPosAppBrand,
    myPosAppLive,
    storeAppFree,
    storeAppBrand,
    driverAppFree,
    driverAppBrand,
    multiStoreCustomerApp,
    singleStoreCustomerApp,
    appStoreSmall,
    playStoreSmall,
    customProject
  },
  pos: {
    square,
    toast,
    clover,
    vectron,
    par,
    fourSoft,
    auphan,
    cake,
    edgeServ,
    brinkCertified,
    elCheff,
    emaginePos,
    eposNow,
    focus,
    foodics,
    upserve,
    givex,
    heartLand,
    hippos,
    hungerRush,
    infocaja,
    iTabPos,
    lightSpeed,
    linga,
    maitre,
    microsRes,
    microsSimphony,
    mobileBytes,
    nationalSoft,
    ncrAloha,
    ncrSilver,
    northStar,
    onePos,
    orderCounter,
    ovvi,
    paradisePos,
    pixelPoint,
    posist,
    posIst,
    prism,
    prologicFirst,
    quBeyondPos,
    rbbtTech,
    restPro,
    revel,
    rezku,
    salido,
    snappy,
    softRestaurant,
    solutionDelivery,
    speedLine,
    spotOn,
    sunamiPos,
    superMenu,
    talech,
    telnet,
    tidThree,
    touchBistro,
    union,
    vistaEntertainment,
    xenial,
    xetux,
    dinerWare,
    digitalDining,
    foodTec
  },
  icons: {
    search,
    calendar,
    noDriver,
    help,
    mapMarker,
    sixDots,
    shopToShop,
    homeToHome,
    oneByOne,
    sendToAll,
    nearestAvailable,
    batchWise,
    roundRobin,
    leftArrow,
    rightArrow,
    facebook,
    tiktok,
    instagram,
    businessGoogle,
    delivery,
    posTerminal,
    poster,
    apple,
    android
  },
  dummies: {
    noOrders,
    noBusinesses,
    businessLogo: storeDummy,
    promotionDummy,
    product: productDummy
  },
  tutorials: {
    businessTutorial1,
    businessTutorial2
  },
  preview: {
    marketplace,
    franchise,
    singleStore
  }
}

theme.files = {
  exampleCSV: publicAssetUrl('/ordering_business_example.csv')
}

theme.sounds = {
  notificationMp3,
  notificationOgg
}

const dashboardTheme = createDashboardTheme(theme)

const RouteApp = () => {
  const language = getStoredLanguageCode()
  const auth = readStoredDashboardAuth(window, settings)
  const isOrderingSubdomain = getOrderingSubdomains()
  const storedProject = window.localStorage.getItem('project')
  const project = resolveInitialDashboardProject({
    settings,
    auth,
    storedProject,
    isDevelopment: import.meta.env.DEV,
    isOrderingSubdomain
  })

  const [configFile, updateConfigFile] = useState({
    ...settings,
    api: {
      ...settings.api,
      language
    },
    project
  })

  const setConfigFile = (value) => updateConfigFile(current => {
    const next = typeof value === 'function' ? value(current) : value
    return applyLocalProjectPin(settings, next)
  })

  useEffect(() => {
    const shouldResolveProject = shouldResolveDashboardProjectAtBoot({
      auth,
      isOrderingSubdomain,
      useProjectDomain: settings?.use_project_domain,
      useProjectSubdomain: settings?.use_project_subdomain,
      storedProject,
      firstLoadConfigs: readFirstLoadConfigs(),
      localProjectPin: settings.local_project_pin
    })
    if (!shouldResolveProject) return

    const getProjectStatus = async () => {
      const { url, language, version } = settings.api
      const projectFromSubdomain = window.location.hostname.split('.').slice(0, 1).join()

      let project = window.localStorage.getItem('project') ?? settings?.project ?? null

      if (settings?.use_project_subdomain && isOrderingSubdomain) {
        project = projectFromSubdomain
      }
      if (settings?.use_project_domain && !isOrderingSubdomain) {
        project = '_'
      }

      try {
        const response = await fetch(`${url}/${version}/${language}/${project}/current`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        const { error, result } = await response.json()

        project = !error ? result?.code : settings?.project
      } catch (error) {
        // keep the project resolved above and fall through to the config update
      }
      setConfigFile((currentConfig) => ({ ...currentConfig, project }))
    }

    getProjectStatus()
  }, [])

  // One-time cleanup for a session stored before this normalization shipped: a stored
  // project can be a public alias. /current always answers with the internal code that
  // integrations key their data on, so re-check it once and correct storage if it drifted.
  useEffect(() => {
    if (!shouldNormalizeStoredProjectAlias({ auth, storedProject, localProjectPin: settings.local_project_pin })) return
    let cancelled = false
    const { url, language, version } = settings.api
    fetchProjectCode(`${url}/${version}/${language}/${storedProject}`).then((code) => {
      if (cancelled || !code || code === storedProject) return
      window.localStorage.setItem('project', code)
      setConfigFile((currentConfig) => ({ ...currentConfig, project: code }))
    })
    return () => { cancelled = true }
  }, [])

  return (
    <ConfigFileContext.Provider value={[configFile, setConfigFile]}>
      <PostHogProvider
        apiKey={configFile.posthog_api_key}
        options={{
          api_host: 'https://us.i.posthog.com',
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          capture_exceptions: false,
          disable_session_recording: true,
          before_send: event => preparePostHogEventForSending(event, configFile),
          loaded: client => registerDashboardWebVitals({
            client,
            config: configFile,
            reportWebVitals
          })
        }}
      >
        <ThemeProvider theme={dashboardTheme}>
          <AutologinParams configFile={configFile}>
            <OrderingProvider Alert={Alert}>
              <InfoShareProvider>
                <ProjectProvider>
                  <PostHogIdentify />
                  <FilterValuesProvider>
                    {/* ai_api comes only from config.json (src/config.js) */}
                    <AssistantProvider baseUrl={settings?.ai_api?.url}>
                      <Router />
                      <Toast />
                      <AutologinNotice />
                    </AssistantProvider>
                  </FilterValuesProvider>
                </ProjectProvider>
              </InfoShareProvider>
            </OrderingProvider>
          </AutologinParams>
        </ThemeProvider>
      </PostHogProvider>
    </ConfigFileContext.Provider>
  )
}

// page stylesheets now arrive with their chunk, appended to <head> after styled-components' <style>, so on equal
// specificity they would start beating the components (a mobile padding, a reduced-motion transition). With its styles at the
// end of <body>, styled-components comes after every stylesheet the entry used to hold, as before. It also comes after what
// was already appended to <head> later than it (the create-order wizard sheet, Google Maps' and OneSignal's <style>): none of
// those rules can match an element a component styles at equal specificity (PR #429 lists the check).
const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<StyleSheetManager target={document.body}><RouteApp /></StyleSheetManager>)
