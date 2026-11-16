/* eslint-disable import/first */
// redesign DC-B3 (decisions 3, 4, 6, 17 | M-DC9, M-DC10, M-DC13, M-DC17, M-DC20, M-DC21; auditor 5, 17): the panel of a driver
// company, a RecordPanel with three tabs and one SaveBar, in place of the former details form. The controller
// (K/DriversCompanyDetails, with the `{ ok, error }` contract of lot B1) is a stateful stand-in that records what the panel calls;
// the Product wrappers (RecordPanel, Tabs, Menu, ConfirmDialog, AlertDialog, AsyncSwitch, Status, SaveBar, fields) and the time zone
// select are the real ones. The ScheduleEditor is a stub whose emissions the test controls (the real one is covered in its own tests).
import React, { useRef, useState } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  splitMode: 'split',
  companyState: null,
  initialChanges: {},
  actionState: { loading: false, error: null },
  controllerProps: null,
  controllerMounts: 0,
  setChanges: null,
  latestChanges: null,
  cleanChagesState: null,
  handleUpdateDriversCompany: null,
  handleDeleteDriversCompany: null,
  scheduleOnMount: null,
  scheduleProps: null,
  scheduleMounts: 0,
  scheduleA: [{ enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] }],
  scheduleB: [{ enabled: false, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }] }]
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../Shared/Product/SplitView', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useSplitView: () => ({ ...actual.useSplitView(), mode: mocks.splitMode }) }
})
vi.mock('../../../Shared/Product/ScheduleEditor', async () => {
  const React = await import('react')
  const ScheduleEditor = (props) => {
    mocks.scheduleProps = props
    const { handleChangeScheduleState } = props
    // K/Schedule reports the schedule it draws on mount when the company has none
    React.useEffect(() => {
      mocks.scheduleMounts += 1
      if (mocks.scheduleOnMount) handleChangeScheduleState(mocks.scheduleOnMount)
    }, [])
    return (
      <div data-testid='schedule-editor'>
        <button type='button' onClick={() => handleChangeScheduleState(mocks.scheduleA)}>emit schedule A</button>
        <button type='button' onClick={() => handleChangeScheduleState(mocks.scheduleB)}>emit schedule B</button>
      </div>
    )
  }
  return { ScheduleEditor }
})
vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const Controller = (props) => {
    const { UIComponent } = props
    const [changes, setChanges] = React.useState(mocks.initialChanges)
    React.useEffect(() => { mocks.controllerMounts += 1 }, [])
    mocks.controllerProps = props
    mocks.setChanges = setChanges
    mocks.latestChanges = changes
    return (
      <UIComponent
        {...props}
        companyState={mocks.companyState}
        changesState={changes}
        actionState={mocks.actionState}
        cleanChagesState={() => { mocks.cleanChagesState(); setChanges({}) }}
        handleChangesState={(field, value) => setChanges(current => ({ ...current, [field]: value }))}
        handleChangeScheduleState={(schedule) => setChanges(current => ({ ...current, schedule }))}
        handleUpdateDriversCompany={(...args) => mocks.handleUpdateDriversCompany(...args)}
        handleDeleteDriversCompany={(...args) => mocks.handleDeleteDriversCompany(...args)}
      />
    )
  }
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    DriversCompanyDetails: Controller
  }
})

import { CompanyPanel, discardTexts, resolveCompanySection } from '../CompanyPanel'

const company = {
  id: 31,
  name: 'Moto Express',
  owner_type: 'user',
  enabled: true,
  priority: 1,
  limit: 8,
  timezone: 'America/Bogota',
  address: 'Calle 1 # 2-3',
  webhook_new_order: 'https://example.test/hooks/new',
  webhook_cancel_request: 'https://example.test/hooks/cancel',
  webhook_order_status_changed: null,
  api_key: 'api-key-test',
  schedule: mocks.scheduleA
}
// A company that has no webhooks and no schedule yet (what an integration or a fresh company looks like)
const bare = { ...company, webhook_new_order: null, webhook_cancel_request: null, schedule: undefined }

let spies
let panelRef
const Host = ({ initial = 'general', ...props }) => {
  const [section, setSection] = useState(initial)
  const [expanded, setExpanded] = useState(false)
  panelRef = useRef(null)
  return (
    <MemoryRouter>
    <CompanyPanel
      driversCompanyId={31}
      driversCompany={company}
      driversCompaniesState={{ companies: [company] }}
      section={section}
      onSectionChange={(id) => { spies.onSectionChange(id); setSection(id) }}
      expanded={expanded}
      onToggleExpanded={() => { spies.onToggleExpanded(); setExpanded(value => !value) }}
      onClose={spies.onClose}
      onDeleted={spies.onDeleted}
      onToggleEnabled={spies.onToggleEnabled}
      confirmDisable={spies.confirmDisable}
      panelRef={panelRef}
      {...props}
    />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mocks.splitMode = 'split'
  mocks.companyState = { company, loading: false, error: null }
  mocks.initialChanges = {}
  mocks.actionState = { loading: false, error: null }
  mocks.controllerProps = null
  mocks.controllerMounts = 0
  mocks.scheduleOnMount = null
  mocks.scheduleProps = null
  mocks.scheduleMounts = 0
  mocks.cleanChagesState = vi.fn()
  // what the controller does when the save works: it empties the pending changes
  mocks.handleUpdateDriversCompany = vi.fn(async () => { mocks.setChanges({}); return { ok: true } })
  mocks.handleDeleteDriversCompany = vi.fn().mockResolvedValue({ ok: true })
  spies = {
    onSectionChange: vi.fn(),
    onToggleExpanded: vi.fn(),
    onClose: vi.fn(),
    onDeleted: vi.fn(),
    onToggleEnabled: vi.fn().mockResolvedValue({ ok: true }),
    confirmDisable: vi.fn().mockResolvedValue(true) // redesign D-5: the page's «Disable _name_?» (confirmed)
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const nameField = () => screen.getByRole('textbox', { name: /^Name/ })
const saveBar = () => screen.queryByRole('group', { name: 'Save changes' })
const tabs = () => within(screen.getByRole('tablist', { name: 'Driver company settings' })).getAllByRole('tab')

describe('resolveCompanySection and discardTexts', () => {
  it('a key main knew is kept, anything else is General', () => {
    expect(['general', 'schedule', 'webhooks'].map(resolveCompanySection)).toEqual(['general', 'schedule', 'webhooks'])
    expect([undefined, null, '', 'bogus', 'GENERAL'].map(resolveCompanySection)).toEqual(['general', 'general', 'general', 'general', 'general'])
  })

  it('the discard guard uses the four texts the other redesigned panels use', () => {
    expect(discardTexts((_key, text) => text)).toEqual({
      discardTitle: 'Discard your changes?',
      discardDescription: 'What you changed here is not saved yet.',
      discardConfirmLabel: 'Discard',
      keepEditingLabel: 'Keep editing'
    })
  })
})

describe('CompanyPanel wrapper (M-DC17, M-DC21)', () => {
  it('mounts K/DriversCompanyDetails with the props the page gave and its own UIComponent', () => {
    render(<Host />)
    const props = mocks.controllerProps
    expect(props.driversCompanyId).toBe(31)
    expect(props.driversCompany).toBe(company)
    expect(typeof props.UIComponent).toBe('function')
    expect(screen.getByRole('heading', { name: 'Moto Express' })).toBeInTheDocument()
  })

  it('the controller\'s onClose (the company is gone) tells the page onDeleted(id); the panel\'s own close is panelClose', () => {
    render(<Host />)
    expect(mocks.controllerProps.panelClose).toBe(spies.onClose)
    expect(mocks.controllerProps.onClose).not.toBe(spies.onClose)
    mocks.controllerProps.onClose()
    expect(spies.onDeleted).toHaveBeenCalledTimes(1)
    expect(spies.onDeleted).toHaveBeenCalledWith(31)
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('a company opened by ?id= (no row) reports the id it was given', () => {
    mocks.companyState = { company, loading: false, error: null }
    render(<Host driversCompany={undefined} driversCompaniesState={undefined} driversCompanyId={77} />)
    mocks.controllerProps.onClose()
    expect(spies.onDeleted).toHaveBeenCalledWith(77)
  })

  it('the row\'s id wins over driversCompanyId', () => {
    render(<Host driversCompanyId={99} />)
    mocks.controllerProps.onClose()
    expect(spies.onDeleted).toHaveBeenCalledWith(31)
  })

  it('works without onDeleted', () => {
    render(<Host onDeleted={undefined} />)
    expect(() => mocks.controllerProps.onClose()).not.toThrow()
  })
})

describe('CompanyPanel header (decisions 3 and 6)', () => {
  it('the title is the name; the subtitle is #id and a company of the project has no Integration mark', () => {
    render(<Host />)
    expect(screen.getByRole('heading', { name: 'Moto Express' })).toBeInTheDocument()
    const subtitle = document.querySelector('.odc-record-subtitle')
    expect(subtitle).toHaveTextContent('#31')
    expect(subtitle.querySelector('.odc-figure')).toHaveTextContent('#31')
    expect(subtitle).not.toHaveTextContent('Integration')
  })

  it('a company with no owner_type has no Integration mark either (auditor 16)', () => {
    const { owner_type: _gone, ...noOwner } = company
    mocks.companyState = { company: noOwner, loading: false, error: null }
    render(<Host driversCompany={noOwner} driversCompaniesState={{ companies: [noOwner] }} />)
    expect(document.querySelector('.odc-record-subtitle')).not.toHaveTextContent('Integration')
  })

  it('owner_type system adds the Integration mark: «#id · Integration»', () => {
    const system = { ...company, owner_type: 'system' }
    mocks.companyState = { company: system, loading: false, error: null }
    render(<Host driversCompany={system} driversCompaniesState={{ companies: [system] }} />)
    expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent('#31 · Integration')
    expect(document.querySelector('.odc-dc-tag')).toHaveTextContent('Integration')
  })

  it('the title follows the name being typed, and an emptied name reads «No name»', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(nameField(), ' Plus')
    expect(screen.getByRole('heading', { name: 'Moto Express Plus' })).toBeInTheDocument()
    await user.clear(nameField())
    expect(screen.getByRole('heading', { name: 'No name' })).toBeInTheDocument()
  })

  it('the status is a Status plus a switch named after the company', () => {
    render(<Host />)
    expect(document.querySelector('.odc-record-status')).toHaveTextContent('Enabled')
    expect(screen.getByRole('switch', { name: 'Enable Moto Express' })).toBeChecked()
  })

  it('the switch name follows the name being typed', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(nameField(), '!')
    expect(screen.getByRole('switch', { name: 'Enable Moto Express!' })).toBeInTheDocument()
  })

  it('the switch asks the page onToggleEnabled(company, next), once the page has confirmed turning it off', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('switch', { name: 'Enable Moto Express' }))
    await waitFor(() => expect(spies.onToggleEnabled).toHaveBeenCalledTimes(1))
    expect(spies.confirmDisable).toHaveBeenCalledWith(company)
    expect(spies.onToggleEnabled).toHaveBeenCalledWith(company, false)
  })

  // redesign D-5 (owner, 2026-10-19): OFF asks first; «no» writes nothing and leaves the switch on; ON stays immediate
  it('turning it OFF waits for the page\'s question; «no» saves nothing and the switch stays on', async () => {
    const user = userEvent.setup()
    spies.confirmDisable = vi.fn().mockResolvedValue(false)
    render(<Host />)
    await user.click(screen.getByRole('switch', { name: 'Enable Moto Express' }))
    await waitFor(() => expect(spies.confirmDisable).toHaveBeenCalledTimes(1))
    expect(spies.onToggleEnabled).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: 'Enable Moto Express' })).toBeChecked()
    expect(document.querySelector('.odc-record-status')).toHaveTextContent('Enabled')
  })

  it('turning a disabled company ON does not ask', async () => {
    const user = userEvent.setup()
    const row = { ...company, enabled: false }
    render(<Host driversCompaniesState={{ companies: [row] }} />)
    await user.click(screen.getByRole('switch', { name: 'Enable Moto Express' }))
    expect(spies.onToggleEnabled).toHaveBeenCalledWith(row, true)
    expect(spies.confirmDisable).not.toHaveBeenCalled()
  })

  it('reads the row of the list when it is there: the list says Disabled, the panel\'s own copy still says Enabled', async () => {
    const user = userEvent.setup()
    const row = { ...company, enabled: false }
    render(<Host driversCompaniesState={{ companies: [row] }} />)
    expect(document.querySelector('.odc-record-status')).toHaveTextContent('Disabled')
    expect(screen.getByRole('switch', { name: 'Enable Moto Express' })).not.toBeChecked()
    await user.click(screen.getByRole('switch', { name: 'Enable Moto Express' }))
    expect(spies.onToggleEnabled).toHaveBeenCalledWith(row, true)
  })

  it('the integration mark also comes from the row', () => {
    render(<Host driversCompaniesState={{ companies: [{ ...company, owner_type: 'system' }] }} />)
    expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent('Integration')
  })

  it('a company that is not in the list takes its state from its own copy', () => {
    mocks.companyState = { company: { ...company, enabled: false }, loading: false, error: null }
    render(<Host driversCompaniesState={{ companies: [{ id: 1, enabled: true }] }} />)
    expect(document.querySelector('.odc-record-status')).toHaveTextContent('Disabled')
  })

  it('a switch that fails does not move and says so below it', async () => {
    const user = userEvent.setup()
    spies.onToggleEnabled = vi.fn().mockResolvedValue({ ok: false, error: ['The company has open orders'] })
    render(<Host />)
    await user.click(screen.getByRole('switch', { name: 'Enable Moto Express' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The company has open orders')
    expect(screen.getByRole('switch', { name: 'Enable Moto Express' })).toBeChecked()
  })

  // As GroupPanel: with actionDisabled the ⋯ trigger itself is disabled (its only item is Delete)
  it('actionDisabled disables the switch, the fields and the ⋯ menu', () => {
    render(<Host actionDisabled />)
    expect(screen.getByRole('switch', { name: 'Enable Moto Express' })).toBeDisabled()
    expect(nameField()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Actions' })).toBeDisabled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('Open as page asks the page to toggle and reads Back to split view once expanded', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(spies.onToggleExpanded).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Back to split view' })).toBeInTheDocument()
  })

  it('on a phone the way out is Back and there is no Open as page', () => {
    mocks.splitMode = 'full'
    render(<Host />)
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open as page' })).toBeNull()
  })

  it('the close button asks the page to close', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('CompanyPanel tabs (decision 3)', () => {
  it('General, Schedule and Webhooks, in that order, with General selected', () => {
    render(<Host />)
    expect(tabs().map(tab => tab.textContent)).toEqual(['General', 'Schedule', 'Webhooks'])
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
  })

  it.each([['schedule', 'Schedule'], ['webhooks', 'Webhooks']])('?tab=%s selects %s', (section, label) => {
    render(<Host initial={section} />)
    expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true')
  })

  it.each([['bogus'], [undefined], ['']])('an unknown or missing tab (%s) is General', (section) => {
    render(<Host initial={section} />)
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
    expect(nameField()).toBeInTheDocument()
  })

  it('choosing a tab asks the page onSectionChange(id)', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('tab', { name: 'Webhooks' }))
    expect(spies.onSectionChange).toHaveBeenCalledWith('webhooks')
    expect(screen.getByRole('textbox', { name: /Webhook new order/ })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Schedule' }))
    expect(spies.onSectionChange).toHaveBeenLastCalledWith('schedule')
  })

  it('a draft survives a tab switch: all three sections stay mounted', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(nameField(), '!')
    await user.click(screen.getByRole('tab', { name: 'Webhooks' }))
    await user.click(screen.getByRole('tab', { name: 'General' }))
    expect(nameField()).toHaveValue('Moto Express!')
  })

  it('Webhooks draws the API key, read only, with Copy', () => {
    render(<Host initial='webhooks' />)
    expect(screen.getByRole('textbox', { name: 'API Key' })).toHaveValue('api-key-test')
    expect(screen.getByRole('button', { name: 'Copy API Key' })).toBeEnabled()
  })

  it('Schedule mounts the editor with the labels, the company\'s schedule and the panel\'s own handler', () => {
    render(<Host initial='schedule' />)
    expect(mocks.scheduleProps.scheduleList).toBe(mocks.scheduleA)
    expect(mocks.scheduleProps.labels.days[0]).toBe('Sunday')
    expect(typeof mocks.scheduleProps.handleChangeScheduleState).toBe('function')
  })

  it('a company without a schedule gives the editor no scheduleList', () => {
    mocks.companyState = { company: bare, loading: false, error: null }
    render(<Host driversCompany={bare} initial='schedule' />)
    expect(mocks.scheduleProps.scheduleList).toBeUndefined()
  })
})

// redesign (n.º 10, drivers-companies P-1): an integration (owner_type system) opens read only; a company of the project is
// as always
describe('CompanyPanel integration is read only (n.º 10, P-1)', () => {
  const system = { ...company, owner_type: 'system' }
  const renderSystem = (props = {}) => {
    mocks.companyState = { company: system, loading: false, error: null }
    return render(<Host driversCompany={system} driversCompaniesState={{ companies: [system] }} {...props} />)
  }

  it('General: the data shows and no field can be edited', () => {
    renderSystem()
    expect(nameField()).toHaveValue('Moto Express')
    expect(nameField()).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^Limit/ })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^Address/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Timezone/ })).toHaveAttribute('aria-disabled', 'true')
    // review L2 #3: the priority is a disabled field with its value, not four buttons that do nothing
    expect(screen.getByRole('textbox', { name: /^Priority/ })).toBeDisabled()
    expect(screen.queryByRole('radio', { name: 'High' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'High' })).toBeNull()
  })

  it('Webhooks: the three are disabled; the API key still shows with its Copy', () => {
    renderSystem({ initial: 'webhooks' })
    ;['Webhook new order', 'Webhook cancel request', 'Webhook order status changed'].forEach(label => {
      expect(screen.getByRole('textbox', { name: new RegExp(label) })).toBeDisabled()
    })
    expect(screen.getByRole('textbox', { name: /Webhook new order/ })).not.toBeRequired()
    expect(screen.getByRole('textbox', { name: 'API Key' })).toHaveValue('api-key-test')
    expect(screen.getByRole('button', { name: 'Copy API Key' })).toBeInTheDocument()
  })

  it('Schedule: the editor sits in a disabled fieldset and asks for no actions', () => {
    renderSystem({ initial: 'schedule' })
    expect(screen.getByTestId('schedule-editor').closest('fieldset')).toBeDisabled()
    expect(mocks.scheduleProps.disableSchedule).toBe(true)
    expect(screen.getByRole('button', { name: 'emit schedule A' })).toBeDisabled()
  })

  it('has no Save bar, not even with a change held by the controller, and nothing is sent', async () => {
    mocks.initialChanges = { limit: '5' }
    renderSystem()
    expect(saveBar()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    await userEvent.type(nameField(), '{Enter}')
    expect(mocks.handleUpdateDriversCompany).not.toHaveBeenCalled()
  })

  it('has no Delete: the Actions menu is not there', () => {
    renderSystem()
    expect(screen.queryByRole('button', { name: 'Actions' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Open as page' })).toBeInTheDocument()
  })

  it('its Enabled switch shows the state but cannot change it', async () => {
    renderSystem()
    const toggle = screen.getByRole('switch', { name: 'Enable Moto Express' })
    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
    await userEvent.click(toggle)
    expect(spies.onToggleEnabled).not.toHaveBeenCalled()
    expect(spies.confirmDisable).not.toHaveBeenCalled()
  })

  it('a notice on every tab sends to Connect › Delivery services', () => {
    ;['general', 'schedule', 'webhooks'].forEach(id => {
      cleanup()
      renderSystem({ initial: id })
      expect(document.querySelectorAll('[data-integration-notice]')).toHaveLength(3) // the three sections stay mounted
      const link = screen.getByRole('link', { name: 'Open Connect › Delivery services' }) // the one of the tab in view
      expect(link).toHaveAttribute('href', '/connect/delivery-services')
      expect(link.closest('[data-integration-notice]')).toHaveTextContent('This integration is managed in Connect. Here you can only see it.')
    })
  })

  it('a company of the project has no notice, a Save bar, its Actions menu and an editable form', async () => {
    const user = userEvent.setup()
    render(<Host />)
    expect(document.querySelector('[data-integration-notice]')).toBeNull()
    expect(screen.queryByRole('link', { name: /Delivery services/ })).toBeNull()
    expect(nameField()).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enable Moto Express' })).toBeEnabled()
    await user.type(nameField(), '!')
    expect(saveBar()).toBeInTheDocument()
  })
})

describe('CompanyPanel Delete (decision 6, C8)', () => {
  const openConfirm = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    return screen.findByRole('alertdialog')
  }

  it('asks first with the name, «This can\'t be undone.», «Delete company» and the focus on Cancel; no integration notice', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await openConfirm(user)
    expect(within(dialog).getByRole('heading', { name: 'Delete Moto Express?' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent("This can't be undone.")
    expect(dialog).not.toHaveTextContent('delivery service in Connect')
    expect(within(dialog).getByRole('button', { name: 'Delete company' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handleDeleteDriversCompany).not.toHaveBeenCalled()
  })

  it('the name in the question is the one being typed', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(nameField(), '!')
    const dialog = await openConfirm(user)
    expect(within(dialog).getByRole('heading', { name: 'Delete Moto Express!?' })).toBeInTheDocument()
  })

  it('Cancel deletes nothing', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await openConfirm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.handleDeleteDriversCompany).not.toHaveBeenCalled()
  })

  it('Delete company calls the controller once; the panel does not close by itself (the controller does)', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await openConfirm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete company' }))
    await waitFor(() => expect(mocks.handleDeleteDriversCompany).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('a failure is said in an alert with the API message, once, and the panel stays', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteDriversCompany = vi.fn().mockResolvedValue({ ok: false, error: ['The company has open orders'] })
    render(<Host />)
    const dialog = await openConfirm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete company' }))
    const alert = await screen.findByRole('alertdialog', { name: "The company wasn't deleted" })
    expect(within(alert).getByText('The company has open orders')).toBeInTheDocument()
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Moto Express', hidden: true })).toBeInTheDocument()
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('a rejection still says something', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteDriversCompany = vi.fn().mockRejectedValue(new Error('Network down'))
    render(<Host />)
    const dialog = await openConfirm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete company' }))
    const alert = await screen.findByRole('alertdialog', { name: "The company wasn't deleted" })
    expect(within(alert).getByText('Network down')).toBeInTheDocument()
  })

  it('an error with no text falls back to a sentence', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteDriversCompany = vi.fn().mockResolvedValue({ ok: false, error: null })
    render(<Host />)
    const dialog = await openConfirm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete company' }))
    const alert = await screen.findByRole('alertdialog', { name: "The company wasn't deleted" })
    expect(within(alert).getByText("We couldn't delete this company. Try again.")).toBeInTheDocument()
  })
})

describe('CompanyPanel SaveBar (decision 3 | M-DC9)', () => {
  it('without changes there is no bar', () => {
    render(<Host />)
    expect(saveBar()).toBeNull()
  })

  it('one change says «1 unsaved change» and names the field, never its value', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(nameField(), ' Zeta-secret')
    const bar = saveBar()
    expect(bar).toHaveTextContent('1 unsaved change · Name')
    expect(bar).not.toHaveTextContent('Zeta-secret')
    expect(within(bar).getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
  })

  it('counts the changes of the three tabs together and lists the first three names, then «+n»', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(nameField(), 'a')
    await user.type(screen.getByRole('textbox', { name: 'Limit' }), '1')
    await user.click(within(screen.getByRole('group', { name: 'Priority' })).getByRole('button', { name: 'Urgent' }))
    await user.click(screen.getByRole('tab', { name: 'Webhooks' }))
    await user.type(screen.getByRole('textbox', { name: /Webhook order status changed/ }), 'https://example.test/hooks/status')
    const bar = saveBar()
    expect(bar).toHaveTextContent('4 unsaved changes · Name, Limit, Priority +1')
    expect(bar).not.toHaveTextContent('example.test')
  })

  it('Save calls handleUpdateDriversCompany and then says Saved with the bar gone', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(nameField(), '!')
    await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.handleUpdateDriversCompany).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('Saved')
    expect(within(saveBar()).queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('a second press while it is saving does not send twice', async () => {
    const user = userEvent.setup()
    let release
    mocks.handleUpdateDriversCompany = vi.fn(() => new Promise(resolve => { release = () => resolve({ ok: true }) }))
    render(<Host />)
    await user.type(nameField(), '!')
    const save = within(saveBar()).getByRole('button', { name: 'Save' })
    await user.click(save)
    await user.click(save)
    expect(mocks.handleUpdateDriversCompany).toHaveBeenCalledTimes(1)
    await act(async () => { release() })
  })

  it('Discard calls cleanChagesState, the pending changes go and the fields return to the company\'s', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(nameField(), '!')
    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }))
    expect(mocks.cleanChagesState).toHaveBeenCalledTimes(1)
    expect(saveBar()).toBeNull()
    expect(nameField()).toHaveValue('Moto Express')
    expect(screen.getByRole('heading', { name: 'Moto Express' })).toBeInTheDocument()
  })

  it('Discard clears an error under a field', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.clear(nameField())
    await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Value is required')).toBeInTheDocument()
    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }))
    expect(screen.queryByText('Value is required')).toBeNull()
    expect(nameField()).toBeValid()
  })

  it('Discard clears the error of the API in the bar', async () => {
    const user = userEvent.setup()
    mocks.handleUpdateDriversCompany = vi.fn().mockResolvedValue({ ok: false, error: ['The API said no'] })
    render(<Host />)
    await user.type(nameField(), '!')
    await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
    expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('The API said no')
    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(saveBar()).toBeNull()
  })

  it('Discard brings the time zone select back to the company\'s zone', async () => {
    const user = userEvent.setup()
    mocks.initialChanges = { timezone: 'Europe/Madrid' }
    render(<Host />)
    expect(screen.getByRole('button', { name: /Timezone/ })).toHaveTextContent('Europe/Madrid')
    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }))
    expect(screen.getByRole('button', { name: /Timezone/ })).toHaveTextContent('America/Bogota')
  })

  describe('validation (companyForm.validate)', () => {
    it('an emptied name puts the message under the field, does not save and gives the field the focus', async () => {
      const user = userEvent.setup()
      render(<Host />)
      await user.clear(nameField())
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      expect(mocks.handleUpdateDriversCompany).not.toHaveBeenCalled()
      expect(nameField()).toHaveAccessibleDescription('Value is required')
      expect(nameField()).toBeInvalid()
      await waitFor(() => expect(nameField()).toHaveFocus())
      expect(spies.onSectionChange).not.toHaveBeenCalled()
    })

    it('typing in the field clears its own error', async () => {
      const user = userEvent.setup()
      render(<Host />)
      await user.clear(nameField())
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      expect(nameField()).toBeInvalid()
      await user.type(nameField(), 'N')
      expect(nameField()).toBeValid()
    })

    it('the error list is in screen order: Name before Address', async () => {
      const user = userEvent.setup()
      render(<Host />)
      await user.clear(nameField())
      await user.clear(screen.getByRole('textbox', { name: /^Address/ }))
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      expect(nameField()).toBeInvalid()
      expect(screen.getByRole('textbox', { name: /^Address/ })).toBeInvalid()
      await waitFor(() => expect(nameField()).toHaveFocus())
    })

    it('an empty time zone is caught on General and on Webhooks', async () => {
      const user = userEvent.setup()
      mocks.companyState = { company: { ...company, timezone: null }, loading: false, error: null }
      mocks.initialChanges = { limit: '5' }
      render(<Host driversCompany={{ ...company, timezone: null }} />)
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      expect(mocks.handleUpdateDriversCompany).not.toHaveBeenCalled()
      expect(within(document.querySelector('[data-field="timezone"]')).getByRole('alert')).toHaveTextContent('Value is required')
    })

    // regla de companyForm.validate: a Webhooks error the person did not cause does not block a save from another tab
    it('Save from General is NOT blocked by empty webhooks that were not touched (main saved such a company)', async () => {
      const user = userEvent.setup()
      mocks.companyState = { company: bare, loading: false, error: null }
      mocks.initialChanges = { limit: '5' }
      render(<Host driversCompany={bare} />)
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(mocks.handleUpdateDriversCompany).toHaveBeenCalledTimes(1))
      expect(spies.onSectionChange).not.toHaveBeenCalled()
    })

    it('Save from General IS blocked by a webhook that was emptied, and takes the person to Webhooks with the error and the focus', async () => {
      const user = userEvent.setup()
      mocks.initialChanges = { webhook_new_order: '' }
      render(<Host />)
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      expect(mocks.handleUpdateDriversCompany).not.toHaveBeenCalled()
      expect(spies.onSectionChange).toHaveBeenCalledTimes(1)
      expect(spies.onSectionChange).toHaveBeenCalledWith('webhooks')
      expect(screen.getByRole('tab', { name: 'Webhooks' })).toHaveAttribute('aria-selected', 'true')
      const field = screen.getByRole('textbox', { name: /Webhook new order/ })
      expect(field).toHaveAccessibleDescription('Value is required')
      await waitFor(() => expect(field).toHaveFocus())
    })

    it('a name emptied while the person is on Webhooks takes them back to General', async () => {
      const user = userEvent.setup()
      mocks.initialChanges = { name: '' }
      render(<Host initial='webhooks' />)
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      expect(mocks.handleUpdateDriversCompany).not.toHaveBeenCalled()
      expect(spies.onSectionChange).toHaveBeenCalledWith('general')
      await waitFor(() => expect(nameField()).toHaveFocus())
    })

    it('a webhook left empty in Webhooks (the tab in view) blocks too, without changing tab', async () => {
      const user = userEvent.setup()
      mocks.companyState = { company: bare, loading: false, error: null }
      mocks.initialChanges = { webhook_order_status_changed: 'https://example.test/hooks/status' }
      render(<Host driversCompany={bare} initial='webhooks' />)
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      expect(mocks.handleUpdateDriversCompany).not.toHaveBeenCalled()
      expect(screen.getByRole('textbox', { name: /Webhook new order/ })).toBeInvalid()
      expect(screen.getByRole('textbox', { name: /Webhook cancel request/ })).toBeInvalid()
      expect(spies.onSectionChange).not.toHaveBeenCalled()
    })

    it('Enter inside a field saves through the same check', async () => {
      const user = userEvent.setup()
      render(<Host />)
      await user.clear(nameField())
      await user.keyboard('{Enter}')
      expect(mocks.handleUpdateDriversCompany).not.toHaveBeenCalled()
      expect(nameField()).toBeInvalid()
    })
  })

  describe('a save that fails', () => {
    it('{ ok: false, error } puts the API text in the bar, as an alert, and keeps the changes', async () => {
      const user = userEvent.setup()
      mocks.handleUpdateDriversCompany = vi.fn().mockResolvedValue({ ok: false, error: ['The company has open orders'] })
      render(<Host />)
      await user.type(nameField(), '!')
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('The company has open orders')
      expect(saveBar()).toHaveTextContent('1 unsaved change')
      expect(nameField()).toHaveValue('Moto Express!')
    })

    it('a repeated message is said once and several are joined', async () => {
      const user = userEvent.setup()
      mocks.handleUpdateDriversCompany = vi.fn().mockResolvedValue({ ok: false, error: ['Bad webhook', 'Bad webhook', 'Bad address'] })
      render(<Host />)
      await user.type(nameField(), '!')
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('Bad webhook Bad address')
    })

    it('an error with no text says a sentence', async () => {
      const user = userEvent.setup()
      mocks.handleUpdateDriversCompany = vi.fn().mockResolvedValue({ ok: false })
      render(<Host />)
      await user.type(nameField(), '!')
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      expect(await within(saveBar()).findByRole('alert')).toHaveTextContent("We couldn't save the changes. Try again.")
    })

    it('a rejection says its message', async () => {
      const user = userEvent.setup()
      mocks.handleUpdateDriversCompany = vi.fn().mockRejectedValue(new Error('Network down'))
      render(<Host />)
      await user.type(nameField(), '!')
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      expect(await within(saveBar()).findByRole('alert')).toHaveTextContent('Network down')
    })

    it('Retry saves again and a success clears the error', async () => {
      const user = userEvent.setup()
      mocks.handleUpdateDriversCompany = vi.fn()
        .mockResolvedValueOnce({ ok: false, error: ['Try later'] })
        .mockImplementationOnce(async () => { mocks.setChanges({}); return { ok: true } })
      render(<Host />)
      await user.type(nameField(), '!')
      await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
      await user.click(await within(saveBar()).findByRole('button', { name: 'Retry' }))
      await waitFor(() => expect(mocks.handleUpdateDriversCompany).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    })
  })
})

describe('CompanyPanel schedule baseline (auditor 5)', () => {
  it('the schedule the editor reports on mount for a company without one is not a change: no bar, closes without asking', async () => {
    const user = userEvent.setup()
    mocks.companyState = { company: bare, loading: false, error: null }
    mocks.scheduleOnMount = mocks.scheduleA
    render(<Host driversCompany={bare} />)
    expect(mocks.scheduleMounts).toBe(1)
    expect(saveBar()).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('it is still handed to the controller, so a save carries it (as main), without being named in the bar', async () => {
    const user = userEvent.setup()
    mocks.companyState = { company: bare, loading: false, error: null }
    mocks.scheduleOnMount = mocks.scheduleA
    let sent
    mocks.handleUpdateDriversCompany = vi.fn(async () => { sent = mocks.latestChanges; mocks.setChanges({}); return { ok: true } })
    render(<Host driversCompany={bare} />)
    expect(mocks.latestChanges.schedule).toBe(mocks.scheduleA)
    expect(saveBar()).toBeNull()
    await user.type(nameField(), '!')
    expect(saveBar()).toHaveTextContent('1 unsaved change · Name')
    await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.handleUpdateDriversCompany).toHaveBeenCalledTimes(1))
    expect(sent).toEqual({ schedule: mocks.scheduleA, name: 'Moto Express!' })
  })

  it('a second, different emission counts: «1 unsaved change · Schedule»', async () => {
    const user = userEvent.setup()
    mocks.companyState = { company: bare, loading: false, error: null }
    mocks.scheduleOnMount = mocks.scheduleA
    render(<Host driversCompany={bare} />)
    await user.click(screen.getByRole('button', { name: 'emit schedule B', hidden: true }))
    expect(saveBar()).toHaveTextContent('1 unsaved change · Schedule')
  })

  it('going back to the first schedule is no longer a change', async () => {
    const user = userEvent.setup()
    mocks.companyState = { company: bare, loading: false, error: null }
    mocks.scheduleOnMount = mocks.scheduleA
    render(<Host driversCompany={bare} />)
    await user.click(screen.getByRole('button', { name: 'emit schedule B', hidden: true }))
    expect(saveBar()).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'emit schedule A', hidden: true }))
    expect(saveBar()).toBeNull()
  })

  it('a company with a schedule: a different one is a change, the same one is not', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'emit schedule A', hidden: true }))
    expect(saveBar()).toBeNull()
    await user.click(screen.getByRole('button', { name: 'emit schedule B', hidden: true }))
    expect(saveBar()).toHaveTextContent('1 unsaved change · Schedule')
  })

  it('after Discard the editor remounts, reports its baseline again and the bar stays away', async () => {
    const user = userEvent.setup()
    mocks.companyState = { company: bare, loading: false, error: null }
    mocks.scheduleOnMount = mocks.scheduleA
    render(<Host driversCompany={bare} />)
    await user.click(screen.getByRole('button', { name: 'emit schedule B', hidden: true }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }))
    expect(mocks.scheduleMounts).toBe(2)
    expect(saveBar()).toBeNull()
  })

  it('a schedule change next to a field change names both, in screen order', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'emit schedule B', hidden: true }))
    await user.type(nameField(), '!')
    expect(saveBar()).toHaveTextContent('2 unsaved changes · Name, Schedule')
  })
})

describe('CompanyPanel discard guard (decision 17)', () => {
  it('closing with changes asks first; Keep editing stays', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(nameField(), '!')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: 'Discard your changes?' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('What you changed here is not saved yet.')
    expect(spies.onClose).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(spies.onClose).not.toHaveBeenCalled()
    expect(nameField()).toHaveValue('Moto Express!')
  })

  it('Discard in the question closes through onClose', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(nameField(), '!')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('without changes it closes straight away', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('after the changes are saved it closes straight away again', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.type(nameField(), '!')
    await user.click(within(saveBar()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.handleUpdateDriversCompany).toHaveBeenCalled())
    await waitFor(() => expect(nameField()).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('panelRef.requestClose(proceed) asks first when dirty (how the page opens another company)', async () => {
    const user = userEvent.setup()
    const proceed = vi.fn()
    render(<Host />)
    await user.type(nameField(), '!')
    act(() => panelRef.current.requestClose(proceed))
    const dialog = await screen.findByRole('alertdialog')
    expect(proceed).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('panelRef.requestClose(proceed) goes straight through when clean', () => {
    const proceed = vi.fn()
    render(<Host />)
    act(() => panelRef.current.requestClose(proceed))
    expect(proceed).toHaveBeenCalledTimes(1)
  })
})

describe('CompanyPanel when the company does not open (M-DC20)', () => {
  beforeEach(() => {
    mocks.companyState = { company: null, loading: false, error: ['Not found'] }
  })

  it('says «We couldn\'t open this company.» with Retry and Close, and no tabs, no switch, no bar', () => {
    render(<Host driversCompany={undefined} driversCompaniesState={undefined} />)
    expect(screen.getByText("We couldn't open this company.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(saveBar()).toBeNull()
    expect(screen.getByRole('heading', { name: 'Driver company' })).toBeInTheDocument()
  })

  it('Retry mounts the controller again (a new key), Close asks the page to close', async () => {
    const user = userEvent.setup()
    render(<Host driversCompany={undefined} driversCompaniesState={undefined} />)
    expect(mocks.controllerMounts).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mocks.controllerMounts).toBe(2)
    const body = document.querySelector('.odc-record-body') ?? document.body
    await user.click(within(body).getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('while it loads there is a skeleton, not the error', () => {
    mocks.companyState = { company: null, loading: true, error: null }
    render(<Host driversCompany={undefined} driversCompaniesState={undefined} />)
    expect(screen.queryByText("We couldn't open this company.")).toBeNull()
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('with the row of the list and the controller\'s copy still null it does NOT show the error: the row stands in', () => {
    render(<Host />)
    expect(screen.queryByText("We couldn't open this company.")).toBeNull()
    expect(screen.getByRole('heading', { name: 'Moto Express' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument()
    expect(nameField()).toHaveValue('Moto Express')
  })
})
