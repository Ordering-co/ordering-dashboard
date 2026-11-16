import { useEffect, useRef, useState } from 'react'
import {
  applyTranslationPatch,
  buildTranslationPatch,
  CHATBOT_TRANSLATION_LOCALES,
  createTranslationDraft,
  normalizeTranslationCatalog,
  validateTranslationDraft
} from './botTranslations'
const emptyLocaleState = () => ({
  loaded: false,
  loading: false,
  saving: false,
  error: null,
  savedNotice: false,
  catalog: {},
  draft: {}
})

const errorList = (result, fallback) => {
  if (Array.isArray(result)) return result.length ? result.map(String) : [fallback]
  if (typeof result === 'string' && result) return [result]
  return [fallback]
}

export const useBotTranslations = ({ botId, root, token }) => {
  const [locale, setLocaleState] = useState('en')
  const [locales, setLocales] = useState({})
  const localesRef = useRef({})
  const botIdRef = useRef(botId)
  const loadRef = useRef(null)
  const saveRefs = useRef(new Set())

  botIdRef.current = botId

  const updateLocale = (targetLocale, updater) => {
    const current = localesRef.current[targetLocale] || emptyLocaleState()
    const next = updater(current)
    localesRef.current = { ...localesRef.current, [targetLocale]: next }
    setLocales(localesRef.current)
  }

  const loadTranslations = async (targetLocale, targetBotId = botId) => {
    if (!targetBotId || !CHATBOT_TRANSLATION_LOCALES.includes(targetLocale)) return
    loadRef.current?.abort()
    const abortController = new AbortController()
    loadRef.current = abortController
    updateLocale(targetLocale, current => ({ ...current, loading: true, error: null, savedNotice: false }))
    try {
      const query = new URLSearchParams({ catalog: 'chatbot', locale: targetLocale })
      const response = await fetch(`${root}/ai/agents/${targetBotId}/translations?${query}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        signal: abortController.signal
      })
      const content = await response.json()
      if (abortController.signal.aborted || String(botIdRef.current) !== String(targetBotId)) return
      if (!response.ok || content?.error) {
        updateLocale(targetLocale, current => ({
          ...current,
          loaded: false,
          loading: false,
          error: errorList(content?.result, 'ERROR')
        }))
        return
      }
      const catalog = normalizeTranslationCatalog(content?.result ?? content)
      updateLocale(targetLocale, current => ({
        ...current,
        loaded: true,
        loading: false,
        error: null,
        catalog,
        draft: createTranslationDraft(catalog)
      }))
    } catch (err) {
      if (err?.name === 'AbortError' || String(botIdRef.current) !== String(targetBotId)) return
      updateLocale(targetLocale, current => ({
        ...current,
        loaded: false,
        loading: false,
        error: [err.message]
      }))
    }
  }

  const setTranslationLocale = (nextLocale) => {
    if (!CHATBOT_TRANSLATION_LOCALES.includes(nextLocale) || nextLocale === locale) return
    setLocaleState(nextLocale)
    if (botId && !localesRef.current[nextLocale]?.loaded) loadTranslations(nextLocale)
  }

  const updateTranslationDraft = (key, value) => {
    updateLocale(locale, current => ({
      ...current,
      savedNotice: false,
      draft: { ...current.draft, [key]: value }
    }))
  }

  const saveBotTranslations = async () => {
    const targetBotId = botId
    const targetLocale = locale
    const current = localesRef.current[targetLocale] || emptyLocaleState()
    const patch = buildTranslationPatch(current.catalog, current.draft)
    const validation = validateTranslationDraft(current.catalog, current.draft)
    if (!targetBotId || current.saving || Object.keys(patch).length === 0 || Object.keys(validation).length > 0) return
    const abortController = new AbortController()
    saveRefs.current.add(abortController)
    updateLocale(targetLocale, state => ({ ...state, saving: true, error: null, savedNotice: false }))
    try {
      const query = new URLSearchParams({ catalog: 'chatbot', locale: targetLocale })
      const response = await fetch(`${root}/ai/agents/${targetBotId}/translations?${query}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ translations: { [targetLocale]: patch } }),
        signal: abortController.signal
      })
      const content = await response.json()
      if (abortController.signal.aborted || String(botIdRef.current) !== String(targetBotId)) return
      if (!response.ok || content?.error) {
        updateLocale(targetLocale, state => ({
          ...state,
          saving: false,
          error: errorList(content?.result, 'ERROR')
        }))
        return
      }
      updateLocale(targetLocale, state => {
        const catalog = applyTranslationPatch(state.catalog, patch)
        return {
          ...state,
          saving: false,
          error: null,
          savedNotice: true,
          catalog,
          draft: createTranslationDraft(catalog)
        }
      })
    } catch (err) {
      if (err?.name === 'AbortError' || String(botIdRef.current) !== String(targetBotId)) return
      updateLocale(targetLocale, state => ({ ...state, saving: false, error: [err.message] }))
    } finally {
      saveRefs.current.delete(abortController)
    }
  }

  useEffect(() => {
    loadRef.current?.abort()
    saveRefs.current.forEach(controller => controller.abort())
    saveRefs.current.clear()
    localesRef.current = {}
    setLocales({})
    setLocaleState('en')
    if (botId) loadTranslations('en', botId)
    return () => {
      loadRef.current?.abort()
      saveRefs.current.forEach(controller => controller.abort())
    }
  }, [botId])

  const current = locales[locale] || emptyLocaleState()
  return {
    translationsState: {
      locale,
      ...current,
      validation: validateTranslationDraft(current.catalog, current.draft),
      patch: buildTranslationPatch(current.catalog, current.draft)
    },
    setTranslationLocale,
    updateTranslationDraft,
    saveBotTranslations,
    reloadBotTranslations: () => loadTranslations(locale)
  }
}
