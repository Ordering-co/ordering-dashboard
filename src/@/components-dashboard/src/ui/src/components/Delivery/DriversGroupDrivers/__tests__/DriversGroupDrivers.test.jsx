/* eslint-disable import/first */
// redesign (AD-3, AD-4, AD-5, AD-6): the drivers of a delivery group on the Product pieces. The root-cause fix: the
// list is derived from the `drivers` the controller hands over, so it fills when they arrive after the first paint (main only
// filtered when the search text changed, and left the list empty).
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))
// the legacy Modal of the temporary schedule (kept as it is in the panel) is a plain dialog here
vi.mock('../../../Shared', () => ({
  Modal: ({ open, title, className, children }) => (open ? <div role='dialog' aria-label={title} className={className}>{children}</div> : null)
}))
vi.mock('../../DriverTemporalSchedule', () => ({
  DriverTemporalSchedule: ({ driverSchedule }) => <div data-testid='schedule'>{`schedule of ${driverSchedule?.id}`}</div>
}))

import { DriversGroupDrivers } from '..'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const driver = (id, name, lastname, extra = {}) => ({ id, name, lastname, email: `${name.toLowerCase()}${id}@example.invalid`, ...extra })
const FEW = [driver(1, 'Ana', 'Ruiz'), driver(2, 'Beto', 'Soto')]
const MANY = Array.from({ length: 12 }, (_, index) => driver(index + 1, `Driver${String(index + 1).padStart(2, '0')}`, 'Test'))

const tree = (props = {}, handlers = {}) => (
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <DriversGroupDrivers
      drivers={FEW}
      actionState={{ loading: false }}
      selectedDriverIds={[]}
      selectedDriverTemporaryIds={[]}
      {...handlers}
      {...props}
    />
  </ThemeProvider>
)

const draw = (props = {}) => {
  const handlers = {
    handleSelectDriver: vi.fn(),
    handleSelectAllDriver: vi.fn(),
    handleSelectDriverTemporary: vi.fn()
  }
  const view = render(tree(props, handlers))
  return { ...view, handlers, again: next => view.rerender(tree({ ...props, ...next }, handlers)) }
}

afterEach(cleanup)

describe('DriversGroupDrivers', () => {
  it('fills the list when the drivers arrive after the first paint (root cause)', () => {
    const { again } = draw({ drivers: [] })
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    again({ drivers: FEW })
    expect(screen.getByRole('checkbox', { name: 'Ana Ruiz' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Beto Soto' })).toBeInTheDocument()
  })

  it('draws a person avatar with initials, not the legacy user glyph, and the email under the name', () => {
    const { container } = draw()
    const avatars = container.querySelectorAll('.odc-avatar[data-kind="person"]')
    expect(avatars).toHaveLength(2)
    expect(avatars[0]).toHaveTextContent('AR')
    expect(container.querySelector('.odc-avatar svg')).toBeNull()
    expect(screen.getByText('ana1@example.invalid')).toBeInTheDocument()
  })

  it('is a group named «Drivers» whose Select all and Select none call the controller', async () => {
    const { handlers } = draw()
    expect(screen.getByRole('group', { name: 'Drivers' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(handlers.handleSelectAllDriver).toHaveBeenLastCalledWith(true)
    await userEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(handlers.handleSelectAllDriver).toHaveBeenLastCalledWith(false)
  })

  it('checking a row calls handleSelectDriver with the id and the next value', async () => {
    const { handlers } = draw()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Beto Soto' }))
    expect(handlers.handleSelectDriver).toHaveBeenCalledWith(2, true)
  })

  it('shows ten rows and moves to the second page', async () => {
    draw({ drivers: MANY })
    expect(screen.getAllByRole('checkbox')).toHaveLength(10)
    expect(screen.getByRole('checkbox', { name: 'Driver01 Test' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getByRole('checkbox', { name: 'Driver11 Test' })).toBeInTheDocument()
  })

  it('filters by name or email, goes back to the first page and says when nothing matches', async () => {
    draw({ drivers: MANY })
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    const search = screen.getByRole('searchbox', { name: 'Search drivers' })
    await userEvent.type(search, 'driver12')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('checkbox', { name: 'Driver12 Test' })).toBeInTheDocument()
    await userEvent.clear(search)
    await userEvent.type(search, 'zzz')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText('Nothing matches your search')).toBeInTheDocument()
  })

  it('says it is loading while the controller loads the drivers', () => {
    draw({ drivers: [], pickLists: { drivers: { loading: true, error: null } } })
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
  })

  it('says when the drivers could not load, and when there are none', () => {
    draw({ drivers: [], pickLists: { drivers: { loading: false, error: ['boom'] } } })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the drivers.")
    cleanup()
    draw({ drivers: [] })
    expect(screen.getByText('No drivers yet')).toBeInTheDocument()
  })

  it('a selected driver has the temporary checkbox and the button that opens the schedule', async () => {
    const { handlers } = draw({ selectedDriverIds: [1] })
    const row = screen.getByRole('checkbox', { name: 'Ana Ruiz' }).closest('li')
    const temporary = within(row).getByRole('checkbox', { name: 'Temporary driver' })
    await userEvent.click(temporary)
    expect(handlers.handleSelectDriverTemporary).toHaveBeenCalledWith(1, true, expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:59$/))
    expect(screen.queryByTestId('schedule')).not.toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Temporary driver' }))
    expect(screen.getByTestId('schedule')).toHaveTextContent('schedule of 1')
    // tanda AG (A3-3): «Temporary schedule» in sentence case, and the dialog drops the legacy title's capitalize
    expect(screen.getByRole('dialog', { name: 'Temporary schedule' })).toHaveClass('odc-dgd-schedule-dialog')
    // a driver that is not selected has neither
    const other = screen.getByRole('checkbox', { name: 'Beto Soto' }).closest('li')
    expect(within(other).queryByRole('button', { name: 'Temporary driver' })).not.toBeInTheDocument()
  })

  it('disables the rows while the controller saves', () => {
    draw({ actionState: { loading: true } })
    expect(screen.getByRole('checkbox', { name: 'Ana Ruiz' })).toBeDisabled()
  })

  it('keeps the add form contract: the selection error is shown and describes the rows', () => {
    draw({ selectionError: { id: 'drivers-error', message: 'Choose a driver' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a driver')
    const rows = screen.getAllByRole('group', { name: 'Drivers' }).find(node => node.getAttribute('aria-describedby') === 'drivers-error')
    expect(rows).toBeTruthy()
    expect(rows).toHaveAttribute('tabindex', '-1')
  })

  it('does not name the rows as a group of their own without a selection error', () => {
    const { container } = draw()
    expect(container.querySelector('[aria-describedby]')).toBeNull()
  })
})

// tanda AG (A3-3): the legacy Modal title has `text-transform: capitalize` (Shared/UI/modal.css, shared by every legacy
// modal). This dialog undoes it for its own title only, so the sentence-case copy is what is seen.
describe('DriversGroupDrivers · temporary schedule title', () => {
  it('keeps the title as written', () => {
    const css = readFileSync(resolve(__dirname, '../drivers-group-drivers.css'), 'utf8')
    expect(css).toMatch(/\.odc-dgd-schedule-dialog \.od-modal-title\s*\{[^}]*text-transform:\s*none/)
  })
})
