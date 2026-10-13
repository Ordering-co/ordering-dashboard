import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Component to manage ad banners behavior without UI component
 */
export const AdBannersList = (props) => {
  const {
    defaultPosition,
    UIComponent
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [bannersListState, setBannersListState] = useState({ loading: true, banners: [], error: null })
  const [sitesState, setSitesState] = useState({ loading: false, sites: [], error: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })

  /**
   * Method to get the ad banners from API
   */
  const getAdBanners = async () => {
    try {
      setBannersListState({
        ...bannersListState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      let where = []
      const conditions = []
      if (defaultPosition) {
        conditions.push(
          {
            attribute: 'position',
            value: defaultPosition
          }
        )
      }

      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      const response = await fetch(`${ordering.root}/banners?where=${JSON.stringify(where)}`, requestOptions)
      const content = await response.json()
      setBannersListState({
        loading: false,
        banners: content.error ? [] : content.result,
        error: content.error ? content.result : null
      })
    } catch (error) {
      setBannersListState({
        ...bannersListState,
        loading: false,
        error: [error.message]
      })
    }
  }

  /**
   * Method to update the banner from API
   */
  const handleUpdateBanner = async (payload, bannerId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }

      const response = await fetch(`${ordering.root}/banners/${bannerId}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        const updatedBanners = bannersListState.banners.filter(banner => {
          if (banner.id === content.result?.id) {
            Object.assign(banner, content.result)
          }
          return true
        })
        setBannersListState({
          ...bannersListState,
          banners: updatedBanners
        })
        setActionState({ loading: false, error: null })
        showToast(ToastType.Success, t('BANNER_SAVED', 'Banner saved'))
      } else {
        setActionState({
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to get all the sites from API
   */
  const getSites = async () => {
    try {
      setSitesState({ ...sitesState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setSitesState({ sites: content.result, loading: false, error: null })
      }
    } catch (err) {
      setSitesState({
        ...sitesState,
        loading: false,
        error: [err.message]
      })
    }
  }

  const handleSuccessUpdate = (updatedBanner) => {
    const updatedBanners = bannersListState.banners.map(banner => {
      if (banner.id === updatedBanner.id) {
        return updatedBanner
      }
      return banner
    })
    setBannersListState({
      ...bannersListState,
      banners: updatedBanners
    })
  }

  const handleSuccessAdd = (newBanner) => {
    setBannersListState({
      ...bannersListState,
      banners: [...bannersListState.banners, newBanner]
    })
  }

  const handleSuccessDelete = (bannerId) => {
    const updatedBanners = bannersListState.banners.filter(banner => banner.id !== bannerId)
    setBannersListState({
      ...bannersListState,
      banners: updatedBanners
    })
  }

  useEffect(() => {
    getSites()
  }, [])

  useEffect(() => {
    getAdBanners()
  }, [defaultPosition])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          sitesState={sitesState}
          actionState={actionState}
          bannersListState={bannersListState}
          handleSuccessUpdate={handleSuccessUpdate}
          handleUpdateBanner={handleUpdateBanner}
          handleSuccessAdd={handleSuccessAdd}
          handleSuccessDelete={handleSuccessDelete}
        />
      )}
    </>
  )
}

AdBannersList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
