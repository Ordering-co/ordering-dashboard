import React from 'react'
import {
  useApi as useBaseApi,
  useConfig as useBaseConfig,
  useEvent as useBaseEvent,
  useLanguage as useBaseLanguage,
  useSession as useBaseSession
} from './language'

const params = () => new URLSearchParams(window.location.search)
const isShellNavigation = () => params().get('surface') === 'shell-navigation'
const role = () => Number(params().get('role') ?? 0)
const readOnlyFlags = () => {
  const value = params().get('readonly')
  return {
    readOnlyAdmin: value === 'admin',
    readOnlyBusinessOwner: value === 'business',
    readOnlyDeliveryManager: value === 'delivery',
    viewOnlyBusinessOwner: value === 'view-business'
  }
}
const languages = [
  { code: 'en', name: 'English', default: true, enabled: true },
  { code: 'es', name: 'Spanish', enabled: true },
  { code: 'fr', name: 'French', enabled: true }
]
const dashboardLogo = `/brand/ordering/1.3.0/assets/logos/ordering-lockup-color${params().get('mode') === 'dark' ? '-on-dark' : ''}.svg`
const configs = {
  dashboard_logo: { value: dashboardLogo },
  school_module_enabled: { value: '1' },
  addon_points_and_levels: { value: true },
  addon_cash_wallet_and_refunds: { value: false },
  addon_gift_cards: { value: true },
  addon_catering: { value: true },
  addon_multi_business_checkout: { value: false },
  addon_stripe_connect: { value: true },
  addon_appointments: { value: true },
  appointments: { value: true },
  white_label_module: { value: params().get('whiteLabel') === '1' },
  powered_by_ordering_module: { value: false },
  web_marketplace_26: { value: true },
  web_dashboard_x: { value: true },
  web_franchises_x: { value: false }
}

export const useLanguage = () => useBaseLanguage()
export const useSession = () => {
  if (!isShellNavigation()) return useBaseSession()
  return [{
    auth: true,
    token: 'fixture-shell-token',
    user: {
      id: 81,
      level: role(),
      name: 'Alexandria',
      lastname: 'Navigation Fixture With A Long Tenant Name',
      email: 'navigation@example.com',
      user_system_id: 991,
      ...readOnlyFlags()
    }
  }]
}
export const useConfig = () => {
  if (!isShellNavigation()) return useBaseConfig()
  return [{ configs, loading: false }]
}
export const useApi = () => {
  if (!isShellNavigation()) return useBaseApi()
  return [{ project: params().get('project') || 'kosherkav', root: '/__brand-fixture__/shell-navigation' }, { configurations: { subdomain: 'ordering' } }]
}
export const useSite = () => {
  if (!isShellNavigation()) return [{ loading: false, sites: [] }]
  return [{
    loading: false,
    sites: [{ code: 'web_marketplace_26', domain: 'shop.example.test', ssl_process_status: 'ended', temporal_domain: 'tryordering-temp.example.test' }]
  }]
}
// The same value `useAssistantDock` returns outside `AssistantProvider`: the dock is off.
export const useAssistantDock = () => ({ isAllowed: false, isAvailable: false, isOpen: false, setOpen: () => {} })
export const useEvent = () => {
  if (!isShellNavigation()) return useBaseEvent()
  return [{
    emit: (name, payload) => {
      globalThis.__OD_SHELL_EVENTS__ = [...(globalThis.__OD_SHELL_EVENTS__ || []), { name, payload }]
    }
  }]
}

export const SidebarMenu = ({ UIComponent, ...props }) => React.createElement(UIComponent, {
  ...props,
  productsState: {
    loading: false,
    error: null,
    apps: [{ id: 701, title: 'Fixture Builder Application', type: 'app', enabled: true }]
  },
  getBillingToken: async () => ({ error: ['Billing disabled in fixture'], result: null })
})

export const LanguageSelector = ({ UIComponent, languages: suppliedLanguages, currentLanguage, onChangeLanguage, ...props }) => {
  const available = suppliedLanguages ?? languages
  return React.createElement(UIComponent, {
    ...props,
    languagesState: { loading: false, error: null, languages: available },
    currentLanguage: currentLanguage ?? available[0]?.code,
    handleChangeLanguage: (...args) => {
      globalThis.__OD_SHELL_LANGUAGE_CHANGES__ = [...(globalThis.__OD_SHELL_LANGUAGE_CHANGES__ || []), args]
      onChangeLanguage?.(...args)
    }
  })
}

export const LogoutAction = ({ UIComponent, handleSuccessLogout, ...props }) => React.createElement(UIComponent, {
  ...props,
  handleLogoutClick: () => {
    globalThis.__OD_SHELL_LOGOUTS__ = (globalThis.__OD_SHELL_LOGOUTS__ || 0) + 1
    handleSuccessLogout?.()
  }
})

// (sidebar follow-up): no fixture publishes a legacy-upgrade offer, so the sidebar
// card never renders here — same "nothing to show" the real controller gives without a token.
export const UpgradeOffer = ({ UIComponent, ...props }) => React.createElement(UIComponent, { ...props, offer: null })
