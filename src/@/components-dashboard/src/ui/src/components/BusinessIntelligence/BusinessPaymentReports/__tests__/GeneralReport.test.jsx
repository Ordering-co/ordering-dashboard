/* eslint-disable import/first */
// redesign business-payments FC2 (; D5, D9, D11): the General report. A method (a segmented control up to four, the C18 dropdown
// beyond), then the billing periods of the method from the newest, eight at a time, each with its own «Download CSV». The controller is not
// mounted: the component draws what it is given (`methods`, `method`, `periods`, `report`) and asks for what the person does.
import React from 'react'
import moment from 'moment'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({ parseDate: null, parseTime: null }))

vi.mock('../../../../../../index', () => ({
  useSession: () => [{ user: { level: 0 } }],
  useConfig: () => [{ configs: {} }],
  useEvent: () => [{ emit: () => {} }],
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
  useUtils: () => [{
    parseDate: (...args) => runtime.parseDate(...args),
    parseTime: (...args) => runtime.parseTime(...args)
  }]
}))

import { GeneralReport } from '../GeneralReport'

const stripe = { gateway: 'stripe', name: 'Stripe', cycle: 'weekly', cycle_day: 1, cycle_time: '05:00' }
const square = { gateway: 'square', name: 'Square', cycle: 'monthly', cycle_day: 5, cycle_time: '05:00' }
const paypal = { gateway: 'paypal', name: 'PayPal', cycle: 'weekly', cycle_day: 3, cycle_time: '05:00' }
const adyen = { gateway: 'adyen', name: 'Adyen', cycle: 'monthly', cycle_day: 1, cycle_time: '05:00' }
const mollie = { gateway: 'mollie', name: 'Mollie', cycle: 'weekly', cycle_day: 2, cycle_time: '05:00' }

// newest first, as the controller gives them; the strings are the ones sent to the API (local, no zone)
const makePeriods = (count) => Array.from({ length: count }, (_, index) => {
  const end = moment('2026-10-05').subtract(index * 7, 'days')
  const start = end.clone().subtract(7, 'days')
  return {
    key: `p${index}`,
    startDate: start.toDate(),
    cutoffDate: end.toDate(),
    periodStart: `${start.format('YYYY-MM-DD')} 05:00:00`,
    periodEnd: `${end.format('YYYY-MM-DD')} 05:00:00`
  }
})

const baseProps = (extra = {}) => ({
  methods: { loading: false, error: null, items: [stripe, square, paypal], retry: vi.fn() },
  method: stripe,
  selectMethod: vi.fn(),
  periods: makePeriods(20),
  report: { download: vi.fn(), loadingKey: null, error: null, errorKey: null },
  ...extra
})

const draw = (props) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <GeneralReport {...props} />
  </ThemeProvider>
)

const rows = () => screen.queryAllByRole('listitem')
const downloadButtons = () => screen.getAllByRole('button', { name: /^Download CSV: / })

beforeEach(() => {
  // as the project's parseDate / parseTime: a date as 'DD MMM YYYY'; a zone only when it is asked for (`utc` defaults to true)
  runtime.parseDate = vi.fn((date, options = {}) => {
    const instant = (options.utc ?? true) ? moment.utc(date, 'YYYY-MM-DD HH:mm:ss').local() : moment(date, 'YYYY-MM-DD HH:mm:ss')
    return instant.format(options.dateOnly ? 'DD MMM YYYY' : 'DD MMM YYYY HH:mm')
  })
  runtime.parseTime = vi.fn((time, options = {}) => {
    const instant = (options.utc ?? true) ? moment.utc(time, 'HH:mm').local() : moment(time, 'HH:mm')
    return instant.format('HH:mm')
  })
})

describe('GeneralReport: the method (D5)', () => {
  it('with three methods it is a segmented control with three options, the chosen one pressed', () => {
    draw(baseProps())
    const group = screen.getByRole('group', { name: 'Select a payment method' })
    const options = within(group).getAllByRole('button')
    expect(options.map(option => option.textContent)).toEqual(['Stripe · Weekly', 'Square · Monthly', 'PayPal · Weekly'])
    expect(within(group).getByRole('button', { name: 'Stripe · Weekly' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(group).getByRole('button', { name: 'Square · Monthly' }).getAttribute('aria-pressed')).toBe('false')
    expect(document.querySelector('.od-first-select-root')).toBeNull()
  })

  it('choosing another method asks the controller for it, by gateway', async () => {
    const props = baseProps()
    draw(props)
    await userEvent.click(screen.getByRole('button', { name: 'Square · Monthly' }))
    expect(props.selectMethod).toHaveBeenCalledWith('square')
  })

  it('with four methods it is still the segmented control (the most it takes)', () => {
    draw(baseProps({ methods: { loading: false, error: null, items: [stripe, square, paypal, adyen], retry: vi.fn() } }))
    const group = screen.getByRole('group', { name: 'Select a payment method' })
    expect(within(group).getAllByRole('button')).toHaveLength(4)
  })

  it('with a single method it is a segmented control of one option', () => {
    draw(baseProps({ methods: { loading: false, error: null, items: [stripe], retry: vi.fn() } }))
    const group = screen.getByRole('group', { name: 'Select a payment method' })
    expect(within(group).getAllByRole('button')).toHaveLength(1)
  })

  it('with five methods it is a menu of single choice (P/Menu radios), it does not throw, and choosing asks for the gateway', async () => {
    const props = baseProps({ methods: { loading: false, error: null, items: [stripe, square, paypal, adyen, mollie], retry: vi.fn() } })
    draw(props)
    expect(screen.queryByRole('group', { name: 'Select a payment method' })).toBeNull()
    // the trigger shows the method in use and is named by what it is for
    const trigger = screen.getByRole('button', { name: 'Select a payment method: Stripe · Weekly' })
    expect(trigger.textContent).toContain('Stripe · Weekly')
    await userEvent.click(trigger)
    const options = await screen.findAllByRole('menuitemradio')
    expect(options.map(option => option.textContent.trim())).toEqual(['Stripe · Weekly', 'Square · Monthly', 'PayPal · Weekly', 'Adyen · Monthly', 'Mollie · Weekly'])
    expect(options[0].getAttribute('aria-checked')).toBe('true')
    await userEvent.click(options[1])
    expect(props.selectMethod).toHaveBeenCalledWith('square')
  })
})

describe('GeneralReport: the billing periods (D5)', () => {
  it('has the title, and the periods from the newest to the oldest, eight at first', () => {
    draw(baseProps())
    expect(screen.getByRole('heading', { name: 'Select a billing period' })).toBeTruthy()
    expect(rows()).toHaveLength(8)
    expect(within(rows()[0]).getByText('28 Sep 2026 – 05 Oct 2026')).toBeTruthy()
    expect(within(rows()[1]).getByText('21 Sep 2026 – 28 Sep 2026')).toBeTruthy()
  })

  it('«Show older periods» adds eight more, up to all of them, and then it is gone', async () => {
    draw(baseProps())
    await userEvent.click(screen.getByRole('button', { name: 'Show older periods' }))
    expect(rows()).toHaveLength(16)
    await userEvent.click(screen.getByRole('button', { name: 'Show older periods' }))
    expect(rows()).toHaveLength(20)
    expect(screen.queryByRole('button', { name: 'Show older periods' })).toBeNull()
  })

  it('has no «Show older periods» when there are eight periods or fewer', () => {
    draw(baseProps({ periods: makePeriods(8) }))
    expect(rows()).toHaveLength(8)
    expect(screen.queryByRole('button', { name: 'Show older periods' })).toBeNull()
  })

  it('goes back to eight when the method changes', async () => {
    const props = baseProps()
    const view = draw(props)
    await userEvent.click(screen.getByRole('button', { name: 'Show older periods' }))
    expect(rows()).toHaveLength(16)
    view.rerender(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <GeneralReport {...props} method={square} periods={makePeriods(14)} />
      </ThemeProvider>
    )
    expect(rows()).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Show older periods' })).toBeTruthy()
  })

  it('says the cut-off time of the method once, as a figure, and not on every row (D5)', () => {
    draw(baseProps())
    const cutoff = screen.getAllByText(/Cut-off/)
    expect(cutoff).toHaveLength(1)
    expect(cutoff[0].textContent).toBe('Cut-off 05:00')
    expect(cutoff[0].querySelector('.odc-figure').textContent).toBe('05:00')
    rows().forEach(row => expect(row.textContent).not.toMatch(/Cut-off/))
  })

  it('paints the period and the cut-off as written by the API, with no change of zone (D11)', () => {
    draw(baseProps())
    expect(runtime.parseDate).toHaveBeenCalledWith('2026-09-28 05:00:00', { dateOnly: true, utc: false })
    expect(runtime.parseDate).toHaveBeenCalledWith('2026-10-05 05:00:00', { dateOnly: true, utc: false })
    expect(runtime.parseTime).toHaveBeenCalledWith('05:00', { utc: false })
  })

  it('a browser west of UTC would move the day if the period were read as UTC: the dates stay those of the period (D11)', () => {
    // as the project's parseDate with `utc` true in a browser five hours behind: a wall-clock 05:00 is read as UTC and shown the day before
    runtime.parseDate = vi.fn((date, options = {}) => {
      const instant = (options.utc ?? true) ? moment.utc(date, 'YYYY-MM-DD HH:mm:ss').utcOffset(-300) : moment(date, 'YYYY-MM-DD HH:mm:ss')
      return instant.format('DD MMM YYYY')
    })
    runtime.parseTime = vi.fn((time, options = {}) => ((options.utc ?? true) ? moment.utc(time, 'HH:mm').utcOffset(-300) : moment(time, 'HH:mm')).format('HH:mm'))
    draw(baseProps())
    expect(within(rows()[0]).getByText('28 Sep 2026 – 05 Oct 2026')).toBeTruthy()
    expect(screen.getByText(/Cut-off/).textContent).toBe('Cut-off 05:00')
  })

  it('shows no date as ISO or as MM/DD/YYYY anywhere in the report', () => {
    const { container } = draw(baseProps())
    expect(container.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(container.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('has no periods list while the method has none', () => {
    draw(baseProps({ periods: [] }))
    expect(rows()).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Show older periods' })).toBeNull()
  })
})

describe('GeneralReport: the CSV of a period (D5)', () => {
  it('has a button on every row, named with the method and the period', () => {
    draw(baseProps())
    const buttons = downloadButtons()
    expect(buttons).toHaveLength(8)
    expect(buttons[0].getAttribute('aria-label')).toBe('Download CSV: Stripe, 28 Sep 2026 – 05 Oct 2026')
    expect(buttons[0].textContent).toBe('Download CSV')
  })

  it('does not download by itself', () => {
    const props = baseProps()
    draw(props)
    expect(props.report.download).not.toHaveBeenCalled()
  })

  it('a click on «Download CSV» of a row downloads the period of that row', async () => {
    const props = baseProps()
    draw(props)
    await userEvent.click(downloadButtons()[2])
    expect(props.report.download).toHaveBeenCalledTimes(1)
    expect(props.report.download).toHaveBeenCalledWith(props.periods[2])
  })

  it('while one downloads: its button is busy and all the others are disabled', async () => {
    const props = baseProps({ report: { download: vi.fn(), loadingKey: 'p2', error: null, errorKey: null } })
    draw(props)
    const buttons = downloadButtons()
    buttons.forEach((button, index) => {
      if (index === 2) {
        expect(button.getAttribute('aria-busy')).toBe('true')
        expect(button.disabled).toBe(false)
      } else {
        expect(button.disabled).toBe(true)
        expect(button.getAttribute('aria-busy')).toBeNull()
      }
    })
    await userEvent.click(buttons[2])
    await userEvent.click(buttons[0])
    expect(props.report.download).not.toHaveBeenCalled()
  })

  it('with nothing downloading, every button is enabled', () => {
    draw(baseProps())
    downloadButtons().forEach(button => expect(button.disabled).toBe(false))
  })

  it('the error of a download is shown under the row that failed, translated, and nowhere else', () => {
    const props = baseProps({ report: { download: vi.fn(), loadingKey: null, error: 'Invalid token', errorKey: 'p1' } })
    draw(props)
    const notices = screen.getAllByRole('status')
    expect(notices).toHaveLength(1)
    expect(rows()[1].contains(notices[0])).toBe(true)
    expect(notices[0].getAttribute('data-tone')).toBe('danger')
    expect(notices[0].textContent).toBe('Invalid token')
  })

  it('a failed download without a message says so with a text of its own', () => {
    draw(baseProps({ report: { download: vi.fn(), loadingKey: null, error: '', errorKey: 'p0' } }))
    expect(within(rows()[0]).getByRole('status').textContent).toBe('The report could not be downloaded. Try again.')
  })

  // redesign a request that never reached the server rejects with the browser's text («Failed to fetch»); that is not for a person
  it.each(['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed'])('a network failure («%s») says the fallback, not the browser text', (message) => {
    draw(baseProps({ report: { download: vi.fn(), loadingKey: null, error: message, errorKey: 'p0' } }))
    expect(within(rows()[0]).getByRole('status').textContent).toBe('The report could not be downloaded. Try again.')
  })

  it('an error of a period that is not shown (older than the eight) draws nothing', () => {
    draw(baseProps({ report: { download: vi.fn(), loadingKey: null, error: 'Boom', errorKey: 'p15' } }))
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('GeneralReport: the states that are not periods (D9)', () => {
  it('while the methods load it keeps the box of the final content as a skeleton, with a name for assistive technology', () => {
    const { container } = draw(baseProps({ methods: { loading: true, error: null, items: [], retry: vi.fn() }, method: null, periods: [] }))
    const busy = container.querySelector('[aria-busy="true"]')
    expect(busy).not.toBeNull()
    expect(busy.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(within(busy).getByText('Loading')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Select a payment method' })).toBeNull()
    expect(rows()).toHaveLength(0)
  })

  it('without methods it says there is nothing to download', () => {
    draw(baseProps({ methods: { loading: false, error: null, items: [], retry: vi.fn() }, method: null, periods: [] }))
    expect(screen.getByText('There are no payment methods with a billing cycle.')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Select a payment method' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('an error of the methods is an alert with the message of the API and «Try again», which asks again', async () => {
    const props = baseProps({ methods: { loading: false, error: ['Invalid token'], items: [], retry: vi.fn() }, method: null, periods: [] })
    draw(props)
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('Invalid token')).toBeTruthy()
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(props.methods.retry).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('group', { name: 'Select a payment method' })).toBeNull()
  })

  it('an error as a plain string reads the same', () => {
    draw(baseProps({ methods: { loading: false, error: 'Network down', items: [], retry: vi.fn() }, method: null, periods: [] }))
    expect(within(screen.getByRole('alert')).getByText('Network down')).toBeTruthy()
  })

  it('an error with no message still has a text and the way to try again', () => {
    draw(baseProps({ methods: { loading: false, error: [], items: [], retry: vi.fn() }, method: null, periods: [] }))
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText("We couldn't load the payment methods.")).toBeTruthy()
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  // redesign / 627: the browser's text and a raw API key are not for a person
  it('a network failure of the methods does not show the browser text', () => {
    draw(baseProps({ methods: { loading: false, error: ['Failed to fetch'], items: [], retry: vi.fn() }, method: null, periods: [] }))
    const alert = screen.getByRole('alert')
    expect(within(alert).queryByText('Failed to fetch')).toBeNull()
    expect(within(alert).getByText("We couldn't load the payment methods.")).toBeTruthy()
  })

  it('an API key the dictionary does not know is not shown raw', () => {
    draw(baseProps({ methods: { loading: false, error: ['INTERNAL_ERROR'], items: [], retry: vi.fn() }, method: null, periods: [] }))
    expect(screen.getByRole('alert').textContent).not.toMatch(/INTERNAL_ERROR/)
  })
})

describe('GeneralReport: the focus after «Try again»', () => {
  const failed = () => baseProps({ methods: { loading: false, error: ['Invalid token'], items: [], retry: vi.fn() }, method: null, periods: [] })
  const redraw = (view, props) => view.rerender(
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <GeneralReport {...props} />
    </ThemeProvider>
  )

  it('goes to the report when the methods arrive: «Try again» left the page and the focus must not fall to <body>', async () => {
    const props = failed()
    const view = draw(props)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    redraw(view, { ...props, methods: { loading: true, error: null, items: [], retry: props.methods.retry } })
    expect(document.activeElement).toBe(document.body)
    redraw(view, baseProps())
    expect(screen.getByRole('group', { name: 'General report' })).toHaveFocus()
  })

  it('goes to the report when the methods fail again', async () => {
    const props = failed()
    const view = draw(props)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    redraw(view, { ...props, methods: { loading: true, error: null, items: [], retry: props.methods.retry } })
    redraw(view, failed())
    expect(screen.getByRole('group', { name: 'General report' })).toHaveFocus()
  })

  it('methods that load by themselves never take the focus', () => {
    const view = draw(baseProps({ methods: { loading: true, error: null, items: [], retry: vi.fn() }, method: null, periods: [] }))
    redraw(view, baseProps())
    expect(document.activeElement).toBe(document.body)
  })
})
