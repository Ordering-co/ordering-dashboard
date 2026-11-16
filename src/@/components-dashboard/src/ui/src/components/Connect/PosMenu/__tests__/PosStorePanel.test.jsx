/* eslint-disable import/first */
// redesign PM-C (decisions 3 to 9): the store panel of /connect/pos-menu. The controller (PosMenuBusinessDetails) is a
// stub that hands the panel the state and the handlers the test sets; the Product wrappers (RecordPanel, Menu, Dialog, ConfirmDialog,
// AsyncSwitch, AlertDialog) and the model (posMenuModel) are the real ones. The legacy pieces (custom fields, schedule, logs) are stubs:
// the custom fields stub is their controller, BusinessMetaFields (; PosStorePanelCustomFields.test.jsx mounts the real editor).
import React, { useState } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sessionUser: { id: 1, level: 0 },
  controllerProps: null,
  state: null,
  showToast: vi.fn(),
  customFields: null,
  schedule: null,
  logs: null
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => {
  const Controller = (props) => {
    const { UIComponent } = props
    mocks.controllerProps = props
    return <UIComponent {...props} {...mocks.state} />
  }
  return {
    useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
    useSession: () => [{ user: mocks.sessionUser, token: 'tok-1' }],
    useApi: () => [{ project: 'proj-1' }],
    useUtils: () => [{ parseDate: (value) => `on ${value}`, optimizeImage: (url) => url }],
    useToast: () => [{}, { showToast: mocks.showToast }],
    ToastType: { Info: 'info', Success: 'success', Error: 'error' },
    PosMenuBusinessDetails: Controller,
    // the panel wires the fields controller itself (PosCustomFieldsDialog); a stub that records what it is given
    BusinessMetaFields: (props) => { mocks.customFields = props; return <div data-testid='custom-fields' /> }
  }
})
vi.mock('jsoneditor-react', () => ({ JsonEditor: () => null }))
vi.mock('../../../Stores', () => ({
  BusinessSchedule: (props) => { mocks.schedule = props; return <div data-testid='schedule' /> }
}))
vi.mock('../../../Shared', () => ({
  IntegrationLogs: (props) => { mocks.logs = props; return <div data-testid='logs' /> }
}))

import { POS_SETUP_CALL_URL } from '../../../../utils/connectAccess'
import { PosStorePanel } from '../PosStorePanel'

const squarePlugin = {
  name: 'Square',
  root: 'https://square.example',
  setup_url: '/setup?token=@{access_token}&lang=@{language_code}',
  links: { setup: '/setup', general_settings: '/general?project=@{project_code}' }
}
const square = {
  id: 11,
  key: 'square_pos_integration',
  name: 'Square',
  type: 'pos',
  logo: 'https://logo.example/square.png',
  plugin_id: 5,
  plugin_root: 'https://square.example',
  plugin: squarePlugin
}
const clover = {
  id: 12,
  key: 'clover_integration',
  name: 'Clover',
  type: 'pos',
  logo: 'https://logo.example/clover.png',
  plugin_id: null,
  plugin: null,
  plugin_root: 'https://clover.example'
}
const simphony = {
  id: 13,
  key: 'simphony_integration',
  name: 'Simphony',
  type: 'pos',
  logo: 'https://logo.example/simphony.png',
  plugin_id: 6,
  plugin_root: 'https://simphony.example',
  plugin: { name: 'Simphony', root: 'https://simphony.example', links: {} }
}
const catalog = [square, clover, simphony]

const squareLink = { business_id: 7, third_party_integration_id: 11, enabled: true, setup_status: 'pending' }
const business = {
  id: 7,
  name: 'Fast Bite',
  enabled: true,
  city: { name: 'Miami' },
  metafields: [{ id: 1 }],
  third_party_integrations: [squareLink]
}
const bare = { ...business, third_party_integrations: [] }
// main #394: Sync and the plain «Setup» are for a connected integration; squareLink is a setup still pending
const connectedStore = { ...business, third_party_integrations: [{ ...squareLink, setup_status: 'success' }] }
const asConnected = (overrides = {}) => { mocks.state = buildState({ businessState: { loading: false, error: null, business: connectedStore }, ...overrides }) }

const names = (section) => within(section).getAllByRole('listitem').map(item => item.querySelector('.psp-row-name')?.textContent)

let spies
const buildState = (overrides = {}) => ({
  businessState: { loading: false, error: null, business },
  actionStatus: { loading: false, error: null },
  formState: { loading: false, changes: {}, result: { error: false } },
  setFormState: vi.fn(),
  handleChangeActiveBusiness: vi.fn().mockResolvedValue(undefined),
  handleConnectBusiness: vi.fn().mockResolvedValue(undefined),
  handleDisconnectBusiness: vi.fn().mockResolvedValue(undefined),
  handlePushAction: vi.fn().mockResolvedValue(undefined),
  handleUpdateBusinessState: vi.fn(),
  handleSuccessAddBusinessItem: vi.fn(),
  handleSuccessDeleteBusinessItem: vi.fn(),
  updateBusiness: vi.fn(),
  ...overrides
})

// The page owns the URL state; this host owns it for the test
const Host = ({ initialSection = null, ...props }) => {
  const [section, setSection] = useState(initialSection)
  const [expanded, setExpanded] = useState(false)
  return (
    <PosStorePanel
      businessId={7}
      business={business}
      integrationsList={{ loading: false, error: null, thirdPartyIntegrations: catalog }}
      getIntegrations={spies.getIntegrations}
      handleInstallPosIntegration={spies.handleInstallPosIntegration}
      installingPluginRoot={null}
      handleSucessUpdateBusiness={spies.handleSucessUpdateBusiness}
      initialSection={section}
      onSectionChange={(next) => { spies.onSectionChange(next); setSection(next) }}
      expanded={expanded}
      onExpandedChange={(next) => { spies.onExpandedChange(next); setExpanded(next) }}
      onClose={spies.onClose}
      {...props}
    />
  )
}

beforeEach(() => {
  mocks.sessionUser = { id: 1, level: 0 }
  mocks.controllerProps = null
  mocks.state = buildState()
  mocks.showToast.mockClear()
  mocks.customFields = null
  mocks.schedule = null
  mocks.logs = null
  spies = {
    getIntegrations: vi.fn(),
    handleInstallPosIntegration: vi.fn().mockResolvedValue({ installed: true, integration: null }),
    handleSucessUpdateBusiness: vi.fn(),
    onSectionChange: vi.fn(),
    onExpandedChange: vi.fn(),
    onClose: vi.fn()
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const card = (name) => screen.getByRole('article', { name })
const connectedSection = () => screen.getByRole('region', { name: 'Connected POS' })
const otherSection = () => screen.getByRole('region', { name: /^(Other POS systems|Connect a POS)$/ })

describe('PosStorePanel wiring to the controller', () => {
  it('mounts PosMenuBusinessDetails as dashboard with the id, the row and the list handler', () => {
    render(<Host />)
    const props = mocks.controllerProps
    expect(props.businessId).toBe(7)
    expect(props.business).toBe(business)
    expect(props.asDashboard).toBe(true)
    expect(props.handleSucessUpdateBusiness).toBe(spies.handleSucessUpdateBusiness)
  })
})

describe('PosStorePanel header', () => {
  it('names the store, with the city as the subtitle', () => {
    render(<Host />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Fast Bite')
    expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent('Miami')
  })

  it('has no subtitle when the store has no city', () => {
    mocks.state = buildState({ businessState: { loading: false, error: null, business: { ...business, city: null } } })
    render(<Host business={{ ...business, city: null }} />)
    expect(document.querySelector('.odc-record-subtitle')).toBeNull()
  })

  // redesign (owner decision 31 A): switching the store off asks first, as on /stores/list; switching it on does not
  it('«Store enabled» is the switch of the store (PM-02); switching it off asks first, naming the store; Cancel saves nothing', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const toggle = screen.getByRole('switch', { name: 'Store enabled' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)
    const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Fast Bite?' })
    expect(within(dialog).getByText("Customers won't be able to order from it until you turn it back on.")).toBeInTheDocument()
    expect(mocks.state.handleChangeActiveBusiness).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.state.handleChangeActiveBusiness).not.toHaveBeenCalled()
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('«Store enabled» off saves through the controller once confirmed (W1)', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('switch', { name: 'Store enabled' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Fast Bite?' })
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate store' }))
    await waitFor(() => expect(mocks.state.handleChangeActiveBusiness).toHaveBeenCalledTimes(1))
    expect(mocks.state.handleChangeActiveBusiness).toHaveBeenCalledWith(false)
  })

  it('«Store enabled» on saves at once, with no question', async () => {
    const user = userEvent.setup()
    const off = { ...business, enabled: false }
    mocks.state = buildState({ businessState: { loading: false, error: null, business: off } })
    render(<Host business={off} />)
    await user.click(screen.getByRole('switch', { name: 'Store enabled' }))
    expect(mocks.state.handleChangeActiveBusiness).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('closes from the close button, and opens as a page through onExpandedChange', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(spies.onExpandedChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Back to split view' }))
    expect(spies.onExpandedChange).toHaveBeenLastCalledWith(false)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('has no draft to guard: closing never asks', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('PosStorePanel connected POS (G1)', () => {
  it('paints a card for the connected Square with its status and its actions, and Square is not in Other POS systems', () => {
    render(<Host />)
    const square = card('Square')
    expect(within(connectedSection()).getByRole('heading', { level: 4, name: 'Square' })).toBeInTheDocument()
    expect(within(square).getByText('Setup pending')).toBeInTheDocument() // main's words for setup_status pending
    // main #394: a pending setup offers «Continue setup»
    for (const name of ['Sync menu', 'Sync business', 'Continue setup', 'Logs']) {
      expect(within(square).getByRole('button', { name })).toBeInTheDocument()
    }
    expect(within(square).getByRole('button', { name: 'More for Square' })).toBeInTheDocument()
    expect(names(otherSection())).not.toContain('Square')
    expect(names(otherSection())).toEqual(['Checkmate', 'Deliverect', 'Clover', 'Simphony'])
  })

  it('without a connected POS there is no «Connected POS» and the list is called «Connect a POS»', () => {
    mocks.state = buildState({ businessState: { loading: false, error: null, business: bare } })
    render(<Host business={bare} />)
    expect(screen.queryByRole('region', { name: 'Connected POS' })).toBeNull()
    expect(within(otherSection()).getByRole('heading', { level: 3, name: 'Connect a POS' })).toBeInTheDocument()
    expect(names(otherSection())).toEqual(['Checkmate', 'Deliverect', 'Square', 'Clover', 'Simphony'])
  })

  // D1 (option C): a link without a setup status is «Connected» (PM-01), with its Sync on
  it('the status is «Connected» without a setup status, «Turned off» when the link is off (PM-01)', () => {
    const plain = { ...business, third_party_integrations: [{ ...squareLink, setup_status: null }] }
    mocks.state = buildState({ businessState: { loading: false, error: null, business: plain } })
    const { unmount } = render(<Host business={plain} />)
    expect(within(card('Square')).getByText('Connected')).toBeInTheDocument()
    expect(within(card('Square')).getByRole('button', { name: 'Sync menu' })).toBeEnabled()
    expect(within(card('Square')).getByRole('button', { name: 'Setup' })).toBeInTheDocument()
    unmount()
    const off = { ...business, third_party_integrations: [{ ...squareLink, enabled: false }] }
    mocks.state = buildState({ businessState: { loading: false, error: null, business: off } })
    render(<Host business={off} />)
    expect(within(card('Square')).getByText('Turned off')).toBeInTheDocument()
    expect(within(card('Square')).getByRole('switch', { name: 'Turn Square on or off' })).toHaveAttribute('aria-checked', 'false')
  })

  it('shows the external id as text, or a dash', () => {
    const withId = { ...business, third_party_integrations: [{ ...squareLink, external_id: 'EXT-9' }] }
    mocks.state = buildState({ businessState: { loading: false, error: null, business: withId } })
    const { unmount } = render(<Host business={withId} />)
    expect(within(card('Square')).getByText('POS location ID')).toBeInTheDocument() // main #394
    expect(within(card('Square')).getByText('EXT-9')).toBeInTheDocument()
    expect(within(card('Square')).queryByRole('textbox')).toBeNull()
    unmount()
    mocks.state = buildState()
    render(<Host />)
    expect(card('Square').querySelector('.psp-card-data')).toHaveTextContent('—')
  })

  it('the integration switch is named after the POS and saves through handleConnectBusiness (W3), then updates the store', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const toggle = within(card('Square')).getByRole('switch', { name: 'Turn Square on or off' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).not.toHaveTextContent('On') // redesign PM-R1: no fixed «On» beside a switch that can be off
    await user.click(toggle)
    const connect = mocks.state.handleConnectBusiness
    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledWith(11, { external_id: '', enabled: false }, expect.any(Function), 'Integration updated successfully')
    act(() => connect.mock.calls[0][2]())
    const updated = mocks.state.handleUpdateBusinessState.mock.calls[0][0]
    expect(updated.third_party_integrations).toEqual([{ ...squareLink, external_id: '', enabled: false }])
    expect(updated.name).toBe('Fast Bite')
  })

  it('keeps the external id it has when the switch saves', async () => {
    const user = userEvent.setup()
    const withId = { ...business, third_party_integrations: [{ ...squareLink, external_id: 'EXT-9' }] }
    mocks.state = buildState({ businessState: { loading: false, error: null, business: withId } })
    render(<Host business={withId} />)
    await user.click(within(card('Square')).getByRole('switch', { name: 'Turn Square on or off' }))
    expect(mocks.state.handleConnectBusiness).toHaveBeenCalledWith(11, { external_id: 'EXT-9', enabled: false }, expect.any(Function), 'Integration updated successfully')
  })

  // redesign D-8 (owner, 2026-10-19): main disconnected at once; the owner decided it asks first (C8, decision 25)
  it('«Disconnect» in the ⋯ menu asks first, with the focus on Cancel, and Cancel disconnects nothing', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(card('Square')).getByRole('button', { name: 'More for Square' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Disconnect' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Disconnect Fast Bite from Square?' })
    expect(within(dialog).getByText('Fast Bite stops syncing with Square. To connect it again you will need its credentials.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Disconnect Square' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(mocks.state.handleDisconnectBusiness).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(within(card('Square')).getByRole('switch', { name: 'Turn Square on or off' })).toBeInTheDocument()
  })

  it('confirming «Disconnect Square» disconnects, and refreshes the lists after', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(card('Square')).getByRole('button', { name: 'More for Square' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Disconnect' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Disconnect Fast Bite from Square?' })
    expect(mocks.state.handleDisconnectBusiness).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Disconnect Square' }))
    const disconnect = mocks.state.handleDisconnectBusiness
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledWith(11, expect.any(Function))
    disconnect.mock.calls[0][1]()
    expect(spies.getIntegrations).toHaveBeenCalledTimes(1)
    expect(mocks.state.updateBusiness).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a POS that is connected but not in the list is resolved from its link (the list failed)', () => {
    const nested = { ...business, third_party_integrations: [{ ...squareLink, third_party_integration: { ...square, plugin: null, plugin_id: null } }] }
    mocks.state = buildState({ businessState: { loading: false, error: null, business: nested } })
    render(<Host business={nested} integrationsList={{ loading: false, error: ['boom'], thirdPartyIntegrations: [] }} />)
    const found = card('Square')
    expect(within(found).getByRole('switch', { name: 'Turn Square on or off' })).toBeInTheDocument()
    expect(within(found).getByText('Setup pending')).toBeInTheDocument()
    expect(within(found).queryByRole('button', { name: 'Setup' })).toBeNull()
    // Logs is always there, as in main (BusinessIntegration:205-212)
    expect(within(found).getByRole('button', { name: 'Logs' })).toBeInTheDocument()
    expect(within(found).getByRole('button', { name: 'More for Square' })).toBeInTheDocument()
  })

  it('a link with no integration at all still gets a card with a switch and Disconnect', async () => {
    const user = userEvent.setup()
    const orphan = { ...business, third_party_integrations: [{ business_id: 7, third_party_integration_id: 77, enabled: true, third_party_integration: { id: 77, type: 'pos' } }] }
    mocks.state = buildState({ businessState: { loading: false, error: null, business: orphan } })
    render(<Host business={orphan} integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [] }} />)
    const found = card('POS')
    await user.click(within(found).getByRole('button', { name: 'More for POS' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Disconnect' }))
    // redesign D-8 (owner, 2026-10-19): asks first; the link has no name, so it reads «POS»
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Disconnect Fast Bite from POS?' })).getByRole('button', { name: 'Disconnect POS' }))
    expect(mocks.state.handleDisconnectBusiness).toHaveBeenCalledWith(77, expect.any(Function))
  })

  it('a Checkmate connected through the API gets its card too (PM-18)', () => {
    const checkmate = { id: 21, name: 'Checkmate', type: 'pos', plugin_id: null, plugin_root: null }
    const linked = { ...business, third_party_integrations: [{ business_id: 7, third_party_integration_id: 21, enabled: true, setup_status: 'completed' }] }
    mocks.state = buildState({ businessState: { loading: false, error: null, business: linked } })
    render(<Host business={linked} integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [checkmate, clover] }} />)
    expect(within(card('Checkmate')).getByText('Connected')).toBeInTheDocument() // main's word for completed
  })
})

describe('PosStorePanel sync (H1, decision 25)', () => {
  beforeEach(() => asConnected())

  it.each([
    ['Sync menu', 'sync_menu', "Sync Fast Bite's menu with Square?", "Ordering asks Square to sync this store's menu now. The menu your customers see can change.", 'Sync menu with Square', 'Menu sync started. It can take a few minutes.'],
    ['Sync business', 'sync_business', "Sync Fast Bite's details with Square?", "Ordering asks Square to sync this store's details now. The details your customers see can change.", 'Sync details with Square', 'Business sync started. It can take a few minutes.']
  ])('«%s» asks first, with the focus on Cancel, and Cancel pushes nothing', async (button, action, title, body, confirmLabel) => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(card('Square')).getByRole('button', { name: button }))
    const dialog = await screen.findByRole('alertdialog', { name: title })
    expect(within(dialog).getByText(body)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: confirmLabel })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(mocks.state.handlePushAction).not.toHaveBeenCalled()
    expect(mocks.state.setFormState).not.toHaveBeenCalled()
    expect(action).toBeTruthy()
  })

  it.each([
    ['Sync menu', 'sync_menu', 'Sync menu with Square', 'Menu sync started. It can take a few minutes.'],
    ['Sync business', 'sync_business', 'Sync details with Square', 'Business sync started. It can take a few minutes.']
  ])('confirming «%s» calls handlePushAction (W5) with the done message, and the loading flag does not use the old formState (PM-12)', async (button, action, confirmLabel, done) => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(card('Square')).getByRole('button', { name: button }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: confirmLabel }))
    expect(mocks.state.handlePushAction).toHaveBeenCalledTimes(1)
    expect(mocks.state.handlePushAction).toHaveBeenCalledWith(11, action, done)
    const calls = mocks.state.setFormState.mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0][0]).toEqual(expect.objectContaining({ loading: true, changes: {} }))
    expect(typeof calls[1][0]).toBe('function')
    expect(calls[1][0]({ loading: true, changes: { x: 1 } })).toEqual({ loading: false, changes: { x: 1 } })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('the confirmation is busy while the push runs and cannot be repeated', async () => {
    const user = userEvent.setup()
    let finish
    mocks.state.handlePushAction.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<Host />)
    await user.click(within(card('Square')).getByRole('button', { name: 'Sync menu' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Sync menu with Square' }))
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Sync menu with Square' }))
    expect(mocks.state.handlePushAction).toHaveBeenCalledTimes(1)
    await act(async () => { finish() })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('while the form is loading every button of the card is disabled', () => {
    asConnected({ formState: { loading: true, changes: {}, result: { error: false } } })
    render(<Host />)
    const found = card('Square')
    for (const name of ['Sync menu', 'Sync business', 'Setup', 'Logs', 'General settings']) {
      expect(within(found).getByRole('button', { name })).toBeDisabled()
    }
    expect(within(found).getByRole('button', { name: 'More for Square' })).toBeDisabled()
  })
})

describe('PosStorePanel plugin frame (C18, PM-14)', () => {
  beforeEach(() => asConnected())

  it('has one «Setup» and a «General settings» for the plugin links', () => {
    render(<Host />)
    const found = card('Square')
    expect(within(found).getAllByRole('button', { name: 'Setup' })).toHaveLength(1)
    expect(within(found).getAllByRole('button', { name: 'General settings' })).toHaveLength(1)
  })

  // main #400: the page is built by usePluginPage (root + setup path, placeholders filled); a plugin with links.launch is asked first
  it('«Setup» opens the iframe of the plugin with its page filled in, titled after the plugin', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(card('Square')).getByRole('button', { name: 'Setup' }))
    const dialog = await screen.findByRole('dialog', { name: 'Square' })
    const frame = within(dialog).getByTitle('Square')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', 'https://square.example/setup?token=tok-1&lang=en')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('«General settings» opens its own route, root + link, with the template filled', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(card('Square')).getByRole('button', { name: 'General settings' }))
    const dialog = await screen.findByRole('dialog', { name: 'Square' })
    expect(within(dialog).getByTitle('Square')).toHaveAttribute('src', 'https://square.example/general?project=proj-1')
  })

  it('every plugin link opens its own route, not general_settings', async () => {
    const user = userEvent.setup()
    const custom = { ...square, plugin: { ...squarePlugin, setup_url: null, links: { general_settings: '/general', 'sync status': '/status' } } }
    render(<Host integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [custom, clover] }} />)
    const found = card('Square')
    expect(within(found).queryByRole('button', { name: 'Setup' })).toBeNull()
    await user.click(within(found).getByRole('button', { name: 'Sync status' }))
    const dialog = await screen.findByRole('dialog', { name: 'Square' })
    expect(within(dialog).getByTitle('Square')).toHaveAttribute('src', 'https://square.example/status')
  })

  // main the plugin pages get the store they are for (`@{business_id}`)
  it('a plugin link gets the id of the store in @{business_id}', async () => {
    const user = userEvent.setup()
    const custom = { ...square, plugin: { ...squarePlugin, links: { ...squarePlugin.links, general_settings: '/general?project=@{project_code}&business_id=@{business_id}' } } }
    render(<Host integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [custom, clover] }} />)
    await user.click(within(card('Square')).getByRole('button', { name: 'General settings' }))
    const dialog = await screen.findByRole('dialog', { name: 'Square' })
    expect(within(dialog).getByTitle('Square')).toHaveAttribute('src', 'https://square.example/general?project=proj-1&business_id=7')
  })

  // main and #394: without a setup page there is no setup action at all (getIntegrationSetupAction), so no blank iframe opens
  it('a plugin without a setup page offers no setup action', () => {
    const noSetup = { ...square, plugin: { ...squarePlugin, setup_url: null, links: { general_settings: '/general' } } }
    render(<Host integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [noSetup, clover] }} />)
    expect(within(card('Square')).queryByRole('button', { name: /setup/i })).toBeNull()
    expect(within(card('Square')).getByRole('button', { name: 'General settings' })).toBeInTheDocument()
  })

  it('«Logs» opens the log of the store and the plugin', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(card('Square')).getByRole('button', { name: 'Logs' }))
    const dialog = await screen.findByRole('dialog', { name: 'Logs' })
    expect(within(dialog).getByTestId('logs')).toBeInTheDocument()
    expect(mocks.logs).toEqual({ model: 'Business', modelId: 7, pluginId: 5 })
  })
})

describe('PosStorePanel other POS systems (C13 to C17)', () => {
  it('«Install» asks first, with the text of main, and then installs the plugin for the project (W2)', async () => {
    const user = userEvent.setup()
    mocks.state = buildState({ businessState: { loading: false, error: null, business: bare } })
    render(<Host business={bare} />)
    const row = within(otherSection()).getByText('Clover').closest('li')
    await user.click(within(row).getByRole('button', { name: 'Install Clover' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Install Clover for the whole project?' })
    expect(within(dialog).getByText('This installs Clover for the whole project and connects it to this store.')).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(spies.handleInstallPosIntegration).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Install Clover' }))
    expect(spies.handleInstallPosIntegration).toHaveBeenCalledTimes(1)
    expect(spies.handleInstallPosIntegration).toHaveBeenCalledWith(clover)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('installing in a store with no POS connects it, as main does (W3), and then looks for the new card', async () => {
    const user = userEvent.setup()
    mocks.state = buildState({ businessState: { loading: false, error: null, business: bare } })
    spies.handleInstallPosIntegration.mockResolvedValue({ installed: true, integration: { ...clover, id: 99, plugin_id: 8 } })
    render(<Host business={bare} />)
    await user.click(within(within(otherSection()).getByText('Clover').closest('li')).getByRole('button', { name: 'Install Clover' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Install Clover' }))
    await waitFor(() => expect(mocks.state.handleConnectBusiness).toHaveBeenCalledTimes(1))
    expect(mocks.state.handleConnectBusiness).toHaveBeenCalledWith(99, { enabled: true }, expect.any(Function))
    act(() => mocks.state.handleConnectBusiness.mock.calls[0][2]())
    expect(mocks.state.updateBusiness).toHaveBeenCalledTimes(1)
  })

  it('installing a plugin that does not show up yet only refreshes the store', async () => {
    const user = userEvent.setup()
    mocks.state = buildState({ businessState: { loading: false, error: null, business: bare } })
    render(<Host business={bare} />)
    await user.click(within(within(otherSection()).getByText('Clover').closest('li')).getByRole('button', { name: 'Install Clover' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Install Clover' }))
    await waitFor(() => expect(mocks.state.updateBusiness).toHaveBeenCalledTimes(1))
    expect(mocks.state.handleConnectBusiness).not.toHaveBeenCalled()
  })

  it('with a POS already connected the text says the store stays on it, and nothing else is connected', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(within(otherSection()).getByText('Clover').closest('li')).getByRole('button', { name: 'Install Clover' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('This installs Clover for the whole project. This store stays connected to Square.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Install Clover' }))
    expect(spies.handleInstallPosIntegration).toHaveBeenCalledWith(clover)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.state.handleConnectBusiness).not.toHaveBeenCalled()
  })

  it('the Install button of the plugin being installed reads «Installing...» and is busy', () => {
    render(<Host installingPluginRoot='https://clover.example' />)
    const row = within(otherSection()).getByText('Clover').closest('li')
    const button = within(row).getByRole('button', { name: 'Installing...' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    // anything else is disabled while a plugin installs
    expect(within(within(otherSection()).getByText('Simphony').closest('li')).getByRole('button', { name: 'Connect Simphony' })).toBeDisabled()
  })

  // main #394: on a store with no POS yet (a store keeps one POS, see «one POS per store» below)
  it('«Connect» connects the store to an installed POS (W3) and refreshes both lists after', async () => {
    const user = userEvent.setup()
    mocks.state = buildState({ businessState: { loading: false, error: null, business: bare } })
    render(<Host business={bare} />)
    const row = within(otherSection()).getByText('Simphony').closest('li')
    expect(within(row).getByText('Installed')).toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'Connect Simphony' }))
    const connect = mocks.state.handleConnectBusiness
    expect(connect).toHaveBeenCalledWith(13, { enabled: true }, expect.any(Function))
    act(() => connect.mock.calls[0][2]())
    expect(spies.getIntegrations).toHaveBeenCalledTimes(1)
    expect(mocks.state.updateBusiness).toHaveBeenCalledTimes(1)
  })

  it('the card of a POS that has just been connected takes the focus on its title', async () => {
    const user = userEvent.setup()
    mocks.state = buildState({ businessState: { loading: false, error: null, business: bare } })
    const { rerender } = render(<Host business={bare} />)
    await user.click(within(within(otherSection()).getByText('Simphony').closest('li')).getByRole('button', { name: 'Connect Simphony' }))
    act(() => mocks.state.handleConnectBusiness.mock.calls[0][2]())
    const linked = { ...business, third_party_integrations: [{ business_id: 7, third_party_integration_id: 13, enabled: true }] }
    mocks.state = buildState({ businessState: { loading: false, error: null, business: linked } })
    rerender(<Host business={linked} />)
    await waitFor(() => expect(within(card('Simphony')).getByRole('heading', { level: 4, name: 'Simphony' })).toHaveFocus())
    // and Simphony left the list
    expect(names(otherSection())).not.toContain('Simphony')
  })

  it('Checkmate and Deliverect are links to the setup call, named by their visible text and the POS (PM-05, PM-R2)', () => {
    render(<Host />)
    const link = within(otherSection()).getByRole('link', { name: 'Book setup call · Checkmate' })
    expect(link).toHaveAttribute('href', POS_SETUP_CALL_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveTextContent('Book setup call')
    expect(within(otherSection()).getByRole('link', { name: 'Book setup call · Deliverect' })).toBeInTheDocument()
  })

  it('a store owner (level 2) gets no Install on a plugin that is not installed, just «Contact administrator»', () => {
    mocks.sessionUser = { id: 2, level: 2 }
    render(<Host />)
    const row = within(otherSection()).getByText('Clover').closest('li')
    expect(within(row).queryByRole('button')).toBeNull()
    expect(within(row).getByText('Contact administrator')).toBeInTheDocument()
    expect(within(otherSection()).queryByRole('button', { name: /Install/ })).toBeNull()
    // an installed plugin can still be connected
    expect(within(within(otherSection()).getByText('Simphony').closest('li')).getByRole('button', { name: 'Connect Simphony' })).toBeInTheDocument()
  })

  it('an integration with no plugin and no root says the plugin is needed (as main)', async () => {
    const user = userEvent.setup()
    const lost = { id: 31, key: 'lost', name: 'Lostpos', type: 'pos', plugin_id: null, plugin: null, plugin_root: null }
    render(<Host integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [lost] }} />)
    await user.click(within(otherSection()).getByRole('button', { name: 'Install Lostpos' }))
    expect(mocks.showToast).toHaveBeenCalledWith('error', 'Plugin is needed to connect to this integration')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('shows skeletons, not the list, while the integrations load', () => {
    render(<Host integrationsList={{ loading: true, error: null, thirdPartyIntegrations: [] }} />)
    expect(within(otherSection()).getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    expect(within(otherSection()).queryByRole('listitem')).toBeNull()
  })

  it('when the integrations fail it says so with «Try again», and offers no Install or Connect (PM-15)', async () => {
    const user = userEvent.setup()
    render(<Host integrationsList={{ loading: false, error: ['boom'], thirdPartyIntegrations: [] }} />)
    const notice = screen.getByText("The POS list couldn't load.").closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    expect(within(otherSection()).queryByRole('button')).toBeNull()
    // the setup-call links do not depend on the list
    expect(within(otherSection()).getAllByRole('link')).toHaveLength(2)
    await user.click(within(notice).getByRole('button', { name: 'Try again' }))
    expect(spies.getIntegrations).toHaveBeenCalledTimes(1)
  })
})

describe('PosStorePanel network failures (PM-15)', () => {
  it.each([
    ['Disconnect', 'handleDisconnectBusiness', async (user) => {
      await user.click(within(card('Square')).getByRole('button', { name: 'More for Square' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Disconnect' }))
      // redesign D-8 (owner, 2026-10-19): the call runs after the confirmation
      await user.click(within(await screen.findByRole('alertdialog', { name: 'Disconnect Fast Bite from Square?' })).getByRole('button', { name: 'Disconnect Square' }))
    }],
    ['the integration switch', 'handleConnectBusiness', async (user) => {
      await user.click(within(card('Square')).getByRole('switch', { name: 'Turn Square on or off' }))
    }],
    // main #394: Connect runs on a store with no POS yet (a store keeps one POS)
    ['Connect', 'handleConnectBusiness', async (user) => {
      await user.click(within(within(otherSection()).getByText('Simphony').closest('li')).getByRole('button', { name: 'Connect Simphony' }))
    }, bare]
  ])('%s that throws says so in an alert', async (_, handler, perform, store = business) => {
    const user = userEvent.setup()
    mocks.state = buildState({ businessState: { loading: false, error: null, business: store } })
    mocks.state[handler].mockRejectedValue(new Error('offline'))
    render(<Host business={store} />)
    await perform(user)
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(within(dialog).getByText('The integration did not respond. Please try again.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('an error of the controller opens the alert with its text (C20)', async () => {
    mocks.state = buildState({ actionStatus: { loading: false, error: ['Store not saved'] } })
    render(<Host />)
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(within(dialog).getByText('Store not saved')).toBeInTheDocument()
  })
})

// redesign bugs-d row 80: a request that never reached the API shows the browser's «Failed to fetch» raw; it says it in words now
describe('PosStorePanel network failures read in words (row 80)', () => {
  it('a controller error that is a network failure opens the alert with the readable text', async () => {
    mocks.state = buildState({ actionStatus: { loading: false, error: ['Failed to fetch'] } })
    render(<Host />)
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(within(dialog).getByText('The integration did not respond. Please try again.')).toBeInTheDocument()
    expect(within(dialog).queryByText('Failed to fetch')).toBeNull()
  })

  it('a store request that is a network failure reads the same', async () => {
    mocks.state = buildState({ businessState: { loading: false, error: ['Load failed'], business: null } })
    render(<Host business={null} />)
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(within(dialog).getByText('The integration did not respond. Please try again.')).toBeInTheDocument()
  })

  it('other API messages stay as they are, next to a network failure', async () => {
    mocks.state = buildState({ actionStatus: { loading: false, error: ['Store not saved', 'NetworkError when attempting to fetch resource.'] } })
    render(<Host />)
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(within(dialog).getByText('Store not saved')).toBeInTheDocument()
    expect(within(dialog).getByText('The integration did not respond. Please try again.')).toBeInTheDocument()
  })
})

describe('PosStorePanel loading and not found (PM-15)', () => {
  it('while the store loads it paints skeletons, not «not found»', () => {
    mocks.state = buildState({ businessState: { loading: true, error: null, business: null } })
    render(<Host business={null} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText("Sorry, we couldn't find the requested business.")).toBeNull()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('the controller says «not loading» before it asks, so the first update is still loading and only the second is the answer', () => {
    mocks.state = buildState({ businessState: { loading: true, error: null, business: null } })
    const { rerender } = render(<Host business={null} />)
    // update 1: the controller sets loading false before it requests
    mocks.state = buildState({ businessState: { loading: false, error: null, business: null } })
    rerender(<Host business={null} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByText("Sorry, we couldn't find the requested business.")).toBeNull()
    // a render with the same object is not an update
    rerender(<Host business={null} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    // update 2: the answer, and it is empty
    mocks.state = buildState({ businessState: { loading: false, error: null, business: null } })
    rerender(<Host business={null} />)
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
    expect(screen.getByText("Sorry, we couldn't find the requested business.")).toBeInTheDocument()
  })

  it('«Close» of the not found state closes the panel', async () => {
    const user = userEvent.setup()
    mocks.state = buildState({ businessState: { loading: false, error: null, business: null } })
    const { rerender } = render(<Host business={null} />)
    mocks.state = buildState({ businessState: { loading: false, error: null, business: null } })
    rerender(<Host business={null} />)
    mocks.state = buildState({ businessState: { loading: false, error: null, business: null } })
    rerender(<Host business={null} />)
    expect(screen.queryByRole('button', { name: 'Go to Stores' })).toBeNull()
    // the panel's own header «Close» also exists; this is the one inside the not found state
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('an error of the request ends the wait at once and the alert says it', async () => {
    mocks.state = buildState({ businessState: { loading: false, error: ['Network down'], business: null } })
    render(<Host business={null} />)
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
    expect(screen.getByText("Sorry, we couldn't find the requested business.")).toBeInTheDocument()
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(within(dialog).getByText('Network down')).toBeInTheDocument()
  })

  it('a store the request brings ends the wait too', () => {
    mocks.state = buildState({ businessState: { loading: false, error: null, business } })
    render(<Host business={null} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Fast Bite')
  })
})

describe('PosStorePanel sections of the URL (C12, C21, PM-17)', () => {
  it('?section=custom_fields opens the custom fields with the props main gives them', async () => {
    render(<Host initialSection='custom_fields' />)
    const dialog = await screen.findByRole('dialog', { name: 'Custom fields' })
    expect(within(dialog).getByTestId('custom-fields')).toBeInTheDocument()
    expect(mocks.customFields.businessId).toBe(7)
    expect(mocks.customFields.metafields).toBe(business.metafields)
    expect(mocks.customFields.asDashboard).toBe(true)
    mocks.customFields.handleSuccessAddMetaFields({ id: 2 })
    expect(mocks.state.handleSuccessAddBusinessItem).toHaveBeenCalledWith('metafields', { id: 2 })
    mocks.customFields.handleSuccessDeleteBusinessMetaFields(1)
    expect(mocks.state.handleSuccessDeleteBusinessItem).toHaveBeenCalledWith('metafields', 1)
  })

  it('opens from the ⋯ menu, writes the section, and clears it on close', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Custom fields' }))
    expect(spies.onSectionChange).toHaveBeenLastCalledWith('custom_fields')
    const dialog = await screen.findByRole('dialog', { name: 'Custom fields' })
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(spies.onSectionChange).toHaveBeenLastCalledWith(null)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('?section=schedule opens the schedule editor, only by URL, and clears the section on close', async () => {
    const user = userEvent.setup()
    render(<Host initialSection='schedule' />)
    const dialog = await screen.findByRole('dialog', { name: 'Schedule' })
    expect(within(dialog).getByTestId('schedule')).toBeInTheDocument()
    expect(mocks.schedule.business).toBe(business)
    expect(mocks.schedule.handleSuccessUpdate).toBe(mocks.state.handleUpdateBusinessState)
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(spies.onSectionChange).toHaveBeenLastCalledWith(null)
  })

  it('the schedule is not in the ⋯ menu', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    expect(await screen.findAllByRole('menuitem')).toHaveLength(1)
  })

  it('?section=integration opens nothing: the focus goes to the first POS card and the section is cleared', async () => {
    render(<Host initialSection='integration' />)
    await waitFor(() => expect(within(card('Square')).getByRole('heading', { level: 4, name: 'Square' })).toHaveFocus())
    expect(spies.onSectionChange).toHaveBeenCalledWith(null)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('?section=integration with no POS connected focuses «Connect a POS»', async () => {
    mocks.state = buildState({ businessState: { loading: false, error: null, business: bare } })
    render(<Host business={bare} initialSection='integration' />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: 'Connect a POS' })).toHaveFocus())
    expect(spies.onSectionChange).toHaveBeenCalledWith(null)
  })

  it('?section=integration waits for the store to load', async () => {
    mocks.state = buildState({ businessState: { loading: true, error: null, business: null } })
    const { rerender } = render(<Host business={null} initialSection='integration' />)
    expect(spies.onSectionChange).not.toHaveBeenCalled()
    mocks.state = buildState()
    rerender(<Host business={null} initialSection='integration' />)
    await waitFor(() => expect(spies.onSectionChange).toHaveBeenCalledWith(null))
  })
})

// main, absolute plugin links are used as they are, and Calendly is for administrators (session level 0) only.
// main #400: every page is built by usePluginPage (resolvePluginUrl: an absolute path as it is, a relative one after the
// root), which replaced PosMenuBusinessDetails.handleSync.
describe('PosStorePanel absolute plugin links (main , )', () => {
  const withLinks = (links) => ({ ...square, plugin: { ...squarePlugin, setup_url: null, links } })

  it.each([
    ['an absolute link', 'https://other.example/page?x=1', 'https://other.example/page?x=1'],
    ['a protocol-relative link', '//cdn.example/page', '//cdn.example/page'],
    ['a relative link', '/page', 'https://square.example/page']
  ])('%s opens the right url, for an administrator and for a store owner', async (_, link, expected) => {
    for (const level of [0, 2]) {
      mocks.sessionUser = { id: level, level }
      const user = userEvent.setup()
      const { unmount } = render(<Host integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [withLinks({ page: link }), clover] }} />)
      await user.click(within(card('Square')).getByRole('button', { name: 'Page' }))
      const dialog = await screen.findByRole('dialog', { name: 'Square' })
      expect(within(dialog).getByTitle('Square')).toHaveAttribute('src', expected)
      await user.click(within(dialog).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      unmount()
    }
  })

  // main #400: an absolute setup page opens as it is (usePluginPage → resolvePluginUrl)
  it('«Continue setup» opens an absolute setup page as it is', async () => {
    const user = userEvent.setup()
    const absolute = { ...square, plugin: { ...squarePlugin, setup_url: 'https://other.example/setup' } }
    render(<Host integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [absolute, clover] }} />)
    await user.click(within(card('Square')).getByRole('button', { name: 'Continue setup' }))
    const dialog = await screen.findByRole('dialog', { name: 'Square' })
    expect(within(dialog).getByTitle('Square')).toHaveAttribute('src', 'https://other.example/setup')
  })
})

describe('PosStorePanel Calendly is for administrators (main , )', () => {
  const calendlyLink = 'https://calendly.com/team/help'
  const withLinks = (links, setupUrl = null) => ({ ...square, plugin: { ...squarePlugin, setup_url: setupUrl, links } })
  const mount = (integration) => render(<Host integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [integration, clover] }} />)
  const asLevel = (level) => { mocks.sessionUser = { id: level, level } }

  describe('a. plugin link buttons', () => {
    it('level 2: the Calendly link is a disabled «Contact admin», opens nothing; the other links work', async () => {
      asLevel(2)
      const user = userEvent.setup()
      mount(withLinks({ help: calendlyLink, general_settings: '/general' }))
      const found = card('Square')
      expect(within(found).queryByRole('button', { name: 'Help' })).toBeNull()
      const restricted = within(found).getByRole('button', { name: 'Contact admin' })
      expect(restricted).toBeDisabled()
      await user.click(restricted)
      expect(screen.queryByRole('dialog', { name: 'Square' })).toBeNull()
      await user.click(within(found).getByRole('button', { name: 'General settings' }))
      expect(within(await screen.findByRole('dialog', { name: 'Square' })).getByTitle('Square')).toHaveAttribute('src', 'https://square.example/general')
    })

    it('level 2: a protocol-relative Calendly link and a relative link on a Calendly root are restricted too', () => {
      asLevel(2)
      mount({ ...withLinks({ help: '//calendly.com/team/help', other: '/team/other' }), plugin: { ...squarePlugin, root: 'https://calendly.com', setup_url: null, links: { help: '//calendly.com/team/help', other: '/team/other' } } })
      const found = card('Square')
      expect(within(found).getAllByRole('button', { name: 'Contact admin' })).toHaveLength(2)
      expect(within(found).queryByRole('button', { name: 'Help' })).toBeNull()
      expect(within(found).queryByRole('button', { name: 'Other' })).toBeNull()
    })

    it('level 0: the same link is a normal button that opens the Calendly page', async () => {
      asLevel(0)
      const user = userEvent.setup()
      mount(withLinks({ help: calendlyLink, general_settings: '/general' }))
      const found = card('Square')
      expect(within(found).queryByRole('button', { name: 'Contact admin' })).toBeNull()
      const help = within(found).getByRole('button', { name: 'Help' })
      expect(help).toBeEnabled()
      await user.click(help)
      expect(within(await screen.findByRole('dialog', { name: 'Square' })).getByTitle('Square')).toHaveAttribute('src', calendlyLink)
    })
  })

  describe('b. the setup action', () => {
    const calendlySetup = withLinks({ general_settings: '/general' }, calendlyLink)
    // an uninstalled plugin whose root is a Calendly page
    const calendlyStub = { id: 40, key: 'booked', name: 'Booked', type: 'pos', plugin_id: null, plugin: null, plugin_root: 'https://calendly.com/team/setup' }
    const row = (name) => within(otherSection()).getByText(name).closest('li')
    // a store with nothing connected, so the integrations are all offered in the list
    const mountBare = (integrations) => {
      mocks.state = buildState({ businessState: { loading: false, error: null, business: bare } })
      render(<Host business={bare} integrationsList={{ loading: false, error: null, thirdPartyIntegrations: integrations }} />)
    }

    it('level 2: a connected integration whose setup is Calendly shows a disabled «Contact admin» instead of Setup', async () => {
      asLevel(2)
      const user = userEvent.setup()
      mount(calendlySetup)
      const found = card('Square')
      expect(within(found).queryByRole('button', { name: 'Setup' })).toBeNull()
      expect(within(found).queryByRole('button', { name: 'Continue setup' })).toBeNull()
      const restricted = within(found).getByRole('button', { name: /^Contact admin/ })
      expect(restricted).toBeDisabled()
      await user.click(restricted)
      expect(screen.queryByRole('dialog', { name: 'Square' })).toBeNull()
    })

    it('level 0: that integration keeps its Setup', async () => {
      asLevel(0)
      const user = userEvent.setup()
      mount(calendlySetup)
      const found = card('Square')
      expect(within(found).queryByRole('button', { name: /Contact admin/ })).toBeNull()
      // main #394: the setup still pending reads «Continue setup»
      await user.click(within(found).getByRole('button', { name: 'Continue setup' }))
      const dialog = await screen.findByRole('dialog', { name: 'Square' })
      expect(within(dialog).getByTitle('Square')).toHaveAttribute('src', calendlyLink)
    })

    it('level 2: an uninstalled integration with a Calendly plugin_root shows a disabled «Contact admin» instead of Install', async () => {
      asLevel(2)
      const user = userEvent.setup()
      mountBare([calendlyStub])
      const found = row('Booked')
      expect(within(found).queryByRole('button', { name: /Install/ })).toBeNull()
      const restricted = within(found).getByRole('button', { name: 'Contact admin · Booked' })
      expect(restricted).toBeDisabled()
      expect(restricted).toHaveTextContent('Contact admin')
      await user.click(restricted)
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(spies.handleInstallPosIntegration).not.toHaveBeenCalled()
    })

    it('level 0: the same integration keeps Install', () => {
      asLevel(0)
      mountBare([calendlyStub])
      expect(within(row('Booked')).getByRole('button', { name: 'Install Booked' })).toBeEnabled()
      expect(within(row('Booked')).queryByRole('button', { name: /Contact admin/ })).toBeNull()
    })

    it('level 2: an installed integration whose setup is Calendly cannot be connected from here either', () => {
      asLevel(2)
      mountBare([calendlySetup])
      expect(within(row('Square')).queryByRole('button', { name: 'Connect Square' })).toBeNull()
      expect(within(row('Square')).getByRole('button', { name: /Contact admin/ })).toBeDisabled()
    })
  })

  describe('c. «book a setup call» rows', () => {
    it('level 0: links to the setup call, as always', () => {
      asLevel(0)
      render(<Host />)
      expect(within(otherSection()).getByRole('link', { name: 'Book setup call · Checkmate' })).toHaveAttribute('href', POS_SETUP_CALL_URL)
      expect(within(otherSection()).queryByRole('button', { name: /Contact admin/ })).toBeNull()
    })

    it('level 2: no link, a disabled «Contact admin» per row', () => {
      asLevel(2)
      render(<Host />)
      expect(within(otherSection()).queryByRole('link')).toBeNull()
      for (const pos of ['Checkmate', 'Deliverect']) {
        const row = within(otherSection()).getByText(pos).closest('li')
        const restricted = within(row).getByRole('button', { name: `Contact admin · ${pos}` })
        expect(restricted).toBeDisabled()
        expect(restricted).toHaveTextContent('Contact admin')
      }
    })
  })
})

// main #394 and #399: the rules of «Other POS systems» that came with the launch merge
describe('PosStorePanel other POS systems: main #394 and #399', () => {
  const pendingClover = { ...clover, pending_plugin: { id: 41, root: clover.plugin_root, install_status: 'installing' } }
  const drawWith = (integrations, store = business, props = {}) => {
    mocks.state = buildState({ businessState: { loading: false, error: null, business: store } })
    return render(<Host business={store} integrationsList={{ loading: false, error: null, thirdPartyIntegrations: integrations }} {...props} />)
  }

  it('a store with its POS says so and does not connect another installed one', () => {
    drawWith(catalog)
    expect(within(otherSection()).getByText('This store already uses Square. Disconnect it to switch POS.')).toBeInTheDocument()
    const row = within(otherSection()).getByText('Simphony').closest('li')
    expect(within(row).getByRole('button', { name: 'Connect Simphony' })).toBeDisabled()
    // installing a plugin is for the whole project, so it stays
    expect(within(within(otherSection()).getByText('Clover').closest('li')).getByRole('button', { name: 'Install Clover' })).toBeEnabled()
  })

  // (main #485): the blocked row itself says another POS is connected, names it and how to switch
  it('the row blocked by the store\'s POS says so, names that POS and how to switch', () => {
    drawWith(catalog)
    const row = within(otherSection()).getByText('Simphony').closest('li')
    expect(within(row).getByText('Another POS connected')).toBeInTheDocument()
    expect(within(row).getByText('This store already uses Square. To connect Simphony, open Square and choose Disconnect.')).toBeInTheDocument()
    // an install row is not blocked
    expect(within(within(otherSection()).getByText('Clover').closest('li')).queryByText('Another POS connected')).toBeNull()
  })

  it('a store with no POS has no such note', () => {
    drawWith(catalog, bare)
    expect(within(otherSection()).queryByText(/already uses/)).toBeNull()
  })

  it('a plugin still installing shows Installing and Check again, which connects the store once it is done', async () => {
    const user = userEvent.setup()
    const handleCheckPluginInstall = vi.fn().mockResolvedValue({ integration: { id: 12 } })
    drawWith([square, pendingClover], bare, { handleCheckPluginInstall })
    const row = within(otherSection()).getByText('Clover').closest('li')
    expect(within(row).getByText('Installing')).toBeInTheDocument()
    expect(within(row).getByText('Still finishing its install. It can take a few minutes.')).toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'Check again · Clover' }))
    expect(handleCheckPluginInstall).toHaveBeenCalledWith(pendingClover)
    expect(mocks.state.handleConnectBusiness).toHaveBeenCalledWith(12, { enabled: true }, expect.any(Function))
  })

  it('Check again on a store that has its POS only reads the store again', async () => {
    const user = userEvent.setup()
    const handleCheckPluginInstall = vi.fn().mockResolvedValue({ integration: { id: 12 } })
    drawWith([square, pendingClover], business, { handleCheckPluginInstall })
    await user.click(within(within(otherSection()).getByText('Clover').closest('li')).getByRole('button', { name: 'Check again · Clover' }))
    await waitFor(() => expect(mocks.state.updateBusiness).toHaveBeenCalledTimes(1))
    expect(mocks.state.handleConnectBusiness).not.toHaveBeenCalled()
  })

  it('a check in progress reads Checking... and turns the other actions off', () => {
    drawWith([square, pendingClover, simphony], bare, { checkingPluginRoot: clover.plugin_root })
    const row = within(otherSection()).getByText('Clover').closest('li')
    expect(within(row).getByRole('button', { name: /Checking/ })).toBeInTheDocument()
    expect(within(within(otherSection()).getByText('Simphony').closest('li')).getByRole('button', { name: 'Connect Simphony' })).toBeDisabled()
  })

  it('a failed install keeps Connect off and shows the reason of the API', () => {
    const failed = { ...simphony, plugin: { ...simphony.plugin, install_status: 'failed', install_message: 'The token was refused' } }
    drawWith([square, failed], bare)
    const row = within(otherSection()).getByText('Simphony').closest('li')
    expect(within(row).getByText('Install failed')).toBeInTheDocument()
    expect(within(row).getByText('The token was refused')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Connect Simphony' })).toBeDisabled()
  })

  it('a disabled plugin cannot be connected and says Plugin disabled', () => {
    const disabled = { ...simphony, plugin: { ...simphony.plugin, enabled: false } }
    drawWith([square, disabled], bare)
    const row = within(otherSection()).getByText('Simphony').closest('li')
    expect(within(row).getByText('Plugin disabled')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Connect Simphony' })).toBeDisabled()
  })
})

// main #394 and #400: the integration detail of main, in the connected card
describe('PosStorePanel connected card: main #394 and #400', () => {
  const storeWithLink = (changes) => ({ ...business, third_party_integrations: [{ ...squareLink, ...changes }] })
  const mountWith = ({ link = {}, plugin = {} } = {}) => {
    const store = storeWithLink(link)
    const integration = { ...square, plugin: { ...squarePlugin, ...plugin } }
    mocks.state = buildState({ businessState: { loading: false, error: null, business: store } })
    return render(<Host business={store} integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [integration, clover, simphony] }} />)
  }

  afterEach(() => vi.unstubAllGlobals())

  it('a connected POS says when and what its state means, and offers Setup', () => {
    mountWith({ link: { setup_status: 'success', setup_status_updated_at: '2026-10-20 10:00:00' } })
    const found = card('Square')
    expect(within(found).getByText('Connected')).toBeInTheDocument()
    expect(within(found).getByText('on 2026-10-20 10:00:00')).toBeInTheDocument()
    expect(within(found).getByText('The POS is connected and syncing with this store.')).toBeInTheDocument()
    expect(within(found).getByRole('button', { name: 'Setup' })).toBeEnabled()
    expect(within(found).getByRole('button', { name: 'Sync menu' })).toBeEnabled()
  })

  it('a failed connection needs attention, shows the plugin message and offers Reconnect', () => {
    mountWith({ link: { setup_status: 'failed', setup_message: 'Token expired' } })
    const found = card('Square')
    expect(within(found).getByText('Needs attention')).toBeInTheDocument()
    expect(within(found).getByText('Token expired')).toBeInTheDocument()
    expect(within(found).getByRole('button', { name: 'Reconnect' })).toBeInTheDocument()
  })

  it('a pending setup keeps Sync off until the POS is connected', () => {
    mountWith()
    const found = card('Square')
    expect(within(found).getByRole('button', { name: 'Sync menu' })).toBeDisabled()
    expect(within(found).getByRole('button', { name: 'Sync business' })).toBeDisabled()
    expect(within(found).getByText('Available once the POS is connected.')).toBeInTheDocument()
    expect(within(found).getByText('The connection was started but not finished.')).toBeInTheDocument()
  })

  it('a disabled plugin warns beside the state, pauses Sync and offers no setup nor plugin pages', () => {
    mountWith({ link: { setup_status: 'success' }, plugin: { enabled: false } })
    const found = card('Square')
    expect(within(found).getByRole('img', { name: 'The plugin of this integration is disabled.' })).toBeInTheDocument()
    expect(within(found).getByText('The plugin of this integration is disabled, so syncing is paused.')).toBeInTheDocument()
    expect(within(found).getByText('The plugin of this integration is disabled or uninstalled.')).toBeInTheDocument()
    expect(within(found).getByRole('button', { name: 'Sync menu' })).toBeDisabled()
    expect(within(found).queryByRole('button', { name: 'Setup' })).toBeNull()
    expect(within(found).queryByRole('button', { name: 'General settings' })).toBeNull()
    expect(within(found).getByRole('button', { name: 'Logs' })).toBeEnabled() // the API's own logs stay
  })

  it('a plugin without the hook of a sync says it does not support it', () => {
    mountWith({ link: { setup_status: 'success' }, plugin: { hooks: [{ hook: 'sync_menu' }] } })
    const found = card('Square')
    expect(within(found).getByRole('button', { name: 'Sync menu' })).toBeEnabled()
    expect(within(found).getByRole('button', { name: 'Sync business' })).toBeDisabled()
    expect(within(found).getByText('Sync business: This integration does not support it.')).toBeInTheDocument()
  })

  it('the reserved links of a plugin (launch, connection_status, setup) are not page buttons', () => {
    mountWith({ link: { setup_status: 'success' }, plugin: { links: { launch: '/launch', connection_status: '/status', setup: '/setup', general_settings: '/general' } } })
    const found = card('Square')
    expect(within(found).getByRole('button', { name: 'General settings' })).toBeInTheDocument()
    for (const name of ['Launch', 'Connection status']) expect(within(found).queryByRole('button', { name })).toBeNull()
  })

  it('a plugin with links.launch opens the one-time URL it returns, without the session token in it', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { url: '/wizard?code=one-time' } }) })
    vi.stubGlobal('fetch', fetchSpy)
    mountWith({ link: { setup_status: 'success' }, plugin: { links: { launch: '/launch', general_settings: '/general' } } })
    await user.click(within(card('Square')).getByRole('button', { name: 'Setup' }))
    const dialog = await screen.findByRole('dialog', { name: 'Square' })
    await waitFor(() => expect(within(dialog).getByTitle('Square')).toHaveAttribute('src', 'https://square.example/wizard?code=one-time'))
    const [url, request] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://square.example/launch')
    expect(request.headers.Authorization).toBe('Bearer tok-1')
    expect(JSON.parse(request.body)).toMatchObject({ page: 'setup', business_id: 7 })
  })

  it('closing a plugin page reads the store and the integrations again', async () => {
    const user = userEvent.setup()
    mountWith({ link: { setup_status: 'success' } })
    await user.click(within(card('Square')).getByRole('button', { name: 'General settings' }))
    const dialog = await screen.findByRole('dialog', { name: 'Square' })
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Square' })).toBeNull())
    expect(mocks.state.updateBusiness).toHaveBeenCalledTimes(1)
    expect(spies.getIntegrations).toHaveBeenCalledTimes(1)
  })

  it('a setup_finished message from the page reads the store again and says it in a toast', async () => {
    const user = userEvent.setup()
    mountWith({ link: { setup_status: 'success' } })
    await user.click(within(card('Square')).getByRole('button', { name: 'General settings' }))
    const frame = within(await screen.findByRole('dialog', { name: 'Square' })).getByTitle('Square')
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        source: frame.contentWindow,
        origin: 'https://square.example',
        data: { type: 'ordering:plugin', event: 'setup_finished', status: 'success', business_id: 7 }
      }))
    })
    expect(mocks.state.updateBusiness).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Square connected.')
  })

  // review r1: main never paints a link whose catalog entry has no plugin; the redesign does
  it('a POS whose catalog entry carries no plugin warns of nothing and keeps Sync (PM-15, PM-18)', () => {
    const store = storeWithLink({ setup_status: 'success' })
    mocks.state = buildState({ businessState: { loading: false, error: null, business: store } })
    render(<Host business={store} integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [{ ...square, plugin: null, plugin_id: null }, clover] }} />)
    const found = card('Square')
    expect(within(found).queryByRole('img', { name: /plugin/ })).toBeNull()
    expect(within(found).getByRole('button', { name: 'Sync menu' })).toBeEnabled()
    expect(within(found).queryByText('The plugin of this integration is disabled or uninstalled.')).toBeNull()
  })

  it('a plugin whose install failed says the reason of the API under the state (main #399)', () => {
    mountWith({ link: { setup_status: 'success' }, plugin: { install_status: 'failed', install_message: 'Missing webhook scope' } })
    expect(within(card('Square')).getByText('Missing webhook scope')).toBeInTheDocument()
  })

  it('the confirmation of a sync says what it brings from the POS (main #394)', async () => {
    const user = userEvent.setup()
    mountWith({ link: { setup_status: 'success' } })
    await user.click(within(card('Square')).getByRole('button', { name: 'Sync business' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Name, address, schedule and settings from the POS.')).toBeInTheDocument()
  })

  it('a POS shows its external id as its POS location ID', () => {
    mountWith({ link: { setup_status: 'success', external_id: 'LOC-1' } })
    expect(within(card('Square')).getByText('POS location ID')).toBeInTheDocument()
    expect(within(card('Square')).getByText('LOC-1')).toBeInTheDocument()
  })
})
