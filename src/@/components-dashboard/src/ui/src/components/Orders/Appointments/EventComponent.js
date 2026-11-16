import React, { useContext, useMemo } from 'react'
import styled from 'styled-components'
import { useUtils, useConfig, useLanguage } from '../../../../../index'
// redesign W1-7 (T1-7-4, b): Lucide glyph for the photo placeholder
import { User as PersonIcon } from '../../Shared/Icon'
import { buildTimeRange, isRtlLanguage, joinTimeRange, splitClock, uses24Hours } from './calendarFormats'
import { AppointmentsToolbarContext } from './CalendarHeader'
import {
  EventContainer,
  EventProfessionalPhoto
} from './styles'
import './appointments-events.css'

// redesign (decision 6; R1-05 puts the range first): the week and day event reads «range · name», so a narrow column of the
// week (about 140px at 1440) cuts the name and not the hour; the photo stays on the start side and `title` carries the whole text in
// the same order. EventContainer already lays out a row (photo + content), so it is kept as is and only this line, own to this file,
// is the text. The tokens are the ones the event text had (`--od-type-secondary-size`).
// tanda P: one line with an ellipsis still cut the hour itself («04:00 – 04:4…»): the photo and the name left ~85px.
// The range is now never cut: it is one piece that breaks only at the dash when it does not fit, the name follows it on the same
// line while there is room for a few letters and goes below it otherwise, and only the name ends in an ellipsis. Content taller
// than a short event is cut at the bottom (the name first), never at the top.
const EventLine = styled.span`
  flex: 1 1 auto;
  min-inline-size: 0;
  align-self: flex-start;
  align-self: safe center;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 0.25em;
  margin-inline-start: var(--od-space-2);
  overflow: hidden;
  font-size: var(--od-type-secondary-size);
  font-weight: var(--od-font-weight-medium);
  line-height: var(--od-x-leading-ui);
`
const EventHours = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  column-gap: 0.25em;
  max-inline-size: 100%;

  > span {
    white-space: nowrap;
  }
`
const EventName = styled.span`
  flex: 1 1 0;
  min-inline-size: min(4em, 100%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

// redesign bugs H (W1-QC2-04): one end of the range. Everywhere the digits are isolated in LTR (`<bdi dir='ltr'>`) so a right-to-left page
// never reorders them. In a right-to-left language with a meridiem («03:00 ص») only the digits go in the LTR bdi and the meridiem stays
// outside, in the direction of the language: inside the LTR bdi it was drawn to the right of the digits and read first. Other languages are
// unchanged: the whole text in the one bdi.
export const ClockText = ({ text, rtl = false }) => {
  const parts = rtl ? splitClock(text) : null
  if (!parts || !(parts.before + parts.after).trim()) return <bdi dir='ltr'>{text}</bdi>
  return (
    <bdi>
      {parts.before}<bdi dir='ltr'>{parts.time}</bdi>{parts.after}
    </bdi>
  )
}

// redesign C1a (W1-QC1-02, W1-QC1-07, W1-QC1-08, W1-QC1-12): the same clock rule as the gutter (calendarFormats), the meridiem of the
// language, each hour isolated (`<bdi dir='ltr'>`) and the name in `<bdi>`, so a right-to-left language never reorders them.
// `interactive` is the month view's: rbc's month event is a plain div (no tabindex, no role), so the summary itself is the button
// (named with the professional and the time); week and day events are already role=button divs, so there it stays plain text.
const EventSummary = ({ event, interactive = false }) => {
  const [{ optimizeImage, parseDate }] = useUtils()
  const [{ configs }] = useConfig()
  const [languageState] = useLanguage()
  const languageCode = languageState?.language?.code
  const rtl = isRtlLanguage(languageCode, languageState?.language?.rtl)
  const is24Hours = uses24Hours(configs)
  const timeRange = useMemo(
    () => buildTimeRange({ parseDate, languageCode, is24Hours }),
    [parseDate, languageCode, is24Hours]
  )
  // rbc hands over the raw string; parseDate gives the wall time of the user (as the accessors of the calendar read it), and the
  // clock writes that time of day (a Date at noon's side of an arbitrary day: only the hour and minutes are read).
  // inside the page, the accessors' own `wallDate` (the store's zone)
  const { wallDate } = useContext(AppointmentsToolbarContext)
  const getClockDate = (time) => {
    const wall = wallDate?.(time)
    const [hours, minutes] = wall ? [wall.getHours(), wall.getMinutes()] : String(parseDate(time, { outputFormat: 'HH:mm' })).split(':').map(Number)
    return Number.isFinite(hours) && Number.isFinite(minutes) ? new Date(2000, 0, 1, hours, minutes) : null
  }
  const startDate = getClockDate(event.start)
  const endDate = getClockDate(event.end)
  const { start, end } = startDate && endDate ? timeRange(startDate, endDate) : { start: '', end: '' }
  const name = [event?.professional?.name, event?.professional?.lastname].filter(Boolean).join(' ')
  const photo = (
    <EventProfessionalPhoto aria-hidden='true'>
      {event?.professional?.photo
        ? (
        <img src={optimizeImage(event?.professional?.photo, 'h_40,c_limit')} alt='' />
          )
        : (
        <PersonIcon aria-hidden='true' />
          )}
    </EventProfessionalPhoto>
  )
  const hours = (
    <>
      <ClockText text={start} rtl={rtl} /> – <ClockText text={end} rtl={rtl} />
    </>
  )

  if (!interactive) {
    return (
      <EventContainer className='appointments-event-inline' title={`${joinTimeRange({ start, end })} · ${name}`}>
        {photo}
        <EventLine data-event-line>
          <EventHours data-event-hours>
            <span><ClockText text={start} rtl={rtl} /> –</span> <span><ClockText text={end} rtl={rtl} /></span>
          </EventHours> <EventName data-event-name><span data-event-sep>· </span><bdi>{name}</bdi></EventName>
        </EventLine>
      </EventContainer>
    )
  }

  return (
    <EventContainer
      role='button'
      tabIndex={0}
      aria-label={`${name}, ${joinTimeRange({ start, end })}`}
    >
      {photo}
      <div className='info'>
        <p className='name'><bdi>{name}</bdi></p>
        <p className='date'>{hours}</p>
      </div>
    </EventContainer>
  )
}

export const EventComponent = (props) => <EventSummary event={props.event} />

// redesign C1a (W1-QC1-02): the month's event, focusable; Enter and Space open it through the calendar's onKeyPressEvent
export const MonthEventComponent = (props) => <EventSummary event={props.event} interactive />

// redesign C1a (W1-QC1-09): rbc's month row is role=row, whose children must be cells, and the buttons of its events («+N more», and
// now the events) sit in plain divs under it (axe aria-required-children). rbc has a hook for exactly this, `components.weekWrapper`
// (it wraps the event rows of a week); the events of the week are one cell of the row, which keeps the buttons inside a cell.
export const MonthEventRows = ({ children }) => <div role='cell'>{children}</div>
