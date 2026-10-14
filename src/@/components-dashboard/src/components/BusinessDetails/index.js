import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useEvent } from '../../contexts/EventContext'
import { useAssistantRecordChanges } from '../../contexts/AssistantContext'

const STREAM_ORDERS_STATUS_URL = 'https://stream-orders.plugins.orderingplus.com'
const VISIBLE_STREAM_STATUSES = ['connected', 'paused', 'disconnected']

const isStreamOrdersPlugin = (plugin) => {
  const identifiers = [plugin?.key, plugin?.url, plugin?.name]
    .map((value) => String(value ?? '').toLowerCase().replace(/[\s_-]+/g, ''))
  return identifiers.some((id) => id.includes('streamorder'))
}

const mapStreamStatus = (result) => {
  const status = result?.status
  if (status === 'not_connected') return null
  if (VISIBLE_STREAM_STATUSES.includes(status)) return status
  return null
}

export const BusinessDetails = (props) => {
  props = { ...defaultProps, ...props }
  const {
    asDashboard,
    business,
    businessId,
    propsToFetch,
    UIComponent,
    handleSucessUpdateBusiness,
    handleSucessRemoveBusiness,
    handleSucessAddBusiness,
    notGetSites,
    notGetTaxes,
    notGetStreamConnection,
    googleFeedSecondaryIncludedIds,
    googleFeedInclusionListLoading,
    googleFeedSavingBusinessId,
    googleFeedSavingChannel,
    handleGoogleFeedToggle,
    googleFeedExcludedBusinessIds
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [events] = useEvent()
  const [businessState, setBusinessState] = useState({ business: null, loading: true, error: null })

  // The assistant changed this store: show the values it read back
  useAssistantRecordChanges(({ entity, id, after }) => {
    if (entity !== 'Business' || !after || !id || id !== businessState.business?.id) return
    setBusinessState(prev => ({ ...prev, business: { ...prev.business, ...after } }))
  })
  const [actionStatus, setActionStatus] = useState({ loading: false, error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [spoonityKeyState, setSpoonityKeyState] = useState({ loading: false, key: '', result: { error: false } })
  const [siteState, setSiteState] = useState({ site: null, loading: false, error: null })
  const [formTaxChanges, setFormTaxChanges] = useState({})
  const [taxes, setTaxes] = useState({})
  const [fees, setFees] = useState({})
  const [taxToEdit, setTaxToEdit] = useState({ action: null, payload: null })
  const [formTaxState, setFormTaxState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [streamConnectionState, setStreamConnectionState] = useState({
    enabled: false,
    loading: false,
    status: null,
    error: null
  })

  /**
   * Clean formState
   */
  const cleanFormState = (values) => setFormState({ ...formState, ...values })

  /**
   * Method to get business from API
   */
  const getBusinesses = async () => {
    try {
      setBusinessState({
        ...businessState,
        loading: true
      })
      const fetchEndpoint = asDashboard
        ? ordering.setAccessToken(session.token).businesses(businessId).asDashboard().select(propsToFetch)
        : ordering.setAccessToken(session.token).businesses(businessId).select(propsToFetch)
      const { content: { result } } = await fetchEndpoint.get()
      const business = Array.isArray(result) ? null : result
      setBusinessState({
        ...businessState,
        loading: false,
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
   * Method to delete the business owner
   */
  const handleDeleteBusinessOwner = async (owners, { type = 'owners' } = {}) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const { content: { error, result } } = await ordering.setAccessToken(session.token).businesses(businessId).save({ [type]: owners })
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: error ? result : null
      })
      if (!error) {
        const _business = {
          ...businessState?.business,
          [type]: businessState?.business?.[type]?.filter(owner => owners.includes(owner.id))
        }
        setBusinessState({
          ...businessState,
          business: _business
        })
        showToast(ToastType.Success, t(`BUSINESS_${type.toUpperCase()}_DELETED`, `${type.toUpperCase()} deleted`))
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to add the business owner
   */
  const handleAddBusinessOwner = async (owners, newOwner, { type = 'owners' } = {}) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const { content: { error, result } } = await ordering.setAccessToken(session.token).businesses(businessId).save({ [type]: owners })
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: error ? result : null
      })
      if (!error) {
        const _owners = [...businessState?.business?.[type], newOwner]
        const _business = {
          ...businessState?.business,
          [type]: _owners
        }
        setBusinessState({
          ...businessState,
          business: _business
        })
        showToast(ToastType.Success, t(`BUSINESS_${type.toUpperCase()}_ADDED`, `${type.toUpperCase()} added`))
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  /**
   * Method to update the business from the API
   */
  const handleUpdateBusinessClick = async (changes = {}) => {
    try {
      setFormState({ ...formState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const changesToSend = Object.keys(changes).length > 0 && !changes.target ? changes : formState.changes

      let responseContent
      if (Array.isArray(changesToSend.taxes)) {
        const { tax_id: _taxId, ...payload } = changesToSend
        const response = await fetch(`${ordering.root}/business/${businessId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`
          },
          body: JSON.stringify(payload)
        })
        responseContent = await response.json()
      } else {
        const response = await ordering.businesses(businessId).save(changesToSend, {
          accessToken: session.token
        })
        responseContent = response.content
      }

      setFormState({
        ...formState,
        changes: responseContent.error ? changesToSend : {},
        result: responseContent,
        loading: false
      })

      if (!responseContent.error) {
        setBusinessState({
          ...businessState,
          business: {
            ...businessState.business,
            ...responseContent.result
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
   * Method to set Spoonity key
   */
  const handleUpdateSpoonityKey = async (key, config) => {
    try {
      setSpoonityKeyState({ ...spoonityKeyState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          value: key
        })
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/configs/${config}`, requestOptions)
      const content = await response.json()

      if (content) {
        showToast(ToastType.Success, t('SPOONITY_KEY_UPDATED', 'Spoonity key updated'))
        setSpoonityKeyState({
          ...spoonityKeyState,
          key: content.result.value,
          result: content.result,
          loading: false
        })
      }
    } catch (err) {
      showToast(ToastType.Error, t('SPOONITY_KEY_ERROR', 'Spoonity key error'))
      setSpoonityKeyState({
        ...spoonityKeyState,
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

  /**
   * Method to get the themes from API
   */
  const getSites = async () => {
    try {
      setSiteState({ ...siteState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        const site = result.find(site => site.code === 'website')
        setSiteState({ ...siteState, loading: false, site })
      } else {
        setSiteState({ ...siteState, loading: false, error: result })
      }
    } catch (err) {
      setSiteState({ ...siteState, loading: false, error: [err.message] })
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
        error: error ? result : null,
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

  const handleChangeTax = (name, value, orderType) => {
    if (value === null) {
      const _formTaxChanges = { ...formTaxChanges }
      delete _formTaxChanges.order_type_rates
      setFormTaxChanges(_formTaxChanges)
      return
    }
    if (orderType) {
      setFormTaxChanges((prev) => ({
        ...prev,
        order_type_rates: {
          ...prev.order_type_rates,
          [orderType]: {
            ...prev.order_type_rates?.[orderType],
            [name]: parseFloat(value)
          }
        }
      }))
    } else {
      setFormTaxChanges((prev) => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const getTaxes = async () => {
    const taxesObject = {}
    setFormTaxState({
      ...formTaxState,
      loading: true
    })
    const response = await fetch(`${ordering.root}/taxes`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      }
    })
    const { error, result } = await response.json()
    if (!error) {
      result.forEach(tax => (taxesObject[`id:${tax?.id}`] = tax))
      setTaxes(taxesObject)
      return
    }
    setFormTaxState({
      ...formTaxState,
      result: {
        error: true,
        result: taxesObject
      },
      loading: false
    })
  }

  const handleSaveTax = async (id, action, _data) => {
    try {
      setFormTaxState({
        ...formState,
        loading: true
      })
      let result
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      if (id) {
        const response = await fetch(`${ordering.root}/${action}/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.auth}`
          },
          body: JSON.stringify({
            ...formTaxChanges,
            ..._data,
            ...(action === 'taxes' ? { target: 'product' } : {})
          })
        })
        const { result: data } = await response.json()
        result = data
        if (action === 'taxes') {
          setTaxes({
            ...taxes,
            [`id:${data.id}`]: {
              name: data.name,
              description: data.description,
              id: data.id,
              rate: data.rate,
              type: data.type,
              recipient: data.recipient,
              apply_to_fees: data.apply_to_fees,
              order_type_rates: data.order_type_rates || null
            }
          })
          events.emit('tax_changed', {
            tax: {
              name: data.name,
              description: data.description,
              id: data.id,
              rate: data.rate,
              type: data.type,
              recipient: data.recipient,
              apply_to_fees: data.apply_to_fees,
              order_type_rates: data.order_type_rates || null
            }
          })
          showToast(ToastType.Success, t('TAX_SAVED', 'Tax saved'))
        } else {
          setFees({
            ...fees,
            [`id:${data.id}`]: {
              name: data.name,
              description: data.description,
              id: data.id,
              fixed: data.fixed,
              percentage: data.percentage,
              taxable: data.taxable,
              recipient: data.recipient,
              target: data.target
            }
          })
          events.emit('fee_changed', {
            fee: {
              name: data.name,
              description: data.description,
              id: data.id,
              fixed: data.fixed,
              percentage: data.percentage,
              taxable: data.taxable,
              recipient: data.recipient,
              target: data.target
            }
          })
          showToast(ToastType.Success, t('FEE_SAVED', 'Fee saved'))
        }
      } else {
        const response = await fetch(`${ordering.root}/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.auth}`
          },
          body: JSON.stringify({
            ...formTaxChanges,
            ..._data,
            ...(action === 'taxes' ? { target: 'product' } : {})
          })
        })
        const { result: data } = await response.json()
        if (action === 'taxes') {
          setTaxes({
            ...taxes,
            [`id:${data.id}`]: {
              name: data.name,
              description: data.description,
              id: data.id,
              rate: data.rate,
              type: data.type,
              recipient: data.recipient,
              apply_to_fees: data.apply_to_fees,
              order_type_rates: data.order_type_rates || null
            }
          })
          showToast(ToastType.Success, t('TAX_SAVED', 'Tax saved'))
        } else {
          setFees({
            ...fees,
            [`id:${data.id}`]: {
              name: data.name,
              description: data.description,
              id: data.id,
              fixed: data.fixed,
              percentage: data.percentage,
              taxable: data.taxable,
              recipient: data.recipient,
              target: data.target
            }
          })
          showToast(ToastType.Success, t('FEE_SAVED', 'Fee saved'))
        }
        return data
      }
      if (result?.error) return
      setTaxToEdit({ action: null, payload: null })
    } catch (err) {
      setFormTaxState({
        ...formTaxState,
        loading: false
      })
    } finally {
      setFormTaxState({
        ...formTaxState,
        loading: false
      })
    }
  }

  const handleDeleteTax = async (id, action) => {
    setFormTaxState({
      ...formTaxState,
      loading: true
    })
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    if (id) {
      const response = await fetch(`${ordering.root}/${action}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.auth}`
        }
      })
      const { error } = await response.json()
      if (!error) {
        if (action === 'taxes') {
          const newTaxes = taxes
          events.emit('tax_deleted', { tax: newTaxes[`id:${id}`], isRemove: true })
          delete newTaxes[`id:${id}`]
          setTaxes(newTaxes)
          showToast(ToastType.Success, t('TAX_DELETED', 'tax deleted'))
        } else {
          const newFees = fees
          events.emit('fee_deleted', { tax: newFees[`id:${id}`], isRemove: true })
          delete newFees[`id:${id}`]
          setFees(newFees)
          showToast(ToastType.Success, t('FEE_DELETED', 'Fee deleted'))
        }
      }
    }
    setFormTaxState({
      ...formTaxState,
      loading: false
    })
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
      getBusinesses()
    }
  }, [businessId, business])

  useEffect(() => {
    if (!notGetSites) {
      getSites()
    }
    if (!notGetTaxes) {
      getTaxes()
    }
  }, [])

  useEffect(() => {
    if (!businessId || notGetStreamConnection) return

    let cancelled = false

    const loadStreamConnection = async () => {
      setStreamConnectionState({
        enabled: false,
        loading: true,
        status: null,
        error: null
      })

      const isBusinessOwner = session.user?.level === 2

      try {
        let streamOrdersEnabled = isBusinessOwner

        if (!streamOrdersEnabled) {
          const response = await fetch(`${ordering.root}/plugins`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.token}`
            }
          })
          const { error, result } = await response.json()
          streamOrdersEnabled = !error &&
            Array.isArray(result) &&
            result.some(isStreamOrdersPlugin)
        }

        if (cancelled) return

        if (!streamOrdersEnabled) {
          setStreamConnectionState({
            enabled: false,
            loading: false,
            status: null,
            error: null
          })
          return
        }

        const statusResponse = await fetch(
          `${STREAM_ORDERS_STATUS_URL}/${ordering.project}/api/business/${businessId}/status`,
          { headers: { Accept: 'application/json' } }
        )
        const statusContent = await statusResponse.json()

        if (cancelled) return

        if (statusContent.error) {
          setStreamConnectionState({
            enabled: true,
            loading: false,
            status: null,
            error: statusContent.result
          })
          return
        }

        setStreamConnectionState({
          enabled: true,
          loading: false,
          status: mapStreamStatus(statusContent.result),
          error: null
        })
      } catch (err) {
        if (cancelled) return
        setStreamConnectionState({
          enabled: false,
          loading: false,
          status: null,
          error: [err.message]
        })
      }
    }

    loadStreamConnection()

    return () => {
      cancelled = true
    }
  }, [businessId, notGetStreamConnection, ordering.project, ordering.root, session.token, session.user?.level])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            businessState={businessState}
            actionStatus={actionStatus}
            formState={formState}
            setFormState={setFormState}
            cleanFormState={cleanFormState}
            handleChangeActiveBusiness={handleChangeActiveBusiness}
            handleDuplicateBusiness={handleDuplicateBusiness}
            handleDeleteBusiness={handleDeleteBusiness}
            handleDeleteBusinessOwner={handleDeleteBusinessOwner}
            handleAddBusinessOwner={handleAddBusinessOwner}
            handleUpdateBusinessClick={handleUpdateBusinessClick}
            handleUpdateBusinessState={handleUpdateBusinessState}
            handleSuccessAddBusinessItem={handleSuccessAddBusinessItem}
            handleSuccessDeleteBusinessItem={handleSuccessDeleteBusinessItem}
            handleUpdateBusinessConfigs={handleUpdateBusinessConfigs}
            handleUpdateSpoonityKey={handleUpdateSpoonityKey}
            handleSyncEvent={handleSyncEvent}
            spoonityKeyState={spoonityKeyState}
            siteState={siteState}
            taxes={taxes}
            fees={fees}
            taxToEdit={taxToEdit}
            setTaxToEdit={setTaxToEdit}
            formTaxChanges={formTaxChanges}
            setFormTaxChanges={setFormTaxChanges}
            formTaxState={formTaxState}
            handleSaveTax={handleSaveTax}
            handleDeleteTax={handleDeleteTax}
            getTaxes={getTaxes}
            handleChangeTax={handleChangeTax}
            handleGoogleFeedToggle={handleGoogleFeedToggle}
            googleFeedSecondaryIncludedIds={googleFeedSecondaryIncludedIds}
            googleFeedInclusionListLoading={googleFeedInclusionListLoading}
            googleFeedSavingBusinessId={googleFeedSavingBusinessId}
            googleFeedSavingChannel={googleFeedSavingChannel}
            googleFeedExcludedBusinessIds={googleFeedExcludedBusinessIds}
            streamConnectionState={streamConnectionState}
          />
        )
      }
    </>
  )
}

BusinessDetails.propTypes = {
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
  propsToFetch: ['id', 'vertical', 'name', 'email', 'slug', 'schedule', 'description', 'about', 'logo', 'header', 'phone', 'cellphone', 'owner_id', 'city_id', 'address', 'address_notes', 'zipcode', 'location', 'featured', 'timezone', 'currency', 'food', 'alcohol', 'groceries', 'laundry', 'use_printer', 'printer_id', 'minimum', 'delivery_price', 'always_deliver', 'tax_type', 'tax', 'delivery_time', 'pickup_time', 'service_fee', 'fixed_usage_fee', 'percentage_usage_fee', 'order_default_priority', 'cancel_order_after_minutes', 'enabled', 'preorder_time', 'maximum', 'schedule_ranges', 'franchise_id', 'site_id', 'external_id', 'front_layout', 'seo_image', 'seo_title', 'seo_description', 'eta_status_times', 'eta_variation_time', 'price_level', 'facebook_profile', 'instagram_profile', 'tiktok_profile', 'snapchat_profile', 'pinterest_profile', 'whatsapp_number', 'delivery_tax_rate', 'delivery_tax_type', 'disabled_reason', 'menus_count', 'available_menus_count', 'menus_shared_count', 'available_menus_shared_count', 'professionals', 'configs', 'checkoutfields', 'reviews', 'open', 'today', 'lazy_load_products_recommended', 'available_products_count', 'valid_service', 'num_zones', 'types', 'metafields', 'owners', 'gallery', 'city', 'webhooks', 'maximums', 'paymethods', 'ribbon', 'offers', 'agents', 'tax_id', 'taxes', 'custom_tax']
}
