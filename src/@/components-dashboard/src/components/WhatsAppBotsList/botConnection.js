import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { normalizeLanguageCode } from './botCreate'

export const AUTH_MANUAL = 'manual'
export const AUTH_BUSINESS_LOGIN = 'business_login'

const text = (value) => (value === null || value === undefined ? '' : String(value).trim())
export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '')

/**
 * International format of a WhatsApp number, or null without a full number.
 * @param {string} countryCode
 * @param {string} phoneNumber
 */
export const formatWhatsAppPhone = (countryCode, phoneNumber) => {
  const country = digitsOnly(countryCode)
  const phone = digitsOnly(phoneNumber)
  if (!country || !phone) return null
  return parsePhoneNumberFromString(`+${country}${phone}`)?.formatInternational() || `+${country} ${phone}`
}

/**
 * Connection fields shown in the bot panel. `provider_settings` also holds
 * the Meta access token and the two-step PIN: only whether they exist
 * leaves this function.
 * @param {Object} agent agent from `GET /ai/agents/{id}`
 */
export const readBotConnection = (agent = {}) => {
  const settings = agent?.provider_settings ?? {}
  return {
    authType: settings.auth_type === AUTH_BUSINESS_LOGIN ? AUTH_BUSINESS_LOGIN : AUTH_MANUAL,
    configured: agent?.configured === true,
    misconfiguredReason: agent?.misconfigured_reason || null,
    phoneNumberId: text(agent?.provider_external_id),
    languageCode: normalizeLanguageCode(settings.language_code),
    countryCode: text(settings.country_code),
    phoneNumber: text(settings.phone_number),
    wabaId: text(settings.waba_id),
    welcomeMessage: text(settings.welcome_message),
    fallbackSupportMessage: text(settings.fallback_support_message),
    hasAccessToken: Boolean(settings.access_token),
    hasPin: Boolean(settings.pin),
    pinDownloaded: Boolean(settings.pin_downloaded_at),
    registrationStatus: settings.registration_status ? String(settings.registration_status).toUpperCase() : null,
    connectedAt: settings.connected_at || null
  }
}

/**
 * @param {Object|null} connection result of `readBotConnection`
 * @returns {'connected'|'error'|'notConnected'}
 */
export const connectionStatus = (connection) => {
  if (connection?.configured) return 'connected'
  if (connection?.misconfiguredReason) return 'error'
  return 'notConnected'
}

/**
 * Chat link used to test the bot. Built from the number digits only; it
 * carries no query string.
 * @param {{ countryCode?: string, phoneNumber?: string }} connection
 */
export const whatsAppTestUrl = ({ countryCode, phoneNumber } = {}) => {
  const country = digitsOnly(countryCode)
  const phone = digitsOnly(phoneNumber)
  if (!country || !phone) return null
  return `https://wa.me/${country}${phone}`
}

/**
 * Same chat link from the number already shown on the list.
 * Digits only, so a formatted phone cannot carry a query string.
 * @param {string|null} phone
 */
export const whatsAppTestUrlFromPhone = (phone) => {
  const digits = digitsOnly(phone)
  if (digits.length < 8) return null
  return `https://wa.me/${digits}`
}

const CONNECT_REASONS = ['pending_oauth', 'logged_out']
const RECONNECT_REASONS = ['missing_access_token', 'invalid_access_token', 'revoked_by_user', 'auth_type_changed']
const PIN_REASONS = ['missing_pin', 'invalid_pin']
const RETRY_REASONS = [
  'pin_rate_limited',
  'phone_reverification_needed',
  'phone_not_registered',
  'certificate_error',
  'registration_failed',
  'registration_rate_limited'
]

export const KNOWN_REASONS = [
  ...CONNECT_REASONS,
  ...RECONNECT_REASONS,
  'missing_phone_number_id',
  ...PIN_REASONS,
  ...RETRY_REASONS,
  'account_blocked',
  'pending_registration'
]

/**
 * What a Business Login bot in error offers, by `misconfigured_reason`.
 * @param {string} reason
 * @returns {{ action: 'connect'|'doctor'|'verify'|'reconnectAnother', label: string, showDisconnect?: boolean }}
 */
export const errorActionFor = (reason) => {
  if (CONNECT_REASONS.includes(reason)) return { action: 'connect', label: 'connect' }
  if (RECONNECT_REASONS.includes(reason)) return { action: 'connect', label: 'reconnect' }
  if (reason === 'missing_phone_number_id') return { action: 'doctor', label: 'completeSetup' }
  if (PIN_REASONS.includes(reason)) return { action: 'doctor', label: 'diagnose', showDisconnect: true }
  if (RETRY_REASONS.includes(reason)) return { action: 'doctor', label: 'retry' }
  if (reason === 'account_blocked') return { action: 'reconnectAnother', label: 'connectAnother' }
  if (reason === 'pending_registration') return { action: 'verify', label: 'checkStatus' }
  return { action: 'connect', label: 'reconnect' }
}

/**
 * Body of `PUT /ai/agents/{id}` for manual credentials. Switching from
 * Business Login sends every credential, since the API requires them all then.
 * An empty token field keeps the saved token. An empty message clears that key.
 * The ordering webview URL is not edited here, so it is never sent.
 * @param {Object} saved result of `readBotConnection`
 * @param {Object} draft form values
 * @returns {Object|null} null when nothing changed
 */
export const manualCredentialsPayload = (saved, draft) => {
  const switching = saved?.authType !== AUTH_MANUAL
  const next = {
    phoneNumberId: digitsOnly(draft?.phoneNumberId),
    languageCode: normalizeLanguageCode(draft?.languageCode),
    countryCode: digitsOnly(draft?.countryCode),
    phoneNumber: digitsOnly(draft?.phoneNumber),
    wabaId: text(draft?.wabaId),
    accessToken: text(draft?.accessToken),
    welcomeMessage: text(draft?.welcomeMessage),
    fallbackSupportMessage: text(draft?.fallbackSupportMessage)
  }
  const body = {}
  const settings = switching ? { auth_type: AUTH_MANUAL } : {}

  if (switching || next.phoneNumberId !== saved?.phoneNumberId) body.provider_external_id = next.phoneNumberId
  if (switching || next.countryCode !== saved?.countryCode) settings.country_code = next.countryCode
  if (switching || next.phoneNumber !== saved?.phoneNumber) settings.phone_number = next.phoneNumber
  if (switching || next.wabaId !== saved?.wabaId) settings.waba_id = next.wabaId
  if (next.accessToken) settings.access_token = next.accessToken
  if (next.languageCode !== normalizeLanguageCode(saved?.languageCode)) settings.language_code = next.languageCode
  if (next.welcomeMessage !== text(saved?.welcomeMessage)) settings.welcome_message = next.welcomeMessage || null
  if (next.fallbackSupportMessage !== text(saved?.fallbackSupportMessage)) settings.fallback_support_message = next.fallbackSupportMessage || null

  if (Object.keys(settings).length) body.provider_settings = settings
  return Object.keys(body).length ? body : null
}

/**
 * Welcome, fallback and language changes for a bot that is already
 * on Business Login. Credential fields stay with Meta, so they are not sent.
 * The ordering webview URL is not edited here, so it is never sent.
 * Language is shared with the manual form.
 * @param {Object} saved result of `readBotConnection`
 * @param {Object} draft form values
 * @returns {Object|null} null when nothing changed
 */
export const chatbotMessagePayload = (saved, draft) => {
  const settings = {}
  const welcome = text(draft?.welcomeMessage)
  const fallback = text(draft?.fallbackSupportMessage)
  const language = normalizeLanguageCode(draft?.languageCode)
  if (welcome !== text(saved?.welcomeMessage)) settings.welcome_message = welcome || null
  if (fallback !== text(saved?.fallbackSupportMessage)) settings.fallback_support_message = fallback || null
  if (language !== normalizeLanguageCode(saved?.languageCode)) settings.language_code = language
  return Object.keys(settings).length ? { provider_settings: settings } : null
}

/**
 * Manual credentials the API needs before it can save them.
 * @param {Object} saved result of `readBotConnection`
 * @param {Object} draft form values
 */
export const missingManualFields = (saved, draft) => {
  const missing = []
  if (!digitsOnly(draft?.phoneNumberId)) missing.push('phoneNumberId')
  if (!digitsOnly(draft?.countryCode)) missing.push('countryCode')
  if (digitsOnly(draft?.phoneNumber).length < 5) missing.push('phoneNumber')
  if (!text(draft?.wabaId)) missing.push('wabaId')
  const keepsToken = saved?.authType === AUTH_MANUAL && saved?.hasAccessToken
  if (!keepsToken && !text(draft?.accessToken)) missing.push('accessToken')
  return missing
}
