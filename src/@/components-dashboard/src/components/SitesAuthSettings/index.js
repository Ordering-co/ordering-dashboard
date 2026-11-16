import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { getSettingsSitesWhere } from '../../utils/settingsAccess'

/**
 * Component to manage sites auth settings behavior without UI component
 */
export const SitesAuthSettings = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [sitesState, setSitesState] = useState({ loading: true, sites: [], error: null })
  const [siteConfigsState, setSiteConfigsState] = useState({ loading: false, configs: [], error: null })
  const [siteGroupConfigsState, setSiteGroupConfigsState] = useState({ loading: false, categories: [] })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  /**
   * Method to get the sites from API
   */
  const handleGetSitesList = async () => {
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const where = getSettingsSitesWhere() || {}
      const response = await fetch(`${ordering.root}/sites?${Object.keys(where).length ? 'where=' + JSON.stringify(where) : ''}`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setSitesState({
          loading: false,
          sites: result,
          error: null
        })
      } else {
        setSitesState({
          ...sitesState,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setSitesState({
        ...sitesState,
        loading: false,
        error: [error.message]
      })
    }
  }

  /**
   * Method to get the site configs from API
   */
  const handleGetSiteConfigs = async (siteId) => {
    try {
      setSiteConfigsState({
        ...siteConfigsState,
        loading: true
      })
      setSiteGroupConfigsState({
        loading: true,
        categories: []
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites/${siteId}/configs`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        const rankResult = result?.sort((a, b) => (a?.rank && b?.rank) ? a.rank - b.rank : 0)
        setSiteConfigsState({ loading: false, configs: rankResult, error: null })
        if (rankResult.length) {
          const groupedConfigs = rankResult.reduce((acc, config) => {
            const categoryId = config.config_category_id
            if (!acc[categoryId]) {
              acc[categoryId] = {
                config_category_id: categoryId,
                name: config?.config_category?.name,
                description: config?.config_category?.description,
                rank: config?.config_category?.rank,
                configs: [config]
              }
            } else {
              acc[categoryId].configs.push(config)
            }
            return acc
          }, {})

          const sortedCategories = Object.values(groupedConfigs).sort((a, b) => {
            if (a.rank === null && b.rank === null) return 0
            if (a.rank === null) return 1
            if (b.rank === null) return -1
            return a.rank - b.rank
          })

          setSiteGroupConfigsState({
            loading: false,
            categories: sortedCategories
          })
        }
      } else {
        setSiteConfigsState({ ...siteConfigsState, error: result })
      }
    } catch (error) {
      setSiteConfigsState({
        ...siteConfigsState,
        loading: false,
        error: [error.message]
      })
      setSiteGroupConfigsState({
        loading: false,
        categories: []
      })
    }
  }

  /**
   * Method to update the site config from API
   */
  const handleChangeConfig = async (value, siteId, configId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ value })
      }
      const response = await fetch(`${ordering.root}/sites/${siteId}/configs/${configId}`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setActionState({ loading: false, error: null })
        showToast(ToastType.Success, t('SETTINGS_UPDATE', 'Settings updated'))
      } else {
        setActionState({ loading: false, error: result })
      }
    } catch (error) {
      setActionState({
        loading: false,
        error: [error.message]
      })
    }
  }

  /**
   * n.1 (D-56 a): saves a batch of pending site configs, one PUT per config in the order given (the same endpoint and
   * `{ value }` body as `handleChangeConfig`), with one «Loading» and, if all went well, one «Settings updated» toast for the
   * whole batch. It stops at the first failure. What was stored becomes the base value of the loaded configs, so a later Discard
   * restores it and not the value from before the save. The error is returned (not set in `actionState`): inside the hub the
   * save bar shows it, so the legacy Alert must not open too. `handleChangeConfig` is untouched, for the screen outside the hub.
   *
   * @param {Array<{ id: number, value: any }>} changes
   * @param {number} siteId
   * @returns {Promise<{ savedCount: number, failedId: number | null, error: any }>} `error` is the API result (a list of messages) or null
   */
  const handleSaveConfigs = async (changes, siteId) => {
    const saved = []
    const applySaved = () => {
      if (!saved.length) return
      const valueOf = new Map(saved.map(change => [change.id, change.value]))
      const withBase = (config) => valueOf.has(config?.id) ? { ...config, value: valueOf.get(config.id) } : config
      setSiteConfigsState(current => ({ ...current, configs: (current.configs || []).map(withBase) }))
      setSiteGroupConfigsState(current => ({
        ...current,
        categories: (current.categories || []).map(category => ({ ...category, configs: category.configs.map(withBase) }))
      }))
    }
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      for (const change of changes) {
        const requestOptions = {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ value: change.value })
        }
        const response = await fetch(`${ordering.root}/sites/${siteId}/configs/${change.id}`, requestOptions)
        const { error, result } = await response.json()
        if (error) {
          applySaved()
          setActionState({ loading: false, error: null })
          return { savedCount: saved.length, failedId: change.id, error: result }
        }
        saved.push(change)
      }
      applySaved()
      setActionState({ loading: false, error: null })
      showToast(ToastType.Success, t('SETTINGS_UPDATE', 'Settings updated'))
      return { savedCount: saved.length, failedId: null, error: null }
    } catch (error) {
      applySaved()
      setActionState({ loading: false, error: null })
      return { savedCount: saved.length, failedId: changes[saved.length]?.id ?? null, error: [error.message] }
    }
  }

  useEffect(() => {
    handleGetSitesList()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          sitesState={sitesState}
          siteConfigsState={siteConfigsState}
          siteGroupConfigsState={siteGroupConfigsState}
          actionState={actionState}
          handleGetSiteConfigs={handleGetSiteConfigs}
          handleChangeConfig={handleChangeConfig}
          handleSaveConfigs={handleSaveConfigs}
        />
      )}
    </>
  )
}

SitesAuthSettings.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
