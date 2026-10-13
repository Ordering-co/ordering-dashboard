import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useWebsocket, useSocketInstance } from '../../contexts/WebsocketContext'
import { applySiteLogoHeaderSync } from '../../utils'

export const OrderingWebsite = (props) => {
  const {
    UIComponent,
    appId,
    type,
    name,
    disableReplaceCode,
    forcedSiteId
  } = props

  const [ordering, { configurations }] = useApi()
  const [session] = useSession()
  const { token } = session
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const socket = useWebsocket()
  const ioSocket = useSocketInstance(socket)

  const [themeValues, setThemeValues] = useState({})
  const [advancedValues, setAdvancedValues] = useState({})
  const [orderingTheme, setOrderingTheme] = useState({ loading: true, themes: [], error: null, siteId: null })
  const [themesList, setThemesList] = useState({ loading: true, themes: [], error: null })
  const [site, setSite] = useState(null)
  const [businessesList, setBusinessesList] = useState({ businesses: [], loading: false, error: null })
  const [franchisesList, setFranchisesList] = useState({ loading: false, franchises: [], error: null })
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

      const findByType = result.find(site => site.type === type)
      const found = result.find(site => site.code === appId)

      if (error) return

      if (type) {
        if (findByType && !disableReplaceCode) {
          if (findByType.code !== appId) {
            const siteFound = { ...findByType, code: appId }
            handleUpdateSite(siteFound)
          } else {
            setSite(found)
            await getSiteTheme(found.id)
          }
        } else if (found) {
          const siteFound = { ...found, type }
          if (!disableReplaceCode) {
            handleUpdateSite(siteFound)
          } else {
            setSite(siteFound)
            await getSiteTheme(siteFound.id)
          }
        } else {
          await handleAddSite(type)
        }
      } else {
        if (found) {
          await getSiteTheme(found.id)
          setSite(found)
        } else {
          await handleAddSite()
        }
      }
    } catch (err) {
      setOrderingTheme((prevState) => ({
        ...prevState,
        loading: false,
        error: [err.message]
      }))
    } finally {
      setOrderingTheme((prevState) => ({
        ...prevState,
        loading: false
      }))
    }
  }

  /**
   * Method to get businesses from API
   */
  const getBusinesses = async () => {
    try {
      setBusinessesList({ ...businessesList, loading: false })
      let where = null
      const conditions = []
      conditions.push({
        attribute: 'enabled',
        value: true
      })
      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      const { content: { error, result } } = await ordering
        .setAccessToken(token)
        .businesses()
        .select(['name', 'logo', 'slug'])
        .where(where)
        .asDashboard()
        .get()
      if (!error) {
        setBusinessesList({ ...businessesList, loading: false, businesses: result })
      }
    } catch (err) {
      setBusinessesList({ ...businessesList, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to get brand list
   */
  const getFranchises = async () => {
    try {
      setFranchisesList({ ...franchisesList, loading: true })
      let where = null
      const conditions = []
      conditions.push({
        attribute: 'enabled',
        value: true
      })
      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      const requestOptions = {
        ...requestBase,
        method: 'GET'
      }
      const functionFetch = `${ordering.root}/franchises?where=${JSON.stringify(where)}`
      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setFranchisesList({
          ...franchisesList,
          loading: false,
          franchises: result
        })
      } else {
        setFranchisesList({
          ...franchisesList,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setFranchisesList({
        ...franchisesList,
        loading: false,
        error: err
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
        name: name || configurations?.subdomain
      }
      if (type) {
        initialData.type = type
      }
      const requestOptions = {
        ...requestBase,
        body: JSON.stringify(initialData)
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        if (type) {
          setSite(result)
          getSites()
        } else {
          await getSiteTheme(result.id)
          setSite(result)
        }
      } else {
        setOrderingTheme((prevState) => ({
          ...prevState,
          loading: false,
          themes: [],
          error: result
        }))
      }
    } catch (err) {
      setOrderingTheme({
        ...orderingTheme,
        loading: false,
        result: [err.message]
      })
    }
  }

  const handleUpdateSite = async (payload) => {
    const isSiteRecordUpdate = payload?.id != null && payload?.type !== undefined
    const changes = isSiteRecordUpdate
      ? { type: payload.type, code: payload.code }
      : applySiteLogoHeaderSync(payload ?? formState.changes, site)
    const siteId = isSiteRecordUpdate ? payload.id : site?.id

    if (!siteId || !changes || Object.keys(changes).length === 0) return

    try {
      setFormState((prev) => ({ ...prev, loading: true }))
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const seoOptions = {
        ...requestBase,
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/sites/${siteId}`, seoOptions)
      const { error, result } = await response.json()
      if (!error) {
        setSite(result)
        setFormState({ loading: false, changes: {}, error: null })
        showToast(
          ToastType.Success,
          changes?.domain === null
            ? t('CUSTOM_DOMAIN_REMOVED_SUCCESSFULLY', 'Custom domain removed successfully')
            : t('UPDATED_SUCCESSFULLY', 'Updated successfully')
        )
      } else {
        setFormState((prev) => ({ ...prev, loading: false }))
        showToast(ToastType.Error, result)
      }
    } catch (err) {
      setFormState((prev) => ({ ...prev, loading: false }))
      showToast(ToastType.Error, err.message)
    } finally {
      setOrderingTheme((prevState) => ({
        ...prevState,
        loading: false
      }))
    }
  }

  /**
   * Method to get the site theme from API
   */
  const getSiteTheme = async (siteId) => {
    try {
      const requestOptions = {
        ...requestBase,
        method: 'GET'
      }
      const response = await fetch(`${ordering.root}/sites/${siteId}/themes`, requestOptions)
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
        ...requestBase,
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
      const requestOptions = {
        ...requestBase,
        method: 'GET'
      }
      const response = await fetch(`${ordering.root}/themes`, requestOptions)
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
        ...advancedValues,
        my_products: {
          ...orderingTheme.themes[0].values?.my_products,
          components: { ...themeValues }
        }
      }
      const siteChanges = applySiteLogoHeaderSync(formState.changes, site)
      const seoOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(siteChanges)
      }
      if (Object.keys(siteChanges).length > 0) {
        await fetch(`${ordering.root}/sites/${site.id}`, seoOptions)
      }

      const values = advancedTheme ? JSON.parse(JSON.stringify(advancedTheme)) : JSON.parse(JSON.stringify(myProductvalues))
      if (forcedSiteId && values?.general?.components?.buttons) {
        values.general.components.buttons.color = ''
        values.general.components.buttons.borderRadius = ''
        values.general.components.buttons.buttonTextColor = ''
      }
      const requestOptions = {
        ...requestBase,
        body: JSON.stringify({
          values: JSON.stringify(values)
        })
      }
      const response = await fetch(`${ordering.root}/sites/${siteId}/themes/${themeId}`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, t('THEME_UPDATED', 'Theme updated'))
        setAdvancedValues({ ...advancedValues, ...result?.values })
      } else {
        showToast(ToastType.Error, result)
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  const loadForcedSite = async () => {
    try {
      setOrderingTheme((prev) => ({ ...prev, loading: true }))
      const response = await fetch(`${ordering.root}/sites/${forcedSiteId}`, {
        ...requestBase,
        method: 'GET'
      })
      const { error, result } = await response.json()
      if (!error && result && !Array.isArray(result)) {
        setSite(result)
        await getSiteTheme(result.id)
      } else {
        setOrderingTheme((prev) => ({ ...prev, loading: false, error: result || ['Site not found'] }))
      }
    } catch (err) {
      setOrderingTheme((prev) => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  useEffect(() => {
    if (forcedSiteId) {
      loadForcedSite()
      getBusinesses()
      getFranchises()
      return
    }
    if (!appId) return
    getThemes()
    getSites()
    getBusinesses()
    getFranchises()
  }, [appId, forcedSiteId])

  useEffect(() => {
    if (forcedSiteId) return
    if (orderingTheme?.siteId && themesList.themes?.length && !orderingTheme?.themes?.length) {
      const valuesDefault = JSON.parse(JSON.stringify(themesList.themes[0]?.values_default))
      if (valuesDefault?.my_products?.components?.website_settings?.components?.values) {
        valuesDefault.my_products.components.website_settings.components.values.default_domain = `https://${ordering.project}.${configurations.subdomain}.com`
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
    if (
      orderingTheme.themes[0].values?.order_types &&
      orderingTheme.themes[0]?.values?.order_types?.components?.catering_delivery === undefined
    ) {
      orderingTheme.themes[0].values.order_types.components.catering_delivery = orderingTheme.themes[0]?.theme?.values_default.order_types.components.catering_delivery
    }
    if (
      orderingTheme.themes[0].values?.order_types &&
      orderingTheme.themes[0]?.values?.order_types?.components?.catering_pickup === undefined
    ) {
      orderingTheme.themes[0].values.order_types.components.catering_pickup = orderingTheme.themes[0]?.theme?.values_default.order_types.components.catering_pickup
    }
    if (
      orderingTheme.themes[0]?.values?.smart_banner_settings === undefined
    ) {
      orderingTheme.themes[0].values.smart_banner_settings = orderingTheme.themes[0]?.theme?.values_default.smart_banner_settings
    }
    if (
      orderingTheme.themes[0]?.values?.theme_settings?.components?.values?.homepage_content === undefined
    ) {
      orderingTheme.themes[0].values.theme_settings = {
        ...orderingTheme.themes[0].values.theme_settings,
        components: {
          ...orderingTheme.themes[0].values.theme_settings?.components,
          values: {
            ...orderingTheme.themes[0].values.theme_settings?.components?.values,
            homepage_content: ''
          }
        }
      }
    }
    if (
      orderingTheme.themes[0]?.values?.theme_settings?.components?.values?.footer_content === undefined
    ) {
      orderingTheme.themes[0].values.theme_settings = {
        ...orderingTheme.themes[0].values.theme_settings,
        components: {
          ...orderingTheme.themes[0].values.theme_settings?.components,
          values: {
            ...orderingTheme.themes[0].values.theme_settings?.components?.values,
            footer_content: ''
          }
        }
      }
    }
    setAdvancedValues(JSON.parse(JSON.stringify(orderingTheme.themes[0]?.values)))
    const _themeValues = orderingTheme.themes[0]?.values?.my_products?.components
    if (!_themeValues) return
    setThemeValues(JSON.parse(JSON.stringify(_themeValues)))
  }, [orderingTheme?.themes])

  /**
   * WebSocket: join sites room and listen for site updates
   */
  const handleSitesUpdate = (siteUpdate) => {
    if (!site || siteUpdate?.id !== site?.id) return
    setSite(prev => ({ ...prev, ...siteUpdate }))
  }

  useEffect(() => {
    if (!session?.user || !ioSocket) return
    const room = {
      project: ordering.project,
      room: 'sites',
      user_id: session?.user?.id,
      role: 'manager'
    }
    const handleJoinRoom = () => socket.join(room)
    if (ioSocket.connected) handleJoinRoom()
    ioSocket.on('connect', handleJoinRoom)
    return () => {
      socket.leave(room)
      ioSocket.off('connect', handleJoinRoom)
    }
  }, [ioSocket, session])

  useEffect(() => {
    socket.on('sites_update', handleSitesUpdate)
    return () => {
      socket.off('sites_update', handleSitesUpdate)
    }
  }, [socket, session, site])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          themeValues={themeValues}
          advancedValues={advancedValues}
          setAdvancedValues={setAdvancedValues}
          orderingTheme={orderingTheme}
          setThemeValues={setThemeValues}
          handleUpdateSiteTheme={handleUpdateSiteTheme}
          themesList={themesList}
          site={site}
          setSite={setSite}
          businessesList={businessesList}
          franchisesList={franchisesList}
          handleChangeInput={handleChangeInput}
          formState={formState}
          handleUpdateSite={handleUpdateSite}
        />
      )}
    </>
  )
}

OrderingWebsite.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
