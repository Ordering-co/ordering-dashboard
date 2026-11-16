import React, { useEffect, useId, useRef, useState } from 'react'

import { Button, IconButton } from './Button'
import { ChevronLeft, ChevronRight } from '../Icon'
import {
  buildMonth,
  makeDayLabelers,
  monthOf,
  shiftDay,
  todayDay
} from '../../../../../utils/dateRange'

// redesign W0-7 (T0-28): promoted from DateRangePopover (DatePicker had a copy). Dressed by date-range.css (odc-dr-*).

const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6]

/**
 * The month grid shared by DatePicker (one day: `from`) and DateRangePopover (`from` / `to`, with the range band):
 * previous / next / today, and buttons for the days with the grid keyboard (arrows, Home / End, PageUp / PageDown).
 * A day for which `isDisabled(day)` is true (optional) is `aria-disabled` and `data-disabled`: focusable, never picked.
 * With `min` / `max` the month buttons stay focusable and `aria-disabled` at the limit.
 * `today` (optional, `YYYY-MM-DD`, what `todayDay()` returns) is the day marked as today and the target of «Go to today»;
 * without it, the browser's day. redesign (row 71, Q-09): the BI reports pass the day of the zone of the report.
 */
export const DayCalendar = ({ month, onMonthChange, from, to, onPick, isDisabled, min, max, locale, firstDayOfWeek, labels, dir, today: todayProp }) => {
  const gridRef = useRef(null)
  const pendingFocus = useRef(null)
  const titleId = useId()
  const [focusDay, setFocusDay] = useState(null)
  const today = todayProp || todayDay()
  const labelers = React.useMemo(() => makeDayLabelers(locale), [locale])
  const weeks = buildMonth(month, firstDayOfWeek)
  const inMonth = (day) => day && monthOf(day) === month
  // redesign tramo B r2 (W0-QB1-11): the one tab stop is where the user was, the chosen day, today if it can be chosen,
  // else the first day that can; never a day that cannot be chosen when another exists (min / max opened on the 1st).
  const enabled = (day) => inMonth(day) && !isDisabled?.(day)
  const firstEnabled = weeks.flat().find(day => day && enabled(day))
  const tabDay = [focusDay, from].find(inMonth) || (enabled(today) ? today : null) || firstEnabled || month
  const previousBlocked = !!min && shiftDay(month, -1) < min
  const nextBlocked = !!max && shiftDay(month, 1, 'month') > max

  useEffect(() => {
    if (!pendingFocus.current) return
    const target = gridRef.current?.querySelector(`[data-day="${pendingFocus.current}"]`)
    pendingFocus.current = null
    target?.focus()
  })

  const moveTo = (day) => {
    pendingFocus.current = day
    setFocusDay(day)
    onMonthChange(monthOf(day))
  }

  const handleKeyDown = (event, day) => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
    const weekStart = shiftDay(day, -((new Date(day + 'T12:00:00').getDay() - firstDayOfWeek + 7) % 7))
    const moves = {
      [forward]: () => shiftDay(day, 1),
      [backward]: () => shiftDay(day, -1),
      ArrowDown: () => shiftDay(day, 7),
      ArrowUp: () => shiftDay(day, -7),
      Home: () => weekStart,
      End: () => shiftDay(weekStart, 6),
      PageDown: () => shiftDay(day, event.shiftKey ? 12 : 1, 'month'),
      PageUp: () => shiftDay(day, event.shiftKey ? -12 : -1, 'month')
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    moveTo(move())
  }

  return (
    <div className='odc-dr-cal'>
      <div className='odc-dr-cal-head'>
        <IconButton
          icon={ChevronLeft}
          flipInRtl
          label={labels.previousMonth}
          size='sm'
          focusableWhenDisabled
          disabled={previousBlocked}
          onClick={() => !previousBlocked && onMonthChange(shiftDay(month, -1, 'month'))}
        />
        <div id={titleId} className='odc-dr-cal-title' aria-live='polite'>{labelers.month(month)}</div>
        <IconButton
          icon={ChevronRight}
          flipInRtl
          label={labels.nextMonth}
          size='sm'
          focusableWhenDisabled
          disabled={nextBlocked}
          onClick={() => !nextBlocked && onMonthChange(shiftDay(month, 1, 'month'))}
        />
        <Button size='sm' variant='ghost' aria-label={labels.goToToday} onClick={() => moveTo(today)}>{labels.today}</Button>
      </div>
      <table ref={gridRef} role='grid' aria-labelledby={titleId} className='odc-dr-grid'>
        <thead>
          <tr>
            {WEEK_DAYS.map(index => {
              const dayIndex = (index + firstDayOfWeek) % 7
              return (
                <th key={dayIndex} scope='col' abbr={labelers.weekdayLong(dayIndex)} className='odc-dr-weekday'>
                  {labelers.weekday(dayIndex)}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, index) => (
            <tr key={index}>
              {week.map((day, cell) => {
                if (!day) return <td key={cell} className='odc-dr-cell' role='presentation' />
                const isStart = day === from
                const isEnd = day === to
                const inRange = from && to && day > from && day < to
                const disabled = !!isDisabled?.(day)
                return (
                  <td
                    key={day}
                    role='gridcell'
                    className='odc-dr-cell'
                    aria-selected={isStart || isEnd || !!inRange}
                    data-range={inRange ? '' : undefined}
                    data-edge={isStart && to && !isEnd ? 'start' : isEnd && from && !isStart ? 'end' : undefined}
                  >
                    <button
                      type='button'
                      className='odc-dr-day'
                      data-day={day}
                      data-edge-day={isStart || isEnd ? '' : undefined}
                      data-today={day === today ? '' : undefined}
                      data-disabled={disabled ? '' : undefined}
                      tabIndex={day === tabDay ? 0 : -1}
                      aria-label={labelers.full(day)}
                      aria-current={day === today ? 'date' : undefined}
                      aria-disabled={disabled ? 'true' : undefined}
                      onClick={() => !disabled && onPick(day)}
                      onKeyDown={event => handleKeyDown(event, day)}
                    >
                      {Number(day.slice(8))}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
