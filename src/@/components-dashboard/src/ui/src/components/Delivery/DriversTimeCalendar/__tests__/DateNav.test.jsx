/* eslint-disable import/first */
// redesign DT-B4 (DT-16, DT-17, DT-20, decision 13 | auditor 5): the dates of the drivers' time calendar: View (Day · Week), previous /
// next by the length of the range, a custom range in the brand popover (a draft until «Done», no more than 31 days apart), Today and
// the notice of a range that is too long. The page owns the range; the nav only asks to change it.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ configs: {} }))

vi.mock('../../../../../../index', async () => {
  const { getDateTimeFormats } = await import('../../../../../../utils/settingsCustomSections')
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
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

import { DateNav } from '../DateNav'
import { rangeOf, todayDay } from '../blockData'

const MONDAY = 1
// 11 Oct 2026 is a Sunday: its week from Monday is 5 to 11 Oct
const DAY = { from: '2026-10-11', to: '2026-10-11' }
const WEEK = { from: '2026-10-05', to: '2026-10-11' }
const CUSTOM = { from: '2026-10-05', to: '2026-10-08' }

const mount = (range = DAY, extra = {}) => {
  const props = {
    range,
    onRangeChange: vi.fn(),
    locale: 'en',
    firstDayOfWeek: MONDAY,
    rangeError: false,
    onRangeError: vi.fn(),
    ...extra
  }
  render(<DateNav {...props} />)
  return props
}
const pressed = (name) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

beforeEach(() => {
  mockState.configs = { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }
})
afterEach(() => {
  document.getElementById('app-modals')?.remove()
  vi.useRealTimers() // a test that fixed the clock gives it back even when it fails
})

describe('View: Day · Week', () => {
  it('names the group «View» and marks Day for a range of one day', () => {
    mount(DAY)
    const group = screen.getByRole('group', { name: 'View' })
    expect(within(group).getByRole('button', { name: 'Day' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'Week' })).toBeInTheDocument()
    expect(pressed('Day')).toBe('true')
    expect(pressed('Week')).toBe('false')
  })

  it('marks Week for the 7 days of a week that starts where the locale starts it', () => {
    mount(WEEK)
    expect(pressed('Week')).toBe('true')
    expect(pressed('Day')).toBe('false')
  })

  it('marks neither for a custom range', () => {
    mount(CUSTOM)
    expect(pressed('Week')).toBe('false')
    expect(pressed('Day')).toBe('false')
  })

  it('a week that does not start on the first day of the week is a custom range too', () => {
    mount({ from: '2026-10-06', to: '2026-10-12' })
    expect(pressed('Week')).toBe('false')
    expect(pressed('Day')).toBe('false')
  })

  it('Week asks for the week that holds the first day of the range', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount({ from: '2026-10-07', to: '2026-10-07' })
    await user.click(screen.getByRole('button', { name: 'Week' }))
    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect(onRangeChange).toHaveBeenCalledWith({ from: '2026-10-05', to: '2026-10-11' })
  })

  it('Week starts on the day the page gives (Sunday here)', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount({ from: '2026-10-07', to: '2026-10-07' }, { firstDayOfWeek: 0 })
    await user.click(screen.getByRole('button', { name: 'Week' }))
    expect(onRangeChange).toHaveBeenCalledWith({ from: '2026-10-04', to: '2026-10-10' })
  })

  it('Day asks for the first day of the range', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount(WEEK)
    await user.click(screen.getByRole('button', { name: 'Day' }))
    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect(onRangeChange).toHaveBeenCalledWith({ from: '2026-10-05', to: '2026-10-05' })
  })

  // Week (the current one) and back to Day used to open its first day (a past Monday), not today
  it('Day from the week that holds today is today', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount(rangeOf('week', todayDay(), MONDAY))
    await user.click(screen.getByRole('button', { name: 'Day' }))
    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect(onRangeChange).toHaveBeenCalledWith(rangeOf('day', todayDay()))
  })

  // on a Monday the range from Monday to today was one day, already a Day, and the test failed. The clock is fixed on a
  // Wednesday (only Date is faked, so userEvent's timers still run) and the range is Monday to today, more than one day.
  it('Day from a custom range that holds today is still its first day (R-05)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0))
    const user = userEvent.setup()
    const first = rangeOf('week', todayDay(), MONDAY).from
    expect(first).not.toBe(todayDay())
    const { onRangeChange } = mount({ from: first, to: todayDay() })
    await user.click(screen.getByRole('button', { name: 'Day' }))
    expect(onRangeChange).toHaveBeenCalledWith({ from: first, to: first })
  })

  it('Day from a custom range is its first day', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount(CUSTOM)
    await user.click(screen.getByRole('button', { name: 'Day' }))
    expect(onRangeChange).toHaveBeenCalledWith({ from: '2026-10-05', to: '2026-10-05' })
  })
})

describe('Previous · Next', () => {
  it('are native buttons named «Previous» and «Next»', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Previous' }).tagName).toBe('BUTTON')
    expect(screen.getByRole('button', { name: 'Next' }).tagName).toBe('BUTTON')
  })

  it('move a day', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount(DAY)
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: '2026-10-10', to: '2026-10-10' })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: '2026-10-12', to: '2026-10-12' })
  })

  it('move a week', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount(WEEK)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: '2026-10-12', to: '2026-10-18' })
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: '2026-09-28', to: '2026-10-04' })
  })

  it('move a custom range by its own length (4 days)', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount(CUSTOM)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: '2026-10-09', to: '2026-10-12' })
  })
})

describe('Today', () => {
  const FAR_DAY = { from: '2026-01-07', to: '2026-01-07' }
  const FAR_WEEK = { from: '2026-01-05', to: '2026-01-11' }

  it('from a day is the day of today', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount(FAR_DAY)
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect(onRangeChange).toHaveBeenCalledWith(rangeOf('day', todayDay()))
  })

  it('from a week is the week that holds today', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount(FAR_WEEK)
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(onRangeChange).toHaveBeenCalledWith(rangeOf('week', todayDay(), MONDAY))
  })

  it('from a custom range is the day of today', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount({ from: '2026-01-05', to: '2026-01-08' })
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(onRangeChange).toHaveBeenCalledWith(rangeOf('day', todayDay()))
  })
})

describe('the range button', () => {
  it('says a day in the format of the project, never ISO', () => {
    mount(DAY)
    const trigger = screen.getByRole('button', { name: '11-10-2026' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger.textContent).not.toMatch(/2026-10/)
  })

  it('says «from – to» for several days, in the format of the project', () => {
    mount(WEEK)
    expect(screen.getByRole('button', { name: '05-10-2026 – 11-10-2026' })).toBeInTheDocument()
  })

  it('follows another format of the project', () => {
    mockState.configs = { dates_general_format: { value: 'MM/DD/YYYY HH:mm' } }
    mount(DAY)
    expect(screen.getByRole('button', { name: '10/11/2026' })).toBeInTheDocument()
  })

  it('opens the brand popover with no presets, and a range is a draft until «Done»', async () => {
    const user = userEvent.setup()
    const { onRangeChange, onRangeError } = mount(DAY)
    await user.click(screen.getByRole('button', { name: '11-10-2026' }))
    const box = await screen.findByRole('dialog', { name: 'Select a date' })
    expect(box.querySelector('.odc-dr-preset')).toBeNull()
    await user.click(box.querySelector('[data-day="2026-10-13"]'))
    await user.click(box.querySelector('[data-day="2026-10-16"]'))
    expect(onRangeChange).not.toHaveBeenCalled()
    await user.click(within(box).getByRole('button', { name: 'Done' }))
    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect(onRangeChange).toHaveBeenCalledWith({ from: '2026-10-13', to: '2026-10-16' })
    expect(onRangeError).not.toHaveBeenCalledWith(true)
  })

  it('a single day picked and «Done» is that day as a range of one', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount(DAY)
    await user.click(screen.getByRole('button', { name: '11-10-2026' }))
    const box = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(box.querySelector('[data-day="2026-10-14"]'))
    await user.click(within(box).getByRole('button', { name: 'Done' }))
    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect(onRangeChange).toHaveBeenCalledWith({ from: '2026-10-14', to: '2026-10-14' })
  })

  it('leaving without «Done» applies nothing', async () => {
    const user = userEvent.setup()
    const { onRangeChange } = mount(DAY)
    await user.click(screen.getByRole('button', { name: '11-10-2026' }))
    const box = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(box.querySelector('[data-day="2026-10-14"]'))
    await user.keyboard('{Escape}')
    expect(onRangeChange).not.toHaveBeenCalled()
  })

  it('more than 31 days apart warns and does not change the range', async () => {
    const user = userEvent.setup()
    const { onRangeChange, onRangeError } = mount({ from: '2026-10-01', to: '2026-10-01' })
    await user.click(screen.getByRole('button', { name: '01-10-2026' }))
    const box = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(box.querySelector('[data-day="2026-10-01"]'))
    await user.click(within(box).getByRole('button', { name: 'Next month' }))
    await user.click(within(box).getByRole('button', { name: 'Next month' }))
    await user.click(box.querySelector('[data-day="2026-12-15"]'))
    await user.click(within(box).getByRole('button', { name: 'Done' }))
    expect(onRangeError).toHaveBeenCalledTimes(1)
    expect(onRangeError).toHaveBeenCalledWith(true)
    expect(onRangeChange).not.toHaveBeenCalled()
  })

  it('exactly 31 days apart is allowed (main\'s limit is «greater than 31»)', async () => {
    const user = userEvent.setup()
    const { onRangeChange, onRangeError } = mount({ from: '2026-10-01', to: '2026-10-01' })
    await user.click(screen.getByRole('button', { name: '01-10-2026' }))
    const box = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(box.querySelector('[data-day="2026-10-01"]'))
    await user.click(within(box).getByRole('button', { name: 'Next month' }))
    await user.click(box.querySelector('[data-day="2026-11-01"]'))
    await user.click(within(box).getByRole('button', { name: 'Done' }))
    expect(onRangeError).not.toHaveBeenCalledWith(true)
    expect(onRangeChange).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-11-01' })
  })
})

describe('the notice of a range that is too long', () => {
  it('shows nothing without an error', () => {
    mount(DAY, { rangeError: false })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('is a warning with the text of main (key DATE_RANGE_ERROR) when the page says so', () => {
    mount(DAY, { rangeError: true })
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('The difference between dates should not be greater than 31')
    expect(notice).toHaveAttribute('data-tone', 'warning')
  })

  it('goes away when the range changes (the next request clears it)', async () => {
    const user = userEvent.setup()
    const { onRangeChange, onRangeError } = mount(DAY, { rangeError: true })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect(onRangeError).toHaveBeenCalledWith(false)
  })
})
