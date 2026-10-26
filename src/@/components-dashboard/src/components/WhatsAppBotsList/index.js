import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { readBotSettings } from './botSettings'
import { createBotPayload } from './botCreate'
import { formatWhatsAppPhone } from './botConnection'
import { useBotConnection } from './useBotConnection'

const WHATSAPP_PROVIDER = 'whatsapp'
const CHAT_BOT_TYPE = 'chat_bot'
const DEFAULT_PAGE_SIZE = 10
const AGENT_FIELDS = 'id,provider,provider_type,franchise_id,enabled,provider_settings'
const SETTINGS_FIELDS = 'id,settings'
const BRAND_FIELDS = 'id,name,logo'
const BRAND_PAGE_SIZE = 10
const BRAND_CATALOG_FIELDS = 'id,name,logo,enabled'

const emptyBrandsState = () => ({
  loading: false,
  loadingMore: false,
  loaded: false,
  error: null,
  brands: [],
  page: 0,
  hasNextPage: false
})

const toBrandOption = (brand) => ({
  id: brand.id,
  name: brand.name || '',
  logo: brand.logo || null,
  enabled: brand.enabled !== false
})

const isWhatsAppBot = (agent) => agent?.provider === WHATSAPP_PROVIDER && agent?.provider_type === CHAT_BOT_TYPE

/**
 * Row shown for a WhatsApp agent. Only these keys leave the controller:
 * `provider_settings` also holds the Meta access token.
 * @param {Object} agent agent from `GET /ai/agents`
 */
export const toWhatsAppBot = (agent = {}) => {
  return {
    id: agent?.id,
    phone: formatWhatsAppPhone(agent?.provider_settings?.country_code, agent?.provider_settings?.phone_number),
    enabled: !!agent?.enabled,
    brandId: agent?.franchise_id ?? null,
    brand: null
  }
}

const toErrorList = (result, fallback) => {
  if (Array.isArray(result)) return result.length ? result.map(String) : [fallback]
  if (typeof result === 'string' && result) return [result]
  return [fallback]
}

/**
 * WhatsApp bots of the project: the agents whose provider is
 * `whatsapp` and type is `chat_bot` (the guided webview, not the AI chat),
 * read one page at a time from `GET /ai/agents`. `findAll` does not load the
 * brand, so its name and logo come from `GET /franchises` afterwards.
 */
export const WhatsAppBotsList = (props) => {
  const { UIComponent, pageSize = DEFAULT_PAGE_SIZE } = props

  const { botId } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [botsState, setBotsState] = useState({ loading: true, error: null, bots: [], pagination: null })
  const [settingsState, setSettingsState] = useState({ loading: false, saving: false, error: null, saved: null, savedNotice: false })
  const [createState, setCreateState] = useState({ saving: false, error: null })
  const [brandsState, setBrandsState] = useState(emptyBrandsState)
  const brandRequestRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const [toggleState, setToggleState] = useState({ savingId: null, error: null })
  const controllerRef = useRef(null)
  const settingsRef = useRef(null)
  const brandsRef = useRef(null)

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }

  const connectionProps = useBotConnection(botId, (id, connection) => {
    const phone = formatWhatsAppPhone(connection.countryCode, connection.phoneNumber)
    setBotsState(prev => ({
      ...prev,
      bots: prev.bots.map(bot => String(bot.id) === String(id) ? { ...bot, phone } : bot)
    }))
  })

  /**
   * Add the brand name and logo to the bots of the page. A failure leaves the
   * list as it is: the brand is only a label.
   * @param {Array} bots bots of the page
   * @param {AbortSignal} signal signal of the page request
   */
  const getBrands = async (bots, signal) => {
    const ids = [...new Set(bots.map(bot => bot.brandId).filter(id => id !== null))]
    if (!ids.length) return
    try {
      const query = new URLSearchParams({
        page: 1,
        page_size: ids.length,
        params: BRAND_FIELDS,
        where: JSON.stringify([{ attribute: 'id', value: ids }])
      })
      const response = await fetch(`${ordering.root}/franchises?${query}`, { headers: authHeaders, signal })
      const content = await response.json()
      if (!response.ok || content?.error || !Array.isArray(content?.result)) return
      const brandsById = new Map(content.result.map(brand => [brand.id, { id: brand.id, name: brand.name, logo: brand.logo || null }]))
      setBotsState(prev => ({
        ...prev,
        bots: prev.bots.map(bot => ({ ...bot, brand: brandsById.get(bot.brandId) || bot.brand }))
      }))
    } catch (err) {}
  }

  /**
   * Get one page of WhatsApp bots
   * @param {Number} page page to load
   * @param {Number} size rows per page
   */
  const getBots = async (page = 1, size = botsState.pagination?.pageSize || pageSize) => {
    controllerRef.current?.abort()
    const abortController = new AbortController()
    controllerRef.current = abortController
    try {
      setBotsState(prev => ({ ...prev, loading: true, error: null }))
      const query = new URLSearchParams({
        page,
        page_size: size,
        params: AGENT_FIELDS,
        where: JSON.stringify([
          { attribute: 'provider', value: WHATSAPP_PROVIDER },
          { attribute: 'provider_type', value: CHAT_BOT_TYPE }
        ])
      })
      const response = await fetch(`${ordering.root}/ai/agents?${query}`, {
        headers: authHeaders,
        signal: abortController.signal
      })
      const content = await response.json()
      if (!response.ok || content?.error) {
        setBotsState({ loading: false, error: toErrorList(content?.result, 'ERROR'), bots: [], pagination: null })
        return
      }
      const agents = Array.isArray(content?.result) ? content.result : []
      const bots = agents.filter(isWhatsAppBot).map(toWhatsAppBot)
      setBotsState({
        loading: false,
        error: null,
        bots,
        pagination: {
          currentPage: content?.pagination?.current_page ?? page,
          pageSize: content?.pagination?.page_size ?? size,
          totalPages: content?.pagination?.total_pages ?? 1,
          total: content?.pagination?.total ?? agents.length
        }
      })
      await getBrands(bots, abortController.signal)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setBotsState({ loading: false, error: [err.message], bots: [], pagination: null })
    }
  }

  /**
   * Read one bot's settings. The list request does not ask for them.
   * @param {Number|String} id agent id from the URL
   */
  const loadBotSettings = async (id) => {
    settingsRef.current?.abort()
    const abortController = new AbortController()
    settingsRef.current = abortController
    try {
      setSettingsState({ loading: true, saving: false, error: null, saved: null, savedNotice: false })
      const query = new URLSearchParams({ params: SETTINGS_FIELDS })
      const response = await fetch(`${ordering.root}/ai/agents/${id}?${query}`, {
        headers: authHeaders,
        signal: abortController.signal
      })
      const content = await response.json()
      if (!response.ok || content?.error) {
        setSettingsState({ loading: false, saving: false, error: toErrorList(content?.result, 'ERROR'), saved: null, savedNotice: false })
        return
      }
      setSettingsState({ loading: false, saving: false, error: null, saved: readBotSettings(content?.result), savedNotice: false })
    } catch (err) {
      if (err?.name === 'AbortError') return
      setSettingsState({ loading: false, saving: false, error: [err.message], saved: null, savedNotice: false })
    }
  }

  /**
   * Save a partial settings object, and the brand when it changed.
   * `franchise_id` is a column of its own: the API then moves active
   * conversations to that brand. A rejected body leaves both as they were.
   * @param {Object} patch settings keys to merge; null deletes a key
   * @param {{ franchiseId?: number, brand?: { name?: string, logo?: string|null } }} [extra] new brand
   */
  const saveBotSettings = async (patch, extra = {}) => {
    if (!botId) return
    const settings = patch && typeof patch === 'object' ? patch : {}
    const hasSettings = Object.keys(settings).length > 0
    const franchiseId = Number(extra?.franchiseId)
    const hasFranchise = Number.isInteger(franchiseId) && franchiseId > 0
    if (!hasSettings && !hasFranchise) return
    const body = {}
    if (hasSettings) body.settings = settings
    if (hasFranchise) body.franchise_id = franchiseId
    try {
      setSettingsState(prev => ({ ...prev, saving: true, error: null }))
      const response = await fetch(`${ordering.root}/ai/agents/${botId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(body)
      })
      const content = await response.json()
      if (!response.ok || content?.error) {
        setSettingsState(prev => ({ ...prev, saving: false, savedNotice: false, error: toErrorList(content?.result, 'ERROR') }))
        return
      }
      if (hasFranchise) {
        const nextBrand = extra.brand
          ? { id: franchiseId, name: extra.brand.name || '', logo: extra.brand.logo || null }
          : null
        setBotsState(prev => ({
          ...prev,
          bots: prev.bots.map(bot => String(bot.id) !== String(botId)
            ? bot
            : { ...bot, brandId: franchiseId, brand: nextBrand || bot.brand })
        }))
      }
      setSettingsState(prev => ({
        loading: false,
        saving: false,
        error: null,
        savedNotice: true,
        saved: content?.result?.settings ? readBotSettings(content.result) : applySettingsPatch(prev.saved, settings)
      }))
    } catch (err) {
      setSettingsState(prev => ({ ...prev, saving: false, savedNotice: false, error: [err.message] }))
    }
  }

  /**
   * Turn one bot on or off. The body is only `enabled`, so a toggle cannot
   * overwrite settings, credentials or the brand. A rejection puts the row
   * back to the value it had.
   * @param {Number} id agent id
   * @param {Boolean} enabled next value
   */
  const setBotEnabled = async (id, enabled) => {
    if (typeof enabled !== 'boolean' || toggleState.savingId) return
    const previous = botsState.bots.find(bot => bot.id === id)
    if (!previous || previous.enabled === enabled) return
    setToggleState({ savingId: id, error: null })
    setBotsState(prev => ({
      ...prev,
      bots: prev.bots.map(bot => bot.id === id ? { ...bot, enabled } : bot)
    }))
    try {
      const response = await fetch(`${ordering.root}/ai/agents/${id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ enabled })
      })
      const content = await response.json()
      if (!response.ok || content?.error) {
        setBotsState(prev => ({
          ...prev,
          bots: prev.bots.map(bot => bot.id === id ? { ...bot, enabled: previous.enabled } : bot)
        }))
        setToggleState({ savingId: null, error: { id, codes: toErrorList(content?.result, 'ERROR') } })
        return
      }
      const confirmed = content?.result?.enabled
      if (typeof confirmed === 'boolean' && confirmed !== enabled) {
        setBotsState(prev => ({
          ...prev,
          bots: prev.bots.map(bot => bot.id === id ? { ...bot, enabled: confirmed } : bot)
        }))
      }
      setToggleState({ savingId: null, error: null })
    } catch (err) {
      setBotsState(prev => ({
        ...prev,
        bots: prev.bots.map(bot => bot.id === id ? { ...bot, enabled: previous.enabled } : bot)
      }))
      setToggleState({ savingId: null, error: { id, codes: [err.message] } })
    }
  }

  /**
   * One page of the brand catalog. The picker loads the next page when the
   * list scrolls to the end, the same way the AI dashboard does.
   * @param {number} page page to read
   * @param {AbortSignal} signal abort signal of the catalog request
   */
  const fetchBrandPage = async (page, signal) => {
    const query = new URLSearchParams({ page, page_size: BRAND_PAGE_SIZE, params: BRAND_CATALOG_FIELDS })
    const response = await fetch(`${ordering.root}/franchises?${query}`, { headers: authHeaders, signal })
    const content = await response.json()
    if (!response.ok || content?.error) return { error: toErrorList(content?.result, 'ERROR') }
    const brands = (Array.isArray(content?.result) ? content.result : []).filter(brand => brand?.id).map(toBrandOption)
    const current = content?.pagination?.current_page ?? page
    const total = content?.pagination?.total_pages ?? 1
    return { brands, hasNextPage: current < total }
  }

  /**
   * First page of brands for the picker. Later pages arrive from `loadMoreBrands`.
   */
  const loadBrands = async () => {
    brandsRef.current?.abort()
    const abortController = new AbortController()
    brandsRef.current = abortController
    const request = brandRequestRef.current + 1
    brandRequestRef.current = request
    loadingMoreRef.current = false
    try {
      setBrandsState({ ...emptyBrandsState(), loading: true })
      const page = await fetchBrandPage(1, abortController.signal)
      if (brandRequestRef.current !== request) return
      if (page.error) {
        setBrandsState({ ...emptyBrandsState(), loaded: true, error: page.error })
        return
      }
      setBrandsState({
        loading: false,
        loadingMore: false,
        loaded: true,
        error: null,
        brands: page.brands,
        page: 1,
        hasNextPage: page.hasNextPage
      })
    } catch (err) {
      if (err?.name === 'AbortError' || brandRequestRef.current !== request) return
      setBrandsState({ ...emptyBrandsState(), loaded: true, error: [err.message] })
    }
  }

  /**
   * Append the next brand page. A second call while one is in flight does nothing.
   */
  const loadMoreBrands = async () => {
    const current = brandsState
    if (loadingMoreRef.current || current.loading || current.loadingMore || !current.hasNextPage) return
    loadingMoreRef.current = true
    const request = brandRequestRef.current
    const nextPage = current.page + 1
    setBrandsState(prev => ({ ...prev, loadingMore: true, error: null }))
    try {
      const page = await fetchBrandPage(nextPage, brandsRef.current?.signal)
      if (brandRequestRef.current !== request) return
      if (page.error) {
        loadingMoreRef.current = false
        setBrandsState(prev => ({ ...prev, loadingMore: false, error: page.error }))
        return
      }
      loadingMoreRef.current = false
      setBrandsState(prev => {
        const seen = new Set(prev.brands.map(brand => brand.id))
        return {
          ...prev,
          loadingMore: false,
          page: nextPage,
          hasNextPage: page.hasNextPage,
          brands: [...prev.brands, ...page.brands.filter(brand => !seen.has(brand.id))]
        }
      })
    } catch (err) {
      if (err?.name === 'AbortError' || brandRequestRef.current !== request) return
      loadingMoreRef.current = false
      setBrandsState(prev => ({ ...prev, loadingMore: false, error: [err.message] }))
    }
  }

  /**
   * Create a WhatsApp bot. The payload builder fixes the provider, so the
   * form cannot ask for another one. A rejection leaves the list as it is.
   * @param {Object} input form values
   */
  const createBot = async (input) => {
    const body = createBotPayload(input)
    if (!body) return null
    try {
      setCreateState({ saving: true, error: null })
      const response = await fetch(`${ordering.root}/ai/agents`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body)
      })
      const content = await response.json()
      if (!response.ok || content?.error) {
        setCreateState({ saving: false, error: toErrorList(content?.result, 'ERROR') })
        return null
      }
      setCreateState({ saving: false, error: null })
      await getBots(1)
      return content?.result?.id ?? true
    } catch (err) {
      setCreateState({ saving: false, error: [err.message] })
      return null
    }
  }

  useEffect(() => {
    getBots(1, pageSize)
    return () => {
      controllerRef.current?.abort()
      brandsRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!botId) {
      settingsRef.current?.abort()
      setSettingsState({ loading: false, saving: false, error: null, saved: null, savedNotice: false })
      return
    }
    loadBotSettings(botId)
    return () => settingsRef.current?.abort()
  }, [botId])

  return (
    <UIComponent
      {...props}
      botsState={botsState}
      settingsState={settingsState}
      createState={createState}
      brandsState={brandsState}
      toggleState={toggleState}
      getBots={getBots}
      setBotEnabled={setBotEnabled}
      saveBotSettings={saveBotSettings}
      reloadBotSettings={() => botId && loadBotSettings(botId)}
      loadBrands={loadBrands}
      loadMoreBrands={loadMoreBrands}
      createBot={createBot}
      {...connectionProps}
    />
  )
}

/**
 * Apply a successful merge when the response does not echo `settings`.
 * @param {Object|null} saved values currently shown
 * @param {Object} patch keys that were saved
 */
const applySettingsPatch = (saved, patch) => {
  const next = saved || readBotSettings({})
  return {
    branchSelectionMode: Object.prototype.hasOwnProperty.call(patch, 'branch_selection_mode')
      ? (patch.branch_selection_mode || 'auto')
      : next.branchSelectionMode,
    primaryColor: Object.prototype.hasOwnProperty.call(patch, 'webview_primary_color')
      ? (patch.webview_primary_color || '')
      : next.primaryColor,
    secondaryColor: Object.prototype.hasOwnProperty.call(patch, 'webview_secondary_color')
      ? (patch.webview_secondary_color || '')
      : next.secondaryColor
  }
}

WhatsAppBotsList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Rows per page on the first load
   */
  pageSize: PropTypes.number,
  /**
   * Agent id from `?id=`. Empty closes the settings panel.
   */
  botId: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
}
