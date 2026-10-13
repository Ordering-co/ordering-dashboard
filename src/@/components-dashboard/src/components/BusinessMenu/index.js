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

  const [businessMenusState, setBusinessMenusState] = useState({ menus: [], menusShared: [], loading: false, error: null })
  const [isSelectedSharedMenus, setIsSelectedSharedMenus] = useState(false)
  const [sitesState, setSitesState] = useState({ sites: [], loading: true, error: null })

  /**
  * Method to get the business menus from API
  */
  const getBusinessMenus = async () => {
    try {
      setBusinessMenusState(prev => ({ ...prev, loading: true }))
      const { content: { error, result } } = await ordering.setAccessToken(token).businesses(business.id).select(propsToFetch).asDashboard().get()
      const _business = Array.isArray(result) ? null : result
      if (!error) {
        setBusinessMenusState(prev => ({
          ...prev,
          loading: false
        }))
      } else {
        setBusinessMenusState(prev => ({
          ...prev,
          loading: false,
          error: result
        }))
      }
      handleSuccessBusinessMenu && handleSuccessBusinessMenu(_business)
    } catch (err) {
      setBusinessMenusState(prev => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  /**
   * Method to control business menu active state from API
   * @param {Number} menuId menu id to change the business menu state
   * @param {Boolean} enabled menu enabled to change the business menu state
   */
  const handleChangeBusinessMenuActiveState = async (menuId, enabled) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setBusinessMenusState(prev => ({ ...prev, loading: true }))
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
      if (!content.error) {
        if (!isSelectedSharedMenus) {
          setBusinessMenusState(prev => {
            const menus = prev.menus.filter(menu => {
              if (menu.id === menuId) {
                Object.assign(menu, content.result)
              }
              return true
            })
            return {
              ...prev,
              loading: false,
              menus
            }
          })
        } else {
          setBusinessMenusState(prev => {
            const menusShared = prev.menusShared.map(menu => {
              if (menu.id === menuId) {
                return {
                  ...menu,
                  ...content.result,
                  id: menu?.id
                }
              }
              return menu
            })
            return {
              ...prev,
              loading: false,
              menusShared
            }
          })
        }
        showToast(ToastType.Success, t('MENU_SAVED', 'Products catalog saved'))
      } else {
        setBusinessMenusState(prev => ({
          ...prev,
          loading: false,
          error: content.result
        }))
      }
    } catch (err) {
      setBusinessMenusState(prev => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  /**
   * Method to delete the business menu from API
   * @param {Number} menuId menu id to delete the business menu
   */
  const handleDeleteBusinessMenu = async (menuId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setBusinessMenusState(prev => ({ ...prev, loading: true }))
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const endPoint = isSelectedSharedMenus
        ? `${ordering.root}/business/${business.id}/menus_shared/${menuId}`
        : `${ordering.root}/business/${business.id}/menus/${menuId}`

      const response = await fetch(endPoint, requestOptions)
      const content = await response.json()
      if (!content.error) {
        if (!isSelectedSharedMenus) {
          setBusinessMenusState(prev => ({
            ...prev,
            loading: false,
            menus: prev.menus.filter(menu => menu.id !== menuId)
          }))
        } else {
          setBusinessMenusState(prev => ({
            ...prev,
            loading: false,
            menusShared: prev.menusShared.filter(menu => menu.id !== menuId)
          }))
        }
        showToast(ToastType.Success, t('MENU_DELETED', 'Products catalog deleted'))
      } else {
        setBusinessMenusState(prev => ({
          ...prev,
          loading: false,
          error: content.result
        }))
      }
    } catch (err) {
      setBusinessMenusState(prev => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
  }

  /**
   * Method to get the business menus channels from API
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
      if (!error) {
        let sites = {}
        result.forEach(menu => {
          sites = {
            ...sites,
            [menu.id]: {
              id: menu.id,
              sites: menu.sites
            }
          }
        })

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
          const { result: sitesResult } = await response2.json()
          setSitesState(prev => ({ ...prev, loading: false, sites: sitesResult }))
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
          setBusinessMenusState(prev => ({
            ...prev,
            loading: false,
            error: [err.message]
          }))
        }
      } else {
        setBusinessMenusState(prev => ({
          ...prev,
          loading: false,
          error: result
        }))
      }
    } catch (err) {
      setBusinessMenusState(prev => ({
        ...prev,
        loading: false,
        error: [err.message]
      }))
    }
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
            handleDeleteBusinessMenu={handleDeleteBusinessMenu}
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
