/* eslint-disable import/first */
// redesign DS-B3 (decisions 1, 2, 5, 7, 17 | M-DS6, M-DS11, M-DS13, M-DS21, M-DS22, M-DS30): the provider panel, a RecordPanel with
// sections, in place of C/N/DeliveryServiceDetails. The controller (K/DeliveryServiceDetails, with the contract of lot B1), SettingsList
// (the hub-mode one is covered by CredentialsSection.test.jsx), the legacy sections and the zones are stubs that record the props the
// panel gives them; the Product wrappers (RecordPanel, SectionNav, AsyncSwitch, Status, Dialog, AlertDialog, Button) are the real ones.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import React, { useRef, useState } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  splitMode: 'split',
  deliveryServiceState: null,
  changesState: {},
  actionState: { loading: false, error: null },
  pluginState: { configs: [], loading: false, error: null },
  availableModifyData: true,
  controllerProps: null,
  controllerMounts: 0,
  rerender: null,
  handleUpdateDeliveryGroup: null,
  handleChangesState: null,
  setAvailableModifyData: null,
  reloadPluginInformation: null,
  sections: {},
  zonesProps: null,
  scheduleProps: null,
  scheduleMounts: 0,
  settingsListProps: null,
  hub: null
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../Shared/Product/SplitView', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useSplitView: () => ({ ...actual.useSplitView(), mode: mocks.splitMode }) }
})
vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const Controller = (props) => {
    const { UIComponent } = props
    React.useEffect(() => { mocks.controllerMounts += 1 }, [])
    const [, rerender] = React.useReducer(count => count + 1, 0)
    mocks.rerender = rerender
    mocks.controllerProps = props
    return (
      <UIComponent
        {...props}
        deliveryServiceState={mocks.deliveryServiceState}
        changesState={mocks.changesState}
        actionState={mocks.actionState}
        pluginState={mocks.pluginState}
        availableModifyData={mocks.availableModifyData}
        setAvailableModifyData={mocks.setAvailableModifyData}
        handleUpdateDeliveryGroup={mocks.handleUpdateDeliveryGroup}
        handleChangesState={mocks.handleChangesState}
        reloadPluginInformation={mocks.reloadPluginInformation}
        selectedBusinessIds={[]}
        selectedPaymethodIds={[]}
      />
    )
  }
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useSession: () => [{ token: 'session-token' }],
    useApi: () => [{ project: 'orderingv1' }],
    DeliveryServiceDetails: Controller
  }
})

// The credentials fields: the hub provider is the context the section gives; `report` is what a dirty form says
vi.mock('../../../Settings', async () => {
  const { useSettingsHubForm } = await import('../../../Settings/SettingsHubForm/SettingsHubFormContext')
  return {
    SettingsList: (props) => {
      mocks.settingsListProps = props
      const hub = useSettingsHubForm()
      mocks.hub = hub
      return (
        <div data-testid='settings-list'>
          <button type='button' onClick={() => hub.report('uber_direct', { dirty: true, saving: false })}>edit credentials</button>
          <button type='button' onClick={() => hub.report('uber_direct', { dirty: false, saving: false })}>revert credentials</button>
        </div>
      )
    }
  }
})
vi.mock('../../DriversGroupsLogisticsService', () => ({
  DriversGroupsLogisticsService: (props) => {
    mocks.sections.logistics = props
    return <div data-testid='logistics' />
  }
}))
vi.mock('../../DeliveryServiceDetails/DoordashContent', async (importOriginal) => ({
  hasSetupGuide: (await importOriginal()).hasSetupGuide,
  DoordashContent: (props) => <div data-testid='guide-content'>guide for {props.pluginKey}</div>
}))
vi.mock('../../DeliveryServicesBusinesses', () => ({
  DeliveryServiceBusinesses: (props) => {
    mocks.sections.businesses = props
    return <div data-testid='businesses'><input aria-label='businesses draft' /></div>
  }
}))
vi.mock('../../DeliveryServicePaymethods', () => ({
  DeliveryServicePaymethods: (props) => {
    mocks.sections.paymethods = props
    return <div data-testid='paymethods'><input aria-label='paymethods draft' /></div>
  }
}))
// the schedule is P/ScheduleEditor (the barrel re-exports this file, so the mock reaches the panel's import)
vi.mock('../../../Shared/Product/ScheduleEditor', () => ({
  ScheduleEditor: (props) => {
    mocks.scheduleProps = props
    React.useEffect(() => { mocks.scheduleMounts += 1 }, [])
    return (
      <div data-testid='schedule'>
        <button type='button' onClick={() => props.handleChangeScheduleState([{ lapses: ['edited'] }])}>edit schedule</button>
        {/* the change detection of the real Schedule (C/Schedule): a state different from `scheduleList` is reported, an equal one is not */}
        <button
          type='button'
          onClick={() => { if (JSON.stringify(schedule) !== JSON.stringify(props.scheduleList)) props.handleChangeScheduleState(schedule) }}
        >
          revert schedule
        </button>
      </div>
    )
  }
}))
vi.mock('../../../Shared/DeliveryZones/GroupZones', () => ({
  GroupZones: (props) => {
    mocks.zonesProps = props
    return (
      <div data-testid='delivery_zones'>
        <button type='button' onClick={() => props.onDirtyChange(true)}>dirty zones</button>
        <button type='button' onClick={() => props.onDirtyChange(false)}>clean zones</button>
      </div>
    )
  }
}))

import { ProviderPanel } from '../ProviderPanel'

// the stylesheets, without comments, to pin the rules jsdom cannot measure
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const panelCss = stripComments(readFileSync(path.join(__dirname, '..', 'provider-panel.css'), 'utf8'))
const tableCss = stripComments(readFileSync(path.join(__dirname, '..', 'providers-table.css'), 'utf8'))

const plugin = { id: 7, key: 'uber_direct_integration', setup_url: 'https://setup.example.com/start', root: 'https://plugin.example.com', links: '{"info_setup":"/info"}' }
const schedule = [{ enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }] }]
const company = {
  id: 22,
  name: 'Uber Direct',
  enabled: true,
  plugin_id: 7,
  plugin,
  schedule,
  driver_groups: [{ id: 975001 }]
}
const group = {
  id: 975001,
  name: 'Driver Group: Uber Direct',
  enabled: true,
  business: [{ id: 3 }],
  plugin,
  schedule
}
const fullGroup = { id: 975001, name: 'Driver Group: Uber Direct', enabled: true, orders_group_start_in_status: 7 }
const otherCompany = { ...company, id: 23, name: 'Shipday', driver_groups: [{ id: 975002 }] }
const otherGroup = { ...group, id: 975002, name: 'Driver Group: Shipday' }

let spies
let panelRef

const pageProps = () => ({
  company,
  curDriversGroup: group,
  deliveryServiceId: 22,
  driverGroupId: 975001,
  deliveryServicesState: { companies: [company], loading: false },
  setDeliveryServicesState: vi.fn(),
  scheduleState: { loading: false, change: null, companyId: null },
  deliveryGroups: { groups: [fullGroup], loading: false },
  setDeliveryGroups: vi.fn(),
  businesses: [{ id: 3 }],
  businessesLoading: false,
  paymethods: [{ id: 4 }],
  handleUpdateDeliveryService: spies.handleUpdateDeliveryService,
  handleScheduleState: spies.handleScheduleState,
  resetScheduleState: spies.resetScheduleState,
  status: 'active',
  statusLabel: 'Active',
  statusFamily: 'done',
  onClose: spies.onClose,
  onDirtyChange: spies.onDirtyChange
})

const Host = ({ initial = 'general', ...props }) => {
  const [section, setSection] = useState(initial)
  const [expanded, setExpanded] = useState(false)
  panelRef = useRef(null)
  return (
    <ProviderPanel
      {...pageProps()}
      section={section}
      onSectionChange={(id) => { spies.onSectionChange(id); setSection(id) }}
      expanded={expanded}
      onToggleExpanded={() => { spies.onToggleExpanded(); setExpanded(value => !value) }}
      panelRef={panelRef}
      {...props}
    />
  )
}

const failWith = (error) => {
  mocks.actionState = { loading: false, error }
  mocks.rerender()
  return { ok: false, error }
}

beforeEach(() => {
  window.localStorage.setItem('project', 'orderingv1')
  mocks.splitMode = 'split'
  mocks.deliveryServiceState = { deliveryService: group, loading: false, error: null }
  mocks.changesState = {}
  mocks.actionState = { loading: false, error: null }
  mocks.pluginState = { configs: [{ id: 101, key: 'uber_direct_client_id', value: 'abc' }], loading: false, error: null }
  mocks.availableModifyData = true
  mocks.controllerProps = null
  mocks.controllerMounts = 0
  mocks.handleUpdateDeliveryGroup = vi.fn().mockResolvedValue({ ok: true })
  mocks.handleChangesState = vi.fn()
  mocks.setAvailableModifyData = vi.fn()
  mocks.reloadPluginInformation = vi.fn()
  mocks.sections = {}
  mocks.zonesProps = null
  mocks.scheduleProps = null
  mocks.scheduleMounts = 0
  mocks.settingsListProps = null
  mocks.hub = null
  spies = {
    handleUpdateDeliveryService: vi.fn().mockResolvedValue({ ok: true }),
    handleScheduleState: vi.fn(),
    resetScheduleState: vi.fn(),
    onSectionChange: vi.fn(),
    onToggleExpanded: vi.fn(),
    onClose: vi.fn(),
    onDirtyChange: vi.fn()
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
  window.localStorage.removeItem('project')
  vi.restoreAllMocks()
})

const nav = () => screen.getByRole('navigation', { name: 'Provider settings' })
const row = (name) => within(nav()).getByRole('button', { name: new RegExp(`^${name}`) })
const navLabels = () => [...nav().querySelectorAll('.odc-sectionnav-label')].map(node => node.textContent)
const toggle = (name = 'Enable Uber Direct') => screen.getByRole('switch', { name })

describe('ProviderPanel wiring to the controller', () => {
  it('mounts K/DeliveryServiceDetails with the props main gave it, its own UIComponent and the project code', () => {
    render(<Host />)
    const props = mocks.controllerProps
    expect(typeof props.UIComponent).toBe('function')
    expect(props.deliveryServiceId).toBe(22)
    expect(props.driverGroupId).toBe(975001)
    expect(props.curDriversGroup).toBe(group)
    expect(props.deliveryServicesState).toEqual({ companies: [company], loading: false })
    expect(props.scheduleState).toEqual({ loading: false, change: null, companyId: null })
    expect(props.businesses).toEqual([{ id: 3 }])
    expect(props.businessesLoading).toBe(false)
    expect(props.paymethods).toEqual([{ id: 4 }])
    expect(props.handleUpdateDeliveryService).toBe(spies.handleUpdateDeliveryService)
    expect(props.handleScheduleState).toBe(spies.handleScheduleState)
    expect(props.deliveryGroups).toEqual({ groups: [fullGroup], loading: false })
    expect(typeof props.setDeliveryGroups).toBe('function')
    expect(props.projectCode).toBe('orderingv1')
  })

  it('a new provider mounts the controller again, so each one starts clean', () => {
    const view = render(<Host />)
    expect(mocks.controllerMounts).toBe(1)
    mocks.deliveryServiceState = { deliveryService: otherGroup, loading: false, error: null }
    view.rerender(<Host company={otherCompany} curDriversGroup={otherGroup} deliveryServiceId={23} driverGroupId={975002} />)
    expect(mocks.controllerMounts).toBe(2)
  })

  it('gives the legacy sections the page props and the group, as main did with {...props}', async () => {
    render(<Host initial='businesses' />)
    expect(mocks.sections.businesses).toMatchObject({
      businesses: [{ id: 3 }],
      businessesLoading: false,
      curDeliveryService: group
    })
    expect(mocks.sections.businesses.deliveryServiceState.deliveryService).toBe(group)
    // redesign DS-R1-02: the panel wraps the controller's save (to tell the page when `business` was saved); it still is that save
    await mocks.sections.businesses.handleUpdateDeliveryGroup({ allowed_paymethods: '[4]' })
    expect(mocks.handleUpdateDeliveryGroup).toHaveBeenCalledWith({ allowed_paymethods: '[4]' })
  })

  it('does not hand the sections the panel-only props', () => {
    render(<Host initial='businesses' />)
    for (const name of ['section', 'onSectionChange', 'panelRef', 'expanded', 'onToggleExpanded', 'onDirtyChange', 'onStoresChanged', 'company', 'status', 'statusLabel', 'statusFamily', 'resetScheduleState', 'UIComponent']) {
      expect(mocks.sections.businesses, name).not.toHaveProperty(name)
    }
  })

  it('Payment methods gets the same', () => {
    render(<Host initial='paymethods' />)
    expect(mocks.sections.paymethods).toMatchObject({ paymethods: [{ id: 4 }], curDeliveryService: group })
  })
})

describe('ProviderPanel header (decisions 1 and 7 | M-DS6)', () => {
  it('the title is the name of the provider, not «Driver Group: …»', () => {
    render(<Host />)
    expect(screen.getByRole('heading', { name: 'Uber Direct' })).toBeInTheDocument()
    expect(screen.queryByText(/Driver Group:/)).toBeNull()
  })

  it('the subtitle is #id · group #n with the figures in .odc-figure', () => {
    render(<Host />)
    const subtitle = document.querySelector('.odc-record-subtitle')
    expect(subtitle).toHaveTextContent('#22 · group #975001')
    expect([...subtitle.querySelectorAll('.odc-figure')].map(node => node.textContent)).toEqual(['#22', 'group #975001'])
  })

  it('a provider without a name is titled by its id, as the list does, not an empty title', () => {
    render(<Host company={{ ...company, name: '  ' }} />)
    expect(screen.getByRole('heading', { name: '#22' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enable #22' })).toBeInTheDocument()
  })

  it('shows the status the page computed, with its family', () => {
    render(<Host statusLabel='Credentials incomplete' statusFamily='review' />)
    const status = document.querySelector('.odc-record-status .odc-status')
    expect(status).toHaveTextContent('Credentials incomplete')
    expect(status).toHaveAttribute('data-family', 'review')
  })

  it('without a status from the page it paints none (and still the switch)', () => {
    render(<Host status={undefined} statusLabel={undefined} statusFamily={undefined} />)
    expect(document.querySelector('.odc-record-status .odc-status')).toBeNull()
    expect(toggle()).toBeInTheDocument()
  })

  it('the switch is named after the provider and reads the company', () => {
    render(<Host />)
    expect(toggle()).toBeChecked()
    cleanup()
    render(<Host company={{ ...company, enabled: false }} />)
    expect(toggle()).not.toBeChecked()
  })

  it('reads the company, not the group: a paused group does not move it (M-DS6)', () => {
    mocks.deliveryServiceState = { deliveryService: { ...group, enabled: false }, loading: false, error: null }
    render(<Host curDriversGroup={{ ...group, enabled: false }} />)
    expect(toggle()).toBeChecked()
  })

  it('writes the company: {enabled} on the id of the company, and never on the group', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(toggle())
    expect(spies.handleUpdateDeliveryService).toHaveBeenCalledTimes(1)
    expect(spies.handleUpdateDeliveryService).toHaveBeenCalledWith(22, { enabled: false })
    expect(mocks.handleUpdateDeliveryGroup).not.toHaveBeenCalled()
  })

  // redesign D-5 (owner, 2026-10-19): pausing asks first (the page's question); resuming stays one click
  it('pausing asks the page first with THE COMPANY: nothing is written, and the switch does not look flipped, while it is open', async () => {
    const user = userEvent.setup()
    let answer
    const confirmPause = vi.fn(() => new Promise(resolve => { answer = resolve }))
    render(<Host confirmPause={confirmPause} />)
    await user.click(toggle())
    expect(confirmPause).toHaveBeenCalledTimes(1)
    expect(confirmPause).toHaveBeenCalledWith(expect.objectContaining({ id: 22, name: 'Uber Direct' }))
    expect(spies.handleUpdateDeliveryService).not.toHaveBeenCalled()
    expect(toggle()).toBeChecked()
    expect(toggle()).not.toHaveAttribute('aria-busy')
    await act(async () => { answer(true) })
    await waitFor(() => expect(spies.handleUpdateDeliveryService).toHaveBeenCalledWith(22, { enabled: false }))
  })

  it('a «no» to the question writes nothing and leaves the switch where it was', async () => {
    const user = userEvent.setup()
    const confirmPause = vi.fn(() => Promise.resolve(false))
    render(<Host confirmPause={confirmPause} />)
    await user.click(toggle())
    await waitFor(() => expect(confirmPause).toHaveBeenCalledTimes(1))
    expect(spies.handleUpdateDeliveryService).not.toHaveBeenCalled()
    expect(toggle()).toBeChecked()
  })

  it('resuming never asks: it is written at once', async () => {
    const user = userEvent.setup()
    const confirmPause = vi.fn(() => Promise.resolve(false))
    render(<Host company={{ ...company, enabled: false }} confirmPause={confirmPause} />)
    await user.click(toggle())
    await waitFor(() => expect(spies.handleUpdateDeliveryService).toHaveBeenCalledWith(22, { enabled: true }))
    expect(confirmPause).not.toHaveBeenCalled()
  })

  it('confirmPause is the panel\'s, not the sections\'', () => {
    render(<Host initial='businesses' confirmPause={vi.fn()} />)
    expect(mocks.sections.businesses).not.toHaveProperty('confirmPause')
  })

  it('a switch that fails does not move and says why below it', async () => {
    const user = userEvent.setup()
    spies.handleUpdateDeliveryService.mockResolvedValue({ ok: false, error: ['The provider rejected the change'] })
    render(<Host />)
    await user.click(toggle())
    expect(await screen.findByRole('alert')).toHaveTextContent('The provider rejected the change')
    expect(toggle()).toBeChecked()
  })

  it('a paused group says so in a line and writes nothing to the group', () => {
    mocks.deliveryServiceState = { deliveryService: { ...group, enabled: false }, loading: false, error: null }
    render(<Host curDriversGroup={{ ...group, enabled: false }} />)
    expect(screen.getByText('Group paused in Delivery groups')).toBeInTheDocument()
    expect(mocks.handleUpdateDeliveryGroup).not.toHaveBeenCalled()
    expect(spies.handleUpdateDeliveryService).not.toHaveBeenCalled()
  })

  it.each([[true], [undefined], [null]])('a group with enabled %s has no such line', (enabled) => {
    mocks.deliveryServiceState = { deliveryService: { ...group, enabled }, loading: false, error: null }
    render(<Host curDriversGroup={{ ...group, enabled }} />)
    expect(screen.queryByText('Group paused in Delivery groups')).toBeNull()
  })

  it('actionDisabled disables the switch for real', () => {
    render(<Host actionDisabled />)
    expect(toggle()).toBeDisabled()
  })
})

describe('ProviderPanel header actions', () => {
  it('has Open as page / Back to split view and nothing else (no Learn, no menu)', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(screen.queryByRole('button', { name: 'Learn' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Actions' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(spies.onToggleExpanded).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Back to split view' })).toBeInTheDocument()
  })

  it('there is no Open as page on a phone or without a page that can toggle', () => {
    mocks.splitMode = 'full'
    const { unmount } = render(<Host />)
    expect(screen.queryByRole('button', { name: 'Open as page' })).toBeNull()
    unmount()
    mocks.splitMode = 'split'
    render(<Host onToggleExpanded={undefined} />)
    expect(screen.queryByRole('button', { name: 'Open as page' })).toBeNull()
  })

  it('the close button is Close, and Back on a phone', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    unmount()
    mocks.splitMode = 'full'
    render(<Host />)
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })
})

describe('ProviderPanel sections (decisions 1 and 5 | M-DS22)', () => {
  it('has the five sections of main in a SectionNav named «Provider settings», Credentials first', () => {
    render(<Host />)
    expect(navLabels()).toEqual(['Credentials', 'Businesses', 'Schedule', 'Payment methods', 'Delivery zones'])
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(row('Credentials')).toHaveAttribute('aria-current', 'page')
  })

  it('opens in Credentials', () => {
    render(<Host />)
    expect(screen.getByTestId('settings-list')).toBeInTheDocument()
    expect(screen.queryByTestId('businesses')).toBeNull()
  })

  it('with the credentials incomplete the other four are disabled and say why', () => {
    mocks.availableModifyData = false
    render(<Host />)
    expect(row('Credentials')).toBeEnabled()
    for (const name of ['Businesses', 'Schedule', 'Payment methods', 'Delivery zones']) {
      expect(row(name)).toBeDisabled()
      expect(row(name)).toHaveTextContent('Complete the credentials first')
    }
  })

  it('a disabled section cannot be opened', async () => {
    const user = userEvent.setup()
    mocks.availableModifyData = false
    render(<Host />)
    await user.click(row('Businesses'))
    expect(spies.onSectionChange).not.toHaveBeenCalled()
    expect(screen.queryByTestId('businesses')).toBeNull()
  })

  it('with the credentials complete nothing is disabled and no reason is painted', () => {
    render(<Host />)
    for (const name of ['Credentials', 'Businesses', 'Schedule', 'Payment methods', 'Delivery zones']) {
      expect(row(name)).toBeEnabled()
    }
    expect(within(nav()).queryByText('Complete the credentials first')).toBeNull()
  })

  it('a known ?tab= opens that section, and one that is disabled opens Credentials', () => {
    render(<Host initial='schedule' />)
    expect(row('Schedule')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('schedule')).toBeInTheDocument()
    cleanup()
    mocks.availableModifyData = false
    render(<Host initial='schedule' />)
    expect(row('Credentials')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByTestId('schedule')).toBeNull()
    expect(screen.getByTestId('settings-list')).toBeInTheDocument()
  })

  it('an unknown ?tab= is Credentials', () => {
    render(<Host initial='nope' />)
    expect(row('Credentials')).toHaveAttribute('aria-current', 'page')
  })

  it('a ?tab= that was disabled opens its section once the credentials are complete', () => {
    mocks.availableModifyData = false
    render(<Host initial='paymethods' />)
    expect(row('Credentials')).toHaveAttribute('aria-current', 'page')
    mocks.availableModifyData = true
    act(() => mocks.rerender())
    expect(row('Payment methods')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('paymethods')).toBeInTheDocument()
  })

  // the address says the section the person sees. main rewrote an unknown or blocked ?tab= to `general`; the panel resolves it
  // (resolveSection) and tells the page, which writes it with replaceState (no history entry)
  it('an unknown ?tab= is written back as the section that shows (Credentials)', () => {
    render(<Host initial='bogus' />)
    expect(row('Credentials')).toHaveAttribute('aria-current', 'page')
    expect(spies.onSectionChange).toHaveBeenCalledTimes(1)
    expect(spies.onSectionChange).toHaveBeenCalledWith('general')
  })

  it('a blocked ?tab= waits for the credentials to say they are incomplete, then is written back as Credentials', () => {
    mocks.availableModifyData = false
    render(<Host initial='businesses' />)
    // the credentials have not reported yet: Businesses may be unlocked in a moment, so the address is left alone
    expect(spies.onSectionChange).not.toHaveBeenCalled()
    act(() => mocks.settingsListProps.setAvailableModifyData(false))
    expect(mocks.setAvailableModifyData).toHaveBeenCalledWith(false) // the report still reaches the controller
    expect(spies.onSectionChange).toHaveBeenCalledTimes(1)
    expect(spies.onSectionChange).toHaveBeenCalledWith('general')
  })

  it('a ?tab= that the credentials unlock is kept: the address is not touched', () => {
    mocks.availableModifyData = false
    render(<Host initial='schedule' />)
    mocks.availableModifyData = true
    act(() => {
      mocks.settingsListProps.setAvailableModifyData(true)
      mocks.rerender()
    })
    expect(row('Schedule')).toHaveAttribute('aria-current', 'page')
    expect(spies.onSectionChange).not.toHaveBeenCalled()
  })

  it('no ?tab= or the one that shows is not written', () => {
    render(<Host initial={undefined} />)
    render(<Host initial='general' />)
    expect(spies.onSectionChange).not.toHaveBeenCalled()
  })

  it('pressing a section asks the page for it', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(row('Businesses'))
    expect(spies.onSectionChange).toHaveBeenCalledWith('businesses')
    expect(screen.getByTestId('businesses')).toBeVisible()
  })

  it('is a list on a phone (390), one press per section, never the selector', async () => {
    const user = userEvent.setup()
    mocks.splitMode = 'full'
    const width = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(390)
    render(<Host />)
    expect(nav().parentElement).toHaveAttribute('data-mode', 'list')
    expect(within(nav()).queryByRole('button', { name: /Section/ })).toBeNull()
    await user.click(row('Schedule'))
    expect(spies.onSectionChange).toHaveBeenCalledWith('schedule')
    width.mockRestore()
  })

  it('each section gets what main gave it', () => {
    render(<Host initial='delivery_zones' />)
    expect(mocks.zonesProps.drivergroup).toBe(group)
  })
})

describe('ProviderPanel keeps visited sections (decision 1)', () => {
  it('mounts a section when it is visited, not before', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(screen.queryByTestId('businesses')).toBeNull()
    expect(screen.queryByTestId('schedule')).toBeNull()
    await user.click(row('Businesses'))
    expect(screen.getByTestId('businesses')).toBeInTheDocument()
    expect(screen.queryByTestId('schedule')).toBeNull()
  })

  it('keeps it, hidden, when the user goes elsewhere: a draft of Businesses is still there on the way back', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(row('Businesses'))
    await user.type(screen.getByLabelText('businesses draft'), 'half a thought')
    await user.click(row('Credentials'))
    expect(screen.getByTestId('businesses')).toBeInTheDocument()
    expect(screen.getByTestId('businesses')).not.toBeVisible()
    expect(screen.getByTestId('settings-list')).toBeVisible()
    await user.click(row('Businesses'))
    expect(screen.getByLabelText('businesses draft')).toHaveValue('half a thought')
    expect(screen.getByTestId('businesses')).toBeVisible()
  })

  it('keeps the credentials too: their form is not lost when the user visits Schedule', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'edit credentials' }))
    await user.click(row('Schedule'))
    expect(screen.getByTestId('settings-list')).toBeInTheDocument()
    expect(screen.getByTestId('settings-list')).not.toBeVisible()
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('another provider starts with nothing visited and no draft', async () => {
    const user = userEvent.setup()
    const view = render(<Host />)
    await user.click(row('Businesses'))
    await user.type(screen.getByLabelText('businesses draft'), 'draft')
    mocks.deliveryServiceState = { deliveryService: otherGroup, loading: false, error: null }
    view.rerender(<Host company={otherCompany} curDriversGroup={otherGroup} deliveryServiceId={23} driverGroupId={975002} />)
    expect(screen.getByLabelText('businesses draft')).toHaveValue('')
    expect(screen.getByRole('heading', { name: 'Shipday' })).toBeInTheDocument()
  })
})

describe('ProviderPanel Schedule (decision 1 | M-DS11)', () => {
  it('draws the schedule of the provider and tells the page which provider a change is for', async () => {
    const user = userEvent.setup()
    render(<Host initial='schedule' />)
    expect(mocks.scheduleProps.scheduleList).toBe(schedule)
    // P/ScheduleEditor, with the shared schedule labels (seven days, already translated)
    expect(mocks.scheduleProps.labels.days).toHaveLength(7)
    expect(mocks.scheduleProps.labels.addHours).toEqual(expect.any(String))
    await user.click(screen.getByRole('button', { name: 'edit schedule' }))
    expect(spies.handleScheduleState).toHaveBeenCalledWith([{ lapses: ['edited'] }], 22)
  })

  it('Update is disabled with nothing changed (M-DS11 a)', () => {
    render(<Host initial='schedule' />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
  })

  it('Update is disabled when the change in the state is another provider\'s (M-DS11 b)', () => {
    render(<Host initial='schedule' scheduleState={{ loading: false, change: [{ lapses: [] }], companyId: 99 }} />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
  })

  it('Update is disabled when the state has a change with no provider', () => {
    render(<Host initial='schedule' scheduleState={{ loading: false, change: [{ lapses: [] }], companyId: null }} />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
  })

  it('Update is enabled with a change of this provider and sends it as main did', async () => {
    const user = userEvent.setup()
    const change = [{ enabled: true, lapses: ['x'] }]
    render(<Host initial='schedule' scheduleState={{ loading: false, change, companyId: 22 }} />)
    const update = screen.getByRole('button', { name: 'Update' })
    expect(update).toBeEnabled()
    expect(update).toHaveAttribute('data-variant', 'primary')
    await user.click(update)
    expect(spies.handleUpdateDeliveryService).toHaveBeenCalledTimes(1)
    expect(spies.handleUpdateDeliveryService).toHaveBeenCalledWith(22, { schedule: JSON.stringify(change) })
  })

  it('an empty change list of this provider is still a change (it clears the schedule), not null', () => {
    render(<Host initial='schedule' scheduleState={{ loading: false, change: [], companyId: 22 }} />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled()
  })

  it('is busy while it saves and does not send twice', async () => {
    const user = userEvent.setup()
    render(<Host initial='schedule' scheduleState={{ loading: true, change: [{ lapses: [] }], companyId: 22 }} />)
    const update = screen.getByRole('button', { name: 'Update' })
    expect(update).toHaveAttribute('aria-busy', 'true')
    await user.click(update)
    expect(spies.handleUpdateDeliveryService).not.toHaveBeenCalled()
  })

  it('actionDisabled disables Update for real', () => {
    render(<Host initial='schedule' actionDisabled scheduleState={{ loading: false, change: [{ lapses: [] }], companyId: 22 }} />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
  })
})

describe('ProviderPanel Credentials (decision 2)', () => {
  it('gives SettingsList the configs of the plugin and the hub mode, without the groups nor the pending changes', () => {
    render(<Host />)
    const props = mocks.settingsListProps
    expect(props.staticConfigs).toBe(mocks.pluginState.configs)
    expect(props.isRemoveGeneralTitle).toBe(true)
    // the panel listens to the report (to know when the credentials said), so it is a wrapper that still reaches the controller
    act(() => props.setAvailableModifyData(true))
    expect(mocks.setAvailableModifyData).toHaveBeenCalledWith(true)
    expect(props.onCloseSettingsList()).toBeNull()
    for (const name of ['deliveryGroups', 'changesState', 'handleChangesState']) {
      expect(props, name).not.toHaveProperty(name)
    }
    expect(mocks.hub).toMatchObject({ product: true })
    expect(typeof mocks.hub.report).toBe('function')
  })

  it('shows the unlock notice while the credentials are incomplete', () => {
    mocks.availableModifyData = false
    render(<Host />)
    expect(screen.getByText('Fill in every field below to unlock Businesses, Schedule, Payment methods and Delivery zones.')).toBeInTheDocument()
  })

  it('has the tour anchor and no form', () => {
    render(<Host />)
    const root = document.querySelector('[data-tour="tour_fill_group"]')
    expect(root).not.toBeNull()
    expect(root.querySelector('form')).toBeNull()
  })

  it('the automatic assignment block gets the group and the pending changes, and sits outside SettingsList', () => {
    mocks.changesState = { orders_group_start_in_status: 4 }
    render(<Host />)
    expect(screen.getByRole('heading', { name: 'Automatic assignment' })).toBeInTheDocument()
    expect(mocks.sections.logistics.curDriversGroup).toBe(fullGroup)
    expect(mocks.sections.logistics.changesState).toEqual({ orders_group_start_in_status: 4 })
    expect(screen.getByTestId('settings-list').contains(screen.getByTestId('logistics'))).toBe(false)
  })

  it('saves on change only the autoassignment keys (M-DS13)', () => {
    mocks.changesState = { business: '[3]', autoassign_autoassign_driver: true }
    render(<Host />)
    expect(mocks.handleUpdateDeliveryGroup).toHaveBeenCalledTimes(1)
    expect(mocks.handleUpdateDeliveryGroup).toHaveBeenCalledWith({ autoassign_autoassign_driver: true })
  })

  it('does not save a pending Businesses or Payment methods from the Credentials section (M-DS13)', () => {
    mocks.changesState = { business: '[3]', allowed_paymethods: '[4]' }
    render(<Host />)
    expect(mocks.handleUpdateDeliveryGroup).not.toHaveBeenCalled()
  })

  it('while the credentials load there are skeletons, and a failure has Retry', async () => {
    const user = userEvent.setup()
    mocks.pluginState = { configs: null, loading: true, error: null }
    render(<Host />)
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    cleanup()
    mocks.pluginState = { configs: null, loading: false, error: ['no network'] }
    render(<Host />)
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' }))
    expect(mocks.reloadPluginInformation).toHaveBeenCalledTimes(1)
  })

  it('the setup guide opens a dialog titled Setup guide (main )', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Setup guide' }))
    expect(await screen.findByRole('dialog', { name: 'Setup guide' })).toBeInTheDocument()
  })

  it('Start Setup has the href of main with the id of the company', () => {
    render(<Host />)
    expect(screen.getByRole('link', { name: 'Start Setup' })).toHaveAttribute(
      'href',
      'https://setup.example.com/start?project_code=orderingv1&access_token=session-token&driver_company_id=22'
    )
  })
})

describe('ProviderPanel Delivery zones', () => {
  it('mounts the shared zones with the group of the provider, the name of the provider and the guard texts', () => {
    render(<Host initial='delivery_zones' />)
    expect(mocks.zonesProps.drivergroup).toBe(group)
    expect(mocks.zonesProps.name).toBe('Uber Direct')
    expect(mocks.zonesProps.discardTexts).toEqual({
      discardTitle: 'Discard your changes?',
      discardDescription: 'What you changed here is not saved yet.',
      discardConfirmLabel: 'Discard',
      keepEditingLabel: 'Keep editing'
    })
    expect(mocks.zonesProps.actionDisabled).toBeUndefined()
    expect(typeof mocks.zonesProps.onDirtyChange).toBe('function')
  })

  it('passes actionDisabled', () => {
    render(<Host initial='delivery_zones' actionDisabled />)
    expect(mocks.zonesProps.actionDisabled).toBe(true)
  })
})

describe('ProviderPanel discard guard (decision 17 | M-DS30)', () => {
  const askToClose = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Close' }))
    return screen.findByRole('alertdialog')
  }

  it('closes straight away when nothing is pending, and says it is clean', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('credentials in the form (the report of SettingsList) turn the guard on and tell the page', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'edit credentials' }))
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    const dialog = await askToClose(user)
    expect(within(dialog).getByRole('heading', { name: 'Discard your changes?' })).toBeInTheDocument()
    expect(within(dialog).getByText('What you changed here is not saved yet.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument()
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('and off again when the form goes back to clean', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'edit credentials' }))
    await user.click(screen.getByRole('button', { name: 'revert credentials' }))
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it.each([
    ['a pending Businesses (business in changesState)', { business: '[3]' }],
    ['a pending Payment methods (allowed_paymethods in changesState)', { allowed_paymethods: '[4]' }],
    ['an empty pending Businesses (Select none: business "[]")', { business: '[]' }]
  ])('%s turns the guard on', async (_label, changes) => {
    const user = userEvent.setup()
    mocks.changesState = changes
    render(<Host />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(await askToClose(user)).toBeInTheDocument()
  })

  it('a pending autoassignment (it saves on its own) is not a draft', () => {
    mocks.changesState = { autoassign_autoassign_driver: true, orders_group_start_in_status: 4 }
    render(<Host />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('a schedule change of this provider turns the guard on (M-DS11)', async () => {
    const user = userEvent.setup()
    render(<Host scheduleState={{ loading: false, change: [{ lapses: [] }], companyId: 22 }} />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(await askToClose(user)).toBeInTheDocument()
  })

  it('a schedule change of another provider does not', () => {
    render(<Host scheduleState={{ loading: false, change: [{ lapses: [] }], companyId: 99 }} />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('unsaved zones (GroupZones onDirtyChange) turn the guard on, and off again', async () => {
    const user = userEvent.setup()
    render(<Host initial='delivery_zones' />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
    await user.click(screen.getByRole('button', { name: 'dirty zones' }))
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(await askToClose(user)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'clean zones' }))
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('Keep editing stays and changes nothing', async () => {
    const user = userEvent.setup()
    render(<Host scheduleState={{ loading: false, change: [{ lapses: [] }], companyId: 22 }} />)
    const dialog = await askToClose(user)
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(spies.onClose).not.toHaveBeenCalled()
    expect(spies.resetScheduleState).not.toHaveBeenCalled()
  })

  it('Discard closes and clears the schedule change the state kept', async () => {
    const user = userEvent.setup()
    render(<Host scheduleState={{ loading: false, change: [{ lapses: [] }], companyId: 22 }} />)
    const dialog = await askToClose(user)
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(spies.resetScheduleState).toHaveBeenCalledTimes(1)
  })

  it('the page can ask the same question before it opens another provider (panelRef.requestClose)', async () => {
    const user = userEvent.setup()
    mocks.changesState = { business: '[3]' }
    render(<Host />)
    const proceed = vi.fn()
    act(() => panelRef.current.requestClose(proceed))
    const dialog = await screen.findByRole('alertdialog')
    expect(proceed).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('whatever way the panel goes away with a schedule change of its own, it clears it (the page opened another provider)', () => {
    const view = render(<Host scheduleState={{ loading: false, change: [{ lapses: [] }], companyId: 22 }} />)
    expect(spies.resetScheduleState).not.toHaveBeenCalled()
    view.unmount()
    expect(spies.resetScheduleState).toHaveBeenCalledTimes(1)
  })

  it('and it does not touch a schedule change that is another provider\'s', () => {
    const view = render(<Host scheduleState={{ loading: false, change: [{ lapses: [] }], companyId: 99 }} />)
    view.unmount()
    expect(spies.resetScheduleState).not.toHaveBeenCalled()
  })

  it('tells the page it is clean when it goes away', () => {
    mocks.changesState = { business: '[3]' }
    const { unmount } = render(<Host />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('has no Discard button of its own in the panel (the guard is the dialog)', () => {
    mocks.changesState = { business: '[3]' }
    render(<Host />)
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
  })
})

describe('ProviderPanel actionDisabled', () => {
  it('puts the section inside an inert, aria-disabled container', () => {
    render(<Host actionDisabled />)
    const container = screen.getByTestId('settings-list').closest('[aria-disabled="true"]')
    expect(container).not.toBeNull()
    expect(container).toHaveAttribute('inert')
  })

  it('without actionDisabled nothing is inert', () => {
    render(<Host />)
    expect(screen.getByTestId('settings-list').closest('[inert]')).toBeNull()
    expect(screen.getByTestId('settings-list').closest('[aria-disabled]')).toBeNull()
  })
})

describe('ProviderPanel errors of the saves (actionState, as main)', () => {
  it('an error of a save is said in an alert called Ordering, with its text', async () => {
    mocks.actionState = { loading: false, error: ['The business is not available.'] }
    render(<Host />)
    const alert = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(within(alert).getByText('The business is not available.')).toBeInTheDocument()
  })

  it('closing it leaves the panel as it was', async () => {
    const user = userEvent.setup()
    mocks.actionState = { loading: false, error: ['The business is not available.'] }
    render(<Host />)
    const alert = await screen.findByRole('alertdialog')
    await user.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByTestId('settings-list')).toBeInTheDocument()
  })

  it('an error that arrives after the panel is open is said too', async () => {
    render(<Host />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    act(() => { failWith(['Late error']) })
    expect(await screen.findByRole('alertdialog', { name: 'Ordering' })).toHaveTextContent('Late error')
  })

  it('no error, no alert', async () => {
    render(<Host />)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('ProviderPanel while the provider is not there yet', () => {
  it('shows a skeleton and no sections', () => {
    mocks.deliveryServiceState = { deliveryService: null, loading: true, error: null }
    render(<Host curDriversGroup={undefined} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('navigation', { name: 'Provider settings' })).toBeNull()
  })
})

// ── redesign , review r1 ──

describe('ProviderPanel tells the page when the stores changed (DS-R1-02)', () => {
  const saveGroup = async (changes) => {
    let result
    await act(async () => { result = await mocks.sections.businesses.handleUpdateDeliveryGroup(changes) })
    return result
  }

  it('a good save of Businesses calls onStoresChanged once, after the save, and returns the controller\'s answer', async () => {
    const onStoresChanged = vi.fn()
    render(<Host initial='businesses' onStoresChanged={onStoresChanged} />)
    expect(await saveGroup({ business: '[3,4]' })).toEqual({ ok: true })
    expect(mocks.handleUpdateDeliveryGroup).toHaveBeenCalledWith({ business: '[3,4]' })
    expect(onStoresChanged).toHaveBeenCalledTimes(1)
  })

  it('the Credentials section\'s autoassignment and the other group saves do not (no store changed)', async () => {
    const onStoresChanged = vi.fn()
    render(<Host initial='businesses' onStoresChanged={onStoresChanged} />)
    await saveGroup({ orders_group_start_in_status: 4 })
    await saveGroup({ allowed_paymethods: '[4]' })
    expect(onStoresChanged).not.toHaveBeenCalled()
  })

  it('a Businesses save that failed does not (the row still tells the truth)', async () => {
    const onStoresChanged = vi.fn()
    mocks.handleUpdateDeliveryGroup.mockResolvedValue({ ok: false, error: ['nope'] })
    render(<Host initial='businesses' onStoresChanged={onStoresChanged} />)
    expect(await saveGroup({ business: '[3]' })).toEqual({ ok: false, error: ['nope'] })
    expect(onStoresChanged).not.toHaveBeenCalled()
  })

  it('Payment methods saves what is pending, so a pending Businesses in it counts too', async () => {
    const onStoresChanged = vi.fn()
    render(<Host initial='paymethods' onStoresChanged={onStoresChanged} />)
    await act(async () => { await mocks.sections.paymethods.handleUpdateDeliveryGroup({ business: '[3]', allowed_paymethods: '[4]' }) })
    expect(onStoresChanged).toHaveBeenCalledTimes(1)
  })

  it('works without onStoresChanged', async () => {
    render(<Host initial='businesses' />)
    expect(await saveGroup({ business: '[3]' })).toEqual({ ok: true })
  })
})

describe('ProviderPanel Schedule after a good Update (DS-R1-03)', () => {
  // A page like the real one: the list holds the company and the change; a good schedule save replaces the company's schedule (the synthetic
  // API answers it as a JSON string) and clears the change
  const SavingHost = ({ answerAsList = false }) => {
    const [live, setLive] = useState(company)
    const [scheduleState, setScheduleState] = useState({ loading: false, change: null, companyId: null })
    return (
      <Host
        initial='schedule'
        company={live}
        scheduleState={scheduleState}
        handleScheduleState={(list, id) => setScheduleState(prev => ({ ...prev, change: list, companyId: id }))}
        handleUpdateDeliveryService={async (id, changes) => {
          spies.handleUpdateDeliveryService(id, changes)
          setLive(prev => ({ ...prev, schedule: answerAsList ? JSON.parse(changes.schedule) : changes.schedule }))
          setScheduleState({ loading: false, change: null, companyId: null })
          return { ok: true }
        }}
      />
    )
  }
  const update = () => screen.getByRole('button', { name: 'Update' })

  it('going back to the previous schedule is a change again: Update enabled and the panel dirty', async () => {
    const user = userEvent.setup()
    render(<SavingHost />)
    await user.click(screen.getByRole('button', { name: 'edit schedule' }))
    expect(update()).toBeEnabled()
    await user.click(update())
    await waitFor(() => expect(update()).toBeDisabled()) // saved: nothing pending
    expect(spies.handleUpdateDeliveryService).toHaveBeenCalledWith(22, { schedule: JSON.stringify([{ lapses: ['edited'] }]) })

    await user.click(screen.getByRole('button', { name: 'revert schedule' })) // the schedule the provider had before
    expect(update()).toBeEnabled()
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('the editor compares with the saved schedule as a list (a string answer is parsed, a list is used as is) and starts over', async () => {
    const user = userEvent.setup()
    const view = render(<SavingHost />)
    expect(mocks.scheduleProps.scheduleList).toBe(schedule)
    expect(mocks.scheduleMounts).toBe(1)
    await user.click(screen.getByRole('button', { name: 'edit schedule' }))
    await user.click(update())
    await waitFor(() => expect(mocks.scheduleMounts).toBe(2)) // mounted again: its detection restarts from the saved value
    expect(mocks.scheduleProps.scheduleList).toEqual([{ lapses: ['edited'] }])
    view.unmount()

    render(<SavingHost answerAsList />)
    await user.click(screen.getByRole('button', { name: 'edit schedule' }))
    await user.click(update())
    await waitFor(() => expect(mocks.scheduleProps.scheduleList).toEqual([{ lapses: ['edited'] }]))
  })

  it('a failed Update keeps the editor as it was (no new mount): the draft is still there', async () => {
    const user = userEvent.setup()
    spies.handleUpdateDeliveryService.mockResolvedValue({ ok: false, error: ['no'] })
    const change = [{ lapses: ['x'] }]
    render(<Host initial='schedule' scheduleState={{ loading: false, change, companyId: 22 }} />)
    await user.click(update())
    expect(spies.handleUpdateDeliveryService).toHaveBeenCalledTimes(1)
    expect(mocks.scheduleMounts).toBe(1)
  })
})

describe('ProviderPanel switch that fails in the header (DS-R1-04)', () => {
  it('the notice sits in the status line, after the state and the switch, so the CSS can put it under the whole line', async () => {
    const user = userEvent.setup()
    spies.handleUpdateDeliveryService.mockResolvedValue({ ok: false, error: ['The provider rejected the change'] })
    render(<Host />)
    await user.click(toggle())
    const notice = await screen.findByRole('alert')
    const line = document.querySelector('.dsp-status')
    expect(line).toContainElement(notice)
    expect(notice).toHaveClass('odc-async-switch-notice')
    const order = [...line.querySelectorAll('.odc-status, [role="switch"], .odc-async-switch-notice')]
    expect(order[0]).toHaveClass('odc-status')
    expect(order[1]).toHaveAttribute('role', 'switch')
    expect(order[2]).toBe(notice)
  })

  // The CSS cannot be measured in jsdom: this pins the rules that keep the layout (the box model was measured in the live session)
  // R1: P/AsyncSwitch hangs the notice out of the flow, so the page keeps the state and the switch on one row by anchoring it
  // to the status line (the wrapper must keep a box: with `display: contents` the notice anchored to the whole split and measured 20 x 271px)
  it('the stylesheets anchor the notice to the status line and leave the table cell to P/AsyncSwitch', () => {
    const rule = (css, selector) => css.match(new RegExp(`${selector.replace(/[.>*:()]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
    expect(panelCss).toMatch(/\.dsp-status\s*\{\s*position:\s*relative/)
    expect(rule(panelCss, '.dsp-status > .odc-async-switch')).toMatch(/position:\s*static/)
    expect(panelCss).not.toMatch(/display:\s*contents/)
    expect(rule(panelCss, '.dsp-status .odc-async-switch-notice')).toMatch(/inset-inline:\s*0 auto/)
    // the Enabled cell: the notice asks the column for no width because P/AsyncSwitch hangs it (it used to need `contain: inline-size`)
    expect(tableCss).not.toMatch(/async-switch/)
  })
})

describe('ProviderPanel focus after the alert of a failed save (DS-R1-06)', () => {
  it('OK gives the focus back to the control of the panel that had it, though it lost it while it saved', async () => {
    const user = userEvent.setup()
    render(<Host initial='businesses' />)
    const draft = screen.getByRole('textbox', { name: 'businesses draft' })
    await user.click(draft) // «Save» of Businesses in the app: the last control of the panel that had the focus
    draft.blur() // it was disabled while it saved: the focus went to <body>
    expect(document.activeElement).toBe(document.body)
    act(() => { failWith(['The business is not available.']) })
    const alert = await screen.findByRole('alertdialog', { name: 'Ordering' })
    await user.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(draft).toHaveFocus())
  })

  it('and when that control is gone, to the panel (never <body>)', async () => {
    const user = userEvent.setup()
    render(<Host initial='businesses' />)
    const draft = screen.getByRole('textbox', { name: 'businesses draft' })
    await user.click(draft)
    draft.blur()
    draft.disabled = true // the control cannot take it back
    act(() => { failWith(['The business is not available.']) })
    const alert = await screen.findByRole('alertdialog', { name: 'Ordering' })
    await user.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).not.toBe(document.body))
    expect(document.querySelector('.odc-record').contains(document.activeElement)).toBe(true)
  })
})

describe('ProviderPanel Credentials unlock notice (DS-R1-07)', () => {
  it('is a plain notice, the first block of the section: no list markup, and its sibling blocks are the intro and the form', () => {
    mocks.availableModifyData = false
    render(<Host />)
    const notice = screen.getByText(/Fill in every field below to unlock/).closest('.odc-notice')
    expect(notice.parentElement).toHaveClass('cs-root')
    expect(notice.closest('ul, ol, li')).toBeNull()
    expect(notice.querySelector('ul, ol, li')).toBeNull()
    expect(notice).toHaveAttribute('role', 'status')
    expect(notice.nextElementSibling).toHaveClass('cs-intro')
  })

  it('the stylesheet takes off the notice\'s own page-gutter margin there, so it lines up with the fields', () => {
    const margin = panelCss.match(/\.cs-root\s*>\s*\.odc-notice\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(margin).toMatch(/margin:\s*0\b/)
  })
})

describe('ProviderPanel Credentials rhythm', () => {
  it('the form of the section takes off the margin-top that SettingsList\'s FormContainer brings, so Setup guide and the first field keep the panel\'s rhythm', () => {
    const rule = panelCss.match(/\.cs-form\s+\.odc-hub-form\s*>\s*:first-child\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/margin-block-start:\s*0\b/)
  })
})

// main (onboarding c98a3b6f, ): the project code comes from the API context, not from the raw localStorage key
// (a pinned local tenant namespaces that key)
describe('project code', () => {
  it('gives the controller the project of the API context', () => {
    window.localStorage.setItem('project', 'stored-project')
    try {
      render(<Host />)
      expect(mocks.controllerProps.projectCode).toBe('orderingv1')
    } finally {
      window.localStorage.removeItem('project')
    }
  })
})
