import React, { createContext, useContext, useEffect, useState } from 'react'
import { Ordering } from '../../sdk/lib/index'

/**
 * Create ApiContext
 * Context to use Ordering API on the app
 */
export const ApiContext = createContext()

/**
 * Api provider to manage api request
 * @param {props} props
 */
const buildApiSettings = (settings) => ({
  ...settings.api,
  project: settings.project,
  appId: settings.app_id,
  appInternalName: settings.app_internal_name
})

export const ApiProvider = ({ settings, children }) => {
  const [apiSettings, setApiSettings] = useState(() => buildApiSettings(settings))
  const [ordering, setOrdering] = useState(() => new Ordering(apiSettings))
  const [language, setLanguage] = useState(settings.api.language)
  const [configurations, setConfigurations] = useState(settings?.configurations)
  const _setLanguage = (languageCode) => {
    if (languageCode === language) return
    setLanguage(languageCode)
  }

  useEffect(() => {
    const nextApiSettings = { ...buildApiSettings(settings), language }
    setApiSettings(nextApiSettings)
    setOrdering(new Ordering(nextApiSettings))
    setConfigurations(settings?.configurations)
  }, [settings])

  useEffect(() => {
    if (ordering.language === language) return
    setOrdering(new Ordering({ ...apiSettings, language }))
  }, [language])

  const functions = {
    configurations,
    setLanguage: _setLanguage
  }

  return (
    <ApiContext.Provider value={[ordering, functions]}>
      {children}
    </ApiContext.Provider>
  )
}

/**
 * Hook to get api state
 */
export const useApi = () => {
  const apiManager = useContext(ApiContext)
  return apiManager || [{}]
}
