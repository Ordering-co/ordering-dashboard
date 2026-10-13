import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { BUILDER_APPS_PATH, buildDeliveryCompaniesUrl } from '../../utils/commandPaletteIntegrations'
import { fetchAllPages } from '../../utils/fetchAllPages'

const EMPTY = { integrations: [], deliveryCompanies: [], builderApps: [] }
const EMPTY_ERRORS = { integrations: false, deliveryCompanies: false, builderApps: false }

const fetchList = async (url, token, signal, { allPages = false } = {}) => {
  try {
    const requestOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      signal
    }
    const content = allPages
      ? await fetchAllPages(url, requestOptions)
      : await (await fetch(url, requestOptions)).json()
    return {
      items: !content?.error && Array.isArray(content?.result) ? content.result : [],
      error: !!content?.error || !Array.isArray(content?.result)
    }
  } catch {
    return { items: [], error: true }
  }
}

/**
 * Dynamic providers for CommandK and Dashboard destinations. Consumers can
 * load them lazily with ensure(), while CommandK keeps its open-palette load.
 */
export const useIntegrationsCatalog = ({
  enabled = false,
  loadIntegrations = false,
  loadDeliveryCompanies = false,
  loadBuilderApps = false
} = {}) => {
  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const sourceKey = `${!!loadIntegrations}|${!!loadDeliveryCompanies}|${!!loadBuilderApps}`
  const scopeKey = `${ordering?.project || ''}|${ordering?.root || ''}|${user?.id || ''}|${user?.level ?? ''}|${token || ''}|${sourceKey}`
  const [state, setState] = useState({ scopeKey, loaded: false, ...EMPTY, errors: EMPTY_ERRORS })
  const stateRef = useRef(state)
  stateRef.current = state
  const scopeRef = useRef(scopeKey)
  scopeRef.current = scopeKey
  const loadingRef = useRef(null)
  const current = state.scopeKey === scopeKey ? state : { scopeKey, loaded: false, ...EMPTY, errors: EMPTY_ERRORS }

  const ensure = useCallback(({ force = false, signal } = {}) => {
    const latest = stateRef.current.scopeKey === scopeKey
      ? stateRef.current
      : { scopeKey, loaded: false, ...EMPTY, errors: EMPTY_ERRORS }
    if (!loadIntegrations && !loadDeliveryCompanies && !loadBuilderApps) {
      return Promise.resolve({ scopeKey, loaded: true, ...EMPTY, errors: EMPTY_ERRORS })
    }
    if (!force && latest.loaded) return Promise.resolve(latest)
    if (loadingRef.current?.scopeKey === scopeKey) return loadingRef.current.promise
    if (!token || !ordering?.root) return Promise.resolve({ scopeKey, loaded: false, ...EMPTY, errors: EMPTY_ERRORS })

    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal?.aborted) controller.abort()
    else signal?.addEventListener('abort', abort, { once: true })
    setState({ scopeKey, loaded: false, ...EMPTY, errors: EMPTY_ERRORS })
    const promise = Promise.all([
      loadIntegrations ? fetchList(`${ordering.root}/third_party_integrations`, token, controller.signal) : { items: [], error: false },
      loadDeliveryCompanies ? fetchList(buildDeliveryCompaniesUrl(ordering.root), token, controller.signal) : { items: [], error: false },
      loadBuilderApps ? fetchList(`${ordering.root}${BUILDER_APPS_PATH}`, token, controller.signal, { allPages: true }) : { items: [], error: false }
    ]).then(([integrationsResult, deliveryCompaniesResult, builderAppsResult]) => {
      if (controller.signal.aborted || scopeRef.current !== scopeKey) {
        return { scopeKey, loaded: false, ...EMPTY, errors: EMPTY_ERRORS, stale: true }
      }
      const result = {
        scopeKey,
        loaded: true,
        integrations: integrationsResult.items,
        deliveryCompanies: deliveryCompaniesResult.items,
        builderApps: builderAppsResult.items,
        errors: {
          integrations: integrationsResult.error,
          deliveryCompanies: deliveryCompaniesResult.error,
          builderApps: builderAppsResult.error
        }
      }
      setState(result)
      return result
    }).finally(() => {
      signal?.removeEventListener('abort', abort)
      if (loadingRef.current?.scopeKey === scopeKey) loadingRef.current = null
    })
    loadingRef.current = { scopeKey, promise, controller }
    return promise
  }, [loadBuilderApps, loadDeliveryCompanies, loadIntegrations, ordering?.root, scopeKey, token])

  useEffect(() => {
    if (enabled) void ensure()
    return () => {
      if (loadingRef.current?.scopeKey === scopeKey) {
        loadingRef.current.controller.abort()
        loadingRef.current = null
      }
    }
  }, [enabled, ensure, scopeKey])

  const refresh = useCallback((options = {}) => ensure({ ...options, force: true }), [ensure])

  return { ...current, ensure, refresh }
}
