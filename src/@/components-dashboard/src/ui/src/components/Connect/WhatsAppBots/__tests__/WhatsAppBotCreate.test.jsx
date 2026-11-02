import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { WhatsAppBotCreate } from '../WhatsAppBotCreate'

const brandsState = {
  loading: false,
  loaded: true,
  error: null,
  brands: [{ id: 67, name: 'Pizza Hat' }]
}

const renderCreate = (createBot, extra = {}) => renderWithProviders(
  <WhatsAppBotCreate
    open
    brandsState={brandsState}
    createState={{ saving: false, error: null }}
    loadBrands={vi.fn()}
    createBot={createBot}
    onClose={vi.fn()}
    {...extra}
  />
)

const choose = (name, value) => {
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
}

describe('WhatsApp bot create form', () => {
  it('starts with nothing chosen and no other provider', () => {
    const { container } = renderCreate(vi.fn())
    const values = [...container.querySelectorAll('option')].map(option => option.value)

    expect(screen.getByRole('button', { name: 'Brand' })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Branch selection' })).toHaveValue('auto')
    expect(screen.getByText('The agent picks the closest open branch that serves the address.')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Agent Default Language' })).toHaveValue('')
    expect(screen.queryByRole('radio', { name: /WhatsApp Business Login/ })).toBeNull()
    expect(screen.queryByRole('radio', { name: /Manual credentials/ })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'WhatsApp Bot channel settings' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Enable Agent' })).not.toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Primary color' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Secondary color' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(values).toEqual(expect.arrayContaining(['', 'auto', 'marketplace']))
    expect(values).not.toEqual(expect.arrayContaining(['67', 'finitless', 'whatsapp', 'voice', 'chat', 'web']))
    expect(screen.queryByLabelText(/provider/i)).toBeNull()
    expect(document.getElementById('whatsapp_bot_create')).toBeTruthy()
  })

  it('sends manual credentials only after the user fills them', async () => {
    const createBot = vi.fn().mockResolvedValue(90)
    renderCreate(createBot)

    fireEvent.click(screen.getByRole('button', { name: 'Brand' }))
    fireEvent.click(screen.getByRole('option', { name: 'Pizza Hat' }))
    choose('Branch selection', 'auto')
    choose('Agent Default Language', 'en')
    fireEvent.click(screen.getByRole('radio', { name: /Manual credentials/ }))
    expect(screen.getByText(/Changing the authentication method/)).toBeTruthy()
    expect(screen.queryByLabelText('Ordering webview URL')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Primary color' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Phone number ID'), { target: { value: '1077' } })
    fireEvent.change(screen.getByLabelText('Country code'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '5551234567' } })
    fireEvent.change(screen.getByLabelText('Access token'), { target: { value: 'token-1' } })
    fireEvent.change(screen.getByLabelText('WhatsApp Business Account ID'), { target: { value: 'waba-1' } })
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(createBot).toHaveBeenCalledWith(expect.objectContaining({
      franchiseId: '67',
      languageCode: 'en',
      enabled: false,
      branchSelectionMode: 'auto',
      authType: 'manual',
      phoneNumberId: '1077',
      countryCode: '1',
      phoneNumber: '5551234567',
      accessToken: 'token-1',
      wabaId: 'waba-1'
    }))
    expect(createBot.mock.calls[0][0].provider).toBeUndefined()
    expect(createBot.mock.calls[0][0].provider_type).toBeUndefined()
  })

  it('creates a Business Login bot from the connect button and starts the Meta flow', async () => {
    const createBot = vi.fn().mockResolvedValue(90)
    const onCreated = vi.fn()
    const onClose = vi.fn()
    renderCreate(createBot, { onCreated, onClose })

    fireEvent.click(screen.getByRole('button', { name: 'Brand' }))
    fireEvent.click(screen.getByRole('option', { name: 'Pizza Hat' }))
    expect(screen.queryByRole('radio', { name: /WhatsApp Business Login/ })).toBeNull()
    choose('Branch selection', 'marketplace')
    choose('Agent Default Language', 'es')
    fireEvent.click(screen.getByRole('radio', { name: /WhatsApp Business Login/ }))
    expect(screen.queryByLabelText('Ordering webview URL')).toBeNull()
    const connect = screen.getByRole('button', { name: 'Connect with WhatsApp Business' })
    expect(connect).toBeEnabled()
    expect(screen.queryByText(/Six digits/)).toBeNull()
    expect(screen.getByText('Not connected')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Help for Two-step verification PIN' }))
    expect(await screen.findByText(/Six digits/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Two-step verification PIN'), { target: { value: '123456' } })
    fireEvent.click(connect)

    await waitFor(() => expect(createBot).toHaveBeenCalledWith(expect.objectContaining({
      authType: 'business_login',
      languageCode: 'es',
      branchSelectionMode: 'marketplace',
      pin: '123456',
      accessToken: '',
      wabaId: ''
    })))
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ authType: 'business_login', pin: '123456' }), 90)
    expect(onClose).toHaveBeenCalled()
  })

  it('asks before connecting a new bot without a PIN', async () => {
    const createBot = vi.fn().mockResolvedValue(90)
    renderCreate(createBot)

    fireEvent.click(screen.getByRole('button', { name: 'Brand' }))
    fireEvent.click(screen.getByRole('option', { name: 'Pizza Hat' }))
    choose('Branch selection', 'auto')
    choose('Agent Default Language', 'en')
    fireEvent.click(screen.getByRole('radio', { name: /WhatsApp Business Login/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Connect with WhatsApp Business' }))

    expect(createBot).not.toHaveBeenCalled()
    const dialog = document.getElementById('app-modals')
    expect(dialog.textContent).toMatch(/No PIN entered/)
    expect(dialog.textContent).toMatch(/generated automatically/)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change PIN' }))
    expect(createBot).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Connect with WhatsApp Business' }))
    fireEvent.click(within(document.getElementById('app-modals')).getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(createBot).toHaveBeenCalledWith(expect.objectContaining({
      authType: 'business_login',
      pin: ''
    })))
  })
})
