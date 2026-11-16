import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Component to manage sites auth settings behavior without UI component
 */
export const MultiCountrySettings = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [countryState, setCountryState] = useState({ loading: true, countries: [], error: null })
  const [countryConfigState, setCountryConfigState] = useState({ loading: false, configs: [], error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  /**
   * Method to get the countries from API
   */
  const handleGetCountryList = async () => {
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/countries`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setCountryState({
          loading: false,
          countries: result,
          error: null
        })
      } else {
        setCountryState({
          ...countryState,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setCountryState({
        ...countryState,
        loading: false,
        error: [error.message]
      })
    }
  }

  /**
   * Method to get the country configs from API
   */
  const handleGetContryConfigs = async (countryId) => {
    try {
      setCountryConfigState({
        ...countryConfigState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/countries/${countryId}/configs`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setCountryConfigState({ loading: false, configs: result, error: null })
      } else {
        setCountryConfigState({ ...countryConfigState, error: result })
      }
    } catch (error) {
      setCountryConfigState({
        ...countryConfigState,
        loading: false,
        error: [error.message]
      })
    }
  }

  /**
   * Method to update the country config from API
   */
  const handleChangeConfig = async (value, countryId, configId) => {
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
      const response = await fetch(`${ordering.root}/countries/${countryId}/configs/${configId}`, requestOptions)
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
   * n.1 (D-56 a): saves a batch of pending country configs, one PUT per config in the order given (the same endpoint and
   * `{ value }` body as `handleChangeConfig`), with one «Loading» and, if all went well, one «Settings updated» toast for the
   * whole batch. It stops at the first failure. What was stored becomes the base value of the loaded configs, so a later Discard
   * restores it and not the value from before the save. The error is returned (not set in `actionState`): inside the hub the
   * save bar shows it, so the legacy Alert must not open too. `handleChangeConfig` is untouched, for the screen outside the hub.
   *
   * @param {Array<{ id: number, value: any }>} changes
   * @param {number} countryId
   * @returns {Promise<{ savedCount: number, failedId: number | null, error: any }>} `error` is the API result (a list of messages) or null
   */
  const handleSaveConfigs = async (changes, countryId) => {
    const saved = []
    const applySaved = () => {
      if (!saved.length) return
      const valueOf = new Map(saved.map(change => [change.id, change.value]))
      setCountryConfigState(current => ({
        ...current,
        configs: (current.configs || []).map(config => valueOf.has(config?.id) ? { ...config, value: valueOf.get(config.id) } : config)
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
        const response = await fetch(`${ordering.root}/countries/${countryId}/configs/${change.id}`, requestOptions)
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
    handleGetCountryList()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          countryState={countryState}
          countryConfigState={countryConfigState}
          actionState={actionState}
          handleGetContryConfigs={handleGetContryConfigs}
          handleChangeConfig={handleChangeConfig}
          handleSaveConfigs={handleSaveConfigs}
        />
      )}
    </>
  )
}

MultiCountrySettings.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
