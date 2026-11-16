/* eslint-disable import/first */
// redesign F2 (C18): inside the orders surfaces the driver list is a FirstSelect with brand rows: group
// labels as headings, the person's picture at 20px, the assigned orders as a muted second column, and
// «Remove assigned driver» as the dangerous action. Outside them the list is what it was.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const state = vi.hoisted(() => ({
  driversList: { loading: false, drivers: [] },
  legacy: vi.fn(),
  first: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: 0 } }],
  DriversList: ({ UIComponent, ...props }) => (
    <UIComponent {...props} driversList={state.driversList} driverActionStatus={{}} companyActionStatus={{}} handleAssignDriver={vi.fn()} />
  )
}))

const Options = ({ name, spy, options, ...props }) => {
  spy({ options, ...props })
  return (
    <div data-testid={name}>
      <ul>{options.map((option, index) => <li key={index} data-value={String(option.value)}>{option.content}</li>)}</ul>
    </div>
  )
}

vi.mock('../../../../styles/Select', () => ({ Select: props => <Options name='legacy-select' spy={state.legacy} {...props} /> }))
vi.mock('../../../../styles/Select/FirstSelect', () => ({ Select: props => <Options name='first-select' spy={state.first} {...props} /> }))

import { DriverSelector } from '..'
import { SelectSurfaceContext } from '../../../Shared/UI/selectPlacement'

const driver = (id, extra = {}) => ({ id, name: `Dan${id}`, lastname: 'Driver', enabled: true, available: true, busy: false, assigned_orders_count: 2, photo: null, ...extra })

const renderSelector = (surface, props = {}) => render(
  <ThemeProvider theme={{ ...createDashboardTheme(theme), images: {} }}>
    <SelectSurfaceContext.Provider value={surface}>
      <DriverSelector order={{ id: 42 }} orderId={42} defaultValue='default' small isPhoneView {...props} />
    </SelectSurfaceContext.Provider>
  </ThemeProvider>
)

const lastOptions = spy => spy.mock.calls.at(-1)[0].options

describe('DriverSelector inside the orders surfaces (C18)', () => {
  const drivers = [driver(1), driver(2, { busy: true }), driver(3, { available: false })]

  it('is a FirstSelect even when the caller did not ask for isFirstSelect', () => {
    state.driversList = { loading: false, drivers }
    state.legacy.mockClear()
    renderSelector({ fitTrigger: true })
    expect(screen.getByTestId('first-select')).toBeInTheDocument()
    expect(screen.queryByTestId('legacy-select')).toBeNull()
  })

  it('marks the group labels and the dangerous action for the select', () => {
    state.driversList = { loading: false, drivers }
    renderSelector({ fitTrigger: true }, { defaultValue: 1 })
    const options = lastOptions(state.first)
    expect(options.filter(option => option.group).map(option => option.value)).toEqual(['available', 'busy', 'not_available'])
    expect(options.find(option => option.value === 'remove')).toMatchObject({ danger: true })
    expect(options.filter(option => option.danger)).toHaveLength(1)
  })

  it('keeps the values, the disabled rules and the order of the drivers', () => {
    state.driversList = { loading: false, drivers }
    renderSelector({ fitTrigger: true })
    const options = lastOptions(state.first)
    expect(options.filter(option => typeof option.value === 'number').map(option => [option.value, !!option.disabled])).toEqual([[1, false], [2, true], [3, true]])
  })

  it('shows the assigned orders as a muted second column, not in parentheses', () => {
    state.driversList = { loading: false, drivers: [driver(1)] }
    const { container } = renderSelector({ fitTrigger: true })
    const row = container.querySelector('[data-value="1"]')
    expect(row.querySelector('.odc-so-label')).toHaveTextContent('Dan1 Driver')
    expect(row.querySelector('.odc-so-meta')).toHaveTextContent('2 assigned orders')
    expect(row.textContent).not.toMatch(/[()]/)
  })

  // redesign F6c (Q2-19): «1 Assigned orders» is «1 assigned order»; the plural and the case follow the count.
  it.each([
    [0, '0 assigned orders'],
    [1, '1 assigned order'],
    [2, '2 assigned orders'],
    [13, '13 assigned orders']
  ])('says «%s» assigned orders as «%s»', (count, text) => {
    state.driversList = { loading: false, drivers: [driver(1, { assigned_orders_count: count })] }
    const { container } = renderSelector({ fitTrigger: true })
    expect(container.querySelector('[data-value="1"] .odc-so-meta').textContent).toBe(text)
  })

  it('shows no count when the driver has none', () => {
    state.driversList = { loading: false, drivers: [driver(1, { assigned_orders_count: undefined })] }
    const { container } = renderSelector({ fitTrigger: true })
    expect(container.querySelector('[data-value="1"] .odc-so-meta')).toBeNull()
  })

  // redesign F6c (P3-02): the removal is the second row of the list (after the hidden placeholder), as in `main`.
  it('puts the removal of the assigned driver before every driver and group', () => {
    state.driversList = { loading: false, drivers }
    renderSelector({ fitTrigger: true }, { defaultValue: 1 })
    const values = lastOptions(state.first).filter(option => !option.showDisable).map(option => option.value)
    expect(values.slice(0, 2)).toEqual(['remove', 'available'])
  })

  it('asks for the search field, with the few drivers of a small project too', () => {
    state.driversList = { loading: false, drivers: [driver(1)] }
    renderSelector({ fitTrigger: true })
    expect(state.first.mock.calls.at(-1)[0].isShowSearchBar).toBe(true)
  })

  it('the field shows the person without the secondary data', () => {
    state.driversList = { loading: false, drivers: [driver(1)] }
    renderSelector({ fitTrigger: true })
    const option = lastOptions(state.first).find(entry => entry.value === 1)
    const { container } = render(<>{option.showOnSelected}</>)
    expect(container.querySelector('.odc-so-label')).toHaveTextContent('Dan1 Driver')
    expect(container.querySelector('.odc-so-meta')).toBeNull()
  })

  it('draws the group label as plain text, without the legacy block', () => {
    state.driversList = { loading: false, drivers: [driver(1)] }
    const { container } = renderSelector({ fitTrigger: true })
    const group = container.querySelector('[data-value="available"]')
    expect(group).toHaveTextContent('Available')
    expect(group.children).toHaveLength(1)
    expect(group.firstElementChild.tagName).toBe('SPAN')
  })
})

// redesign F6e-2 (Q4-02, P5-03): the selector says which driver its field shows (`onSelectedShown`), so the panel hides the
// driver card by id, not by comparing texts; and the field of the assigned driver carries the full name.
describe('DriverSelector reports what its field shows (Q4-02)', () => {
  const assigned = { id: 9, name: 'Marco ', lastname: 'Test', enabled: true, available: true, busy: false, assigned_orders_count: 1 }
  const order = { id: 42, driver_id: 9, driver: { id: 9, name: 'Marco ', middle_name: 'Aurelio', lastname: 'Test', second_lastname: 'Gomez' } }

  it('reports the id once the list is drawn with that driver in it', () => {
    state.driversList = { loading: false, drivers: [assigned, driver(3)] }
    const onSelectedShown = vi.fn()
    renderSelector({ fitTrigger: true }, { defaultValue: 9, order, onSelectedShown })
    expect(onSelectedShown).toHaveBeenLastCalledWith(9)
  })

  it('reports null while the drivers are loading, and the driver is not claimed by «loading…»', () => {
    state.driversList = { loading: true, drivers: [] }
    const onSelectedShown = vi.fn()
    renderSelector({ fitTrigger: true }, { defaultValue: 9, order, onSelectedShown })
    expect(onSelectedShown).toHaveBeenLastCalledWith(null)
    expect(onSelectedShown).not.toHaveBeenCalledWith(9)
  })

  it('reports null when the driver is not among the options (the card has to stay)', () => {
    state.driversList = { loading: false, drivers: [driver(3)] }
    const onSelectedShown = vi.fn()
    renderSelector({ fitTrigger: true }, { defaultValue: 9, order, onSelectedShown })
    expect(onSelectedShown).toHaveBeenLastCalledWith(null)
    expect(onSelectedShown).not.toHaveBeenCalledWith(9)
  })

  it('reports null with nobody assigned, for the placeholder is not a driver', () => {
    state.driversList = { loading: false, drivers: [driver(3)] }
    const onSelectedShown = vi.fn()
    renderSelector({ fitTrigger: true }, { defaultValue: 'default', onSelectedShown })
    expect(onSelectedShown).toHaveBeenLastCalledWith(null)
  })

  it('follows a reassignment and says null when it goes away', () => {
    state.driversList = { loading: false, drivers: [assigned, driver(3)] }
    const onSelectedShown = vi.fn()
    const tree = (defaultValue) => (
      <ThemeProvider theme={{ ...createDashboardTheme(theme), images: {} }}>
        <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>
          <DriverSelector order={order} orderId={42} defaultValue={defaultValue} onSelectedShown={onSelectedShown} small isPhoneView />
        </SelectSurfaceContext.Provider>
      </ThemeProvider>
    )
    const view = render(tree(9))
    expect(onSelectedShown).toHaveBeenLastCalledWith(9)
    view.rerender(tree(3))
    expect(onSelectedShown).toHaveBeenLastCalledWith(3)
    view.unmount()
    expect(onSelectedShown).toHaveBeenLastCalledWith(null)
  })

  it('draws the rows with the name on one line, whatever spaces the API sends', () => {
    state.driversList = { loading: false, drivers: [assigned] }
    const { container } = renderSelector({ fitTrigger: true }, { defaultValue: 9, order })
    expect(container.querySelector('[data-value="9"] .odc-so-label').textContent).toBe('Marco Test')
  })

  it('puts the full name of the assigned driver in the field and in its title, and keeps the rows short (P5-03)', () => {
    state.driversList = { loading: false, drivers: [assigned, driver(3)] }
    renderSelector({ fitTrigger: true }, { defaultValue: 9, order })
    const option = lastOptions(state.first).find(entry => entry.value === 9)
    const field = render(<>{option.showOnSelected}</>).container
    expect(field.querySelector('.odc-so-label').textContent).toBe('Marco Aurelio Test Gomez')
    expect(field.querySelector('[title]')).toHaveAttribute('title', 'Marco Aurelio Test Gomez')
    const row = render(<>{option.content}</>).container
    expect(row.querySelector('.odc-so-label').textContent).toBe('Marco Test')
    // another driver is not the assigned one: nothing of the order's driver leaks into it
    const other = lastOptions(state.first).find(entry => entry.value === 3)
    expect(render(<>{other.showOnSelected}</>).container.querySelector('.odc-so-label').textContent).toBe('Dan3 Driver')
  })
})

describe('DriverSelector outside the orders surfaces', () => {
  it('is the legacy select, with the legacy rows', () => {
    state.driversList = { loading: false, drivers: [driver(1)] }
    const { container } = renderSelector({})
    expect(screen.getByTestId('legacy-select')).toBeInTheDocument()
    expect(container.querySelector('[data-value="1"]')).toHaveTextContent('Dan1 Driver (2 Assigned orders)')
  })
})
