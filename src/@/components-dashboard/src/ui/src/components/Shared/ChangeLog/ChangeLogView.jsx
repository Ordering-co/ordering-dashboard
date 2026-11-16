import React, { useEffect, useRef, useState } from 'react'

import { useLanguage, useUtils, useConfig } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { parseLogData, safeJsonParse } from '../../../../../utils/safeJsonParse'
import { getAttributeName } from '../../../utils'
import { summarizeUserAgent } from './summarizeUserAgent'
import { History, TriangleAlert } from '../Icon'
import { ActivityTimeline, Button, DataTable, Dialog, EmptyState, InlineNotice, Pagination, RecordCardList } from '../Product'
import { useIsPhone } from '../Product/useIsPhone'
import './change-log.css'

// redesign settings-logs: promoted from Stores/BusinessLogs (5.16 ; 7.1 R-06), never copied.
// A log of changes on Product, the same for the logs of a store and the logs of the project's settings:
// - Table (P/DataTable, from 768px): Date (the row header), User (name and email), Event, the consumer's `subjectColumn` if any
//   (Settings: the setting), Changes (one line per change, «Featured: false → true») and User agent (wraps; «-» when none).
//   A `schedule` change has no value to print: it is a «See changes» button that opens the schedule dialog.
//   ST8: the user agent reads short («Chrome 155 · macOS»); the whole string is the cell's `title` and the detail's
//   «Technical details» (a tap on a card, or Enter on a row, opens it: a title alone is not enough for the keyboard or the phone).
//   Under 768px the same logs are P/RecordCard cards (title, person and date, a short summary of the changes).
// - A row, or a card, opens the log in a dialog titled with its date: a P/ActivityTimeline with one item (the event, every change,
//   who did it) and the user agent folded in «Technical details» (plus the consumer's `detailTechnical`), then `detailFoot`.
// - G2-33: an API error is said (an alert with the API message and «Try again»), never drawn as an empty list. No logs and no error is
//   the empty state. The foot is P/Pagination at a fixed size of 10; its own clamp asks for the last page when the page is past the end.
// A value is always text: null / undefined / '' is «None», objects and arrays are JSON (never «[object Object]»).
// The texts of the consumer (title, empty state, failure) come translated in props; the rest are this view's own.

const PAGE_SIZE = 10
const SKELETON_ROWS = PAGE_SIZE
const SUMMARY_LINES = 3 // changes a card shows before «+N»

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11) and keep their direction in RTL
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

/** «order_status_changed» -> «Order status changed»: an event or an attribute the dashboard has no word for reads as words. */
export const humanize = (key) => {
  const words = String(key ?? '').replace(/[_-]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/** The log's stamp, as the machine value of a <time>: «2026-10-09 21:55:08» -> «2026-10-09T21:55:08». */
const stampToIso = (stamp) => (stamp ? String(stamp).trim().replace(' ', 'T') : undefined)

/** The changes of a log that the screen shows (the data may be a list, an object or a JSON string; schedule_ranges is skipped, as before). */
export const changesOf = (log) => {
  const data = parseLogData(log?.data)
  const list = Array.isArray(data) ? data : (data && typeof data === 'object' ? Object.values(data) : [])
  return list.filter(item => item && typeof item === 'object' && item.attribute !== 'schedule_ranges')
}

const stringify = (value) => {
  try {
    return JSON.stringify(value)
  } catch (error) {
    return undefined
  }
}

/** A value as text: nothing is «None», objects and arrays are JSON, the rest is what String() says. */
export const formatValue = (value, t) => {
  if (value == null || value === '') return t('NONE', 'None')
  if (typeof value === 'object') return stringify(value) ?? t('NONE', 'None')
  return String(value)
}

/** One side of a change. A list change (`added` / `removed`) has no `new` / `old`: its items are joined. */
export const sideOf = (item, side, t) => {
  const direct = item?.[side]
  if (direct != null) return formatValue(direct, t)
  const list = side === 'new' ? item?.added : item?.removed
  if (Array.isArray(list)) return list.length > 0 ? list.map(entry => formatValue(entry, t)).join(', ') : t('NONE', 'None')
  return formatValue(list, t)
}

/** The hour of a schedule lapse in the project's `general_hour_format` (the tokens it uses: HH H hh h mm m A a). */
const formatClock = (time, format) => {
  if (time == null || typeof time !== 'object') return '-'
  const hour = Number(time.hour) || 0
  const minute = Number(time.minute) || 0
  const pad = (value) => String(value).padStart(2, '0')
  const twelve = hour % 12 || 12
  const parts = {
    HH: pad(hour),
    H: String(hour),
    hh: pad(twelve),
    h: String(twelve),
    mm: pad(minute),
    m: String(minute),
    A: hour < 12 ? 'AM' : 'PM',
    a: hour < 12 ? 'am' : 'pm'
  }
  return String(format || 'HH:mm').replace(/HH|H|hh|h|mm|m|A|a/g, token => parts[token])
}

/** A schedule as the log carries it (a list, or a JSON string of one). null: the log has no such side. */
const toSchedule = (value) => {
  if (value == null) return null
  const parsed = typeof value === 'string' ? safeJsonParse(value, []) : value
  return Array.isArray(parsed) ? parsed : []
}

/**
 * The lines of the changes: «Name: old → new», or the name and a «See changes» button for a schedule change.
 * `clamp`: the table and the cards cut a long value after three lines (the detail shows it whole); `limit` shows that many lines and «+N».
 * Without `onSeeSchedule` (the cards) a schedule change is its name alone: the card opens the detail, which has the button.
 */
const ChangeLines = ({ changes, clamp, limit, onSeeSchedule, seeLabel, emptyLabel }) => {
  if (changes.length === 0) return <span className='odc-cl-muted'>{emptyLabel}</span>
  const shown = limit != null ? changes.slice(0, limit) : changes
  const hidden = changes.length - shown.length
  return (
    <ul className='odc-cl-changes' data-clamp={clamp ? '' : undefined}>
      {shown.map((change, index) => (
        change.schedule
          ? (
            <li key={index} className='odc-cl-change' data-kind='schedule'>
              <span className='odc-cl-change-text' dir='auto'>{change.name}{onSeeSchedule ? ':' : ''}</span>
              {onSeeSchedule && (
                <Button variant='ghost' size='sm' onClick={() => onSeeSchedule(change.raw)}>{seeLabel}</Button>
              )}
            </li>
            )
          : (
            <li key={index} className='odc-cl-change'>
              <span className='odc-cl-change-text' dir='auto' title={change.text}>{change.text}</span>
            </li>
            )
      ))}
      {hidden > 0 && <li className='odc-cl-more'>{`+${hidden}`}</li>}
    </ul>
  )
}

/** One side of the schedule dialog (New or Old): the seven days with their lapses, «Unavailable» for a closed day. */
const ScheduleColumn = ({ title, schedule, days, hourFormat, noneLabel, unavailableLabel }) => (
  <section className='odc-cl-sched'>
    <h3 className='odc-cl-sched-title'>{title}</h3>
    {schedule.length === 0
      ? <p className='odc-cl-sched-none'>{noneLabel}</p>
      : (
        <ul className='odc-cl-days' aria-label={title}>
          {schedule.map((day, index) => (
            <li key={index} className='odc-cl-day'>
              <span className='odc-cl-day-name'>{days[index]}</span>
              <span className='odc-cl-lapses'>
                {day?.enabled
                  ? (day?.lapses || []).map((lapse, lapseIndex) => (
                    <span key={lapseIndex} className='odc-figure'>{`${formatClock(lapse?.open, hourFormat)} - ${formatClock(lapse?.close, hourFormat)}`}</span>
                    ))
                  : <span className='odc-cl-muted'>{unavailableLabel}</span>}
              </span>
            </li>
          ))}
        </ul>
        )}
  </section>
)

/**
 * @param {object} props
 * @param {{ logs: object[], loading: boolean, error: any }} props.logsList the controller's list
 * @param {{ currentPage: number, pageSize: number, totalItems: number }} props.paginationProps the controller's pages
 * @param {(page: number, size: number) => void} props.onPageChange asks the controller for a page
 * @param {() => void} [props.onReload] «Try again» (else the same page again through `onPageChange`)
 * @param {'section' | 'page'} props.frame the gutter: a section of an editor, or a page of its own
 * @param {React.ReactNode} props.header drawn first (the consumer's h1 or page header)
 * @param {string} props.listLabel the name of the table and of the card list
 * @param {string} props.scrollLabel the name of the table's scroller
 * @param {string} props.emptyTitle
 * @param {string} props.emptyDescription
 * @param {string} props.loadFailedLabel what a failure says when the API gives no message
 * @param {(log: object, helpers: object) => object[]} [props.getChanges] the lines of a log (default: «Name: old → new» per change)
 * @param {{ id, header, cell: (entry) => node, skeleton }} [props.subjectColumn] a column after Event (the entry has `log`); the
 *   detail draws its cell under the event, so the dialog names what changed
 * @param {(entry) => node} [props.cardTitle] the card's title (default: the event)
 * @param {(entry) => string} [props.cardLabel] the start of the card's accessible name (default: the event)
 * @param {boolean} [props.complete] nothing is cut or folded (the settings logs, where main showed every field in its table): the
 *   table does not clamp the changes, and a card carries the event, the email, every change whole, the user agent and the
 *   «See changes» of a schedule. Without it (the store), the table clamps at three lines and a card is a summary.
 * @param {(entry) => node} [props.detailTechnical] more «Technical details» under the user agent
 * @param {(entry, close) => node} [props.detailFoot] under the timeline of the detail
 * @param {(stamp: string, log: object) => string} [props.formatDate] (row 85 a of batch D): how the log's `created_at` reads
 *   in the Date column, the cards and the detail. Without it: `parseDate(stamp, { utc: false })`, as the store and the settings logs
 *   have always had it (the driver and group logs say the stamp is UTC, or keep it raw).
 * @param {object | null} [props.detailLog] the open log comes from outside (the settings logs keep it in `?id=`): null is
 *   closed. Without it (the store and the groups, whose `?id=` is the store or the group) the view keeps the open log itself.
 * @param {(log: object | null) => void} [props.onDetailChange] with `detailLog`: a row asks to open its log, the dialog to close (null)
 * @param {React.ReactNode} [props.emptyAction] the empty state's one action (the settings logs: «Clear filters» when filtered)
 */
export const ChangeLogView = (props) => {
  const {
    logsList,
    paginationProps,
    onPageChange,
    onReload,
    frame = 'section',
    header,
    className,
    listLabel,
    scrollLabel,
    emptyTitle,
    emptyDescription,
    loadFailedLabel,
    getChanges,
    subjectColumn,
    cardTitle,
    cardLabel,
    complete = false,
    detailTechnical,
    detailFoot,
    formatDate,
    detailLog,
    onDetailChange,
    emptyAction
  } = props

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const [{ configs }] = useConfig()
  const isPhone = useIsPhone()
  const hourFormat = configs?.general_hour_format?.value

  // the log that is open (it stays while the dialog plays its exit) and the schedule dialog
  const [detail, setDetail] = useState({ open: false, entry: null })
  const [scheduleView, setScheduleView] = useState({ open: false, newSchedule: null, oldSchedule: null })

  const loading = Boolean(logsList?.loading)
  const error = loading ? null : logsList?.error
  const logs = Array.isArray(logsList?.logs) ? logsList.logs : []
  const pageSize = Number(paginationProps?.pageSize) >= 1 ? Number(paginationProps.pageSize) : PAGE_SIZE
  const currentPage = Number(paginationProps?.currentPage) >= 1 ? Number(paginationProps.currentPage) : 1
  const total = Number(paginationProps?.totalItems)

  const noneLabel = t('NONE', 'None')
  const seeLabel = t('SEE_CHANGES', 'See changes')

  // ---- the name of an attribute: the ones the dashboard knows, else words (never the bare key) ----
  const attributeName = (attribute) => {
    const key = String(attribute ?? '')
    const known = getAttributeName(key, { t })
    return known !== key ? known : t(key.toUpperCase(), humanize(key))
  }

  // ---- the log as the screen draws it (the table, the cards and the dialog draw the same entry) ----
  const eventLabel = (event) => {
    if (event === 'data_changed') return t('LOG_EVENT_DATA_CHANGED', 'Data changed')
    const raw = String(event ?? '')
    return raw ? t(raw.toUpperCase(), humanize(raw)) : '-'
  }

  const defaultChanges = (log) => changesOf(log).map(item => {
    const name = attributeName(item.attribute)
    return item.attribute === 'schedule'
      ? { schedule: true, name, attribute: item.attribute, raw: item }
      : { name, attribute: item.attribute, raw: item, text: `${name}: ${sideOf(item, 'old', t)} → ${sideOf(item, 'new', t)}` }
  })

  const toEntry = (log) => {
    const author = log?.author || {}
    const user = log?.user || {}
    const fullName = [author.name || user.name, author.lastname || user.lastname].filter(Boolean).join(' ')
    const email = author.email || user.email || ''
    return {
      id: log?.id,
      log,
      eventLabel: eventLabel(log?.event),
      dateText: log?.created_at ? (formatDate ? formatDate(log.created_at, log) : parseDate(log.created_at, { utc: false })) : '-',
      datetime: stampToIso(log?.created_at),
      fullName,
      email,
      userAgent: log?.user_agent,
      changes: getChanges ? getChanges(log, { t, attributeName, defaultChanges }) : defaultChanges(log)
    }
  }
  const entries = logs.map(toEntry)

  // ---- the dialogs ----
  // a controlled detail keeps its last log while the dialog plays its exit, as the uncontrolled one does
  const controlled = detailLog !== undefined
  const lastDetailLog = useRef(null)
  if (controlled && detailLog) lastDetailLog.current = detailLog
  const detailOpen = controlled ? Boolean(detailLog) : detail.open
  const openDetail = (entry) => (controlled ? onDetailChange?.(entry.log) : setDetail({ open: true, entry }))
  const closeDetail = () => (controlled ? onDetailChange?.(null) : setDetail(prev => ({ ...prev, open: false })))
  const openSchedule = (item) => setScheduleView({ open: true, newSchedule: toSchedule(item?.new), oldSchedule: toSchedule(item?.old) })
  const closeSchedule = () => setScheduleView(prev => ({ ...prev, open: false }))

  // ---- pages (the controller keeps the page; the foot asks for the next one) ----

  // redesign settings-logs: «Try again» unmounts itself (and a failed page change unmounts the pagination). When the
  // answer comes and the focus was left on <body>, it goes
  // to the first row (or card) of the list, or to the new «Try again» if it failed again; a person who went elsewhere keeps their
  // place (the rule of /driver-store-status, ).
  const rootRef = useRef(null)
  const retryRef = useRef(null)
  const retrying = useRef(false)
  const handleReload = () => {
    retrying.current = true
    return onReload ? onReload() : onPageChange?.(currentPage, pageSize)
  }
  // review R1 H2: a page change that fails hides the pagination that had the focus; the same rule sends it to «Try again»
  // (a page change that works keeps the pagination, so the focus stays on it)
  const handleChangePage = (page) => {
    const next = Number(page) >= 1 ? Number(page) : 1
    retrying.current = true
    onPageChange?.(next, pageSize)
  }
  useEffect(() => {
    if (loading || !retrying.current) return
    retrying.current = false
    const active = document.activeElement
    if (active && active !== document.body) return
    if (error) retryRef.current?.focus()
    else rootRef.current?.querySelector('tr[tabindex="0"], .odc-order-card-link')?.focus()
  }, [loading, error])

  // ---- the cells ----
  const loadingLabel = t('LOADING', 'Loading')
  const whoCell = (entry) => (
    <span className='odc-cl-who'>
      <span className='odc-cl-who-name' dir='auto'>{entry.fullName || entry.email || '-'}</span>
      {entry.fullName && entry.email && <span className='odc-cl-who-email' dir='auto'>{entry.email}</span>}
    </span>
  )
  const changesCell = (entry) => (
    <ChangeLines changes={entry.changes} clamp={!complete} onSeeSchedule={openSchedule} seeLabel={seeLabel} emptyLabel='-' />
  )
  // redesign stores 7.1 (; R-06): main had a «User agent» column; at-a-glance comparison needs it in the table too (the detail keeps it folded)
  // ST8: a browser reads «Chrome 155 · macOS» with the whole agent as its title; anything else shows its own (cut) text, in mono
  const shortAgent = (entry, extraClass) => {
    const { text, parsed } = summarizeUserAgent(entry.userAgent)
    const cut = text !== String(entry.userAgent).trim()
    return (
      <span
        className={['odc-cl-agent', extraClass, parsed ? '' : 'odc-mono'].filter(Boolean).join(' ')}
        dir='ltr'
        data-parsed={parsed ? '' : undefined}
        title={parsed || cut ? String(entry.userAgent).trim() : undefined}
      >
        {text}
      </span>
    )
  }
  const agentCell = (entry) => (
    entry.userAgent
      ? shortAgent(entry, 'odc-cl-agent-cell')
      : <span className='odc-cl-muted'>-</span>
  )

  const empty = (
    <EmptyState
      icon={History}
      title={emptyTitle}
      description={emptyDescription}
      action={emptyAction}
    />
  )

  // a complete card's row below the link: the user agent, and «See changes» for each schedule change (never inside the link)
  const cardActions = (entry) => {
    const schedules = entry.changes.filter(change => change.schedule)
    if (!entry.userAgent && schedules.length === 0) return undefined
    return (
      <div className='odc-cl-card-extra'>
        {schedules.map((change, index) => (
          <Button key={index} variant='ghost' size='sm' onClick={() => openSchedule(change.raw)}>{`${change.name}: ${seeLabel}`}</Button>
        ))}
        {entry.userAgent && shortAgent(entry)}
      </div>
    )
  }

  const phoneList = () => {
    const toCard = (entry) => ({
      id: entry.id,
      href: '#', // the card is a link for the keyboard and the screen reader; a plain click opens the detail (no address of its own)
      label: `${cardLabel ? cardLabel(entry) : entry.eventLabel}, ${entry.dateText}, ${t('VIEW_DETAILS', 'View details')}`,
      title: cardTitle ? cardTitle(entry) : <span className='odc-cl-event' dir='auto'>{entry.eventLabel}</span>,
      assignee: complete ? whoCell(entry) : <span className='odc-cl-who-name' dir='auto'>{entry.fullName || entry.email || '-'}</span>,
      schedule: [entry.dateText],
      onOpen: () => openDetail(entry),
      // redesign settings-logs: a complete card says on its face what main's table row said (nothing behind a tap)
      ...(complete
        ? {
            status: <span className='odc-cl-card-event' dir='auto'>{entry.eventLabel}</span>,
            indicator: <ChangeLines changes={entry.changes} emptyLabel='-' />,
            actions: cardActions(entry)
          }
        : {
            indicator: <ChangeLines changes={entry.changes} clamp limit={SUMMARY_LINES} emptyLabel='-' />
          })
    })
    return (
      <RecordCardList
        label={listLabel}
        items={loading ? [] : entries.map(toCard)}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonCount={SKELETON_ROWS}
        empty={empty}
      />
    )
  }

  const table = () => {
    const columns = [
      { id: 'date', header: t('DATE', 'Date'), rowHeader: true, skeleton: { lines: 1 }, cell: entry => <span className='odc-cl-date'>{entry.dateText}</span> },
      { id: 'user', header: t('USER', 'User'), wrap: true, skeleton: { lines: 2 }, cell: whoCell },
      { id: 'event', header: t('EVENT', 'Event'), wrap: true, skeleton: { lines: 1 }, cell: entry => <span className='odc-cl-event' dir='auto'>{entry.eventLabel}</span> },
      ...(subjectColumn ? [{ wrap: true, skeleton: { lines: 1 }, ...subjectColumn }] : []),
      { id: 'changes', header: t('CHANGES', 'Changes'), wrap: true, skeleton: { lines: 2 }, cell: changesCell },
      { id: 'user_agent', header: t('USER_AGENT', 'User agent'), wrap: true, skeleton: { lines: 1 }, cell: agentCell }
    ]
    return (
      <DataTable
        label={listLabel}
        columns={columns}
        rows={entries}
        getRowId={entry => entry.id}
        onOpenRow={openDetail}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonRows={SKELETON_ROWS}
        scrollLabel={scrollLabel}
        empty={empty}
      />
    )
  }

  // G2-33: the API said no. It is not an empty list: the message and a way to try again
  const failure = () => {
    const raw = typeof error === 'string' ? error : error?.message
    return (
      <InlineNotice
        tone='danger'
        role='alert'
        icon={TriangleAlert}
        className='odc-cl-notice'
        action={<Button ref={retryRef} size='sm' onClick={handleReload}>{t('TRY_AGAIN', 'Try again')}</Button>}
      >
        {translateApiMessage(t, raw, loadFailedLabel)}
      </InlineNotice>
    )
  }

  const foot = !error && total > 0 && (
    <div className='odc-cl-foot'>
      <Pagination
        page={currentPage}
        pageSize={pageSize}
        total={total}
        onPageChange={handleChangePage}
        busy={loading}
        showPageInput
        label={t('PAGINATION', 'Pagination')}
        previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
        nextLabel={t('NEXT_PAGE', 'Next page')}
        pageLabel={t('PAGE', 'Page')}
        pageOfLabel={(count, figure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total: count }, figure)}
        rangeLabel={(from, to, count, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total: count }, figure)}
        pageStatusLabel={(current, count) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(count))}
      />
    </div>
  )

  // ---- the schedule dialog (the days Sunday first, as the schedule arrays are) ----
  const days = [
    t('DAY7', 'Sunday'),
    t('DAY1', 'Monday'),
    t('DAY2', 'Tuesday'),
    t('DAY3', 'Wednesday'),
    t('DAY4', 'Thursday'),
    t('DAY5', 'Friday'),
    t('DAY6', 'Saturday')
  ]
  const unavailableLabel = t('UNAVAILABLE', 'Unavailable')

  const entry = controlled ? (lastDetailLog.current ? toEntry(lastDetailLog.current) : null) : detail.entry
  const technical = entry && detailTechnical ? detailTechnical(entry) : null
  const agentNode = entry?.userAgent ? <span className='odc-cl-agent odc-mono' dir='ltr'>{entry.userAgent}</span> : null
  const details = agentNode || technical
    ? <>{agentNode}{technical}</>
    : undefined

  return (
    <div ref={rootRef} className={['odc-root', 'odc-cl', className].filter(Boolean).join(' ')} data-frame={frame}>
      {header}
      {error ? failure() : (isPhone ? phoneList() : table())}
      {foot}

      <Dialog
        open={detailOpen}
        onOpenChange={(next) => { if (!next) closeDetail() }}
        // redesign bugs F row 37: the title says what happened; the date shows once, in the timeline
        title={entry ? (entry.eventLabel && entry.eventLabel !== '-' ? entry.eventLabel : t('LOG_DETAIL', 'Change details')) : ''}
        closeLabel={t('CLOSE', 'Close')}
        size='md'
      >
        {entry && (
          <div className='odc-cl-detail'>
            <ActivityTimeline
              label={t('LOG_DETAIL', 'Change details')}
              detailsLabel={t('TECHNICAL_DETAILS', 'Technical details')}
              items={[{
                id: entry.id,
                at: entry.dateText,
                datetime: entry.datetime,
                title: (
                  <>
                    {subjectColumn && <span className='odc-cl-detail-subject'>{subjectColumn.cell(entry)}</span>}
                    <ChangeLines changes={entry.changes} onSeeSchedule={openSchedule} seeLabel={seeLabel} emptyLabel='-' />
                  </>
                ),
                by: [entry.fullName, entry.email].filter(Boolean).join(' · ') || undefined,
                details
              }]}
            />
            {detailFoot && detailFoot(entry, closeDetail)}
          </div>
        )}
      </Dialog>

      <Dialog
        open={scheduleView.open}
        onOpenChange={(next) => { if (!next) closeSchedule() }}
        title={t('SCHEDULE_CHANGES', 'Schedule changes')}
        closeLabel={t('CLOSE', 'Close')}
        size='md'
      >
        <div className='odc-cl-scheds'>
          {scheduleView.newSchedule && <ScheduleColumn title={t('NEW', 'New')} schedule={scheduleView.newSchedule} days={days} hourFormat={hourFormat} noneLabel={noneLabel} unavailableLabel={unavailableLabel} />}
          {scheduleView.oldSchedule && <ScheduleColumn title={t('OLD', 'Old')} schedule={scheduleView.oldSchedule} days={days} hourFormat={hourFormat} noneLabel={noneLabel} unavailableLabel={unavailableLabel} />}
          {!scheduleView.newSchedule && !scheduleView.oldSchedule && <p className='odc-cl-sched-none'>{noneLabel}</p>}
        </div>
      </Dialog>
    </div>
  )
}
