import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useConfig } from '../../contexts/ConfigContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useSettingsCatalog } from './useSettingsCatalog'
import { useBusinessSearch } from './useBusinessSearch'
import { useOrderSearch, useUserSearch } from './useRecordSearch'
import { useIntegrationsCatalog } from './useIntegrationsCatalog'
import { DELIVERY_SERVICES_URL, INTEGRATION_TYPES } from '../../utils/commandPaletteIntegrations'
import { rankCommandEntries } from '../../utils/commandPaletteSearch'
import { canOpenSettings } from '../../utils/commandPaletteCatalog'
import { canOpenNavDestination } from '../../utils/commandPaletteActions'
import { buildRecordHandoffEntries } from '../../utils/commandPaletteHandoff'
import {
  buildUserSearchWhere,
  canSearchOrderQuery,
  canSearchOrders,
  classifyRecordQuery,
  getSearchableUserLevels,
  toOrderItems,
  toUserItems
} from '../../utils/commandPaletteRecords'
import { markCommandPaletteSlowSearch, readCommandPaletteSlowSearch } from '../../utils/commandPaletteSearchMode'
import { buildPaletteStorePath } from '../../utils/businessDetailSections'
import { canOpenDashboardRoute, getDashboardNavSections, getDashboardRoleFlags } from '../../utils/dashboardNavigation'
import { buildDashboardDestinationCatalog } from '../../utils/dashboardDestinations'
import {
  getCommandPaletteRecentKey,
  pushCommandPaletteRecent,
  readCommandPaletteRecent
} from '../../utils/commandPaletteRecent'

export const COMMAND_PALETTE_LIMITS = { navigation: 6, settings: 8, actions: 6 }
export const COMMAND_PALETTE_MIN_BUSINESS_QUERY = 2
export const COMMAND_PALETTE_SUGGESTED_IDS = [
  'nav:orders',
  'nav:businesses',
  'settings-group:payments',
  'settings-group:notifications',
  'nav:customers',
  'nav:business_analytics',
  'nav:settings'
]

const toBusinessItem = (business, { t, context }) => ({
  id: context ? `business:${business.id}:${context.id}` : `business:${business.id}`,
  group: 'businesses',
  title: business.name || `#${business.id}`,
  subtitle: [`#${business.id}`, business.address].filter(Boolean).join(' · '),
  path: buildPaletteStorePath(context || {}, business),
  icon: 'stores',
  logo: business.logo,
  badge: business.enabled ? null : t('INACTIVE', 'Inactive')
})

/** Remote sections that disappear when they find nothing (stores say so instead). */
const QUIET_REMOTE_SECTIONS = ['orders', 'users']

/**
 * Command palette controller. No markup.
 *
 * Local providers (navigation, Settings, open actions, hand-offs) rank on the
 * client; stores, orders and users search the API. They stay independent: if
 * one search fails, the other results keep working.
 */
export const CommandPalette = (props) => {
  const { UIComponent, isOpen, initialRequest, onNavigate, getOrderStatusLabel } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ user }] = useSession()
  const [{ configs }] = useConfig()

  const [query, setQuery] = useState('')
  const [businessContext, setBusinessContext] = useState(null)
  const appliedRequestRef = useRef(null)

  const recentKey = getCommandPaletteRecentKey({ project: ordering?.project, userId: user?.id })
  const [recent, setRecent] = useState(() => readCommandPaletteRecent(recentKey))

  useEffect(() => {
    if (isOpen) {
      setRecent(readCommandPaletteRecent(recentKey))
      return
    }
    setQuery('')
    setBusinessContext(null)
  }, [isOpen, recentKey])

  useEffect(() => {
    setBusinessContext(null)
  }, [ordering?.project, user?.id])

  const trimmed = query.trim()
  const { level } = getDashboardRoleFlags(user)
  const navSections = useMemo(() => getDashboardNavSections({ t, user, configs, project: ordering?.project }), [t, user, configs, ordering?.project])
  const businessesAllowed = canOpenNavDestination({ sections: navSections, url: '/stores/list', level })
  const settingsAllowed = canOpenSettings(user)

  const can = (url) => canOpenNavDestination({ sections: navSections, url, level })
  const canIntegrations = Object.values(INTEGRATION_TYPES).some(type => can(type.url))
  const canDeliveryServices = can(DELIVERY_SERVICES_URL)
  const canMyProducts = !!navSections.myProducts?.visible && canOpenDashboardRoute('/my-products', level)
  const integrationsCatalog = useIntegrationsCatalog({
    enabled: isOpen,
    loadIntegrations: canIntegrations,
    loadDeliveryCompanies: canDeliveryServices,
    loadBuilderApps: canMyProducts
  })

  const settingsCatalog = useSettingsCatalog({ enabled: isOpen && settingsAllowed })
  const destinationCatalog = useMemo(() => buildDashboardDestinationCatalog({
    t,
    user,
    configs,
    project: ordering?.project,
    settingsHub: settingsCatalog.hub,
    integrations: integrationsCatalog.integrations,
    deliveryCompanies: integrationsCatalog.deliveryCompanies,
    builderApps: integrationsCatalog.builderApps
  }), [t, user, configs, ordering?.project, settingsCatalog.hub, integrationsCatalog.integrations, integrationsCatalog.deliveryCompanies, integrationsCatalog.builderApps])
  const { navigationEntries, settingsEntries, actionEntries } = destinationCatalog

  useEffect(() => {
    if (!isOpen) {
      appliedRequestRef.current = null
      return
    }
    if (!initialRequest || appliedRequestRef.current === initialRequest) return
    const entry = destinationCatalog.byId.get(initialRequest.destinationId)
    if (initialRequest.destinationId && !entry) return
    appliedRequestRef.current = initialRequest
    setQuery(initialRequest.query || '')
    setBusinessContext(entry?.requires === 'business' ? entry : null)
  }, [isOpen, initialRequest, destinationCatalog])

  const searchBusinesses = businessesAllowed && (
    !!businessContext ||
    trimmed.length >= COMMAND_PALETTE_MIN_BUSINESS_QUERY ||
    /^\d+$/.test(trimmed)
  )
  const businessSearch = useBusinessSearch({
    query: trimmed,
    enabled: isOpen && searchBusinesses,
    allowEmpty: !!businessContext
  })

  const businessItems = useMemo(
    () => businessSearch.results.map(business => toBusinessItem(business, { t, context: businessContext })),
    [businessSearch.results, businessContext, t]
  )

  // Extended search by default; an order or user search slower than
  // RECORD_SEARCH_SLOW_MS switches that project to safe mode in this browser
  const project = ordering?.project
  const [slowSearch, setSlowSearch] = useState(() => readCommandPaletteSlowSearch(project))
  useEffect(() => {
    setSlowSearch(readCommandPaletteSlowSearch(project))
  }, [project, isOpen])
  const handleOrdersSlow = useCallback(() => setSlowSearch(markCommandPaletteSlowSearch(project, 'orders')), [project])
  const handleUsersSlow = useCallback(() => setSlowSearch(markCommandPaletteSlowSearch(project, 'users')), [project])
  const ordersExtended = !slowSearch.orders
  const usersExtended = !slowSearch.users

  const recordQuery = !businessContext && !!trimmed
  const ordersByRole = canSearchOrders({ level, canOpenOrders: can('/orders') })
  const ordersAllowed = ordersByRole && canSearchOrderQuery(trimmed, { extended: ordersExtended })
  // Safe mode only looks up order numbers: say where names and phones go
  const ordersSafeNotice = recordQuery && ordersByRole && !ordersExtended && !ordersAllowed && canSearchOrderQuery(trimmed)
  const userLevels = useMemo(() => getSearchableUserLevels({ level, can }), [level, navSections])
  const usersAllowed = buildUserSearchWhere(trimmed, userLevels, { extended: usersExtended }) !== null
  const orderSearch = useOrderSearch({ query: trimmed, enabled: isOpen && recordQuery && ordersAllowed, extended: ordersExtended, onSlow: handleOrdersSlow })
  const userSearch = useUserSearch({ query: trimmed, enabled: isOpen && recordQuery && usersAllowed, levels: userLevels, extended: usersExtended, onSlow: handleUsersSlow })
  const orderItems = useMemo(
    () => toOrderItems(orderSearch.results, orderSearch.query, { t, statusLabel: getOrderStatusLabel }),
    [orderSearch.results, orderSearch.query, t, getOrderStatusLabel]
  )
  const userItems = useMemo(
    () => toUserItems(userSearch.results, userSearch.query, { t, levels: userLevels }),
    [userSearch.results, userSearch.query, t, userLevels]
  )
  // Types of the users found for this query: "Search in <type>" per type
  const foundUserLevels = useMemo(() => {
    if (userSearch.status !== 'success' || userSearch.query !== trimmed) return []
    return userSearch.results.map(found => found?.level).filter(found => userLevels.includes(found))
  }, [userSearch.status, userSearch.query, userSearch.results, trimmed, userLevels])

  const sections = useMemo(() => {
    if (businessContext) {
      return [{ key: 'businesses', remote: true, search: businessSearch, items: businessItems }]
    }

    if (!trimmed) {
      const known = new Map([...navigationEntries, ...settingsEntries, ...actionEntries].map(entry => [entry.id, entry]))
      const recentItems = recent
        .map(item => {
          if (item.id.startsWith('business:')) return businessesAllowed ? item : null
          return known.get(item.id) || null
        })
        .filter(Boolean)
        .map(item => ({ ...item, id: `recent:${item.id}`, recentId: item.id }))
      const recentIds = new Set(recentItems.map(item => item.recentId))
      let suggested = COMMAND_PALETTE_SUGGESTED_IDS.map(id => known.get(id)).filter(Boolean)
      if (!suggested.length) suggested = navigationEntries.slice(0, 5)
      suggested = suggested.filter(entry => !recentIds.has(entry.id))
      return [
        { key: 'recent', items: recentItems },
        { key: 'suggestions', items: suggested }
      ].filter(section => section.items.length)
    }

    const local = [
      { key: 'navigation', items: rankCommandEntries(navigationEntries, trimmed, { limit: COMMAND_PALETTE_LIMITS.navigation }) },
      { key: 'settings', items: rankCommandEntries(settingsEntries, trimmed, { limit: COMMAND_PALETTE_LIMITS.settings }) },
      { key: 'actions', items: rankCommandEntries(actionEntries, trimmed, { limit: COMMAND_PALETTE_LIMITS.actions }) }
    ]
    const remote = (key, search, items, active) => {
      if (!active || search.status === 'idle') return null
      if (QUIET_REMOTE_SECTIONS.includes(key) && search.status === 'success' && !items.length) return null
      return { key, remote: true, search, items }
    }
    // A number is most often an order; a phone or an email, a person.
    // Either way records come before pages and settings, and an empty store
    // search stays quiet.
    const kind = classifyRecordQuery(trimmed)?.kind
    const storesQuiet = kind !== 'text' && businessSearch.status === 'success' && !businessItems.length
    const stores = searchBusinesses && !storesQuiet ? { key: 'businesses', remote: true, search: businessSearch, items: businessItems } : null
    const orders = ordersSafeNotice
      ? { key: 'orders', items: [], notice: t('COMMAND_PALETTE_ORDERS_SAFE_MODE', 'This project has many orders: here they are found by number. For a name or a phone, use “Search in Orders”.') }
      : remote('orders', orderSearch, orderItems, recordQuery && ordersAllowed)
    const people = remote('users', userSearch, userItems, recordQuery && usersAllowed)
    const handoffs = { key: 'records', items: buildRecordHandoffEntries({ t, query: trimmed, user, configs, userLevels: foundUserLevels }) }
    let ordered
    if (kind === 'number') ordered = [orders, stores, people, handoffs, ...local]
    else if (kind === 'phone' || kind === 'email') ordered = [people, orders, stores, handoffs, ...local]
    else ordered = [...local, stores, orders, people, handoffs]
    return ordered.filter(section => section && (section.remote || section.notice || section.items.length))
  }, [businessContext, trimmed, navigationEntries, settingsEntries, actionEntries, recent, businessesAllowed, searchBusinesses, businessSearch, businessItems, recordQuery, ordersAllowed, ordersSafeNotice, orderSearch, orderItems, usersAllowed, userSearch, userItems, foundUserLevels, t, user, configs])

  const handleSelect = useCallback((item) => {
    if (!item) return
    if (item.requires === 'business') {
      setBusinessContext(item)
      setQuery('')
      return
    }
    if (!item.path) return
    const { recentId, ...entry } = item
    setRecent(pushCommandPaletteRecent(recentKey, {
      id: recentId || entry.id,
      group: entry.group,
      title: entry.title,
      subtitle: entry.subtitle,
      path: entry.path,
      icon: entry.icon
    }))
    onNavigate && onNavigate(entry.path, { remount: !!entry.remount })
  }, [recentKey, onNavigate])

  const handleExitContext = useCallback(() => {
    setBusinessContext(null)
    setQuery('')
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          query={query}
          setQuery={setQuery}
          sections={sections}
          businessContext={businessContext}
          businessesAllowed={businessesAllowed}
          settingsStatus={settingsAllowed ? settingsCatalog.status : 'idle'}
          minBusinessQuery={COMMAND_PALETTE_MIN_BUSINESS_QUERY}
          handleSelect={handleSelect}
          handleExitContext={handleExitContext}
        />
      )}
    </>
  )
}

CommandPalette.propTypes = {
  /** UI Component, receives the computed sections and handlers */
  UIComponent: PropTypes.elementType,
  /** Whether the palette is open (requests only run while open) */
  isOpen: PropTypes.bool,
  /** Called with a dashboard path when a result is chosen */
  onNavigate: PropTypes.func,
  /** Names an order status (the UI layer owns the status list) */
  getOrderStatusLabel: PropTypes.func
}
