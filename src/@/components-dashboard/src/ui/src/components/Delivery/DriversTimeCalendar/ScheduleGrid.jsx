import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { formatVisibleDay, makeDayLabelers } from '../../../../../utils/dateRange'
import { Plus, Users } from '../../Shared/Icon'
import { Avatar, EmptyState, Skeleton } from '../../Shared/Product'
import { blockSpan, blocksOnDay, daysOf, firstHour, formatClock, rangeLength, timeOf } from './blockData'
import './schedule-grid.css'

// redesign DT-B3 (DT-06, DT-07, DT-08, DT-09, DT-18, DT-24 | decisions 1–7): the desktop grid of /delivery/drivers-time-display.
// One table in a frame that scrolls sideways on its own, with the driver column fixed at the start edge (DT-06).
//   · A day (`rangeLength === 1`): 24 hour columns; each driver is a lane whose blocks sit at their minutes (`blockSpan`), the break
//     striped inside the block, and every free hour is a button that adds a block at that hour. The frame opens an hour before the
//     first block of the day (DT-07).
//   · Several days: a column per day; a cell lists up to 2 blocks, «+N more» (the whole day) and an add button.
// Blocks and add targets are native buttons with a name (DT-08). Blocks are found by full date (DT-09), a day before today offers
// no add (DT-18) and a driver with no `delivery_blocks`, or 30 blocks in a day, is nothing special (DT-24).
//
// Props (the contract the page, DT-B5, passes to this and to ScheduleAgenda):
//   users            the page's drivers: { id, name, lastname, email, photo, delivery_blocks[] } (blocks already in local time)
//   loading          skeleton rows; the old rows are hidden (they belong to another range)
//   range            { from, to } of local days (`YYYY-MM-DD`)
//   today            the local day of today (`YYYY-MM-DD`)
//   is12             12-hour clock
//   onOpenBlock(user, block, day)         a block was pressed
//   onAddBlock(user, day, startTime|null) «add»: `startTime` is the pressed hour (`HH:00`) in the day view, `null` in the others
//   onShowDay(user, day, blocks)          «+N more»: the whole list of that driver's day

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const MAX_PER_CELL = 2
const SKELETON_ROWS = 6
const NO_STOPS = {}
// A block shorter than this still has something to press
const MIN_BLOCK_MINUTES = 15

const pad = (value) => String(value).padStart(2, '0')
const hourText = (hour) => `${pad(hour)}:00`
// Hours as a plain factor for `calc(var(--dt-hour) * …)`: 7.5, never a length
const hoursOf = (minutes) => Number((minutes / 60).toFixed(4))
const fullName = (user) => [user?.name, user?.lastname].filter(Boolean).join(' ')

// «Add block for _name_ at _time_» → text; one pass, so a name that holds «_time_» stays as it is
const fill = (template, values) => template.replace(/_([a-z]+)_/g, (match, key) => (key in values ? String(values[key]) : match))
// The same, with nodes in place of a name (the count of «+_count_ more» is a figure, decision 11)
const fillNodes = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const key = part.match(/^_([a-z]+)_$/)?.[1]
  return key && key in values ? <React.Fragment key={index}>{values[key]}</React.Fragment> : part
})

// What both the lanes and the cells say: hours, dates and the accessible name of a block
const useScheduleText = (is12) => {
  const [languageState, t] = useLanguage()
  const [{ parseDate } = {}] = useUtils() || []
  const locale = languageState?.language?.code
  const labelers = useMemo(() => makeDayLabelers(locale), [locale])
  const clock = (hhmm) => formatClock(hhmm, { is12, am: t('AM', 'AM'), pm: t('PM', 'PM') })
  const shownDay = (day) => (parseDate ? formatVisibleDay(day, parseDate) : day)
  const timeRange = (start, end) => `${clock(timeOf(start))} – ${clock(timeOf(end))}`
  // «09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza»; a block with a name starts with it, so its visible text is in its name
  const blockLabel = (user, block) => {
    const hasBreak = Boolean(block.break_start && block.break_end)
    const when = hasBreak
      ? `${timeRange(block.start, block.end)}, ${fill(t('DRIVER_BLOCKS_BREAK_LABEL', 'break _time_'), { time: timeRange(block.break_start, block.break_end) })}`
      : timeRange(block.start, block.end)
    const label = fill(t('DRIVER_BLOCKS_BLOCK_LABEL', '_time_, _name_'), { time: when, name: fullName(user) })
    return block.name ? `${block.name}, ${label}` : label
  }
  const weekdayOf = (day) => {
    const [year, month, date] = day.split('-').map(Number)
    return labelers.weekday(new Date(year, month - 1, date).getDay())
  }
  return { t, clock, shownDay, timeRange, blockLabel, weekdayOf }
}

// The driver column: avatar, full name, then «#id · email» with the email clipped (its whole text in `title`)
const DriverCell = ({ user }) => {
  const name = fullName(user)
  return (
    <th scope='row' className='odc-sg-who'>
      <span className='odc-sg-person'>
        <Avatar name={name} src={user?.photo} />
        <span className='odc-sg-ident'>
          <strong className='odc-sg-name' dir='auto' title={name}>{name}</strong>
          <span className='odc-sg-sub'>
            <bdi dir='ltr' className='odc-figure'>{`#${user?.id}`}</bdi>
            {user?.email && (
              <>
                <span aria-hidden='true'>·</span>
                <bdi dir='ltr' className='odc-sg-email' title={user.email}>{user.email}</bdi>
              </>
            )}
          </span>
        </span>
      </span>
    </th>
  )
}

const SkeletonDriverCell = () => (
  <th scope='row' className='odc-sg-who'>
    <span className='odc-sg-person'>
      <Skeleton shape='round' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
      <span className='odc-sg-ident'>
        <Skeleton size='70%' />
        <Skeleton size='40%' />
      </span>
    </span>
  </th>
)

// ---------------------------------------------------------------- a day: the lane of a driver

const BlockInLane = ({ user, block, day, text, stop, tabKey, onOpenBlock }) => {
  const span = blockSpan(block, day)
  const length = Math.max(span.end - span.start, MIN_BLOCK_MINUTES)
  const hasBreak = span.breakStart !== null && span.breakEnd !== null && span.breakEnd > span.breakStart
  const label = text.blockLabel(user, block)
  return (
    <button
      type='button'
      className='odc-sg-block'
      style={{ '--dt-from': hoursOf(span.start), '--dt-span': hoursOf(length) }}
      aria-label={label}
      title={label}
      {...stopProps(stop, tabKey)}
      onClick={() => onOpenBlock?.(user, block, day)}
    >
      {hasBreak && (
        <span
          className='odc-sg-break'
          aria-hidden='true'
          style={{ '--dt-from': hoursOf(Math.max(span.breakStart - span.start, 0)), '--dt-span': hoursOf(span.breakEnd - span.breakStart) }}
        />
      )}
      <span className='odc-sg-block-text'>
        {block.name && <><span className='odc-sg-block-name' dir='auto'>{block.name}</span><span aria-hidden='true'> · </span></>}
        <span className='odc-figure'>{text.timeRange(block.start, block.end)}</span>
      </span>
    </button>
  )
}

// What a lane holds, in the order of the day: the blocks and the free hours (R-04). The DOM follows it, though a block is placed
// by its minutes and not by its place in the markup. An hour under a block has no add button: it would sit hidden under it, and be
// reachable by keyboard only.
const laneStops = (user, day, past, startHour) => {
  const blocks = blocksOnDay(user?.delivery_blocks, day)
  const spans = blocks.map(block => blockSpan(block, day))
  const free = past ? [] : HOURS.filter(hour => !spans.some(span => span.start < (hour + 1) * 60 && span.end > hour * 60))
  const stops = [
    ...free.map(hour => ({ kind: 'slot', key: `slot-${hour}`, at: hour * 60, hour })),
    ...blocks.map((block, index) => ({ kind: 'block', key: `block-${index}`, at: spans[index].start, block }))
  ].sort((a, b) => a.at - b.at || (a.kind === b.kind ? 0 : a.kind === 'block' ? -1 : 1))
  // The first block; with none, the free hour the day opens on (or the nearest one after it)
  const first = stops.find(stop => stop.kind === 'block') ?? stops.find(stop => stop.hour >= startHour) ?? stops[stops.length - 1]
  return { stops, first }
}

const Lane = ({ user, day, lane, tabKey, text, onOpenBlock, onAddBlock }) => (
  <td colSpan={HOURS.length} className='odc-sg-lane'>
    <div className='odc-sg-track'>
      {lane.stops.map(stop => (stop.kind === 'slot'
        ? (
          <button
            key={stop.key}
            type='button'
            className='odc-sg-slot'
            style={{ '--dt-from': stop.hour }}
            aria-label={fill(text.t('DRIVER_BLOCKS_ADD_AT', 'Add shift for _name_ at _time_'), { name: fullName(user), time: text.clock(hourText(stop.hour)) })}
            {...stopProps(stop, tabKey)}
            onClick={() => onAddBlock?.(user, day, hourText(stop.hour))}
          >
            <Plus className='odc-icon' />
          </button>
          )
        : <BlockInLane key={stop.key} user={user} block={stop.block} day={day} text={text} stop={stop} tabKey={tabKey} onOpenBlock={onOpenBlock} />
      ))}
    </div>
  </td>
)

// ---------------------------------------------------------------- several days: the cell of a driver and a day

// What a cell holds, in the order of the cell: its blocks, «+N more», add (R-04). `at` is the place of the day in the range.
const cellStops = (user, day, dayIndex, past) => {
  const blocks = blocksOnDay(user?.delivery_blocks, day)
  const shown = blocks.slice(0, MAX_PER_CELL)
  const extra = blocks.length - shown.length
  const stops = [
    ...shown.map((block, index) => ({ kind: 'block', key: `block-${day}-${index}`, at: dayIndex, block })),
    ...(extra > 0 ? [{ kind: 'more', key: `more-${day}`, at: dayIndex }] : []),
    ...(past ? [] : [{ kind: 'add', key: `add-${day}`, at: dayIndex }])
  ]
  return { day, past, blocks, shown, extra, stops }
}

const Cell = ({ user, cell, today, tabKey, text, onOpenBlock, onAddBlock, onShowDay }) => {
  const { day, blocks, shown, extra, past, stops } = cell
  const stopOf = (kind, index = 0) => stops.filter(stop => stop.kind === kind)[index]
  return (
    <td className='odc-sg-cell' data-day={day} data-today={day === today ? '' : undefined}>
      <div className='odc-sg-cell-body'>
        {shown.length > 0 && (
          <ul className='odc-sg-chips'>
            {shown.map((block, index) => {
              const label = text.blockLabel(user, block)
              const hasBreak = Boolean(block.break_start && block.break_end)
              return (
                <li key={`${block.id}-${block.start}-${index}`}>
                  <button
                    type='button'
                    className='odc-sg-chip'
                    aria-label={label}
                    title={label}
                    {...stopProps(stopOf('block', index), tabKey)}
                    onClick={() => onOpenBlock?.(user, block, day)}
                  >
                    <span className='odc-figure'>{text.timeRange(block.start, block.end)}</span>
                    {hasBreak && (
                      <span className='odc-sg-chip-break'>
                        {fillNodes(text.t('DRIVER_BLOCKS_BREAK_LABEL', 'break _time_'), { time: <span className='odc-figure'>{text.timeRange(block.break_start, block.break_end)}</span> })}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {extra > 0 && (
          <button type='button' className='odc-sg-more' {...stopProps(stopOf('more'), tabKey)} onClick={() => onShowDay?.(user, day, blocks)}>
            {fillNodes(text.t('DRIVER_BLOCKS_MORE', '+_count_ more'), { count: <span className='odc-figure'>{extra}</span> })}
          </button>
        )}
        {!past && (
          <button
            type='button'
            className='odc-sg-add'
            aria-label={fill(text.t('DRIVER_BLOCKS_ADD_ON', 'Add shift for _name_ on _date_'), { name: fullName(user), date: text.shownDay(day) })}
            {...stopProps(stopOf('add'), tabKey)}
            onClick={() => onAddBlock?.(user, day, null)}
          >
            <Plus className='odc-icon' />
          </button>
        )}
      </div>
    </td>
  )
}

// ---------------------------------------------------------------- the keyboard of a row (R-04)
// One tab stop per row (a roving tabindex), as a grid does, with the semantic table and the native buttons kept: Tab goes row to
// row, the arrows go along the row (inverted right to left), Home/End to its ends, Up/Down to the nearest button in time (a day) or
// in days (several days) of the row above or below.

const stopProps = (stop, tabKey) => ({
  'data-nav': stop.key,
  'data-at': stop.at,
  'data-kind': stop.kind,
  tabIndex: stop.key === tabKey ? 0 : -1
})

const NAV_BUTTONS = 'button[data-nav]'

// Focuses a button of the grid without the browser taking the frame to its start: the nearest edge is enough
const focusStop = (button) => {
  button.focus({ preventScroll: true })
  button.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
}

// The button of `row` nearest to `from` in time or day; at the same distance, one of the same kind, then the earlier
const nearestIn = (row, from) => {
  const at = Number(from.dataset.at)
  const buttons = Array.from(row.querySelectorAll(NAV_BUTTONS))
  let best = null
  let bestScore = null
  buttons.forEach(button => {
    const score = [Math.abs(Number(button.dataset.at) - at), button.dataset.kind === from.dataset.kind ? 0 : 1]
    if (!bestScore || score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) {
      best = button
      bestScore = score
    }
  })
  return best
}

const onRowKeyDown = (event) => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  const current = event.target
  if (!current?.matches?.(NAV_BUTTONS)) return
  const row = event.currentTarget
  const buttons = Array.from(row.querySelectorAll(NAV_BUTTONS))
  const index = buttons.indexOf(current)
  if (index < 0) return
  const rtl = typeof getComputedStyle === 'function' && getComputedStyle(row).direction === 'rtl'
  let next
  switch (event.key) {
    case 'ArrowRight': next = buttons[index + (rtl ? -1 : 1)]; break
    case 'ArrowLeft': next = buttons[index + (rtl ? 1 : -1)]; break
    case 'Home': next = buttons[0]; break
    case 'End': next = buttons[buttons.length - 1]; break
    case 'ArrowDown':
    case 'ArrowUp': {
      // The next row that has buttons (a past day with no blocks has none)
      let sibling = event.key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling
      while (sibling && !sibling.querySelector(NAV_BUTTONS)) {
        sibling = event.key === 'ArrowDown' ? sibling.nextElementSibling : sibling.previousElementSibling
      }
      if (sibling) next = nearestIn(sibling, current)
      break
    }
    default: return
  }
  event.preventDefault()
  if (next) focusStop(next)
}

// ---------------------------------------------------------------- the grid

export const ScheduleGrid = ({ users, loading = false, range, today, is12 = false, onOpenBlock, onAddBlock, onShowDay }) => {
  const text = useScheduleText(is12)
  const { t } = text
  const list = Array.isArray(users) ? users : []
  const days = useMemo(() => daysOf(range), [range?.from, range?.to])
  const isDay = rangeLength(range) === 1
  const day = range?.from
  const isPast = (value) => Boolean(today) && value < today

  // DT-07: the day view opens an hour before the first block of the day, on mount and when the day changes. While the data is
  // loading there is nothing to open on, so it waits and goes to the hours of what came; a reload of the same day (after adding a
  // block) never takes the person back. `scrolledDay` is the last day it opened on, `settledDay` the last whose data arrived.
  // redesign DT-B5 (live check): the page mounts before its first load (no rows, no frame), so «the day it opened on» is only written
  // once the rows of that day are on screen: `loadedDay` is the day whose load finished (or the day of rows given at mount).
  const scrollerRef = useRef(null)
  const scrolledDay = useRef(null)
  const loadedDay = useRef(!loading && list.length > 0 ? day : null)
  const wasLoading = useRef(loading)
  const startHour = firstHour(list, day)
  useLayoutEffect(() => {
    if (wasLoading.current && !loading) loadedDay.current = day
    wasLoading.current = loading
    if (!isDay || loading || list.length === 0 || !scrollerRef.current) return
    if (loadedDay.current === day && scrolledDay.current !== day) {
      scrollToHour(scrollerRef.current, startHour)
      scrolledDay.current = day
    }
  }, [isDay, day, loading, startHour, list.length])

  // R-05: a range of several days opens on its first day. The frame is the one the day view scrolled to its first hour, and it keeps
  // its scroll when the table changes under it, so it goes back to the start (0 is the start edge in both directions). Leaving the
  // day view also forgets where it opened, so coming back to the same day opens on its first hour again.
  useLayoutEffect(() => {
    if (isDay) return
    scrolledDay.current = null
    if (scrollerRef.current) scrollerRef.current.scrollLeft = 0
  }, [isDay, range?.from, range?.to])

  // R-04: the tab stop of each row (its key), forgotten when the range changes: the row starts again on its first button
  const scope = `${range?.from}|${range?.to}`
  const [stops, setStops] = useState({ scope, byRow: {} })
  const stopOfRow = stops.scope === scope ? stops.byRow : NO_STOPS
  const rememberStop = (rowId, key) => setStops(previous => {
    const byRow = previous.scope === scope ? previous.byRow : {}
    return previous.scope === scope && byRow[rowId] === key ? previous : { scope, byRow: { ...byRow, [rowId]: key } }
  })

  if (!loading && list.length === 0) {
    return <EmptyState icon={Users} title={t('DRIVER_BLOCKS_NO_DRIVERS', 'No drivers found')} />
  }

  return (
    <div className='odc-root odc-sg' data-mode={isDay ? 'day' : 'days'} aria-busy={loading || undefined}>
      {loading && <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>}
      <div className='odc-sg-scroller' ref={scrollerRef}>
        <table className='odc-sg-table' aria-label={t('DRIVERS_TIME_DISPLAY', 'Drivers time display')} style={isDay ? undefined : { '--dt-days': days.length }}>
          <thead>
            <tr>
              <th scope='col' className='odc-sg-corner'>{t('DRIVER', 'Driver')}</th>
              {isDay
                ? HOURS.map(hour => (
                  <th key={hour} scope='col' className='odc-sg-hour' data-hour={hour}>
                    <span className='odc-figure'>{text.clock(hourText(hour))}</span>
                  </th>
                ))
                : days.map(value => (
                  <th
                    key={value}
                    scope='col'
                    className='odc-sg-day'
                    data-day={value}
                    aria-current={value === today ? 'date' : undefined}
                    title={text.shownDay(value)}
                  >
                    <span className='odc-sg-dow'>{text.weekdayOf(value)}</span>
                    <span className='odc-sg-dom odc-figure'>{Number(value.slice(8, 10))}</span>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <tr key={row} data-skeleton='' aria-hidden='true'>
                  <SkeletonDriverCell />
                  {isDay
                    ? <td colSpan={HOURS.length} className='odc-sg-lane'><div className='odc-sg-track'><Skeleton size='30%' block='var(--od-x-control-height)' /></div></td>
                    : days.map(value => (
                      <td key={value} className='odc-sg-cell'><Skeleton size='70%' block='var(--od-x-control-height)' /></td>
                    ))}
                </tr>
              ))
              : list.map((user, index) => {
                const rowId = user?.id ?? index
                // The row's buttons in order, and the one that is its tab stop: where the person left it, or the first
                const lane = isDay ? laneStops(user, day, isPast(day), startHour) : null
                const cells = isDay ? null : days.map((value, dayIndex) => cellStops(user, value, dayIndex, isPast(value)))
                const all = isDay ? lane.stops : cells.flatMap(cell => cell.stops)
                const first = isDay ? lane.first : (cells.find(cell => !cell.past && cell.stops.length > 0)?.stops[0] ?? all[0])
                const remembered = stopOfRow[rowId]
                const tabKey = all.some(stop => stop.key === remembered) ? remembered : first?.key
                return (
                  <tr
                    key={rowId}
                    data-user-id={user?.id}
                    onKeyDown={onRowKeyDown}
                    onFocus={(event) => {
                      const key = event.target?.dataset?.nav
                      if (key) rememberStop(rowId, key)
                    }}
                  >
                    <DriverCell user={user} />
                    {isDay
                      ? <Lane user={user} day={day} lane={lane} tabKey={tabKey} text={text} onOpenBlock={onOpenBlock} onAddBlock={onAddBlock} />
                      : cells.map(cell => (
                        <Cell
                          key={cell.day}
                          user={user}
                          cell={cell}
                          today={today}
                          tabKey={tabKey}
                          text={text}
                          onOpenBlock={onOpenBlock}
                          onAddBlock={onAddBlock}
                          onShowDay={onShowDay}
                        />
                      ))}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Brings the column of `hour` to the edge of the fixed driver column. It goes to the start (scrollLeft 0) first and measures from
// there, so the answer does not depend on where the frame was. Right to left the start edge is on the right and scrollLeft runs
// negative, so the same distance is taken from the right edges and comes out negative; either way it is a physical scrollLeft.
function scrollToHour (scroller, hour) {
  if (!scroller) return
  const cell = scroller.querySelector(`th[data-hour="${hour}"]`)
  const corner = scroller.querySelector('.odc-sg-corner')
  if (!cell || !corner) return
  scroller.scrollLeft = 0
  const frame = scroller.getBoundingClientRect()
  const column = cell.getBoundingClientRect()
  const fixed = corner.getBoundingClientRect().width
  const rtl = typeof getComputedStyle === 'function' && getComputedStyle(scroller).direction === 'rtl'
  scroller.scrollLeft = rtl ? column.right - (frame.right - fixed) : column.left - (frame.left + fixed)
}
