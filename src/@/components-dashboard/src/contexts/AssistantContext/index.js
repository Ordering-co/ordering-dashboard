import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useApi } from '../ApiContext'
import { useSession } from '../SessionContext'
import { useLanguage } from '../LanguageContext'
import { useEvent } from '../EventContext'
import { createAssistantClient, getRetryAt, toAssistantLanguage, toUsage } from './client'
import { conversationReducer, initialConversationState } from './state'
import { ASSISTANT_RECORD_CHANGED, describeRecordChange, isChangeApplied } from './records'
import { ASSISTANT_NOTICE_VERSION, getAssistantNoticeLanguage } from './notice'

export { ASSISTANT_NAME } from './name'

/** User levels the assistant serves (api-ai enforces it too) */
export const ASSISTANT_ALLOWED_LEVELS = [0, 2]

// Ask again a little after `retry_at`, so the server agrees the limit is over
const RETRY_MARGIN_MS = 2000
// setTimeout's largest delay
const MAX_TIMER_MS = 2147483647
// api-ai did not answer when the limit lifted: ask again after this
const STATUS_RETRY_MS = 60000

const initialStatus = {
  loading: false,
  loaded: false,
  enabled: false,
  noticeVersion: null,
  noticeAccepted: false,
  dashboardSearchVersion: null,
  dashboardSearchPresentationVersion: null,
  usage: { near_limit: false, limited: false, retry_at: null },
  error: null
}

const storage = {
  get: (key) => {
    try {
      return window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key, value) => {
    try {
      if (value === null) window.sessionStorage.removeItem(key)
      else window.sessionStorage.setItem(key, value)
    } catch {}
  }
}

export const AssistantContext = createContext()
// Only the page entities setter, which never changes: publishers don't re-render while an answer streams
const AssistantPageContext = createContext(null)
// Whether the assistant can open and is open, for the menu: it does not change while an answer streams
const AssistantDockContext = createContext(null)

/**
 * The Dashboard assistant: Ordering's chat that answers about the project and
 * proposes changes through the MCP, always with the user's permissions. One
 * conversation at a time, shared by the side panel and the /assistant page;
 * its id stays in sessionStorage so a reload of the tab picks it up again.
 * @param {String} baseUrl api-ai URL (`ai_api.url` of config.json); without it the assistant is off
 */
export const AssistantProvider = ({ children, baseUrl }) => {
  const [ordering] = useApi()
  const [{ user, token, auth }] = useSession()
  const [languageState] = useLanguage()
  const [events] = useEvent()

  const projectCode = ordering?.project
  const language = toAssistantLanguage(languageState?.language?.code)
  // Read on each request: changing the language does not restart the client or the conversation
  const languageRef = useRef(language)
  languageRef.current = language
  const isAllowed = !!baseUrl && !!auth && !!token && !!projectCode && ASSISTANT_ALLOWED_LEVELS.includes(user?.level)
  const storageKey = isAllowed ? `assistant:${projectCode}:${user?.id}` : null

  const client = useMemo(
    () => (isAllowed ? createAssistantClient({ baseUrl, projectCode, token, language: () => languageRef.current }) : null),
    [isAllowed, baseUrl, projectCode, token]
  )

  const [status, setStatus] = useState(initialStatus)
  const [noticeState, setNoticeState] = useState({ loading: false, error: null })
  const [loadingConversation, setLoadingConversation] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [pageEntities, setPageEntities] = useState(null)
  const [state, dispatch] = useReducer(conversationReducer, initialConversationState)

  const streamRef = useRef(null)
  const loadRef = useRef(0)
  const dashboardSearchRef = useRef(null)
  const dashboardSearchRegistrationRef = useRef(0)
  const conversationIdRef = useRef(null)
  conversationIdRef.current = state.conversation?.id ?? null

  const rememberConversation = (id) => {
    if (storageKey) storage.set(`${storageKey}:conversation`, id)
  }

  const setOpen = useCallback((value) => {
    setIsOpen(prev => {
      const next = typeof value === 'function' ? value(prev) : !!value
      if (storageKey) storage.set(`${storageKey}:open`, next ? '1' : null)
      return next
    })
  }, [storageKey])

  /**
   * What a failed turn or action says about the whole assistant. `no_permission`
   * is not here: it is about that turn or change, and shows on it; only
   * `/status` locks the chat for it.
   * @param {String} code error code
   * @param {String|null} [retryAt] for `usage_limit`: when the user can write again
   */
  const applyErrorCode = (code, retryAt = null) => {
    if (code === 'usage_limit') {
      setStatus(prev => ({ ...prev, usage: { near_limit: true, limited: true, retry_at: retryAt } }))
    } else if (code === 'notice_required') {
      setStatus(prev => ({ ...prev, noticeAccepted: false }))
    }
  }

  const registerDashboardSearch = useCallback((registration) => {
    if (typeof registration?.handler !== 'function' || typeof registration?.getScope !== 'function') return () => {}
    const generation = ++dashboardSearchRegistrationRef.current
    const securityGeneration = registration.getSecurityGeneration?.()
    dashboardSearchRef.current = {
      handler: registration.handler,
      getScope: registration.getScope,
      scope: registration.getScope(),
      getSecurityGeneration: registration.getSecurityGeneration,
      securityGeneration,
      generation
    }
    return () => {
      if (dashboardSearchRef.current?.generation === generation) {
        dashboardSearchRef.current = null
        dashboardSearchRegistrationRef.current++
      }
    }
  }, [])

  const handleDashboardSearch = useCallback(async (data, signal, generation) => {
    const registration = dashboardSearchRef.current
    if (!registration ||
      data?.version !== 1 ||
      data?.scope !== registration.scope ||
      data?.scope !== registration.getScope?.() ||
      registration.getSecurityGeneration?.() !== registration.securityGeneration) return
    const registrationGeneration = registration.generation
    const conversationId = data?.conversation_id
    if (!conversationId || (conversationIdRef.current && conversationIdRef.current !== conversationId)) return
    const isCurrent = () => {
      const current = dashboardSearchRef.current
      return !signal.aborted &&
        generation === loadRef.current &&
        current?.generation === registrationGeneration &&
        current.scope === data.scope &&
        current.getScope?.() === data.scope &&
        current.getSecurityGeneration?.() === current.securityGeneration
    }
    try {
      const result = await registration.handler(data.args || {}, { signal })
      if (!isCurrent()) return
      await client.postDashboardSearchResults({
        requestId: data.request_id,
        conversationId,
        scope: data.scope,
        version: 1,
        result,
        signal
      })
    } catch (error) {
      if (!isCurrent() || error?.name === 'AbortError') return
      try {
        if (!isCurrent()) return
        await client.postDashboardSearchResults({
          requestId: data.request_id,
          conversationId,
          scope: data.scope,
          version: 1,
          result: { version: 1, scope: data.scope, revision: '', query: '', status: 'unavailable', items: [], errors: ['SEARCH_UNAVAILABLE'] },
          signal
        })
      } catch {}
    }
  }, [client])

  /**
   * Whether the assistant is on for the project and what it needs first.
   * A `quiet` refresh that fails keeps the status it had.
   */
  const loadStatus = useCallback(async ({ quiet = false } = {}) => {
    if (!client) return null
    if (!quiet) setStatus(prev => ({ ...prev, loading: true, error: null }))
    try {
      const result = await client.getStatus()
      const next = {
        loading: false,
        loaded: true,
        enabled: !!result?.enabled,
        noticeVersion: result?.notice_version ?? null,
        noticeAccepted: !!result?.notice_accepted,
        dashboardSearchVersion: result?.dashboard_search_version ?? null,
        dashboardSearchPresentationVersion: result?.dashboard_search_presentation_version ?? null,
        usage: toUsage(result?.usage),
        error: null
      }
      setStatus(next)
      return next
    } catch (err) {
      if (!quiet) setStatus(prev => ({ ...prev, loading: false, loaded: true, error: err?.code || 'error' }))
      return null
    }
  }, [client])

  const loadConversation = async (id) => {
    const load = ++loadRef.current
    streamRef.current?.abort()
    setLoadingConversation(true)
    try {
      const conversation = await client.getConversation(id)
      // The user started a new conversation meanwhile
      if (load !== loadRef.current) return
      dispatch({ type: 'loaded', conversation })
    } catch (err) {
      if (load !== loadRef.current) return
      // Deleted or pruned: start clean
      rememberConversation(null)
      dispatch({ type: 'reset' })
    } finally {
      if (load === loadRef.current) setLoadingConversation(false)
    }
  }

  // apiv4 asks for another version than the text in this build: one side was deployed without the other
  const noticeOutdated = !!status.noticeVersion && status.noticeVersion !== ASSISTANT_NOTICE_VERSION

  /** Accept the notice text of this build, in the language it was shown in */
  const acceptNotice = async () => {
    if (!client || !status.noticeVersion || noticeOutdated) return
    setNoticeState({ loading: true, error: null })
    try {
      await client.acceptNotice(ASSISTANT_NOTICE_VERSION, getAssistantNoticeLanguage(languageState?.language?.code))
      setNoticeState({ loading: false, error: null })
      setStatus(prev => ({ ...prev, noticeAccepted: true }))
    } catch (err) {
      setNoticeState({ loading: false, error: err?.code || 'error' })
    }
  }

  /**
   * Send a message and stream the answer
   * @param {String} text what the user wrote
   * @param {Object} [context] the page the user is on: `{ route, business_id, product_id, order_id }`
   * @returns {Promise<{ sent: Boolean }>} `sent: false` when the server refused it before
   *   the stream started (not stored): the caller can give the text back to the user
   */
  const sendMessage = async (text, context = null) => {
    const message = typeof text === 'string' ? text.trim() : ''
    if (!client || !message || streamRef.current) return { sent: false }

    const controller = new AbortController()
    streamRef.current = controller
    const generation = loadRef.current
    const registration = dashboardSearchRef.current
    const scope = registration?.getScope()
    const dashboardSearch = status.dashboardSearchVersion === 1 && registration && registration.scope === scope &&
      typeof scope === 'string' && scope.length > 0 && scope.length <= 200
      ? { version: 1, scope, ...(status.dashboardSearchPresentationVersion === 2 ? { presentation_version: 2 } : {}) }
      : null
    let started = false
    dispatch({ type: 'user_message', text: message })

    try {
      await client.sendMessage({
        message,
        conversationId: conversationIdRef.current,
        context,
        dashboardSearch,
        signal: controller.signal,
        onEvent: (event, data) => {
          if (generation !== loadRef.current) return
          started = true
          if (event === 'conversation' && data?.id) rememberConversation(data.id)
          if (event === 'error') applyErrorCode(data?.code, getRetryAt(data))
          if (event === 'dashboard_search') {
            void handleDashboardSearch(data, controller.signal, generation)
            return
          }
          dispatch({ type: 'stream_event', event, data })
        }
      })
      if (generation !== loadRef.current) return { sent: true }
      dispatch({ type: 'turn_finished', aborted: controller.signal.aborted })
      // Usage moves with every turn: refresh near_limit / limited
      loadStatus({ quiet: true })
      return { sent: true }
    } catch (err) {
      if (generation !== loadRef.current) return { sent: true }
      if (controller.signal.aborted || err?.name === 'AbortError') {
        dispatch({ type: 'turn_finished', aborted: true })
        return { sent: true }
      }
      applyErrorCode(err?.code, err?.retryAt)
      if (err?.code === 'not_found') {
        // The conversation is gone (deleted or pruned): the next message starts a new one
        rememberConversation(null)
        dispatch({ type: 'forget_conversation' })
      }
      dispatch({ type: 'turn_failed', code: err?.code || 'error', message: err?.message || '', unsent: !started })
      return { sent: started }
    } finally {
      if (streamRef.current === controller) streamRef.current = null
    }
  }

  /** Stop the answer: closing the stream stops the turn on the server */
  const stopMessage = () => {
    streamRef.current?.abort()
  }

  const runActions = async (ids, request) => {
    const actionIds = (ids || []).filter(id => state.actions[id] && !state.actions[id].busy)
    if (!client || actionIds.length === 0) return
    dispatch({ type: 'actions_busy', ids: actionIds, busy: true })
    try {
      const results = await request(actionIds)
      dispatch({ type: 'action_results', ids: actionIds, results })
      // Screens showing a changed record reload it (useAssistantRecordChanges)
      ;(results || []).filter(isChangeApplied).forEach(result => {
        events?.emit?.(ASSISTANT_RECORD_CHANGED, describeRecordChange(result))
      })
    } catch (err) {
      applyErrorCode(err?.code)
      dispatch({ type: 'actions_failed', ids: actionIds, code: err?.code || 'error' })
    }
  }

  const confirmActions = (ids) => runActions(ids, client?.confirmActions)
  const cancelActions = (ids) => runActions(ids, client?.cancelActions)

  const newConversation = () => {
    stopMessage()
    // Drop a stored conversation that is still loading
    loadRef.current++
    setLoadingConversation(false)
    rememberConversation(null)
    dispatch({ type: 'reset' })
  }

  const deleteConversation = async () => {
    const id = conversationIdRef.current
    newConversation()
    if (!id || !client) return
    try {
      await client.deleteConversation(id)
    } catch {}
  }

  // Load the status (and the conversation of this tab) when the assistant becomes available
  useEffect(() => {
    streamRef.current?.abort()
    loadRef.current++
    dispatch({ type: 'reset' })
    setStatus(initialStatus)
    setIsOpen(storageKey ? storage.get(`${storageKey}:open`) === '1' : false)
    if (!client) return

    let cancelled = false
    loadStatus().then(result => {
      if (cancelled || !result?.enabled || !result.noticeAccepted) return
      const storedId = storage.get(`${storageKey}:conversation`)
      if (storedId) loadConversation(storedId)
    })
    return () => { cancelled = true }
  }, [client])

  // A notice accepted now lets a stored conversation load
  useEffect(() => {
    if (!client || !status.enabled || !status.noticeAccepted || state.conversation || loadingConversation) return
    const storedId = storage.get(`${storageKey}:conversation`)
    if (storedId) loadConversation(storedId)
  }, [status.noticeAccepted])

  // A reached limit lifts at `retry_at`: check again then, without a reload
  useEffect(() => {
    const retryAt = Date.parse(status.usage.retry_at)
    if (!client || !status.usage.limited || !Number.isFinite(retryAt)) return
    const delay = Math.min(Math.max(retryAt - Date.now(), 0) + RETRY_MARGIN_MS, MAX_TIMER_MS)
    let cancelled = false
    let timer
    const check = async () => {
      const next = await loadStatus({ quiet: true })
      if (!next && !cancelled) timer = setTimeout(check, STATUS_RETRY_MS)
    }
    timer = setTimeout(check, delay)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [client, status.usage.limited, status.usage.retry_at])

  useEffect(() => () => streamRef.current?.abort(), [])

  const isAvailable = isAllowed && status.enabled
  const dock = useMemo(() => ({ isAllowed, isAvailable, isOpen, setOpen }), [isAllowed, isAvailable, isOpen, setOpen])

  const value = {
    isAllowed,
    isAvailable,
    isOpen,
    status,
    noticeState,
    loadingConversation,
    conversation: state.conversation,
    items: state.items,
    actions: state.actions,
    streaming: state.streaming,
    pageEntities,
    setPageEntities,
    setOpen,
    loadStatus,
    acceptNotice,
    noticeOutdated,
    sendMessage,
    stopMessage,
    confirmActions,
    cancelActions,
    newConversation,
    deleteConversation,
    registerDashboardSearch
  }

  return (
    <AssistantContext.Provider value={value}>
      <AssistantDockContext.Provider value={dock}>
        <AssistantPageContext.Provider value={setPageEntities}>
          {children}
        </AssistantPageContext.Provider>
      </AssistantDockContext.Provider>
    </AssistantContext.Provider>
  )
}

/**
 * Tell the assistant what the current page shows, for what the URL does not
 * say (the products page has the store slug, not its id). The ids go with
 * each message as page context; the names label the context chips. Cleared
 * when the page unmounts.
 * @param {{ business?: {id, name}, category?: {id, name}, product?: {id, name} }|null} entities
 * @param {Boolean} [enabled] false leaves the page entities alone (a picker that reuses a page controller)
 */
export const useAssistantPageEntities = (entities, enabled = true) => {
  const setPageEntities = useContext(AssistantPageContext)
  const key = JSON.stringify(entities ?? null)

  useEffect(() => {
    if (enabled) setPageEntities?.(entities ?? null)
  }, [setPageEntities, key, enabled])

  useEffect(() => {
    if (enabled) return () => setPageEntities?.(null)
  }, [setPageEntities, enabled])
}

/**
 * Run `handler` when the assistant changes a record, to reload what the
 * screen shows. It gets `{ entity, id, ids, after }` (see records.js): e.g.
 * `{ entity: 'Product', id: 220, ids: { business_id: 3, category_id: 11, product_id: 220 }, after: { price: 14 } }`.
 * The handler may change between renders; the latest one runs.
 */
export const useAssistantRecordChanges = (handler) => {
  const [events] = useEvent()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!events?.on) return
    const listener = (change) => handlerRef.current?.(change)
    events.on(ASSISTANT_RECORD_CHANGED, listener)
    return () => events.off(ASSISTANT_RECORD_CHANGED, listener)
  }, [events])
}

/**
 * `{ isAllowed, isAvailable, isOpen, setOpen }` only, for what stays on screen
 * while the user works (the menu); outside AssistantProvider it is off
 */
export const useAssistantDock = () => {
  return useContext(AssistantDockContext) || { isAllowed: false, isAvailable: false, isOpen: false, setOpen: () => {} }
}

/**
 * Hook to use the assistant; outside AssistantProvider it is off
 */
export const useAssistant = () => {
  const context = useContext(AssistantContext)
  return context || { isAllowed: false, isAvailable: false, isOpen: false, status: initialStatus, items: [], actions: {} }
}
