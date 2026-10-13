import React, { useEffect, useState, useContext, createContext } from 'react'
import { useSession } from '../SessionContext'
import { useApi } from '../ApiContext'
import { useConfig } from '../ConfigContext'

export const SiteContext = createContext()

export const SiteProvider = ({ children }) => {
  const [ordering] = useApi()
  const [session] = useSession()
  const [configState] = useConfig()
  const [siteState, setSiteState] = useState({ site: null, loading: false, error: null })

  /**
   * Method to get the themes from API
   */
  const getSites = async () => {
    try {
      setSiteState({ ...siteState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        let site = result.find(site => site?.type === 'franchiseweb')
        if (!site) {
          site = result.find(site => site?.type === 'web_marketplace_26')
          if (!site) {
            site = result.find(site => site?.code === 'website')
          }
        }
        setSiteState({ ...siteState, loading: false, site, sites: result })
      } else {
        setSiteState({ ...siteState, loading: false, error: result })
      }
    } catch (err) {
      setSiteState({ ...siteState, loading: false, error: [err.message] })
    }
  }

  const functions = {
    setSiteState,
    getSites
  }

  useEffect(() => {
    if (configState?.loading) return
    if (session.auth) {
      getSites()
    }
  }, [session.auth, configState?.loading])

  return (
    <SiteContext.Provider value={[siteState, functions]}>
      {children}
    </SiteContext.Provider>
  )
}

export const useSite = () => {
  const siteManager = useContext(SiteContext)
  return siteManager || [{}, () => {}]
}
