import React, { useState, useEffect } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const BusinessMenu = (props) => {
  props = { ...defaultProps, ...props }
  const {
    business,
    UIComponent,
    handleSuccessBusinessMenu,
    propsToFetch,
    propsToFetchMenuChannel
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [businessMenusState, setBusinessMenusState] = useState({ menus: [], menusShared: [], loading: true, error: null })
  const [isSelectedSharedMenus, setIsSelectedSharedMenus] = useState(false)
  const [sitesState, setSitesState] = useState({ sites: [], loading: true, error: null })

  /**
  * Method to get the business (categories, header...) from API and hand it to the parent.
  * It does not decide `loading` / `error` of the menus list: only `getBusinessMenuChannels` does.
  */
  const getBusinessMenus = async () => {
    try {
      const { content: { result } } = await ordering.setAccessToken(token).businesses(business.id).select(propsToFetch).asDashboard().get()
      const _business = Array.isArray(result) ? null : result
      handleSuccessBusinessMenu && handleSuccessBusinessMenu(_business)
    } catch (err) {
      // the parent keeps the business it already has; the list state is not this request's to change
    }
  }

  /**
   * Method to control business menu active state from API
   * It never touches `loading` / `error` of the list: the caller shows the failure from the answer.
   * @param {Number} menuId menu id to change the business menu state
   * @param {Boolean} enabled menu enabled to change the business menu state
   * @returns {Promise<{ ok: true } | { ok: false, error }>}
   */
  const handleChangeBusinessMenuActiveState = async (menuId, enabled) => {
    try {
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled })
      }

      const endPoint = isSelectedSharedMenus
        ? `${ordering.root}/business/${business.id}/menus_shared/${menuId}`
        : `${ordering.root}/business/${business.id}/menus/${menuId}`

      const response = await fetch(endPoint, requestOptions)
      const content = await response.json()
      if (content.error) {
        return { ok: false, error: content.result }
      }
      if (!isSelectedSharedMenus) {
        setBusinessMenusState(prev => ({
          ...prev,
          menus: prev.menus.map(menu => menu.id === menuId ? { ...menu, ...content.result } : menu)
        }))
      } else {
        setBusinessMenusState(prev => ({
          ...prev,
          menusShared: prev.menusShared.map(menu => menu.id === menuId ? { ...menu, ...content.result, id: menu.id } : menu)
        }))
      }
      showToast(ToastType.Success, t('MENU_SAVED', 'Products catalog saved'))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  /**
   * Method to get the business menus channels from API.
   * This list is the only request that decides `loading` / `error` of `businessMenusState`.
   * If /sites fails the menus are still drawn and `sitesState.error` carries the message.
   */
  const getBusinessMenuChannels = async () => {
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/menus?params=${propsToFetchMenuChannel.join(',')}&mode=dashboard`, requestOptions)
      const { result, error } = await response.json()
      if (error) {
        setSitesState(prev => ({ ...prev, loading: false }))
        setBusinessMenusState(prev => ({ ...prev, loading: false, error: result }))
        return
      }

      try {
        const response2 = await fetch(`${ordering.root}/sites`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'x-app-x': ordering.appId,
              'X-INTERNAL-PRODUCT-X': ordering.appInternalName
            }
          }
        )
        const { result: sitesResult, error: sitesError } = await response2.json()
        if (sitesError) {
          setSitesState({ sites: [], loading: false, error: Array.isArray(sitesResult) ? sitesResult.join(', ') : String(sitesResult) })
        } else {
          setSitesState({ sites: Array.isArray(sitesResult) ? sitesResult : [], loading: false, error: null })
        }
      } catch (err) {
        setSitesState({ sites: [], loading: false, error: err.message })
      }

      const menus = result.filter(menu => menu?.business_id === business?.id)
      const menusShared = result.filter(menu => menu?.business_id !== business?.id)
      setBusinessMenusState(prev => ({
        ...prev,
        loading: false,
        menus,
        menusShared,
        error: null
      }))
    } catch (err) {
      setSitesState(prev => ({ ...prev, loading: false }))
      setBusinessMenusState(prev => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  /**
   * Method to repeat only the menus list request (not the business one)
   */
  const reloadMenus = () => {
    setBusinessMenusState(prev => ({ ...prev, loading: true, error: null }))
    return getBusinessMenuChannels()
  }

  useEffect(() => {
    getBusinessMenus()
    getBusinessMenuChannels()
  }, [])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            businessMenusState={businessMenusState}
            setBusinessMenusState={setBusinessMenusState}
            isSelectedSharedMenus={isSelectedSharedMenus}
            sitesState={sitesState}
            handleChangeBusinessMenuActiveState={handleChangeBusinessMenuActiveState}
            reloadMenus={reloadMenus}
            setIsSelectedSharedMenus={setIsSelectedSharedMenus}
          />
        )
      }
    </>
  )
}

BusinessMenu.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of business menu props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string),
  /**
  * Business, this must be contains an object with all business info
  */
  business: PropTypes.object
}

const defaultProps = {
  propsToFetch: ['id', 'categories', 'categories_shared', 'header', 'logo', 'timezone'],
  propsToFetchMenuChannel: [
    'sites', 'products', 'businesses', 'enabled', 'business_id', 'name', 'comment', 'schedule',
    'pickup', 'delivery', 'eatin', 'curbside', 'driver_thru', 'schedule_ranges',
    'all_products', 'use_business_schedule', 'external_id', 'seat_delivery', 'catering_delivery',
    'catering_pickup', 'snooze_until', 'reservation'
  ]
}
