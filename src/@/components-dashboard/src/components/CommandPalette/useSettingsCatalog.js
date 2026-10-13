import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useConfig } from '../../contexts/ConfigContext'
import {
  buildSettingsCategoriesFetchUrl,
  buildSettingsCategoryLists
} from '../../utils/settingsCategoryTree'
import { getSettingsCategoryKeysToFetch, getSettingsStandaloneCategoryKeys } from '../../utils/settingsAccess'
import { buildSettingsHub } from '../../utils/settingsIa'

/**
 * Settings hub catalog for CommandK and Dashboard destinations.
 */
export const useSettingsCatalog = ({ enabled = false } = {}) => {
  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [{ configs }] = useConfig()
  const scopeKey = `${ordering?.project || ''}|${ordering?.root || ''}|${user?.id || ''}|${user?.level ?? ''}|${token || ''}`
  const [state, setState] = useState({ scopeKey, status: 'idle', categoryLists: null })
  const stateRef = useRef(state)
  stateRef.current = state
  const scopeRef = useRef(scopeKey)
  scopeRef.current = scopeKey
  const loadingRef = useRef(null)

  const current = state.scopeKey === scopeKey ? state : { scopeKey, status: 'idle', categoryLists: null }

  const ensure = useCallback(({ force = false, signal } = {}) => {
    const latest = stateRef.current.scopeKey === scopeKey
      ? stateRef.current
      : { scopeKey, status: 'idle', categoryLists: null }
    if (!force && latest.status === 'success') {
      return Promise.resolve({ status: 'success', categoryLists: latest.categoryLists })
    }
    if (!force && latest.status === 'error') return Promise.resolve({ status: 'error', categoryLists: null })
    if (loadingRef.current?.scopeKey === scopeKey) return loadingRef.current.promise
    if (!token || !ordering?.root) return Promise.resolve({ status: 'error', categoryLists: null })

    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal?.aborted) controller.abort()
    else signal?.addEventListener('abort', abort, { once: true })
    setState({ scopeKey, status: 'loading', categoryLists: null })
    const promise = (async () => {
      try {
        const response = await fetch(buildSettingsCategoriesFetchUrl(ordering.root), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          signal: controller.signal
        })
        const { error, result } = await response.json()
        if (controller.signal.aborted || scopeRef.current !== scopeKey) return { status: 'stale', categoryLists: null }
        if (error) throw new Error('SETTINGS_CATALOG_ERROR')
        const categoryLists = buildSettingsCategoryLists({
          categories: result || [],
          parentKeys: getSettingsCategoryKeysToFetch().filter(key => key.enabled).map(key => key.key),
          standaloneKeys: getSettingsStandaloneCategoryKeys()
        })
        setState({ scopeKey, status: 'success', categoryLists })
        return { status: 'success', categoryLists }
      } catch {
        if (controller.signal.aborted || scopeRef.current !== scopeKey) return { status: 'stale', categoryLists: null }
        setState({ scopeKey, status: 'error', categoryLists: null })
        return { status: 'error', categoryLists: null }
      } finally {
        signal?.removeEventListener('abort', abort)
        if (loadingRef.current?.scopeKey === scopeKey) loadingRef.current = null
      }
    })()
    loadingRef.current = { scopeKey, promise, controller }
    return promise
  }, [ordering?.root, scopeKey, token])

  useEffect(() => {
    if (enabled) void ensure()
    return () => {
      if (loadingRef.current?.scopeKey === scopeKey) {
        loadingRef.current.controller.abort()
        loadingRef.current = null
      }
    }
  }, [enabled, ensure, scopeKey])

  const hub = useMemo(
    () => current.categoryLists ? buildSettingsHub({ categoryLists: current.categoryLists, configs }) : null,
    [current.categoryLists, configs]
  )

  const refresh = useCallback((options = {}) => ensure({ ...options, force: true }), [ensure])

  return { status: current.status, hub, ensure, refresh }
}
