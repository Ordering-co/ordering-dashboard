/* eslint-disable import/first */
// (part 1): in a group's General and Businesses sections, a save that worked emptied `changesState`, so «Save» turned
// `disabled` and took the focus with it: it fell on <body> (the driver profile keeps it in the card). The panel gives the focus
// back to itself. The real panel, General form and Businesses form run here; only the controller (with a changesState that
// really empties after a save) and the heavy children (driver lists, zones, search) are stubs.
import React, { useState } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const mocks = vi.hoisted(() => ({ save: null, result: { ok: true } }))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const group = { id: 331, name: 'Downtown couriers', enabled: true, type: 0, priority: 0, autoassign_amount_drivers: 1, orders_group_max_orders: 1 }
  // What K/DriversGroupDetails does: the edits go to `changesState`; a save asks the API, then leaves `actionState` and
  // `changesState` clean (the keys that were sent leave it).
  const Controller = (props) => {
    const { UIComponent } = props
    const [changesState, setChangesState] = React.useState({})
    const [actionState, setActionState] = React.useState({ loading: false, error: null })
    const handleUpdateDriversGroup = async (changes) => {
      mocks.save(changes)
      setActionState({ loading: true, error: null })
      await Promise.resolve()
      if (mocks.result.ok) {
        setActionState({ loading: false, error: null })
        setChangesState({})
      } else {
        setActionState({ loading: false, error: mocks.result.error })
      }
      return mocks.result
    }
    return (
      <UIComponent
        {...props}
        driversGroupState={{ loading: false, driversGroup: group, error: null }}
        changesState={changesState}
        actionState={actionState}
        handleChangesState={(changes) => setChangesState(prev => ({ ...prev, ...changes }))}
        handleChangeMaxDistance={() => {}}
        handleUpdateDriversGroup={handleUpdateDriversGroup}
        handleDeleteDriversGroup={async () => ({ ok: true })}
        handleSelectBusiness={(id) => setChangesState(prev => ({ ...prev, businesses: JSON.stringify([id]) }))}
        handleSelectAllBusiness={() => {}}
        handleSelectAllManagers={() => {}}
        handleSelectDriverManager={() => {}}
        handleLogistic={() => {}}
        selectedBusinessIds={[]}
        selectedDriverManager={[5]}
        isScheduleEnabled={false}
      />
    )
  }
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useConfig: () => [{ configs: { autoassign_type: { value: 'advanced' } } }],
    useSession: () => [{ user: { id: 1, level: 0 } }],
    DriversGroupDetails: Controller
  }
})
vi.mock('../../../Shared', () => ({ SearchBar: () => null, Pagination: () => null, Alert: () => null }))
// The Base UI select spins forever in jsdom when the form hands it a fresh `options` array on every render
vi.mock('../../../Shared/UI/Select', () => ({ Select: () => null }))
vi.mock('../../DriversGroupDrivers', () => ({ DriversGroupDrivers: () => null }))
vi.mock('../../DriversGroupCompanies', () => ({ DriversGroupCompanies: () => null }))
vi.mock('../../DriversGroupPaymethods', () => ({ DriversGroupPaymethods: () => null }))
vi.mock('../../DriversGroupSchedule', () => ({ DriversGroupSchedule: () => null }))
vi.mock('../../DriversGroupLogistics', () => ({ DriversGroupLogistics: () => null }))
vi.mock('../../DriversGroupLogs', () => ({ DriversGroupLogs: () => null }))
vi.mock('../../../Shared/DeliveryZones/GroupZones', () => ({ GroupZones: () => null }))

import { GroupPanel } from '../GroupPanel'

const Host = ({ initial }) => {
  const [section, setSection] = useState(initial)
  return (
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <GroupPanel
        driversGroupId={331}
        driversManagers={[]}
        businesses={[{ id: 3, name: 'Alpha' }]}
        section={section}
        onSectionChange={setSection}
        onClose={() => {}}
      />
    </ThemeProvider>
  )
}

const panel = () => document.querySelector('.odc-record')
const settle = (ms) => new Promise(resolve => setTimeout(resolve, ms))
// A browser drops the focus of a control that turns `disabled` (jsdom keeps it on the dead button), so «where the focus is» means
// an element that is not <body> and not disabled, inside the group's panel
const expectFocusInPanel = () => {
  const active = document.activeElement
  expect(active).not.toBe(document.body)
  expect(active.matches(':disabled')).toBe(false)
  expect(panel()).toContainElement(active)
}

beforeEach(() => {
  mocks.save = vi.fn()
  mocks.result = { ok: true }
})
afterEach(cleanup)

describe('GroupPanel · focus after a save', () => {
  it('General: after saving a new name with Enter on «Save», the focus stays in the group panel', async () => {
    const user = userEvent.setup()
    render(<Host initial='general' />)
    const name = screen.getByLabelText(/^Name/) /* P/TextField adds «Required» to the label */
    await user.clear(name)
    await user.type(name, 'Uptown couriers')
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeEnabled()
    save.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled())
    await settle(300)
    expectFocusInPanel()
    await settle(700)
    expectFocusInPanel()
    await settle(1500)
    expectFocusInPanel()
  })

  it('Businesses: the same, after saving the selection', async () => {
    const user = userEvent.setup()
    render(<Host initial='businesses' />)
    await user.click(screen.getByRole('checkbox', { name: 'Alpha' }))
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeEnabled()
    save.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled())
    await settle(300)
    expectFocusInPanel()
  })

  it('leaves the focus alone when it is already somewhere else in the page (another field)', async () => {
    const user = userEvent.setup()
    render(
      <>
        <input aria-label='elsewhere' />
        <Host initial='general' />
      </>
    )
    const name = screen.getByLabelText(/^Name/) /* P/TextField adds «Required» to the label */
    await user.type(name, 'x')
    screen.getByRole('button', { name: 'Save' }).focus()
    await user.keyboard('{Enter}')
    screen.getByLabelText('elsewhere').focus()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled())
    await settle(300)
    expect(document.activeElement).toBe(screen.getByLabelText('elsewhere'))
  })

  it('a save that fails keeps «Save» enabled and does not move the focus to the panel (the error dialog has it)', async () => {
    mocks.result = { ok: false, error: ['nope'] }
    const user = userEvent.setup()
    render(<Host initial='general' />)
    await user.type(screen.getByLabelText(/^Name/) /* P/TextField adds «Required» to the label */, 'x')
    screen.getByRole('button', { name: 'Save' }).focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    await screen.findByRole('alertdialog')
    await settle(300)
    expect(screen.getByRole('alertdialog')).toContainElement(document.activeElement)
  })
})
