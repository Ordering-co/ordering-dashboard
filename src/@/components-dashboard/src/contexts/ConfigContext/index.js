import React, { createContext, useState, useContext, useEffect, useRef } from 'react'
import { useApi } from '../ApiContext'
import { useSession } from '../SessionContext'
import { useLanguage } from '../LanguageContext'
import { readFirstLoadConfigsForProject } from '~/utils/bootTheme'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

/**
 * Create ConfigContext
 * This context will manage the current configs internally and provide an easy interface
 */
export const ConfigContext = createContext()

const createInitialConfigState = (project) => {
  const configs = readFirstLoadConfigsForProject(project)
  if (!configs) return { loading: true, configs: {} }
  return { loading: false, configs }
}

/**
 * Custom provider to configs manager
 * This provider has a reducer for manage configs state
 * @param {props} props
 */
export const ConfigProvider = ({ children, settings }) => {
  const [ordering] = useApi()
  const [state, setState] = useState(() => createInitialConfigState(ordering?.project))
  const [languageState] = useLanguage()
  const [{ token }] = useSession()
  const requestSeq = useRef(0)
  const sessionStamp = `${token ?? ''}\0${ordering?.project ?? ''}`
  const [appliedSessionStamp, setAppliedSessionStamp] = useState(sessionStamp)

  // A token or project change must not keep the previous session's `fetchedWithToken`.
  // Otherwise a white-label project looks eligible while its own authenticated configs load.
  if (appliedSessionStamp !== sessionStamp) {
    setAppliedSessionStamp(sessionStamp)
    setState(prev => prev.fetchedWithToken ? { ...prev, fetchedWithToken: false } : prev)
  }

  const customConfigs = {
    max_days_preorder: {
      key: 'max_days_preorder',
      value: 6
    },
    meters_to_change_address: {
      key: 'meters_to_change_address',
      value: 500
    },
    default_order_type: {
      key: 'default_order_type',
      value: 'delivery'
    },
    order_types_allowed: {
      key: 'order_types_allowed',
      value: '1|2|3|4|5'
    },
    google_autocomplete_selection_required: {
      key: 'google_autocomplete_selection_required',
      value: 'true'
    },
    google_maps_api_key: {
      key: 'google_maps_api_key',
      value: ''
    },
    country_autocomplete: {
      key: 'country_autocomplete',
      value: '*'
    },
    track_id_google_analytics: {
      key: 'track_id_google_analytics',
      value: 'UA-51635411-4'
    }
  }

  const refreshConfigs = async () => {
    const seq = ++requestSeq.current
    const requestToken = token
    try {
      setState(prev => {
        if (seq !== requestSeq.current) return prev
        if (prev.loading || Object.keys(prev.configs).length > 0) return prev
        return { ...prev, loading: true }
      })
      const { content: { error, result } } = token
        ? await ordering.setAccessToken(token).configs().asDictionary().get()
        : await ordering.configs().asDictionary().get()
      let data = null
      try {
        const response = await fetch('https://ipapi.co/json/')
        data = await response.json()
      } catch (error) {
        data = null
      }
      const configsResult = {
        ...customConfigs,
        ...result,
        default_country_code: {
          ...result?.default_country_code,
          value: result?.default_country_code?.value || (data && data?.country_code) || 'US',
          calling_number: result?.default_country_code?.calling_number || (data && data?.country_calling_code) || '+1'
        }
      }
      setState(prevState => {
        if (seq !== requestSeq.current) return prevState
        return {
          ...prevState,
          loading: false,
          // True once a request made with the session token succeeded. `__FIRST_LOAD__` and
          // tokenless requests may only carry public configs, so account-level flags such as
          // `white_label_module` are not reliable until then. A newer token/project request
          // invalidates this one so a late response cannot mark the next session as ready.
          fetchedWithToken: Boolean(prevState.fetchedWithToken || (requestToken && !error)),
          configs: error
            ? (Object.keys(prevState.configs).length > 0 ? prevState.configs : {})
            : requestToken ? configsResult : { ...prevState.configs, ...configsResult }
        }
      })
    } catch (err) {
      setState(prev => seq === requestSeq.current ? { ...prev, loading: false } : prev)
    }
  }

  const functions = {
    refreshConfigs
  }

  useEffect(() => {
    if (!ordering?.project && !settings?.use_project_domain) {
      requestSeq.current += 1
      setState({ loading: true, configs: {} })
      return
    }
    const refreshConfigsValidation = settings?.use_project_domain
      ? !languageState.loading && ordering?.project
      : !languageState.loading

    if (refreshConfigsValidation) {
      refreshConfigs()
    }
  }, [languageState.loading, ordering?.project, token])

  return (
    <ConfigContext.Provider value={[state, functions]}>
      {children}
    </ConfigContext.Provider>
  )
}

/**
 * Hook to get and update configs state
 */
export const useConfig = () => {
  const configManager = useContext(ConfigContext)
  return configManager || [{}, async () => { }]
}
