/* eslint-disable import/first */
// (security): the per-site configs painted every credential as clear text; the checkout-fields panel had
// 20 unnamed switches and a panel called only «Settings». The two screens save at once, as in main: nothing here changes that.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const translate = (_key, fallback) => fallback

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, translate],
  CheckoutFieldsSetting: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../Shared', () => ({
  NotFoundSource: ({ content }) => <p>{content}</p>,
  Alert: () => null,
  SideBar: ({ open, children }) => open ? <aside>{children}</aside> : null
}))

vi.mock('../SettingsSelectUI', () => ({ SettingsSelectUI: ({ config }) => <div data-testid='select'>{config?.name}</div> }))

import { SiteSettingDetails } from '../SiteSettingDetails'
import { CheckoutFieldsSetting } from '../CheckoutFieldsSetting'

const SECRET = 'mock_01_xxxxxxxxxxxxxxxxxxxxxxwxyz'

const siteConfigs = () => [
  { id: 1, key: 'google_maps_api_key', name: 'Google Maps API Key', type: 1, value: 'mock_site_setting_01' },
  { id: 2, key: 'apple_login_private_key', name: 'Apple Private Key', type: 1, value: SECRET },
  { id: 3, key: 'intercom_api_key', name: 'Intercom API Key', type: 1, value: 'mock_site_setting_02' },
  { id: 4, key: 'onesignal_user_auth', name: 'OneSignal User Authentication Key', type: 1, value: 'mock_site_setting_03' },
  { id: 5, key: 'some_site_password', name: 'Site Secret Token', type: 7, value: 'mock_site_setting_04' },
  { id: 6, key: 'site_mode', name: 'Site mode', type: 2, value: '1', options: [] }
]

const renderSite = ({ flat = true, handleChangeConfig = vi.fn() } = {}) => {
  const configs = siteConfigs()
  renderWithProviders(
    <SiteSettingDetails
      selectedSiteId={34}
      siteConfigsState={{ loading: false, configs, error: null }}
      siteGroupConfigsState={{ loading: false, categories: flat ? [] : [{ name: 'Keys', description: '', configs }] }}
      handleChangeConfig={handleChangeConfig}
    />
  )
  return { handleChangeConfig }
}

const inputOf = (showButton) => document.getElementById(showButton.getAttribute('aria-controls'))

describe.each([['the flat list', true], ['the grouped categories', false]])('SiteSettingDetails, %s', (_name, flat) => {
  it('paints every credential as a hidden SecretField with Show, and leaves a public key as visible text', async () => {
    renderSite({ flat })

    for (const name of ['Apple Private Key', 'Intercom API Key', 'OneSignal User Authentication Key', 'Site Secret Token']) {
      const show = screen.getByRole('button', { name: `Show ${name}` })
      expect(inputOf(show)).toHaveAttribute('type', 'password')
    }
    // a credential is never in a text input while it is hidden; the page only prints its last four characters
    expect(screen.getAllByDisplayValue(SECRET).map(input => input.type)).toEqual(['password'])
    expect(screen.getByText('…wxyz')).toBeInTheDocument()

    // the Google Maps key is public: it stays a visible text input
    expect(screen.getByRole('textbox', { name: 'Google Maps API Key' })).toHaveValue('mock_site_setting_01')
    expect(screen.queryByRole('button', { name: 'Show Google Maps API Key' })).toBeNull()

    const show = screen.getByRole('button', { name: 'Show Apple Private Key' })
    await userEvent.click(show)
    expect(inputOf(screen.getByRole('button', { name: 'Hide Apple Private Key' }))).toHaveValue(SECRET)
  })

  it('saves the same value for the same site and config, secret or not', async () => {
    const { handleChangeConfig } = renderSite({ flat })

    await userEvent.type(inputOf(screen.getByRole('button', { name: 'Show Apple Private Key' })), 'Z')
    expect(handleChangeConfig).toHaveBeenLastCalledWith(`${SECRET}Z`, 34, 2)

    await userEvent.type(screen.getByRole('textbox', { name: 'Google Maps API Key' }), '!')
    expect(handleChangeConfig).toHaveBeenLastCalledWith('mock_site_setting_01!', 34, 1)

    await userEvent.type(inputOf(screen.getByRole('button', { name: 'Show Site Secret Token' })), '?')
    expect(handleChangeConfig).toHaveBeenLastCalledWith('mock_site_setting_04?', 34, 5)
  })
})

const fields = [
  { id: 1, site_id: 7, validation_field_id: 11, required: true, enabled: true, validation_field: { code: 'email', name: 'Email' } },
  { id: 2, site_id: 7, validation_field_id: 12, required: false, enabled: false, validation_field: { code: 'name', name: 'Name' } },
  { id: 3, site_id: 7, validation_field_id: 13, required: false, enabled: true, validation_field: { code: 'address', name: 'Address' } },
  { id: 4, site_id: 8, validation_field_id: 11, required: false, enabled: false, validation_field: { code: 'email', name: 'Email' } }
]

const renderCheckout = (handleChangeCheckoutFieldSetting = vi.fn()) => {
  renderWithProviders(
    <CheckoutFieldsSetting
      checkoutFieldsState={{ fields }}
      handleChangeCheckoutFieldSetting={handleChangeCheckoutFieldSetting}
      sitesState={{ loading: false, sites: [{ id: 7, code: 'web_dashboard_x' }, { id: 8, code: 'app_driver_x' }] }}
      selectedSiteId={7}
      setSelectedSiteId={vi.fn()}
      actionState={{ loading: false, error: null }}
      avoidExpand
    />
  )
  return { handleChangeCheckoutFieldSetting }
}

describe('CheckoutFieldsSetting panel of a channel', () => {
  it('is titled with the channel it belongs to', () => {
    renderCheckout()
    expect(screen.getByRole('heading', { level: 1, name: 'Settings for Dashboard' })).toBeInTheDocument()
  })

  it('names every Required and Status switch with its column and its field', () => {
    renderCheckout()
    const panel = within(screen.getByRole('complementary'))
    for (const field of ['Email', 'Name', 'Address']) {
      expect(panel.getByRole('switch', { name: `Required: ${field}` })).toBeInTheDocument()
      expect(panel.getByRole('switch', { name: `Status: ${field}` })).toBeInTheDocument()
    }
    // only the switches of the open channel: three fields, two columns
    expect(panel.getAllByRole('switch')).toHaveLength(6)
    expect(panel.getByRole('switch', { name: 'Required: Email' })).toBeDisabled()
  })

  it('still saves each switch at once, with the same change', async () => {
    const { handleChangeCheckoutFieldSetting } = renderCheckout()
    const panel = within(screen.getByRole('complementary'))

    await userEvent.click(panel.getByRole('switch', { name: 'Required: Name' }))
    expect(handleChangeCheckoutFieldSetting).toHaveBeenLastCalledWith(12, 7, { required: true })

    await userEvent.click(panel.getByRole('switch', { name: 'Status: Address' }))
    expect(handleChangeCheckoutFieldSetting).toHaveBeenLastCalledWith(13, 7, { enabled: false })
    expect(handleChangeCheckoutFieldSetting).toHaveBeenCalledTimes(2)
  })
})
