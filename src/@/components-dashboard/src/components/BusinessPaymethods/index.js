import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useConfig } from '../../contexts/ConfigContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { buildStripeConnectSavePayload, mapStripeConnectOAuthResult } from './stripeConnectHelpers'
import { buildInstallPaymentPluginRequest } from './installPaymentPlugin'

const paymethodsNotAllowed = ['paypal_express', 'authorize', 'stripe_direct', 'stripe_redirect']

export const BusinessPaymethods = (props) => {
  const {
    business,
    UIComponent,
    defaultSandboxRequiredGateways,
    handleSuccessUpdate
  } = props
  const [ordering, { configurations }] = useApi()
  const [{ token }] = useSession()
  const [configState] = useConfig()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [businessPaymethodsState, setBusinessPaymethodsState] = useState({ paymethods: [], loading: true, error: null })
  const [sitesState, setSitesState] = useState({ sites: [], loading: true, error: null })
  const [deviceState, setDeviceState] = useState({ devices: [], loading: true, error: null })
  const [paymethodsList, setPaymethodsList] = useState({ paymethods: [], loading: true, error: null })
  const sandboxRequiredGateways = defaultSandboxRequiredGateways || ['paypal', 'paypal_express', 'stripe_connect', 'carlos_payment', 'ivr']
  const [actionState, setActionState] = useState({ loading: false, result: { error: false } })
  const [changesState, setChangesState] = useState({})
  const [stripeConnectData, setStripeConnectData] = useState({})
  const [isSuccessDeleted, setIsSuccessDeleted] = useState(false)
  const [pluginsState, setPluginsState] = useState({ plugins: [], loading: true, error: null })
  const [installingPluginKey, setInstallingPluginKey] = useState(null)
  const stripeClientId = configState?.configs?.stripe_connect_sandbox?.value === '1'
    ? configState?.configs?.stripe_connect_client_id_sandbox?.value
    : configState?.configs?.stripe_connect_client_id?.value

  /**
   * Clean formState
   */
  const cleanChangesState = (values) => setChangesState({ ...values })

  const parsePaymethods = (paymethods) => {
    const _paymethods = paymethods && paymethods
      .filter(paymethod => !paymethodsNotAllowed.includes(paymethod?.gateway))
      .map(paymethod => {
        let dataTemplate = paymethod?.data_template
        if (typeof dataTemplate === 'string') {
          try { dataTemplate = JSON.parse(dataTemplate) } catch (e) { dataTemplate = null }
        }
        return { ...paymethod, data_template: dataTemplate }
      })
    return _paymethods
  }

  /**
   * Method to get paymethods from API
   */
  const getBusinessPaymethods = async () => {
    try {
      const response = await fetch(`${ordering.root}/business/${business.id}/paymethods?params=sites,devices`,
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
      const { result } = await response.json()
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
        setSitesState({ ...sitesState, loading: false, sites: sitesResult })
      } catch (err) {
        setSitesState({ ...sitesState, loading: false, sites: err.message })
      }
      setBusinessPaymethodsState({ ...paymethodsList, loading: false, paymethods: parsePaymethods(result) })
    } catch (err) {
      setBusinessPaymethodsState({ ...paymethodsList, loading: false, error: err.message })
    }
  }

  /**
   * Method to get devices from API
   */
  const getDevices = async () => {
    try {
      const response = await fetch(`${ordering.root}/devices`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      )
      const { result } = await response.json()
      const devices = result.filter(item => item.business_id === business?.id)
      setDeviceState({ ...deviceState, loading: false, devices })
    } catch (err) {
      setDeviceState({ ...deviceState, loading: false, error: err.message })
    }
  }

  /**
   * Method to get paymethods from API
   */
  const getAllPaymethods = async () => {
    try {
      const response = await fetch(`${ordering.root}/paymethods?where=[{%22attribute%22:%22enabled%22,%22value%22:true}]`,
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
      const { result } = await response.json()
      setPaymethodsList({ ...paymethodsList, loading: false, paymethods: parsePaymethods(result) })
    } catch (err) {
      setPaymethodsList({ ...paymethodsList, loading: false, error: err.message })
    }
  }

  const getPluginRequestHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-app-x': ordering.appId,
    'X-INTERNAL-PRODUCT-X': ordering.appInternalName
  })

  const getPlugins = async () => {
    try {
      const response = await fetch(`${ordering.root}/plugins`, {
        method: 'GET',
        headers: getPluginRequestHeaders()
      })
      const content = await response.json()
      if (!content.error) {
        setPluginsState({ plugins: content.result || [], loading: false, error: null })
        return
      }
      setPluginsState({ plugins: [], loading: false, error: content.result })
    } catch (err) {
      setPluginsState({ plugins: [], loading: false, error: err.message })
    }
  }

  const getInstallErrorMessage = (result) => {
    if (Array.isArray(result)) return result.filter(Boolean).join(', ')
    return result || t('ERROR', 'Error')
  }

  const handleInstallPaymentPlugin = async (pluginKey) => {
    const request = buildInstallPaymentPluginRequest({ pluginKey })
    if (request.error) {
      showToast(ToastType.Error, t(request.error, 'Unknown payment plugin'))
      return request.error
    }
    if (installingPluginKey) return null
    try {
      setInstallingPluginKey(pluginKey)
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const response = await fetch(`${ordering.root}/plugins`, {
        method: 'POST',
        headers: getPluginRequestHeaders(),
        body: JSON.stringify(request.body)
      })
      const content = await response.json()
      if (!content.error) {
        showToast(ToastType.Success, t('PLUGIN_SAVED', 'Plugin saved'))
        await Promise.all([getPlugins(), getAllPaymethods()])
        return pluginKey
      }
      showToast(ToastType.Error, getInstallErrorMessage(content.result))
    } catch (err) {
      showToast(ToastType.Error, err.message)
    } finally {
      setInstallingPluginKey(null)
    }
  }

  /**
   * Method to create the business paymethod option from API
   * @param {*} paymethodId paymethod id to create
   */
  const handleCreateBusinessPaymentOption = async (paymethodId, callback) => {
    const paymethod = paymethodsList.paymethods.find(_paymethod => _paymethod.id === paymethodId)
    const params = {
      enabled: !callback,
      paymethod_id: paymethodId,
      sandbox: sandboxRequiredGateways.includes(paymethod.gateway)
    }
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-app-x': ordering.appId,
          'X-INTERNAL-PRODUCT-X': ordering.appInternalName
        },
        body: JSON.stringify(params)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/paymethods`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setBusinessPaymethodsState(prevState => ({
          ...prevState,
          paymethods: [
            ...prevState.paymethods,
            { ...content.result, paymethod }
          ]
        }))
        setActionState({ loading: false, result: { error: false } })
        showToast(ToastType.Success, t('PAYMETHOD_SAVED', 'Payment method saved'))
        callback && callback({ ...content.result, paymethod })
      } else {
        setActionState({ loading: false, result: { error: true, result: content.result } })
        showToast(ToastType.Error, getInstallErrorMessage(content.result))
      }
    } catch (err) {
      setActionState({ result: { error: true, result: err.message }, loading: false })
      showToast(ToastType.Error, t('PAYMETHOD_SAVE_FAILED', 'The payment method could not be saved. Please try again.'))
    }
  }

  /**
   * Method to update the business paymethod option
   * @param {Number} paymethodId business paymethod id to delete
   * @param {Object} options parameters to update
   */
  const handleUpdateBusinessPaymethodOpton = async (paymethodId, options) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-app-x': ordering.appId,
          'X-INTERNAL-PRODUCT-X': ordering.appInternalName
        },
        body: JSON.stringify(options)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/paymethods/${paymethodId}`, requestOptions)
      const content = await response.json()
      setChangesState(content.error ? changesState : {})
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        setBusinessPaymethodsState(prevState => ({
          ...prevState,
          paymethods: prevState.paymethods.filter(paymethod => {
            if (paymethod.id === paymethodId) {
              Object.assign(paymethod, content.result)
            }
            return true
          })
        }))
        showToast(ToastType.Success, t('PAYMETHOD_SAVED', 'Payment method saved'))
      } else {
        setActionState({ loading: false, result: { error: true, result: content.result } })
        showToast(ToastType.Error, getInstallErrorMessage(content.result))
      }
    } catch (err) {
      setActionState({ result: { error: true, result: err.message }, loading: false })
      showToast(ToastType.Error, t('PAYMETHOD_SAVE_FAILED', 'The payment method could not be saved. Please try again.'))
    }
  }

  /**
   * Method to update the business paymethod option
   */
  const handleUpdateBusiness = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-app-x': ordering.appId,
          'X-INTERNAL-PRODUCT-X': ordering.appInternalName
        },
        body: JSON.stringify(changesState)
      }
      const response = await fetch(`${ordering.root}/business/${business.id}`, requestOptions)
      const content = await response.json()
      setChangesState(content.error ? changesState : {})
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        handleSuccessUpdate && handleSuccessUpdate(content.result)
      }
    } catch (err) {
      setActionState({ result: { error: true, result: err.message }, loading: false })
    }
  }

  /**
   * Method to delete the business paymethod option from API
   * @param {Number} paymethodId id to delete the business paymethod
   */
  const handleDeleteBusinessPaymethodOption = async (paymethodId) => {
    const businessPaymethodId = businessPaymethodsState.paymethods.find(paymethod => paymethod.paymethod_id === paymethodId)?.id
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-app-x': ordering.appId,
          'X-INTERNAL-PRODUCT-X': ordering.appInternalName
        }
      }
      const response = await fetch(`${ordering.root}/business/${business.id}/paymethods/${businessPaymethodId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ ...actionState, loading: false })
        const updatedPaymethods = businessPaymethodsState.paymethods.filter(paymethod => paymethod.paymethod_id !== paymethodId)
        setBusinessPaymethodsState({ ...businessPaymethodsState, paymethods: updatedPaymethods })
        showToast(ToastType.Success, t('PAYMETHOD_DELETED', 'Payment method deleted'))
        setIsSuccessDeleted(true)
      }
    } catch (err) {
      setActionState({ result: { error: true, result: err.message }, loading: false })
    }
  }

  /**
   * Method to handle payment enabled state
   * @param {Number} paymethodId id of payment method
   */
  const handleClickPayment = (paymethodId, callback) => {
    const found = businessPaymethodsState.paymethods.find(paymethod => paymethod.paymethod_id === paymethodId)
    if (found) {
      handleUpdateBusinessPaymethodOpton(found.id, {
        enabled: !found.enabled
      })
    } else {
      handleCreateBusinessPaymentOption(paymethodId, callback)
    }
  }

  /**
   * Method to allow all paymethods
   */
  const handleSelectAllPaymethods = () => {
    for (const paymethod of paymethodsList.paymethods) {
      const found = businessPaymethodsState.paymethods.find(_paymethod => _paymethod.paymethod_id === paymethod.id)
      if (found) {
        if (!found?.enabled) {
          handleUpdateBusinessPaymethodOpton(found.id, {
            enabled: true
          })
        }
      } else {
        handleCreateBusinessPaymentOption(paymethod.id)
      }
    }
  }
  /**
   * Method to disable all paymethods
   */
  const handleSelectNonePaymethods = () => {
    for (const paymethod of businessPaymethodsState.paymethods) {
      if (paymethod?.enabled) {
        handleUpdateBusinessPaymethodOpton(paymethod.id, {
          enabled: false
        })
      }
    }
  }

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   * @param {Boolean} sandbox value if sandbox data is or not
   */
  const handleChangeInput = (e, sandbox) => {
    if (sandbox) {
      setChangesState({
        ...changesState,
        data_sandbox: {
          ...changesState?.data_sandbox,
          [e.target.name]: e.target.value
        }
      })
    } else {
      setChangesState({
        ...changesState,
        data: {
          ...changesState?.data,
          [e.target.name]: e.target.value
        }
      })
    }
  }
  /**
   * Method to control the sanbox enable state
   */
  const handleChangeSandbox = (checked) => {
    setChangesState({
      ...changesState,
      sandbox: checked ?? !changesState?.sandbox
    })
  }

  /**
   * Method to connect with stripe
   */
  const handleStripeConnect = () => {
    const connect = window.open(`https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${stripeClientId}&scope=read_write&state=${token}`, '_blank', 'directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,clearcache=yes')
    const interval = setInterval(function () {
      if (!connect.closed) {
        connect.postMessage('data', ordering.url)
      } else {
        clearInterval(interval)
      }
    }, 200)
    let timeout = null
    window.addEventListener('message', function (e) {
      if (e.origin.indexOf(`.${configurations?.subdomain}`) === -1) {
        return
      }
      clearInterval(interval)
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(function () {
        connect.postMessage('close', ordering.url)
        if (!e.data.error && e.data.result) {
          const stripeData = mapStripeConnectOAuthResult(e.data.result)
          if (stripeData) {
            setStripeConnectData(prev => ({ ...prev, ...stripeData }))
          }
        } else if (e.data.error) {
          setActionState({ ...actionState, loading: false, error: e.data.error })
        }
      }, 1000)
    })
  }

  /**
   * Method to save the stripe connect data
   * @param {Number} paymethodId id of payment method
   */
  const handleStripeSave = (paymethodId) => {
    const requestionOptions = buildStripeConnectSavePayload(stripeConnectData)
    if (requestionOptions) {
      handleUpdateBusinessPaymethodOpton(paymethodId, requestionOptions)
    }
    handleUpdateBusiness()
  }

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeStripeInput = (e) => {
    setChangesState({
      ...changesState,
      [e.target.name]: e.target.value
    })
  }

  const handleChangeBusinessPaymentState = (values) => {
    setChangesState({ ...changesState, ...values })
  }

  const handleChangeStripeConnectData = (values) => {
    setStripeConnectData({ ...stripeConnectData, ...values })
  }

  /**
   * Method to save the form state
   * @param {Number} paymethodId id to save the change state
   */
  const handleSaveClick = (paymethodId, options) => {
    let changes = { ...changesState }
    const paymethod = businessPaymethodsState.paymethods.find(paymethod => paymethod.id === paymethodId)
    if (changes?.data) {
      changes = { ...changes, data: !options?.notUpdateData ? JSON.stringify(changes.data) : paymethod.data ? JSON.stringify(paymethod.data) : null }
    }
    if (changes?.data_sandbox) {
      changes = { ...changes, data_sandbox: !options?.notUpdateDataSandbox ? JSON.stringify(changes.data_sandbox) : paymethod.data_sandbox ? JSON.stringify(paymethod.data_sandbox) : null }
    }
    if (changes?.allowed_order_types) {
      changes = {
        ...changes,
        allowed_order_types: changes.allowed_order_types.length > 0
          ? JSON.stringify(changes.allowed_order_types)
          : null
      }
    }
    if (changes?.sites) {
      changes = {
        ...changes,
        sites: JSON.stringify(changes.sites)
      }
    }
    if (changes?.devices) {
      changes = {
        ...changes,
        devices: JSON.stringify(changes.devices)
      }
    }
    handleUpdateBusinessPaymethodOpton(paymethodId, changes)
  }

  const handleSuccessPaymethodUpdate = (updatedPaymethods) => {
    setBusinessPaymethodsState({
      ...businessPaymethodsState,
      paymethods: updatedPaymethods
    })
  }

  useEffect(() => {
    getAllPaymethods()
    getBusinessPaymethods()
    getDevices()
    getPlugins()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessPaymethodsState={businessPaymethodsState}
          paymethodsList={paymethodsList}
          handleClickPayment={handleClickPayment}
          actionState={actionState}
          sitesState={sitesState}
          handleDeleteBusinessPaymethodOption={handleDeleteBusinessPaymethodOption}
          changesState={changesState}
          handleChangeBusinessPaymentState={handleChangeBusinessPaymentState}
          stripeConnectData={stripeConnectData}
          handleChangeStripeConnectData={handleChangeStripeConnectData}
          cleanChangesState={cleanChangesState}
          handleChangeSandbox={handleChangeSandbox}
          handleChangeInput={handleChangeInput}
          handleSaveClick={handleSaveClick}
          handleStripeConnect={handleStripeConnect}
          handleChangeStripeInput={handleChangeStripeInput}
          handleStripeSave={handleStripeSave}
          isSuccessDeleted={isSuccessDeleted}
          setIsSuccessDeleted={setIsSuccessDeleted}
          deviceState={deviceState}
          handleSelectAllPaymethods={handleSelectAllPaymethods}
          handleSelectNonePaymethods={handleSelectNonePaymethods}
          handleSuccessPaymethodUpdate={handleSuccessPaymethodUpdate}
          pluginsState={pluginsState}
          installingPluginKey={installingPluginKey}
          handleInstallPaymentPlugin={handleInstallPaymentPlugin}
        />
      )}
    </>
  )
}

BusinessPaymethods.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
