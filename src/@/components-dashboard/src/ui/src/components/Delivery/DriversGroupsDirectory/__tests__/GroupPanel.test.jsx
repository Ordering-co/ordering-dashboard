/* eslint-disable import/first */
// redesign DG-B4 (decisions 1, 5, 6, 17 | M-DG5, M-DG6, M-DG12, M-DG13): the group panel, a RecordPanel with sections, in place of
// D/DriversGroupDetails. The controller (K/DriversGroupDetails, with the `{ ok, error }` contract of lot B1) and the legacy
// section pieces are stubs that record the props the panel gives them; the Product wrappers (RecordPanel, SectionNav, Tabs, Menu,
// ConfirmDialog, AlertDialog, AsyncSwitch, Status) are the real ones.
import React, { useRef, useState } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  configs: {},
  sessionUser: { id: 1, level: 0 },
  splitMode: 'split',
  driversGroupState: null,
  changesState: {},
  actionState: { loading: false, error: null },
  controllerProps: null,
  controllerMounts: 0,
  handleUpdateDriversGroup: null,
  handleDeleteDriversGroup: null,
  handleNextTour: null,
  sections: {},
  zonesProps: null,
  rerender: null
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
    // a save that fails sets the controller's `actionState` before it answers `{ ok: false }`, as K/DriversGroupDetails does
    const [, rerender] = React.useReducer(count => count + 1, 0)
    mocks.rerender = rerender
    mocks.controllerProps = props
    return (
      <UIComponent
        {...props}
        driversGroupState={mocks.driversGroupState}
        changesState={mocks.changesState}
        actionState={mocks.actionState}
        handleUpdateDriversGroup={mocks.handleUpdateDriversGroup}
        handleDeleteDriversGroup={mocks.handleDeleteDriversGroup}
        isScheduleEnabled={false}
      />
    )
  }
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useConfig: () => [{ configs: mocks.configs }],
    useSession: () => [{ user: mocks.sessionUser }],
    DriversGroupDetails: Controller
  }
})

const stub = (name, props) => {
  mocks.sections[name] = props
  return <div data-testid={name}><input aria-label={`${name} field`} /></div>
}
vi.mock('../../DriversGroupGeneralForm', () => ({
  DriversGroupGeneralForm: (props) => {
    mocks.sections.general = props
    return <div data-testid='general'><button type='button' onClick={props.handleNextClick}>next step</button></div>
  }
}))
vi.mock('../../DriversGroupBusinesses', () => ({ DriversGroupBusinesses: (props) => stub('businesses', props) }))
vi.mock('../../DriversGroupPaymethods', () => ({ DriversGroupPaymethods: (props) => stub('paymethods', props) }))
vi.mock('../../DriversGroupSchedule', () => ({ DriversGroupSchedule: (props) => stub('schedule', props) }))
vi.mock('../../DriversGroupLogistics', () => ({ DriversGroupLogistics: (props) => stub('advanced_logistics', props) }))
vi.mock('../../DriversGroupLogs', () => ({ DriversGroupLogs: (props) => stub('logs', props) }))
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

import { GroupPanel } from '../GroupPanel'

const group = {
  id: 975001,
  name: 'Downtown couriers',
  enabled: true,
  type: 0,
  priority: 0,
  autoassign_amount_drivers: 1,
  orders_group_max_orders: 1
}

let spies
let panelRef
// what the controller does when a request fails: the state first, then the answer
const failWith = (error) => {
  mocks.actionState = { loading: false, error }
  mocks.rerender()
  return { ok: false, error }
}
const Host = ({ initial = 'general', ...props }) => {
  const [section, setSection] = useState(initial)
  const [expanded, setExpanded] = useState(false)
  panelRef = useRef(null)
  return (
    <GroupPanel
      driversGroupId={975001}
      curDriversGroup={group}
      driversManagers={[{ id: 7 }]}
      businesses={[{ id: 3 }]}
      section={section}
      onSectionChange={(id) => { spies.onSectionChange(id); setSection(id) }}
      expanded={expanded}
      onToggleExpanded={() => { spies.onToggleExpanded(); setExpanded(value => !value) }}
      onClose={spies.onClose}
      onDirtyChange={spies.onDirtyChange}
      panelRef={panelRef}
      handleNextTour={mocks.handleNextTour}
      {...props}
    />
  )
}

beforeEach(() => {
  mocks.configs = { autoassign_type: { value: 'advanced' } }
  mocks.sessionUser = { id: 1, level: 0 }
  mocks.splitMode = 'split'
  mocks.driversGroupState = { loading: false, driversGroup: group, error: null }
  mocks.changesState = {}
  mocks.actionState = { loading: false, error: null }
  mocks.controllerProps = null
  mocks.controllerMounts = 0
  mocks.handleUpdateDriversGroup = vi.fn().mockResolvedValue({ ok: true })
  mocks.handleDeleteDriversGroup = vi.fn().mockResolvedValue({ ok: true })
  mocks.handleNextTour = vi.fn()
  mocks.sections = {}
  mocks.zonesProps = null
  spies = {
    onSectionChange: vi.fn(),
    onToggleExpanded: vi.fn(),
    onClose: vi.fn(),
    onDirtyChange: vi.fn()
  }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const nav = () => screen.getByRole('navigation', { name: 'Driver group settings' })
const navLabels = () => [...nav().querySelectorAll('.odc-sectionnav-label')].map(node => node.textContent)

describe('GroupPanel wiring to the controller', () => {
  it('mounts K/DriversGroupDetails with the props the page gave and its own UIComponent', () => {
    render(<Host />)
    const props = mocks.controllerProps
    expect(props.driversGroupId).toBe(975001)
    expect(props.curDriversGroup).toBe(group)
    expect(props.driversManagers).toEqual([{ id: 7 }])
    expect(typeof props.UIComponent).toBe('function')
    expect(screen.getByRole('heading', { name: 'Downtown couriers' })).toBeInTheDocument()
  })

  it('gives the sections the page props and the group, as main did with {...props}', () => {
    render(<Host />)
    expect(mocks.sections.general).toMatchObject({ driversManagers: [{ id: 7 }], businesses: [{ id: 3 }], curDriversGroup: group })
    expect(mocks.sections.general.driversGroupState.driversGroup).toBe(group)
  })

  it('does not hand the sections the panel-only props (section, panelRef, expanded)', () => {
    render(<Host />)
    for (const name of ['section', 'onSectionChange', 'panelRef', 'expanded', 'onToggleExpanded', 'onDirtyChange']) {
      expect(mocks.sections.general).not.toHaveProperty(name)
    }
  })
})

describe('GroupPanel header (decision 1)', () => {
  it('the title is the name and the subtitle is #id · type · priority', () => {
    render(<Host />)
    expect(screen.getByRole('heading', { name: 'Downtown couriers' })).toBeInTheDocument()
    const subtitle = document.querySelector('.odc-record-subtitle')
    expect(subtitle).toHaveTextContent('#975001 · In house drivers · Normal')
    expect(subtitle.querySelector('.odc-figure')).toHaveTextContent('#975001')
  })

  it.each([[-1, 'Low'], [0, 'Normal'], [1, 'High'], [2, 'Urgent']])('priority %s reads %s', (priority, label) => {
    mocks.driversGroupState = { loading: false, driversGroup: { ...group, priority }, error: null }
    render(<Host />)
    expect(document.querySelector('.odc-record-subtitle')).toHaveTextContent(`· ${label}`)
  })

  it('a company group says Driver companies and a group without priority omits it', () => {
    mocks.driversGroupState = { loading: false, driversGroup: { ...group, type: 1, priority: null }, error: null }
    render(<Host />)
    expect(document.querySelector('.odc-record-subtitle').textContent).toBe('#975001 · Driver companies')
  })

  it('a group without a name says so instead of painting an empty title', () => {
    mocks.driversGroupState = { loading: false, driversGroup: { ...group, name: '  ' }, error: null }
    render(<Host />)
    expect(screen.getByRole('heading', { name: 'No name' })).toBeInTheDocument()
  })

  it('the status is a Status plus a switch named after the group', () => {
    render(<Host />)
    expect(document.querySelector('.odc-record-status')).toHaveTextContent('Enabled')
    expect(screen.getByRole('switch', { name: 'Enable Downtown couriers' })).toBeChecked()
  })

  it('a disabled group reads Disabled and the switch is off', () => {
    mocks.driversGroupState = { loading: false, driversGroup: { ...group, enabled: false }, error: null }
    render(<Host />)
    expect(document.querySelector('.odc-record-status')).toHaveTextContent('Disabled')
    expect(screen.getByRole('switch', { name: 'Enable Downtown couriers' })).not.toBeChecked()
  })

  // redesign DG-R1 (R1-02): the row switch and the header switch are one fact, kept in the list; the header follows the list
  it('the header follows the switch of the row: the list says Disabled, the panel own copy still says Enabled (R1-02)', () => {
    render(<Host driversGroupsState={{ groups: [{ ...group, enabled: false }] }} />)
    expect(document.querySelector('.odc-record-status')).toHaveTextContent('Disabled')
    expect(screen.getByRole('switch', { name: 'Enable Downtown couriers' })).not.toBeChecked()
  })

  it('the header follows the row when the row changes after the panel is open, and back (R1-02)', () => {
    const view = render(<Host driversGroupsState={{ groups: [{ ...group, enabled: true }] }} />)
    expect(screen.getByRole('switch', { name: 'Enable Downtown couriers' })).toBeChecked()
    view.rerender(<Host driversGroupsState={{ groups: [{ ...group, enabled: false }] }} />)
    expect(document.querySelector('.odc-record-status')).toHaveTextContent('Disabled')
    expect(screen.getByRole('switch', { name: 'Enable Downtown couriers' })).not.toBeChecked()
    view.rerender(<Host driversGroupsState={{ groups: [{ ...group, enabled: true }] }} />)
    expect(document.querySelector('.odc-record-status')).toHaveTextContent('Enabled')
    expect(screen.getByRole('switch', { name: 'Enable Downtown couriers' })).toBeChecked()
  })

  it('a group that is not in the list (opened by ?id= from another page) takes its state from the detail (R1-02)', () => {
    mocks.driversGroupState = { loading: false, driversGroup: { ...group, enabled: false }, error: null }
    render(<Host driversGroupsState={{ groups: [{ id: 1, enabled: true }] }} />)
    expect(document.querySelector('.odc-record-status')).toHaveTextContent('Disabled')
  })

  it('the controller is asked to refresh the group when it opens (R1-01) and the sections do not get the prop', () => {
    render(<Host />)
    expect(mocks.controllerProps.refreshOnOpen).toBe(true)
    expect(mocks.sections.general).not.toHaveProperty('refreshOnOpen')
  })

  // redesign D-5 (owner, 2026-10-19): switching OFF asks first (C8); switching ON stays immediate
  const askDisable = async (user) => {
    await user.click(screen.getByRole('switch', { name: 'Enable Downtown couriers' }))
    return screen.findByRole('alertdialog', { name: 'Disable Downtown couriers?' })
  }

  it('turning the switch off asks first: «Disable _name_?», its consequence, «Disable group», the focus on Cancel', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await askDisable(user)
    expect(dialog).toHaveTextContent('New orders are no longer assigned through this group until you enable it again.')
    expect(within(dialog).getByRole('button', { name: 'Disable group' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handleUpdateDriversGroup).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: 'Enable Downtown couriers', hidden: true })).toBeChecked() // the modal hides it from the tree, it does not flip it
  })

  it('Cancel writes nothing and leaves the switch on', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await askDisable(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.handleUpdateDriversGroup).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: 'Enable Downtown couriers' })).toBeChecked()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('turning it on is immediate: no question', async () => {
    const user = userEvent.setup()
    mocks.driversGroupState = { loading: false, driversGroup: { ...group, enabled: false }, error: null }
    render(<Host />)
    await user.click(screen.getByRole('switch', { name: 'Enable Downtown couriers' }))
    expect(mocks.handleUpdateDriversGroup).toHaveBeenCalledWith({ enabled: true })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('the switch sends only { enabled } to the controller, after confirming: the other pending changes are not part of it (M-DG5)', async () => {
    const user = userEvent.setup()
    mocks.changesState = { name: 'Uptown couriers', priority: 2 }
    render(<Host />)
    const dialog = await askDisable(user)
    await user.click(within(dialog).getByRole('button', { name: 'Disable group' }))
    await waitFor(() => expect(mocks.handleUpdateDriversGroup).toHaveBeenCalledTimes(1))
    expect(mocks.handleUpdateDriversGroup).toHaveBeenCalledWith({ enabled: false })
    // the pending changes are still pending: the panel is still dirty
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('a switch that fails does not move and says so below it; no second alert for the same error', async () => {
    const user = userEvent.setup()
    mocks.handleUpdateDriversGroup = vi.fn(async () => failWith(['The group has open orders']))
    render(<Host />)
    const dialog = await askDisable(user)
    await user.click(within(dialog).getByRole('button', { name: 'Disable group' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The group has open orders')
    expect(screen.getByRole('switch', { name: 'Enable Downtown couriers' })).toBeChecked()
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('actionDisabled disables the switch and the actions menu for real', () => {
    render(<Host actionDisabled />)
    expect(screen.getByRole('switch', { name: 'Enable Downtown couriers' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Actions' })).toBeDisabled()
  })

  it('while the group loads there is no switch to press and the title is a skeleton', () => {
    mocks.driversGroupState = { loading: true, driversGroup: null, error: null }
    render(<Host curDriversGroup={undefined} />)
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByTestId('general')).toBeNull()
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
  })
})

describe('GroupPanel header actions', () => {
  it('Learn «Advanced logistics» is there for level 0 and not for level 5', () => {
    const { unmount } = render(<Host />)
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    unmount()
    mocks.sessionUser = { id: 1, level: 5 }
    render(<Host />)
    expect(screen.queryByRole('button', { name: 'Learn' })).toBeNull()
  })

  it('Open as page asks the page to toggle and reads Back to split view once expanded', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(spies.onToggleExpanded).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Back to split view' })).toBeInTheDocument()
  })

  it('there is no Open as page on a phone, or without a page that can toggle', () => {
    mocks.splitMode = 'full'
    const { unmount } = render(<Host />)
    expect(screen.queryByRole('button', { name: 'Open as page' })).toBeNull()
    unmount()
    mocks.splitMode = 'split'
    render(<Host onToggleExpanded={undefined} />)
    expect(screen.queryByRole('button', { name: 'Open as page' })).toBeNull()
  })

  it('the close button asks the page to close', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('the close button is Back on a phone', () => {
    mocks.splitMode = 'full'
    render(<Host />)
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })
})

describe('GroupPanel Delete (decision 6, C8)', () => {
  const openConfirm = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    return screen.findByRole('alertdialog')
  }

  it('asks first: «Delete _name_?», «This can\'t be undone.», «Delete group», the focus on Cancel', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await openConfirm(user)
    expect(within(dialog).getByRole('heading', { name: 'Delete Downtown couriers?' })).toBeInTheDocument()
    expect(within(dialog).getByText("This can't be undone.")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete group' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handleDeleteDriversGroup).not.toHaveBeenCalled()
  })

  it('Cancel deletes nothing', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await openConfirm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.handleDeleteDriversGroup).not.toHaveBeenCalled()
  })

  it('Delete group calls the controller once', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const dialog = await openConfirm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete group' }))
    await waitFor(() => expect(mocks.handleDeleteDriversGroup).toHaveBeenCalledTimes(1))
  })

  it('a failure is said in an alert with the API message, once, and the panel stays', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteDriversGroup = vi.fn(async () => failWith(['The group has open orders']))
    render(<Host />)
    const dialog = await openConfirm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete group' }))
    const alert = await screen.findByRole('alertdialog', { name: "The group wasn't deleted" })
    expect(within(alert).getByText('The group has open orders')).toBeInTheDocument()
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
    // the page behind the alert is still the panel of the group (hidden from the tree while the alert is modal)
    expect(screen.getByRole('heading', { name: 'Downtown couriers', hidden: true })).toBeInTheDocument()
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('a rejection with no message still says something', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteDriversGroup = vi.fn().mockRejectedValue(new Error('Network down'))
    render(<Host />)
    const dialog = await openConfirm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete group' }))
    const alert = await screen.findByRole('alertdialog', { name: "The group wasn't deleted" })
    expect(within(alert).getByText('Network down')).toBeInTheDocument()
  })

  it('an error with no text falls back to a sentence', async () => {
    const user = userEvent.setup()
    mocks.handleDeleteDriversGroup = vi.fn().mockResolvedValue({ ok: false, error: null })
    render(<Host />)
    const dialog = await openConfirm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete group' }))
    const alert = await screen.findByRole('alertdialog', { name: "The group wasn't deleted" })
    expect(within(alert).getByText("We couldn't delete this group. Try again.")).toBeInTheDocument()
  })
})

describe('GroupPanel sections (decision 1 | M-DG13)', () => {
  it('level 0 has the seven sections of main, in its order, in a SectionNav', () => {
    render(<Host />)
    expect(navLabels()).toEqual(['General', 'Businesses', 'Payment methods', 'Delivery zones', 'Schedule', 'Advanced logistics', 'Logs'])
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('level 5 has four Tabs: General, Businesses, Schedule and Advanced logistics', () => {
    mocks.sessionUser = { id: 1, level: 5 }
    render(<Host />)
    const tablist = screen.getByRole('tablist', { name: 'Driver group settings' })
    expect(within(tablist).getAllByRole('tab').map(tab => tab.textContent))
      .toEqual(['General', 'Businesses', 'Schedule', 'Advanced logistics'])
    expect(screen.queryByRole('navigation', { name: 'Driver group settings' })).toBeNull()
  })

  it('a basic autoassign type drops Advanced logistics', () => {
    mocks.configs = { autoassign_type: { value: 'basic' } }
    render(<Host />)
    expect(navLabels()).not.toContain('Advanced logistics')
  })

  it('a group with no autoassign drivers and no group orders drops Advanced logistics', () => {
    mocks.driversGroupState = {
      loading: false,
      driversGroup: { ...group, autoassign_amount_drivers: 0, orders_group_max_orders: 0 },
      error: null
    }
    render(<Host />)
    expect(navLabels()).not.toContain('Advanced logistics')
  })

  it('opens in General', () => {
    render(<Host />)
    expect(within(nav()).getByRole('button', { name: 'General' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('general')).toBeInTheDocument()
    expect(screen.queryByTestId('businesses')).toBeNull()
  })

  it('a known ?tab= opens that section', () => {
    render(<Host initial='schedule' />)
    expect(within(nav()).getByRole('button', { name: 'Schedule' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('schedule')).toBeInTheDocument()
    expect(screen.queryByTestId('general')).toBeNull()
  })

  it('an unknown ?tab= is General', () => {
    render(<Host initial='nope' />)
    expect(within(nav()).getByRole('button', { name: 'General' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('general')).toBeInTheDocument()
  })

  it('a tab the level does not have (Logs at level 5) is General (D-69; main drew Logs)', () => {
    mocks.sessionUser = { id: 1, level: 5 }
    render(<Host initial='logs' />)
    expect(screen.getByTestId('general')).toBeInTheDocument()
    expect(screen.queryByTestId('logs')).toBeNull()
  })

  it('pressing a section asks the page for it', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(within(nav()).getByRole('button', { name: 'Businesses' }))
    expect(spies.onSectionChange).toHaveBeenCalledWith('businesses')
    expect(screen.getByTestId('businesses')).toBeInTheDocument()
  })

  it('pressing a tab at level 5 asks the page for it', async () => {
    const user = userEvent.setup()
    mocks.sessionUser = { id: 1, level: 5 }
    render(<Host />)
    await user.click(screen.getByRole('tab', { name: 'Schedule' }))
    expect(spies.onSectionChange).toHaveBeenCalledWith('schedule')
    expect(screen.getByTestId('schedule')).toBeVisible()
  })

  it('the tour\'s «next» goes to Businesses and tells the tour', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'next step' }))
    expect(spies.onSectionChange).toHaveBeenCalledWith('businesses')
    expect(mocks.handleNextTour).toHaveBeenCalledTimes(1)
  })

  it('Advanced logistics is the inline version; Logs gets the group id and the project\'s date format', () => {
    const { unmount } = render(<Host initial='advanced_logistics' />)
    expect(mocks.sections.advanced_logistics.inline).toBe(true)
    unmount()
    render(<Host initial='logs' />)
    expect(mocks.sections.logs).toMatchObject({ driversGroupId: 975001, formatDates: true })
  })

  it('Delivery zones gets the group, the discard texts and a way to say it is dirty', () => {
    render(<Host initial='delivery_zones' />)
    expect(mocks.zonesProps.drivergroup).toBe(group)
    expect(mocks.zonesProps.curDriversGroup).toBe(group)
    expect(mocks.zonesProps.discardTexts).toEqual({
      discardTitle: 'Discard your changes?',
      discardDescription: 'What you changed here is not saved yet.',
      discardConfirmLabel: 'Discard',
      keepEditingLabel: 'Keep editing'
    })
    expect(typeof mocks.zonesProps.onDirtyChange).toBe('function')
  })

  it('only the current section is drawn', () => {
    render(<Host initial='paymethods' />)
    expect(screen.getByTestId('paymethods')).toBeInTheDocument()
    for (const other of ['general', 'businesses', 'schedule', 'logs', 'delivery_zones']) {
      expect(screen.queryByTestId(other)).toBeNull()
    }
  })
})

describe('GroupPanel actionDisabled (M-DG6)', () => {
  it('puts the section inside an inert, aria-disabled container', () => {
    render(<Host actionDisabled />)
    const container = screen.getByTestId('general').closest('[aria-disabled="true"]')
    expect(container).not.toBeNull()
    expect(container).toHaveAttribute('inert')
  })

  it('does the same in every section, Tabs included', () => {
    mocks.sessionUser = { id: 1, level: 5 }
    render(<Host actionDisabled initial='businesses' />)
    const container = screen.getByTestId('businesses').closest('[aria-disabled="true"]')
    expect(container).toHaveAttribute('inert')
  })

  it('without actionDisabled nothing is inert', () => {
    render(<Host />)
    expect(screen.getByTestId('general').closest('[inert]')).toBeNull()
    expect(screen.getByTestId('general').closest('[aria-disabled]')).toBeNull()
  })
})

describe('GroupPanel discard guard (decision 17)', () => {
  it('closes straight away when nothing changed', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(spies.onClose).toHaveBeenCalledTimes(1)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('changes of the group (changesState) turn the guard on and tell the page', async () => {
    const user = userEvent.setup()
    mocks.changesState = { name: 'Uptown couriers' }
    render(<Host />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: 'Discard your changes?' })).toBeInTheDocument()
    expect(within(dialog).getByText('What you changed here is not saved yet.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument()
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('Keep editing stays, Discard closes', async () => {
    const user = userEvent.setup()
    mocks.changesState = { name: 'Uptown couriers' }
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(spies.onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('the page can ask the same question before it opens another group (panelRef.requestClose)', async () => {
    const user = userEvent.setup()
    mocks.changesState = { name: 'Uptown couriers' }
    render(<Host />)
    const proceed = vi.fn()
    act(() => panelRef.current.requestClose(proceed))
    const dialog = await screen.findByRole('alertdialog')
    expect(proceed).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('unsaved zones (GroupZones onDirtyChange) turn the guard on too, and off again', async () => {
    const user = userEvent.setup()
    render(<Host initial='delivery_zones' />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
    await user.click(screen.getByRole('button', { name: 'dirty zones' }))
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'clean zones' }))
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('the zones keep their draft when the user goes to another section (kept mounted, hidden)', async () => {
    const user = userEvent.setup()
    render(<Host initial='delivery_zones' />)
    await user.click(screen.getByRole('button', { name: 'dirty zones' }))
    await user.click(within(nav()).getByRole('button', { name: 'Logs' }))
    expect(screen.getByTestId('logs')).toBeVisible()
    expect(screen.getByTestId('delivery_zones')).toBeInTheDocument()
    expect(screen.getByTestId('delivery_zones')).not.toBeVisible()
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('clean zones are not kept when the user leaves them', async () => {
    const user = userEvent.setup()
    render(<Host initial='delivery_zones' />)
    await user.click(within(nav()).getByRole('button', { name: 'Logs' }))
    expect(screen.queryByTestId('delivery_zones')).toBeNull()
  })

  it('tells the page it is clean when it goes away', () => {
    mocks.changesState = { name: 'Uptown couriers' }
    const { unmount } = render(<Host />)
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('there is no Discard of the group in the panel (auditor 9)', () => {
    mocks.changesState = { name: 'Uptown couriers' }
    render(<Host />)
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
  })
})

describe('GroupPanel when the group does not open (M-DG12)', () => {
  const failed = () => {
    mocks.driversGroupState = { loading: false, driversGroup: null, error: ['The group does not exist'] }
  }

  it('says it, with Retry and Close, and never paints the form', () => {
    failed()
    render(<Host curDriversGroup={undefined} />)
    const state = screen.getByRole('alert')
    expect(within(state).getByText("We couldn't open this group.")).toBeInTheDocument()
    expect(within(state).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(within(state).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.queryByTestId('general')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('Close asks the page to close', async () => {
    const user = userEvent.setup()
    failed()
    render(<Host curDriversGroup={undefined} />)
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Close' }))
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('Retry mounts the controller again, which asks the API again', async () => {
    const user = userEvent.setup()
    failed()
    render(<Host curDriversGroup={undefined} />)
    expect(mocks.controllerMounts).toBe(1)
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(mocks.controllerMounts).toBe(2))
  })

  it('no error and no group once it stopped loading is the same state, not the add form', () => {
    mocks.driversGroupState = { loading: false, driversGroup: null, error: null }
    render(<Host curDriversGroup={undefined} />)
    expect(within(screen.getByRole('alert')).getByText("We couldn't open this group.")).toBeInTheDocument()
    expect(screen.queryByTestId('general')).toBeNull()
  })

  it('the panel is not dirty and has no sections to go to', () => {
    failed()
    render(<Host curDriversGroup={undefined} />)
    expect(screen.queryByRole('navigation', { name: 'Driver group settings' })).toBeNull()
    expect(spies.onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})

describe('GroupPanel errors of the sections (actionState, as main)', () => {
  it('an error of a save made by a section is said in an alert', async () => {
    mocks.actionState = { loading: false, error: ['The timezone is required.'] }
    render(<Host />)
    const alert = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(within(alert).getByText('The timezone is required.')).toBeInTheDocument()
  })

  it('closing it leaves the panel as it was', async () => {
    const user = userEvent.setup()
    mocks.actionState = { loading: false, error: ['The timezone is required.'] }
    render(<Host />)
    const alert = await screen.findByRole('alertdialog')
    await user.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByTestId('general')).toBeInTheDocument()
  })
})
