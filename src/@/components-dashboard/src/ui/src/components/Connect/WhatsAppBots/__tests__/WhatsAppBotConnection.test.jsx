import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ToastProvider } from '../../../../../../contexts/ToastContext'
import { Toast } from '../../../../styles/Toast'
import { WhatsAppBotConnection } from '../WhatsAppBotConnection'

const SESSION_TOKEN = 'session-secret-token'

const manualConnection = {
  authType: 'manual',
  configured: true,
  misconfiguredReason: null,
  phoneNumberId: '10987654321',
  countryCode: '1',
  phoneNumber: '5551234567',
  wabaId: '2233445566',
  hasAccessToken: true,
  hasPin: false,
  pinDownloaded: false,
  registrationStatus: null,
  connectedAt: null
}

const businessConnection = {
  ...manualConnection,
  authType: 'business_login',
  hasPin: true,
  pinDownloaded: true,
  registrationStatus: 'CONNECTED',
  connectedAt: '2026-10-01 09:00:00'
}

const notConnected = {
  ...manualConnection,
  authType: 'business_login',
  configured: false,
  phoneNumberId: '',
  countryCode: '',
  phoneNumber: '',
  wabaId: '',
  hasAccessToken: false
}

const handlers = () => ({
  connectWithMeta: vi.fn(),
  saveManualCredentials: vi.fn(),
  savePin: vi.fn(),
  downloadPin: vi.fn(),
  verifyRegistration: vi.fn(),
  runDoctor: vi.fn(),
  disconnect: vi.fn(),
  reconnectAnother: vi.fn(),
  reloadConnection: vi.fn()
})

const renderConnection = (connection, actions = handlers()) => {
  renderWithProviders(
    <WhatsAppBotConnection
      connectionState={{ loading: false, error: null, connection, pending: null, notice: null }}
      {...actions}
    />
  )
  return actions
}

describe('WhatsApp bot connection', () => {
  afterEach(() => {
    document.getElementById('app-modals')?.remove()
    window.localStorage.clear()
  })

  it('masks the access token field and never shows a saved token', () => {
    renderConnection(manualConnection)

    const token = screen.getByLabelText('Access token')
    expect(token.getAttribute('type')).toBe('password')
    expect(token.value).toBe('•'.repeat(40))
    expect(token.getAttribute('placeholder')).toBeNull()
    expect(token.getAttribute('autocomplete')).toBe('new-password')
    expect(screen.queryByText('A token is saved. Leave the field empty to keep it.')).toBeNull()
    expect(screen.getByLabelText('WhatsApp Business Account ID').value).toBe('2233445566')
  })

  it('keeps the test link out of the panel and offers disconnect on the connection', () => {
    window.localStorage.setItem('token', SESSION_TOKEN)
    renderConnection(businessConnection)

    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy()
    expect(document.body.innerHTML).not.toContain(SESSION_TOKEN)
    expect(document.body.innerHTML).not.toContain('https://wa.me/')
  })

  it('asks before disconnecting a connected number', () => {
    const actions = renderConnection(businessConnection)

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(actions.disconnect).not.toHaveBeenCalled()

    const dialog = document.getElementById('app-modals')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }))
    expect(actions.disconnect).toHaveBeenCalledTimes(1)
  })

  it('hides disconnect on a connected manual number', () => {
    renderConnection(manualConnection)
    expect(screen.queryByRole('button', { name: 'Disconnect' })).toBeNull()
  })

  it('keeps Business Login selected when a diagnose reload returns the same method', () => {
    const { rerender } = renderWithProviders(
      <WhatsAppBotConnection
        connectionState={{ loading: false, error: null, connection: manualConnection, pending: null, notice: null }}
        {...handlers()}
      />
    )
    fireEvent.click(screen.getByRole('radio', { name: /WhatsApp Business Login/ }))
    expect(screen.getByRole('radio', { name: /WhatsApp Business Login/ })).toBeChecked()

    rerender(
      <WhatsAppBotConnection
        connectionState={{
          loading: false,
          error: null,
          connection: { ...manualConnection },
          pending: null,
          notice: { type: 'error', key: 'doctor', messages: ['Doctor is only available for business_login auth type'] }
        }}
        {...handlers()}
      />
    )

    expect(screen.getByRole('radio', { name: /WhatsApp Business Login/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Manual credentials/ })).not.toBeChecked()
  })

  it('leaves the Business Login fields empty when the saved method is manual', () => {
    renderConnection({
      ...manualConnection,
      languageCode: 'es',
      welcomeMessage: 'Hola',
      fallbackSupportMessage: 'Ayuda',
      webviewBaseUrl: 'https://order.example'
    })
    fireEvent.click(screen.getByRole('radio', { name: /WhatsApp Business Login/ }))

    expect(screen.getByRole('combobox', { name: 'Agent Default Language' }).value).toBe('es')
    expect(screen.getByLabelText('Phone number ID').value).toBe('')
    expect(screen.getByLabelText('Country code').value).toBe('')
    expect(screen.getByLabelText('Phone number').value).toBe('')
    expect(screen.queryByLabelText('Access token')).toBeNull()
    expect(screen.queryByLabelText('WhatsApp Business Account ID')).toBeNull()
    expect(screen.getByLabelText('Welcome message').value).toBe('')
    expect(screen.getByLabelText('Fallback support message').value).toBe('')
    expect(screen.getByLabelText('Ordering webview URL').value).toBe('')
    expect(screen.getByText('Connected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Diagnose' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Connect with WhatsApp Business' })).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: /Manual credentials/ }))
    expect(screen.getByRole('combobox', { name: 'Agent Default Language' }).value).toBe('es')
    expect(screen.getByLabelText('Welcome message').value).toBe('Hola')
    expect(screen.getByLabelText('Phone number ID').value).toBe('10987654321')
  })

  it('follows the saved method when the connection auth type changes', () => {
    const { rerender } = renderWithProviders(
      <WhatsAppBotConnection
        connectionState={{ loading: false, error: null, connection: manualConnection, pending: null, notice: null }}
        {...handlers()}
      />
    )
    expect(screen.getByRole('radio', { name: /Manual credentials/ })).toBeChecked()

    rerender(
      <WhatsAppBotConnection
        connectionState={{
          loading: false,
          error: null,
          connection: { ...manualConnection, authType: 'business_login' },
          pending: null,
          notice: null
        }}
        {...handlers()}
      />
    )

    expect(screen.getByRole('radio', { name: /WhatsApp Business Login/ })).toBeChecked()
  })

  it('shows the status, phone and masked PIN of a connected bot', () => {
    renderConnection(businessConnection)

    expect(screen.getByText('Connected')).toBeTruthy()
    expect(screen.getByText('recommended')).toBeTruthy()
    expect(screen.getByText('Having issues with your WhatsApp connection?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Diagnose' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Connect with WhatsApp Business' })).toBeNull()
    expect(screen.getByText('+1 555 123 4567')).toBeTruthy()
    expect(screen.queryByLabelText('WhatsApp Business Account ID')).toBeNull()
    expect(screen.queryByLabelText('Access token')).toBeNull()
    expect(screen.getByLabelText('Two-step verification PIN').textContent).toBe('••••••')
    expect(screen.getByRole('button', { name: 'Download PIN' })).toBeTruthy()
  })

  it('takes the PIN in a masked field and passes it to the Meta connection', () => {
    const actions = renderConnection(notConnected)

    expect(screen.getByText('Not connected')).toBeTruthy()
    const pin = screen.getByLabelText('Two-step verification PIN')
    expect(pin.getAttribute('type')).toBe('password')
    fireEvent.change(pin, { target: { value: '65a4321' } })
    expect(pin.value).toBe('654321')

    fireEvent.click(screen.getByRole('button', { name: 'Connect with WhatsApp Business' }))
    expect(actions.connectWithMeta).toHaveBeenCalledWith({ pin: '654321' })
  })

  it('warns before connecting without a PIN', () => {
    const actions = renderConnection(notConnected)

    fireEvent.click(screen.getByRole('button', { name: 'Connect with WhatsApp Business' }))
    expect(actions.connectWithMeta).not.toHaveBeenCalled()

    const dialog = document.getElementById('app-modals')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
    expect(actions.connectWithMeta).toHaveBeenCalledWith({ pin: '' })
  })

  it('offers disconnect next to a PIN error', () => {
    const broken = {
      ...businessConnection,
      configured: false,
      misconfiguredReason: 'invalid_pin',
      registrationStatus: null,
      hasPin: false
    }
    renderConnection(broken)
    expect(screen.getByRole('button', { name: 'Diagnose' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy()
  })

  it('shows a doctor error in a toast instead of a box in the panel', () => {
    renderWithProviders(
      <ToastProvider>
        <>
          <Toast />
          <WhatsAppBotConnection
            connectionState={{
              loading: false,
              error: null,
              connection: businessConnection,
              pending: null,
              notice: {
                type: 'error',
                key: 'doctor',
                messages: ['Doctor is only available for business_login auth type']
              }
            }}
            {...handlers()}
          />
        </>
      </ToastProvider>
    )

    const toast = document.querySelector('.toast-bar')
    expect(toast.textContent).toContain('The connection could not be repaired.')
    expect(toast.textContent).toContain('Doctor is only available for business_login auth type')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sends only the changed manual credentials', () => {
    const actions = renderConnection(manualConnection)

    fireEvent.change(screen.getByLabelText('Access token'), { target: { value: 'EAAnew' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save credentials' }))

    expect(actions.saveManualCredentials).toHaveBeenCalledWith({ provider_settings: { access_token: 'EAAnew' } })
  })

  it('saves a language change on a Business Login bot', () => {
    const actions = renderConnection({ ...businessConnection, languageCode: 'es' })

    fireEvent.change(screen.getByRole('combobox', { name: 'Agent Default Language' }), { target: { value: 'fr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(actions.saveManualCredentials).toHaveBeenCalledWith({
      provider_settings: { language_code: 'fr' }
    })
  })

  it('shows the chatbot language, messages and webview URL on manual credentials', () => {
    const actions = renderConnection({
      ...manualConnection,
      languageCode: 'es',
      welcomeMessage: 'Hola',
      fallbackSupportMessage: '',
      webviewBaseUrl: 'https://order.example'
    })

    expect(screen.getByRole('combobox', { name: 'Agent Default Language' }).value).toBe('es')
    expect(screen.getByLabelText('Welcome message').value).toBe('Hola')
    expect(screen.getByLabelText('Fallback support message')).toBeTruthy()
    expect(screen.getByLabelText('Ordering webview URL').value).toBe('https://order.example')
    expect(screen.queryByRole('button', { name: 'Need another language? Contact us.' })).toBeNull()

    fireEvent.change(screen.getByLabelText('Fallback support message'), { target: { value: 'Te ayudamos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save credentials' }))
    expect(actions.saveManualCredentials).toHaveBeenCalledWith({
      provider_settings: { fallback_support_message: 'Te ayudamos' }
    })
  })
})
