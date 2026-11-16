// redesign (row 71, Q-09): «today» of the calendar is the browser's day unless the host passes its own `today`
// (`YYYY-MM-DD`, what `todayDay()` returns): the BI reports pass the day of the zone of the report, which can differ from the
// browser's. DateRangePopover forwards it to its calendar. Without the prop nothing changes.
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DayCalendar } from '../DayCalendar'
import { DateRangePopover } from '../DateRangePopover'

const labels = {
  title: 'Select a date',
  presets: 'Date',
  close: 'Close',
  done: 'Done',
  from: 'From',
  to: 'To',
  today: 'Today',
  goToToday: 'Go to today',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  rangeOrder: 'The start date must not be after the end date.',
  invalidDate: (format) => `Enter a real date as ${format}.`
}

// the browser's day: 10 October 2026 at noon, local time. Only Date is faked, so user-event keeps its timers.
beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date(2026, 9, 10, 12, 0, 0)))
afterEach(() => {
  vi.useRealTimers()
  document.getElementById('app-modals')?.remove()
})

const calendar = (props = {}) => render(
  <DayCalendar
    month='2026-10-01'
    onMonthChange={vi.fn()}
    from={null}
    to={null}
    onPick={vi.fn()}
    locale='en'
    firstDayOfWeek={1}
    labels={labels}
    dir='ltr'
    {...props}
  />
)

const todays = () => [...document.querySelectorAll('[data-today]')].map(node => node.getAttribute('data-day'))

describe('DayCalendar · today', () => {
  it('without `today` it is the browser day', () => {
    calendar()
    expect(todays()).toEqual(['2026-10-10'])
    expect(document.querySelector('[data-day="2026-10-10"]')).toHaveAttribute('aria-current', 'date')
  })

  it('with `today` the highlight and aria-current are on that day, not on the browser one', () => {
    calendar({ today: '2026-10-12' })
    expect(todays()).toEqual(['2026-10-12'])
    expect(document.querySelector('[data-day="2026-10-12"]')).toHaveAttribute('aria-current', 'date')
    expect(document.querySelector('[data-day="2026-10-10"]')).not.toHaveAttribute('aria-current')
  })

  it('«Go to today» goes to the given day, its month included', async () => {
    const user = userEvent.setup()
    const onMonthChange = vi.fn()
    calendar({ today: '2026-11-02', onMonthChange })
    await user.click(screen.getByRole('button', { name: 'Go to today' }))
    expect(onMonthChange).toHaveBeenCalledWith('2026-11-01')
  })

  it('«Go to today» without the prop goes to the browser month', async () => {
    const user = userEvent.setup()
    const onMonthChange = vi.fn()
    calendar({ month: '2026-12-01', onMonthChange })
    await user.click(screen.getByRole('button', { name: 'Go to today' }))
    expect(onMonthChange).toHaveBeenCalledWith('2026-10-01')
  })

  it('the one tab stop is the given today when nothing is chosen', () => {
    calendar({ today: '2026-10-12' })
    expect(document.querySelector('[data-day="2026-10-12"]')).toHaveAttribute('tabindex', '0')
    expect(document.querySelector('[data-day="2026-10-10"]')).toHaveAttribute('tabindex', '-1')
  })
})

describe('DateRangePopover · today', () => {
  const mount = (props = {}) => render(
    <DateRangePopover
      presets={[]}
      dateFormat='DD-MM-YYYY'
      triggerText='Date'
      labels={labels}
      locale='en'
      onPreset={vi.fn()}
      onRange={vi.fn()}
      renderTrigger={({ ref, expanded, toggle }) => (
        <button ref={ref} type='button' aria-expanded={expanded} onClick={toggle}>Date</button>
      )}
      {...props}
    />
  )
  const open = async () => {
    await userEvent.setup().click(screen.getByRole('button', { name: 'Date' }))
    return screen.findByRole('dialog', { name: 'Select a date' })
  }

  it('without `today` it opens on the browser month, today highlighted', async () => {
    mount()
    await open()
    expect(todays()).toEqual(['2026-10-10'])
  })

  it('with `today` and no range it opens on the month of that day, today highlighted there', async () => {
    mount({ today: '2026-12-15' })
    await open()
    expect(todays()).toEqual(['2026-12-15'])
    expect(document.querySelector('.odc-dr-cal-title')).toHaveTextContent('December 2026')
  })

  it('with a range, it still opens on the range', async () => {
    mount({ today: '2026-12-15', from: '2026-09-10', to: '2026-09-12' })
    await open()
    expect(document.querySelector('.odc-dr-cal-title')).toHaveTextContent('September 2026')
  })
})
