import React, { useMemo } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { formatVisibleDay } from '../../../../../utils/dateRange'
import { Plus, Users } from '../../Shared/Icon'
import { Avatar, Button, EmptyState, Skeleton } from '../../Shared/Product'
import { blocksOnDay, daysOf, formatClock, rangeLength, timeOf } from './blockData'
import './schedule-agenda.css'

// redesign DT-B3 (DT-06, DT-08, DT-09, DT-18, DT-24 | decisions 1–7): the phone agenda of /delivery/drivers-time-display (under 768px).
// A card per driver (avatar, name, #id, email) and under it a row for every day of the range (a range of one day is a single row
// with no day heading): the visible date, its blocks as buttons with hours and break, and «Add block» (not on a day before today).
// A day with none says «No blocks». Nothing scrolls sideways: the rows stack and the text wraps. The data is the grid's.
//
// Props (the same contract as ScheduleGrid):
//   users            the page's drivers: { id, name, lastname, email, photo, delivery_blocks[] } (blocks already in local time)
//   loading          skeleton cards; the old cards are hidden (they belong to another range)
//   range            { from, to } of local days (`YYYY-MM-DD`)
//   today            the local day of today (`YYYY-MM-DD`)
//   is12             12-hour clock
//   onOpenBlock(user, block, day)         a block was pressed
//   onAddBlock(user, day, null)           «Add block» of a day (the agenda has no hour to pass)
//   onShowDay                             not used here: every block of a day is listed

const SKELETON_CARDS = 4

const fullName = (user) => [user?.name, user?.lastname].filter(Boolean).join(' ')

// «Add block for _name_ on _date_» → text; one pass, so a name that holds «_date_» stays as it is
const fill = (template, values) => template.replace(/_([a-z]+)_/g, (match, key) => (key in values ? String(values[key]) : match))
// The same, with nodes in place of a name («break _time_» keeps its hours as a figure, decision 11)
const fillNodes = (template, values) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const key = part.match(/^_([a-z]+)_$/)?.[1]
  return key && key in values ? <React.Fragment key={index}>{values[key]}</React.Fragment> : part
})

export const ScheduleAgenda = ({ users, loading = false, range, today, is12 = false, onOpenBlock, onAddBlock }) => {
  const [, t] = useLanguage()
  const [{ parseDate } = {}] = useUtils() || []
  const list = Array.isArray(users) ? users : []
  const days = useMemo(() => daysOf(range), [range?.from, range?.to])
  const several = rangeLength(range) > 1

  const clock = (hhmm) => formatClock(hhmm, { is12, am: t('AM', 'AM'), pm: t('PM', 'PM') })
  const shownDay = (day) => (parseDate ? formatVisibleDay(day, parseDate) : day)
  const timeRange = (start, end) => `${clock(timeOf(start))} – ${clock(timeOf(end))}`
  const isPast = (day) => Boolean(today) && day < today
  // «09:00 – 17:00, break 13:00 – 13:30, Carlos Mendoza»; a block with a name starts with it, so its visible text is in its name
  const blockLabel = (user, block, hasBreak) => {
    const when = hasBreak
      ? `${timeRange(block.start, block.end)}, ${fill(t('DRIVER_BLOCKS_BREAK_LABEL', 'break _time_'), { time: timeRange(block.break_start, block.break_end) })}`
      : timeRange(block.start, block.end)
    const label = fill(t('DRIVER_BLOCKS_BLOCK_LABEL', '_time_, _name_'), { time: when, name: fullName(user) })
    return block.name ? `${block.name}, ${label}` : label
  }

  if (!loading && list.length === 0) {
    return <EmptyState icon={Users} title={t('DRIVER_BLOCKS_NO_DRIVERS', 'No drivers found')} />
  }

  const renderBlock = (user, block, day, index) => {
    const hasBreak = Boolean(block.break_start && block.break_end)
    const label = blockLabel(user, block, hasBreak)
    return (
      <li key={`${block.id}-${block.start}-${index}`}>
        <button type='button' className='odc-sa-block' aria-label={label} title={label} onClick={() => onOpenBlock?.(user, block, day)}>
          <span className='odc-sa-block-main'>
            {block.name && <><span className='odc-sa-block-name' dir='auto'>{block.name}</span><span aria-hidden='true'> · </span></>}
            <span className='odc-figure'>{timeRange(block.start, block.end)}</span>
          </span>
          {hasBreak && (
            <span className='odc-sa-break'>
              {fillNodes(t('DRIVER_BLOCKS_BREAK_LABEL', 'break _time_'), { time: <span className='odc-figure'>{timeRange(block.break_start, block.break_end)}</span> })}
            </span>
          )}
        </button>
      </li>
    )
  }

  const renderDay = (user, day) => {
    const blocks = blocksOnDay(user?.delivery_blocks, day)
    return (
      <li key={day} className='odc-sa-day' data-day={day} aria-current={day === today ? 'date' : undefined}>
        {several && <time className='odc-sa-date' dateTime={day}>{shownDay(day)}</time>}
        <div className='odc-sa-body'>
          {blocks.length > 0
            ? <ul className='odc-sa-blocks'>{blocks.map((block, index) => renderBlock(user, block, day, index))}</ul>
            : <p className='odc-sa-none'>{t('DRIVER_BLOCKS_NONE', 'No shifts')}</p>}
          {!isPast(day) && (
            <Button
              className='odc-sa-add'
              size='sm'
              icon={Plus}
              aria-label={fill(t('DRIVER_BLOCKS_ADD_ON', 'Add shift for _name_ on _date_'), { name: fullName(user), date: shownDay(day) })}
              onClick={() => onAddBlock?.(user, day, null)}
            >
              {t('DRIVER_BLOCKS_ADD_BLOCK', 'Add shift')}
            </Button>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className='odc-root odc-sa' aria-busy={loading || undefined}>
      {loading && <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>}
      <ul className='odc-sa-list' aria-label={t('DRIVERS_TIME_DISPLAY', 'Drivers time display')}>
        {loading
          ? Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <li key={index} className='odc-sa-card' data-skeleton='' aria-hidden='true'>
              <div className='odc-sa-person'>
                <Skeleton shape='round' size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' />
                <div className='odc-sa-ident'>
                  <Skeleton size='60%' />
                  <Skeleton size='40%' />
                </div>
              </div>
              <Skeleton size='100%' block='var(--od-x-control-height)' />
            </li>
          ))
          : list.map((user, index) => {
            const name = fullName(user)
            return (
              <li key={user?.id ?? index} className='odc-sa-card' data-user-id={user?.id}>
                <div className='odc-sa-person'>
                  <Avatar size='lg' name={name} src={user?.photo} />
                  <div className='odc-sa-ident'>
                    <strong className='odc-sa-name' dir='auto'>{name}</strong>
                    <span className='odc-sa-sub'>
                      <bdi dir='ltr' className='odc-figure'>{`#${user?.id}`}</bdi>
                      {user?.email && (
                        <>
                          <span aria-hidden='true'>·</span>
                          <bdi dir='ltr' className='odc-sa-email'>{user.email}</bdi>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <ul className='odc-sa-days'>{days.map(day => renderDay(user, day))}</ul>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
