import React, { useEffect, useState } from 'react'
import { useTheme } from 'styled-components'

import { Schedule } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Schedule'

const lapse = (openHour, openMinute, closeHour, closeMinute) => ({
  open: { hour: openHour, minute: openMinute },
  close: { hour: closeHour, minute: closeMinute }
})
const makeSchedule = () => [
  { enabled: true, lapses: [lapse(9, 0, 10, 0), lapse(12, 0, 13, 0)] },
  { enabled: true, lapses: [lapse(8, 30, 9, 30)] },
  { enabled: false, lapses: [lapse(0, 0, 23, 59)] },
  { enabled: true, lapses: [lapse(7, 15, 15, 45)] },
  { enabled: true, lapses: [lapse(10, 0, 18, 0)] },
  { enabled: true, lapses: [lapse(11, 0, 20, 0)] },
  { enabled: true, lapses: [lapse(6, 0, 14, 0)] }
]

const Section = ({ children, label, testId }) => (
  <section aria-label={label} data-testid={testId} className='schedule-fixture-section'>
    <h2>{label}</h2>
    {children}
  </section>
)

const ControlledSchedule = ({ disableSchedule, isShowDate, testId, useDaysAbbrevation }) => {
  const [schedule, setSchedule] = useState(makeSchedule)
  const [events, setEvents] = useState([])
  const onChange = next => {
    setSchedule(next)
    setEvents(current => [...current, next])
  }
  return (
    <div data-testid={testId} className='schedule-fixture-case'>
      <Schedule scheduleList={schedule} handleChangeScheduleState={onChange} disableSchedule={disableSchedule} isShowDate={isShowDate} useDaysAbbrevation={useDaysAbbrevation} />
      <output data-testid={`${testId}-state`}>{JSON.stringify(schedule)}</output>
      <output data-testid={`${testId}-events`}>{JSON.stringify(events)}</output>
    </div>
  )
}

const DefaultAndEmptyCases = () => {
  const [defaultEvents, setDefaultEvents] = useState([])
  const [emptyEvents, setEmptyEvents] = useState([])
  return (
    <Section label='Initialization contracts' testId='schedule-initialization'>
      <div className='schedule-fixture-grid'>
        <div data-testid='schedule-default' className='schedule-fixture-case'>
          <h3>Default seven days</h3>
          <Schedule handleChangeScheduleState={value => setDefaultEvents(current => [...current, value])} />
        </div>
        <div data-testid='schedule-empty' className='schedule-fixture-case'>
          <h3>Explicit empty schedule</h3>
          <Schedule scheduleList={[]} handleChangeScheduleState={value => setEmptyEvents(current => [...current, value])} />
        </div>
      </div>
      <output data-testid='schedule-default-events'>{JSON.stringify(defaultEvents)}</output>
      <output data-testid='schedule-empty-events'>{JSON.stringify(emptyEvents)}</output>
    </Section>
  )
}

export const SchedulesFixture = () => {
  const theme = useTheme()
  const [parentEscapeEvents, setParentEscapeEvents] = useState(0)
  useEffect(() => {
    const handleKey = event => event.key === 'Escape' && setParentEscapeEvents(value => value + 1)
    document.body.addEventListener('keydown', handleKey)
    return () => document.body.removeEventListener('keydown', handleKey)
  }, [])
  return (
    <main data-testid='schedules-fixture' className='schedules-fixture' style={{ background: theme.ordering?.semantic?.background, color: theme.ordering?.semantic?.text?.default }}>
      <style>{`
        .schedules-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
        .schedules-fixture * { box-sizing: border-box; }
        .schedules-fixture > h1, .schedule-fixture-section > h2, .schedule-fixture-case > h3 { margin: 0; }
        .schedule-fixture-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 16px; min-width: 0; padding: 16px; }
        .schedule-fixture-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); min-width: 0; }
        .schedule-fixture-case { min-width: 0; }
        .schedules-fixture output { display: block; max-width: 100%; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
        .schedules-fixture [data-fixture-control] { min-height: 44px; max-width: 100%; white-space: normal; }
        @media (max-width: 420px) { .schedules-fixture { gap: 12px; padding: 12px; } .schedule-fixture-section { padding: 12px; } }
      `}</style>
      <h1>Ordering.co schedule fixtures</h1>
      <Section label='Editable weekly schedule' testId='schedule-editable-section'>
        <ControlledSchedule testId='schedule-main' />
      </Section>
      <Section label='Restricted actions and dated schedule' testId='schedule-readonly-section'>
        <ControlledSchedule testId='schedule-readonly' disableSchedule isShowDate useDaysAbbrevation />
      </Section>
      <DefaultAndEmptyCases />
      <button data-fixture-control data-testid='schedule-outside' type='button'>Outside schedule controls</button>
      <output data-testid='schedule-parent-escape-events'>{parentEscapeEvents}</output>
    </main>
  )
}
