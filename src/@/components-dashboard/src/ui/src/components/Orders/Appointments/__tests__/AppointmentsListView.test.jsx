/* eslint-disable import/first */
// redesign (decisions 4 and 6): the List view of /appointments, a custom rbc 1.20 view. The month's appointments, grouped by day,
// each one a full-row native button named «professional, range».
import React from 'react'
import moment from 'moment'
import userEvent from '@testing-library/user-event'
import { mergeWithDefaults } from 'react-big-calendar/lib/localizer'
import { Calendar, momentLocalizer, Navigate } from 'react-big-calendar'
import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ configs: { format_time: { value: '24' } }, language: 'en' }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: state.language } }, (_key, fallback) => fallback],
  useConfig: () => [{ configs: state.configs }],
  useUtils: () => [{
    optimizeImage: value => value,
    parseDate: (value, { outputFormat } = {}) => moment(value).format(outputFormat || 'YYYY-MM-DD')
  }]
}))

import { AppointmentsListView, groupAppointmentsByDay } from '../AppointmentsListView'

// as rbc hands it to a view: the base localizer merged with the formats (so 'dayHeaderFormat' is a name, not a moment token)
const localizer = mergeWithDefaults(momentLocalizer(moment), undefined, {}, {})
const accessors = {
  start: event => moment(event.start).toDate(),
  end: event => moment(event.end).toDate()
}
const OCTOBER = new Date(2026, 9, 14, 12, 0, 0)
const professional = (index) => ({ name: 'Ada', lastname: `Test${index}`, photo: index === 1 ? 'photo.png' : null })
const make = (index, start, end) => ({ id: index, start, end, professional: professional(index) })

const events = [
  make(2, '2026-10-14 14:00:00', '2026-10-14 14:45:00'),
  make(0, '2026-10-14 09:00:00', '2026-10-14 09:30:00'),
  make(1, '2026-10-02 08:00:00', '2026-10-02 08:30:00'),
  make(3, '2026-09-30 10:00:00', '2026-09-30 10:30:00'), // another month
  make(4, '2026-11-01 10:00:00', '2026-11-01 10:30:00') // another month
]

const props = (override = {}) => ({
  date: OCTOBER,
  events,
  accessors,
  localizer,
  onSelectEvent: vi.fn(),
  getNow: () => new Date(2026, 9, 14, 8, 0, 0),
  ...override
})

beforeEach(() => {
  state.configs = { format_time: { value: '24' } }
  state.language = 'en'
})

describe('AppointmentsListView statics (what rbc asks of a custom view)', () => {
  it('ranges over the whole month', () => {
    const { start, end } = AppointmentsListView.range(OCTOBER, { localizer })
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(9)
    expect(start.getDate()).toBe(1)
    expect(end.getMonth()).toBe(9)
    expect(end.getDate()).toBe(31)
  })

  it('navigates by month and keeps the date for the rest of the actions', () => {
    expect(AppointmentsListView.navigate(OCTOBER, Navigate.PREVIOUS, { localizer }).getMonth()).toBe(8)
    expect(AppointmentsListView.navigate(OCTOBER, Navigate.NEXT, { localizer }).getMonth()).toBe(10)
    expect(AppointmentsListView.navigate(OCTOBER, Navigate.DATE, { localizer })).toBe(OCTOBER)
    expect(AppointmentsListView.navigate(OCTOBER, Navigate.TODAY, { localizer })).toBe(OCTOBER)
  })

  it('titles the view with the month header format of the localizer', () => {
    expect(AppointmentsListView.title(OCTOBER, { localizer })).toBe(localizer.format(OCTOBER, 'monthHeaderFormat'))
    expect(AppointmentsListView.title(OCTOBER, { localizer })).toBe('October 2026')
  })
})

describe('groupAppointmentsByDay', () => {
  it('groups by day, orders by start and leaves the other months out', () => {
    const range = AppointmentsListView.range(OCTOBER, { localizer })
    const groups = groupAppointmentsByDay(events, { ...range, accessors, localizer })

    expect(groups).toHaveLength(2)
    expect(groups.map(group => group.day.getDate())).toEqual([2, 14])
    expect(groups[1].events.map(event => event.id)).toEqual([0, 2])
    const ids = groups.flatMap(group => group.events).map(event => event.id)
    expect(ids).not.toContain(3)
    expect(ids).not.toContain(4)
  })

  it('gives no groups for a month without appointments', () => {
    const range = AppointmentsListView.range(new Date(2026, 11, 10), { localizer })
    expect(groupAppointmentsByDay(events, { ...range, accessors, localizer })).toEqual([])
  })
})

describe('AppointmentsListView render', () => {
  it('draws one section per day, each labelled by its own heading', () => {
    renderWithProviders(<AppointmentsListView {...props()} />)

    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings).toHaveLength(2)
    expect(headings[0]).toHaveTextContent('Friday Oct 02')
    expect(headings[1]).toHaveTextContent('Wednesday Oct 14')
    const sections = screen.getAllByRole('region')
    expect(sections).toHaveLength(2)
    expect(sections[1]).toHaveAccessibleName(expect.stringContaining('Wednesday Oct 14'))
  })

  it('makes every appointment a native button named professional and range, in order', () => {
    renderWithProviders(<AppointmentsListView {...props()} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons.map(button => button.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON'])
    expect(buttons.every(button => button.getAttribute('type') === 'button')).toBe(true)
    expect(screen.getByRole('button', { name: 'Ada Test0, 09:00 – 09:30' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ada Test2, 14:00 – 14:45' })).toBeInTheDocument()
    const inFirstDay = within(screen.getAllByRole('region')[0]).getAllByRole('button')
    expect(inFirstDay.map(button => button.getAttribute('aria-label'))).toEqual(['Ada Test1, 08:00 – 08:30'])
    const inSecondDay = within(screen.getAllByRole('region')[1]).getAllByRole('button')
    expect(inSecondDay.map(button => button.getAttribute('aria-label'))).toEqual(['Ada Test0, 09:00 – 09:30', 'Ada Test2, 14:00 – 14:45'])
  })

  it('isolates each end of the range and the name from the direction of the page', () => {
    renderWithProviders(<AppointmentsListView {...props()} />)

    const row = screen.getByRole('button', { name: 'Ada Test0, 09:00 – 09:30' })
    const ends = Array.from(row.querySelectorAll('bdi[dir="ltr"]'))
    expect(ends.map(node => node.textContent)).toEqual(['09:00', '09:30'])
    expect(row.querySelector('bdi:not([dir])')).toHaveTextContent('Ada Test0')
  })

  // tanda P: the element that cuts the name with an ellipsis took the page's right-to-left direction and cut a Latin name
  // at its start («…enberger-Hohenlohe»); it takes the direction of the name
  it('lets the element that cuts the name take the direction of the name', () => {
    renderWithProviders(<AppointmentsListView {...props()} />)
    const row = screen.getByRole('button', { name: 'Ada Test0, 09:00 – 09:30' })
    expect(row.querySelector('bdi:not([dir])').parentElement).toHaveAttribute('dir', 'auto')
  })

  // redesign bugs H (W1-QC2-04): in a right-to-left language with 12 h the meridiem is outside the LTR element that holds the digits
  it('keeps the meridiem outside the LTR element in ar, 12 h, and leaves en as it was', () => {
    state.configs = { format_time: { value: '12' } }
    state.language = 'ar'
    const { unmount } = renderWithProviders(<AppointmentsListView {...props()} />)
    const row = screen.getAllByRole('button').find(button => button.getAttribute('aria-label').startsWith('Ada Test2'))
    expect(Array.from(row.querySelectorAll('bdi[dir="ltr"]')).map(node => node.textContent)).toEqual(['02:00', '02:45'])
    expect(within(row).getByText('م').closest('[dir="ltr"]')).toBeNull()
    unmount()

    state.language = 'en'
    renderWithProviders(<AppointmentsListView {...props()} />)
    const rowEn = screen.getAllByRole('button').find(button => button.getAttribute('aria-label').startsWith('Ada Test2'))
    expect(Array.from(rowEn.querySelectorAll('bdi[dir="ltr"]')).map(node => node.textContent.replace(/\s+/g, ' '))).toEqual(['02:00', '02:45 PM'])
  })

  it('keeps the photo and the placeholder icon decorative', () => {
    const { container } = renderWithProviders(<AppointmentsListView {...props()} />)

    const withPhoto = screen.getByRole('button', { name: 'Ada Test1, 08:00 – 08:30' })
    expect(withPhoto.querySelector('img')).toHaveAttribute('alt', '')
    expect(withPhoto.querySelector('[aria-hidden="true"]')).not.toBeNull()
    const withoutPhoto = screen.getByRole('button', { name: 'Ada Test0, 09:00 – 09:30' })
    expect(withoutPhoto.querySelector('img')).toBeNull()
    expect(withoutPhoto.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(container.querySelectorAll('img[alt]:not([alt=""])')).toHaveLength(0)
  })

  it('calls onSelectEvent with the appointment and the DOM event on click', () => {
    const onSelectEvent = vi.fn()
    renderWithProviders(<AppointmentsListView {...props({ onSelectEvent })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ada Test0, 09:00 – 09:30' }))
    expect(onSelectEvent).toHaveBeenCalledTimes(1)
    expect(onSelectEvent.mock.calls[0][0]).toBe(events[1])
    expect(onSelectEvent.mock.calls[0][1]).toBeDefined()
  })

  it('opens the appointment with Enter and Space, as a native button does', async () => {
    const user = userEvent.setup()
    const onSelectEvent = vi.fn()
    renderWithProviders(<AppointmentsListView {...props({ onSelectEvent })} />)

    const row = screen.getByRole('button', { name: 'Ada Test2, 14:00 – 14:45' })
    row.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onSelectEvent).toHaveBeenCalledTimes(2)
    expect(onSelectEvent.mock.calls.every(([event]) => event === events[0])).toBe(true)
  })

  it('writes the range with the 12 h rule of the project', () => {
    state.configs = { format_time: { value: '12' } }
    renderWithProviders(<AppointmentsListView {...props()} />)

    expect(screen.getByRole('button', { name: 'Ada Test0, 09:00 – 09:30 AM' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ada Test2, 02:00 – 02:45 PM' })).toBeInTheDocument()
  })

  it('marks today with the word «Today» beside its day, and only that day', () => {
    renderWithProviders(<AppointmentsListView {...props()} />)

    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings[1]).toHaveTextContent('Today')
    expect(headings[0]).not.toHaveTextContent('Today')
    expect(screen.getAllByText('Today')).toHaveLength(1)
  })

  it('draws no rows for a month without appointments', () => {
    const { container } = renderWithProviders(<AppointmentsListView {...props({ date: new Date(2026, 11, 10) })} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('heading')).toHaveLength(0)
    expect(container.querySelector('[data-empty]')).not.toBeNull()
  })

  it('works as the custom view of rbc', () => {
    const { container } = renderWithProviders(
      <div style={{ height: 600 }}>
        <Calendar
          localizer={localizer}
          date={OCTOBER}
          onNavigate={() => {}}
          view='list'
          onView={() => {}}
          views={{ list: AppointmentsListView }}
          events={events}
          startAccessor={accessors.start}
          endAccessor={accessors.end}
          toolbar={false}
          getNow={() => new Date(2026, 9, 14, 8, 0, 0)}
        />
      </div>
    )

    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(container.querySelector('[data-empty]')).toBeNull()
  })
})
