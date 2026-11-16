/* eslint-disable import/first */
// redesign settings B: SettingsList inside the Settings hub (SettingsHubFormContext provider). The real controller
// drives the real UI; only the API call (`saveConfigRequest`), the contexts and a few heavy leaves are replaced.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const mocks = vi.hoisted(() => ({
  projectConfigs: {},
  refreshConfigs: vi.fn(),
  showToast: vi.fn(),
  // The API: `ordering.setAccessToken(token).configs(id).save(params)` answers `{ content: { error, result } }`.
  save: null
}))

const translate = (key, fallback) => fallback ?? key

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, translate],
  useConfig: () => [{ configs: mocks.projectConfigs }, { refreshConfigs: mocks.refreshConfigs }],
  SettingsList: () => null
}))

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ loading: false, token: 'token' }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{
    setAccessToken: () => ({
      configs: (id) => ({ save: async (params) => ({ content: await mocks.save(id, params) }) })
    })
  }]
}))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, translate] }))
vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.projectConfigs }, { refreshConfigs: mocks.refreshConfigs }]
}))

vi.mock('../../../Shared', () => ({
  Alert: ({ content, open }) => open
    ? <div role='alert' data-testid='legacy-alert'>{(Array.isArray(content) ? content : [content]).filter(Boolean).join(' ')}</div>
    : null,
  ColorPicker: () => null,
  NotFoundSource: () => null
}))

vi.mock('../../../Shared/UI/ColorPicker', () => ({
  ColorPicker: ({ defaultColor, onChangeColor }) => (
    <button type='button' className='od-color-picker-trigger' onClick={() => onChangeColor('#112233')}>
      {defaultColor}
    </button>
  )
}))

vi.mock('../../SettingsSelectUI', () => ({
  SettingsSelectUI: ({ config }) => <div data-testid='legacy-select'>{config?.name || config?.key}</div>
}))

// The image control: «pick» hands a cropped image, «restore» asks for the default one. Inside the hub they go through `onPick` and
// `onRestore` (n.º 1, D-56 a); the direct `saveConfig` stays for a consumer that does not pass them.
vi.mock('../../SettingsImage', () => ({
  SettingsImage: ({ config, saveConfig, onPick, onRestore }) => (
    <>
      <button type='button' data-testid='settings-image' onClick={() => (onPick ? onPick('data:image/png;base64,AAAA') : saveConfig(config.id, { image: 'data:image/png;base64,AAAA' }))}>
        image {config.key}
      </button>
      <button type='button' data-testid='settings-image-restore' onClick={() => (onRestore ? onRestore() : saveConfig(config.id, { value: '' }))}>
        restore {config.key}
      </button>
    </>
  )
}))

// inside the hub the image is HubImageField (P/ImageField), with the same two callbacks
vi.mock('../HubImageField', () => ({
  HubImageField: ({ config, onPick, onRestore }) => (
    <>
      <button type='button' data-testid='settings-image' onClick={() => onPick('data:image/png;base64,AAAA')}>image {config.key}</button>
      <button type='button' data-testid='settings-image-restore' onClick={() => onRestore()}>restore {config.key}</button>
    </>
  )
}))

import { SettingsList as Controller } from '../../../../../../components/SettingsList'
import { SettingsHubFormContext } from '../../SettingsHubForm/SettingsHubFormContext'
import { SettingsListUI } from '../index'
import { SETTINGS_CONFIG_NAMES } from '../../../../../../utils/settingsConfigNames'
import { SECRET_TEXT_KEYS } from '../secretConfigKeys'
import { ONESIGNAL_APPS } from '../../../../../../utils/settingsCustomSections'

const dashboardTheme = createDashboardTheme(theme)
const originalMatchMedia = window.matchMedia

const yesNo = [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }]
const yesNoBool = [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }]

const deferred = () => {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, resolve: release }
}

const okSave = () => vi.fn(async (id, params) => ({ error: false, result: { id, value: params.value } }))

const Harness = ({ category, hub, focus, configOptionsToHide = [] }) => (
  <SettingsHubFormContext.Provider value={hub}>
    <Controller
      category={category}
      focus={focus}
      UIComponent={SettingsListUI}
      configOptionsToHide={configOptionsToHide}
      isRemoveGeneralTitle
    />
  </SettingsHubFormContext.Provider>
)

const renderList = ({ configs, key = 'cat', focus = '', saveConfigRequest = okSave(), report = vi.fn(), hub, configOptionsToHide } = {}) => {
  const category = { id: 1, key, configs }
  const hubValue = hub === undefined ? { product: true, report } : hub
  mocks.save = saveConfigRequest
  const view = renderWithProviders(
    <Harness category={category} hub={hubValue} focus={focus} configOptionsToHide={configOptionsToHide} />,
    { theme: dashboardTheme }
  )
  return {
    ...view,
    category,
    saveConfigRequest,
    report,
    rerenderWith: (props) => view.rerender(
      <Harness category={category} hub={hubValue} focus={focus} configOptionsToHide={configOptionsToHide} {...props} />
    )
  }
}

const switchOf = (name) => screen.getByRole('switch', { name })
const barOf = () => screen.queryByRole('group', { name: 'Save changes' })

const textConfig = (overrides = {}) => ({ id: 1, key: 'invoice_footer', name: 'Invoice footer', description: 'Printed under the total.', type: 1, value: 'Thanks', ...overrides })
const switchConfig = (overrides = {}) => ({ id: 2, key: 'allow_gift_notes', name: 'Allow gift notes', description: 'Customers may add a note.', type: 2, value: '1', options: yesNo, ...overrides })

beforeEach(() => {
  mocks.projectConfigs = {}
  mocks.refreshConfigs.mockClear()
  mocks.showToast.mockClear()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  window.matchMedia = originalMatchMedia
})

describe('SettingsListUI inside the hub: rows with their label and hint linked', () => {
  it('type 1 is a text field named by its label and described by its hint', () => {
    renderList({ configs: [textConfig()] })
    const input = screen.getByLabelText('Invoice footer')
    expect(input).toHaveValue('Thanks')
    expect(input).toHaveAccessibleDescription('Printed under the total.')
    expect(document.getElementById('settings-focus-invoice_footer')).toContainElement(input)
  })

  it('type 1 dashboard_buttons_colors is a color field', async () => {
    const view = renderList({ configs: [{ id: 3, key: 'dashboard_buttons_colors', name: 'Button color', type: 1, value: '#ffffff' }] })
    await userEvent.click(screen.getByRole('button', { name: /Button color/ }))
    await waitFor(() => expect(barOf()).toBeInTheDocument())
    expect(view.container.querySelector('.odc-color-field')).toBeTruthy()
  })

  it('type 2 Yes/No is a switch named by its label and described by its hint', () => {
    renderList({ configs: [switchConfig()] })
    const toggle = switchOf('Allow gift notes')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).toHaveAccessibleDescription('Customers may add a note.')
  })

  it('type 3 is a named group of controlled checkboxes', async () => {
    const config = { id: 4, key: 'payment_methods_shown', name: 'Methods shown', description: 'Pick the ones to show.', type: 3, value: 'cash|card', options: [{ text: 'cash', value: 'cash' }, { text: 'card', value: 'card' }, { text: 'bank_transfer', value: 'bank' }] }
    renderList({ configs: [config] })
    const group = screen.getByRole('group', { name: 'Methods shown' })
    expect(group).toHaveAccessibleDescription('Pick the ones to show.')
    expect(within(group).getByRole('checkbox', { name: 'cash' })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByRole('checkbox', { name: 'card' })).toHaveAttribute('aria-checked', 'true')
    const bank = within(group).getByRole('checkbox', { name: 'bank transfer' })
    expect(bank).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(bank)
    expect(bank).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('type 4 checkboxes read and write a JSON array of integers, in insertion order', async () => {
    const config = { id: 5, key: 'delivery_days', name: 'Delivery days', type: 4, value: '[1,3]', options: [{ text: 'Mon', value: '1' }, { text: 'Tue', value: '2' }, { text: 'Wed', value: '3' }] }
    const saveConfigRequest = okSave()
    renderList({ configs: [config], saveConfigRequest })
    const group = screen.getByRole('group', { name: 'Delivery days' })
    expect(within(group).getByRole('checkbox', { name: 'Mon' })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByRole('checkbox', { name: 'Tue' })).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(within(group).getByRole('checkbox', { name: 'Tue' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(5, { key: 'delivery_days', value: '[1,3,2]' }))
  })

  it('type 4 driver_tip_options is a text field with the value without brackets', () => {
    renderList({ configs: [{ id: 6, key: 'driver_tip_options', name: 'Tip options', type: 4, value: '[10,15,20]' }] })
    // the hub names it from the map, whatever the API calls it
    expect(screen.getByLabelText('Driver tip options')).toHaveValue('10,15,20')
  })

  it('type 6 is the compact table with a number field per row named «type — unit»', async () => {
    const config = { id: 7, key: 'preorder_minimum_days', name: 'Minimum preorder days', description: 'In advance.', type: 6, value: 'delivery,2|pickup,3' }
    const saveConfigRequest = okSave()
    renderList({ configs: [config], saveConfigRequest })
    // Base UI draws the number input as a text box with «Number field» as its role description
    const delivery = screen.getByRole('textbox', { name: 'Delivery — Days' })
    expect(delivery).toHaveValue('2')
    expect(delivery).toHaveAttribute('aria-roledescription', 'Number field')
    expect(screen.getByRole('textbox', { name: 'Pickup — Days' })).toHaveValue('3')
    // (decision 32 A): the dashboard's name of preorder_minimum_days
    expect(screen.getByRole('group', { name: 'Set minimum preorder days' })).toBeInTheDocument()

    await userEvent.clear(delivery)
    await userEvent.type(delivery, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledTimes(1))
    expect(saveConfigRequest.mock.calls[0][1].value).toMatch(/^delivery,5\|pickup,3/)
  })

  // apply-list row 43 (settings P-5, D-53 a): the secret is P/SecretField, hidden by default, with «Show» and its last 4 characters
  it('type 7 is a hidden secret with «Show», its ending and no password-manager autofill', async () => {
    renderList({ configs: [{ id: 8, key: 'smtp_secret', name: 'Secret key', description: 'Never shown again.', type: 7, value: 'mock_01_xxxxx6789' }] })
    const input = screen.getByLabelText('Secret key', { selector: 'input' })
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(input).toHaveAccessibleDescription(/Never shown again\./)
    expect(input).toHaveAccessibleDescription(/Ends in …6789/)
    await userEvent.click(screen.getByRole('button', { name: 'Show Secret key' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide Secret key' })).toBeInTheDocument()
  })

  it('type 7 still saves through the save bar', async () => {
    const saveConfigRequest = okSave()
    renderList({ configs: [{ id: 8, key: 'smtp_secret', name: 'Secret key', type: 7, value: 'mock_01_xxxxx6789' }], saveConfigRequest })
    const input = screen.getByLabelText('Secret key', { selector: 'input' })
    await userEvent.clear(input)
    await userEvent.type(input, 'sk_live_new')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(8, expect.objectContaining({ value: 'sk_live_new' })))
  })

  // (decision 37): the Stripe Test keys come as type 1 and were painted in clear text. They are P/SecretField too
  // (hidden, «Show», last four characters); what is saved is the same value through the same handler.
  describe.each([
    ['stripe_secret_sandbox', 'Stripe Test secret key', 'mock_02_xxxxxxxxxxxxxWXYZ', '…WXYZ', 'mock_03_xxxxxxxxxx4321', '1'],
    ['stripe_secret', 'Stripe Live secret key', 'mock_04_xxxxxxxxxxxxxLMNO', '…LMNO', 'mock_05_xxxxxxxxxx8765', '0']
  ])('Stripe secret key %s (type 1)', (key, name, value, ending, typed, sandbox) => {
    const stripeConfigs = () => [
      { id: 20, key: 'stripe_sandbox', name: 'Enable Stripe Testing Mode', type: 2, value: sandbox, options: yesNo },
      { id: 21, key, name, description: 'From the Stripe dashboard.', type: 1, value }
    ]

    it('is a hidden secret with «Show» and its last four characters', async () => {
      renderList({ configs: stripeConfigs(), key: 'stripe' })
      const input = screen.getByLabelText(name, { selector: 'input' })
      expect(input).toHaveAttribute('type', 'password')
      expect(input).toHaveAttribute('autocomplete', 'new-password')
      expect(input).toHaveValue(value)
      expect(input).toHaveAccessibleDescription(/From the Stripe dashboard\./)
      expect(input).toHaveAccessibleDescription(new RegExp(`Ends in ${ending}`))
      await userEvent.click(screen.getByRole('button', { name: `Show ${name}` }))
      expect(input).toHaveAttribute('type', 'text')
      expect(screen.getByRole('button', { name: `Hide ${name}` })).toBeInTheDocument()
    })

    it('saves the same value for the same config through the save bar', async () => {
      const saveConfigRequest = okSave()
      renderList({ configs: stripeConfigs(), key: 'stripe', saveConfigRequest })
      const input = screen.getByLabelText(name, { selector: 'input' })
      await userEvent.clear(input)
      await userEvent.type(input, typed)
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
      await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(21, expect.objectContaining({ value: typed })))
      expect(saveConfigRequest).toHaveBeenCalledTimes(1)
    })
  })

  // every type 1 credential of secretConfigKeys.js is a hidden secret; publishable and public values stay visible.
  // The OneSignal and reCAPTCHA secrets are drawn by their own blocks (SettingsCustomBlocks, already a password input), not by
  // this row; they stay in the list for any row that shows them.
  const BLOCK_SECRETS = [...ONESIGNAL_APPS.map(app => app.secretKey), 'security_recaptcha_secret_key', 'security_recaptcha_secret_key_v3']
  it.each(SECRET_TEXT_KEYS.filter(key => !BLOCK_SECRETS.includes(key)))('type 1 credential %s is a hidden secret with «Show» and its last four characters', (key) => {
    renderList({ configs: [{ id: 30, key, name: 'Credential', type: 1, value: 'abcdefghijklmnopWXYZ' }] })
    const input = screen.getByLabelText('Credential', { selector: 'input' })
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAccessibleDescription(/Ends in …WXYZ/)
    expect(screen.getByRole('button', { name: 'Show Credential' })).toBeInTheDocument()
  })

  it('the list holds the secrets of the test project, and no publishable or public value', () => {
    expect(SECRET_TEXT_KEYS).toEqual(expect.arrayContaining([
      'stripe_secret', 'stripe_secret_sandbox', 'email_smtp_password', 'twilio_auth_token', 'apple_login_private_key',
      'google_client_secret', 'stripe_terminal_webhook_secret', 'uber_direct_integration_client_secret',
      'yango_delivery_integration_api_token', 'llamafood_delivery_integration_api_key', 'pedidosya_integration_api_token',
      'rappi_cargo_integration_api_token'
    ]))
    expect(new Set(SECRET_TEXT_KEYS).size).toBe(SECRET_TEXT_KEYS.length)
    expect(SECRET_TEXT_KEYS.filter(key => /publishable|map_box_token|site_key|client_id|_id$|maps_api_key|vapid/.test(key))).toEqual([])
  })

  it.each([
    'stripe_publishable', 'stripe_publishable_sandbox', 'stripe_terminal_publishable_key_sandbox', 'map_box_token',
    'google_maps_api_key', 'firebase_web_api_key', 'cloudinary_key', 'stripe_connect_client_id_sandbox'
  ])('keeps the public value %s as a plain text field', (key) => {
    renderList({ configs: [{ id: 22, key, name: 'Public value', type: 1, value: 'mock_06_xxxxxxxxxxxxxQRST' }] })
    // redesign (owner decision 32 A): the hub names this key as settingsConfigNames.js does, whatever the API sends
    expect(screen.getByLabelText(SETTINGS_CONFIG_NAMES[key]?.label ?? 'Public value')).toHaveAttribute('type', 'text')
    expect(screen.queryByRole('button', { name: /^Show/ })).toBeNull()
  })

  // n.º 1, D-56 (a), settings P-6 (owner, 2026-10-20): the image no longer saves on its own; it is one more change of the bar
  describe('type 5 saves with the bar (n.º 1, D-56 a)', () => {
    const logo = (value = 'https://res.cloudinary.com/x/logo.png') => ({ id: 9, key: 'platform_store_logo_x', name: 'Logo', type: 5, value })

    it('a picked image is a pending change named by its field; Save uploads it with the same request as before', async () => {
      const saveConfigRequest = okSave()
      renderList({ configs: [logo()], saveConfigRequest })
      await userEvent.click(screen.getByTestId('settings-image'))
      expect(saveConfigRequest).not.toHaveBeenCalled()
      expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
      expect(barOf()).toHaveTextContent('Logo')
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
      await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(9, { image: 'data:image/png;base64,AAAA' }))
      expect(saveConfigRequest).toHaveBeenCalledTimes(1)
    })

    it('«Restore default» is a pending change too, saved as an empty value', async () => {
      const saveConfigRequest = okSave()
      renderList({ configs: [logo()], saveConfigRequest })
      await userEvent.click(screen.getByTestId('settings-image-restore'))
      expect(saveConfigRequest).not.toHaveBeenCalled()
      expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
      await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(9, { key: 'platform_store_logo_x', value: '' }))
    })

    it('Discard drops the picked image without a request', async () => {
      const saveConfigRequest = okSave()
      const { report } = renderList({ configs: [logo()], saveConfigRequest })
      await userEvent.click(screen.getByTestId('settings-image'))
      expect(report).toHaveBeenLastCalledWith('cat', { dirty: true, saving: false })
      await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
      await waitFor(() => expect(barOf()).toBeNull())
      expect(saveConfigRequest).not.toHaveBeenCalled()
    })
  })

  it('country_autocomplete keeps the country filter inside a labelled field', () => {
    renderList({ configs: [{ id: 10, key: 'country_autocomplete', name: 'Country', description: 'Default country.', type: 2, value: 'us', options: yesNo }] })
    expect(screen.getByLabelText('Country')).toBeInTheDocument()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('keeps the filter of keys of the platform fee fields', () => {
    renderList({ configs: [textConfig({ id: 11, key: 'platform_fee_fixed', name: 'Fixed fee', value: '2' })] })
    const input = screen.getByLabelText('Fixed platform fee') // (decision 32 A): the dashboard's name
    expect(fireEvent.keyDown(input, { key: 'a' })).toBe(false)
    expect(fireEvent.keyDown(input, { key: '5' })).toBe(true)
  })
})

describe('SettingsListUI inside the hub: switch only under the strict rule', () => {
  it.each([
    ['1/0', yesNo, '1', 'true', '0'],
    ['true/false', yesNoBool, 'true', 'true', 'false'],
    ['1/0 stored off', yesNo, '0', 'false', '1']
  ])('Yes/No %s is a switch that writes the option value', async (_label, options, value, checked, next) => {
    const saveConfigRequest = okSave()
    renderList({ configs: [switchConfig({ options, value })], saveConfigRequest })
    const toggle = switchOf('Allow gift notes')
    expect(toggle).toHaveAttribute('aria-checked', checked)

    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(2, { key: 'allow_gift_notes', value: next }))
  })

  it('finds «on» by the option text, not by position', async () => {
    const saveConfigRequest = okSave()
    renderList({ configs: [switchConfig({ options: [{ text: 'NO', value: '1' }, { text: 'YES', value: '0' }], value: '1' })], saveConfigRequest })
    const toggle = switchOf('Allow gift notes')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(2, { key: 'allow_gift_notes', value: '0' }))
  })

  it('terms_and_conditions is a switch with its fixed true/false values', async () => {
    const saveConfigRequest = okSave()
    renderList({
      configs: [switchConfig({ id: 12, key: 'terms_and_conditions', name: 'Terms and conditions', options: [{ text: 'X', value: 'x' }], value: 'false' })],
      saveConfigRequest
    })
    const toggle = switchOf('Agree to terms at signup') // (decision 32 A): the dashboard's name
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(12, { key: 'terms_and_conditions', value: 'true' }))
  })

  it.each([
    ['an inverted config', { key: 'business_signup_enabled_default' }],
    ['a customizable config', { customizable: true }],
    ['true/false texts', { options: [{ text: 'true', value: 'true' }, { text: 'false', value: 'false' }], value: 'true' }],
    ['disabled/enabled texts', { options: [{ text: 'disabled', value: '0' }, { text: 'enabled', value: '1' }], value: '1' }],
    ['km/mi', { options: [{ text: 'km', value: 'km' }, { text: 'mi', value: 'mi' }], value: 'km' }],
    ['three options', { options: [...yesNo, { text: 'MAYBE', value: '2' }] }],
    ['an unknown stored value', { value: 'weird' }]
  ])('%s is a dropdown with the same options, not a switch', async (_label, overrides) => {
    const config = switchConfig(overrides)
    renderList({ configs: [config] })
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByTestId('legacy-select')).toBeNull()
    // (decision 32 A): an inverted key is named as settingsConfigNames.js names it
    const trigger = screen.getByRole('button', { name: new RegExp(SETTINGS_CONFIG_NAMES[config.key]?.label ?? 'Allow gift notes') })
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')

    await userEvent.click(trigger)
    const options = screen.getAllByRole('option')
    const expected = (config.options || yesNo).length + (config.customizable ? 1 : 0)
    expect(options).toHaveLength(expected)
  })

  it('a dropdown writes the value of the chosen option', async () => {
    const saveConfigRequest = okSave()
    renderList({
      configs: [switchConfig({ key: 'distance_unit_x', name: 'Distance unit', options: [{ text: 'km', value: 'km' }, { text: 'mi', value: 'mi' }], value: 'km' })],
      saveConfigRequest
    })
    await userEvent.click(screen.getByRole('button', { name: /Distance unit/ }))
    await userEvent.click(screen.getByRole('option', { name: 'Mi' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(2, { key: 'distance_unit_x', value: 'mi' }))
  })

  it('an inverted config swaps the written values by position', async () => {
    const saveConfigRequest = okSave()
    renderList({
      configs: [switchConfig({ key: 'business_signup_enabled_default', name: 'Businesses start enabled', value: '1' })],
      saveConfigRequest
    })
    // stored '1' shows as «No» (the swap gave «No» the first option's value); «Yes» now carries '0'
    // (decision 32 A): the dashboard names business_signup_enabled_default «Business signup approval settings»
    expect(screen.getByRole('button', { name: /Business signup approval settings/ })).toHaveTextContent('No')
    await userEvent.click(screen.getByRole('button', { name: /Business signup approval settings/ }))
    await userEvent.click(screen.getByRole('option', { name: 'Yes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(2, { key: 'business_signup_enabled_default', value: '0' }))
  })

  it('drops an option the project hides and lists what is left in a dropdown', async () => {
    renderList({
      configs: [switchConfig({ key: 'upselling_enabled', name: 'Upselling' })],
      configOptionsToHide: [{ key: 'upselling_enabled', value: '1' }]
    })
    expect(screen.queryByRole('switch')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Upselling/ }))
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['No'])
  })
})

describe('SettingsListUI inside the hub: save bar', () => {
  it('shows nothing until the first visible change, then counts and names the fields', async () => {
    renderList({ configs: [textConfig(), switchConfig()] })
    expect(barOf()).toBeNull()

    await userEvent.click(switchOf('Allow gift notes'))
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(barOf()).getByText(/Allow gift notes/)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Invoice footer'), '!')
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
  })

  it('drops a change that goes back to the saved value', async () => {
    renderList({ configs: [switchConfig()] })
    await userEvent.click(switchOf('Allow gift notes'))
    expect(barOf()).toBeInTheDocument()
    await userEvent.click(switchOf('Allow gift notes'))
    expect(barOf()).toBeNull()
  })

  it('counts the date block as one field, not as its hidden companions', () => {
    // The block writes three configs for one visible field: the format and its two hidden companions.
    const dateConfig = { id: 90, key: 'dates_general_format', name: 'Date format', type: 1, value: 'MM/DD/YYYY hh:mm A' }
    const changes = [
      dateConfig,
      { id: 91, key: 'format_time', value: '12' },
      { id: 92, key: 'dates_moment_format', value: 'DD/MM hh:mm A' }
    ]
    renderWithProviders(
      <SettingsHubFormContext.Provider value={{ product: true, report: vi.fn() }}>
        <SettingsListUI
          category={{ key: 'cat' }}
          settingsState={{ loading: false, error: null, API: false, changes }}
          configs={[dateConfig]}
          formState={{ changes }}
          configOptionsToHide={[]}
          handleInputChange={vi.fn()}
        />
      </SettingsHubFormContext.Provider>,
      { theme: dashboardTheme }
    )
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(barOf()).getByText(/Date and time format|Date format/)).toBeInTheDocument()
  })

  // redesign settings B (ST-15): the date block calls `handleInputChange` three times in one event (format, format_time,
  // dates_moment_format) and the controller's `saveChanges` builds each update from the render's stale `formState`/`configs`, so
  // only the last call survived. Fixed in the controller with functional state updates.
  it('the date block keeps the chosen format (ST-15: controller with functional updates)', async () => {
    mocks.projectConfigs = {
      format_time: { id: 91, key: 'format_time', value: '24' },
      dates_moment_format: { id: 92, key: 'dates_moment_format', value: 'MM-DD HH:mm' }
    }
    renderList({ configs: [{ id: 90, key: 'dates_general_format', name: 'Date format', type: 1, value: 'YYYY-MM-DD HH:mm:ss' }] })
    // redesign settings C: inside the hub the presets are a C18 select (FirstSelect), no longer a native <select>
    await userEvent.click(screen.getByRole('button', { name: /Date and time format/ }))
    await userEvent.click(screen.getByRole('option', { name: '09/14/2026 02:30 PM' }))
    expect(screen.getByRole('button', { name: /Date and time format/ })).toHaveTextContent('09/14/2026 02:30 PM')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('does not count a change of a dependent hidden by its master', async () => {
    const configs = [
      { id: 20, key: 'facebook_login_enabled', name: 'Facebook login', type: 2, value: '1', options: yesNo },
      { id: 21, key: 'facebook_id', name: 'Facebook ID', type: 1, value: '' }
    ]
    renderList({ configs })
    await userEvent.type(screen.getByLabelText('Facebook ID'), 'abc')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    await userEvent.click(switchOf('Facebook login'))
    expect(screen.queryByLabelText('Facebook ID')).toBeNull()
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('Discard gives every value back: text, switch, checkboxes and dropdowns', async () => {
    const configs = [
      textConfig(),
      switchConfig(),
      { id: 4, key: 'payment_methods_shown', name: 'Methods shown', type: 3, value: 'cash', options: [{ text: 'cash', value: 'cash' }, { text: 'card', value: 'card' }] },
      { id: 5, key: 'delivery_days', name: 'Delivery days', type: 4, value: '[1]', options: [{ text: 'Mon', value: '1' }, { text: 'Tue', value: '2' }] },
      { id: 6, key: 'distance_unit_x', name: 'Distance unit', type: 2, value: 'km', options: [{ text: 'km', value: 'km' }, { text: 'mi', value: 'mi' }] }
    ]
    const saveConfigRequest = okSave()
    renderList({ configs, saveConfigRequest })

    await userEvent.type(screen.getByLabelText('Invoice footer'), ' more')
    await userEvent.click(switchOf('Allow gift notes'))
    await userEvent.click(screen.getByRole('checkbox', { name: 'card' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tue' }))
    await userEvent.click(screen.getByRole('button', { name: /Distance unit/ }))
    await userEvent.click(screen.getByRole('option', { name: 'Mi' }))
    expect(screen.getByText('5 unsaved changes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(barOf()).toBeNull()
    expect(screen.getByLabelText('Invoice footer')).toHaveValue('Thanks')
    expect(switchOf('Allow gift notes')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'card' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('checkbox', { name: 'Tue' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: /Distance unit/ })).toHaveTextContent('Km')
    expect(saveConfigRequest).not.toHaveBeenCalled()
  })

  it('sends nothing and shows the message under the field when a value is invalid', async () => {
    const saveConfigRequest = okSave()
    renderList({
      configs: [
        { id: 6, key: 'driver_tip_options', name: 'Tip options', type: 4, value: '[10,15]' },
        switchConfig()
      ],
      saveConfigRequest
    })
    await userEvent.click(switchOf('Allow gift notes'))
    const input = screen.getByLabelText('Driver tip options')
    await userEvent.clear(input)
    await userEvent.type(input, 'ten')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(saveConfigRequest).not.toHaveBeenCalled()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Use numbers separated by commas.'))
    expect(within(barOf()).getByRole('alert')).toHaveTextContent('Fix 1 field to save.')
    expect(screen.queryByTestId('legacy-alert')).toBeNull()

    // fixing the field clears its message and the bar's count of fields to fix
    await userEvent.clear(input)
    await userEvent.type(input, '10,20')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
    expect(within(barOf()).queryByRole('alert')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledTimes(2))
  })

  it('puts an API failure in the bar and keeps the changes, with no legacy alert', async () => {
    const saveConfigRequest = vi.fn(async () => ({ error: true, result: ['Invalid credentials'] }))
    renderList({ configs: [switchConfig()], saveConfigRequest })
    await userEvent.click(switchOf('Allow gift notes'))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await within(barOf()).findByRole('alert')
    expect(alert).toHaveTextContent('We couldn\'t save your changes. Invalid credentials')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(screen.queryByTestId('legacy-alert')).toBeNull()
    expect(mocks.refreshConfigs).not.toHaveBeenCalled()
  })

  it('says how many were stored and which one failed when the second request fails', async () => {
    const saveConfigRequest = vi.fn(async (id, params) => (
      id === 1
        ? { error: false, result: { id, value: params.value } }
        : { error: true, result: ['Tax is not allowed'] }
    ))
    renderList({ configs: [textConfig(), switchConfig()], saveConfigRequest })
    await userEvent.type(screen.getByLabelText('Invoice footer'), '!')
    await userEvent.click(switchOf('Allow gift notes'))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await within(barOf()).findByRole('alert')
    expect(alert).toHaveTextContent('Saved 1 of 2. Allow gift notes failed: Tax is not allowed')
    expect(saveConfigRequest).toHaveBeenCalledTimes(2)
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(mocks.refreshConfigs).not.toHaveBeenCalled()
  })

  it('keeps the form mounted, inert and busy while saving, then says «Saved» for four seconds', async () => {
    const pending = deferred()
    const saveConfigRequest = vi.fn(() => pending.promise)
    const view = renderList({ configs: [textConfig(), switchConfig()], saveConfigRequest })
    await userEvent.click(switchOf('Allow gift notes'))
    const input = screen.getByLabelText('Invoice footer')
    const form = view.container.querySelector('.odc-hub-form')
    expect(form).not.toHaveAttribute('inert')

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledTimes(1))

    expect(screen.getByLabelText('Invoice footer')).toBe(input)
    expect(view.container.querySelector('.odc-hub-form')).toBe(form)
    expect(form).toHaveAttribute('inert')
    expect(form).toHaveAttribute('aria-busy', 'true')
    expect(view.container.querySelector('.react-loading-skeleton')).toBeNull()
    expect(screen.queryByTestId('legacy-alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute('aria-busy', 'true')

    vi.useFakeTimers({ shouldAdvanceTime: true })
    await act(async () => { pending.resolve({ error: false, result: { id: 2, value: '0' } }) })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'))
    expect(form).not.toHaveAttribute('inert')
    expect(form).not.toHaveAttribute('aria-busy')
    expect(mocks.refreshConfigs).toHaveBeenCalledTimes(1)

    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does not send a dependent that its master hides', async () => {
    const configs = [
      { id: 20, key: 'facebook_login_enabled', name: 'Facebook login', type: 2, value: '1', options: yesNo },
      { id: 21, key: 'facebook_id', name: 'Facebook ID', type: 1, value: 'old' }
    ]
    const saveConfigRequest = okSave()
    renderList({ configs, saveConfigRequest })
    await userEvent.type(screen.getByLabelText('Facebook ID'), '-new')
    await userEvent.click(switchOf('Facebook login'))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledTimes(1))
    expect(saveConfigRequest).toHaveBeenCalledWith(20, { key: 'facebook_login_enabled', value: '0' })
  })

  it('tells the hub the dirty and saving state of its category, and drops the report on unmount', async () => {
    const pending = deferred()
    const saveConfigRequest = vi.fn(() => pending.promise)
    const report = vi.fn()
    const view = renderList({ configs: [switchConfig()], key: 'orders_category', saveConfigRequest, report })
    expect(report).toHaveBeenLastCalledWith('orders_category', { dirty: false, saving: false })

    await userEvent.click(switchOf('Allow gift notes'))
    expect(report).toHaveBeenLastCalledWith('orders_category', { dirty: true, saving: false })

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(report).toHaveBeenLastCalledWith('orders_category', { dirty: true, saving: true }))

    await act(async () => { pending.resolve({ error: false, result: { id: 2, value: '0' } }) })
    await waitFor(() => expect(report).toHaveBeenLastCalledWith('orders_category', { dirty: false, saving: false }))

    view.unmount()
    expect(report).toHaveBeenLastCalledWith('orders_category', null)
  })
})

describe('SettingsListUI inside the hub: focus', () => {
  const focusConfigs = () => [textConfig(), switchConfig()]

  it('moves the focus to the first control of the row, once per value of focus', async () => {
    const view = renderList({ configs: focusConfigs(), focus: 'invoice_footer' })
    const input = screen.getByLabelText('Invoice footer')
    await waitFor(() => expect(input).toHaveFocus())

    // the user goes elsewhere; a save re-runs the scroll effect but must not take the focus back
    await userEvent.click(switchOf('Allow gift notes'))
    expect(switchOf('Allow gift notes')).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(input).not.toHaveFocus()

    view.rerenderWith({ focus: 'allow_gift_notes' })
    await waitFor(() => expect(switchOf('Allow gift notes')).toHaveFocus())
  })

  // redesign settings R-03
  it('a click on a dropdown label focuses its trigger', async () => {
    renderList({ configs: [{ id: 6, key: 'distance_unit_x', name: 'Distance unit', type: 2, value: 'km', options: [{ text: 'km', value: 'km' }, { text: 'mi', value: 'mi' }] }] })
    await userEvent.click(screen.getByText('Distance unit', { selector: '.odc-field-label-text' }))
    expect(screen.getByRole('button', { name: /Distance unit/ })).toHaveFocus()
  })

  // redesign settings R-01: inside the app the section mounts before its configs arrive
  it('lands the focus and the scroll once the rows arrive after the mount', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const view = renderList({ configs: undefined, focus: 'invoice_footer' })
    expect(screen.queryByLabelText('Invoice footer')).toBeNull()
    // the rows arrive after the effect's own retry frame, as in the app (the catalog section answers later)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 60)) })
    view.rerenderWith({ category: { id: 1, key: 'cat', configs: focusConfigs() } })
    await waitFor(() => expect(screen.getByLabelText('Invoice footer')).toHaveFocus())
    expect(scroll).toHaveBeenCalledWith({ block: 'center' })
  })

  it('keeps scrolling to the row like before', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    renderList({ configs: focusConfigs(), focus: 'allow_gift_notes' })
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'center' }))
  })

  // content that loads above the row later (loyalty levels) pushes it out of view
  it('centres the focused row again when later content pushed it out of view', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect')
    renderList({ configs: focusConfigs(), focus: 'invoice_footer' })
    await waitFor(() => expect(screen.getByLabelText('Invoice footer')).toHaveFocus())
    expect(scroll).toHaveBeenCalledTimes(1)
    rect.mockReturnValue({ top: window.innerHeight + 300, bottom: window.innerHeight + 340, left: 0, right: 100, width: 100, height: 40, x: 0, y: window.innerHeight + 300 })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)) })
    expect(scroll).toHaveBeenCalledTimes(2)
    rect.mockRestore()
  })

  it('does not focus a text field on a phone, but does focus a switch', async () => {
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const view = renderList({ configs: focusConfigs(), focus: 'invoice_footer' })
    await waitFor(() => expect(scroll).toHaveBeenCalled())
    expect(screen.getByLabelText('Invoice footer')).not.toHaveFocus()

    view.rerenderWith({ focus: 'allow_gift_notes' })
    await waitFor(() => expect(switchOf('Allow gift notes')).toHaveFocus())
  })

  it('lands the focus on the master when the focused dependent is hidden', async () => {
    const configs = [
      { id: 20, key: 'facebook_login_enabled', name: 'Facebook login', type: 2, value: '0', options: yesNo },
      { id: 21, key: 'facebook_id', name: 'Facebook ID', type: 1, value: '' }
    ]
    renderList({ configs, focus: 'facebook_id' })
    await waitFor(() => expect(switchOf('Facebook login')).toHaveFocus())
  })
})

describe('SettingsListUI without the hub provider', () => {
  it('renders as before: legacy select, no switch, no save bar, the old Save button', async () => {
    const view = renderList({ hub: null, configs: [textConfig(), switchConfig()] })
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByTestId('legacy-select')).toBeInTheDocument()
    expect(view.container.querySelector('.odc-hub-form')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()

    await userEvent.type(view.container.querySelector('input.form-control'), '!')
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })
})
