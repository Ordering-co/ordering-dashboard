import React, { useEffect, useRef, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const PosMenuBusinessDetails = (props) => {
  props = { ...defaultProps, ...props }
  const {
    asDashboard,
    business,
    businessId,
    propsToFetch,
    UIComponent,
    handleSucessUpdateBusiness,
    handleSucessRemoveBusiness,
    handleSucessAddBusiness
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [businessState, setBusinessState] = useState({ business: null, loading: true, error: null })
  const [selectedIntegration, setSelectedIntegration] = useState(null)
  const [actionStatus, setActionStatus] = useState({ loading: false, error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [integrationActionLoading, setIntegrationActionLoading] = useState(false)
  const integrationRequestRef = useRef(false)

  /**
   * Clean formState
   */
  const cleanFormState = (values) => setFormState({ ...formState, ...values })

  /**
   * Method to get business from API
   */
  const getBusiness = async () => {
    try {
      setBusinessState({
        ...businessState,
        loading: !businessState.business,
        error: null
      })
      const fetchEndpoint = asDashboard
        ? ordering.setAccessToken(session.token).businesses(businessId).asDashboard().select(propsToFetch)
        : ordering.setAccessToken(session.token).businesses(businessId).select(propsToFetch)
      const { content: { error, result } } = await fetchEndpoint.get()
      if (error) {
        setBusinessState({
          ...businessState,
          loading: false,
          error: Array.isArray(result) ? result : [result || t('ERROR', 'Error')]
        })
        return
      }
      const business = Array.isArray(result) ? null : result
      setBusinessState({
        ...businessState,
        loading: false,
        error: null,
        business
      })
    } catch (err) {
      setBusinessState({
        ...businessState,
        loading: false,
        error: [err.message]
      })
    }
  }

  /**
   * Method to change business enable/disable or featured/not featured
   * @param {Boolean} enabled business enable state
   * @param {Boolean} isFeatured state to check enable or featured
   */

  const handleChangeActiveBusiness = async (enabled, isFeatured = false) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const changes = isFeatured ? { featured: enabled } : { enabled }
      const { content: { error, result } } = await ordering.setAccessToken(session.token).businesses(businessId).save(changes)
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: error ? result : null
      })

      if (!error) {
        setBusinessState({
          ...businessState,
          business: {
            ...businessState.business,
            ...result
          }
        })
        showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to delete business from API
   */
  const handleDeleteBusiness = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${businessId}`, requestOptions)
      const content = await response.json()

      setActionStatus({
        ...actionStatus,
        loading: false,
        error: content.error ? content.result : null
      })
      if (!content.error) {
        showToast(ToastType.Success, t('BUSINESS_DELETED', 'Business deleted'))
        handleSucessRemoveBusiness && handleSucessRemoveBusiness(businessId)
        props.onClose && props.onClose()
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to duplicate business from API
   */
  const handleDuplicateBusiness = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/duplicate`, requestOptions)
      const content = await response.json()

      setActionStatus({
        ...actionStatus,
        loading: false,
        error: content.error ? content.result : null
      })

      if (!content.error) {
        handleSucessAddBusiness && handleSucessAddBusiness(content?.result)
        showToast(ToastType.Success, t('BUSINESS_DUPLICATED', 'Business duplicated'))
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to update the business from the API
   */
  const handleUpdateBusinessClick = async () => {
    try {
      setFormState({ ...formState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const response = await ordering.businesses(businessId).save(formState.changes, {
        accessToken: session.token
      })
      setFormState({
        ...formState,
        changes: response.content.error ? formState.changes : {},
        result: response.content,
        loading: false
      })

      if (!response.content.error) {
        setBusinessState({
          ...businessState,
          business: {
            ...businessState.business,
            ...response.content.result
          }
        })
        showToast(ToastType.Success, t('BUSINESS_UPDATED', 'Business updated'))
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    }
  }

  /**
   * Method to add the business fields when new busines item is added
   */
  const handleSuccessAddBusinessItem = (name, result) => {
    const params = [...businessState?.business[name], result]
    setBusinessState({
      ...businessState,
      business: {
        ...businessState?.business,
        [name]: params
      }
    })
  }
  /**
   * Method to delete the business item from business
   */
  const handleSuccessDeleteBusinessItem = (name, id) => {
    const params = businessState?.business[name].filter(item => item.id !== id)
    setBusinessState({
      ...businessState,
      business: {
        ...businessState?.business,
        [name]: params
      }
    })
  }

  /**
   * Method to update the business
   */
  const handleUpdateBusinessState = (result) => {
    const business = { ...businessState?.business }
    Object.assign(business, result)
    setBusinessState({
      ...businessState,
      business
    })
  }

  const handleSelectIntegration = (integration) => {
    setSelectedIntegration(integration)
  }

  const handleUpdateBusinessConfigs = async (params, configId) => {
    try {
      setActionStatus({ ...actionStatus, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({ value: params })
      }
      const response = await fetch(`${ordering.root}/business/${business?.id || businessId}/configs/${configId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionStatus({ loading: false, error: null })
        setBusinessState({
          ...businessState,
          business: {
            ...businessState.business,
            configs: businessState.business.configs.map(config => config.id === configId ? content.result : config)
          }
        })
        showToast(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      } else {
        setActionStatus({ loading: false, error: content.result })
      }
    } catch (err) {
      setActionStatus({
        loading: false,
        error: [err.message]
      })
    }
  }

  const handleSyncEvent = async (event = 'business') => {
    try {
      setBusinessState({
        ...businessState,
        loading: true
      })
      const response = await fetch(`https://integrations.ordering.co/pulseposdps/api/sync_${event}.php?store_id=${businessState?.business?.external_id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      })
      const { result, error } = await response.json()
      if (!error) {
        showToast(ToastType.Success, result?.[0] || t('OK', 'OK'))
      }
      setBusinessState({
        ...businessState,
        loading: false
      })
    } catch (err) {
      setBusinessState({
        ...businessState,
        error: [err.message],
        loading: false
      })
    }
  }

  const handleSync = async (urlParam, root) => {
    if (!root || !urlParam) return null
    return `${root}${urlParam.replace('@{project_code}', ordering.project).replace('@{access_token}', session.token).replace('@{business_id}', businessState?.business?.id)}`
  }

  const requestIntegrationChange = async (integrationId, method, data, successMessage) => {
    if (integrationRequestRef.current) return false
    integrationRequestRef.current = true
    setIntegrationActionLoading(true)
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    try {
      const response = await fetch(`${ordering.root}/business/${businessId}/third_party_integrations/${integrationId}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        ...(data && { body: JSON.stringify(data) })
      })
      const content = await response.json().catch(() => null)
      if (!content) {
        showToast(ToastType.Error, t('INTEGRATION_REQUEST_FAILED', 'The integration did not respond. Please try again.'))
        return false
      }
      if (content.error) {
        showToast(ToastType.Error, Array.isArray(content.result) ? content.result.join(', ') : content.result)
        return false
      }
      showToast(ToastType.Success, successMessage)
      return true
    } catch (err) {
      showToast(ToastType.Error, t('INTEGRATION_REQUEST_FAILED', 'The integration did not respond. Please try again.'))
      return false
    } finally {
      integrationRequestRef.current = false
      setIntegrationActionLoading(false)
    }
  }

  const handleConnectBusiness = async (integrationId, data, callback, successMessage) => {
    const success = await requestIntegrationChange(integrationId, 'POST', data, successMessage || t('BUSINESS_CONNECTED', 'Business connected'))
    if (success && callback) callback()
    return success
  }

  const handleDisconnectBusiness = async (integrationId, callback) => {
    const success = await requestIntegrationChange(integrationId, 'DELETE', null, t('BUSINESS_DISCONNECTED', 'Business disconnected'))
    if (success && callback) callback()
    return success
  }

  const handlePushAction = async (integrationId, action = 'push_menu', message) => {
    try {
      const response = await fetch(`${ordering.root}/business/${businessId}/third_party_integrations/${integrationId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      })
      const content = await response.json()
      if (!content.error) {
        showToast(ToastType.Success, message || t('MENU_PUSH_STARTED', 'Menu push started. It can take a few minutes.'))
      } else {
        showToast(ToastType.Error, content.result)
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  useEffect(() => {
    if (!businessState?.business) return
    handleSucessUpdateBusiness && handleSucessUpdateBusiness(businessState?.business)
  }, [businessState?.business])

  useEffect(() => {
    if (business) {
      setBusinessState({
        ...businessState,
        loading: false,
        business
      })
    } else {
      getBusiness()
    }
  }, [businessId, business])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            businessState={businessState}
            selectedIntegration={selectedIntegration}
            actionStatus={actionStatus}
            formState={formState}
            setFormState={setFormState}
            cleanFormState={cleanFormState}
            handleChangeActiveBusiness={handleChangeActiveBusiness}
            handleDuplicateBusiness={handleDuplicateBusiness}
            handleDeleteBusiness={handleDeleteBusiness}
            handleUpdateBusinessClick={handleUpdateBusinessClick}
            handleUpdateBusinessState={handleUpdateBusinessState}
            handleSuccessAddBusinessItem={handleSuccessAddBusinessItem}
            handleSuccessDeleteBusinessItem={handleSuccessDeleteBusinessItem}
            handleUpdateBusinessConfigs={handleUpdateBusinessConfigs}
            handleSyncEvent={handleSyncEvent}
            handleSync={handleSync}
            handleConnectBusiness={handleConnectBusiness}
            integrationActionLoading={integrationActionLoading}
            handleDisconnectBusiness={handleDisconnectBusiness}
            handleSelectIntegration={handleSelectIntegration}
            handlePushAction={handlePushAction}
            updateBusiness={getBusiness}
          />
        )
      }
    </>
  )
}

PosMenuBusinessDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string),
  /**
  * This must be contains businessId to fetch
  */
  businessId: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string
  ]),
  /**
  * Business, this must be contains an object with all business info
  */
  business: PropTypes.object
}

const defaultProps = {
  propsToFetch: ['id', 'name', 'email', 'slug', 'schedule', 'description', 'about', 'logo', 'header', 'phone', 'cellphone', 'owner_id', 'city_id', 'address', 'address_notes', 'zipcode', 'location', 'featured', 'timezone', 'currency', 'food', 'alcohol', 'groceries', 'laundry', 'use_printer', 'printer_id', 'minimum', 'delivery_price', 'always_deliver', 'tax_type', 'tax', 'delivery_time', 'pickup_time', 'service_fee', 'fixed_usage_fee', 'percentage_usage_fee', 'order_default_priority', 'cancel_order_after_minutes', 'enabled', 'preorder_time', 'maximum', 'schedule_ranges', 'franchise_id', 'external_id', 'front_layout', 'seo_image', 'seo_title', 'seo_description', 'eta_status_times', 'eta_variation_time', 'price_level', 'facebook_profile', 'instagram_profile', 'tiktok_profile', 'snapchat_profile', 'pinterest_profile', 'whatsapp_number', 'delivery_tax_rate', 'delivery_tax_type', 'disabled_reason', 'menus_count', 'available_menus_count', 'menus_shared_count', 'available_menus_shared_count', 'professionals', 'configs', 'checkoutfields', 'reviews', 'open', 'today', 'lazy_load_products_recommended', 'available_products_count', 'valid_service', 'num_zones', 'types', 'metafields', 'owners', 'gallery', 'city', 'webhooks', 'maximums', 'paymethods', 'ribbon', 'offers', 'third_party_integrations']
}
