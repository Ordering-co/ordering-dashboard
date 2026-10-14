import './polyfills/resizeObserver'
import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { PostHogProvider } from 'posthog-js/react'

import './index.css'
import reportWebVitals from './reportWebVitals'
import { Router } from './router'
import { OrderingProvider, AssistantProvider } from '~components'
import {
  ThemeProvider,
  ConfigFileContext,
  ProjectProvider,
  InfoShareProvider,
  FilterValuesProvider,
  Alert,
  Toast,
  getOrderingSubdomains
} from '~ui'

import theme from './theme.json'
import notificationMp3 from './assets/sounds/notification.mp3'
import notificationOgg from './assets/sounds/notification.ogg'
import settings from './config'
import { publicAssetUrl } from './utils/publicAssetUrl'
import { getStoredLanguageCode } from './utils/storage'
import {
  readFirstLoadConfigs,
  readStoredDashboardAuth,
  resolveInitialDashboardProject,
  shouldResolveDashboardProjectAtBoot
} from './utils/bootTheme'
import { AutologinParams } from './components/AutologinParams'
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

import notNetwork from './assets/images/not-network.svg'
import notFound from './assets/images/not-found.svg'
import notFound404 from './assets/images/not-found-404.svg'
import notFoundLighting from './assets/images/not-found-lighting.svg'
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
import projectActive from './assets/images/projectStatuses/project-active.png'
import projectPastDuePayment from './assets/images/projectStatuses/project-past-due-payment.png'

/**
   * sales channels
   */
import facebookProfileStep2 from './assets/images/salesChannels/facebook-profile-step2.png'
import facebookProfileStep31 from './assets/images/salesChannels/facebook-profile-step3-1.png'
import facebookProfileStep32 from './assets/images/salesChannels/facebook-profile-step3-2.png'
import facebookProfileStep4 from './assets/images/salesChannels/facebook-profile-step4.png'
import facebookProfileStep5 from './assets/images/salesChannels/facebook-profile-step5.png'
import facebookPostStep1 from './assets/images/salesChannels/facebook-post-step1.png'
import facebookPostStep2 from './assets/images/salesChannels/facebook-post-step2.png'
import tiktokStep1 from './assets/images/salesChannels/tiktok-step1.png'
import tiktokStep2 from './assets/images/salesChannels/tiktok-step2.png'
import tiktokStep3 from './assets/images/salesChannels/tiktok-step3.png'
import tiktokStep4 from './assets/images/salesChannels/tiktok-step4.png'
import tiktokStep5 from './assets/images/salesChannels/tiktok-step5.png'
import tiktokStep6 from './assets/images/salesChannels/tiktok-step6.png'
import tiktokStep7 from './assets/images/salesChannels/tiktok-step7.png'
import tiktokStep8 from './assets/images/salesChannels/tiktok-step8.png'
import tiktokStep9 from './assets/images/salesChannels/tiktok-step9.png'
import tiktokStep10 from './assets/images/salesChannels/tiktok-step10.png'
import instagramGeneralStep2 from './assets/images/salesChannels/instagram-general-step2.png'
import instagramGeneralStep3 from './assets/images/salesChannels/instagram-general-step3.png'
import instagramGeneralStep4 from './assets/images/salesChannels/instagram-general-step4.png'
import instagramGeneralStep5 from './assets/images/salesChannels/instagram-general-step5.png'
import instagramGeneralStep6 from './assets/images/salesChannels/instagram-general-step6.png'
import instagramAdvancedStep31 from './assets/images/salesChannels/instagram-advanced-step31.png'
import instagramAdvancedStep32 from './assets/images/salesChannels/instagram-advanced-step32.png'
import instagramAdvancedStep41 from './assets/images/salesChannels/instagram-advanced-step41.png'
import instagramAdvancedStep42 from './assets/images/salesChannels/instagram-advanced-step42.png'
import googleStep1 from './assets/images/salesChannels/google-step1.png'
import googleStep2 from './assets/images/salesChannels/google-step2.png'
import googleStep3 from './assets/images/salesChannels/google-step3.png'

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
import ordersList from './assets/images/icons/ordersList.svg'
import shop from './assets/images/icons/shop.svg'
import pieChart from './assets/images/icons/pieChart.svg'
import setting from './assets/images/icons/setting.svg'
import support from './assets/images/icons/support.svg'
import deadline from './assets/images/icons/deadline.svg'
import deadlineOK from './assets/images/icons/deadlineOK.svg'
import deadlineRisk from './assets/images/icons/deadlineRisk.svg'
import deadlineDelayed from './assets/images/icons/timeOut.svg'
import deadlineSetting from './assets/images/icons/deadlineSetting.png'
import search from './assets/images/icons/search.svg'
import group from './assets/images/icons/group.svg'
import calendar from './assets/images/icons/calendar.svg'
import email from './assets/images/icons/email.svg'
import lock from './assets/images/icons/lock.svg'
import cash from './assets/images/icons/cash.svg'
import help from './assets/images/icons/help.svg'
import timeline from './assets/images/icons/timeline.svg'
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
import doordashSetup from './assets/video/setup-doordash.mp4'

import orderPending from './assets/images/orderStatus/pending.svg'
import orderInProgress from './assets/images/orderStatus/inProgress.svg'
import orderCompleted from './assets/images/orderStatus/completed.svg'
import orderCancelled from './assets/images/orderStatus/cancelled.svg'
import noDriver from './assets/images/avatars/noDriver.png'
import driverDelivery from './assets/images/icons/driverDelivery.svg'
import pickUp from './assets/images/icons/pickUp.svg'

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

const isAllowedDomain = () => {
  const allowedDomain = 'orderingplus.com'
  return window.location.hostname.endsWith(allowedDomain) && window?.location?.hostname !== 'localhost'
}

if (isAllowedDomain()) {
  const sentryDNS = settings.sentry_key
  Sentry.init({
    environment: process.env.NODE_ENV,
    release: process.env.npm_package_version ? 'dashboard@' + process.env.npm_package_version : 'react-ordering-dashboard@' + '2.0.0',
    dsn: sentryDNS,
    integrations: [
      Sentry.browserTracingIntegration()
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: [
      /^https:\/\/dashboard\.tryordering\.com/,
      /^https:\/\/dashboard\.orderingplus\.com/,
      /^https:\/\/apiv4\.ordering\.co/
    ],
    autoSessionTracking: true
  })
}

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
    notNetwork,
    notFound,
    notFound404,
    notFoundLighting,
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
  project: {
    active: projectActive,
    pastDuePayment: projectPastDuePayment
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
  orderStatus: {
    pending: orderPending,
    inProgress: orderInProgress,
    completed: orderCompleted,
    cancelled: orderCancelled
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
  salesChannels: {
    facebookProfileStep2,
    facebookProfileStep31,
    facebookProfileStep32,
    facebookProfileStep4,
    facebookProfileStep5,
    facebookPostStep1,
    facebookPostStep2,
    tiktokStep1,
    tiktokStep2,
    tiktokStep3,
    tiktokStep4,
    tiktokStep5,
    tiktokStep6,
    tiktokStep7,
    tiktokStep8,
    tiktokStep9,
    tiktokStep10,
    instagramGeneralStep2,
    instagramGeneralStep3,
    instagramGeneralStep4,
    instagramGeneralStep5,
    instagramGeneralStep6,
    instagramAdvancedStep31,
    instagramAdvancedStep32,
    instagramAdvancedStep41,
    instagramAdvancedStep42,
    googleStep1,
    googleStep2,
    googleStep3
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
    ordersList,
    shop,
    pieChart,
    setting,
    support,
    deadline,
    deadlineOK,
    deadlineRisk,
    deadlineDelayed,
    deadlineSetting,
    search,
    calendar,
    group,
    email,
    lock,
    noDriver,
    driverDelivery,
    pickUp,
    cash,
    help,
    timeline,
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

theme.videos = {
  doordashSetup
}

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
    return settings.local_project_pin
      ? { ...next, project: settings.local_project_pin, local_project_pin: settings.local_project_pin }
      : next
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
        <ThemeProvider theme={theme}>
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

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<RouteApp />)
