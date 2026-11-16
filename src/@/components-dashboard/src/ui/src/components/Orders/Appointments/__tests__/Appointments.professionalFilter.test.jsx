/* eslint-disable import/first */
// redesign apply-list row 23 (appointments P-2): the agenda is filtered by professional, client side, from the `professional` each
// appointment already carries. The helpers are pure; the page keeps the choice, the toolbar draws the control.
import React from 'react'
import moment from 'moment'
import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ configs: { appointments: { value: true }, format_time: { value: '24' } } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useConfig: () => [{ configs: state.configs }],
  useUtils: () => [{
    optimizeImage: value => value,
    parseDate: (value, { outputFormat } = {}) => moment(value).format(outputFormat || 'YYYY-MM-DD')
  }],
  Appointments: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))
vi.mock('../../../Stores/BusinessSelectHeader', () => ({ BusinessSelectHeader: () => null }))
vi.mock('../../OrderDetails', () => ({ OrderDetails: () => null }))
vi.mock('../../../Shared', () => ({ SpinnerLoader: () => <span>spinner</span> }))

import { Appointments } from '../index'
import { AppointmentsToolbarContext, CalendarHeader } from '../CalendarHeader'
import { filterByProfessional, professionalOptions } from '../professionalFilter'

const grace = { id: 1, order_id: 11, start: '2026-10-13 15:00:00', end: '2026-10-13 15:30:00', professional: { id: 7, name: 'Grace', lastname: 'Hopper', photo: null } }
const ada = { id: 2, order_id: 12, start: '2026-10-14 10:00:00', end: '2026-10-14 10:30:00', professional: { id: 3, name: 'Ada', lastname: 'Lovelace', photo: null } }
const graceAgain = { id: 3, order_id: 13, start: '2026-10-15 09:00:00', end: '2026-10-15 09:30:00', professional: { id: 7, name: 'Grace', lastname: 'Hopper', photo: null } }
const anonymous = { id: 4, order_id: 14, start: '2026-10-16 09:00:00', end: '2026-10-16 09:30:00' }

describe('professionalOptions', () => {
  it('lists each professional once, sorted by name, labelled with name and lastname', () => {
    expect(professionalOptions([grace, ada, graceAgain])).toEqual([
      { value: '3', label: 'Ada Lovelace' },
      { value: '7', label: 'Grace Hopper' }
    ])
  })

  it('skips appointments without a professional and keeps the label of one with no lastname', () => {
    expect(professionalOptions([anonymous, { ...grace, professional: { id: 9, name: 'Cher' } }])).toEqual([{ value: '9', label: 'Cher' }])
  })

  // review J4 #2: two professionals with the same name would be two identical options; their number tells them apart
  it('adds the number to the label of professionals who share a name', () => {
    const alex13 = { ...grace, professional: { id: 13, name: 'Alex', lastname: 'Kim' } }
    const alex14 = { ...ada, professional: { id: 14, name: 'Alex', lastname: 'Kim' } }
    expect(professionalOptions([alex14, grace, alex13])).toEqual([
      { value: '13', label: 'Alex Kim · #13' },
      { value: '14', label: 'Alex Kim · #14' },
      { value: '7', label: 'Grace Hopper' }
    ])
  })

  it('answers an empty list when no appointment carries a professional, or there are no appointments', () => {
    expect(professionalOptions([anonymous])).toEqual([])
    expect(professionalOptions([])).toEqual([])
    expect(professionalOptions(undefined)).toEqual([])
  })
})

describe('filterByProfessional', () => {
  const events = [grace, ada, graceAgain, anonymous]

  it('returns the very same list with no professional chosen', () => {
    expect(filterByProfessional(events, null)).toBe(events)
    expect(filterByProfessional(events, '')).toBe(events)
  })

  it('keeps only the appointments of the chosen professional, in order', () => {
    expect(filterByProfessional(events, '7')).toEqual([grace, graceAgain])
    expect(filterByProfessional(events, 3)).toEqual([ada])
  })

  it('answers an empty list for a professional that has no appointment, and for no list at all', () => {
    expect(filterByProfessional(events, '99')).toEqual([])
    expect(filterByProfessional(undefined, '7')).toEqual([])
  })
})

// The professional of an appointment may come without its id (nothing in orderingv1 shows the real shape; the W1-7b fixture has
// none): then the name is what tells two professionals apart, so the filter still works.
describe('professionals without an id', () => {
  const noId = (event) => ({ ...event, professional: { name: event.professional.name, lastname: event.professional.lastname, photo: null } })
  const events = [noId(grace), noId(ada), noId(graceAgain), anonymous]

  it('lists them by their name, once each', () => {
    expect(professionalOptions(events)).toEqual([
      { value: 'name:Ada Lovelace', label: 'Ada Lovelace' },
      { value: 'name:Grace Hopper', label: 'Grace Hopper' }
    ])
  })

  it('filters them by that name', () => {
    expect(filterByProfessional(events, 'name:Grace Hopper')).toEqual([events[0], events[2]])
  })

  it('skips one with neither id nor name', () => {
    expect(professionalOptions([{ ...grace, professional: { photo: null } }])).toEqual([])
  })
})

describe('Appointments toolbar professional control', () => {
  const headerProps = { label: 'October 2026', view: 'month', views: ['month', 'week', 'day', 'list'], onView: vi.fn(), onNavigate: vi.fn() }
  const options = [{ value: '3', label: 'Ada Lovelace' }, { value: '7', label: 'Grace Hopper' }]

  it('draws a named native select with All professionals first, in the bar between the notice gap and the views', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <AppointmentsToolbarContext.Provider value={{ emptyPeriod: false, professional: { options, value: '', onChange } }}>
        <CalendarHeader {...headerProps} />
      </AppointmentsToolbarContext.Provider>
    )
    const select = screen.getByRole('combobox', { name: 'Professional' })
    expect(select.tagName).toBe('SELECT')
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['All professionals', 'Ada Lovelace', 'Grace Hopper'])
    expect(select).toHaveValue('')
    const bar = screen.getByRole('button', { name: 'Today' }).parentElement.parentElement
    const slot = bar.querySelector('[data-toolbar-notice]')
    const group = screen.getByRole('group', { name: 'Calendar view' })
    const at = node => Array.from(bar.children).findIndex(child => child.contains(node))
    expect(at(slot)).toBeLessThan(at(select))
    expect(at(select)).toBeLessThan(at(group))
    fireEvent.change(select, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith('7')
  })

  it('draws no control when the page offers none', () => {
    renderWithProviders(<CalendarHeader {...headerProps} />)
    expect(screen.queryByRole('combobox', { name: 'Professional' })).toBeNull()
  })

  it('says there are no appointments for that professional, not the generic text, when the page says so', () => {
    renderWithProviders(
      <AppointmentsToolbarContext.Provider value={{ emptyPeriod: true, professional: { options, value: '7', onChange: vi.fn() } }}>
        <CalendarHeader {...headerProps} />
      </AppointmentsToolbarContext.Provider>
    )
    expect(screen.getByText('No appointments for this professional.').closest('.odc-notice')).toHaveAttribute('data-tone', 'info')
    expect(screen.queryByText('No appointments in this period.')).toBeNull()
  })
})

describe('Appointments page professional filter', () => {
  const business = { id: 9, name: 'Subway' }
  const base = { setSelectedBusiness: vi.fn(), refreshCalendarEvents: vi.fn() }
  const withEvents = (result, selectedBusiness = business) => ({
    ...base,
    selectedBusiness,
    businessCalendarEvents: { loading: false, result, error: null, businessId: selectedBusiness.id }
  })
  const graceButton = 'Grace Hopper, 15:00 – 15:30'
  const adaButton = 'Ada Lovelace, 10:00 – 10:30'
  const selectOf = () => screen.getByRole('combobox', { name: 'Professional' })
  const choose = value => fireEvent.change(selectOf(), { target: { value } })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0)) // Wednesday 7 October 2026
  })
  afterEach(() => { vi.useRealTimers() })

  it('offers All professionals (chosen) and one option per professional of the loaded appointments', () => {
    renderWithProviders(<Appointments {...withEvents([grace, ada, graceAgain])} />)
    expect(selectOf()).toHaveValue('')
    expect(within(selectOf()).getAllByRole('option').map(option => option.textContent)).toEqual(['All professionals', 'Ada Lovelace', 'Grace Hopper'])
    expect(screen.getByRole('button', { name: graceButton })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: adaButton })).toBeInTheDocument()
  })

  it('hides the control when no loaded appointment has a professional', () => {
    renderWithProviders(<Appointments {...withEvents([anonymous])} />)
    expect(screen.queryByRole('combobox', { name: 'Professional' })).toBeNull()
  })

  it('gives the month calendar only the appointments of the chosen professional, and All brings them back', () => {
    renderWithProviders(<Appointments {...withEvents([grace, ada])} />)
    choose('3')
    expect(screen.getByRole('button', { name: adaButton })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: graceButton })).toBeNull()
    choose('')
    expect(screen.getByRole('button', { name: graceButton })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: adaButton })).toBeInTheDocument()
  })

  it('gives the List view only the appointments of the chosen professional and keeps the choice across views', () => {
    renderWithProviders(<Appointments {...withEvents([grace, ada])} />)
    choose('7')
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(selectOf()).toHaveValue('7')
    expect(screen.getByRole('button', { name: graceButton })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: adaButton })).toBeNull()
  })

  it('tells the empty period with the professional text when the filter leaves nothing in the range, and the generic one without it', () => {
    renderWithProviders(<Appointments {...withEvents([grace, ada])} />)
    expect(screen.queryByText('No appointments in this period.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('No appointments in this period.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    choose('3')
    expect(screen.queryByText('No appointments for this professional.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('No appointments for this professional.')).toBeInTheDocument()
    expect(screen.queryByText('No appointments in this period.')).toBeNull()
  })

  it('uses the filtered list for the empty period: Grace has appointments in the month, Ada none in the next one', () => {
    renderWithProviders(<Appointments {...withEvents([grace, { ...ada, start: '2026-11-03 10:00:00', end: '2026-11-03 10:30:00' }])} />)
    choose('3')
    // October holds Grace's appointment only, so Ada's filter leaves the month empty
    expect(screen.getByText('No appointments for this professional.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByText('No appointments for this professional.')).toBeNull()
  })

  it('goes back to All professionals when the business changes', () => {
    const { rerender } = renderWithProviders(<Appointments {...withEvents([grace, ada])} />)
    choose('3')
    expect(selectOf()).toHaveValue('3')
    const other = { id: 10, name: 'Burger' }
    rerender(<Appointments {...withEvents([grace, ada], other)} />)
    expect(selectOf()).toHaveValue('')
    expect(screen.getByRole('button', { name: graceButton })).toBeInTheDocument()
  })

  it('keeps the choice and shows the empty period when that professional is no longer in the loaded appointments', () => {
    const { rerender } = renderWithProviders(<Appointments {...withEvents([grace, ada])} />)
    choose('3')
    rerender(<Appointments {...withEvents([grace])} />)
    expect(selectOf()).toHaveValue('3')
    expect(within(selectOf()).getByRole('option', { name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: graceButton })).toBeNull()
    expect(screen.getByText('No appointments for this professional.')).toBeInTheDocument()
  })

  it('does not put the choice in the URL', () => {
    const before = window.location.href
    renderWithProviders(<Appointments {...withEvents([grace, ada])} />)
    choose('3')
    expect(window.location.href).toBe(before)
  })
})
