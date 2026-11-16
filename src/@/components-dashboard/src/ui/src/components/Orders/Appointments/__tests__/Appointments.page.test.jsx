/* eslint-disable import/first */
// redesign W1-7 (T1-7-4, b): the page header, the business selector as its action, the toolbar on Product buttons,
// the empty state without a business and no leftover legacy imports.
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import moment from 'moment'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ configs: { appointments: { value: true }, format_time: { value: '24' } }, isCollapse: false }))

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
  useInfoShare: () => [{ isCollapse: state.isCollapse }, { handleMenuCollapse: state.handleMenuCollapse }]
}))
vi.mock('../../../Stores/BusinessSelectHeader', () => ({
  BusinessSelectHeader: ({ changeBusinessState }) => (
    <div data-testid='business-dropdown'>
      <button type='button' onClick={() => changeBusinessState({ id: 9, name: 'Subway' })}>Pick Subway</button>
    </div>
  )
}))
vi.mock('../../OrderDetails', () => ({
  OrderDetails: ({ onClose, orderId }) => (
    <div role='dialog' aria-label={`Appointment ${orderId}`}>
      <button type='button' onClick={onClose}>Close panel</button>
    </div>
  )
}))
vi.mock('../../../Shared', () => ({ SpinnerLoader: () => <span>spinner</span> }))

import { momentLocalizer } from 'react-big-calendar'
import { Appointments, earliestScrollTime, rangeOf } from '../index'
import { AppointmentsToolbarContext, CalendarHeader } from '../CalendarHeader'

const base = { setSelectedBusiness: vi.fn(), refreshCalendarEvents: vi.fn(), businessCalendarEvents: { loading: false, result: [], error: null } }

beforeEach(() => {
  state.configs = { appointments: { value: true }, format_time: { value: '24' } }
  state.isCollapse = false
  state.handleMenuCollapse = vi.fn()
  base.setSelectedBusiness = vi.fn()
  base.refreshCalendarEvents = vi.fn()
})

describe('Appointments page header and empty state', () => {
  it('draws the title as the Product page header h1 with the business selector as its action', () => {
    const { container } = renderWithProviders(<Appointments {...base} selectedBusiness={null} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Appointments' })).toHaveClass('odc-pagehead-title')
    // (decision 1): the «Calendar» crumb under the title is gone
    expect(container.querySelector('.odc-pagehead-description')).toBeNull()
    const picker = container.querySelector('.odc-pagehead-actions button[aria-haspopup="true"]')
    expect(picker).toHaveClass('odc-btn')
    expect(picker).toHaveAttribute('aria-expanded', 'false')
    expect(picker).toHaveTextContent('Select a business')
  })

  it('asks for a business instead of drawing an empty calendar, and picks nothing by itself', () => {
    const { container } = renderWithProviders(<Appointments {...base} selectedBusiness={null} />)
    const state$ = container.querySelector('.odc-state')
    expect(state$).toHaveTextContent('Select a business to see its appointments')
    expect(container.querySelector('.rbc-calendar')).toBeNull()
    expect(base.setSelectedBusiness).not.toHaveBeenCalled()
    // its action opens the shared selector; choosing there is what sets the business
    const emptyStateButton = within(state$).getByRole('button', { name: 'Select a business' })
    expect(emptyStateButton).toHaveAttribute('aria-haspopup', 'true')
    expect(emptyStateButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(emptyStateButton)
    expect(emptyStateButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('business-dropdown')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pick Subway' }))
    expect(base.setSelectedBusiness).toHaveBeenCalledWith({ id: 9, name: 'Subway' })
  })

  it('draws the calendar, named, once a business is chosen', () => {
    const { container } = renderWithProviders(<Appointments {...base} selectedBusiness={{ id: 9, name: 'Subway' }} />)
    expect(container.querySelector('.odc-state')).toBeNull()
    expect(screen.getByRole('region', { name: 'Calendar' }).querySelector('.rbc-calendar')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Subway' })).toHaveAttribute('title', 'Subway')
  })

  // main: appointments are for every project, so no `appointments` config hides the selector
  it.each([{}, { appointments: { value: false } }])('offers the business selector without the feature notice with configs %j', (configs) => {
    state.configs = configs
    const { container } = renderWithProviders(<Appointments {...base} selectedBusiness={null} />)
    expect(screen.queryByText('The appointments feature is not enabled.')).not.toBeInTheDocument()
    expect(container.querySelector('.odc-pagehead-actions button[aria-haspopup]')).not.toBeNull()
    expect(screen.getByText('Select a business to see its appointments')).toBeInTheDocument()
  })

  // the opener is PageHeader's `leading`: the first child of the lead block, before the title
  it('draws the open-menu button as the first child of the header lead block with the sidebar collapsed', () => {
    state.isCollapse = true
    renderWithProviders(<Appointments {...base} selectedBusiness={null} />)
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    expect(opener).toHaveClass('odc-btn')
    fireEvent.click(opener)
    expect(state.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('draws no open-menu button with the sidebar expanded', () => {
    renderWithProviders(<Appointments {...base} selectedBusiness={null} />)
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
  })
})

describe('Appointments toolbar on Product controls', () => {
  const headerProps = { label: 'October 2026', view: 'week', views: ['month', 'week', 'day', 'list'], onView: vi.fn(), onNavigate: vi.fn() }

  beforeEach(() => {
    headerProps.onView = vi.fn()
    headerProps.onNavigate = vi.fn()
  })

  it('names the navigation controls with aria-label and title, with Lucide icons and no tooltip', () => {
    const { container } = renderWithProviders(<CalendarHeader {...headerProps} />)
    for (const name of ['Previous', 'Next']) {
      const button = screen.getByRole('button', { name })
      expect(button).toHaveClass('odc-btn')
      expect(button).toHaveAttribute('title', name)
      expect(button.querySelector('svg')).toHaveClass('lucide')
    }
    expect(container.querySelector('.tooltip, [role="tooltip"]')).toBeNull()
  })

  // (decision 3): «Today» is a Product Button in the same row as the arrows
  it('puts a Today button in the row of the arrows that navigates to today', () => {
    renderWithProviders(<CalendarHeader {...headerProps} />)
    const today = screen.getByRole('button', { name: 'Today' })
    expect(today).toHaveClass('odc-btn')
    expect(today.parentElement).toBe(screen.getByRole('button', { name: 'Previous' }).parentElement)
    fireEvent.click(today)
    expect(headerProps.onNavigate).toHaveBeenCalledWith('TODAY')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(headerProps.onNavigate).toHaveBeenCalledWith('NEXT')
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(headerProps.onNavigate).toHaveBeenCalledWith('PREV')
  })

  // R1-02: the buttons are at the start of the bar and never move with the width of the label (as Google Calendar):
  // «Today» · ‹ · › · label, then a flexible gap, then the views
  it('orders the bar Today, Previous, Next, label, then the gap for the notice, then the views', () => {
    renderWithProviders(<CalendarHeader {...headerProps} />)
    const today = screen.getByRole('button', { name: 'Today' })
    const row = today.parentElement
    const label = screen.getByText('October 2026')
    expect(Array.from(row.children)).toEqual([today, screen.getByRole('button', { name: 'Previous' }), screen.getByRole('button', { name: 'Next' }), label])
    const bar = row.parentElement
    const group = screen.getByRole('group', { name: 'Calendar view' })
    const slot = bar.querySelector('[data-toolbar-notice]')
    expect(slot).not.toBeNull()
    expect(Array.from(bar.children).indexOf(row)).toBeLessThan(Array.from(bar.children).indexOf(slot))
    expect(Array.from(bar.children).indexOf(slot)).toBeLessThan(Array.from(bar.children).findIndex(child => child.contains(group)))
    // the gap exists with or without a notice, so a notice that comes and goes moves nothing
    expect(slot).toBeEmptyDOMElement()
  })

  it('draws the empty-period notice in the gap of the bar, only when the page says the period is empty', () => {
    const { rerender } = renderWithProviders(<CalendarHeader {...headerProps} />)
    expect(screen.queryByText('No appointments in this period.')).toBeNull()
    rerender(
      <AppointmentsToolbarContext.Provider value={{ emptyPeriod: true }}>
        <CalendarHeader {...headerProps} />
      </AppointmentsToolbarContext.Provider>
    )
    const notice = screen.getByText('No appointments in this period.').closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'info')
    const slot = notice.closest('[data-toolbar-notice]')
    expect(slot).not.toBeNull()
    expect(slot.parentElement).toBe(screen.getByRole('button', { name: 'Today' }).parentElement.parentElement)
    // the buttons keep their nodes and their place
    expect(screen.getByRole('button', { name: 'Today' }).parentElement.firstElementChild).toBe(screen.getByRole('button', { name: 'Today' }))
  })

  it('draws the views as a segmented control of four text options and switches views', () => {
    renderWithProviders(<CalendarHeader {...headerProps} />)
    const group = screen.getByRole('group', { name: 'Calendar view' })
    const options = within(group).getAllByRole('button')
    expect(options.map(option => option.textContent)).toEqual(['Month', 'Week', 'Day', 'List'])
    expect(options.every(option => option.querySelector('svg') === null)).toBe(true)
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    expect(headerProps.onView).toHaveBeenCalledWith('day')
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(headerProps.onView).toHaveBeenCalledWith('list')
  })
})

// tanda P: the views end where the calendar ends; the track sat at the start of its 20rem box, ~110px short of the edge
describe('CalendarHeader · the views at the end of the bar', () => {
  it('aligns the segmented track to the end of its box', () => {
    const props = { label: 'October 2026', view: 'week', views: ['month', 'week', 'day', 'list'], onView: vi.fn(), onNavigate: vi.fn() }
    const { container } = renderWithProviders(<CalendarHeader {...props} />)
    expect(window.getComputedStyle(container.querySelector('.odc-seg')).textAlign).toBe('end')
  })
})

describe('Appointments leftovers', () => {
  it('imports no react-bootstrap, react-bootstrap-icons, meronex icons or legacy IconButton', () => {
    for (const file of ['index.js', 'CalendarHeader.js', 'EventComponent.js']) {
      const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')
      expect(source, file).not.toMatch(/from 'react-bootstrap(-icons)?'/)
      expect(source, file).not.toMatch(/@meronex\/icons/)
      expect(source, file).not.toMatch(/from '\.\.\/\.\.\/\.\.\/styles'/)
    }
  })
})

// R1-01: rbc places every appointment of the time grid with `position: absolute` and an inline top and height; a rule that
// sets `position` (or a box offset) on an unscoped `.rbc-event` overrides it and the appointments pile up at the wrong hour.
describe('Appointments styles do not override how rbc places the events of the time grid', () => {
  const all = fs.readFileSync(path.resolve(__dirname, '..', 'styles.js'), 'utf8')
  const wrapper = all.slice(all.indexOf('export const CalendarWrapper'), all.indexOf('export const CalendarHeaderContainer'))
  const plain = wrapper.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\$\{[^}]*\}/g, 'x')
  const rules = Array.from(plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map(([, selector, body]) => ({
    selectors: selector.split(',').map(item => item.replace(/\s+/g, ' ').trim()),
    properties: body.split(';').map(item => item.split(':')[0].trim()).filter(Boolean)
  }))
  const lastCompound = selector => selector.split(/[\s>+~]+/).pop()
  const reachesTimeGridEvents = selector => lastCompound(selector) === '.rbc-event' && !selector.includes('.rbc-month-view')

  it('has no rule without the month scope that sets position on .rbc-event, and keeps it for the month', () => {
    const offenders = rules.filter(rule => rule.properties.includes('position') && rule.selectors.some(reachesTimeGridEvents))
    expect(offenders).toEqual([])
    const month = rules.find(rule => rule.properties.includes('position') && rule.selectors.includes('.rbc-month-view .rbc-event'))
    expect(month).toBeDefined()
    // the day numbers and «+N more» keep their own position (the 44px area of a coarse pointer hangs from it)
    expect(rules.some(rule => rule.properties.includes('position') && rule.selectors.includes('.rbc-button-link') && rule.selectors.includes('.rbc-show-more'))).toBe(true)
  })

  it('gives .rbc-event of the time grid no position, offset, height or margin of its own', () => {
    const box = /^(position|top|bottom|left|right|height|block-size|inset.*|margin.*)$/
    const offenders = rules.filter(rule => rule.selectors.some(reachesTimeGridEvents) && rule.properties.some(property => box.test(property)))
    expect(offenders).toEqual([])
  })
})

// redesign C1a (W1-QC1-02, -05, -09, W1-PC1-04): the keyboard opens an appointment, the focus does not fall to <body>, axe-clean parts
describe('Appointments calendar keyboard and focus', () => {
  const grace = { id: 1, order_id: 11, start: '2026-10-13 15:00:00', end: '2026-10-13 15:30:00', professional: { name: 'Grace', lastname: 'Hopper', photo: null } }
  const withEvents = { ...base, selectedBusiness: { id: 9, name: 'Subway' }, businessCalendarEvents: { loading: false, result: [grace], error: null } }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0)) // Wednesday 7 October 2026: the month shows the 13th
  })
  afterEach(() => { vi.useRealTimers() })

  it('opens the month event with Enter and with Space, and Esc (the panel closing) gives the focus back to it', async () => {
    renderWithProviders(<Appointments {...withEvents} />)
    const event = screen.getByRole('button', { name: 'Grace Hopper, 15:00 – 15:30' })
    expect(event).toHaveAttribute('tabindex', '0')

    for (const key of ['Enter', ' ']) {
      event.focus()
      fireEvent.keyDown(event, { key })
      expect(screen.getByRole('dialog', { name: 'Appointment 11' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      await waitFor(() => expect(event).toHaveFocus())
    }
  })

  it('opens a week event with Enter and Space as a click does', async () => {
    const { container } = renderWithProviders(<Appointments {...withEvents} />)
    fireEvent.click(screen.getByRole('button', { name: 'Week' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const event = container.querySelector('.rbc-time-view .rbc-event[role="button"]')
    expect(event).not.toBeNull()
    for (const key of ['Enter', ' ']) {
      event.focus()
      fireEvent.keyDown(event, { key })
      expect(screen.getByRole('dialog', { name: 'Appointment 11' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
      await waitFor(() => expect(event).toHaveFocus())
    }
  })

  it('ignores other keys on an event', () => {
    renderWithProviders(<Appointments {...withEvents} />)
    const event = screen.getByRole('button', { name: 'Grace Hopper, 15:00 – 15:30' })
    fireEvent.keyDown(event, { key: 'a' })
    fireEvent.keyDown(event, { key: 'Tab' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('brings the focus to the Day button when a day number drills down to the day view', async () => {
    const { container } = renderWithProviders(<Appointments {...withEvents} />)
    const dayNumber = Array.from(container.querySelectorAll('.rbc-month-view .rbc-date-cell button.rbc-button-link')).find(node => node.textContent === '07')
    dayNumber.focus()
    expect(dayNumber).toHaveFocus()
    fireEvent.click(dayNumber)
    const day = screen.getByRole('button', { name: 'Day' })
    await waitFor(() => expect(day).toHaveAttribute('aria-pressed', 'true'))
    expect(day).toHaveFocus()
  })

  it('leaves the focus where it is when a view button changes the view', () => {
    renderWithProviders(<Appointments {...withEvents} />)
    const week = screen.getByRole('button', { name: 'Week' })
    week.focus()
    fireEvent.click(week)
    expect(week).toHaveFocus()
  })

  it('draws the week and day headers as text inside the day button, with no columnheader role under a button', () => {
    const { container } = renderWithProviders(<Appointments {...withEvents} />)
    for (const view of ['Week', 'Day']) {
      fireEvent.click(screen.getByRole('button', { name: view }))
      expect(container.querySelectorAll('.rbc-time-header .rbc-header button.rbc-button-link').length, view).toBeGreaterThan(0)
      expect(container.querySelectorAll('.rbc-time-header [role="columnheader"]'), view).toHaveLength(0)
    }
  })

  it('keeps the buttons of the month events inside a cell of the row (aria-required-children)', () => {
    const { container } = renderWithProviders(<Appointments {...withEvents} />)
    const buttons = container.querySelectorAll('.rbc-row-content [role="button"], .rbc-row-content button.rbc-show-more')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) expect(button.closest('[role="cell"]'), button.outerHTML.slice(0, 60)).not.toBeNull()
  })

  it('draws no «Calendar» crumb under the title, with or without a business', () => {
    const { container } = renderWithProviders(<Appointments {...withEvents} />)
    // with a store the line under the title is its time zone, never the crumb
    expect(container.querySelector('.odc-pagehead-description')).toHaveTextContent(/^Times in /)
    expect(container.querySelector('.odc-pagehead-description')).not.toHaveTextContent('Calendar')
    const off = renderWithProviders(<Appointments {...base} selectedBusiness={null} />)
    expect(off.container.querySelector('.odc-pagehead-description')).toBeNull()
  })
})

// redesign (decisions 4, 5 and 7): the List view, the error and empty-period states, the visible range and the first hour
describe('Appointments views, states and first hour', () => {
  const grace = { id: 1, order_id: 11, start: '2026-10-13 15:00:00', end: '2026-10-13 15:30:00', professional: { name: 'Grace', lastname: 'Hopper', photo: null } }
  const business = { id: 9, name: 'Subway' }
  // R1-06: the controller says which business the finished result belongs to; by default it is the chosen one
  const withEvents = (result, extra = {}) => ({ ...base, selectedBusiness: business, businessCalendarEvents: { loading: false, result, error: null, businessId: business.id, ...extra } })
  const emptyNotice = 'No appointments in this period.'

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0)) // Wednesday 7 October 2026
  })
  afterEach(() => { vi.useRealTimers() })

  it('offers Month, Week, Day and List, starts in Month at today and switches to List', () => {
    renderWithProviders(<Appointments {...withEvents([grace])} />)
    const group = screen.getByRole('group', { name: 'Calendar view' })
    expect(within(group).getAllByRole('button').map(option => option.textContent)).toEqual(['Month', 'Week', 'Day', 'List'])
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('October 2026')).toHaveAttribute('aria-live', 'polite')
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false')
  })

  // redesign (n.º 6, P-1): the INITIAL view is List under 768px and Month from there up; only the first paint reads the width
  describe('initial view by width', () => {
    const realMatchMedia = window.matchMedia
    const stubWidth = (phone) => {
      window.matchMedia = vi.fn(query => ({
        matches: phone && query === '(max-width: 767px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn()
      }))
    }
    afterEach(() => { window.matchMedia = realMatchMedia })

    it('opens in List under 768px, with the views toolbar as it is and Month one touch away', () => {
      stubWidth(true)
      renderWithProviders(<Appointments {...withEvents([grace])} />)
      expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false')
      const group = screen.getByRole('group', { name: 'Calendar view' })
      expect(within(group).getAllByRole('button').map(option => option.textContent)).toEqual(['Month', 'Week', 'Day', 'List'])
      fireEvent.click(screen.getByRole('button', { name: 'Month' }))
      expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('opens in Month from 768px up', () => {
      stubWidth(false)
      renderWithProviders(<Appointments {...withEvents([grace])} />)
      expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('opens in Month when the browser has no matchMedia', () => {
      window.matchMedia = undefined
      renderWithProviders(<Appointments {...withEvents([grace])} />)
      expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('draws the appointments of the month as buttons in the List view and opens the panel from one', () => {
    const { container } = renderWithProviders(<Appointments {...withEvents([grace])} />)
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(container.querySelector('.rbc-month-view')).toBeNull()
    const row = screen.getByRole('button', { name: 'Grace Hopper, 15:00 – 15:30' })
    expect(row.tagName).toBe('BUTTON')
    fireEvent.click(row)
    expect(screen.getByRole('dialog', { name: 'Appointment 11' })).toBeInTheDocument()
  })

  it('moves the List view by months with the arrows and returns to today with the Today button', () => {
    renderWithProviders(<Appointments {...withEvents([grace])} />)
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('November 2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Grace Hopper, 15:00 – 15:30' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByText('October 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Grace Hopper, 15:00 – 15:30' })).toBeInTheDocument()
  })

  it('moves the month by Next and Today brings it back', () => {
    renderWithProviders(<Appointments {...withEvents([grace])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('November 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByText('October 2026')).toBeInTheDocument()
  })

  it('lets the List view use the width of the page: the calendar minimums are scoped to the month and time views', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'styles.js'), 'utf8')
    // the minimums live in ONE rule scoped to the views that need them: List has no .rbc-month-view or .rbc-time-view inside
    expect(source.match(/min-width:\s*728px/g)).toHaveLength(1)
    expect(source.match(/min-block-size:\s*40rem/g)).toHaveLength(1)
    expect(source).toMatch(/&:has\(\.rbc-month-view\),\s*&:has\(\.rbc-time-view\)\s*\{[^}]*min-width:\s*728px[^}]*min-block-size:\s*40rem/)
    // the thirds of the phone are scoped the same way
    expect(source).not.toMatch(/&\s*\{\s*min-width:\s*calc\(100cqw \* 7 \/ 3\)/)
    expect(source).toMatch(/&:has\(\.rbc-month-view\)\s*\{\s*min-width:\s*calc\(100cqw \* 7 \/ 3\)/)
  })

  describe('error', () => {
    it('replaces the calendar with the error state and a Retry that asks the controller again', () => {
      const props = withEvents([], { error: ['Network down'] })
      const { container } = renderWithProviders(<Appointments {...props} />)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent("We couldn't load the appointments.")
      expect(alert).toHaveTextContent('Check the connection and try again.')
      expect(container.querySelector('.rbc-calendar')).toBeNull()
      expect(screen.queryByText(emptyNotice)).toBeNull()
      fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
      expect(props.refreshCalendarEvents).toHaveBeenCalledTimes(1)
    })

    // R1-04: pressing Retry must not drop the focus on <body>; the error state stays while it loads
    describe('Retry and the focus', () => {
      const retryOf = () => within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' })

      it('keeps the Retry button (same node, focus, aria-disabled, no action) while it loads and when it fails again', () => {
        const failed = withEvents([], { error: ['Network down'] })
        const { rerender, container } = renderWithProviders(<Appointments {...failed} />)
        const retry = retryOf()
        retry.focus()
        fireEvent.click(retry)
        expect(failed.refreshCalendarEvents).toHaveBeenCalledTimes(1)

        // the controller clears the error and loads
        rerender(<Appointments {...withEvents([], { loading: true, error: null })} />)
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(container.querySelector('.rbc-calendar')).toBeNull()
        expect(retryOf()).toBe(retry)
        expect(retry).toHaveAttribute('aria-disabled', 'true')
        expect(retry).not.toBeDisabled()
        expect(retry).toHaveFocus()
        fireEvent.click(retry)
        expect(failed.refreshCalendarEvents).toHaveBeenCalledTimes(1) // no action while loading

        // it fails again: the same button, still focused and live
        rerender(<Appointments {...withEvents([], { error: ['Still down'] })} />)
        expect(retryOf()).toBe(retry)
        expect(retry).not.toHaveAttribute('aria-disabled')
        expect(retry).toHaveFocus()
        fireEvent.click(retry)
        expect(failed.refreshCalendarEvents).toHaveBeenCalledTimes(2)
      })

      it('moves the focus to the calendar region when the retry succeeds', () => {
        const { rerender } = renderWithProviders(<Appointments {...withEvents([], { error: ['Network down'] })} />)
        const retry = retryOf()
        retry.focus()
        fireEvent.click(retry)
        rerender(<Appointments {...withEvents([], { loading: true, error: null })} />)
        expect(screen.queryByRole('region', { name: 'Calendar' })).toBeNull()
        rerender(<Appointments {...withEvents([grace], { error: null })} />)
        const region = screen.getByRole('region', { name: 'Calendar' })
        expect(region).toHaveAttribute('tabindex', '-1')
        expect(region).toHaveFocus()
        expect(screen.queryByRole('alert')).toBeNull()
      })

      it('does not take the focus on its own: not on first paint, and not when the user did not press Retry', () => {
        const { rerender } = renderWithProviders(<Appointments {...withEvents([grace])} />)
        expect(screen.getByRole('region', { name: 'Calendar' })).not.toHaveFocus()
        rerender(<Appointments {...withEvents([], { error: ['Network down'] })} />)
        rerender(<Appointments {...withEvents([grace])} />)
        expect(screen.getByRole('region', { name: 'Calendar' })).not.toHaveFocus()
      })

      it('draws no focus ring on the region for a programmatic focus (and keeps the ring for the keyboard)', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'styles.js'), 'utf8')
        expect(source).toMatch(/&:focus:not\(:focus-visible\)\s*\{\s*outline:\s*none;?\s*\}/)
      })
    })

    it('keeps the calendar and the spinner while it is loading, even with a previous error', () => {
      const { container } = renderWithProviders(<Appointments {...withEvents([], { loading: true, error: ['Network down'] })} />)
      expect(screen.queryByRole('alert')).toBeNull()
      expect(container.querySelector('.rbc-calendar')).not.toBeNull()
      expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
      expect(screen.queryByText(emptyNotice)).toBeNull()
    })
  })

  describe('period without appointments', () => {
    it('shows an info notice inside the calendar region when nothing falls in the visible month', () => {
      renderWithProviders(<Appointments {...withEvents([])} />)
      const notice = screen.getByText(emptyNotice)
      expect(notice.closest('.odc-notice')).toHaveAttribute('data-tone', 'info')
      expect(screen.getByRole('region', { name: 'Calendar' })).toContainElement(notice)
    })

    // R1-02: the notice is in the toolbar (in its gap), never above it, so it cannot push the buttons down
    it('draws the notice inside the toolbar, not above it', () => {
      renderWithProviders(<Appointments {...withEvents([])} />)
      const region = screen.getByRole('region', { name: 'Calendar' })
      const notice = screen.getByText(emptyNotice).closest('.odc-notice')
      const bar = screen.getByRole('button', { name: 'Today' }).parentElement.parentElement
      expect(bar).toContainElement(notice)
      expect(region.firstElementChild).toBe(region.querySelector('.rbc-calendar'))
      expect(region.querySelector('.rbc-calendar').firstElementChild).toBe(bar)
    })

    // R1-06: a result that is not the chosen business's says nothing about this one
    it('shows the notice only for a result that belongs to the chosen business', () => {
      const { rerender } = renderWithProviders(<Appointments {...withEvents([], { businessId: null })} />)
      expect(screen.queryByText(emptyNotice)).toBeNull() // nothing finished yet (first paint with a remembered business)
      rerender(<Appointments {...withEvents([], { businessId: 5 })} />)
      expect(screen.queryByText(emptyNotice)).toBeNull() // the last finished result is another business's
      rerender(<Appointments {...withEvents([], { businessId: 9 })} />)
      expect(screen.getByText(emptyNotice)).toBeInTheDocument()
    })

    it('shows no notice when an appointment falls in the month, and none while it is loading', () => {
      const { unmount } = renderWithProviders(<Appointments {...withEvents([grace])} />)
      expect(screen.queryByText(emptyNotice)).toBeNull()
      unmount()
      renderWithProviders(<Appointments {...withEvents([], { loading: true })} />)
      expect(screen.queryByText(emptyNotice)).toBeNull()
    })

    it('follows the visible range: an appointment of November does not count in October, and does after Next', () => {
      renderWithProviders(<Appointments {...withEvents([{ ...grace, start: '2026-11-12 10:00:00', end: '2026-11-12 10:30:00' }])} />)
      expect(screen.getByText(emptyNotice)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(screen.queryByText(emptyNotice)).toBeNull()
    })

    it('follows the week and the day, and also the List view', () => {
      renderWithProviders(<Appointments {...withEvents([grace])} />)
      fireEvent.click(screen.getByRole('button', { name: 'Week' })) // 4-10 October: the 13th is out
      expect(screen.getByText(emptyNotice)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Next' })) // 11-17 October
      expect(screen.queryByText(emptyNotice)).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Day' })) // the 11th
      expect(screen.getByText(emptyNotice)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'List' }))
      expect(screen.queryByText(emptyNotice)).toBeNull()
    })

    it('drilling a day number down to the day computes the range of that day, not the month', () => {
      const { container } = renderWithProviders(<Appointments {...withEvents([grace])} />)
      const dayNumber = Array.from(container.querySelectorAll('.rbc-month-view .rbc-date-cell button.rbc-button-link')).find(node => node.textContent === '07')
      fireEvent.click(dayNumber)
      expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText(emptyNotice)).toBeInTheDocument()
    })
  })

  describe('rangeOf', () => {
    const localizer = momentLocalizer(moment)

    it('turns a list of days (week, day) into the first to the last whole day', () => {
      const week = [4, 5, 6, 7, 8, 9, 10].map(day => new Date(2026, 9, day))
      const { start, end } = rangeOf(week, localizer)
      expect(start).toEqual(new Date(2026, 9, 4, 0, 0, 0, 0))
      expect(end).toEqual(new Date(2026, 9, 10, 23, 59, 59, 999))
      expect(rangeOf([new Date(2026, 9, 7, 13, 30)], localizer)).toEqual({ start: new Date(2026, 9, 7, 0, 0, 0, 0), end: new Date(2026, 9, 7, 23, 59, 59, 999) })
    })

    it('takes {start, end} (month, List) to whole days', () => {
      const { start, end } = rangeOf({ start: new Date(2026, 9, 1, 8, 15), end: new Date(2026, 9, 31, 9, 0) }, localizer)
      expect(start).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0))
      expect(end).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999))
    })
  })

  describe('first hour of week and day', () => {
    const at = (day, time) => ({ ...grace, start: `2026-10-${day} ${time}:00`, end: `2026-10-${day} ${time}:30` })
    const startAccessor = event => moment(event.start).toDate()
    const range = { start: new Date(2026, 9, 11, 0, 0, 0, 0), end: new Date(2026, 9, 17, 23, 59, 59, 999) }

    it('is the hour on the dot of the earliest appointment of the visible range', () => {
      const events = [at('13', '15:20'), at('14', '09:45'), at('16', '11:10')]
      expect(earliestScrollTime(events, startAccessor, range)).toEqual(new Date(1970, 0, 1, 9, 0))
    })

    it('ignores the appointments outside the range and falls back to 08:00 with none', () => {
      expect(earliestScrollTime([at('13', '15:20'), at('02', '06:30')], startAccessor, range)).toEqual(new Date(1970, 0, 1, 15, 0))
      expect(earliestScrollTime([at('02', '06:30')], startAccessor, range)).toEqual(new Date(1970, 0, 1, 8, 0))
      expect(earliestScrollTime([], startAccessor, range)).toEqual(new Date(1970, 0, 1, 8, 0))
      expect(earliestScrollTime(undefined, startAccessor, range)).toEqual(new Date(1970, 0, 1, 8, 0))
    })

    describe('scroll of the time grid', () => {
      let heightSpy
      beforeEach(() => {
        heightSpy = vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(2400)
      })
      afterEach(() => { heightSpy.mockRestore() })

      it('scrolls the week to 08:00 with no appointments in the range, and to the first hour once there are', () => {
        const { container } = renderWithProviders(<Appointments {...withEvents([grace])} />)
        fireEvent.click(screen.getByRole('button', { name: 'Week' })) // 4-10 October: none
        expect(container.querySelector('.rbc-time-content').scrollTop).toBe(800) // 08:00 of 24 h over 2400
        fireEvent.click(screen.getByRole('button', { name: 'Next' })) // the 13th at 15:00
        expect(container.querySelector('.rbc-time-content').scrollTop).toBe(1500)
      })

      it('scrolls the day too, and when the data arrives after the view is on screen', () => {
        const { container, rerender } = renderWithProviders(<Appointments {...withEvents([])} />)
        fireEvent.click(screen.getByRole('button', { name: 'Week' }))
        expect(container.querySelector('.rbc-time-content').scrollTop).toBeGreaterThan(0)
        rerender(<Appointments {...withEvents([{ ...grace, start: '2026-10-07 06:00:00', end: '2026-10-07 06:30:00' }])} />)
        expect(container.querySelector('.rbc-time-content').scrollTop).toBe(600) // 06:00
        fireEvent.click(screen.getByRole('button', { name: 'Day' }))
        expect(container.querySelector('.rbc-time-content').scrollTop).toBe(600)
      })
    })
  })
})

// the calendar is the store's zone (business.timezone), not the browser's. The browser is in Tokyo, where it is already
// 01:30 of the 28th, while in Bogotá it is 11:30 of the 27th; the appointment is at 14:00 UTC, 09:00 in Bogotá.
describe('Appointments in the store\'s time zone', () => {
  const originalTZ = process.env.TZ
  const ada = { id: 2, order_id: 12, start: '2026-10-27 14:00:00', end: '2026-10-27 14:30:00', professional: { name: 'Ada', lastname: 'Lovelace', photo: null } }
  const drawFor = (business) => renderWithProviders(
    <Appointments {...base} selectedBusiness={business} businessCalendarEvents={{ loading: false, result: [ada], error: null, businessId: business.id }} />
  )

  beforeEach(() => {
    process.env.TZ = 'Asia/Tokyo'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T16:30:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  it('opens on the store\'s day, places the appointment at its hour there and writes the zone', () => {
    const { container } = drawFor({ id: 9, name: 'Subway', timezone: 'America/Bogota' })
    expect(container.querySelector('.odc-pagehead-description')).toHaveTextContent('Times in America/Bogota')
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(screen.getByRole('button', { name: 'Ada Lovelace, 09:00 – 09:30' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /27.*Today/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    expect(container.querySelector('.rbc-time-view .rbc-event')).toHaveTextContent('09:00')
  })

  it('without a zone on the store, keeps the browser\'s and says so', () => {
    const { container } = drawFor({ id: 9, name: 'Subway' })
    expect(container.querySelector('.odc-pagehead-description')).toHaveTextContent('Times in Asia/Tokyo, your browser’s time zone (none is set here)')
  })
})
