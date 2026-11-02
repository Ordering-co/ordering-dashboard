export const BOT_LANGUAGES = ['en', 'es', 'fr', 'ar']

const colorText = (value) => (typeof value === 'string' ? value.trim() : '')

/**
 * Language the API accepts on a new WhatsApp bot. Anything else falls back
 * to English.
 * @param {unknown} value dashboard or form language
 */
export const normalizeLanguageCode = (value) => {
  const code = String(value ?? '').trim().toLowerCase().slice(0, 2)
  return BOT_LANGUAGES.includes(code) ? code : 'en'
}

const text = (value) => (value === null || value === undefined ? '' : String(value).trim())
const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '')

/**
 * Language the user actually picked. An empty or unknown value stays empty
 * so a new bot is not created in English by default.
 * @param {unknown} value form language
 */
export const chosenLanguageCode = (value) => {
  const code = String(value ?? '').trim().toLowerCase().slice(0, 2)
  return BOT_LANGUAGES.includes(code) ? code : ''
}

/**
 * Branch mode the user actually picked. An empty value stays empty.
 * @param {unknown} value form mode
 */
export const chosenBranchMode = (value) => {
  const mode = String(value ?? '').trim().toLowerCase()
  return mode === 'auto' || mode === 'marketplace' ? mode : ''
}

const chosenAuthType = (value) => (
  value === 'manual' || value === 'business_login' ? value : ''
)

/**
 * Body for `POST /ai/agents`. Provider and type are fixed: this screen only
 * creates a WhatsApp guided bot. Nothing else is filled in for the user.
 * Returns null until the brand, language, branch mode and connection method
 * are chosen, and until manual credentials are complete.
 * An empty color is left out so the webview default is not stored.
 * The ordering webview URL is not part of this form, so it is never sent.
 * @param {Object} input form values
 * @returns {Object|null}
 */
export const createBotPayload = (input = {}) => {
  const franchiseId = Number(input.franchiseId)
  const languageCode = chosenLanguageCode(input.languageCode)
  const branchMode = chosenBranchMode(input.branchSelectionMode)
  const authType = chosenAuthType(input.authType)
  if (!Number.isInteger(franchiseId) || franchiseId <= 0 || !languageCode || !branchMode || !authType) return null

  const settings = { branch_selection_mode: branchMode }
  const primary = colorText(input.primaryColor)
  const secondary = colorText(input.secondaryColor)
  if (primary) settings.webview_primary_color = primary
  if (secondary) settings.webview_secondary_color = secondary

  const providerSettings = {
    auth_type: authType,
    language_code: languageCode
  }
  const welcome = text(input.welcomeMessage)
  const fallback = text(input.fallbackSupportMessage)
  if (welcome) providerSettings.welcome_message = welcome
  if (fallback) providerSettings.fallback_support_message = fallback

  const body = {
    provider: 'whatsapp',
    provider_type: 'chat_bot',
    franchise_id: franchiseId,
    enabled: input.enabled === true,
    provider_settings: providerSettings,
    settings
  }

  if (authType === 'manual') {
    const phoneNumberId = digitsOnly(input.phoneNumberId)
    const countryCode = digitsOnly(input.countryCode)
    const phoneNumber = digitsOnly(input.phoneNumber)
    const accessToken = text(input.accessToken)
    const wabaId = text(input.wabaId)
    if (!phoneNumberId || !countryCode || phoneNumber.length < 5 || !accessToken || !wabaId) return null
    body.provider_external_id = phoneNumberId
    providerSettings.country_code = countryCode
    providerSettings.phone_number = phoneNumber
    providerSettings.access_token = accessToken
    providerSettings.waba_id = wabaId
  }

  return body
}
