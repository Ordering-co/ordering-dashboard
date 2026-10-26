import { describe, expect, it } from 'vitest'
import {
  chatbotMessagePayload,
  connectionStatus,
  errorActionFor,
  manualCredentialsPayload,
  readBotConnection,
  whatsAppTestUrl,
  whatsAppTestUrlFromPhone
} from '../botConnection'

const connectedAgent = {
  id: 4,
  provider_external_id: '10987654321',
  configured: true,
  misconfigured_reason: null,
  provider_settings: {
    auth_type: 'business_login',
    country_code: '1',
    phone_number: '5551234567',
    access_token: 'EAAsecret-meta-token',
    waba_id: '2233445566',
    pin: '908172',
    pin_downloaded_at: '2026-10-01 10:00:00',
    registration_status: 'CONNECTED',
    connected_at: '2026-10-01 09:00:00'
  }
}

describe('readBotConnection', () => {
  it('keeps the public fields and never the access token or the PIN', () => {
    const connection = readBotConnection(connectedAgent)

    expect(connection).toEqual({
      authType: 'business_login',
      configured: true,
      misconfiguredReason: null,
      phoneNumberId: '10987654321',
      languageCode: 'en',
      countryCode: '1',
      phoneNumber: '5551234567',
      wabaId: '2233445566',
      welcomeMessage: '',
      fallbackSupportMessage: '',
      webviewBaseUrl: '',
      hasAccessToken: true,
      hasPin: true,
      pinDownloaded: true,
      registrationStatus: 'CONNECTED',
      connectedAt: '2026-10-01 09:00:00'
    })
    expect(JSON.stringify(connection)).not.toContain('EAAsecret-meta-token')
    expect(JSON.stringify(connection)).not.toContain('908172')
  })

  it('reads an agent without settings as a manual bot with nothing connected', () => {
    expect(readBotConnection({ id: 595, provider_settings: null })).toMatchObject({
      authType: 'manual',
      configured: false,
      phoneNumberId: '',
      hasAccessToken: false,
      hasPin: false
    })
  })
})

describe('whatsAppTestUrl', () => {
  it('builds wa.me from the digits of the number only', () => {
    expect(whatsAppTestUrl({ countryCode: '+1', phoneNumber: '(555) 123-4567' })).toBe('https://wa.me/15551234567')
  })

  it('has no query string, so no session token can travel in it', () => {
    const url = new URL(whatsAppTestUrl(readBotConnection(connectedAgent)))
    expect(url.origin).toBe('https://wa.me')
    expect(url.search).toBe('')
    expect(url.hash).toBe('')
  })

  it('returns null without a full number', () => {
    expect(whatsAppTestUrl({ countryCode: '1', phoneNumber: '' })).toBeNull()
    expect(whatsAppTestUrl({})).toBeNull()
  })

  it('builds the list link from the shown phone and drops anything that is not a digit', () => {
    expect(whatsAppTestUrlFromPhone('+1 555 658 2109')).toBe('https://wa.me/15556582109')
    expect(whatsAppTestUrlFromPhone('+1 555 658 2109?token=secret')).toBe('https://wa.me/15556582109')
    expect(whatsAppTestUrlFromPhone(null)).toBeNull()
  })
})

describe('connectionStatus', () => {
  it('is connected, error or not connected', () => {
    expect(connectionStatus({ configured: true })).toBe('connected')
    expect(connectionStatus({ configured: false, misconfiguredReason: 'invalid_pin' })).toBe('error')
    expect(connectionStatus({ configured: false, misconfiguredReason: null })).toBe('notConnected')
    expect(connectionStatus(null)).toBe('notConnected')
  })
})

describe('errorActionFor', () => {
  it('maps each reason to the action the AI dashboard offers', () => {
    expect(errorActionFor('logged_out').action).toBe('connect')
    expect(errorActionFor('invalid_access_token').action).toBe('connect')
    expect(errorActionFor('missing_phone_number_id').action).toBe('doctor')
    expect(errorActionFor('invalid_pin')).toMatchObject({ action: 'doctor', showDisconnect: true })
    expect(errorActionFor('account_blocked').action).toBe('reconnectAnother')
    expect(errorActionFor('pending_registration').action).toBe('verify')
    expect(errorActionFor('something_new').action).toBe('connect')
  })
})

describe('manualCredentialsPayload', () => {
  const saved = readBotConnection({
    provider_external_id: '111',
    provider_settings: { auth_type: 'manual', country_code: '1', phone_number: '5551234567', waba_id: '22', access_token: 'old-token' }
  })

  it('sends only what changed and leaves the saved token alone when the field is empty', () => {
    const payload = manualCredentialsPayload(saved, {
      phoneNumberId: '111',
      countryCode: '1',
      phoneNumber: '5550000000',
      wabaId: '22',
      accessToken: ''
    })
    expect(payload).toEqual({ provider_settings: { phone_number: '5550000000' } })
  })

  it('sends a typed token', () => {
    const payload = manualCredentialsPayload(saved, {
      phoneNumberId: '111',
      countryCode: '1',
      phoneNumber: '5551234567',
      wabaId: '22',
      accessToken: ' new-token '
    })
    expect(payload).toEqual({ provider_settings: { access_token: 'new-token' } })
  })

  it('sends every field and auth_type when switching from business login', () => {
    const fromBusinessLogin = { ...saved, authType: 'business_login' }
    const payload = manualCredentialsPayload(fromBusinessLogin, {
      phoneNumberId: '111',
      countryCode: '1',
      phoneNumber: '5551234567',
      wabaId: '22',
      accessToken: 'new-token'
    })
    expect(payload).toEqual({
      provider_external_id: '111',
      provider_settings: {
        auth_type: 'manual',
        country_code: '1',
        phone_number: '5551234567',
        waba_id: '22',
        access_token: 'new-token'
      }
    })
  })

  it('sends the chatbot copy and clears a webview URL that was removed', () => {
    const withCopy = readBotConnection({
      provider_external_id: '111',
      provider_settings: {
        auth_type: 'manual',
        language_code: 'es',
        country_code: '1',
        phone_number: '5551234567',
        waba_id: '22',
        access_token: 'old-token',
        welcome_message: 'Hola',
        webview_base_url: 'https://order.example'
      }
    })
    expect(manualCredentialsPayload(withCopy, {
      phoneNumberId: '111',
      languageCode: 'en',
      countryCode: '1',
      phoneNumber: '5551234567',
      wabaId: '22',
      accessToken: '',
      welcomeMessage: '',
      fallbackSupportMessage: 'Te ayudamos',
      webviewBaseUrl: ''
    })).toEqual({
      provider_settings: {
        language_code: 'en',
        welcome_message: null,
        fallback_support_message: 'Te ayudamos',
        webview_base_url: null
      }
    })
  })

  it('returns null when nothing changed', () => {
    expect(manualCredentialsPayload(saved, {
      phoneNumberId: '111',
      countryCode: '1',
      phoneNumber: '5551234567',
      wabaId: '22',
      accessToken: ''
    })).toBeNull()
  })
})

describe('chatbotMessagePayload', () => {
  it('sends only the changed welcome, fallback or webview on a Business Login bot', () => {
    const saved = readBotConnection({
      provider_settings: {
        auth_type: 'business_login',
        welcome_message: 'Hola',
        webview_base_url: 'https://order.example'
      }
    })
    expect(chatbotMessagePayload(saved, {
      welcomeMessage: 'Hola',
      fallbackSupportMessage: 'Ayuda',
      webviewBaseUrl: '',
      languageCode: 'en'
    })).toEqual({
      provider_settings: {
        fallback_support_message: 'Ayuda',
        webview_base_url: null
      }
    })
  })

  it('sends a changed language on a Business Login bot', () => {
    const saved = readBotConnection({
      provider_settings: { auth_type: 'business_login', language_code: 'en' }
    })
    expect(chatbotMessagePayload(saved, { languageCode: 'es' })).toEqual({
      provider_settings: { language_code: 'es' }
    })
  })
})
