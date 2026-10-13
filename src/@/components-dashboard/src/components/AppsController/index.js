import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { fetchAllPages } from '../../utils/fetchAllPages'

export const AppsController = (props) => {
  const {
    UIComponent,
    productId,
    app,
    appId
  } = props

  const [ordering, { configurations }] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [themeValues, setThemeValues] = useState({})
  const [advancedValues, setAdvancedValues] = useState({})
  const [orderingTheme, setOrderingTheme] = useState({ loading: true, themes: [], error: null, siteId: null })
  const [themesList, setThemesList] = useState({ loading: true, themes: [], error: null })
  const [site, setSite] = useState(null)
  const [formState] = useState({ loading: false, changes: {}, error: null })
  const [singleAppState, setSingleAppState] = useState({ loading: false, app: app ?? null, error: null })

  const requestGETOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }

  useEffect(() => {
    setSingleAppState({
      ...singleAppState,
      app: {
        ...singleAppState.app,
        ...app
      }
    })
  }, [app])

  const updateAppValues = (values = {}) => {
    setSingleAppState((singleAppState) => ({
      ...singleAppState,
      app: {
        ...singleAppState.app,
        ...values
      }
    }))
  }

  const getBaseActionsApp = async () => {
    try {
      const { error, result } = await fetchAllPages(`${ordering.root}/builder/apps/${productId}/base_actions`, requestGETOptions)
      return error ? null : result
    } catch {
      return null
    }
  }

  const getBaseConstantsApp = async () => {
    try {
      const { error, result } = await fetchAllPages(`${ordering.root}/builder/apps/${productId}/base_constants`, requestGETOptions)
      return error ? null : result
    } catch {
      return null
    }
  }

  const getApp = async (app) => {
    try {
      let error
      let result
      if (!app) {
        const response = await fetch(`${ordering.root}/builder/apps/${productId}`, requestGETOptions)
        const req = await response.json()
        error = req?.error
        result = req?.result
      }
      return app ?? (error ? null : result)
    } catch {
      return null
    }
  }

  /**
  * Method to get single Builder App from API
  */
  const getBuilderApp = async () => {
    try {
      setSingleAppState({ ...singleAppState, loading: true })
      const _app = await getApp(app)
      const baseActions = await getBaseActionsApp()
      const baseConstants = await getBaseConstantsApp()

      setSingleAppState({
        ...singleAppState,
        loading: false,
        app: { ..._app, baseActions, baseConstants }
      })
    } catch (err) {
      setSingleAppState({
        ...singleAppState,
        loading: false,
        error: err?.message ?? err
      })
    }
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
      const response = await fetch(`${ordering.root}/sites`, requestGETOptions)
      const { error, result } = await response.json()
      if (!error) {
        const found = result.find(site => site.code === appId)
        if (found) {
          await getSiteTheme(found.id)
          setSite(found)
        } else {
          await handleAddSite()
        }
      }
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
        code: appId,
        name: configurations?.subdomain
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(initialData)
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        await getSiteTheme(result.id)
        setSite(result)
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

  /**
   * Method to get the site theme from API
   */
  const getSiteTheme = async (siteId) => {
    try {
      const response = await fetch(`${ordering.root}/sites/${siteId}/themes`, requestGETOptions)
      const { error, result } = await response.json()
      setOrderingTheme({
        loading: false,
        themes: error ? [] : result,
        error: error ? result : null,
        siteId
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
 * Method to assign the theme to site
 */
  const handleAssignTheme = async (value, themeId, siteId) => {
    try {
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          theme_id: themeId,
          values: JSON.stringify(value)
        })
      }
      const response = await fetch(`${ordering.root}/sites/${siteId}/themes`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('THEME_ADDED', 'Theme added'))
        setOrderingTheme({
          ...orderingTheme,
          themes: [result]
        })
      } else {
        showToast(ToastType.Error, result)
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  /**
 * Method to get the themes from API
 */
  const getThemes = async () => {
    try {
      setThemesList({
        ...themesList,
        loading: true
      })
      const response = await fetch(`${ordering.root}/themes`, requestGETOptions)
      const { error, result } = await response.json()
      setThemesList({
        loading: false,
        themes: error ? [] : result,
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
 * Method to update the site theme from API
 */
  const handleUpdateSiteTheme = async (advancedTheme) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const themeId = orderingTheme.themes[0]?.theme_id
      const siteId = orderingTheme.themes[0]?.site_id
      const myProductvalues = {
        ...orderingTheme.themes[0].values,
        my_products: {
          ...orderingTheme.themes[0].values?.my_products,
          components: { ...themeValues }
        }
      }
      const seoOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState.changes)
      }
      await fetch(`${ordering.root}/sites/${site.id}`, seoOptions)

      const values = advancedTheme ? JSON.parse(JSON.stringify(advancedTheme)) : JSON.parse(JSON.stringify(myProductvalues))
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
      } else {
        showToast(ToastType.Error, result)
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  useEffect(() => {
    if (!appId) return
    getThemes()
    getSites()
  }, [appId])

  useEffect(() => {
    if (orderingTheme?.siteId && themesList.themes?.length && !orderingTheme?.themes?.length) {
      const valuesDefault = JSON.parse(JSON.stringify(themesList.themes[0]?.values_default))
      if (valuesDefault?.my_products?.components?.website_settings?.components?.values) {
        valuesDefault.my_products.components.website_settings.components.values.default_domain = `https://${ordering.project}.${configurations?.subdomain}.com`
      }
      handleAssignTheme(valuesDefault, themesList.themes[0]?.id, orderingTheme?.siteId)
    }
  }, [JSON.stringify(themesList.themes), orderingTheme?.siteId])

  useEffect(() => {
    if (!orderingTheme.themes[0]?.values) return
    if (
      orderingTheme.themes[0]?.values?.business_view?.components?.products?.components?.product?.components?.favorite?.hidden === undefined &&
      orderingTheme.themes[0]?.values?.business_view?.components?.products?.components?.product?.components
    ) {
      orderingTheme.themes[0].values.business_view.components.products.components.product.components.favorite = {
        hidden: orderingTheme.themes[0]?.values?.business_view?.components?.product?.components?.favorite
      }
    }
    setAdvancedValues(JSON.parse(JSON.stringify(orderingTheme.themes[0]?.values)))
    const _themeValues = orderingTheme.themes[0]?.values?.my_products?.components
    if (!_themeValues) return
    setThemeValues(JSON.parse(JSON.stringify(_themeValues)))
  }, [orderingTheme?.themes])

  useEffect(() => {
    productId && getBuilderApp()
  }, [productId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          themesList={themesList}
          orderingTheme={orderingTheme}
          singleAppState={singleAppState}
          updateAppValues={updateAppValues}
          advancedValues={advancedValues}
          setAdvancedValues={setAdvancedValues}
          handleUpdateSiteTheme={handleUpdateSiteTheme}
        />
      )}
    </>
  )
}

AppsController.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
