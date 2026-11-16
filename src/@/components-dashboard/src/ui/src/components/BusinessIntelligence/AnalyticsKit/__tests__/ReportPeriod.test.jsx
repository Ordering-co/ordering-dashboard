/* eslint-disable import/first */
// redesign bi FB1 (D4, BI-04, BI-05, BI-06, auditor 4): the period of /intelligence/business. The four presets stay on view at one
// click; «Custom range» opens the brand range popover with no presets in it and writes the range once, on «Done».
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  configs: {},
  catalog: {} // what the runtime catalog of the API says for a key, over the default text
}))

vi.mock('../../../../../../index', async () => {
  const { getDateTimeFormats } = await import('../../../../../../utils/settingsCustomSections')
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text],
    useConfig: () => [{ configs: mockState.configs }],
    // the project's date format, day part only, as the real parseDate does
    useUtils: () => [{
      parseDate: (date, options = {}) => {
        const raw = mockState.configs.dates_general_format?.value
        const formats = getDateTimeFormats(typeof raw === 'string' && raw.trim() ? raw : 'DD MMM YYYY HH:mm')
        return dayjs(String(date).slice(0, 10)).format(options.dateOnly ? formats.dateFormat : `${formats.dateFormat} ${formats.timeFormat}`)
      }
    }]
  }
})

import { ReportPeriod } from '../ReportPeriod'

const PRESETS = [
  ['Today', 'today'],
  ['Yesterday', 'yesterday'],
  ['Last 7 days', 'last_7_days'],
  ['Last 30 days', 'last_30_days']
]
const CUSTOM = '2026-09-10,2026-09-12'
const TODAY_PERIOD = { from: '2026-10-09', to: '2026-10-09', includesToday: true }

const renderPeriod = (props = {}) => {
  const onChange = vi.fn()
  render(<ReportPeriod lapse='today' period={TODAY_PERIOD} onChange={onChange} {...props} />)
  return { onChange }
}

const pressed = (name) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

beforeEach(() => {
  vi.clearAllMocks()
  mockState.configs = { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }
  mockState.catalog = {}
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('the four presets', () => {
  it('are native buttons of a group named «Period», always on view', () => {
    renderPeriod()
    const group = screen.getByRole('group', { name: 'Period' })
    PRESETS.forEach(([name]) => {
      const button = within(group).getByRole('button', { name })
      expect(button.tagName).toBe('BUTTON')
      expect(button).toHaveAttribute('type', 'button')
      expect(button).toHaveAttribute('aria-pressed')
      // all of them secondary: the period is not the primary action of the page
      expect(button).toHaveAttribute('data-variant', 'secondary')
    })
    expect(within(group).getByRole('button', { name: /Custom range/ })).toBeInTheDocument()
  })

  it.each(PRESETS)('with lapse «%s» only that one is pressed, and «Custom range» is not', (name, lapse) => {
    renderPeriod({ lapse })
    PRESETS.forEach(([other]) => expect(pressed(other)).toBe(other === name ? 'true' : 'false'))
    expect(pressed('Custom range')).toBe('false')
  })

  it('a click on another preset reports it once, at one click', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPeriod({ lapse: 'today' })
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('last_7_days')
  })

  // redesign bi R1 (P-b, parity with main): the active preset was the one «refresh» of the page (AnalyticsStatusFilterBar), 10 requests
  it('the one that is already active reports itself again: it is the refresh of the page, as in main', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPeriod({ lapse: 'yesterday' })
    await user.click(screen.getByRole('button', { name: 'Yesterday' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('yesterday')
  })

  it('every click reports once, also a second one on the same preset', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPeriod({ lapse: 'last_7_days' })
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(2, 'last_7_days')
  })

  it('«Last 7 days» and «Last 30 days» have their own keys: the shared LAST_7_DAYS carries a typo in the API catalog (P3)', () => {
    mockState.catalog = { LAST_7_DAYS: 'Last 7 dyas', LAST_30_DAYS: 'Last 30 dyas' }
    renderPeriod()
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Last 7 dyas' })).toBeNull()
  })

  it('the new keys translate them', () => {
    mockState.catalog = { BUSINESS_REPORTS_LAST_7_DAYS: 'Últimos 7 días', BUSINESS_REPORTS_LAST_30_DAYS: 'Últimos 30 días' }
    renderPeriod()
    expect(screen.getByRole('button', { name: 'Últimos 7 días' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Últimos 30 días' })).toBeInTheDocument()
  })
})

describe('a custom range', () => {
  // The calendar opens on the current month and these tests click days of October 2026,
  // so the clock is fixed there; otherwise they break once the real month moves on.
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date('2026-10-15T12:00:00Z')))
  afterEach(() => vi.useRealTimers())

  it('is pressed and says its dates in the project format, never ISO; none of the four presets is pressed (BI-05, BI-06)', () => {
    renderPeriod({ lapse: CUSTOM, period: { from: '2026-09-10', to: '2026-09-12', includesToday: false } })
    PRESETS.forEach(([name]) => expect(pressed(name)).toBe('false'))
    const custom = screen.getByRole('button', { name: /10-09-2026 – 12-09-2026/ })
    expect(custom).toHaveAttribute('aria-pressed', 'true')
    // the accessible name keeps the object and contains what is seen
    expect(custom).toHaveAccessibleName('Custom range: 10-09-2026 – 12-09-2026')
    expect(custom.textContent).not.toMatch(/2026-09/)
  })

  it('a range of one day says that day once', () => {
    renderPeriod({ lapse: '2026-09-10,2026-09-10', period: { from: '2026-09-10', to: '2026-09-10', includesToday: false } })
    expect(screen.getByRole('button', { name: /Custom range/ })).toHaveTextContent('10-09-2026')
    expect(screen.getByRole('button', { name: /Custom range/ })).not.toHaveTextContent('–')
  })

  it('the words «Custom range» show while a preset is active', () => {
    renderPeriod({ lapse: 'last_30_days' })
    expect(screen.getByRole('button', { name: 'Custom range' })).toHaveTextContent('Custom range')
  })

  it('opens a popover with no presets in it, and applies nothing while the range is a draft', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPeriod()
    await user.click(screen.getByRole('button', { name: 'Custom range' }))
    const box = await screen.findByRole('dialog', { name: 'Select a date' })
    expect(within(box).queryByRole('button', { name: 'Last 7 days' })).toBeNull()
    expect(within(box).queryByRole('button', { name: 'Yesterday' })).toBeNull()
    expect(box.querySelector('.odc-dr-preset')).toBeNull()
    await user.click(box.querySelector('[data-day="2026-10-10"]'))
    expect(onChange).not.toHaveBeenCalled() // BI-04: the first day does not reload ten reports
    await user.click(box.querySelector('[data-day="2026-10-12"]'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('«Done» reports the range once, as from,to (BI-04)', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPeriod()
    await user.click(screen.getByRole('button', { name: 'Custom range' }))
    const box = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(box.querySelector('[data-day="2026-10-10"]'))
    await user.click(box.querySelector('[data-day="2026-10-12"]'))
    await user.click(within(box).getByRole('button', { name: 'Done' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('2026-10-10,2026-10-12')
  })

  it('a single day picked and «Done» is that day as a range of one, as main did with its first click', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPeriod()
    await user.click(screen.getByRole('button', { name: 'Custom range' }))
    const box = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(box.querySelector('[data-day="2026-10-10"]'))
    await user.click(within(box).getByRole('button', { name: 'Done' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('2026-10-10,2026-10-10')
  })

  it('leaving with the close button applies nothing', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPeriod()
    await user.click(screen.getByRole('button', { name: 'Custom range' }))
    const box = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(box.querySelector('[data-day="2026-10-10"]'))
    await user.keyboard('{Escape}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('opens on the active range', async () => {
    const user = userEvent.setup()
    renderPeriod({ lapse: CUSTOM, period: { from: '2026-09-10', to: '2026-09-12', includesToday: false } })
    await user.click(screen.getByRole('button', { name: /Custom range/ }))
    const box = await screen.findByRole('dialog', { name: 'Select a date' })
    expect(box.querySelector('input[inputmode="numeric"]')).toHaveValue('10-09-2026')
  })
})

// redesign (row 71, Q-09): «today» of the «Custom range» calendar is the day of the zone of the report (`timeZone`),
// not the browser's. The instant is fixed and two zones 25 h apart are tried, so one of them is never the browser's day.
describe('«today» of the calendar follows the zone of the report', () => {
  const INSTANT = new Date('2026-10-10T12:00:00Z')
  const dayIn = (timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(INSTANT)
  const browserDay = dayjs(INSTANT).format('YYYY-MM-DD')
  const zone = ['Pacific/Kiritimati', 'Pacific/Pago_Pago'].find(candidate => dayIn(candidate) !== browserDay)

  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(INSTANT))
  afterEach(() => vi.useRealTimers())

  const openCalendar = async () => {
    await userEvent.setup().click(screen.getByRole('button', { name: /Custom range/ }))
    return screen.findByRole('dialog', { name: 'Select a date' })
  }

  it('the zone used has a different day from the browser (the premise of the test)', () => {
    expect(zone).toBeDefined()
    expect(dayIn(zone)).not.toBe(browserDay)
  })

  it('marks the day of the zone as today, not the browser day', async () => {
    renderPeriod({ timeZone: zone })
    const box = await openCalendar()
    expect(box.querySelector('[data-today]')).toHaveAttribute('data-day', dayIn(zone))
    expect(box.querySelector('[data-day="' + browserDay + '"]')?.hasAttribute('data-today')).not.toBe(true)
  })

  it('without a zone it stays the browser day', async () => {
    renderPeriod()
    const box = await openCalendar()
    expect(box.querySelector('[data-today]')).toHaveAttribute('data-day', browserDay)
  })

  it('an empty or unknown zone falls back to the browser day', async () => {
    renderPeriod({ timeZone: 'Not/AZone' })
    const box = await openCalendar()
    expect(box.querySelector('[data-today]')).toHaveAttribute('data-day', browserDay)
  })

  it('«today until now» without `includesToday` is judged against the day of the zone', () => {
    const zoneDay = dayIn(zone)
    renderPeriod({ lapse: 'last_7_days', timeZone: zone, period: { from: '2026-10-01', to: zoneDay } })
    expect(document.querySelector('.odc-bi-period-dates')).toHaveTextContent('today until now')
  })

  it('a period that ended the day before today in the zone is not «until now», whatever the browser day is', () => {
    const yesterdayInZone = dayjs(dayIn(zone)).subtract(1, 'day').format('YYYY-MM-DD')
    renderPeriod({ lapse: 'last_7_days', timeZone: zone, period: { from: '2026-10-01', to: yesterdayInZone } })
    expect(document.querySelector('.odc-bi-period-dates')).not.toHaveTextContent('today until now')
  })
})

describe('the line of real dates', () => {
  const dates = () => document.querySelector('.odc-bi-period-dates')

  // redesign bi AC (B1): inside the group, after «Custom range», so a phone can put it on the same row (report-filters.css)
  it('is the last item of the «Period» group, after «Custom range» (a paragraph, not a control)', () => {
    renderPeriod()
    const group = screen.getByRole('group', { name: 'Period' })
    expect(dates().parentElement).toBe(group)
    expect(group.lastElementChild).toBe(dates())
    expect(dates().tagName).toBe('P')
    expect(group.lastElementChild.previousElementSibling).toBe(screen.getByRole('button', { name: /Custom range/ }))
    expect(within(group).getAllByRole('button')).toHaveLength(PRESETS.length + 1)
  })

  it('says the dates of the period, and «today until now» when it includes today and spans several days', () => {
    renderPeriod({ lapse: 'last_30_days', period: { from: '2026-09-09', to: '2026-10-09', includesToday: true } })
    expect(dates()).toHaveTextContent('09-09-2026 – 09-10-2026 · today until now')
  })

  it('does not say «today until now» when the period ended before today', () => {
    renderPeriod({ lapse: 'last_7_days', period: { from: '2026-10-01', to: '2026-10-07', includesToday: false } })
    expect(dates()).toHaveTextContent('01-10-2026 – 07-10-2026')
    expect(dates()).not.toHaveTextContent('today until now')
  })

  it('a single day is just the date, even if it is today', () => {
    renderPeriod({ lapse: 'today', period: TODAY_PERIOD })
    expect(dates()).toHaveTextContent(/^09-10-2026$/)
  })

  it('never shows an ISO date', () => {
    renderPeriod({ lapse: 'last_30_days', period: { from: '2026-09-09', to: '2026-10-09', includesToday: true } })
    expect(dates().textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('wraps the dates in <bdi> so a right-to-left page keeps them in order', () => {
    renderPeriod({ lapse: 'last_7_days', period: { from: '2026-10-01', to: '2026-10-07', includesToday: false } })
    expect(dates().querySelector('bdi')).toHaveTextContent('01-10-2026 – 07-10-2026')
  })

  it('paints nothing while the controller has no period', () => {
    renderPeriod({ period: undefined })
    expect(dates()).toBeNull()
  })

  it('follows the project date format', () => {
    mockState.configs = { dates_general_format: { value: 'MM/DD/YYYY HH:mm' } }
    renderPeriod({ lapse: 'yesterday', period: { from: '2026-10-08', to: '2026-10-08', includesToday: false } })
    expect(dates()).toHaveTextContent('10/08/2026')
  })
})

// The layout cannot be measured in jsdom: the sheet says what it promises.
describe('report-filters.css · the period part', () => {
  const css = readFileSync(path.resolve(__dirname, '../report-filters.css'), 'utf8')
  const mine = css.slice(css.indexOf('/* B1 */')).split('/* B2 */')[0]

  it('has its own part, marked /* B1 */, at the top of the file', () => {
    expect(css.indexOf('/* B1 */')).toBeGreaterThanOrEqual(0)
    if (css.includes('/* B2 */')) expect(css.indexOf('/* B1 */')).toBeLessThan(css.indexOf('/* B2 */'))
  })

  it('paints the selected one with the action tokens, not primary', () => {
    expect(mine).toMatch(/\[aria-pressed='true'\][^}]*\{[^}]*var\(--od-action-soft\)/)
    expect(mine).toMatch(/\[aria-pressed='true'\][^}]*\{[^}]*border-color:\s*var\(--od-action-content\)/)
    expect(mine).toMatch(/\[aria-pressed='true'\][^}]*\{[^}]*color:\s*var\(--od-action-content\)/)
  })

  // redesign bi AC (B1): the first figure of /intelligence/business was at y = 434 on a phone. The presets were a grid of two columns
  // (3 rows with «Custom range» across, 120 px) and the line of dates came under them. Now they wrap by their own width: the four
  // presets share the first row, «Custom range» (and the line of dates, when it fits) the second. Never a select, nothing behind a tap.
  it('a phone lets the presets wrap by their width (flex), never a grid of columns or a select; from 768 the row wraps too', () => {
    const phone = /@media \(max-width: 767px\)\s*\{([\s\S]*?)\n\}/.exec(mine)?.[1] ?? ''
    expect(mine).toMatch(/\.odc-bi-period-group\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/)
    expect(phone).not.toMatch(/grid-template-columns|display:\s*grid|grid-column/)
    expect(phone).not.toMatch(/\.odc-bi-period-group\s*>\s*\.odc-btn\s*\{[^}]*inline-size:\s*100%/)
    expect(mine).not.toMatch(/<select|select\b\s*\{/)
  })

  // redesign bi R1 (M1, decision 12): the chips are 32 visible with 44 of area on a phone, so two ROWS need 12 px between them
  // (--od-space-3 = 44 - 32) for their areas not to cross (touch probe at 390: 4 failures and 4 crosses at 8 px). Side by side the
  // chips are wider than 44 px, so the area does not grow sideways (--od-x-target-inset is per axis) and 8 px is enough.
  it('on a phone the rows of presets are 12 px apart (--od-space-3) and the chips 8 px (--od-space-2), so the 44 px areas do not cross', () => {
    const phone = /@media \(max-width: 767px\)\s*\{([\s\S]*?)\n\}/.exec(mine)?.[1] ?? ''
    expect(phone).toMatch(/\.odc-bi-period-group\s*\{[^}]*\brow-gap:\s*var\(--od-space-3\)/)
    expect(phone).toMatch(/\.odc-bi-period-group\s*\{[^}]*\bcolumn-gap:\s*var\(--od-space-2\)/)
    // from 768 the row keeps its 8 px both ways
    const wide = mine.slice(0, mine.indexOf('@media (max-width: 767px)'))
    expect(wide).toMatch(/\.odc-bi-period-group\s*\{[^}]*\bgap:\s*var\(--od-space-2\)/)
  })

  // redesign bi AC (B1): the line of dates is the last item of the group. From 768 it takes the whole row (its own line, as it was
  // under the group); on a phone it takes only what it needs, so with a short period («21-10-2026») it sits beside «Custom range».
  it('the line of dates takes its own line from 768 and the rest of the «Custom range» row on a phone', () => {
    const phone = /@media \(max-width: 767px\)\s*\{([\s\S]*?)\n\}/.exec(mine)?.[1] ?? ''
    const wide = mine.slice(0, mine.indexOf('@media (max-width: 767px)'))
    expect(wide).toMatch(/\.odc-bi-period-dates\s*\{[^}]*\bflex:\s*0 0 100%/)
    expect(phone).toMatch(/\.odc-bi-period-dates\s*\{[^}]*\bflex:\s*1 1 auto/)
    expect(phone).toMatch(/\.odc-bi-period-dates\s*\{[^}]*\bmin-inline-size:\s*0/)
  })

  it('uses tokens only: no color, length or duration literal', () => {
    const body = mine.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '{')
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(body).not.toMatch(/:[^;{}]*\b\d+(\.\d+)?(px|rem|em|ms)\b/)
  })
})

// redesign bi R1 (F3): the six figures must not push the page when they load. This sheet is read here because its own test file
// belongs to the other fix order (R1a); the layout cannot be measured in jsdom, so the sheet says what it promises.
describe('business-analytics.css · the references of the six figures reserve their final height', () => {
  const css = readFileSync(path.resolve(__dirname, '../../BusinessAnalytics/business-analytics.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const LINES = (n) => new RegExp(`min-block-size:\\s*calc\\(var\\(--od-x-type-caption-size\\)\\s*\\*\\s*var\\(--od-x-leading-ui\\)\\s*\\*\\s*${n}\\)`)
  // the body of the first rule whose selector holds `selector`, outside any @media (or inside the media block given)
  const rule = (source, selector) => {
    const start = source.indexOf(selector)
    return start < 0 ? '' : source.slice(start, source.indexOf('}', start))
  }
  const wideBlock = css.slice(css.indexOf('@media (min-width: 1280px)'))

  it('the main reference (data-lead) reserves 2 lines inside the figures of the page, and 3 from 1280 (six columns)', () => {
    const base = css.slice(0, css.indexOf('@media (min-width: 1280px)'))
    expect(rule(base, '.odc-bi-summary p[data-lead]')).toMatch(LINES(2))
    expect(rule(wideBlock, '.odc-bi-summary p[data-lead]')).toMatch(LINES(3))
  })

  it('the line of help (data-secondary) reserves 1 line at every width, also on a phone, loading or loaded', () => {
    expect(rule(css, '.odc-bi-summary p[data-secondary]')).toMatch(LINES(1))
  })

  it('the main reference rule does not catch the help lines (a skeleton of a help line is data-lead by default)', () => {
    expect(css).toMatch(/\.odc-bi-summary p\[data-lead\]:not\(\[data-secondary\]\)/)
  })

  // the sheet names no class that is not odc-bi-* (a test of the page checks it), so the lines of P/Metric are reached by their attributes
  it('does not touch metric.css or Home, and names no foreign class: only the page container and the data attributes', () => {
    expect(css).not.toMatch(/\.odc-metric/)
    expect(css).not.toMatch(/(^|\n)\s*p?\[data-lead\]/)
  })
})
