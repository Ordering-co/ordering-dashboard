import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const SiteTheme = (props) => {
  const {
    siteId,
    UIComponent
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [siteThemesState, setSiteThemesState] = useState({ loading: true, result: [], error: null })
  const [themesList, setThemesList] = useState({ loading: true, result: [], error: null })
  const [selectedTheme, setSelectedTheme] = useState(null)
  const [actionState, setActionState] = useState({ loading: false, error: null })

  /**
   * Method to get the themes from API
   */
  const getThemes = async () => {
    try {
      setThemesList({
        ...themesList,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/themes`, requestOptions)
      const { error, result } = await response.json()
      setThemesList({
        loading: false,
        result: error ? [] : result,
        error: error ? result : null
      })
    } catch (err) {
      setThemesList({
        ...themesList,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to get the site theme from API
   */
  const getSiteTheme = async () => {
    try {
      setSiteThemesState({
        ...siteThemesState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites/${siteId}/themes`, requestOptions)
      const { error, result } = await response.json()
      setSiteThemesState({
        loading: false,
        result: error ? [] : result,
        error: error ? result : null
      })
    } catch (err) {
      setSiteThemesState({
        ...siteThemesState,
        loading: false,
        error: [err.message]
      })
    }
  }

  const handleSelectTheme = (themeId) => {
    const _selectedTheme = themesList.result.find(theme => theme.id === themeId)
    setSelectedTheme(_selectedTheme)
  }

  /**
   * Method to assign the theme to site
   */
  const handleAssignTheme = async (options) => {
    try {
      setActionState({ ...actionState, loading: true })
      // redesign `options.inlineError` = the caller says the error inline, so no Loading toast
      if (options?.inlineError !== true) showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          theme_id: selectedTheme?.id,
          values: JSON.stringify(selectedTheme?.values_default)
        })
      }
      const response = await fetch(`${ordering.root}/sites/${siteId}/themes`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('THEME_ADDED', 'Theme added'))
        getSiteTheme()
      }
      setActionState({
        loading: false,
        error: error ? result : null
      })
      return { error: !!error, result }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
      return { error: true, result: [err.message] }
    }
  }

  /**
   * Method to update the site theme from API
   */
  const handleUpdateSiteTheme = async (values, options) => {
    try {
      setActionState({ ...actionState, loading: true })
      // redesign see handleAssignTheme
      if (options?.inlineError !== true) showToast(ToastType.Info, t('LOADING', 'Loading'))
      const themeId = siteThemesState.result[0]?.theme_id
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          values: JSON.stringify(values)
        })
      }
      const response = await fetch(`${ordering.root}/sites/${siteId}/themes/${themeId}`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('THEME_UPDATED', 'Theme updated'))
        // redesign (OP-12): replace the site theme record instead of appending to the array
        // (the API may answer an array or a single object, so never spread `result`)
        let nextResult = siteThemesState.result
        if (Array.isArray(result)) {
          nextResult = result
        } else if (result && typeof result === 'object') {
          // the request sends `values` as JSON text: an answer that echoes it gives text back, the record keeps an object
          const answered = result.values ?? values
          let nextValues = answered
          if (typeof answered === 'string') {
            try { nextValues = JSON.parse(answered) } catch (error) { nextValues = values }
          }
          nextResult = [{ ...siteThemesState.result[0], ...result, values: nextValues }]
        }
        setSiteThemesState({
          ...siteThemesState,
          result: nextResult
        })
      }
      setActionState({
        loading: false,
        error: error ? result : null
      })
      return { error: !!error, result }
    } catch (err) {
      setActionState({
        loading: false,
        error: [err.message]
      })
      return { error: true, result: [err.message] }
    }
  }

  /**
   * Method to add the theme gallery item from API
   */
  const handleAddThemeGallery = async (base64Image) => {
    // redesign a failed request now resolves to `{ error: true, result: [message] }` instead of throwing
    try {
      const themeId = siteThemesState.result[0]?.theme_id
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'image',
          file: base64Image
        })
      }
      const response = await fetch(`${ordering.root}/themes/${themeId}/gallery`, requestOptions)
      return await response.json()
    } catch (err) {
      return { error: true, result: [err.message] }
    }
  }

  useEffect(() => {
    getSiteTheme()
  }, [siteId])

  useEffect(() => {
    getThemes()
  }, [])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            siteThemesState={siteThemesState}
            themesList={themesList}
            actionState={actionState}
            selectedTheme={selectedTheme}
            handleSelectTheme={handleSelectTheme}
            handleAssignTheme={handleAssignTheme}
            handleUpdateSiteTheme={handleUpdateSiteTheme}
            handleAddThemeGallery={handleAddThemeGallery}
            getSiteTheme={getSiteTheme}
            getThemes={getThemes}
          />
        )
      }
    </>
  )
}

SiteTheme.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
