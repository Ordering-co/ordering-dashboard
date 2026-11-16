/* eslint-disable import/first */
// redesign DS-B3 (decision 2 | M-DS12, M-DS13): the Credentials section of the provider panel. The real SettingsList (with its real
// controller, in the hub mode that SettingsHubFormContext turns on) draws the fields; only the contexts, the API call, a few heavy
// leaves of Settings, the logistics block and the setup guide iframe are replaced.
import React from 'react'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const mocks = vi.hoisted(() => ({
  projectConfigs: {},
  refreshConfigs: vi.fn(),
  showToast: vi.fn(),
  save: null,
  logisticsProps: null,
  guideProps: null
}))

const translate = (key, fallback) => fallback ?? key

vi.mock('../../../../../../index', async () => {
  const { SettingsList } = await import('../../../../../../components/SettingsList')
  return {
    useLanguage: () => [{}, translate],
    useConfig: () => [{ configs: mocks.projectConfigs }, { refreshConfigs: mocks.refreshConfigs }],
    useSession: () => [{ loading: false, token: 'session-token' }],
    // #400 (main): usePluginPage() reads these off the same aggregator
    useApi: () => [{ project: 'orderingv1' }],
    useToast: () => [{}, { showToast: mocks.showToast }],
    ToastType: { Info: 'info', Success: 'success', Error: 'error' },
    SettingsList
  }
})
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
  Alert: () => null,
  ColorPicker: () => null,
  NotFoundSource: () => null
}))
vi.mock('../../../Shared/UI/ColorPicker', () => ({ ColorPicker: () => null }))
vi.mock('../../../Settings/SettingsSelectUI', () => ({ SettingsSelectUI: () => null }))
vi.mock('../../../Settings/SettingsImage', () => ({ SettingsImage: () => null }))

// The logistics block is the legacy piece, unchanged: it records the props the section gives it
vi.mock('../../DriversGroupsLogisticsService', () => ({
  DriversGroupsLogisticsService: (props) => {
    mocks.logisticsProps = props
    return (
      <div data-testid='logistics'>
        <button type='button' onClick={() => props.handleChangesState({ autoassign_autoassign_driver: true })}>assign automatically</button>
      </div>
    )
  }
}))
vi.mock('../../DeliveryServiceDetails/DoordashContent', async (importOriginal) => ({
  hasSetupGuide: (await importOriginal()).hasSetupGuide,
  DoordashContent: (props) => {
    mocks.guideProps = props
    return <div data-testid='guide-content'>guide for {props.pluginKey}</div>
  }
}))

import { CredentialsSection } from '../CredentialsSection'

const dashboardTheme = createDashboardTheme(theme)

const field = (id, key, name, value = 'stored') => ({ id, key, name, type: 1, value })
const completeConfigs = [field(101, 'uber_direct_client_id', 'Client ID'), field(102, 'uber_direct_customer_id', 'Customer ID')]
const incompleteConfigs = [field(101, 'uber_direct_client_id', 'Client ID', ''), field(102, 'uber_direct_customer_id', 'Customer ID')]

const plugin = {
  id: 7,
  key: 'uber_direct_integration',
  setup_url: 'https://setup.example.com/start',
  root: 'https://plugin.example.com',
  links: '{"info_setup":"/info?project=@{project_code}"}'
}
const providerGroup = { id: 975001, name: 'Uber Direct group', enabled: true, plugin }
const fullGroup = { id: 975001, name: 'Uber Direct group', orders_group_start_in_status: 7, autoassign_autoassign_driver: false }

let spies
const baseProps = () => ({
  deliveryServiceState: { deliveryService: providerGroup, loading: false, error: null },
  pluginState: { configs: completeConfigs, loading: false, error: null },
  availableModifyData: true,
  setAvailableModifyData: spies.setAvailableModifyData,
  reloadPluginInformation: spies.reloadPluginInformation,
  projectCode: 'orderingv1',
  deliveryServiceId: 22,
  deliveryGroups: { groups: [fullGroup], loading: false },
  changesState: {},
  handleChangesState: spies.handleChangesState,
  handleUpdateDeliveryGroup: spies.handleUpdateDeliveryGroup,
  actionDisabled: false,
  onDirtyChange: spies.onDirtyChange
})

const renderSection = (overrides = {}) => renderWithProviders(
  <CredentialsSection {...baseProps()} {...overrides} />,
  { theme: dashboardTheme }
)

beforeEach(() => {
  mocks.projectConfigs = {}
  mocks.logisticsProps = null
  mocks.guideProps = null
  mocks.save = vi.fn(async (id, params) => ({ error: false, result: { id, value: params.value } }))
  mocks.refreshConfigs.mockClear()
  mocks.showToast.mockClear()
  Element.prototype.scrollIntoView = vi.fn()
  spies = {
    setAvailableModifyData: vi.fn(),
    reloadPluginInformation: vi.fn(),
    handleChangesState: vi.fn(),
    handleUpdateDeliveryGroup: vi.fn().mockResolvedValue({ ok: true }),
    onDirtyChange: vi.fn()
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
  vi.restoreAllMocks()
})

describe('CredentialsSection container (M-DS12)', () => {
  it('carries the tour anchor and is a plain container, not a form', () => {
    const { container } = renderSection()
    const root = container.querySelector('[data-tour="tour_fill_group"]')
    expect(root).not.toBeNull()
    expect(root.tagName).toBe('DIV')
    expect(root.closest('form')).toBeNull()
    expect(container.querySelector('form')).toBeNull()
  })
})

describe('CredentialsSection unlock notice', () => {
  it('without the credentials complete it says what to fill in to unlock the other sections', () => {
    renderSection({ availableModifyData: false, pluginState: { configs: incompleteConfigs, loading: false, error: null } })
    const notice = screen.getByText('Fill in every field below to unlock Businesses, Schedule, Payment methods and Delivery zones.')
    expect(notice.closest('[role="status"]')).toHaveAttribute('data-tone', 'info')
  })

  it('while the credentials are still loading it does not claim they are incomplete', () => {
    renderSection({ availableModifyData: false, pluginState: { configs: null, loading: true, error: null } })
    expect(screen.queryByText(/to unlock Businesses/)).toBeNull()
  })

  it('with the credentials complete there is no notice', () => {
    renderSection({ availableModifyData: true })
    expect(screen.queryByText(/to unlock Businesses/)).toBeNull()
  })
})

describe('CredentialsSection setup message and Start Setup', () => {
  it('a plugin with setup_url says to follow the steps and links Start Setup with the href of main', () => {
    renderSection()
    expect(screen.getByText('Click and Follow steps to finish setup')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Start Setup' })
    expect(link).toHaveAttribute('href', 'https://setup.example.com/start?project_code=orderingv1&access_token=session-token&driver_company_id=22')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByText('Please fill in the fields requested below.')).toBeNull()
  })

  it('a plugin without setup_url asks to fill in the fields and has no link', () => {
    renderSection({ deliveryServiceState: { deliveryService: { ...providerGroup, plugin: { ...plugin, setup_url: null } } } })
    expect(screen.getByText('Please fill in the fields requested below.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Start Setup' })).toBeNull()
    expect(screen.queryByText('Click and Follow steps to finish setup')).toBeNull()
  })
})

// #400 (main): ported from DeliveryServiceGeneralForm.test.jsx — the 3 cases for a plugin with `links.launch`
describe('CredentialsSection setup via links.launch (#400, main)', () => {
  const fetchMock = vi.fn()
  const launchPlugin = { ...plugin, name: 'Uber Direct', root: 'https://uber.test', setup_url: '/views/setup', links: { launch: '/api/pages/launch' } }
  let setupWindow

  beforeEach(() => {
    mocks.showToast.mockClear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    setupWindow = { opener: window, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(setupWindow)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('is a Button, not a link, and still says to follow the steps', () => {
    renderSection({ deliveryServiceState: { deliveryService: { ...providerGroup, plugin: launchPlugin } } })
    expect(screen.getByText('Click and Follow steps to finish setup')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Setup' })).toHaveAttribute('type', 'button')
    expect(screen.queryByRole('link', { name: 'Start Setup' })).toBeNull()
  })

  it('opens the tab on the click and sends it to the one-time URL', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { url: '/views/setup?code=one-time' } }) })
    renderSection({ deliveryServiceState: { deliveryService: { ...providerGroup, plugin: launchPlugin } } })

    await user.click(screen.getByRole('button', { name: 'Start Setup' }))

    expect(window.open).toHaveBeenCalledWith('', '_blank')
    await waitFor(() => expect(setupWindow.location.href).toBe('https://uber.test/views/setup?code=one-time'))
    expect(setupWindow.opener).toBeNull()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ page: 'setup', driver_company_id: 22 })
  })

  it('closes the tab and says why when the launch fails', async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderSection({ deliveryServiceState: { deliveryService: { ...providerGroup, plugin: launchPlugin } } })

    await user.click(screen.getByRole('button', { name: 'Start Setup' }))

    await waitFor(() => expect(setupWindow.close).toHaveBeenCalled())
    expect(mocks.showToast).toHaveBeenCalledWith('error', 'Uber Direct could not open this page. Try again in a moment.')
  })
})

describe('CredentialsSection setup guide', () => {
  it('is a secondary button, not an unnamed state', () => {
    renderSection()
    const guide = screen.getByRole('button', { name: 'Setup guide' })
    expect(guide).toHaveAttribute('data-variant', 'secondary')
    expect(guide).toHaveAttribute('type', 'button')
  })

  // main every service names its guide «Setup guide», and a plugin without one has no button
  it.each([
    ['doordash_drive_integration', 'Setup guide'],
    ['uber_direct_integration', 'Setup guide'],
    ['shipday_integration', 'Setup guide']
  ])('%s opens a dialog titled «%s» with the guide content', async (key, title) => {
    const user = userEvent.setup()
    const current = { ...plugin, key }
    renderSection({ deliveryServiceState: { deliveryService: { ...providerGroup, plugin: current } } })
    await user.click(screen.getByRole('button', { name: 'Setup guide' }))
    const dialog = await screen.findByRole('dialog', { name: title })
    expect(dialog).toHaveAttribute('data-size', 'lg')
    expect(within(dialog).getByTestId('guide-content')).toHaveTextContent(`guide for ${key}`)
    expect(mocks.guideProps).toEqual({ pluginKey: key, plugin: current })
  })

  it.each([
    ['no links', { links: null }],
    ['links without info_setup', { links: '{"launch":"/x"}' }],
    ['no root', { root: null }]
  ])('a plugin with %s has no Setup guide button', (_label, patch) => {
    renderSection({ deliveryServiceState: { deliveryService: { ...providerGroup, plugin: { ...plugin, ...patch } } } })
    expect(screen.queryByRole('button', { name: 'Setup guide' })).toBeNull()
  })

  it('Close puts it away', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole('button', { name: 'Setup guide' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('CredentialsSection credentials load states (M-DS9)', () => {
  it('shows skeletons while the credentials load and no fields', () => {
    renderSection({ pluginState: { configs: null, loading: true, error: null } })
    const busy = screen.getByRole('status', { name: 'Loading' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByLabelText('Client ID')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('an error says it, with Retry that reloads the credentials, and draws no fields', async () => {
    const user = userEvent.setup()
    renderSection({ pluginState: { configs: null, loading: false, error: ['boom'] } })
    const state = screen.getByRole('alert')
    expect(within(state).getByText("We couldn't load the credentials.")).toBeInTheDocument()
    await user.click(within(state).getByRole('button', { name: 'Retry' }))
    expect(spies.reloadPluginInformation).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText('Client ID')).toBeNull()
  })

  it('an error wins over a loading flag left on', () => {
    renderSection({ pluginState: { configs: null, loading: true, error: ['boom'] } })
    expect(screen.getByText("We couldn't load the credentials.")).toBeInTheDocument()
  })
})

describe('CredentialsSection fields in the hub mode (decision 2)', () => {
  it('draws the stored configs with Product fields named by their label', () => {
    renderSection()
    expect(screen.getByLabelText('Client ID')).toHaveValue('stored')
    expect(screen.getByLabelText('Customer ID')).toHaveValue('stored')
    expect(document.querySelector('.odc-hub-form')).not.toBeNull()
  })

  // n.º 4, D-53 (b), delivery-services P-1 (owner, 2026-10-20): the providers' secrets sit behind «Show». In force since
  // (secretConfigKeys.js) and the type 7 keys of D-53 (a); this pins the three credentials P-1 named, as the live project sends them.
  it.each([
    ['Client Secret', { id: 103, key: 'uber_direct_integration_client_secret', name: 'Client Secret', type: 1, value: 'cs_live_0123456789wxyz' }],
    ['Webhook Token', { id: 104, key: 'shipday_delivery_integration_webhook_token', name: 'Webhook Token', type: 1, value: 'wh_0123456789wxyz' }],
    ['Api Key', { id: 105, key: 'shipday_delivery_integration_api_key', name: 'Api Key', type: 7, value: 'ak_0123456789wxyz' }],
    ['Api Token', { id: 106, key: 'yango_delivery_integration_api_token', name: 'Api Token', type: 1, value: 'yg_0123456789wxyz' }],
    ['Webhook Secret', { id: 107, key: 'llamafood_delivery_integration_webhook_secret', name: 'Webhook Secret', type: 1, value: 'lf_0123456789wxyz' }],
    ['API Token', { id: 108, key: 'pedidosya_integration_api_token', name: 'API Token', type: 1, value: 'py_0123456789wxyz' }]
  ])('hides the %s behind «Show» (n.º 4, D-53 b)', (name, config) => {
    renderSection({ pluginState: { configs: [...completeConfigs, config], loading: false, error: null } })
    expect(screen.getAllByLabelText(name).find(node => node.tagName === 'INPUT')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: `Show ${name}` })).toBeInTheDocument()
  })

  it('has no save bar until something changes, then «Save changes» and «Discard»', async () => {
    const user = userEvent.setup()
    renderSection()
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    await user.type(screen.getByLabelText('Client ID'), '-2')
    const bar = await screen.findByRole('group', { name: 'Save changes' })
    expect(within(bar).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('saves with PUT /configs/:id, the same key and the new value', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.type(screen.getByLabelText('Client ID'), '-2')
    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save).toHaveBeenCalledWith(101, { key: 'uber_direct_client_id', value: 'stored-2' })
  })

  it('tells the panel it is dirty when a field changes and clean after Discard (what feeds the guard)', async () => {
    const user = userEvent.setup()
    renderSection()
    await waitFor(() => expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false))
    await user.type(screen.getByLabelText('Client ID'), '-2')
    await waitFor(() => expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true))
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false))
    expect(screen.getByLabelText('Client ID')).toHaveValue('stored')
  })

  it('tells the panel it is clean when it goes away', async () => {
    const user = userEvent.setup()
    const view = renderSection()
    await user.type(screen.getByLabelText('Client ID'), '-2')
    await waitFor(() => expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true))
    view.unmount()
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('tells the page whether the credentials are complete, as main did (setAvailableModifyData)', async () => {
    renderSection({ pluginState: { configs: incompleteConfigs, loading: false, error: null }, availableModifyData: false })
    await waitFor(() => expect(spies.setAvailableModifyData).toHaveBeenCalledWith(false))
    cleanup()
    spies.setAvailableModifyData.mockClear()
    renderSection()
    await waitFor(() => expect(spies.setAvailableModifyData).toHaveBeenCalledWith(true))
  })

  it('is not interrupted by a missing onDirtyChange', async () => {
    const user = userEvent.setup()
    renderSection({ onDirtyChange: undefined })
    await user.type(screen.getByLabelText('Client ID'), '-2')
    expect(await screen.findByRole('group', { name: 'Save changes' })).toBeInTheDocument()
  })
})

describe('CredentialsSection automatic assignment (decision 2, auditor 8 | M-DS13)', () => {
  it('is a block of its own with a title and the note that it saves on change', () => {
    renderSection()
    expect(screen.getByRole('heading', { name: 'Automatic assignment' })).toBeInTheDocument()
    expect(screen.getByText('Saves on change')).toBeInTheDocument()
    expect(screen.getByTestId('logistics')).toBeInTheDocument()
  })

  it('is outside the form of the credentials, so it does not sit under its save bar', async () => {
    const user = userEvent.setup()
    renderSection()
    const logistics = screen.getByTestId('logistics')
    expect(logistics.closest('.odc-hub-form')).toBeNull()
    await user.type(screen.getByLabelText('Client ID'), '-2')
    const bar = await screen.findByRole('group', { name: 'Save changes' })
    expect(bar.contains(logistics)).toBe(false)
    // the bar is pinned inside the wrapper of the form: the block comes after that wrapper
    const wrapper = bar.closest('.cs-form')
    expect(wrapper).not.toBeNull()
    expect(wrapper.contains(logistics)).toBe(false)
    expect(bar.compareDocumentPosition(logistics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('SettingsList does not draw it: it is not given the groups nor the pending changes', async () => {
    renderSection()
    // exactly one logistics block: the section\'s own, not a second one from SettingsList
    expect(screen.getAllByTestId('logistics')).toHaveLength(1)
  })

  it('gives the logistics service the props SettingsList gave it in main', () => {
    renderSection({ changesState: { orders_group_start_in_status: 4 } })
    const props = mocks.logisticsProps
    expect(props.curDriversGroup).toBe(fullGroup)
    expect(props.driversGroupState).toMatchObject({ driversGroup: fullGroup, groups: [fullGroup] })
    expect(props.changesState).toEqual({ orders_group_start_in_status: 4 })
    expect(props.handleChangesState).toBe(spies.handleChangesState)
    expect(props.handleUpdateDriversGroup).toBe(spies.handleUpdateDeliveryGroup)
    expect(props.actionDisabled).toBe(false)
    // it moves the side bar of main when the window is narrow: now there is none
    expect(() => props.handleParentSidebarMove(0)).not.toThrow()
  })

  it('is not drawn without groups, as in main', () => {
    renderSection({ deliveryGroups: { groups: [], loading: false } })
    expect(screen.queryByTestId('logistics')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Automatic assignment' })).toBeNull()
  })

  it('is not drawn while the groups are not known', () => {
    renderSection({ deliveryGroups: undefined })
    expect(screen.queryByTestId('logistics')).toBeNull()
  })

  it('is drawn even while the credentials load (it only needs the group)', () => {
    renderSection({ pluginState: { configs: null, loading: true, error: null } })
    expect(screen.getByTestId('logistics')).toBeInTheDocument()
  })
})

describe('CredentialsSection saves only the autoassignment on change (M-DS13)', () => {
  it('sends the autoassignment keys of changesState and nothing else', () => {
    renderSection({ changesState: { business: '[1,2]', allowed_paymethods: '[3]', autoassign_autoassign_driver: true } })
    expect(spies.handleUpdateDeliveryGroup).toHaveBeenCalledTimes(1)
    expect(spies.handleUpdateDeliveryGroup).toHaveBeenCalledWith({ autoassign_autoassign_driver: true })
  })

  it('does not call the API for pending Businesses or Payment methods', () => {
    renderSection({ changesState: { business: '[1,2]', allowed_paymethods: '[3]' } })
    expect(spies.handleUpdateDeliveryGroup).not.toHaveBeenCalled()
  })

  it('does not call the API when nothing is pending', () => {
    renderSection({ changesState: {} })
    expect(spies.handleUpdateDeliveryGroup).not.toHaveBeenCalled()
  })

  it('reacts to every change of changesState, and still skips what is not the autoassignment', () => {
    const view = renderSection({ changesState: {} })
    view.rerender(<CredentialsSection {...baseProps()} changesState={{ orders_group_start_in_status: 4 }} />)
    expect(spies.handleUpdateDeliveryGroup).toHaveBeenLastCalledWith({ orders_group_start_in_status: 4 })
    view.rerender(<CredentialsSection {...baseProps()} changesState={{ business: '[9]' }} />)
    expect(spies.handleUpdateDeliveryGroup).toHaveBeenCalledTimes(1)
  })

  it('the logistics service writes through handleChangesState; the section does not save on its own', async () => {
    const user = userEvent.setup()
    renderSection()
    await act(async () => { await user.click(screen.getByRole('button', { name: 'assign automatically' })) })
    expect(spies.handleChangesState).toHaveBeenCalledWith({ autoassign_autoassign_driver: true })
    expect(spies.handleUpdateDeliveryGroup).not.toHaveBeenCalled()
  })
})
