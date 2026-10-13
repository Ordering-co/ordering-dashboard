import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const Dashboard = (props) => {
  const {
    UIComponent,
    appId,
    type
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [orderingTheme, setOrderingTheme] = useState({ loading: false, themes: [], error: null, siteId: null })
  const [site, setSite] = useState(null)
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })

  const requestBase = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }

  /**
 * Update form data
 * @param {EventTarget} e Related HTML event
 */
  const handleChangeInput = (e) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        [e.target.name]: e.target.value
      }
    })
    setSite({
      ...site,
      [e.target.name]: e.target.value
    })
  }

  /**
 * Method to get the themes from API
 */
  const getSites = async () => {
    try {
      setOrderingTheme({
        ...orderingTheme,
        loading: true
      })
      const requestOptions = {
        ...requestBase,
        method: 'GET'
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        const findByType = result.find(site => site.type === type)
        const found = result.find(site => site.code === appId)
        if (findByType) {
          if (findByType.code !== appId) {
            const siteFound = { ...findByType, code: appId }
            handleUpdateSite(siteFound)
          } else {
            setSite(found)
          }
        } else if (found) {
          const siteFound = { ...found, type }
          handleUpdateSite(siteFound)
        } else {
          await handleAddSite(type)
        }
      }
      setOrderingTheme({
        ...orderingTheme,
        loading: false
      })
    } catch (err) {
      setOrderingTheme({
        ...orderingTheme,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
 * Function to add new site from API
 */
  const handleAddSite = async () => {
    try {
      const initialData = {
        code: 'web_dashboard_x',
        name: 'Dashboard',
        type
      }
      const requestOptions = {
        ...requestBase,
        body: JSON.stringify(initialData)
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setSite(result)
        getSites()
      } else {
        setOrderingTheme({
          ...orderingTheme,
          loading: false,
          themes: [],
          error: result
        })
      }
    } catch (err) {
      setOrderingTheme({
        ...orderingTheme,
        loading: false,
        result: [err.message]
      })
    }
  }

  const handleUpdateSite = async (siteFound) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const seoOptions = {
        ...requestBase,
        body: JSON.stringify(siteFound ? { type: siteFound?.type, code: siteFound?.code } : formState.changes)
      }

      const response = await fetch(`${ordering.root}/sites/${siteFound?.id ?? site.id}`, seoOptions)
      const { error, result } = await response.json()
      if (!error) {
        setSite(result)
        setFormState({ loading: false, changes: {}, error: null })
        showToast(ToastType.Success, t('UPDATED_SUCCESSFULLY', 'Updated successfully'))
      } else {
        showToast(ToastType.Error, result)
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  useEffect(() => {
    if (!appId || !type) return
    getSites()
  }, [appId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          orderingTheme={orderingTheme}
          site={site}
          setSite={setSite}
          formState={formState}
          handleChangeInput={handleChangeInput}
          handleUpdateSite={handleUpdateSite}
        />
      )}
    </>
  )
}

Dashboard.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
