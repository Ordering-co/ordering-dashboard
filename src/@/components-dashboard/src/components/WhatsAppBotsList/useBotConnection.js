import { useEffect, useRef, useState } from 'react'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { readBotConnection } from './botConnection'
import { facebookLogin, loadFacebookSdk, LOGIN_CANCELLED } from './facebookSdk'

const CONNECTION_FIELDS = 'id,provider_external_id,configured,misconfigured_reason,provider_settings'
const PIN_PATTERN = /^[0-9]{6}$/

const EMPTY_STATE = { loading: false, error: null, connection: null, pending: null, notice: null }

const toMessages = (result) => {
  if (Array.isArray(result)) return result.filter(item => typeof item === 'string' && item)
  if (typeof result === 'string' && result) return [result]
  return []
}

/**
 * WhatsApp number of one bot: read it, connect it through Meta
 * Business Login or manual credentials, test it and disconnect it, with the
 * existing agent update and `auth/{auth_type}` endpoints. The access token
 * and the PIN only travel in request bodies; the state keeps whether they
 * exist, never their value.
 * @param {Number|String|null} botId agent id from `?id=`
 * @param {Function} onConnectionChange called with (id, connection) after each reload
 */
export const useBotConnection = (botId, onConnectionChange) => {
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [state, setState] = useState(EMPTY_STATE)
  const botIdRef = useRef(botId)
  const loadRef = useRef(null)
  const pendingRef = useRef(null)

  botIdRef.current = botId

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }

  const agentUrl = (id, path = '') => `${ordering.root}/ai/agents/${id}${path}`

  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: authHeaders })
    const content = await response.json()
    return { ok: response.ok && !content?.error, content }
  }

  /**
   * Read the connection fields of one bot.
   * @param {Number|String} id agent id
   * @param {Boolean} quiet keep the current values on screen while reading
   */
  const loadConnection = async (id, quiet = false) => {
    loadRef.current?.abort()
    const abortController = new AbortController()
    loadRef.current = abortController
    if (!quiet) setState({ ...EMPTY_STATE, loading: true })
    try {
      const query = new URLSearchParams({ params: CONNECTION_FIELDS })
      const response = await fetch(`${agentUrl(id)}?${query}`, { headers: authHeaders, signal: abortController.signal })
      const content = await response.json()
      if (String(botIdRef.current) !== String(id)) return
      if (!response.ok || content?.error) {
        setState(prev => ({ ...prev, loading: false, error: toMessages(content?.result).length ? toMessages(content?.result) : ['ERROR'] }))
        return
      }
      const connection = readBotConnection(content?.result)
      setState(prev => ({ ...prev, loading: false, error: null, connection }))
      onConnectionChange && onConnectionChange(id, connection)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setState(prev => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  /**
   * Run one action at a time and reload the connection when it ends.
   * @param {string} name action name shown as pending
   * @param {Function} run returns { ok, notice } ; may throw
   * @param {{ reloadOnError?: boolean }} options
   */
  const runAction = async (name, run, { reloadOnError = false } = {}) => {
    const id = botIdRef.current
    if (!id || pendingRef.current) return false
    pendingRef.current = name
    setState(prev => ({ ...prev, pending: name, notice: null }))
    let outcome
    try {
      outcome = await run(id)
    } catch (err) {
      outcome = err?.message === LOGIN_CANCELLED
        ? { ok: false, notice: null }
        : { ok: false, notice: { type: 'error', key: name, messages: [] } }
    }
    pendingRef.current = null
    if (String(botIdRef.current) !== String(id)) return false
    setState(prev => ({ ...prev, pending: null, notice: outcome?.notice ?? null }))
    if (outcome?.ok || reloadOnError) await loadConnection(id, true)
    return Boolean(outcome?.ok)
  }

  const failure = (name, content) => ({ ok: false, notice: { type: 'error', key: name, messages: toMessages(content?.result) } })
  const success = (name, messages = []) => ({ ok: true, notice: { type: 'success', key: name, messages } })

  /**
   * Embedded Signup: init, Meta popup, complete. `init` resets the agent, so
   * any end after it reloads the connection.
   * @param {Number|String} id agent id
   */
  const signupWithMeta = async (id) => {
    const init = await request(agentUrl(id, '/auth/business_login/init'), {
      method: 'POST',
      body: JSON.stringify({ auth_strategy: 'jssdk' })
    })
    if (!init.ok) return failure('connect', init.content)
    const facebook = init.content?.result?.facebook
    if (!facebook?.app_id || !facebook?.config_id) return failure('connect', null)

    await loadFacebookSdk(facebook.app_id)
    const response = await facebookLogin({
      config_id: facebook.config_id,
      response_type: 'code',
      override_default_response_type: true,
      scope: facebook.scope
    })

    const event = response?.sessionInfo?.event
    if (event === 'CANCEL' || event === 'ERROR') {
      const metaMessage = response?.sessionInfo?.data?.error_message
      return {
        ok: false,
        notice: metaMessage || event === 'ERROR' ? { type: 'error', key: 'connect', messages: metaMessage ? [String(metaMessage)] : [] } : null
      }
    }

    const code = response?.authResponse?.code
    if (!code) return { ok: false, notice: null }
    const sessionData = response?.sessionInfo?.data
    const body = { code }
    if (sessionData?.phone_number_id) body.phone_number_id = sessionData.phone_number_id
    if (sessionData?.waba_id) body.waba_id = sessionData.waba_id

    const complete = await request(agentUrl(id, '/auth/business_login/complete'), {
      method: 'POST',
      body: JSON.stringify(body)
    })
    return complete.ok ? success('connect') : failure('connect', complete.content)
  }

  /**
   * Connect through Meta Business Login. A PIN typed before connecting is
   * saved first, as the AI dashboard does, so `init` keeps it.
   * @param {{ pin?: string }} input
   */
  const connectWithMeta = ({ pin } = {}) => runAction('connect', async (id) => {
    if (pin) {
      if (!PIN_PATTERN.test(pin)) return { ok: false, notice: { type: 'error', key: 'pinFormat', messages: [] } }
      const saved = await request(agentUrl(id), {
        method: 'PUT',
        body: JSON.stringify({ provider_settings: { pin } })
      })
      if (!saved.ok) return failure('connect', saved.content)
    }
    return signupWithMeta(id)
  }, { reloadOnError: true })

  /**
   * Account blocked by Meta: log out, then connect another account.
   */
  const reconnectAnother = () => runAction('connect', async (id) => {
    const logout = await request(agentUrl(id, '/auth/business_login/logout'), { method: 'POST' })
    if (!logout.ok) return failure('connect', logout.content)
    return signupWithMeta(id)
  }, { reloadOnError: true })

  /**
   * @param {Object} body result of `manualCredentialsPayload`
   */
  const saveManualCredentials = (body) => runAction('saveManual', async (id) => {
    if (!body) return { ok: false, notice: null }
    const saved = await request(agentUrl(id), { method: 'PUT', body: JSON.stringify(body) })
    return saved.ok ? success('saveManual') : failure('saveManual', saved.content)
  })

  /**
   * Change the two-step PIN of a Business Login number. The API registers
   * the number again with it.
   * @param {string} pin six digits
   */
  const savePin = (pin) => runAction('savePin', async (id) => {
    if (!PIN_PATTERN.test(pin || '')) return { ok: false, notice: { type: 'error', key: 'pinFormat', messages: [] } }
    const saved = await request(agentUrl(id), { method: 'PUT', body: JSON.stringify({ provider_settings: { pin } }) })
    return saved.ok ? success('savePin') : failure('savePin', saved.content)
  }, { reloadOnError: true })

  /**
   * Save the PIN CSV from the API as a local file.
   */
  const downloadPin = () => runAction('downloadPin', async (id) => {
    const response = await fetch(agentUrl(id, '/auth/business_login/pin/download'), { headers: authHeaders })
    const isJson = (response.headers?.get?.('content-type') || '').includes('application/json')
    if (!response.ok || isJson) {
      const content = isJson ? await response.json() : null
      return failure('downloadPin', content)
    }
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `whatsapp_pin_${id}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    return success('downloadPin')
  })

  const verifyRegistration = () => runAction('verify', async (id) => {
    const verified = await request(agentUrl(id, '/auth/business_login/verify_registration'), { method: 'POST' })
    return verified.ok ? success('verify') : failure('verify', verified.content)
  })

  /**
   * Repair the connection. The doctor answers a list of messages.
   */
  const runDoctor = () => runAction('doctor', async (id) => {
    const doctor = await request(agentUrl(id, '/auth/business_login/doctor'), { method: 'POST' })
    if (!doctor.ok) return failure('doctor', doctor.content)
    return success('doctor', toMessages(doctor.content?.result))
  }, { reloadOnError: true })

  /**
   * Disconnect the number. The API clears the credentials and the PIN.
   */
  const disconnect = () => runAction('disconnect', async (id) => {
    const authType = state.connection?.authType || 'business_login'
    const logout = await request(agentUrl(id, `/auth/${authType}/logout`), { method: 'POST' })
    return logout.ok ? success('disconnect') : failure('disconnect', logout.content)
  })

  useEffect(() => {
    if (!botId) {
      loadRef.current?.abort()
      setState(EMPTY_STATE)
      return
    }
    loadConnection(botId)
    return () => loadRef.current?.abort()
  }, [botId])

  return {
    connectionState: state,
    connectWithMeta,
    reconnectAnother,
    saveManualCredentials,
    savePin,
    downloadPin,
    verifyRegistration,
    runDoctor,
    disconnect,
    reloadConnection: () => botId && loadConnection(botId)
  }
}
