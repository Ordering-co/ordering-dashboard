/* eslint-disable import/first */
// redesign settings C: the 8 custom blocks inside the Settings hub (SettingsHubFormContext provider).
// Every control has a bound label, the native selects are the C18 select, the reservation Yes/No is a switch, the checkboxes are
// the Product checkbox, the titles are h3 and the table cells are named «row — column». The values written are the legacy ones.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useConfig: () => [{
    configs: {
      format_time: { id: 91, key: 'format_time', value: '24' },
      dates_moment_format: { id: 92, key: 'dates_moment_format', value: 'MM-DD HH:mm' }
    }
  }]
}))

// The legacy select must not be drawn inside the hub.
vi.mock('../../SettingsSelectUI', () => ({
  SettingsSelectUI: () => <div data-testid='legacy-select' />
}))

import { SettingsHubFormContext } from '../../SettingsHubForm/SettingsHubFormContext'
import { SettingsCustomBlocks } from '../index'
import { getSettingsChangeName } from '../../../../../../utils/settingsCustomSections'

const dashboardTheme = createDashboardTheme(theme)
const HUB = { product: true, report: () => {} }
const yesNo = [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }]

// A controlled host: `handleInputChange(value, id)` updates the config like the real controller, and every call is recorded.
const Host = ({ initial, spy, fieldErrors, focus, hub = HUB }) => {
  const [configs, setConfigs] = useState(initial)
  const handleInputChange = (value, id) => {
    spy(value, id)
    setConfigs(current => current.map(config => (config.id === id ? { ...config, value } : config)))
  }
  return (
    <SettingsHubFormContext.Provider value={hub}>
      <div className='odc-hub-form'>
        <SettingsCustomBlocks
          configs={configs}
          handleInputChange={handleInputChange}
          focus={focus}
          fieldErrors={fieldErrors}
        />
      </div>
    </SettingsHubFormContext.Provider>
  )
}

const renderBlocks = ({ configs, fieldErrors, focus, hub } = {}) => {
  const spy = vi.fn()
  const view = renderWithProviders(
    <Host initial={configs} spy={spy} fieldErrors={fieldErrors} focus={focus} hub={hub} />,
    { theme: dashboardTheme }
  )
  return { ...view, spy }
}

const recaptchaConfigs = (overrides = {}) => [
  { id: 10, key: 'security_recaptcha_type', value: 'v2', name: 'Version' },
  { id: 11, key: 'security_recaptcha_site_key', value: 'v2-site', name: 'Site key', ...overrides.site },
  { id: 14, key: 'security_recaptcha_secret_key', value: '', name: 'Secret key', ...overrides.secret },
  { id: 13, key: 'security_recaptcha_auth', value: '0', name: 'Login', options: yesNo },
  ...(overrides.extra || [])
]

describe('SettingsCustomBlocks inside the hub', () => {
  it('draws block titles as h3 and keeps the focus anchors', () => {
    renderBlocks({
      focus: 'max_days_preorder',
      configs: [
        { id: 1, key: 'dates_general_format', value: 'YYYY-MM-DD HH:mm:ss' },
        { id: 30, key: 'preorder_status_enabled', value: '1' },
        { id: 31, key: 'max_days_preorder', value: '7', name: 'Default preorder window (days)' }
      ]
    })
    expect(screen.getByRole('heading', { level: 3, name: 'Date and time' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Preorder window' })).toBeInTheDocument()
    expect(document.getElementById('settings-focus-dates_general_format')).toBeTruthy()
    expect(document.getElementById('settings-focus-max_days_preorder')).toBeTruthy()
    expect(document.getElementById('settings-block-date_time')).toBeTruthy()
    expect(document.getElementById('settings-block-preorder_window')).toBeTruthy()
    expect(document.getElementById('settings-focus-max_days_preorder')).toHaveAttribute('data-focused')
    expect(document.getElementById('settings-focus-dates_general_format')).not.toHaveAttribute('data-focused')
  })

  describe('date and time', () => {
    const dateConfigs = (value = 'YYYY-MM-DD HH:mm:ss') => [{ id: 1, key: 'dates_general_format', value }]

    // redesign settings R-03
    it('a click on the preset label focuses the select', async () => {
      renderBlocks({ configs: dateConfigs() })
      await userEvent.click(screen.getByText('Date and time format', { selector: '.odc-field-label-text' }))
      expect(screen.getByRole('button', { name: /Date and time format/ })).toHaveFocus()
    })

    it('the preset is the C18 select named by its label, with no native select', async () => {
      const { spy, container } = renderBlocks({ configs: dateConfigs() })
      expect(container.querySelector('select')).toBeNull()
      expect(screen.queryByTestId('legacy-select')).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: /Date and time format/ }))
      await userEvent.click(screen.getByRole('option', { name: '09/14/2026 02:30 PM' }))
      expect(spy).toHaveBeenCalledWith('MM/DD/YYYY hh:mm A', 1)
      // the same three configs as before, with the ids of the project dictionary
      expect(spy).toHaveBeenCalledWith('12', 91)
      expect(spy).toHaveBeenCalledWith('MM/DD hh:mm A', 92)
      expect(spy).toHaveBeenCalledTimes(3)
    })

    // with no stored value the select marks what the dashboard paints (DD MMM YYYY), not the ISO preset
    it.each([['empty string', ''], ['null', null]])('selects the DD MMM YYYY preset, writing nothing, when the value is %s', (_name, value) => {
      const { spy } = renderBlocks({ configs: dateConfigs(value) })
      const trigger = screen.getByRole('button', { name: /Date and time format/ })
      expect(trigger).toHaveTextContent('14 Sep 2026 14:30')
      expect(trigger).not.toHaveTextContent('2026-09-14')
      expect(screen.queryByLabelText('Custom format')).toBeNull()
      expect(spy).not.toHaveBeenCalled()
    })

    it('with no value and a 12h project (format_time 12) shows the 12h variant of what is painted, writing nothing', () => {
      const { spy } = renderBlocks({
        configs: [...dateConfigs(''), { id: 91, key: 'format_time', value: '12' }]
      })
      expect(screen.getByLabelText('Custom format')).toHaveValue('DD MMM YYYY hh:mm A')
      expect(spy).not.toHaveBeenCalled()
    })

    it('an explicit ISO value stays ISO', () => {
      renderBlocks({ configs: dateConfigs('YYYY-MM-DD HH:mm:ss') })
      expect(screen.getByRole('button', { name: /Date and time format/ })).toHaveTextContent('2026-09-14 14:30:00')
    })

    it('lists the presets and Custom, and shows the custom field when the value is not a preset', () => {
      renderBlocks({ configs: dateConfigs('DD.MM.YY') })
      const custom = screen.getByLabelText('Custom format')
      expect(custom).toHaveValue('DD.MM.YY')
      expect(screen.getByRole('button', { name: /Date and time format/ })).toHaveTextContent('Custom')
    })

    it('typing a custom format writes the three configs', async () => {
      const { spy } = renderBlocks({ configs: dateConfigs('DD.MM.YY') })
      await userEvent.type(screen.getByLabelText('Custom format'), '!')
      expect(spy).toHaveBeenCalledWith('DD.MM.YY!', 1)
      expect(spy).toHaveBeenCalledWith(expect.any(String), 91)
      expect(spy).toHaveBeenCalledWith(expect.any(String), 92)
    })

    it('keeps the preview and the help', () => {
      renderBlocks({ configs: dateConfigs() })
      expect(screen.getByText('Scheduled order date')).toBeInTheDocument()
      expect(screen.getByText('When set, dashboard, invoices and scheduled orders use this format. Scheduled orders still hide the year.')).toBeInTheDocument()
    })
  })

  describe('reCAPTCHA', () => {
    it('the version is the C18 select and keeps the v3 -> v3_only mapping', async () => {
      const { spy, container } = renderBlocks({ configs: recaptchaConfigs() })
      expect(container.querySelector('select')).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: /Version/ }))
      await userEvent.click(screen.getByRole('option', { name: 'Version v3' }))
      expect(spy).toHaveBeenCalledWith('v3_only', 10)
    })

    it('keys are labelled fields and the secret is a P/SecretField: hidden, «Show», «Ends in»', async () => {
      renderBlocks({ configs: recaptchaConfigs({ secret: { value: 'real-secret-key-3Fz9' } }) })
      expect(screen.getByLabelText('Site key')).toHaveValue('v2-site')
      const secret = screen.getByLabelText('Secret key', { selector: 'input' })
      expect(secret).toHaveAttribute('type', 'password')
      expect(secret).toHaveAttribute('autocomplete', 'new-password')
      expect(screen.getByText(/Ends in/)).toHaveTextContent('Ends in …3Fz9')
      await userEvent.click(screen.getByRole('button', { name: 'Show Secret key' }))
      expect(secret).toHaveAttribute('type', 'text')
      expect(screen.getByRole('button', { name: 'Hide Secret key' })).toBeInTheDocument()
    })

    it('every secret key of every version is a SecretField, the site keys and the score are not', () => {
      renderBlocks({
        configs: [
          { id: 10, key: 'security_recaptcha_type', value: 'v3', name: 'Version' },
          { id: 11, key: 'security_recaptcha_site_key', value: 'a', name: 'Site key' },
          { id: 12, key: 'security_recaptcha_secret_key', value: 'b', name: 'Secret key' },
          { id: 13, key: 'security_recaptcha_secret_key_android', value: 'c', name: 'Android secret key' },
          { id: 14, key: 'security_recaptcha_secret_key_ios', value: 'd', name: 'iOS secret key' },
          { id: 15, key: 'security_recaptcha_secret_key_v3', value: 'e', name: 'Secret key' },
          { id: 16, key: 'security_recaptcha_site_key_v3', value: 'f', name: 'Site key' }
        ]
      })
      expect(screen.getAllByRole('button', { name: /^Show / })).toHaveLength(4)
      expect(screen.getAllByLabelText('Site key').every(input => input.getAttribute('type') === 'text')).toBe(true)
    })

    //
    describe('a key that arrives as «Add your …»', () => {
      const placeholderConfigs = () => recaptchaConfigs({
        site: { value: 'Add your Recaptcha Site Key' }
      })

      it('shows the text as a hint on an empty field, writing nothing', () => {
        const { spy } = renderBlocks({ configs: placeholderConfigs() })
        const site = screen.getByLabelText('Site key')
        expect(site).toHaveValue('')
        expect(site).toHaveAttribute('placeholder', 'Add your Recaptcha Site Key')
        expect(spy).not.toHaveBeenCalled()
      })

      it('does not count as a site key: reCAPTCHA cannot be turned on', async () => {
        const { spy } = renderBlocks({ configs: recaptchaConfigs({ site: { value: 'Add your Recaptcha Site Key' }, secret: { value: 'real-secret' } }) })
        await userEvent.click(screen.getByRole('checkbox', { name: 'Login' }))
        expect(spy).not.toHaveBeenCalled()
        expect(screen.getByRole('checkbox', { name: 'Login' })).toHaveAttribute('aria-checked', 'false')
        expect(screen.getByText('Fill the required keys for the selected version before enabling reCAPTCHA.')).toBeInTheDocument()
      })

      it('a real key typed over the hint turns it on', async () => {
        const { spy } = renderBlocks({
          configs: recaptchaConfigs({ site: { value: 'Add your Recaptcha Site Key' }, secret: { value: 'real-secret' } })
        })
        await userEvent.type(screen.getByLabelText('Site key'), 'k')
        expect(spy).toHaveBeenLastCalledWith('k', 11)
        await userEvent.click(screen.getByRole('checkbox', { name: 'Login' }))
        expect(spy).toHaveBeenLastCalledWith('1', 13)
      })
    })

    it('a switch is a Product checkbox that cannot be turned on without its keys', async () => {
      const { spy } = renderBlocks({ configs: recaptchaConfigs() })
      const login = screen.getByRole('checkbox', { name: 'Login' })
      expect(login).toHaveAttribute('aria-checked', 'false')
      await userEvent.click(login)
      expect(spy).not.toHaveBeenCalled()
      expect(login).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByText('Fill the required keys for the selected version before enabling reCAPTCHA.')).toBeInTheDocument()
    })

    it('turns on once the keys are filled', async () => {
      const { spy } = renderBlocks({
        configs: [
          { id: 10, key: 'security_recaptcha_type', value: 'v2', name: 'Version' },
          { id: 11, key: 'security_recaptcha_site_key', value: 'v2-site', name: 'Site key' },
          { id: 14, key: 'security_recaptcha_secret_key', value: 'v2-secret', name: 'Secret key' },
          { id: 13, key: 'security_recaptcha_auth', value: '0', name: 'Login', options: yesNo }
        ]
      })
      await userEvent.click(screen.getByRole('checkbox', { name: 'Login' }))
      expect(spy).toHaveBeenCalledWith('1', 13)
      expect(screen.getByRole('checkbox', { name: 'Login' })).toHaveAttribute('aria-checked', 'true')
    })

    it('shows the message of a failed save under the version', () => {
      renderBlocks({
        configs: recaptchaConfigs(),
        fieldErrors: { security_recaptcha_type: 'Enter a score between 0 and 1.' }
      })
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a score between 0 and 1.')
    })

    it('the score is a number field', async () => {
      const { spy } = renderBlocks({
        configs: [
          { id: 10, key: 'security_recaptcha_type', value: 'v3_only', name: 'Version' },
          { id: 20, key: 'security_recaptcha_score_v3', value: '0.5', name: 'Score' }
        ]
      })
      const score = screen.getByRole('textbox', { name: 'Score threshold' })
      expect(score).toHaveAttribute('aria-roledescription', 'Number field')
      await userEvent.clear(score)
      await userEvent.type(score, '2')
      expect(spy).toHaveBeenLastCalledWith('2', 20)
    })
  })

  describe('driver location checks', () => {
    const locationConfigs = () => [
      { id: 50, key: 'location_validation_enabled_status_3', value: '1', options: yesNo },
      { id: 51, key: 'location_validation_distance_status_3', value: '100' },
      { id: 52, key: 'location_validation_validity_status_3', value: '5' }
    ]

    it('names every cell «row — column»', async () => {
      const { spy } = renderBlocks({ configs: locationConfigs() })
      const enable = screen.getByRole('checkbox', { name: 'Arrived at the store — Enable' })
      expect(enable).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('textbox', { name: 'Arrived at the store — Min distance (m)' })).toHaveValue('100')
      expect(screen.getByRole('textbox', { name: 'Arrived at the store — Max age (min)' })).toHaveValue('5')
      await userEvent.click(enable)
      expect(spy).toHaveBeenCalledWith('0', 50)
      expect(enable).toHaveAttribute('aria-checked', 'false')
    })

    it('writes the number of a cell', async () => {
      const { spy } = renderBlocks({ configs: locationConfigs() })
      const distance = screen.getByRole('textbox', { name: 'Arrived at the store — Min distance (m)' })
      await userEvent.clear(distance)
      await userEvent.type(distance, '250')
      expect(spy).toHaveBeenLastCalledWith('250', 51)
    })

    it('the table is named by the block title', () => {
      renderBlocks({ configs: locationConfigs() })
      expect(screen.getByRole('table', { name: 'Driver location checks' })).toBeInTheDocument()
    })
  })

  describe('preorder window', () => {
    const preorderConfigs = () => [
      { id: 30, key: 'preorder_status_enabled', value: '1' },
      { id: 31, key: 'max_days_preorder', value: '7', name: 'Default preorder window (days)' },
      { id: 32, key: 'preorder_maximum_days', value: 'delivery,7|pickup,3' }
    ]

    it('the default window is a labelled number field', async () => {
      const { spy } = renderBlocks({ configs: preorderConfigs() })
      const days = screen.getByRole('textbox', { name: 'Default preorder window (days)' })
      expect(days).toHaveValue('7')
      await userEvent.clear(days)
      await userEvent.type(days, '9')
      expect(spy).toHaveBeenLastCalledWith('9', 31)
    })

    it('shows the message of the field under it', () => {
      renderBlocks({
        configs: preorderConfigs(),
        fieldErrors: { max_days_preorder: 'Max preorder days must be bigger than zero' }
      })
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Max preorder days must be bigger than zero')
      expect(screen.getByRole('textbox', { name: 'Default preorder window (days)' })).toHaveAttribute('aria-invalid', 'true')
      expect(document.getElementById('settings-focus-max_days_preorder')).toContainElement(alert)
    })

    it('the per-type days keep the min rule and the name «type — column»', async () => {
      const { spy } = renderBlocks({ configs: preorderConfigs() })
      const delivery = screen.getByRole('textbox', { name: 'Delivery — Days' })
      expect(delivery).toHaveValue('7')
      expect(screen.getByRole('textbox', { name: 'Pickup — Days' })).toHaveValue('3')
      await userEvent.clear(delivery)
      await userEvent.type(delivery, '4')
      const last = spy.mock.calls.at(-1)
      expect(last[1]).toBe(32)
      expect(last[0]).toMatch(/^delivery,4\|pickup,3/)
    })
  })

  describe('OneSignal', () => {
    it('names the id and the key «app — column»; the key is a P/SecretField: hidden, «Show», «Ends in»', async () => {
      const { spy } = renderBlocks({
        configs: [
          { id: 60, key: 'onesignal_dashboardweb_id', value: 'abc' },
          { id: 61, key: 'onesignal_dashboardweb_rest_api_key', value: 'os-secret-key-77Qx' }
        ]
      })
      expect(screen.getByLabelText('Dashboard — App ID')).toHaveValue('abc')
      const key = screen.getByLabelText('Dashboard — REST API key', { selector: 'input' })
      expect(key).toHaveAttribute('type', 'password')
      expect(key).toHaveAttribute('autocomplete', 'new-password')
      expect(screen.getByText(/Ends in/)).toHaveTextContent('Ends in …77Qx')
      await userEvent.click(screen.getByRole('button', { name: 'Show Dashboard — REST API key' }))
      expect(key).toHaveAttribute('type', 'text')
      expect(screen.getByRole('button', { name: 'Hide Dashboard — REST API key' })).toBeInTheDocument()
      // the app id is a plain field: no Show button for it
      expect(screen.getAllByRole('button', { name: /^(Show|Hide) / })).toHaveLength(1)
      await userEvent.type(screen.getByLabelText('Dashboard — App ID'), 'd')
      expect(spy).toHaveBeenLastCalledWith('abcd', 60)
      await userEvent.type(key, '!')
      expect(spy).toHaveBeenLastCalledWith('os-secret-key-77Qx!', 61)
    })

    it('an «Add your …» key is a hint on an empty field, writing nothing', () => {
      const { spy } = renderBlocks({
        configs: [{ id: 61, key: 'onesignal_dashboardweb_rest_api_key', value: 'Add your OneSignal REST API key' }]
      })
      const key = screen.getByLabelText('Dashboard — REST API key', { selector: 'input' })
      expect(key).toHaveValue('')
      expect(key).toHaveAttribute('placeholder', 'Add your OneSignal REST API key')
      expect(spy).not.toHaveBeenCalled()
    })

    // review of batch S: at 390 the input shrank to 27px behind «Show»; the secret cell keeps a minimum and the table scrolls
    it('puts the key in a secret cell with a minimum width', () => {
      renderBlocks({ configs: [{ id: 61, key: 'onesignal_dashboardweb_rest_api_key', value: 'os-secret-key-77Qx' }] })
      const key = screen.getByLabelText('Dashboard — REST API key', { selector: 'input' })
      expect(key.closest('td')).toHaveClass('odc-hub-secret-cell')
      const css = readFileSync(resolve(__dirname, '../../SettingsHubForm/settings-hub-form.css'), 'utf8')
      expect(css).toMatch(/\.odc-hub-table \.odc-hub-secret-cell \{ min-inline-size: calc\(var\(--od-x-control-height-lg\) \* 6\); \}/)
    })
  })

  describe('order alerts', () => {
    const alertConfigs = (inApp = '1') => [
      { id: 21, key: 'notification_in_app_enabled', value: inApp, name: 'Show an in-app order alert', options: yesNo },
      {
        id: 22,
        key: 'notification_in_app_position',
        value: 'right',
        name: 'In-app alert position',
        options: [{ text: 'right', value: 'right' }, { text: 'left', value: 'left' }]
      },
      { id: 23, key: 'notification_toast', value: '0', name: 'Show a toast when a new order arrives', options: yesNo }
    ]

    it('the toggles are Product checkboxes and the position is the C18 select', async () => {
      const { spy, container } = renderBlocks({ configs: alertConfigs() })
      expect(screen.queryByTestId('legacy-select')).toBeNull()
      expect(container.querySelector('select')).toBeNull()
      const toast = screen.getByRole('checkbox', { name: 'Show a toast when a new order arrives' })
      expect(toast).toHaveAttribute('aria-checked', 'false')
      await userEvent.click(toast)
      expect(spy).toHaveBeenCalledWith('1', 23)
      expect(toast).toHaveAttribute('aria-checked', 'true')

      await userEvent.click(screen.getByRole('button', { name: /In-app alert position/ }))
      await userEvent.click(screen.getByRole('option', { name: 'Left' }))
      expect(spy).toHaveBeenCalledWith('left', 22)
    })

    it('hides the position when the in-app master is off', async () => {
      renderBlocks({ configs: alertConfigs('1') })
      await userEvent.click(screen.getByRole('checkbox', { name: 'Show an in-app order alert' }))
      expect(screen.queryByRole('button', { name: /In-app alert position/ })).toBeNull()
    })
  })

  describe('multi-checkout', () => {
    const KEY = 'multi_business_checkout_delivery_fee_discount_percentage_cart_1'
    const multiConfigs = () => [
      { id: 40, key: 'checkout_multi_business_enabled', value: '1' },
      { id: 41, key: KEY, value: '10' }
    ]

    it('names the percentage «cart — column»', async () => {
      const { spy } = renderBlocks({ configs: multiConfigs() })
      const cart = screen.getByRole('textbox', { name: 'Cart 1 — Discount %' })
      expect(cart).toHaveValue('10')
      await userEvent.clear(cart)
      await userEvent.type(cart, '25')
      expect(spy).toHaveBeenLastCalledWith('25', 41)
    })

    it('keeps the 0-100 range: a value over 100 does not stay after the field is left', async () => {
      const { spy } = renderBlocks({ configs: multiConfigs() })
      const cart = screen.getByRole('textbox', { name: 'Cart 1 — Discount %' })
      await userEvent.clear(cart)
      await userEvent.type(cart, '150')
      fireEvent.blur(cart)
      await waitFor(() => expect(spy).toHaveBeenLastCalledWith('100', 41))
    })
  })

  describe('reservation', () => {
    const raw = '{"min_guests_reservation":1,"max_guests_reservation":4,"allow_preorder_reservation":true}'
    const reservationConfigs = () => [{ id: 80, key: 'reservation_setting', name: 'Reservation Setting', value: raw }]

    it('Yes/No is a switch that writes the same boolean inside the same JSON', async () => {
      const { spy, container } = renderBlocks({ configs: reservationConfigs() })
      expect(container.querySelector('select')).toBeNull()
      const toggle = screen.getByRole('switch', { name: 'Allow food preorder when booking — Value' })
      expect(toggle).toHaveAttribute('aria-checked', 'true')
      await userEvent.click(toggle)
      expect(spy).toHaveBeenCalledTimes(1)
      const [json, id] = spy.mock.calls[0]
      expect(id).toBe(80)
      expect(JSON.parse(json)).toEqual({ min_guests_reservation: 1, max_guests_reservation: 4, allow_preorder_reservation: false })
      expect(toggle).toHaveAttribute('aria-checked', 'false')
    })

    it('a number cell is named «row — column» and rewrites the one JSON string', async () => {
      const { spy } = renderBlocks({ configs: reservationConfigs() })
      const min = screen.getByRole('textbox', { name: 'Minimum guests — Value' })
      expect(min).toHaveValue('1')
      await userEvent.clear(min)
      await userEvent.type(min, '3')
      const [json, id] = spy.mock.calls.at(-1)
      expect(id).toBe(80)
      expect(JSON.parse(json).min_guests_reservation).toBe(3)
    })

    // the rules of the table are shown under it, with the message the form gave
    it('shows what the form says is wrong under the table', () => {
      renderBlocks({
        configs: reservationConfigs(),
        fieldErrors: { reservation_setting: 'Minimum guests cannot be greater than Maximum guests.' }
      })
      expect(screen.getByRole('alert')).toHaveTextContent('Minimum guests cannot be greater than Maximum guests.')
    })

    it('has the column headers and keeps the focus anchor', () => {
      renderBlocks({ configs: reservationConfigs(), focus: 'reservation_setting' })
      const table = screen.getByRole('table', { name: 'Reservation setting' })
      expect(within(table).getByRole('columnheader', { name: 'Setting' })).toBeInTheDocument()
      expect(within(table).getByRole('columnheader', { name: 'Value' })).toBeInTheDocument()
      expect(document.getElementById('settings-focus-reservation_setting')).toHaveAttribute('data-focused')
    })
  })

  // the save bar calls a config what the block calls its control
  describe('names for the save bar', () => {
    it('location checks, multi-checkout and OneSignal cells: the bar name is the control name', () => {
      const configs = [
        { id: 50, key: 'location_validation_enabled_status_3', name: 'Location Validation Status 3', value: '1', options: yesNo },
        { id: 51, key: 'location_validation_distance_status_9', name: 'Min Distance Status 9 (meters)', value: '100' },
        { id: 52, key: 'location_validation_validity_status_11', name: 'Max age 11', value: '5' },
        { id: 41, key: 'multi_business_checkout_delivery_fee_discount_percentage_cart_after_5', name: 'Cart after 5', value: '10' },
        { id: 60, key: 'onesignal_orderingapp_id', name: 'Enter Ordering OneSignal ID', value: 'abc' },
        { id: 61, key: 'onesignal_orderingapp_rest_api_key', name: 'Ordering key', value: 'secret' }
      ]
      renderBlocks({ configs })
      configs.forEach(config => {
        const barName = getSettingsChangeName(config, (_key, fallback) => fallback)
        expect(barName).not.toBe(config.name)
        expect(screen.getByLabelText(barName)).toBeInTheDocument()
      })
    })

    it('the reservation config is the table the block titles «Reservation setting»', () => {
      const config = { id: 80, key: 'reservation_setting', name: 'Reservation Setting', value: '{}' }
      renderBlocks({ configs: [config] })
      const barName = getSettingsChangeName(config, (_key, fallback) => fallback)
      expect(barName).toBe('Reservation setting')
      expect(screen.getByRole('table', { name: barName })).toBeInTheDocument()
    })
  })

  it('without the provider it renders as before and ignores fieldErrors', () => {
    const spy = vi.fn()
    const { container } = renderWithProviders(
      <SettingsCustomBlocks
        configs={[
          { id: 30, key: 'preorder_status_enabled', value: '1' },
          { id: 31, key: 'max_days_preorder', value: '7', name: 'Default preorder window (days)' }
        ]}
        handleInputChange={spy}
        fieldErrors={{ max_days_preorder: 'Max preorder days must be bigger than zero' }}
      />,
      { theme: dashboardTheme }
    )
    expect(container.querySelector('.odc-hub-row')).toBeNull()
    expect(container.querySelector('input[type="number"]')).toBeTruthy()
    expect(screen.queryByText('Max preorder days must be bigger than zero')).toBeNull()
  })
})
