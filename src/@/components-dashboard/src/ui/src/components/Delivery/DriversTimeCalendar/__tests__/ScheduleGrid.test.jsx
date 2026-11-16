/* eslint-disable import/first */
// redesign DT-B3 (DT-06, DT-07, DT-08, DT-09, DT-18, DT-24): the desktop grid of the drivers' time calendar. The text comes out
// of the real helpers of blockData.js; only the environment (language, the project date format, layout) is simulated. The
// Product wrappers are real.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
  // the project date format, as parseDate writes it: «14 Oct 2026»
  useUtils: () => [{
    parseDate: (value) => {
      const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
      return `${day} ${MONTHS[month - 1]} ${year}`
    }
  }]
}))

import { ScheduleGrid } from '../ScheduleGrid'
import { scanCss } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const DAY = '2026-10-14'
const WEEK = { from: '2026-10-11', to: '2026-10-17' }
const ONE_DAY = { from: DAY, to: DAY }

const block = (id, start, end, extra = {}) => ({
  id,
  name: '',
  description: '',
  start,
  end,
  break_start: null,
  break_end: null,
  rrule: null,
  until: null,
  ...extra
})

// the Nth half hour of a day as HH:mm:ss (0 → 00:00:00, 1 → 00:30:00 …)
const halfHour = (index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}:00`

const carlosBlock = block(9000, '2026-10-14 09:00:00', '2026-10-14 17:00:00', {
  break_start: '2026-10-14 13:00:00',
  break_end: '2026-10-14 13:30:00'
})
const jessicaBlock = block(9001, '2026-10-14 07:30:00', '2026-10-14 15:15:00')
const marcusMorning = block(9002, '2026-10-14 06:00:00', '2026-10-14 10:00:00', { name: 'Early run' })
const marcusEvening = block(9003, '2026-10-14 18:00:00', '2026-10-14 22:00:00', { name: 'Late run' })

const carlos = { id: 71, name: 'Carlos', lastname: 'Mendoza', email: 'carlos.mendoza@example.com', photo: null, delivery_blocks: [carlosBlock] }
const jessica = { id: 72, name: 'Jessica', lastname: 'Rivera', email: 'jessica@example.com', photo: 'https://example.com/jessica.png', delivery_blocks: [jessicaBlock] }
const marcus = { id: 73, name: 'Marcus', lastname: 'Lee', email: 'marcus@example.com', delivery_blocks: [marcusMorning, marcusEvening] }
// the API may leave delivery_blocks out (DT-24)
const sofia = { id: 74, name: 'Sofia', lastname: 'Gil', email: 'sofia@example.com' }

let current
const draw = (props = {}) => {
  current = {
    users: [carlos, jessica, marcus, sofia],
    loading: false,
    range: ONE_DAY,
    today: DAY,
    is12: false,
    onOpenBlock: vi.fn(),
    onAddBlock: vi.fn(),
    onShowDay: vi.fn(),
    ...props
  }
  return render(<ScheduleGrid {...current} />)
}

const rowOf = (container, id) => container.querySelector(`tr[data-user-id="${id}"]`)
const headerTexts = () => screen.getAllByRole('columnheader').map(header => header.textContent)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ScheduleGrid · a day (24 hours)', () => {
  it('is a table with a Driver column and one column per hour, 00:00 to 23:00', () => {
    draw()
    expect(screen.getByRole('table', { name: 'Drivers time display' })).toBeInTheDocument()
    const headers = headerTexts()
    expect(headers).toHaveLength(25)
    expect(headers[0]).toBe('Driver')
    expect(headers[1]).toBe('00:00')
    expect(headers[10]).toBe('09:00')
    expect(headers[24]).toBe('23:00')
  })

  it('the hours are figures; with a 12-hour clock they read 12:00 AM … 11:00 PM', () => {
    const { container } = draw({ is12: true })
    const hours = Array.from(container.querySelectorAll('th[data-hour]'))
    expect(hours).toHaveLength(24)
    hours.forEach(hour => expect(hour.querySelector('.odc-figure')).not.toBeNull())
    expect(hours[0]).toHaveTextContent('12:00 AM')
    expect(hours[9]).toHaveTextContent('09:00 AM')
    expect(hours[12]).toHaveTextContent('12:00 PM')
    expect(hours[23]).toHaveTextContent('11:00 PM')
  })

  it('the driver is the row header: avatar, full name, #id as a figure and the email clipped with its title (DT-06)', () => {
    const { container } = draw()
    const header = within(rowOf(container, 71)).getByRole('rowheader')
    expect(header.className).toContain('odc-sg-who')
    expect(header.querySelector('.odc-avatar')).not.toBeNull()
    const name = within(header).getByText('Carlos Mendoza')
    expect(name.tagName).toBe('STRONG')
    expect(name).toHaveAttribute('title', 'Carlos Mendoza')
    expect(name).toHaveAttribute('dir', 'auto')
    expect(within(header).getByText('#71')).toHaveClass('odc-figure')
    const email = within(header).getByText('carlos.mendoza@example.com')
    expect(email).toHaveAttribute('title', 'carlos.mendoza@example.com')
    expect(email).toHaveAttribute('dir', 'ltr')
  })

  it('a driver with a photo shows it, one without gets initials', () => {
    const { container } = draw()
    expect(within(rowOf(container, 72)).getByRole('rowheader').querySelector('img')).toHaveAttribute('src', 'https://example.com/jessica.png')
    expect(within(rowOf(container, 71)).getByRole('rowheader').querySelector('.odc-avatar')).toHaveTextContent('CM')
  })

  it('a block is a button named «time, break time, driver» and sits at its hours (08:00 long from 09:00)', async () => {
    const { container } = draw()
    const button = within(rowOf(container, 71)).getByRole('button', { name: '09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza' })
    expect(button.tagName).toBe('BUTTON')
    expect(button.style.getPropertyValue('--dt-from')).toBe('9')
    expect(button.style.getPropertyValue('--dt-span')).toBe('8')
    expect(button).toHaveTextContent('09:00 – 17:00')
    expect(within(button).getByText('09:00 – 17:00')).toHaveClass('odc-figure')
    await userEvent.click(button)
    expect(current.onOpenBlock).toHaveBeenCalledWith(carlos, carlosBlock, DAY)
  })

  it('a block off the hour is placed by its minutes (07:30 to 15:15 is 7.5 h in, 7.75 h long)', () => {
    const { container } = draw()
    const button = within(rowOf(container, 72)).getByRole('button', { name: '07:30 – 15:15, Jessica Rivera' })
    expect(button.style.getPropertyValue('--dt-from')).toBe('7.5')
    expect(button.style.getPropertyValue('--dt-span')).toBe('7.75')
  })

  it('a block with a name shows «name · hours» and keeps the name first in its accessible name', () => {
    const { container } = draw()
    const early = within(rowOf(container, 73)).getByRole('button', { name: 'Early run, 06:00 – 10:00, Marcus Lee' })
    expect(early).toHaveTextContent('Early run')
    expect(early).toHaveTextContent('06:00 – 10:00')
    expect(within(rowOf(container, 73)).getAllByRole('button', { name: /, Marcus Lee$/ })).toHaveLength(2)
  })

  it('the break is drawn inside the block, at its own offset (13:00 is 4 h into a block that starts at 09:00)', () => {
    const { container } = draw()
    const button = within(rowOf(container, 71)).getByRole('button', { name: /09:00 – 17:00/ })
    const strip = button.querySelector('.odc-sg-break')
    expect(strip).not.toBeNull()
    expect(strip).toHaveAttribute('aria-hidden', 'true')
    expect(strip.style.getPropertyValue('--dt-from')).toBe('4')
    expect(strip.style.getPropertyValue('--dt-span')).toBe('0.5')
    // a block without a break draws none
    expect(within(rowOf(container, 72)).getByRole('button', { name: /07:30/ }).querySelector('.odc-sg-break')).toBeNull()
  })

  it('a 12-hour clock reads in the block and in its name', () => {
    const { container } = draw({ is12: true })
    expect(within(rowOf(container, 71)).getByRole('button', { name: '09:00 AM – 05:00 PM, break 01:00 PM – 01:30 PM, Carlos Mendoza' })).toBeInTheDocument()
  })

  it('a block that crosses midnight reaches the end of the day', () => {
    const night = block(9010, '2026-10-14 22:00:00', '2026-10-15 02:00:00')
    const { container } = draw({ users: [{ ...sofia, delivery_blocks: [night] }] })
    const button = within(rowOf(container, 74)).getByRole('button', { name: /22:00/ })
    expect(button.style.getPropertyValue('--dt-from')).toBe('22')
    expect(button.style.getPropertyValue('--dt-span')).toBe('2')
  })

  it('every free hour is a button «Add shift for _name_ at _time_» that passes the hour (DT-08)', async () => {
    const { container } = draw()
    const row = within(rowOf(container, 71))
    await userEvent.click(row.getByRole('button', { name: 'Add shift for Carlos Mendoza at 17:00' }))
    expect(current.onAddBlock).toHaveBeenCalledWith(carlos, DAY, '17:00')
    await userEvent.click(row.getByRole('button', { name: 'Add shift for Carlos Mendoza at 02:00' }))
    expect(current.onAddBlock).toHaveBeenLastCalledWith(carlos, DAY, '02:00')
  })

  it('an hour a block covers has no add button (it would hide under the block); the others do', () => {
    const { container } = draw()
    const row = within(rowOf(container, 71))
    // 09:00–17:00 covers the hours 9…16
    for (let hour = 9; hour <= 16; hour += 1) {
      expect(row.queryByRole('button', { name: `Add shift for Carlos Mendoza at ${String(hour).padStart(2, '0')}:00` })).toBeNull()
    }
    expect(row.getByRole('button', { name: 'Add shift for Carlos Mendoza at 08:00' })).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Add shift for Carlos Mendoza at 17:00' })).toBeInTheDocument()
    expect(row.getAllByRole('button', { name: /^Add shift for/ })).toHaveLength(24 - 8)
  })

  it('a driver with no blocks has 24 add buttons', () => {
    const { container } = draw()
    expect(within(rowOf(container, 74)).getAllByRole('button', { name: /^Add shift for Sofia Gil at / })).toHaveLength(24)
  })

  it('a past day has no add buttons (DT-18) but still shows and opens its blocks', async () => {
    const past = '2026-10-13'
    const pastBlock = block(9020, '2026-10-13 09:00:00', '2026-10-13 12:00:00')
    const { container } = draw({ range: { from: past, to: past }, users: [{ ...carlos, delivery_blocks: [pastBlock] }] })
    expect(screen.queryByRole('button', { name: /^Add shift/ })).toBeNull()
    await userEvent.click(within(rowOf(container, 71)).getByRole('button', { name: '09:00 – 12:00, Carlos Mendoza' }))
    expect(current.onOpenBlock).toHaveBeenCalledWith(expect.anything(), pastBlock, past)
  })

  it('today and a future day do offer them', () => {
    const today = draw()
    expect(screen.getAllByRole('button', { name: /^Add shift for/ }).length).toBeGreaterThan(0)
    today.unmount()
    draw({ range: { from: '2026-10-20', to: '2026-10-20' } })
    expect(screen.getAllByRole('button', { name: /^Add shift for/ }).length).toBe(4 * 24)
  })

  it('only the blocks that start that day are drawn (by full date, DT-09)', () => {
    const otherMonth = block(9030, '2026-11-14 09:00:00', '2026-11-14 11:00:00')
    const { container } = draw({ users: [{ ...carlos, delivery_blocks: [otherMonth] }] })
    expect(within(rowOf(container, 71)).queryByRole('button', { name: /09:00 – 11:00/ })).toBeNull()
  })
})

describe('ScheduleGrid · opening position (DT-07)', () => {
  const stubLayout = () => vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.dataset?.hour !== undefined) {
      const left = Number(this.dataset.hour) * 100
      return { left, right: left + 100, width: 100, top: 0, bottom: 40, height: 40 }
    }
    if (this.classList?.contains('odc-sg-corner')) return { left: 0, right: 200, width: 200, top: 0, bottom: 40, height: 40 }
    return { left: 0, right: 1000, width: 1000, top: 0, bottom: 40, height: 40 }
  })

  it('opens an hour before the first block of the day, past the fixed driver column', () => {
    stubLayout()
    const { container } = draw() // the first start is 06:00 (Marcus): opens on 05:00
    // 05:00 is at 500 and the driver column takes 200
    expect(container.querySelector('.odc-sg-scroller').scrollLeft).toBe(300)
  })

  it('without blocks it opens on 08:00', () => {
    stubLayout()
    const { container } = draw({ users: [sofia] })
    expect(container.querySelector('.odc-sg-scroller').scrollLeft).toBe(600)
  })

  it('scrolls again when the day changes, and not when only the data does', () => {
    stubLayout()
    const { container, rerender } = draw()
    const scroller = container.querySelector('.odc-sg-scroller')
    expect(scroller.scrollLeft).toBe(300)
    scroller.scrollLeft = 123 // the person scrolled
    rerender(<ScheduleGrid {...current} users={[carlos, jessica]} />)
    expect(scroller.scrollLeft).toBe(123)
    // another day, no blocks: 08:00 — once its load ends (the controller always reloads on a new range; the old rows of the
    // previous day never decide where the new day opens)
    const nextDay = { from: '2026-10-15', to: '2026-10-15' }
    rerender(<ScheduleGrid {...current} range={nextDay} />)
    expect(scroller.scrollLeft).toBe(123)
    rerender(<ScheduleGrid {...current} range={nextDay} loading />)
    rerender(<ScheduleGrid {...current} range={nextDay} loading={false} />)
    expect(scroller.scrollLeft).toBe(600)
  })

  it('a page that mounts before its first load scrolls when the rows arrive (live check)', () => {
    stubLayout()
    const { container, rerender } = draw({ loading: false, users: [] })
    expect(container.querySelector('.odc-sg-scroller')).toBeNull()
    rerender(<ScheduleGrid {...current} loading users={[]} />)
    rerender(<ScheduleGrid {...current} loading={false} users={[jessica]} />)
    expect(container.querySelector('.odc-sg-scroller').scrollLeft).toBe(400)
  })

  it('waits for the data: it scrolls once the load ends, on the hours of what came', () => {
    stubLayout()
    const { container, rerender } = draw({ loading: true, users: [] })
    const scroller = container.querySelector('.odc-sg-scroller')
    expect(scroller.scrollLeft).toBe(0)
    rerender(<ScheduleGrid {...current} loading={false} users={[jessica]} />)
    // Jessica starts 07:30 → 06:00
    expect(scroller.scrollLeft).toBe(400)
    // a reload of the same day (after adding a block) does not take the person back
    scroller.scrollLeft = 55
    rerender(<ScheduleGrid {...current} loading users={[jessica]} />)
    rerender(<ScheduleGrid {...current} loading={false} users={[jessica, carlos]} />)
    expect(scroller.scrollLeft).toBe(55)
  })

  it('does not scroll a range of several days (they fit in columns)', () => {
    stubLayout()
    const { container } = draw({ range: WEEK })
    expect(container.querySelector('.odc-sg-scroller').scrollLeft).toBe(0)
  })
})

describe('ScheduleGrid · several days', () => {
  it('has a column per day with the short weekday and the number; today is aria-current', () => {
    const { container } = draw({ range: WEEK })
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(8)
    expect(headers[0]).toHaveTextContent('Driver')
    expect(headers[1]).toHaveTextContent('Sun11')
    expect(headers[4]).toHaveTextContent('Wed14')
    expect(headers[7]).toHaveTextContent('Sat17')
    expect(headers[4]).toHaveAttribute('aria-current', 'date')
    expect(container.querySelectorAll('th[aria-current="date"]')).toHaveLength(1)
    expect(within(headers[4]).getByText('14')).toHaveClass('odc-figure')
  })

  it('a day column with no hour columns: no hours, no lanes', () => {
    const { container } = draw({ range: WEEK })
    expect(container.querySelector('th[data-hour]')).toBeNull()
    expect(container.querySelector('.odc-sg-track')).toBeNull()
  })

  it('a cell lists its blocks as buttons with only the hours, named like the day ones', async () => {
    const { container } = draw({ range: WEEK })
    const cell = rowOf(container, 71).querySelector('td[data-day="2026-10-14"]')
    const button = within(cell).getByRole('button', { name: '09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza' })
    expect(button).toHaveTextContent(/^09:00 – 17:00break 13:00 – 13:30$/)
    expect(within(button).getByText('09:00 – 17:00')).toHaveClass('odc-figure')
    await userEvent.click(button)
    expect(current.onOpenBlock).toHaveBeenCalledWith(carlos, carlosBlock, DAY)
    // the other days of the row have none
    expect(rowOf(container, 71).querySelectorAll('td[data-day] .odc-sg-chip')).toHaveLength(1)
  })

  it('Marcus has two blocks the same day: both show, no «more»', () => {
    const { container } = draw({ range: WEEK })
    const cell = rowOf(container, 73).querySelector('td[data-day="2026-10-14"]')
    expect(within(cell).getAllByRole('button', { name: /Marcus Lee$/ })).toHaveLength(2)
    expect(within(cell).queryByRole('button', { name: /more/ })).toBeNull()
  })

  const crowded = (count) => ({
    ...sofia,
    delivery_blocks: Array.from({ length: count }, (_, index) => block(9100 + index, `2026-10-14 ${halfHour(index)}`, `2026-10-14 ${halfHour(index + 1)}`))
  })

  it('with 3 blocks the cell lists 2 and says «+1 more», which asks for the whole day', async () => {
    const user = crowded(3)
    const { container } = draw({ range: WEEK, users: [user] })
    const cell = rowOf(container, 74).querySelector('td[data-day="2026-10-14"]')
    expect(within(cell).getAllByRole('button', { name: /Sofia Gil$/ })).toHaveLength(2)
    const more = within(cell).getByRole('button', { name: '+1 more' })
    expect(within(more).getByText('1')).toHaveClass('odc-figure')
    await userEvent.click(more)
    expect(current.onShowDay).toHaveBeenCalledWith(user, DAY, user.delivery_blocks)
  })

  it('30 blocks in a day do not throw (DT-24, it was Array(24 - n)) and say «+28 more»', () => {
    expect(() => draw({ range: WEEK, users: [crowded(30)] })).not.toThrow()
    expect(screen.getByRole('button', { name: '+28 more' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Sofia Gil$/ })).toHaveLength(2)
  })

  it('30 blocks in the 24-hour view do not throw either, and all 30 are buttons', () => {
    const { container } = draw({ users: [crowded(30)] })
    expect(within(rowOf(container, 74)).getAllByRole('button', { name: /, Sofia Gil$/ })).toHaveLength(30)
  })

  it('a day column has «Add shift for _name_ on _date_» that passes the day with no hour', async () => {
    const { container } = draw({ range: WEEK })
    const cell = rowOf(container, 71).querySelector('td[data-day="2026-10-15"]')
    const add = within(cell).getByRole('button', { name: 'Add shift for Carlos Mendoza on 15 Oct 2026' })
    expect(within(add).queryByText(/Add/)).toBeNull() // an icon, the name is the label
    await userEvent.click(add)
    expect(current.onAddBlock).toHaveBeenCalledWith(carlos, '2026-10-15', null)
  })

  it('today has one too (it passes today), past days do not (DT-18)', async () => {
    const { container } = draw({ range: WEEK })
    const row = rowOf(container, 71)
    await userEvent.click(within(row.querySelector('td[data-day="2026-10-14"]')).getByRole('button', { name: 'Add shift for Carlos Mendoza on 14 Oct 2026' }))
    expect(current.onAddBlock).toHaveBeenCalledWith(carlos, DAY, null)
    for (const past of ['2026-10-11', '2026-10-12', '2026-10-13']) {
      expect(within(row.querySelector(`td[data-day="${past}"]`)).queryByRole('button', { name: /^Add shift/ })).toBeNull()
    }
    expect(within(row).getAllByRole('button', { name: /^Add shift for/ })).toHaveLength(4)
  })

  it('a past day still lists its blocks', () => {
    const pastBlock = block(9040, '2026-10-12 08:00:00', '2026-10-12 12:00:00')
    const { container } = draw({ range: WEEK, users: [{ ...carlos, delivery_blocks: [pastBlock] }] })
    expect(within(rowOf(container, 71).querySelector('td[data-day="2026-10-12"]')).getByRole('button', { name: '08:00 – 12:00, Carlos Mendoza' })).toBeInTheDocument()
  })

  it('a range that crosses a month tells the 15th of October from the 15th of November (DT-09)', () => {
    const october = block(9050, '2026-10-15 09:00:00', '2026-10-15 10:00:00')
    const november = block(9051, '2026-11-15 14:00:00', '2026-11-15 16:00:00')
    const { container } = draw({
      range: { from: '2026-10-15', to: '2026-11-15' },
      users: [{ ...carlos, delivery_blocks: [october, november] }]
    })
    expect(container.querySelectorAll('th[scope="col"]')).toHaveLength(1 + 32)
    const row = rowOf(container, 71)
    const octoberCell = row.querySelector('td[data-day="2026-10-15"]')
    const novemberCell = row.querySelector('td[data-day="2026-11-15"]')
    expect(within(octoberCell).getAllByRole('button', { name: /Carlos Mendoza$/ }).filter(item => item.className.includes('odc-sg-chip'))).toHaveLength(1)
    expect(octoberCell).toHaveTextContent('09:00 – 10:00')
    expect(octoberCell).not.toHaveTextContent('14:00 – 16:00')
    expect(novemberCell).toHaveTextContent('14:00 – 16:00')
    expect(novemberCell).not.toHaveTextContent('09:00 – 10:00')
  })

  it('a custom range of 3 days is 3 columns', () => {
    draw({ range: { from: '2026-10-14', to: '2026-10-16' } })
    expect(headerTexts()).toHaveLength(4)
  })
})

const buttonsOf = (row) => Array.from(row.querySelectorAll('button'))
const tabStopsOf = (row) => buttonsOf(row).filter(button => button.tabIndex === 0)
const nameOf = (button) => button.getAttribute('aria-label')

describe('ScheduleGrid · keyboard (R-04, a roving tab stop per row)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('a day: exactly one button of each row is a tab stop, and Tab walks one stop per row', async () => {
    const { container } = draw()
    for (const id of [71, 72, 73, 74]) expect(tabStopsOf(rowOf(container, id))).toHaveLength(1)
    // 4 rows → 4 stops, in the order of the rows (not 200+ stops)
    await userEvent.tab()
    expect(document.activeElement).toBe(tabStopsOf(rowOf(container, 71))[0])
    await userEvent.tab()
    expect(document.activeElement).toBe(tabStopsOf(rowOf(container, 72))[0])
    await userEvent.tab()
    await userEvent.tab()
    expect(document.activeElement).toBe(tabStopsOf(rowOf(container, 74))[0])
  })

  it('the row starts on its first block; without blocks, on the free hour of the day opening (05:00 here)', () => {
    const { container } = draw()
    expect(nameOf(tabStopsOf(rowOf(container, 71))[0])).toBe('09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza')
    expect(nameOf(tabStopsOf(rowOf(container, 72))[0])).toBe('07:30 – 15:15, Jessica Rivera')
    expect(nameOf(tabStopsOf(rowOf(container, 73))[0])).toBe('Early run, 06:00 – 10:00, Marcus Lee')
    expect(nameOf(tabStopsOf(rowOf(container, 74))[0])).toBe('Add shift for Sofia Gil at 05:00')
  })

  it('the free hour a row starts on follows the opening hour of the day (09:00 when the first block of the day starts at 10:00)', () => {
    const late = block(9060, '2026-10-14 10:00:00', '2026-10-14 17:00:00')
    const { container } = draw({ users: [{ ...sofia, id: 90, delivery_blocks: [] }, { ...carlos, id: 91, delivery_blocks: [late] }] })
    expect(nameOf(tabStopsOf(rowOf(container, 90))[0])).toBe('Add shift for Sofia Gil at 09:00')
    expect(nameOf(tabStopsOf(rowOf(container, 91))[0])).toBe('10:00 – 17:00, Carlos Mendoza')
  })

  it('the buttons of a lane are in the order of the day: free hours and blocks interleaved', () => {
    const { container } = draw()
    const names = buttonsOf(rowOf(container, 71)).map(nameOf)
    expect(names).toHaveLength(17)
    expect(names[0]).toBe('Add shift for Carlos Mendoza at 00:00')
    expect(names[8]).toBe('Add shift for Carlos Mendoza at 08:00')
    expect(names[9]).toBe('09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza')
    expect(names[10]).toBe('Add shift for Carlos Mendoza at 17:00')
    expect(names[16]).toBe('Add shift for Carlos Mendoza at 23:00')
    const marcus = buttonsOf(rowOf(container, 73)).map(nameOf)
    expect(marcus.findIndex(name => name.startsWith('Early run'))).toBeLessThan(marcus.indexOf('Add shift for Marcus Lee at 10:00'))
    expect(marcus.findIndex(name => name.startsWith('Late run'))).toBeGreaterThan(marcus.indexOf('Add shift for Marcus Lee at 17:00'))
  })

  it('ArrowRight and ArrowLeft move along the row and make the new button the only tab stop', async () => {
    const { container } = draw()
    const row = rowOf(container, 71)
    tabStopsOf(row)[0].focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Carlos Mendoza at 17:00')
    expect(tabStopsOf(row)).toEqual([document.activeElement])
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement).toHaveAttribute('aria-label', '09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza')
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Carlos Mendoza at 08:00')
    expect(tabStopsOf(row)).toEqual([document.activeElement])
  })

  it('Home and End go to the first and the last button of the row; the ends do not wrap', async () => {
    const { container } = draw()
    const row = rowOf(container, 71)
    tabStopsOf(row)[0].focus()
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Carlos Mendoza at 23:00')
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Carlos Mendoza at 23:00')
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Carlos Mendoza at 00:00')
    expect(tabStopsOf(row)).toEqual([document.activeElement])
  })

  it('right to left the arrows are inverted (ArrowLeft goes to the next button)', async () => {
    const original = window.getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const style = original(element, pseudo)
      return new Proxy(style, {
        get: (target, key) => (key === 'direction' ? 'rtl' : typeof target[key] === 'function' ? target[key].bind(target) : target[key])
      })
    })
    const { container } = draw()
    const row = rowOf(container, 71)
    tabStopsOf(row)[0].focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Carlos Mendoza at 17:00')
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toHaveAttribute('aria-label', '09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza')
  })

  it('ArrowDown and ArrowUp go to the button of the next or previous row nearest in time', async () => {
    const { container } = draw()
    tabStopsOf(rowOf(container, 71))[0].focus() // Carlos 09:00
    await userEvent.keyboard('{ArrowDown}')
    // Jessica: her block starts 07:30, nearer to 09:00 than any free hour
    expect(document.activeElement).toHaveAttribute('aria-label', '07:30 – 15:15, Jessica Rivera')
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Early run, 06:00 – 10:00, Marcus Lee')
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Sofia Gil at 06:00')
    await userEvent.keyboard('{ArrowDown}') // the last row stays
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Sofia Gil at 06:00')
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Early run, 06:00 – 10:00, Marcus Lee')
    // each row keeps its own tab stop where the person left it
    expect(tabStopsOf(rowOf(container, 71))).toHaveLength(1)
    expect(nameOf(tabStopsOf(rowOf(container, 72))[0])).toBe('07:30 – 15:15, Jessica Rivera')
    expect(nameOf(tabStopsOf(rowOf(container, 74))[0])).toBe('Add shift for Sofia Gil at 06:00')
  })

  it('moving by keys keeps the frame where it is: it only asks for the nearest edge, never for 00:00', async () => {
    const { container } = draw()
    const scroller = container.querySelector('.odc-sg-scroller')
    scroller.scrollLeft = 321
    tabStopsOf(rowOf(container, 71))[0].focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    expect(scroller.scrollLeft).toBe(321)
  })

  it('several days: the row starts on the first button of its first day that is not past', () => {
    const early = block(9070, '2026-10-12 08:00:00', '2026-10-12 09:00:00')
    const { container } = draw({ range: WEEK, users: [carlos, { ...jessica, delivery_blocks: [early] }, marcus, sofia] })
    expect(nameOf(tabStopsOf(rowOf(container, 71))[0])).toBe('09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza')
    // Jessica has a block on a past day: still, the stop is on today (its add button)
    expect(nameOf(tabStopsOf(rowOf(container, 72))[0])).toBe('Add shift for Jessica Rivera on 14 Oct 2026')
    expect(nameOf(tabStopsOf(rowOf(container, 73))[0])).toBe('Early run, 06:00 – 10:00, Marcus Lee')
    expect(nameOf(tabStopsOf(rowOf(container, 74))[0])).toBe('Add shift for Sofia Gil on 14 Oct 2026')
    for (const id of [71, 72, 73, 74]) expect(tabStopsOf(rowOf(container, id))).toHaveLength(1)
  })

  it('several days: the buttons of a row run by day, then block, «+N more», add', () => {
    const many = { ...sofia, delivery_blocks: Array.from({ length: 3 }, (_, index) => block(9100 + index, `2026-10-14 ${halfHour(index)}`, `2026-10-14 ${halfHour(index + 1)}`)) }
    const { container } = draw({ range: WEEK, users: [many] })
    const names = buttonsOf(rowOf(container, 74)).map(button => nameOf(button) ?? button.textContent)
    expect(names).toEqual([
      '00:00 – 00:30, Sofia Gil',
      '00:30 – 01:00, Sofia Gil',
      '+1 more',
      'Add shift for Sofia Gil on 14 Oct 2026',
      'Add shift for Sofia Gil on 15 Oct 2026',
      'Add shift for Sofia Gil on 16 Oct 2026',
      'Add shift for Sofia Gil on 17 Oct 2026'
    ])
  })

  it('several days: arrows walk the row, Down goes to the nearest day of the next row, End to the last button', async () => {
    const { container } = draw({ range: WEEK })
    tabStopsOf(rowOf(container, 71))[0].focus() // Carlos, 14th, his block
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Carlos Mendoza on 14 Oct 2026')
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Carlos Mendoza on 15 Oct 2026')
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Jessica Rivera on 15 Oct 2026')
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Jessica Rivera on 17 Oct 2026')
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toHaveAttribute('aria-label', 'Add shift for Carlos Mendoza on 17 Oct 2026')
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toHaveAttribute('aria-label', '09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza')
  })

  it('the tab stop goes back to the start when the range changes', async () => {
    const { container, rerender } = draw()
    tabStopsOf(rowOf(container, 71))[0].focus()
    await userEvent.keyboard('{End}')
    expect(nameOf(tabStopsOf(rowOf(container, 71))[0])).toBe('Add shift for Carlos Mendoza at 23:00')
    rerender(<ScheduleGrid {...current} range={{ from: '2026-10-15', to: '2026-10-15' }} />)
    expect(nameOf(tabStopsOf(rowOf(container, 71))[0])).toBe('Add shift for Carlos Mendoza at 08:00')
  })
})

describe('ScheduleGrid · the frame opens at the start of a range of several days (R-05)', () => {
  const stubLayout = () => vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.dataset?.hour !== undefined) {
      const left = Number(this.dataset.hour) * 100
      return { left, right: left + 100, width: 100, top: 0, bottom: 40, height: 40 }
    }
    if (this.classList?.contains('odc-sg-corner')) return { left: 0, right: 200, width: 200, top: 0, bottom: 40, height: 40 }
    return { left: 0, right: 1000, width: 1000, top: 0, bottom: 40, height: 40 }
  })

  it('going from a day (scrolled to its first hour) to a week puts the frame at 0', () => {
    stubLayout()
    const { container, rerender } = draw()
    const scroller = container.querySelector('.odc-sg-scroller')
    expect(scroller.scrollLeft).toBe(300)
    rerender(<ScheduleGrid {...current} range={WEEK} />)
    expect(scroller.scrollLeft).toBe(0)
  })

  it('changing the range while in several days puts the frame at 0 again', () => {
    const { container, rerender } = draw({ range: WEEK })
    const scroller = container.querySelector('.odc-sg-scroller')
    scroller.scrollLeft = 480
    rerender(<ScheduleGrid {...current} range={{ from: '2026-10-11', to: '2026-10-18' }} />)
    expect(scroller.scrollLeft).toBe(0)
  })

  it('a reload of the same range does not take the person back', () => {
    const { container, rerender } = draw({ range: WEEK })
    const scroller = container.querySelector('.odc-sg-scroller')
    scroller.scrollLeft = 480
    rerender(<ScheduleGrid {...current} range={{ ...WEEK }} users={[carlos]} />)
    expect(scroller.scrollLeft).toBe(480)
  })

  it('coming back to the same day from a week opens on its first hour again', () => {
    stubLayout()
    const { container, rerender } = draw()
    const scroller = container.querySelector('.odc-sg-scroller')
    rerender(<ScheduleGrid {...current} range={WEEK} />)
    expect(scroller.scrollLeft).toBe(0)
    rerender(<ScheduleGrid {...current} range={ONE_DAY} />)
    expect(scroller.scrollLeft).toBe(300)
  })
})

describe('ScheduleGrid · the break shows in a day cell (R-07)', () => {
  it('a block with a break has a second line «break 13:00 – 13:30», its hours a figure; one without has none', () => {
    const { container } = draw({ range: WEEK })
    const cell = rowOf(container, 71).querySelector('td[data-day="2026-10-14"]')
    const line = cell.querySelector('.odc-sg-chip-break')
    expect(line).toHaveTextContent('break 13:00 – 13:30')
    expect(within(line).getByText('13:00 – 13:30')).toHaveClass('odc-figure')
    // the accessible name does not change
    expect(within(cell).getByRole('button', { name: '09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza' })).toContainElement(line)
    expect(rowOf(container, 72).querySelector('.odc-sg-chip-break')).toBeNull()
  })

  it('with a 12-hour clock the break reads the same way as the block', () => {
    const { container } = draw({ range: WEEK, is12: true })
    expect(rowOf(container, 71).querySelector('.odc-sg-chip-break')).toHaveTextContent('break 01:00 PM – 01:30 PM')
  })
})

describe('the page frame (R-08)', () => {
  const page = readFileSync(resolvePath(__dirname, '../drivers-time-page.css'), 'utf8')
  const rule = (css, selector) => css.match(new RegExp(`${selector.replace(/[.]/g, '\\.')}\\s*\\{[^}]*\\}`))?.[0] ?? ''

  it('the page takes the width the shell leaves (flex-basis 0), whatever the table inside is wide', () => {
    // it is a flex child of the shell: with an auto basis its width follows the content, so a 24-hour table pushes it to the
    // window and a week table lets it shrink (the header moved ~54px between Day and Week)
    expect(rule(page, '.odc-dtd-page')).toMatch(/flex:\s*1 1 0/)
    expect(rule(page, '.odc-dtd-page')).toMatch(/min-inline-size:\s*0/)
  })

  it('the grid cannot widen what holds it: its frame is limited to the page and scrolls on its own', () => {
    const grid = readFileSync(resolvePath(__dirname, '../schedule-grid.css'), 'utf8')
    expect(rule(grid, '.odc-sg')).toMatch(/min-inline-size:\s*0/)
    expect(rule(grid, '.odc-sg-scroller')).toMatch(/max-inline-size:\s*100%/)
    expect(rule(grid, '.odc-sg-scroller')).toMatch(/overflow-x:\s*auto/)
  })

  it('the frame keeps what it scrolls to clear of the fixed driver column', () => {
    const grid = readFileSync(resolvePath(__dirname, '../schedule-grid.css'), 'utf8')
    expect(rule(grid, '.odc-sg-scroller')).toMatch(/scroll-padding-inline-start:\s*var\(--dt-who\)/)
  })
})

describe('ScheduleGrid · states', () => {
  it('without drivers and not loading says «No drivers found»', () => {
    draw({ users: [] })
    expect(screen.getByText('No drivers found')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('a missing list is empty too, and delivery_blocks may be missing (DT-24)', () => {
    const empty = draw({ users: undefined })
    expect(screen.getByText('No drivers found')).toBeInTheDocument()
    empty.unmount()
    expect(() => draw({ users: [sofia, { id: 75, name: 'No blocks', delivery_blocks: null }] })).not.toThrow()
    expect(screen.getByText('Sofia Gil')).toBeInTheDocument()
  })

  it('a user with no name, id-only, still draws a row', () => {
    const { container } = draw({ users: [{ id: 80 }] })
    expect(rowOf(container, 80)).not.toBeNull()
  })

  it('loading draws skeleton rows, announces itself once and shows no empty state', () => {
    const { container } = draw({ loading: true, users: [] })
    expect(container.querySelectorAll('tr[data-skeleton]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(container.querySelector('.odc-sg')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('No drivers found')).toBeNull()
  })

  it('loading hides the old rows (they belong to another range)', () => {
    const { container } = draw({ loading: true })
    expect(container.querySelector('tr[data-user-id]')).toBeNull()
    expect(screen.queryByText('Carlos Mendoza')).toBeNull()
  })

  it('loading several days draws the skeleton in the day cells too', () => {
    const { container } = draw({ loading: true, users: [], range: WEEK })
    expect(container.querySelector('tr[data-skeleton] td .odc-skeleton')).not.toBeNull()
  })

  it('works without handlers (a press is harmless)', async () => {
    const { container } = draw({ onOpenBlock: undefined, onAddBlock: undefined, onShowDay: undefined })
    await userEvent.click(within(rowOf(container, 71)).getByRole('button', { name: /09:00 – 17:00/ }))
    await userEvent.click(within(rowOf(container, 71)).getByRole('button', { name: /at 08:00$/ }))
  })
})

describe('schedule-grid.css', () => {
  const css = readFileSync(resolvePath(__dirname, '../schedule-grid.css'), 'utf8')

  it('has no literal color, length, weight, duration or z-index (the Product literal guard)', () => {
    expect(scanCss(css)).toEqual([])
  })

  it('every var(--od-*) it reads is a defined token', () => {
    const defined = new Set()
    for (const file of ['src/brand/ordering.tokens.generated.css', 'src/brand/candidates.css']) {
      const source = readFileSync(resolvePath(__dirname, '../../../../../../../../../../', file), 'utf8')
      for (const match of source.matchAll(/(--od-[\w-]+)\s*:/g)) defined.add(match[1])
    }
    const used = [...new Set(Array.from(css.matchAll(/var\((--od-[\w-]+)/g)).map(match => match[1]))]
    expect(used.length).toBeGreaterThan(0)
    expect(used.filter(name => !defined.has(name))).toEqual([])
  })

  it('has no fallback value in a var() and no custom property of its own that is not --dt-*', () => {
    expect(css).not.toMatch(/var\(--[\w-]+\s*,/)
    const own = Array.from(css.matchAll(/(^|[\s{;])(--[\w-]+)\s*:/g)).map(match => match[2])
    expect(own.filter(name => !name.startsWith('--dt-'))).toEqual([])
  })

  it('uses logical properties only', () => {
    expect(css).not.toMatch(/\b(margin|padding|border)-(left|right|top|bottom)\b/)
    expect(css).not.toMatch(/(^|[\s;{])(left|right|top|bottom|width|height|min-width|max-width|min-height|max-height)\s*:/m)
    expect(css).not.toMatch(/text-align:\s*(left|right)/)
  })

  it('the hour width is built from a space token, with no bare number', () => {
    const hour = css.match(/--dt-hour:\s*([^;]+);/)?.[1] ?? ''
    expect(hour).toMatch(/var\(--od-space-\d+\)/)
    expect(hour).not.toMatch(/\d(px|rem|em)/)
  })

  it('the frame scrolls sideways on its own and the driver column is sticky from the start edge', () => {
    expect(css.match(/\.odc-sg-scroller\s*\{[^}]*\}/)?.[0]).toMatch(/overflow-x:\s*auto/)
    const who = css.match(/\.odc-sg-who[^{]*\{[^}]*\}/)?.[0] ?? ''
    expect(who).toMatch(/position:\s*sticky/)
    expect(who).toMatch(/inset-inline-start:\s*0/)
    expect(who).toMatch(/background:\s*var\(--od-bg\)/)
  })

  it('every own class starts with odc-sg- and the 44px reach is a pseudo-element under a coarse pointer or a phone', () => {
    const own = Array.from(css.matchAll(/\.(odc-[a-z0-9-]+)/g)).map(match => match[1])
    expect([...new Set(own)].filter(name => name !== 'odc-sg' && !name.startsWith('odc-sg-') && !['odc-icon', 'odc-figure', 'odc-rtl'].includes(name))).toEqual([])
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{[\s\S]*::after[\s\S]*inset:\s*var\(--od-x-target-inset\)/)
  })

  it('every control shows a focus ring from the focus tokens', () => {
    expect(css).toMatch(/:focus-visible[^{]*\{[^}]*outline:\s*var\(--od-focus-ring-width\) solid var\(--od-focus-ring-color\)/)
  })
})
