import React, { createContext, useState, useContext, useEffect } from 'react'
import { useApi } from '../ApiContext'

/**
 * Create LanguageContext
 * This context will manage the current languages internally and provide an easy interface
 */
export const LanguageContext = createContext()

/**
 * Custom provider to languages manager
 * This provider has a reducer for manage languages state
 * @param {props} props
 */
export const LanguageProvider = ({ children, strategy, settings }) => {
  const [state, setState] = useState({
    loading: true,
    dictionary: {},
    languageList: []
  })

  /**
   * Load language from localstorage and set state or load default language
   */
  const setLanguageFromLocalStorage = async () => {
    const language = await strategy.getItem('language', true)
    if (language) {
      setState(prevState => ({ ...prevState, language }))
      apiHelper.setLanguage(language?.code)
    }
  }

  const [ordering, apiHelper] = useApi()

  const refreshTranslations = async () => {
    try {
      !state.loading && setState({ ...state, loading: true })
      let params = {}
      const conditons = []
      const appInternalName = settings?.app_internal_name ?? null
      if (appInternalName) {
        conditons.push({
          attribute: 'product',
          value: appInternalName
        })
        params = {
          ...params,
          version: 'v2'
        }
      }
      const { content: { error, result } } = await ordering.translations().parameters(params).where(conditons).asDictionary().get()
      setState(prevState => ({
        ...prevState,
        loading: false,
        dictionary: error ? {} : result
      }))
    } catch (err) {
      setState(prevState => ({ ...prevState, loading: false }))
    }
  }

  // `fromSelector` is still accepted (the account selector passes it) but no longer changes anything.
  const setLanguage = async (language, fromSelector) => {
    if (!language || language.id === state.language?.id) return
    try {
      // redesign (D4, M-02): the account selector changes only this user's language; the project default is set in Settings › Languages.
      const { content: { error, result } } = await ordering.languages().where([{ attribute: 'id', value: language.id }]).get()

      if (!error) {
        if (!result?.[0]) return
        const defaultLanguage = { id: result[0].id, code: result[0].code, rtl: result[0].rtl }
        await strategy.setItem('language', defaultLanguage, true)
        const _languageList = state.languageList.filter(_language => {
          if (_language.id === language.id) {
            Object.assign(_language, language)
          }
          return true
        })
        setState({ ...state, language: defaultLanguage, languageList: _languageList })
        apiHelper.setLanguage(language?.code)
      }
    } catch (err) {
      setState({ ...state, loading: false })
    }

    location.reload()
  }

  const refreshLanguages = async () => {
    try {
      setState({ ...state, loading: true })
      const { content: { error, result } } = await ordering.languages().get()
      if (!error) {
        const language = await strategy.getItem('language', true)
        const localLanguage = language ? result.find(_language => _language.id === language.id) : { enabled: false }
        const _defaultLanguage = (language && localLanguage.enabled) ? language : result.find(language => language.default)
        const defaultLanguage = { id: _defaultLanguage.id, code: _defaultLanguage.code, rtl: _defaultLanguage.rtl }
        await strategy.setItem('language', defaultLanguage, true)
        apiHelper.setLanguage(defaultLanguage?.code)
        setState(prevState => ({
          ...prevState,
          loading: false,
          language: defaultLanguage,
          languageList: result
        }))
      }
    } catch (err) {
      setState({ ...state, loading: false })
    }
  }

  const updateLanguageListState = (updatedLanguage) => {
    // The API keeps a single default language: when one becomes the default, the rest stop being it.
    setState(prevState => ({
      ...prevState,
      languageList: (prevState.languageList || []).map(language => {
        if (language.id === updatedLanguage.id) return { ...language, ...updatedLanguage }
        return updatedLanguage.default === true ? { ...language, default: false } : language
      })
    }))
  }

  /**
   * Refresh translation when change language from ordering
   */
  useEffect(() => {
    if (!ordering?.project) return
    if (state.language?.code && state.language?.code === ordering.language) {
      refreshTranslations()
    }
  }, [state.language?.code, ordering?.project, ordering.language])

  useEffect(() => {
    setLanguageFromLocalStorage()
    if (!ordering?.project) return
    refreshLanguages()
  }, [ordering?.language, ordering?.project])

  const t = (key, fallback = null) => {
    let originalKey = key
    const appInternalName = settings?.app_internal_name ?? null
    if (appInternalName !== null) {
      const prefix = `${appInternalName.toUpperCase()}_`
      if (!key?.startsWith?.(prefix)) {
        key = `${prefix}${key}`
      } else {
        originalKey = key.substring(prefix.length)
      }
    }
    const textValue = state?.dictionary?.[key] ?? state?.dictionary?.[originalKey] ?? fallback ?? key

    return textValue
  }

  const functions = {
    setLanguage,
    updateLanguageListState,
    refreshTranslations
  }

  return (
    <LanguageContext.Provider value={[state, t, functions]}>
      {children}
    </LanguageContext.Provider>
  )
}

/**
 * Hook to get and update language state
 */
export const useLanguage = () => {
  const languageManager = useContext(LanguageContext)
  return languageManager || [{}, (key, fallback = null) => fallback || key, async () => {}, async () => {}]
}
