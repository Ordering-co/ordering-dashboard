/* eslint-disable import/first */
import React from 'react'
import moment from 'moment'
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ configs: { format_time: { value: '24' } }, language: 'en', rtl: undefined }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: state.language, rtl: state.rtl } }, (key, fallback) => fallback || key],
  useUtils: () => [{
    optimizeImage: value => value,
    parseDate: (value, { outputFormat } = {}) => moment(value).format(outputFormat || 'YYYY-MM-DD')
  }],
  useConfig: () => [{ configs: state.configs }]
}))

import { AppointmentsToolbarContext, CalendarHeader } from '../CalendarHeader'
import { EventComponent, MonthEventComponent } from '../EventComponent'

const headerProps = {
  label: 'September 2026',
  view: 'month',
  views: ['month', 'week', 'day', 'list'],
  onView: () => {},
  onNavigate: () => {}
}

describe('Appointments calendar toolbar semantics', () => {
  it('exposes every navigation control as a named native button', () => {
    renderWithProviders(<CalendarHeader {...headerProps} />)

    for (const name of ['Previous', 'Next', 'Today']) {
      const button = screen.getByRole('button', { name })
      expect(button.tagName).toBe('BUTTON')
      expect(button).toHaveAttribute('type', 'button')
    }
  })

  // (decision 3): the views are a segmented control; the group has a name and every option is a native button with text
  it('names the group of views and gives every option a text name as a native button', () => {
    renderWithProviders(<CalendarHeader {...headerProps} />)

    const group = screen.getByRole('group', { name: 'Calendar view' })
    for (const name of ['Month', 'Week', 'Day', 'List']) {
      const option = within(group).getByRole('button', { name })
      expect(option.tagName).toBe('BUTTON')
      expect(option).toHaveAttribute('type', 'button')
      expect(option).toHaveTextContent(name)
    }
  })

  it('announces the active view as pressed instead of colour alone', () => {
    renderWithProviders(<CalendarHeader {...headerProps} />)

    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    for (const name of ['Week', 'Day', 'List']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  // R1-02: the page's context (emptyPeriod) adds a notice to the bar; it must not change the names, roles or state of the controls
  it('keeps the names, roles and pressed state of the controls with the empty-period notice in the bar', () => {
    const summary = () => ({
      buttons: screen.getAllByRole('button').map(button => [button.getAttribute('aria-label') || button.textContent, button.getAttribute('aria-pressed'), button.tagName]),
      group: within(screen.getByRole('group', { name: 'Calendar view' })).getAllByRole('button').map(button => button.textContent),
      live: screen.getByText('September 2026').getAttribute('aria-live')
    })
    const { rerender } = renderWithProviders(<CalendarHeader {...headerProps} />)
    const without = summary()

    rerender(
      <AppointmentsToolbarContext.Provider value={{ emptyPeriod: true }}>
        <CalendarHeader {...headerProps} />
      </AppointmentsToolbarContext.Provider>
    )

    expect(summary()).toEqual(without)
    expect(screen.getByRole('status')).toHaveTextContent('No appointments in this period.')
    expect(within(screen.getByRole('group', { name: 'Calendar view' })).queryByRole('status')).toBeNull()
  })

  it('announces the visible range through a polite live region', () => {
    renderWithProviders(<CalendarHeader {...headerProps} />)

    const label = screen.getByText('September 2026')
    expect(label).toHaveAttribute('aria-live', 'polite')
  })

  // redesign C1a (W1-QC1-05): when the view changes and the focus is lost, it goes to the chosen view
  it('brings a lost focus to the pressed view when the view changes', () => {
    const { rerender } = renderWithProviders(<CalendarHeader {...headerProps} />)
    expect(document.body).toHaveFocus()

    rerender(<CalendarHeader {...headerProps} view='week' />)

    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Week' })).toHaveFocus()
  })

  it('leaves the focus alone when something else has it', () => {
    const { rerender } = renderWithProviders(<CalendarHeader {...headerProps} />)
    const next = screen.getByRole('button', { name: 'Next' })
    next.focus()

    rerender(<CalendarHeader {...headerProps} view='day' />)

    expect(next).toHaveFocus()
  })

  // the rule of the system (C13): when the options do not fit, the group is a native select with the same name; it takes the lost focus
  describe('when the segmented control does not fit', () => {
    let clientWidth
    let offsetWidth
    beforeEach(() => {
      clientWidth = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(100)
      offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(500)
    })
    afterEach(() => {
      clientWidth.mockRestore()
      offsetWidth.mockRestore()
    })

    it('becomes a named select with the four views, and a lost focus goes to it', () => {
      const { rerender } = renderWithProviders(<CalendarHeader {...headerProps} />)
      const select = screen.getByRole('combobox', { name: 'Calendar view' })
      expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['Month', 'Week', 'Day', 'List'])
      expect(select).toHaveValue('month')

      rerender(<CalendarHeader {...headerProps} view='list' />)

      expect(screen.getByRole('combobox', { name: 'Calendar view' })).toHaveValue('list')
      expect(screen.getByRole('combobox', { name: 'Calendar view' })).toHaveFocus()
    })
  })
})

const appointment = { start: '2026-09-17 09:00:00', end: '2026-09-17 09:30:00', professional: { name: 'Grace', lastname: 'Hopper', photo: 'photo.png' } }

beforeEach(() => {
  state.configs = { format_time: { value: '24' } }
  state.language = 'en'
  state.rtl = undefined
})

describe('Appointments event summary', () => {
  it('keeps the professional photo decorative and the name as the readable content', () => {
    const { container } = renderWithProviders(<EventComponent event={appointment} />)

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"] img')).toHaveAttribute('alt', '')
    // R1-05: the range goes first, so a narrow column of the week still shows the hour before it cuts the name
    expect(container.querySelector('.appointments-event-inline')).toHaveTextContent('09:00 – 09:30 · Grace Hopper')
  })

  // redesign (decision 6; R1-05 reorders it): week and day events are ONE line «range · name» with an ellipsis, and the full text in `title`
  it('writes the week and day event as one line with the full text in the title', () => {
    const { container } = renderWithProviders(<EventComponent event={appointment} />)

    const inline = container.querySelector('.appointments-event-inline')
    expect(inline).toHaveAttribute('title', '09:00 – 09:30 · Grace Hopper')
    expect(inline.querySelector('p')).toBeNull()
    const line = inline.querySelector('[data-event-line]')
    expect(line).toHaveTextContent('09:00 – 09:30 · Grace Hopper')
    expect(line.textContent.startsWith('09:00')).toBe(true)
    expect(window.getComputedStyle(line).overflow).toBe('hidden')
  })

  // tanda P: the ellipsis cut the hour itself («04:00 – 04:4…»). Only the name ends in an ellipsis; the range is never
  // cut: each end keeps its line (it breaks at the dash only when it does not fit) and the name comes after it
  it('never cuts the range of a week or day event: only the name ends in an ellipsis', () => {
    const { container } = renderWithProviders(<EventComponent event={appointment} />)

    const hours = container.querySelector('[data-event-line] [data-event-hours]')
    const name = container.querySelector('[data-event-line] [data-event-name]')
    expect(hours).toHaveTextContent('09:00 – 09:30')
    expect(window.getComputedStyle(hours).textOverflow).not.toBe('ellipsis')
    expect(window.getComputedStyle(hours).flexWrap).toBe('wrap')
    Array.from(hours.children).forEach(end => expect(window.getComputedStyle(end).whiteSpace).toBe('nowrap'))
    expect(name).toHaveTextContent('· Grace Hopper')
    expect(window.getComputedStyle(name).textOverflow).toBe('ellipsis')
    expect(window.getComputedStyle(name).whiteSpace).toBe('nowrap')
    expect(window.getComputedStyle(container.querySelector('[data-event-line]')).flexWrap).toBe('wrap')
  })

  // redesign C1a (W1-QC1-08): each hour is isolated and the name is in a bdi, so a right-to-left page never reorders them
  it('isolates each hour and the name from the direction of the page', () => {
    const { container } = renderWithProviders(<EventComponent event={appointment} />)

    const hours = Array.from(container.querySelectorAll('.appointments-event-inline bdi[dir="ltr"]'))
    expect(hours.map(node => node.textContent)).toEqual(['09:00', '09:30'])
    expect(container.querySelector('.appointments-event-inline bdi:not([dir])')).toHaveTextContent('Grace Hopper')
  })

  // the month keeps the two lines of today: name, then the range, each end in its own bdi
  it('keeps the month event in two lines with the range in the second one', () => {
    const { container } = renderWithProviders(<MonthEventComponent event={appointment} />)

    expect(container.querySelector('p.name bdi')).toHaveTextContent('Grace Hopper')
    expect(container.querySelector('p.date')).toHaveTextContent('09:00 – 09:30')
    const hours = Array.from(container.querySelectorAll('p.date bdi'))
    expect(hours.map(node => node.textContent)).toEqual(['09:00', '09:30'])
    expect(hours.every(node => node.getAttribute('dir') === 'ltr')).toBe(true)
  })

  // redesign C1a (W1-QC1-07, W1-PC1-05): 12 h only with format_time '12'; no config is 24 h, as main showed the events
  // (in 12 h the first end drops the meridiem when both share it)
  it.each([
    [{ format_time: { value: '12' } }, '09:00 – 09:30 AM'],
    [{ format_time: { value: '24' } }, '09:00 – 09:30'],
    [{}, '09:00 – 09:30']
  ])('writes the range of the event with %j as %s', (configs, text) => {
    state.configs = configs
    const { container } = renderWithProviders(<EventComponent event={appointment} />)
    expect(container.querySelector('.appointments-event-inline')).toHaveTextContent(`${text} · Grace Hopper`)
  })

  it('keeps both meridiems when the range crosses noon', () => {
    state.configs = { format_time: { value: '12' } }
    const { container } = renderWithProviders(<EventComponent event={{ ...appointment, start: '2026-09-17 11:30:00', end: '2026-09-17 12:15:00' }} />)
    expect(container.querySelector('.appointments-event-inline')).toHaveTextContent('11:30 AM – 12:15 PM')
  })

  // redesign C1a (W1-QC1-12): the meridiem is the one Intl writes for the language, never the English «AM»
  it('writes the meridiem of the language of the user in 12 h', () => {
    state.configs = { format_time: { value: '12' } }
    state.language = 'es'
    const { container } = renderWithProviders(<EventComponent event={{ ...appointment, start: '2026-09-17 15:00:00', end: '2026-09-17 15:30:00' }} />)
    const text = container.querySelector('.appointments-event-inline').textContent
    expect(text).toMatch(/03:00\s?–\s?03:30 p\.\s?m\./i)
    expect(text).not.toMatch(/\bPM\b/)
  })

  // redesign bugs H (W1-QC2-04): in Arabic with 12 h the meridiem («م») was inside the `<bdi dir='ltr'>` of the end, drawn to the right of the
  // digits and read first. Only the digits stay in the LTR bdi; the meridiem is outside it. Other languages and 24 h are unchanged.
  describe('the meridiem of a right-to-left language (W1-QC2-04)', () => {
    const afternoon = { ...appointment, start: '2026-09-17 15:00:00', end: '2026-09-17 15:30:00' }
    const hoursOf = (container) => Array.from(container.querySelectorAll('.appointments-event-inline bdi[dir="ltr"]'))

    it.each([
      ['inline', EventComponent, '.appointments-event-inline'],
      ['month', MonthEventComponent, 'p.date']
    ])('keeps the meridiem outside the LTR element in ar, 12 h (%s)', (_name, Component, selector) => {
      state.configs = { format_time: { value: '12' } }
      state.language = 'ar'
      const { container } = renderWithProviders(<Component event={afternoon} />)
      const line = container.querySelector(selector)
      const isolated = Array.from(line.querySelectorAll('bdi[dir="ltr"]'))
      expect(isolated.map(node => node.textContent)).toEqual(['03:00', '03:30'])
      const meridiem = within(line).getByText('م')
      expect(meridiem.closest('[dir="ltr"]')).toBeNull()
      expect(isolated.some(node => node.textContent.includes('م'))).toBe(false)
      // the same text for the accessible name and the title, in the same logical order
      expect(line.textContent.replace(/\s+/g, ' ')).toContain('03:00 – 03:30 م')
    })

    it('uses the flag of the language when the context carries it', () => {
      state.configs = { format_time: { value: '12' } }
      state.language = 'en'
      state.rtl = true
      const { container } = renderWithProviders(<EventComponent event={afternoon} />)
      expect(hoursOf(container).map(node => node.textContent)).toEqual(['03:00', '03:30'])
      expect(within(container.querySelector('.appointments-event-inline')).getByText('PM').closest('[dir="ltr"]')).toBeNull()
    })

    it('keeps the whole clock in the LTR element in 24 h (no meridiem), in ar', () => {
      state.language = 'ar'
      const { container } = renderWithProviders(<EventComponent event={afternoon} />)
      expect(hoursOf(container).map(node => node.textContent)).toEqual(['15:00', '15:30'])
    })

    it.each([['en', 'PM'], ['es', 'p. m.']])('leaves %s unchanged: the end is one LTR element with its meridiem', (language, meridiem) => {
      state.configs = { format_time: { value: '12' } }
      state.language = language
      const { container } = renderWithProviders(<EventComponent event={afternoon} />)
      const ends = hoursOf(container).map(node => node.textContent.replace(/\s+/g, ' '))
      expect(ends[0]).toBe('03:00')
      expect(ends[1]).toBe(`03:30 ${meridiem}`)
    })
  })

  // redesign C1a (W1-QC1-02): the month's event is the only plain div of rbc: it becomes a named, focusable button
  it('names the month event with the professional and the time and makes it focusable', () => {
    const { container } = renderWithProviders(<MonthEventComponent event={appointment} />)

    const button = screen.getByRole('button', { name: 'Grace Hopper, 09:00 – 09:30' })
    expect(button).toHaveAttribute('tabindex', '0')
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(1)
  })

  it('does not nest a second button inside the week and day events, which rbc already makes buttons', () => {
    const { container } = renderWithProviders(<EventComponent event={appointment} />)
    expect(container.querySelector('[role="button"], button')).toBeNull()
  })
})
