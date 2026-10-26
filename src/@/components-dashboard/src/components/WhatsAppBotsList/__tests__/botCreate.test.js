import { describe, expect, it } from 'vitest'
import { createBotPayload, normalizeLanguageCode } from '../botCreate'

const businessLogin = (extra = {}) => ({
  franchiseId: '67',
  languageCode: 'es',
  enabled: true,
  branchSelectionMode: 'marketplace',
  authType: 'business_login',
  primaryColor: '',
  secondaryColor: '',
  ...extra
})

describe('createBotPayload', () => {
  it('creates a whatsapp chat bot with the method the user chose', () => {
    const body = createBotPayload({
      ...businessLogin(),
      provider: 'finitless',
      provider_type: 'voice'
    })

    expect(body).toEqual({
      provider: 'whatsapp',
      provider_type: 'chat_bot',
      franchise_id: 67,
      enabled: true,
      provider_settings: {
        auth_type: 'business_login',
        language_code: 'es'
      },
      settings: {
        branch_selection_mode: 'marketplace'
      }
    })
    expect(JSON.stringify(body)).not.toMatch(/finitless|voice|access_token|waba_id/)
  })

  it('returns null until language, branch and a connection method are chosen', () => {
    expect(createBotPayload(businessLogin({ languageCode: '' }))).toBeNull()
    expect(createBotPayload(businessLogin({ branchSelectionMode: '' }))).toBeNull()
    expect(createBotPayload(businessLogin({ authType: '' }))).toBeNull()
    expect(createBotPayload(businessLogin({ languageCode: 'de' }))).toBeNull()
  })

  it('sends manual credentials and leaves Business Login without a token', () => {
    const manual = createBotPayload(businessLogin({
      authType: 'manual',
      phoneNumberId: '1077',
      countryCode: '1',
      phoneNumber: '5551234567',
      accessToken: 'token-1',
      wabaId: 'waba-1',
      welcomeMessage: 'Hello'
    }))
    expect(manual.provider_external_id).toBe('1077')
    expect(manual.provider_settings).toMatchObject({
      auth_type: 'manual',
      country_code: '1',
      phone_number: '5551234567',
      access_token: 'token-1',
      waba_id: 'waba-1',
      welcome_message: 'Hello'
    })
    expect(createBotPayload(businessLogin({ authType: 'manual', phoneNumber: '555' }))).toBeNull()
  })

  it('sends a typed color and leaves an empty one out', () => {
    const body = createBotPayload(businessLogin({
      franchiseId: 3,
      languageCode: 'en',
      primaryColor: '#112233',
      secondaryColor: '  '
    }))
    expect(body.settings.webview_primary_color).toBe('#112233')
    expect(body.settings.webview_secondary_color).toBeUndefined()
  })

  it('keeps a bot disabled when the switch is off', () => {
    expect(createBotPayload(businessLogin({ franchiseId: 3, enabled: false })).enabled).toBe(false)
  })
})

describe('normalizeLanguageCode', () => {
  it('keeps the four languages the API accepts', () => {
    expect(normalizeLanguageCode('ES-MX')).toBe('es')
    expect(normalizeLanguageCode('de')).toBe('en')
    expect(normalizeLanguageCode('')).toBe('en')
  })
})
