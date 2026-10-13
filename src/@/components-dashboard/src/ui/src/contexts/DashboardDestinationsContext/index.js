import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useApi } from '../../../../contexts/ApiContext'
import { useConfig } from '../../../../contexts/ConfigContext'
import { useLanguage } from '../../../../contexts/LanguageContext'
import { useSession } from '../../../../contexts/SessionContext'
import { useSettingsCatalog } from '../../../../components/CommandPalette/useSettingsCatalog'
import { useIntegrationsCatalog } from '../../../../components/CommandPalette/useIntegrationsCatalog'
import { createDashboardDestinationsController } from '../../../../components/CommandPalette/dashboardDestinationsController'
import { DELIVERY_SERVICES_URL, INTEGRATION_TYPES } from '../../../../utils/commandPaletteIntegrations'
import { getDashboardRoleFlags } from '../../../../utils/dashboardNavigation'
import { buildDashboardDestinationCatalog, toDashboardEnvelope } from '../../../../utils/dashboardDestinations'
import { buildSettingsHub } from '../../../../utils/settingsIa'
import { useDashboardNavigation } from '../../hooks/useDashboardNavigation'
import { useAssistant } from '../../../../contexts/AssistantContext'
import { useCommandPalette } from '../CommandPaletteContext'

const DashboardDestinationsContext = createContext(null)
const makeOpaque = () => {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }
}

const makeScope = (scopeKey) => {
  let first = 2166136261
  let second = 0x9e3779b9
  for (let index = 0; index < scopeKey.length; index++) {
    const code = scopeKey.charCodeAt(index)
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second ^ code, 2246822519)
  }
  return `dd1-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`
}

export const DashboardDestinationsProvider = ({ children }) => {
  const [ordering] = useApi()
  const [{ configs }] = useConfig()
  const [{ token, user }] = useSession()
  const [languageState, t] = useLanguage()
  const location = useLocation()
  const navigate = useDashboardNavigation()
  const { registerDashboardSearch, setOpen: setAssistantOpen } = useAssistant()
  const { open: openPalette } = useCommandPalette()
  const { level } = getDashboardRoleFlags(user)
  const project = ordering?.project
  const navCatalog = useMemo(() => buildDashboardDestinationCatalog({ t, user, configs, project }), [configs, project, t, user])
  const settingsCatalog = useSettingsCatalog({ enabled: false })
  const loadIntegrations = Object.values(INTEGRATION_TYPES).some(item => navCatalog.can(item.url))
  const loadDeliveryCompanies = navCatalog.can(DELIVERY_SERVICES_URL)
  const loadBuilderApps = navCatalog.canMyProducts
  const integrationsCatalog = useIntegrationsCatalog({
    enabled: false,
    loadIntegrations,
    loadDeliveryCompanies,
    loadBuilderApps
  })
  const catalog = useMemo(() => buildDashboardDestinationCatalog({
    t,
    user,
    configs,
    project,
    settingsHub: settingsCatalog.hub,
    integrations: integrationsCatalog.integrations,
    deliveryCompanies: integrationsCatalog.deliveryCompanies,
    builderApps: integrationsCatalog.builderApps
  }), [
    configs,
    integrationsCatalog.builderApps,
    integrationsCatalog.deliveryCompanies,
    integrationsCatalog.integrations,
    project,
    settingsCatalog.hub,
    t,
    user
  ])

  const scopeKey = `${project || ''}|${user?.id || ''}`
  const securityKey = JSON.stringify([
    scopeKey,
    ordering?.root || '',
    token || '',
    JSON.stringify(user || {}),
    JSON.stringify(configs || {}),
    [navCatalog.businessesAllowed, navCatalog.settingsAllowed, loadIntegrations, loadDeliveryCompanies, loadBuilderApps]
  ])
  const catalogKey = JSON.stringify(catalog.entries.map(({ id, title, subtitle, path, requires, target }) => [id, title, subtitle, path, requires, target]))
  const revisionKey = `${securityKey}|${languageState?.language?.code || languageState?.code || ''}|${catalogKey}|${location.pathname}|${location.search}`
  const scopeRef = useRef(makeScope(scopeKey))
  const revisionRef = useRef(makeOpaque())
  const previousScope = useRef(scopeKey)
  const previousRevision = useRef(revisionKey)
  if (previousScope.current !== scopeKey) {
    previousScope.current = scopeKey
    scopeRef.current = makeScope(scopeKey)
  }
  if (previousRevision.current !== revisionKey) {
    previousRevision.current = revisionKey
    revisionRef.current = makeOpaque()
  }

  const getCatalogErrors = useCallback(({ settingsStatus = settingsCatalog.status, integrations = integrationsCatalog } = {}) => [
    settingsStatus === 'loading' ? 'SETTINGS_CATALOG_LOADING' : null,
    settingsStatus === 'error' ? 'SETTINGS_CATALOG_ERROR' : null,
    (loadIntegrations || loadDeliveryCompanies || loadBuilderApps) && !integrations.loaded ? 'INTEGRATIONS_CATALOG_LOADING' : null,
    ...Object.entries(integrations.errors || {})
      .filter(([key, failed]) => failed && ({
        integrations: loadIntegrations,
        deliveryCompanies: loadDeliveryCompanies,
        builderApps: loadBuilderApps
      })[key])
      .map(([key]) => `INTEGRATIONS_${key.toUpperCase()}_ERROR`)
  ].filter(Boolean), [
    integrationsCatalog,
    loadBuilderApps,
    loadDeliveryCompanies,
    loadIntegrations,
    settingsCatalog.status
  ])

  const ensureCatalogs = useCallback(async ({ signal, force = false } = {}) => {
    const [settingsResult, integrationsResult] = await Promise.all([
      navCatalog.settingsAllowed
        ? settingsCatalog.ensure({ signal, force: force || settingsCatalog.status === 'error' })
        : Promise.resolve({ status: 'success', categoryLists: null }),
      integrationsCatalog.ensure({ signal, force: force || Object.values(integrationsCatalog.errors || {}).some(Boolean) })
    ])
    if (signal?.aborted) {
      const error = new Error('The dashboard search was cancelled')
      error.name = 'AbortError'
      throw error
    }
    const settingsHub = settingsResult.status === 'success' && settingsResult.categoryLists
      ? buildSettingsHub({ categoryLists: settingsResult.categoryLists, configs })
      : null
    const dynamic = {
      ...integrationsCatalog,
      ...integrationsResult
    }
    const refreshedCatalog = buildDashboardDestinationCatalog({
      t,
      user,
      configs,
      project,
      settingsHub,
      integrations: dynamic.integrations,
      deliveryCompanies: dynamic.deliveryCompanies,
      builderApps: dynamic.builderApps
    })
    const catalogErrors = getCatalogErrors({
      settingsStatus: settingsResult.status,
      integrations: dynamic
    })
    return { catalog: refreshedCatalog, catalogErrors }
  }, [
    configs,
    getCatalogErrors,
    integrationsCatalog,
    navCatalog.settingsAllowed,
    project,
    settingsCatalog,
    t,
    user
  ])

  const latestRef = useRef(null)
  latestRef.current = {
    catalog,
    catalogErrors: getCatalogErrors(),
    ensureCatalogs,
    locationSearch: location.search,
    navCatalog,
    ordering,
    token,
    user,
    level,
    project,
    configs,
    t,
    scope: scopeRef.current,
    revision: revisionRef.current,
    securityKey,
    navigate,
    setAssistantOpen
  }
  const controller = useMemo(() => createDashboardDestinationsController(latestRef), [])
  const getScope = useCallback(() => latestRef.current?.scope || '', [])
  const getSecurityGeneration = useCallback(() => latestRef.current?.securityKey || '', [])
  const search = controller.search
  const open = controller.open
  const chooseBusiness = useCallback(async (item, options = {}) => {
    const result = await open(item, options)
    if (result.status === 'needs_business' && result.scope === scopeRef.current) {
      openPalette({ destinationId: item.id, fromAssistant: true })
    }
    return result
  }, [open, openPalette])

  useEffect(() => {
    if (!registerDashboardSearch) return undefined
    return registerDashboardSearch({ handler: search, getScope, getSecurityGeneration })
  }, [getScope, getSecurityGeneration, registerDashboardSearch, search, securityKey])

  const integrationsStatus = !(loadIntegrations || loadDeliveryCompanies || loadBuilderApps)
    ? 'success'
    : !integrationsCatalog.loaded
        ? 'idle'
        : getCatalogErrors().some(error => error.startsWith('INTEGRATIONS_') && error.endsWith('_ERROR'))
          ? 'partial'
          : 'success'
  const value = useMemo(() => ({
    search,
    open,
    chooseBusiness,
    scope: scopeRef.current,
    revision: revisionRef.current,
    catalogStatus: {
      settings: settingsCatalog.status,
      integrations: integrationsStatus
    }
  }), [chooseBusiness, integrationsStatus, open, revisionKey, search, settingsCatalog.status])

  return <DashboardDestinationsContext.Provider value={value}>{children}</DashboardDestinationsContext.Provider>
}

const unavailable = {
  search: async () => toDashboardEnvelope({ status: 'unavailable', errors: ['DESTINATIONS_UNAVAILABLE'] }),
  open: async () => ({ status: 'unavailable' }),
  scope: '',
  revision: ''
}

export const useDashboardDestinations = () => useContext(DashboardDestinationsContext) || unavailable

export default DashboardDestinationsContext
