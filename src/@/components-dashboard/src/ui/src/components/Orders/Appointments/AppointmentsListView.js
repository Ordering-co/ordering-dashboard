import React, { useId, useMemo } from 'react'
import styled from 'styled-components'
import { Navigate } from 'react-big-calendar'
import { useUtils, useConfig, useLanguage } from '../../../../../index'
import { User as PersonIcon } from '../../Shared/Icon'
import { buildTimeRange, isRtlLanguage, joinTimeRange, uses24Hours } from './calendarFormats'
import { ClockText } from './EventComponent'
import { EventProfessionalPhoto } from './styles'

// redesign (decisions 4 and 6): the List view of /appointments, a custom view of react-big-calendar 1.20 (`views={{ list: ... }}`).
// It lists the appointments of the month of `date`, grouped by day; each one is a full-row native button. Same shape as rbc's own
// Agenda view: a component with the statics rbc asks of a view (`range`, `navigate`, `title`).
// The empty-period notice is not drawn here: with no appointments this renders an empty container (`data-empty`).

const dayKey = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

// The appointments whose start falls between `start` and `end`, ordered by start and grouped by day: [{ key, day, events }]
export const groupAppointmentsByDay = (events, { start, end, accessors, localizer }) => {
  const from = start.getTime()
  const to = end.getTime()
  const groups = new Map()
  ;(events || [])
    .map(event => ({ event, time: accessors.start(event).getTime() }))
    .filter(({ time }) => time >= from && time <= to)
    .sort((a, b) => a.time - b.time)
    .forEach(({ event, time }) => {
      const key = dayKey(new Date(time))
      if (!groups.has(key)) groups.set(key, { key, day: localizer.startOf(new Date(time), 'day'), events: [] })
      groups.get(key).events.push(event)
    })
  return Array.from(groups.values())
}

// Tokens only: the row heights and the focus ring are the ones of the Product controls (product.css `.odc-btn`), the type roles are the
// ones of RecordCard (`--od-x-type-body-size` semibold for the lead text).
const ListRoot = styled.div`
  display: block;
  inline-size: 100%;
  min-inline-size: 0;
  overflow: auto;
  font-family: var(--od-font-sans);
  color: var(--od-text);
`
const DaySection = styled.section`
  margin: 0;
`
const DayHeading = styled.h2`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--od-space-2);
  margin: 0;
  padding-block: var(--od-space-3) var(--od-space-2);
  padding-inline: var(--od-space-3);
  border-block-end: var(--od-x-hairline) solid var(--od-border);
  font-family: inherit;
  font-size: var(--od-x-type-body-size);
  font-weight: var(--od-font-weight-semibold);
  line-height: var(--od-x-leading-ui);
  color: var(--od-text);
`
const TodayMark = styled.span`
  font-size: var(--od-x-type-caption-size);
  font-weight: var(--od-font-weight-semibold);
  color: var(--od-text-muted);
`
const Row = styled.button`
  appearance: none;
  display: flex;
  align-items: center;
  gap: var(--od-space-3);
  inline-size: 100%;
  min-block-size: var(--od-x-control-height);
  margin: 0;
  padding-block: var(--od-space-2);
  padding-inline: var(--od-space-3);
  border: 0;
  border-block-end: var(--od-x-hairline) solid var(--od-border);
  border-radius: 0;
  background: transparent;
  color: var(--od-text);
  font-family: inherit;
  font-size: var(--od-x-type-body-size);
  line-height: var(--od-x-leading-ui);
  text-align: start;
  cursor: pointer;

  &:hover {
    background: var(--od-x-hover);
  }

  /* The system ring (as .odc-btn); drawn inside the row (negative offset) so the scrolling container does not cut it. */
  &:focus-visible {
    outline: var(--od-focus-ring-width) solid var(--od-focus-ring-color);
    outline-offset: calc(var(--od-focus-ring-offset) * -1);
  }

  @media (pointer: coarse), (max-width: 767px) {
    min-block-size: var(--od-x-target-coarse);
  }
`
const RowTime = styled.span`
  flex: 0 0 auto;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`
const RowName = styled.span`
  flex: 1 1 auto;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const AppointmentRow = ({ event, accessors, timeRange, rtl, optimizeImage, onSelectEvent }) => {
  const { start, end } = timeRange(accessors.start(event), accessors.end(event))
  const name = [event?.professional?.name, event?.professional?.lastname].filter(Boolean).join(' ')
  return (
    <Row
      type='button'
      aria-label={`${name}, ${joinTimeRange({ start, end })}`}
      onClick={domEvent => onSelectEvent && onSelectEvent(event, domEvent)}
    >
      <EventProfessionalPhoto aria-hidden='true'>
        {event?.professional?.photo
          ? <img src={optimizeImage(event.professional.photo, 'h_40,c_limit')} alt='' />
          : <PersonIcon aria-hidden='true' />}
      </EventProfessionalPhoto>
      <RowTime>
        <ClockText text={start} rtl={rtl} /> – <ClockText text={end} rtl={rtl} />
      </RowTime>
      {/* tanda P: the element that cuts takes the direction of the name, so a Latin name in an Arabic page keeps its start */}
      <RowName dir='auto'><bdi>{name}</bdi></RowName>
    </Row>
  )
}

export const AppointmentsListView = ({ date, events, accessors, localizer, onSelectEvent, getNow }) => {
  const [{ optimizeImage, parseDate }] = useUtils()
  const [{ configs }] = useConfig()
  const [languageState, t] = useLanguage()
  const languageCode = languageState?.language?.code
  const rtl = isRtlLanguage(languageCode, languageState?.language?.rtl)
  const is24Hours = uses24Hours(configs)
  const idPrefix = useId()
  const timeRange = useMemo(
    () => buildTimeRange({ parseDate, languageCode, is24Hours }),
    [parseDate, languageCode, is24Hours]
  )
  const { start, end } = AppointmentsListView.range(date, { localizer })
  const groups = groupAppointmentsByDay(events, { start, end, accessors, localizer })
  const today = dayKey(getNow ? getNow() : new Date())

  return (
    <ListRoot data-empty={groups.length ? undefined : ''}>
      {groups.map(group => (
        <DaySection key={group.key} aria-labelledby={`${idPrefix}-${group.key}`}>
          <DayHeading id={`${idPrefix}-${group.key}`}>
            <span>{localizer.format(group.day, 'dayHeaderFormat')}</span>
            {group.key === today && <TodayMark>{' '}{t('TODAY', 'Today')}</TodayMark>}
          </DayHeading>
          {group.events.map((event, index) => (
            <AppointmentRow
              key={event.id ?? `${group.key}-${index}`}
              event={event}
              accessors={accessors}
              timeRange={timeRange}
              rtl={rtl}
              optimizeImage={optimizeImage}
              onSelectEvent={onSelectEvent}
            />
          ))}
        </DaySection>
      ))}
    </ListRoot>
  )
}

// The month of `date`: what rbc asks to know which events to fetch and how to move
AppointmentsListView.range = (date, { localizer }) => ({
  start: localizer.startOf(date, 'month'),
  end: localizer.endOf(date, 'month')
})

AppointmentsListView.navigate = (date, action, { localizer }) => {
  switch (action) {
    case Navigate.PREVIOUS:
      return localizer.add(date, -1, 'month')
    case Navigate.NEXT:
      return localizer.add(date, 1, 'month')
    default: // DATE, and TODAY (rbc resolves it before calling the view)
      return date
  }
}

AppointmentsListView.title = (date, { localizer }) => localizer.format(date, 'monthHeaderFormat')
