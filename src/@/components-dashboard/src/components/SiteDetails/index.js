import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { applySiteLogoHeaderSync } from '../../utils'

export const SiteDetails = (props) => {
  const {
    site,
    sitesList,
    UIComponent,
    handleSuccessUpdateSites
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()

  const [siteState, setSiteState] = useState({ site: site || {}, loading: false, error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })
  const [isAddMode, setIsAddMode] = useState(false)

  /**
   * Clean formState
   */
  const cleanFormState = () => setFormState({ loading: false, changes: {}, error: null })

  /**
   * Update form data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    const { name, value } = e.target
    setFormState((prev) => ({
      ...prev,
      changes: {
        ...prev.changes,
        [name]: value
      }
    }))
  }

  /**
   * Update business photo data
   * @param {File} file Image to change business photo
   */
  const handlechangeImage = (file, name) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState((prev) => ({
        ...prev,
        changes: {
          ...prev.changes,
          [name]: reader.result
        }
      }))
    }
  }

  /**
   * Function to update site details from API
   */
  const handleUpdateSite = async (_changes) => {
    try {
      const rawChanges = _changes && typeof _changes === 'object' ? _changes : formState.changes
      if (!rawChanges || Object.keys(rawChanges).length === 0) return
      const changesToSend = applySiteLogoHeaderSync(rawChanges, siteState.site)

      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState((prev) => ({
        ...prev,
        loading: true
      }))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changesToSend)
      }
      const response = await fetch(`${ordering.root}/sites/${site.id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setSiteState({
          ...siteState,
          site: content.result
        })
        cleanFormState()
        if (content.result?.code === 'website') {
          window.localStorage.setItem('website_site_details', JSON.stringify(content.result))
        }
        if (handleSuccessUpdateSites) {
          const updatedSites = sitesList.filter(_site => {
            if (_site.id === site.id) {
              Object.assign(_site, content.result)
            }
            return true
          })
          handleSuccessUpdateSites(updatedSites)
        }
        showToast(ToastType.Success, t('SITE_SAVED', 'Site saved'))
      } else {
        setFormState((prev) => ({
          ...prev,
          loading: false,
          error: content.result
        }))
      }
    } catch (err) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  /**
   * Function to delete the site from API
   */
  const handleDeleteSite = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({
        ...formState,
        loading: true
      })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites/${site.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        if (handleSuccessUpdateSites) {
          const updatedSites = sitesList.filter(_site => _site.id !== site.id)
          handleSuccessUpdateSites(updatedSites)
        }
        showToast(ToastType.Success, t('SITE_DELETED', 'Site deleted'))
        props.onClose && props.onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Function to add new site from API
   */
  const handleAddSite = async (_changes) => {
    try {
      const changesToSend = _changes && typeof _changes === 'object' ? { ...formState.changes, ..._changes } : formState.changes
      if (!changesToSend || Object.keys(changesToSend).length === 0) return

      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState((prev) => ({
        ...prev,
        loading: true
      }))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changesToSend)
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        cleanFormState()
        showToast(ToastType.Success, t('SITE_ADDED', 'Site added'))
        if (handleSuccessUpdateSites) {
          handleSuccessUpdateSites([...sitesList, content.result])
        }
        props.onClose && props.onClose()
      } else {
        setFormState((prev) => ({
          ...prev,
          loading: false,
          error: content.result
        }))
      }
    } catch (err) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  useEffect(() => {
    if (sitesList?.length > 0) {
      const websiteSite = sitesList.find(s => s?.code === 'website')
      if (websiteSite) {
        window.localStorage.setItem('website_site_details', JSON.stringify(websiteSite))
      }
    }
  }, [sitesList])

  useEffect(() => {
    if (site) {
      setIsAddMode(false)
      cleanFormState()
      setSiteState({
        ...siteState,
        site
      })
    } else {
      setIsAddMode(true)
      setSiteState({
        ...siteState,
        site: {}
      })
    }
  }, [site])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            siteState={siteState}
            formState={formState}
            isAddMode={isAddMode}
            handleChangeInput={handleChangeInput}
            handlechangeImage={handlechangeImage}
            handleUpdateSite={handleUpdateSite}
            handleDeleteSite={handleDeleteSite}
            handleAddSite={handleAddSite}
          />
        )
      }
    </>
  )
}

SiteDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
