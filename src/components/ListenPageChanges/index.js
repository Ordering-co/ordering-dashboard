import React, { useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { useEvent, useLanguage } from '~components'
import { useTheme } from '~ui'

export const ListenPageChanges = ({ children }) => {
  const history = useHistory()
  const [events] = useEvent()
  const [languageState] = useLanguage()
  const [theme, { merge }] = useTheme()

  const routes = {
    home: '/home',
    orders: '/orders',
    deliveries: '/deliveries',
    driver_store_status: '/driver-store-status',
    drivers_dashboard: '/drivers-dashboard',
    all_in_one: '/all-in-one',
    settings: '/settings',
    all_settings: '/settings',
    appointments: '/appointments',
    schools: '/schools',
    messages: '/messages',
    customers: '/users/customers',
    business_owners: '/users/business-owners',
    callcenter_agents: '/users/callcenter-agents',
    admins: '/users/admins',
    professionals: '/users/professionals',
    login: '/login',
    businesses: '/stores/list',
    business_add: '/stores/add',
    brand: '/stores/brand',
    devices: '/stores/devices',
    store: '/stores/products/:store?',
    basic_settings: '/settings/basic',
    standard_settings: '/settings/standard',
    operation_settings: '/settings/operation',
    pro_settings: '/settings/pro',
    plugin_settings: '/settings/plugin',
    pages: '/settings/pages',
    places: '/settings/places',
    integrations: '/settings/integrations',
    language: '/settings/language',
    logs: '/settings/logs',
    enterprise_settings: '/settings/enterprise',
    purchase_addons: '/purchase/addons',
    free_products: '/free-downloads',
    business_analytics: '/intelligence/business',
    drivers_analytics: '/intelligence/drivers',
    invoice: '/intelligence/invoice',
    reviews: '/intelligence/reviews',
    reports: '/intelligence/reports',
    ecommerce_reports: '/intelligence/ecommerce_reports',
    business_payment_reports: '/intelligence/business-payments',
    open_carts: '/cart-recovery/open-carts',
    recovery_actions: '/cart-recovery/recovery-actions',
    products: '/my-products',
    builder: '/builder',
    builder_app: '/builder/:productId',
    ordering_website: '/my-products/ordering-website',
    ordering_website_2: '/my-products/ordering-website-2',
    dashboard: '/my-products/dashboard',
    customer_app: '/my-products/customer-app',
    store_app: '/my-products/store-app',
    driver_app: '/my-products/driver-app',
    pos_app: '/my-products/pos-app',
    call_center_app: '/my-products/call-center-app',
    kiosk_app: '/my-products/kiosk-app',
    custom_project: '/my-products/custom-project',
    franchises_website: '/my-products/franchises-website',
    ordering_widgets: '/my-products/ordering-widgets',
    delivery_drivers: '/delivery/drivers-list',
    drivers_managers: '/delivery/drivers-managers',
    drivers_companies: '/delivery/drivers-companies',
    drivers_groups: '/delivery/drivers-groups',
    drivers_time_display: '/delivery/drivers-time-display',
    enterprise_promotions: '/marketing/promotions-enterprise',
    campaign: '/marketing/campaign',
    ad_banners: '/marketing/ad-banners',
    markups: '/stores/markups',
    ordering_products: '/ordering-products',
    support: '/support',
    rewards_programs: '/loyalty/rewards-programs',
    wallets_refunds: '/loyalty/wallets-refunds',
    catering: '/catering',
    multi_business_checkout: '/multi-business-checkout',
    stripe_connect: '/stripe-connect',
    reset_password: '/password/reset',
    profile: '/profile',
    gift_cards: '/gift-cards',
    gift_cards_settings: '/gift-cards-settings',
    reservations: '/reservations',
    connect_overview: '/connect/overview',
    delivery_services: '/connect/delivery-services',
    importers: '/connect/importers',
    pos_menu: '/connect/pos-menu',
    sales_channels: '/connect/sales-channels'
  }

  const handleGoToPage = ({ page, params = {}, search, replace = false, state = false }) => {
    let path = routes[page]
    if (path) {
      Object.entries(params).forEach(([key, value]) => {
        path = path.replace(`:${key}`, value)
      })
      if (Object.values(params).length === 0 && page === 'store') {
        path = path.replace(':store?', '')
      }
      if (search) {
        path = `${path}${search}`
      }
      history[replace ? 'replace' : 'push'](state ? { pathname: path, state } : path)
    }
  }

  const getCurrentPage = (pathname) => {
    Object.entries(routes).forEach(([key, value]) => {
      const regex = RegExp(value.replace(/:[a-zA-Z]+/i, '(.+)') + '$', 'gi')
      if (regex.test(pathname)) {
        const pathParts = value.split('/')
        const currentParts = pathname.split('/')
        const params = {}
        const paramRegex = /:[a-zA-Z]+/i
        pathParts.forEach((part, i) => {
          if (paramRegex.test(part)) {
            params[part.replace(':', '')] = currentParts[i]
          }
        })
        const query = {}
        const searchParams = new URLSearchParams(history.location.search)
        for (const [key, value] of searchParams.entries()) {
          query[key] = value
        }

        events.emit('change_view', { page: key, params, query })
      }
    })
  }

  const handleGetCurrentView = () => {
    getCurrentPage(history.location.pathname)
  }

  useEffect(() => {
    getCurrentPage(history.location.pathname)
    const unlisten = history.listen((data) => {
      getCurrentPage(data.pathname)
    })
    events.on('go_to_page', handleGoToPage)
    events.on('get_current_view', handleGetCurrentView)
    return () => {
      unlisten()
      events.off('go_to_page', handleGoToPage)
      events.off('get_current_view', handleGetCurrentView)
    }
  }, [events])

  useEffect(() => {
    if (theme.rtl !== languageState?.language?.rtl) {
      merge({
        rtl: languageState?.language?.rtl
      })
    }
  }, [languageState?.language?.rtl])

  return (
    <>
      {children}
    </>
  )
}
