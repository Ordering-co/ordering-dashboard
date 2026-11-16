import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useConfig } from '../../contexts/ConfigContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { mapStripeConnectOAuthResult } from './stripeConnectHelpers'
import { getStripeConnectLegacyRedirectUri } from '../../utils/stripeConnectRedirectUris'
import { buildInstallPaymentPluginRequest } from './installPaymentPlugin'
import { translateApiMessage } from '../../utils/translateApiMessage'

const paymethodsNotAllowed = ['paypal_express', 'authorize', 'stripe_direct', 'stripe_redirect']

// redesign stores 5.9 (G4-06): the PUT body of an explicit `changes` object (only the keys present).
// redesign stores 5.11: lifted out so `handleSaveStripeConnect` knows whether a PUT will happen.
const serializePaymethodChanges = (changes = {}) => {
  const serialized = {}
  if ('sandbox' in changes) serialized.sandbox = changes.sandbox
  if ('data' in changes) serialized.data = changes.data ? JSON.stringify(changes.data) : null
  if ('data_sandbox' in changes) serialized.data_sandbox = changes.data_sandbox ? JSON.stringify(changes.data_sandbox) : null
  if ('allowed_order_types' in changes) {
    serialized.allowed_order_types = changes.allowed_order_types?.length > 0 ? JSON.stringify(changes.allowed_order_types) : null
  }
  if ('sites' in changes) serialized.sites = JSON.stringify(changes.sites)
  if ('devices' in changes) serialized.devices = JSON.stringify(changes.devices)
  return serialized
}

// redesign stores 5.11 (G4-24): ends ONE Stripe Connect flow exactly once. Clears its interval and timeout,
// removes its `message` listener, forgets it as the active flow and resolves its promise with `outcome`.
const endStripeConnectFlow = (activeRef, flow, outcome) => {
  if (!flow || flow.ended) return
  flow.ended = true
  clearInterval(flow.interval)
  if (flow.timeout) clearTimeout(flow.timeout)
  window.removeEventListener('message', flow.onMessage)
  if (activeRef.current === flow) activeRef.current = null
  flow.resolve(outcome)
}

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
  const [isSuccessDeleted, setIsSuccessDeleted] = useState(false)
  const [pluginsState, setPluginsState] = useState({ plugins: [], loading: true, error: null })
  const [installingPluginKey, setInstallingPluginKey] = useState(null)
  // redesign stores 5.11 (G4-24): the Stripe Connect popup flow in progress (at most one)
  const stripeConnectFlowRef = useRef(null)
  const stripeClientId = configState?.configs?.stripe_connect_sandbox?.value === '1'
    ? configState?.configs?.stripe_connect_client_id_sandbox?.value
    : configState?.configs?.stripe_connect_client_id?.value

  /**
   * Clean formState
   */
  const cleanChangesState = (values) => setChangesState({ ...values })

  // redesign stores 1.B (G4-01): a failed write frees `loading` (every form disables Save while it is true)
  // and says why, with the API's own message. Before, an `{ error: true }` answer left Save on «Loading» for good.
  const getWriteErrorMessages = (result) => (Array.isArray(result) ? result : [result])
    .map(message => translateApiMessage(t, message, null))
    .filter(Boolean)

  // redesign stores 5.9 (G4-06): `silent` still frees `loading` and keeps the error in `actionState`, but
  // leaves the toast to the caller (Select all shows ONE summary toast instead of one per request).
  const handleWriteError = (result, { silent } = {}) => {
    const messages = getWriteErrorMessages(result)
    setActionState({ loading: false, result: { error: true, result } })
    if (!silent) showToast(ToastType.Error, messages.length ? messages.join(', ') : t('ERROR', 'Error'))
  }

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
   * @param {Function} callback called with the created record (and keeps the record disabled when given)
   * @param {Object} opts redesign stores 5.9: `enabled` (boolean) overrides the `!callback` rule; `silent` skips the toasts
   * @returns {Promise<{ ok: true, result: Object } | { ok: false, error: * }>}
   */
  const handleCreateBusinessPaymentOption = async (paymethodId, callback, { enabled, silent } = {}) => {
    const paymethod = paymethodsList.paymethods.find(_paymethod => _paymethod.id === paymethodId)
    const params = {
      // redesign stores 5.9 (G4-06): an explicit boolean wins, otherwise today's rule stays
      enabled: typeof enabled === 'boolean' ? enabled : !callback,
      paymethod_id: paymethodId,
      sandbox: sandboxRequiredGateways.includes(paymethod?.gateway)
    }
    try {
      if (!silent) showToast(ToastType.Info, t('LOADING', 'Loading'))
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
        if (!silent) showToast(ToastType.Success, t('PAYMETHOD_SAVED', 'Payment method saved'))
        callback && callback({ ...content.result, paymethod })
        return { ok: true, result: content.result }
      }
      handleWriteError(content.result, { silent })
      return { ok: false, error: content.result }
    } catch (err) {
      // main: a request that never got an answer says so in plain words; the raw message stays in `actionState`
      setActionState({ loading: false, result: { error: true, result: err.message } })
      if (!silent) showToast(ToastType.Error, t('PAYMETHOD_SAVE_FAILED', 'The payment method could not be saved. Please try again.'))
      return { ok: false, error: err.message }
    }
  }

  /**
   * Method to update the business paymethod option
   * @param {Number} paymethodId business paymethod id to delete
   * @param {Object} options parameters to update
   * @param {Object} opts redesign stores 5.9: `silent` skips the toasts (state and `actionState` still update)
   * @returns {Promise<{ ok: true, result: Object } | { ok: false, error: * }>}
   */
  const handleUpdateBusinessPaymethodOpton = async (paymethodId, options, { silent } = {}) => {
    try {
      if (!silent) showToast(ToastType.Info, t('LOADING', 'Loading'))
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
        setActionState({ loading: false, result: { error: false } })
        setBusinessPaymethodsState(prevState => ({
          ...prevState,
          paymethods: prevState.paymethods.filter(paymethod => {
            if (paymethod.id === paymethodId) {
              Object.assign(paymethod, content.result)
            }
            return true
          })
        }))
        if (!silent) showToast(ToastType.Success, t('PAYMETHOD_SAVED', 'Payment method saved'))
        return { ok: true, result: content.result }
      }
      handleWriteError(content.result, { silent })
      return { ok: false, error: content.result }
    } catch (err) {
      // main: a request that never got an answer says so in plain words; the raw message stays in `actionState`
      setActionState({ loading: false, result: { error: true, result: err.message } })
      if (!silent) showToast(ToastType.Error, t('PAYMETHOD_SAVE_FAILED', 'The payment method could not be saved. Please try again.'))
      return { ok: false, error: err.message }
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
        setActionState({ loading: false, result: { error: false } })
        const updatedPaymethods = businessPaymethodsState.paymethods.filter(paymethod => paymethod.paymethod_id !== paymethodId)
        setBusinessPaymethodsState({ ...businessPaymethodsState, paymethods: updatedPaymethods })
        showToast(ToastType.Success, t('PAYMETHOD_DELETED', 'Payment method deleted'))
        setIsSuccessDeleted(true)
        // redesign stores 5.9 (G4-06): the delete answers with its result too
        return { ok: true, result: content.result }
      }
      handleWriteError(content.result)
      return { ok: false, error: content.result }
    } catch (err) {
      handleWriteError(err.message)
      return { ok: false, error: err.message }
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

  // redesign stores 5.9 (G4-06): turns ONE row on or off and returns the result. An existing record gets a
  // PUT { enabled }; without a record it is created with the given `enabled` (`created` carries the new record with its
  // paymethod, so the UI can open its editor).
  const handleTogglePaymethod = async (paymethodId, enabled) => {
    const found = businessPaymethodsState.paymethods.find(paymethod => paymethod.paymethod_id === paymethodId)
    if (found) return handleUpdateBusinessPaymethodOpton(found.id, { enabled })
    const response = await handleCreateBusinessPaymentOption(paymethodId, null, { enabled })
    const paymethod = paymethodsList.paymethods.find(_paymethod => _paymethod.id === paymethodId)
    return { ...response, created: response.ok ? { ...response.result, paymethod } : undefined }
  }

  // redesign stores 5.9 (G4-06): saves an explicit `changes` object (it does NOT read `changesState`),
  // serialized by `serializePaymethodChanges`, and returns the result. Only the keys present are sent.
  // redesign stores 5.11 (R2 of 5.9): `silent` goes on to the update, which then skips its toasts.
  const handleSavePaymethod = async (businessPaymethodId, changes = {}, { silent } = {}) => {
    const serialized = serializePaymethodChanges(changes)
    if (Object.keys(serialized).length === 0) return { ok: true }
    return handleUpdateBusinessPaymethodOpton(businessPaymethodId, serialized, { silent })
  }

  // redesign stores 5.11: saves the Stripe Connect panel in one go and returns the result, with no toasts.
  // The gateway part (everything but `extra`) is a silent PUT; the fees (`extra`: the changed fixed_usage_fee /
  // percentage_usage_fee, as typed strings) are a POST to the business, only when there are any and only if the PUT held.
  const handleSaveStripeConnect = async (businessPaymethodId, changes = {}) => {
    const { extra, ...gatewayChanges } = changes || {}
    const hasGatewayChanges = Object.keys(serializePaymethodChanges(gatewayChanges)).length > 0
    const hasFees = Boolean(extra) && Object.keys(extra).length > 0
    if (hasGatewayChanges) {
      const saved = await handleSavePaymethod(businessPaymethodId, gatewayChanges, { silent: true })
      if (!saved.ok) return { ok: false, error: saved.error }
    }
    if (!hasFees) return { ok: true }
    try {
      setActionState({ ...actionState, loading: true })
      const response = await fetch(`${ordering.root}/business/${business.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-app-x': ordering.appId,
          'X-INTERNAL-PRODUCT-X': ordering.appInternalName
        },
        body: JSON.stringify(extra)
      })
      const content = await response.json()
      if (!content.error) {
        setActionState({ loading: false, result: { error: false } })
        handleSuccessUpdate?.(content.result)
        return { ok: true }
      }
      handleWriteError(content.result, { silent: true })
      const messages = getWriteErrorMessages(content.result)
      return {
        ok: false,
        error: hasGatewayChanges
          ? [t('STRIPE_CONNECT_FEES_NOT_SAVED', 'The payment method was saved, but the fees were not.'), ...messages]
          : messages,
        // review 5.11 F2: only the fees are still unsaved (the panel keeps the rest as saved)
        unsaved: ['extra']
      }
    } catch (err) {
      handleWriteError(err.message, { silent: true })
      return {
        ok: false,
        error: hasGatewayChanges
          ? [t('STRIPE_CONNECT_FEES_NOT_SAVED', 'The payment method was saved, but the fees were not.'), err.message]
          : [err.message],
        unsaved: ['extra']
      }
    }
  }

  /**
   * redesign bugs C (decision 4 of Stores): what the detail of a gateway the store has no record of starts from, with no
   * request: the record main created on open (disabled, `sandboxRequiredGateways`), not written yet. `draft: true` and no `id`.
   * @param {Number} paymethodId id of the project's paymethod
   */
  const getDraftBusinessPaymethod = (paymethodId) => {
    const paymethod = paymethodsList.paymethods.find(_paymethod => _paymethod.id === paymethodId)
    return {
      draft: true,
      paymethod_id: paymethodId,
      paymethod,
      enabled: false,
      sandbox: sandboxRequiredGateways.includes(paymethod?.gateway),
      data: null,
      data_sandbox: null,
      sites: [],
      devices: []
    }
  }

  /**
   * redesign bugs C: the first Save of a draft. It creates the record as main did on open (disabled), then saves the
   * changes on it like the detail's own Save (Stripe Connect's with `stripeConnect`). Silent: the panel says how the save went.
   * @returns {Promise<{ ok: true } | { ok: false, error: * }>}
   */
  const handleCreatePaymethodOnSave = async (paymethodId, changes = {}, { stripeConnect } = {}) => {
    const created = await handleCreateBusinessPaymentOption(paymethodId, null, { enabled: false, silent: true })
    if (!created.ok) return { ok: false, error: created.error }
    const id = created.result?.id
    return stripeConnect ? handleSaveStripeConnect(id, changes) : handleSavePaymethod(id, changes, { silent: true })
  }

  /**
   * Method to allow the given paymethods (redesign stores 5.9, , G4-06)
   * The UI decides which rows (the ones the list shows); no caller may turn on «every paymethod of the project» any more.
   * Runs in parallel without per-request toasts and shows ONE summary toast.
   * @param {Array<Number>} paymethodIds paymethod ids to turn on
   * @returns {Promise<{ ok: boolean, okCount: number, failCount: number }>}
   */
  const handleSelectAllPaymethods = async (paymethodIds) => {
    if (!Array.isArray(paymethodIds)) return { ok: true, okCount: 0, failCount: 0 }
    const requests = [...new Set(paymethodIds)].map(paymethodId => {
      const found = businessPaymethodsState.paymethods.find(_paymethod => _paymethod.paymethod_id === paymethodId)
      if (found) {
        if (found.enabled) return null
        return handleUpdateBusinessPaymethodOpton(found.id, { enabled: true }, { silent: true })
      }
      return handleCreateBusinessPaymentOption(paymethodId, null, { enabled: true, silent: true })
    }).filter(Boolean)
    const results = await Promise.all(requests)
    const failed = results.filter(response => !response.ok)
    const okCount = results.length - failed.length
    const failCount = failed.length
    if (okCount > 0) {
      showToast(ToastType.Success, t('PAYMETHODS_TURNED_ON', '_count_ payment methods turned on').replace('_count_', okCount))
    }
    if (failCount > 0) {
      const messages = [...new Set(failed.flatMap(response => getWriteErrorMessages(response.error)))]
      showToast(
        ToastType.Error,
        `${t('PAYMETHODS_TURN_ON_FAILED', '_count_ could not be turned on:').replace('_count_', failCount)} ${messages.length ? messages.join(', ') : t('ERROR', 'Error')}`
      )
    }
    return { ok: failCount === 0, okCount, failCount }
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
   * Method to connect with stripe
   * redesign stores 5.11 (G4-24): returns a Promise that never rejects. It resolves `{ ok: true, sandbox, data }`
   * (the mapped OAuth result) or `{ ok: false, reason: 'blocked' | 'closed' | 'error', error? }`. The popup flow itself
   * (URL, 200ms ping, origin check, 1s wait, close message) is the one main had; what changes is that its listener,
   * interval and timeout are released when the flow ends, when a new one starts and when the controller unmounts.
   */
  const handleStripeConnect = () => new Promise(resolve => {
    // a second click ends the previous flow first (it resolves `closed`)
    const previous = stripeConnectFlowRef.current
    endStripeConnectFlow(stripeConnectFlowRef, previous, { ok: false, reason: 'closed' })
    // Without its own redirect_uri Stripe falls back to the default one of the platform, which is Stripe Connect v2's
    // as soon as the platform registers it: this window then ended on a page that never hands over the keys.
    const redirectUri = encodeURIComponent(getStripeConnectLegacyRedirectUri(ordering.url, ordering.project))
    const connect = window.open(`https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${stripeClientId}&scope=read_write&redirect_uri=${redirectUri}&state=${token}`, '_blank', 'directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,clearcache=yes')
    if (!connect) {
      // popup blocked: nothing to ping and nothing to listen to
      resolve({ ok: false, reason: 'blocked' })
      return
    }
    const flow = { ended: false, interval: null, timeout: null, onMessage: null, resolve }
    stripeConnectFlowRef.current = flow
    flow.interval = setInterval(function () {
      if (!connect.closed) {
        connect.postMessage('data', ordering.url)
      } else {
        endStripeConnectFlow(stripeConnectFlowRef, flow, { ok: false, reason: 'closed' })
      }
    }, 200)
    flow.onMessage = function (e) {
      if (e.origin.indexOf(`.${configurations?.subdomain}`) === -1) {
        return
      }
      clearInterval(flow.interval)
      if (flow.timeout) clearTimeout(flow.timeout)
      flow.timeout = setTimeout(function () {
        let outcome = { ok: false, reason: 'error' }
        try {
          connect.postMessage('close', ordering.url)
          if (!e.data.error && e.data.result) {
            const stripeData = mapStripeConnectOAuthResult(e.data.result)
            if (stripeData) outcome = { ok: true, ...stripeData }
          } else if (e.data.error) {
            setActionState({ ...actionState, loading: false, error: e.data.error })
            outcome = { ok: false, reason: 'error', error: e.data.error }
          }
        } catch (err) {
          outcome = { ok: false, reason: 'error', error: err.message }
        }
        endStripeConnectFlow(stripeConnectFlowRef, flow, outcome)
      }, 1000)
    }
    window.addEventListener('message', flow.onMessage)
  })

  const handleChangeBusinessPaymentState = (values) => {
    setChangesState({ ...changesState, ...values })
  }

  const handleSuccessPaymethodUpdate = (updatedPaymethods) => {
    setBusinessPaymethodsState({
      ...businessPaymethodsState,
      paymethods: updatedPaymethods
    })
  }

  // redesign stores 5.11 (G4-24): leaving the screen ends a Stripe Connect flow still waiting
  useEffect(() => () => {
    endStripeConnectFlow(stripeConnectFlowRef, stripeConnectFlowRef.current, { ok: false, reason: 'closed' })
  }, [])

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
          cleanChangesState={cleanChangesState}
          handleStripeConnect={handleStripeConnect}
          isSuccessDeleted={isSuccessDeleted}
          setIsSuccessDeleted={setIsSuccessDeleted}
          deviceState={deviceState}
          handleSelectAllPaymethods={handleSelectAllPaymethods}
          // redesign stores 5.9 (G4-06): explicit-result handlers for the new Payments UI
          handleSavePaymethod={handleSavePaymethod}
          handleSaveStripeConnect={handleSaveStripeConnect}
          handleTogglePaymethod={handleTogglePaymethod}
          // redesign bugs C: a gateway is created by its first Save, not by opening it
          getDraftBusinessPaymethod={getDraftBusinessPaymethod}
          handleCreatePaymethodOnSave={handleCreatePaymethodOnSave}
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
