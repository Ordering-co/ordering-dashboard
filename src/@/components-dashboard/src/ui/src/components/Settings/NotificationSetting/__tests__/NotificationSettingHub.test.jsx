/* eslint-disable import/first */
// redesign settings D: NotificationSetting inside the Settings hub (SettingsHubFormContext provider) draws the shared
// save bar, reports to the hub, binds its visible labels and stays mounted but inert while it saves. Without the provider it is
// the screen of today. The real controller drives the real UI; only the API call, the contexts and the custom blocks (their own
// batch) are replaced.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  refreshConfigs: vi.fn(),
  showToast: vi.fn(),
  blockMounts: 0
}))

const translate = (key, fallback) => fallback ?? key

vi.mock('../../../../../../index', async () => {
  const { SettingsList } = await import('../../../../../../components/SettingsList')
  return {
    useLanguage: () => [{ dictionary: {} }, translate],
    useSession: () => [{ user: null }],
    useConfig: () => [{ configs: {} }, { refreshConfigs: mocks.refreshConfigs }],
    SettingsList
  }
})

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ loading: false, token: 'token' }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{}] }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{ dictionary: {} }, translate] }))
vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }, { refreshConfigs: mocks.refreshConfigs }]
}))

vi.mock('../../../Shared', () => ({
  Alert: ({ content, open }) => open
    ? <div role='alertdialog' data-testid='legacy-alert'>{(Array.isArray(content) ? content : [content]).filter(Boolean).join(' ')}</div>
    : null
}))

vi.mock('../../SettingsSelectUI', () => ({
  SettingsSelectUI: ({ config }) => <div data-testid='legacy-select'>{config?.name}</div>
}))

// The custom blocks have their own batch; here only that they are mounted and that a discard remounts them.
vi.mock('../../SettingsCustomBlocks', async () => {
  const React = await import('react')
  const { getSettingsBlockFocusId } = await import('../../../../../../utils/settingsCustomSections')
  const Stub = ({ handleInputChange }) => {
    React.useEffect(() => { mocks.blockMounts += 1 }, [])
    return (
      <>
        {/* the order alerts block's anchor, as the real block draws it (n.º 9) */}
        <div id={getSettingsBlockFocusId('notification_toast')}>
          <button type='button' role='switch' aria-checked='false' aria-label='Show a toast when a new order arrives'>toast</button>
        </div>
        <button type='button' onClick={() => handleInputChange('1', 40)}>custom block</button>
        <input aria-label='Dashboard — App ID' onChange={event => handleInputChange(event.target.value, 50)} />
      </>
    )
  }
  return { SettingsCustomBlocks: Stub }
})

import { SettingsHubFormContext } from '../../SettingsHubForm/SettingsHubFormContext'
import { NotificationSetting } from '../index'

const deferred = () => {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, resolve: release }
}

const okSave = () => vi.fn(async (id, params) => ({ error: false, result: { id, value: params.value } }))

const categoryOf = () => ({
  id: 8,
  key: 'notifications_category',
  configs: [
    { id: 20, key: 'notification_times_repeat', name: 'Repeat times', description: 'How many times it repeats.', type: 1, value: '3' },
    { id: 21, key: 'notification_secret', name: 'Notification secret', description: '', type: 7, value: 'abc' },
    { id: 30, key: 'notification_superadmin_states', name: 'Administrator notifications', description: 'Statuses for the administrator.', type: 3, value: '0', options: [{ value: '0' }, { value: '4' }] },
    { id: 40, key: 'notification_in_app_enabled', name: 'In-app', type: 2, value: '0', options: [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }] },
    { id: 50, key: 'onesignal_dashboardweb_id', name: 'Enter Dashboard OneSignal ID', type: 1, value: '' }
  ]
})

const renderNotifications = ({ saveConfigRequest = okSave(), report = vi.fn(), hub, extra = [], focus } = {}) => {
  const hubValue = hub === undefined ? { product: true, report } : hub
  const category = categoryOf()
  category.configs.push(...extra)
  const view = renderWithProviders(
    <SettingsHubFormContext.Provider value={hubValue}>
      <NotificationSetting category={category} saveConfigRequest={saveConfigRequest} isRemoveGeneralTitle onCloseSettingsList={() => null} focus={focus} />
    </SettingsHubFormContext.Provider>
  )
  return { ...view, saveConfigRequest, report }
}

const barOf = () => screen.queryByRole('group', { name: 'Save changes' })

beforeEach(() => {
  mocks.refreshConfigs.mockClear()
  mocks.showToast.mockClear()
  mocks.blockMounts = 0
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('NotificationSetting inside the hub', () => {
  it('binds the visible label of a text and a password input to its control', () => {
    renderNotifications()
    expect(screen.getByLabelText('Repeat times')).toHaveValue('3')
    // the «Show» button is named by the same label, so the input is asked for by its tag
    expect(screen.getByLabelText('Notification secret', { selector: 'input' })).toHaveAttribute('type', 'password')
  })

  // (review): a type 1 credential of secretConfigKeys.js (the OneSignal user auth key) is a password input here,
  // like this screen's type 7 keys; it saves the same value for the same config
  it('draws a type 1 credential as a password input and saves the same value', async () => {
    const extra = [{ id: 60, key: 'onesignal_user_auth', name: 'OneSignal User Authentication Key', description: '', type: 1, value: 'abcdefghij' }]
    const { saveConfigRequest } = renderNotifications({ extra })
    const input = screen.getByLabelText('OneSignal User Authentication Key', { selector: 'input' })
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.type(input, 'Z')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(60, { key: 'onesignal_user_auth', value: 'abcdefghijZ' }))
  })

  // (OneSignal part): the OneSignal REST keys live in the custom blocks (their own batch, already SecretField); the type 1
  // credentials of General (the user authentication key) and any type 7 key sat behind a bare password input, with no «Show» and no
  // «Ends in …». They are the hub's P/SecretField now, and what is saved does not change.
  it('draws a credential as a SecretField with Show and its last four characters', async () => {
    const extra = [{ id: 60, key: 'onesignal_user_auth', name: 'OneSignal User Authentication Key', description: '', type: 1, value: 'abcdefghijklmnop' }]
    const { saveConfigRequest } = renderNotifications({ extra })

    const show = screen.getByRole('button', { name: 'Show OneSignal User Authentication Key' })
    expect(show).toHaveAttribute('type', 'button')
    expect(screen.getByText('…mnop')).toBeInTheDocument()
    const input = document.getElementById(show.getAttribute('aria-controls'))
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.click(show)
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide OneSignal User Authentication Key' })).toBeInTheDocument()

    await userEvent.type(input, 'Z')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(60, { key: 'onesignal_user_auth', value: 'abcdefghijklmnopZ' }))
  })

  it('draws a short type 7 key as a SecretField too, without an ending', () => {
    renderNotifications()
    expect(screen.getByRole('button', { name: 'Show Notification secret' })).toBeInTheDocument()
    expect(screen.queryByText(/Ends in/)).toBeNull()
  })

  // the General Yes/No dropdowns named only «Yes» / «No» and the Information buttons all shared one name; each takes the
  // name of its field
  it('names each dropdown and each Information button with its field', async () => {
    const yesNo = [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }]
    const extra = [
      { id: 70, key: 'notification_sound_enabled', name: 'Notification sound', type: 2, value: '0', options: yesNo },
      { id: 71, key: 'notification_superadmin_repeat', name: 'Admin repeat', type: 2, value: '1', options: yesNo }
    ]
    const { saveConfigRequest } = renderNotifications({ extra })

    expect(screen.queryByRole('button', { name: 'Information' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Information about Repeat times' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Information about Admin repeat' })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Admin repeat Yes' })).toBeInTheDocument()
    const dropdown = screen.getByRole('button', { name: 'Notification sound No' })
    await userEvent.click(dropdown)
    await userEvent.click(await screen.findByRole('option', { name: 'Yes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledWith(70, { key: 'notification_sound_enabled', value: '1' }))
  })

  it('draws no bar until something changes, and never the legacy Save button', async () => {
    renderNotifications()
    expect(barOf()).toBeNull()
    await userEvent.type(screen.getByLabelText('Repeat times'), '0')

    expect(barOf()).toBeInTheDocument()
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(barOf()).getByText(/Repeat times/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  // R-04: the bar names a OneSignal cell like the block does, not with the API name
  it('names a OneSignal cell in the bar as «Dashboard — App ID»', async () => {
    renderNotifications()
    await userEvent.type(screen.getByLabelText('Dashboard — App ID'), 'a')

    expect(within(barOf()).getByText(/Dashboard — App ID/)).toBeInTheDocument()
    expect(within(barOf()).queryByText(/Enter Dashboard OneSignal ID/)).toBeNull()
  })

  it('saves through the same controller path from «Save changes»', async () => {
    const { saveConfigRequest } = renderNotifications()
    await userEvent.type(screen.getByLabelText('Repeat times'), '0')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledTimes(1))
    expect(saveConfigRequest).toHaveBeenCalledWith(20, { key: 'notification_times_repeat', value: '30' })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'))
  })

  it('Discard gives text, checkboxes and custom blocks their stored state back', async () => {
    renderNotifications()
    await userEvent.click(screen.getByRole('button', { name: 'Administrator' }))
    const text = screen.getByLabelText('Repeat times')
    await userEvent.clear(text)
    await userEvent.type(text, '9')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Preparation completed' }))
    await userEvent.click(screen.getByRole('button', { name: 'custom block' }))
    expect(screen.getByText('3 unsaved changes')).toBeInTheDocument()
    const mountsBefore = mocks.blockMounts

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(barOf()).toBeNull()
    expect(screen.getByLabelText('Repeat times')).toHaveValue('3')
    expect(screen.getByRole('checkbox', { name: 'Preparation completed' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Pending' })).toBeChecked()
    expect(mocks.blockMounts).toBe(mountsBefore + 1)
    // the accordion stays as the user left it
    expect(screen.getByRole('button', { name: 'Administrator' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('stays mounted, inert and busy while saving, with no skeleton', async () => {
    const pending = deferred()
    const saveConfigRequest = vi.fn(() => pending.promise)
    const view = renderNotifications({ saveConfigRequest })
    const text = screen.getByLabelText('Repeat times')
    await userEvent.type(text, '0')
    const form = view.container.querySelector('.odc-hub-form')
    expect(form).toBeTruthy()
    expect(form).not.toHaveAttribute('inert')

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledTimes(1))

    expect(screen.getByLabelText('Repeat times')).toBe(text)
    expect(view.container.querySelector('.odc-hub-form')).toBe(form)
    expect(form).toHaveAttribute('inert')
    expect(form).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute('aria-busy', 'true')

    await act(async () => { pending.resolve({ error: false, result: { id: 20, value: '30' } }) })
    await waitFor(() => expect(form).not.toHaveAttribute('inert'))
    expect(form).not.toHaveAttribute('aria-busy')
  })

  it('puts an API failure in the bar, keeps the change and opens no legacy alert', async () => {
    const saveConfigRequest = vi.fn(async () => ({ error: true, result: ['Max times to repeat is 15'] }))
    renderNotifications({ saveConfigRequest })
    await userEvent.type(screen.getByLabelText('Repeat times'), '0')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await within(barOf()).findByRole('alert')
    expect(alert).toHaveTextContent('We couldn\'t save your changes. Max times to repeat is 15')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(screen.queryByTestId('legacy-alert')).toBeNull()
  })

  it('says how many were stored and which one failed when the second request fails', async () => {
    const saveConfigRequest = vi.fn(async (id, params) => (
      id === 20
        ? { error: false, result: { id, value: params.value } }
        : { error: true, result: ['Administrator statuses are locked'] }
    ))
    renderNotifications({ saveConfigRequest })
    await userEvent.type(screen.getByLabelText('Repeat times'), '0')
    await userEvent.click(screen.getByRole('button', { name: 'Administrator' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Preparation completed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await within(barOf()).findByRole('alert')
    expect(alert).toHaveTextContent('Saved 1 of 2. Administrator notifications failed: Administrator statuses are locked')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('tells the hub the dirty and saving state of its category, and drops the report on unmount', async () => {
    const pending = deferred()
    const saveConfigRequest = vi.fn(() => pending.promise)
    const report = vi.fn()
    const view = renderNotifications({ saveConfigRequest, report })
    expect(report).toHaveBeenLastCalledWith('notifications_category', { dirty: false, saving: false })

    await userEvent.type(screen.getByLabelText('Repeat times'), '0')
    expect(report).toHaveBeenLastCalledWith('notifications_category', { dirty: true, saving: false })

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(report).toHaveBeenLastCalledWith('notifications_category', { dirty: true, saving: true }))

    view.unmount()
    expect(report).toHaveBeenLastCalledWith('notifications_category', null)
  })
})

// redesign (n.º 9, review L2 #1): `?focus=` (the hub's search, ⌘K, the link of /my-products/dashboard) opened Push
// notifications with every accordion closed: the field stayed hidden and the focus fell to the page
describe('NotificationSetting with ?focus= inside the hub', () => {
  const toggle = (name) => screen.getByText(name).closest('[aria-expanded]')

  it('opens General and lands on the order alerts switch for notification_toast', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    renderNotifications({ focus: 'notification_toast' })
    expect(toggle('General')).toHaveAttribute('aria-expanded', 'true')
    expect(toggle('Administrator')).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Show a toast when a new order arrives' })).toHaveFocus())
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
  })

  it('opens the accordion of a states key (Administrator for notification_superadmin_states)', () => {
    renderNotifications({ focus: 'notification_superadmin_states' })
    expect(toggle('Administrator')).toHaveAttribute('aria-expanded', 'true')
    expect(toggle('General')).toHaveAttribute('aria-expanded', 'false')
  })

  it('without ?focus= every accordion stays closed, as before', () => {
    renderNotifications()
    expect(toggle('General')).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('NotificationSetting without the hub', () => {
  it('keeps its own Save button, its Alert and its unbound labels', async () => {
    const saveConfigRequest = vi.fn(async () => ({ error: true, result: ['Max times to repeat is 15'] }))
    renderNotifications({ hub: null, saveConfigRequest })
    expect(screen.queryByLabelText('Repeat times')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()

    await userEvent.type(screen.getByPlaceholderText('Repeat times'), '0')
    expect(barOf()).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByTestId('legacy-alert')).toHaveTextContent('Max times to repeat is 15')
  })
})
