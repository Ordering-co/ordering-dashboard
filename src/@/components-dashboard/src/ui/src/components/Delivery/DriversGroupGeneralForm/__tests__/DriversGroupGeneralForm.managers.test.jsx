/* eslint-disable import/first */
// redesign (AD-3, AD-4, AD-6): the driver managers of the General section. History: DG-B2b (M-DG37): at 1440 the
// manager names sat outside the 540px panel because `InputWrapper input { width: 100% }` stretched the row's checkbox. The row is
// now a Product pick row (DriversGroupPickList); this keeps what that test asserted (a checkbox keeps its own size, the name
// column may shrink, the avatar keeps its size) and what the list does for the person (search, select, loading, empty, error).
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

// the session is the same object on every render (a legacy select never settles otherwise); `level` is edited in place
const session = vi.hoisted(() => ({ value: [{ user: { id: 1, level: 0 } }] }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => session.value
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../DriversGroupDrivers', () => ({ DriversGroupDrivers: () => null }))
vi.mock('../../DriversGroupCompanies', () => ({ DriversGroupCompanies: () => null }))

import { DriversGroupGeneralForm } from '..'

const MANAGERS = [
  { id: 1, name: 'Ana Ruiz', email: 'ana@example.invalid' },
  { id: 2, name: 'Beto Soto', email: 'beto@example.invalid', photo: 'https://example.invalid/beto.png' }
]

let handlers
const tree = (props = {}) => (
  <MemoryRouter>
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <DriversGroupGeneralForm
        driversGroupState={{ driversGroup: { id: 7, name: 'Group', type: 0, priority: 0 } }}
        driversManagers={MANAGERS}
        changesState={{}}
        actionState={{ loading: false }}
        selectedDriverManager={[]}
        {...handlers}
        {...props}
      />
    </ThemeProvider>
  </MemoryRouter>
)
const draw = (props = {}) => {
  const view = render(tree(props))
  return { ...view, again: next => view.rerender(tree({ ...props, ...next })) }
}
const managersGroup = () => screen.getByRole('group', { name: /^Driver manager/ })

beforeEach(() => {
  session.value[0].user.level = 0
  handlers = {
    handleChangesState: vi.fn(),
    handleUpdateDriversGroup: vi.fn(),
    handleSelectDriverManager: vi.fn(),
    handleSelectAllManagers: vi.fn(),
    handleChangeMaxDistance: vi.fn(),
    handleLogistic: vi.fn()
  }
})
afterEach(cleanup)

describe('DriversGroupGeneralForm manager row (M-DG37)', () => {
  it('draws one row per manager: a checkbox named by the name, the avatar and the email', () => {
    const { container } = draw()
    const group = managersGroup()
    const boxes = within(group).getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    expect(within(group).getByRole('checkbox', { name: 'Ana Ruiz' })).toBeInTheDocument()
    expect(within(group).getByText('beto@example.invalid')).toBeInTheDocument()
    const avatars = container.querySelectorAll('.odc-avatar[data-kind="person"]')
    expect(avatars).toHaveLength(2)
    expect(avatars[0]).toHaveTextContent('AR')
    expect(avatars[1].querySelector('img')).toHaveAttribute('src', 'https://example.invalid/beto.png')
  })

  it('does not stretch the manager checkbox to the width of the field: it is a native button of its own size, not a text input', () => {
    draw()
    const box = screen.getByRole('checkbox', { name: 'Ana Ruiz' })
    expect(box.tagName).toBe('BUTTON')
    // main's rule was `input { width: 100% }` for text fields; the form no longer has a rule that reaches a row's control
    expect(box.closest('.gpl-row')).not.toBeNull()
  })

  it('still makes text inputs fill the field', () => {
    draw()
    const name = screen.getByRole('textbox', { name: /^Name/ })
    expect(name.className).toContain('odc-field-input')
    const css = fs.readFileSync(path.resolve(__dirname, '../../../Shared/Product/field.css'), 'utf8')
    expect(css).toMatch(/\.odc-field-input[^{]*\{[^}]*inline-size:\s*100%/)
  })

  it('lets the name column shrink and keeps the avatar at its size inside the row', () => {
    draw()
    const css = fs.readFileSync(path.resolve(__dirname, '../../DriversGroupPickList/drivers-group-pick-list.css'), 'utf8')
    expect(css).toMatch(/\.gpl-text\s*\{[^}]*min-inline-size:\s*0/)
    const avatarCss = fs.readFileSync(path.resolve(__dirname, '../../../Shared/Product/avatar.css'), 'utf8')
    expect(avatarCss).toMatch(/\.odc-avatar\s*\{[^}]*flex:\s*none/)
    const row = screen.getByRole('checkbox', { name: 'Ana Ruiz' }).closest('.gpl-row')
    expect(row.querySelector('.gpl-text .gpl-title')).toHaveTextContent('Ana Ruiz')
    expect(row.querySelector('.odc-avatar')).not.toBeNull()
  })
})

describe('DriversGroupGeneralForm · driver managers (AD-3, AD-4)', () => {
  it('filters by name or email, no matter the case', async () => {
    draw()
    const search = screen.getByRole('searchbox', { name: 'Search driver managers' })
    await userEvent.type(search, 'BETO@')
    expect(within(managersGroup()).getAllByRole('checkbox')).toHaveLength(1)
    await userEvent.clear(search)
    await userEvent.type(search, 'ruiz')
    expect(within(managersGroup()).getByRole('checkbox', { name: 'Ana Ruiz' })).toBeInTheDocument()
    await userEvent.type(search, 'zzz')
    expect(screen.getByText('Nothing matches your search')).toBeInTheDocument()
  })

  it('follows the managers when they arrive after the first paint', () => {
    const { again } = draw({ driversManagers: [] })
    expect(screen.getByText('No driver managers yet')).toBeInTheDocument()
    again({ driversManagers: MANAGERS })
    expect(within(managersGroup()).getAllByRole('checkbox')).toHaveLength(2)
  })

  it('Select all and Select none call handleSelectAllManagers; a row calls handleSelectDriverManager', async () => {
    draw({ selectedDriverManager: [2] })
    expect(screen.getByRole('checkbox', { name: 'Beto Soto' })).toHaveAttribute('aria-checked', 'true')
    const group = within(managersGroup())
    await userEvent.click(group.getByRole('button', { name: 'Select all' }))
    expect(handlers.handleSelectAllManagers).toHaveBeenLastCalledWith(true)
    await userEvent.click(group.getByRole('button', { name: 'Select none' }))
    expect(handlers.handleSelectAllManagers).toHaveBeenLastCalledWith(false)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ana Ruiz' }))
    expect(handlers.handleSelectDriverManager).toHaveBeenCalledWith(1, true)
    await userEvent.click(screen.getByText('Beto Soto'))
    expect(handlers.handleSelectDriverManager).toHaveBeenCalledWith(2, false)
  })

  it('says it is loading, and when the managers could not load', () => {
    draw({ pickLists: { managers: { loading: true, error: null } } })
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    cleanup()
    draw({ pickLists: { managers: { loading: false, error: ['boom'] } } })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the driver managers.")
  })

  it('is not drawn for a driver manager (level 5)', () => {
    session.value[0].user.level = 5
    draw()
    expect(screen.queryByRole('group', { name: /^Driver manager/ })).not.toBeInTheDocument()
  })
})

describe('DriversGroupGeneralForm · a group needs a driver manager', () => {
  const WARNING = 'This group has no driver manager. A group needs one: choose a driver manager.'
  const NO_MANAGERS = 'There are no driver managers yet. A group needs a driver manager: add a driver manager first.'
  const save = () => screen.getByRole('button', { name: 'Save' })

  it('marks the driver manager as required', () => {
    draw()
    const legend = managersGroup().querySelector('legend')
    expect(legend.querySelector('.odc-field-required')).toHaveTextContent('*')
    expect(legend).toHaveTextContent('Required')
  })

  it('a group with no manager says so as soon as it opens, before any Save', () => {
    draw()
    expect(within(managersGroup()).getByRole('status')).toHaveTextContent(WARNING)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a group with a manager says nothing', () => {
    draw({ selectedDriverManager: [2] })
    expect(screen.queryByText(WARNING)).toBeNull()
  })

  it('Save without a manager does not save: the message sits in the list, which it describes, and the focus goes to its first row', async () => {
    draw({ changesState: { name: 'North' } })
    await userEvent.click(save())
    expect(handlers.handleUpdateDriversGroup).not.toHaveBeenCalled()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Choose a driver manager.')
    expect(managersGroup()).toHaveAttribute('aria-describedby', alert.id)
    expect(screen.queryByText(WARNING)).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Ana Ruiz' })))
  })

  it('with a manager chosen the message goes and Save saves', async () => {
    const { again } = draw({ changesState: { name: 'North' } })
    await userEvent.click(save())
    await screen.findByRole('alert')
    again({ changesState: { name: 'North', administrators: '[1]' }, selectedDriverManager: [1] })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(WARNING)).toBeNull()
    await userEvent.click(save())
    expect(handlers.handleUpdateDriversGroup).toHaveBeenCalledWith({ name: 'North', administrators: '[1]' })
  })

  it('unchecking the last manager brings the requirement back', async () => {
    draw({ selectedDriverManager: [], changesState: { administrators: '[]' } })
    await userEvent.click(save())
    expect(handlers.handleUpdateDriversGroup).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a driver manager.')
  })

  it('with no driver managers in the project it says so, links to add one and does not save', async () => {
    draw({ driversManagers: [], driversManagersLoaded: true, changesState: { name: 'North' } })
    expect(within(managersGroup()).getByRole('status')).toHaveTextContent(NO_MANAGERS)
    const link = screen.getByRole('link', { name: 'Add driver manager' })
    expect(link).toHaveAttribute('href', '/delivery/drivers-managers?add=1')
    await userEvent.click(save())
    expect(handlers.handleUpdateDriversGroup).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent(NO_MANAGERS)
    await waitFor(() => expect(document.activeElement).toBe(link))
  })

  it('does not block the save while the managers load or when they could not be loaded', async () => {
    draw({ changesState: { name: 'North' }, pickLists: { managers: { loading: false, error: ['boom'] } } })
    await userEvent.click(save())
    expect(handlers.handleUpdateDriversGroup).toHaveBeenCalledWith({ name: 'North' })
    expect(screen.queryByText(WARNING)).toBeNull()
  })

  it('a group whose managers are not known yet is not told it has none', () => {
    draw({ selectedDriverManager: undefined })
    expect(screen.queryByText(WARNING)).toBeNull()
  })

  it('a driver manager editing their group is not asked for one', async () => {
    session.value[0].user.level = 5
    draw({ changesState: { name: 'North' } })
    await userEvent.click(save())
    expect(handlers.handleUpdateDriversGroup).toHaveBeenCalledWith({ name: 'North' })
  })
})
