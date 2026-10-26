import React, { useState, StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Schedule } from './index'

const initialSchedule = Array.from({ length: 7 }, () => ({
  enabled: false,
  lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }]
}))

const ScheduleUI = ({ scheduleState, handleEnabledSchedule }) => (
  <button type='button' onClick={() => handleEnabledSchedule(0, true)}>
    {scheduleState[0]?.enabled ? 'Enabled' : 'Disabled'}
  </button>
)

describe('Schedule controller synchronization', () => {
  test('notifies one semantic change without entering a parent-child update loop', async () => {
    const onChange = vi.fn()
    const Harness = () => {
      const [schedule, setSchedule] = useState(initialSchedule)
      const handleChange = nextSchedule => {
        onChange(nextSchedule)
        setSchedule(nextSchedule)
      }
      return <Schedule UIComponent={ScheduleUI} scheduleList={schedule} handleChangeScheduleState={handleChange} />
    }

    render(<Harness />)
    expect(screen.getByRole('button')).toHaveTextContent('Disabled')
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('Enabled'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0][0].enabled).toBe(true)
    expect(initialSchedule[0].enabled).toBe(false)
  })
})

const defaultDay = (enabled = false) => ({
  enabled,
  lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }]
})

const retainedFixture = () => [
  { enabled: true, lapses: [{ open: { hour: 13, minute: 15 }, close: { hour: 18, minute: 45 } }] },
  { enabled: false, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }] },
  {
    enabled: true,
    lapses: [
      { open: { hour: 9, minute: 0 }, close: { hour: 12, minute: 0 } },
      { open: { hour: 14, minute: 0 }, close: { hour: 20, minute: 0 } }
    ]
  },
  defaultDay(),
  defaultDay(),
  defaultDay(),
  defaultDay()
]

const renderCapture = (schedule, strict = false) => {
  const state = {}
  const Capture = props => { Object.assign(state, props); return null }
  const element = <Schedule UIComponent={Capture} scheduleList={schedule} handleChangeScheduleState={vi.fn()} />
  const view = strict ? render(<StrictMode>{element}</StrictMode>) : render(element)
  return { state, view }
}

describe('Schedule controller retained handlers', () => {
  test.each([[true, true], [true, false], [false, true], [false, false]])(
    'a retained time handler keeps hour then minute (batched=%s strict=%s)',
    (batched, strict) => {
      const fixture = retainedFixture()
      const snapshot = JSON.parse(JSON.stringify(fixture))
      const { state } = renderCapture(fixture, strict)
      const retained = state.handleChangeScheduleTime

      if (batched) {
        act(() => {
          retained(14, 0, 0, true, 'hour')
          retained(30, 0, 0, true, 'minute')
        })
      } else {
        act(() => retained(14, 0, 0, true, 'hour'))
        expect(state.scheduleState[0].lapses[0].open).toEqual({ hour: 14, minute: 15 })
        act(() => retained(30, 0, 0, true, 'minute'))
      }

      expect(state.scheduleState[0].lapses[0].open).toEqual({ hour: 14, minute: 30 })
      expect(fixture).toEqual(snapshot)
    }
  )

  test('retained enabled/add/delete/copy handlers preserve earlier edits', () => {
    const fixture = retainedFixture()
    const { state } = renderCapture(fixture)
    const retained = {
      time: state.handleChangeScheduleTime,
      enabled: state.handleEnabledSchedule,
      add: state.handleAddSchedule,
      remove: state.handleDeleteSchedule,
      select: state.handleSelectCopyTimes,
      apply: state.handleApplyScheduleCopyTimes,
      clean: state.cleanSelectedCopyDays
    }

    act(() => retained.time(14, 0, 0, true, 'hour'))
    act(() => retained.time(30, 0, 0, true, 'minute'))

    act(() => retained.enabled(1, true))
    expect(state.scheduleState[0].lapses[0].open).toEqual({ hour: 14, minute: 30 })
    expect(state.scheduleState[1].enabled).toBe(true)
    expect(state.scheduleState[1].lapses).toEqual([{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }])

    act(() => retained.add(1))
    expect(state.scheduleState[0].lapses[0].open).toEqual({ hour: 14, minute: 30 })
    expect(state.scheduleState[1].lapses).toEqual([
      { open: { hour: 0, minute: 0 }, close: { hour: 8, minute: 59 } },
      { open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }
    ])

    act(() => retained.remove(1, 0))
    expect(state.scheduleState[1].lapses).toEqual([{ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }])
    expect(state.scheduleState[0].lapses[0].open).toEqual({ hour: 14, minute: 30 })

    act(() => {
      retained.select(1)
      retained.apply(0)
    })
    expect(state.scheduleState[1]).toEqual({
      enabled: true,
      lapses: [{ open: { hour: 14, minute: 30 }, close: { hour: 18, minute: 45 } }]
    })
    expect(state.scheduleState[0].lapses[0].open).toEqual({ hour: 14, minute: 30 })

    act(() => {
      retained.select(2)
      retained.clean()
      retained.apply(0)
    })
    expect(state.scheduleState[2].lapses[0].open).toEqual({ hour: 9, minute: 0 })

    act(() => {
      retained.select(2)
      retained.select(2)
    })
    expect(state.selectedCopyDays).toEqual([])
    act(() => {
      retained.select(2)
      retained.select(3)
    })
    expect(state.selectedCopyDays).toEqual([2, 3])
  })

  test('a rejected change keeps the accepted state and the next valid change succeeds', () => {
    const fixture = retainedFixture()
    const { state } = renderCapture(fixture)
    const retained = state.handleChangeScheduleTime

    act(() => retained(14, 0, 0, true, 'hour'))
    act(() => retained(19, 0, 0, true, 'hour'))
    expect(state.scheduleState[0].lapses[0].open).toEqual({ hour: 14, minute: 15 })
    expect(state.isTimeChangeError).toBe(true)

    act(() => retained(15, 2, 0, false, 'hour'))
    expect(state.scheduleState[2].lapses[0].close).toEqual({ hour: 12, minute: 0 })
    expect(state.isConflict).toBe(true)

    act(() => retained(30, 0, 0, true, 'minute'))
    expect(state.scheduleState[0].lapses[0].open).toEqual({ hour: 14, minute: 30 })
  })

  test('a retained handler acts on a replaced or reset schedule, not the old snapshot', () => {
    const fixture = retainedFixture()
    const { state, view } = renderCapture(fixture)
    const retained = state.handleChangeScheduleTime

    const next = JSON.parse(JSON.stringify(fixture))
    next[0].lapses = [{ open: { hour: 8, minute: 0 }, close: { hour: 12, minute: 0 } }]
    const Capture = props => { Object.assign(state, props); return null }
    view.rerender(<Schedule UIComponent={Capture} scheduleList={next} handleChangeScheduleState={vi.fn()} />)

    act(() => retained(10, 0, 0, true, 'hour'))
    expect(state.scheduleState[0].lapses[0]).toEqual({
      open: { hour: 10, minute: 0 },
      close: { hour: 12, minute: 0 }
    })

    view.rerender(<Schedule UIComponent={Capture} scheduleList={undefined} handleChangeScheduleState={vi.fn()} />)
    act(() => retained(7, 0, 0, true, 'hour'))
    expect(state.scheduleState[0].lapses[0]).toEqual({
      open: { hour: 7, minute: 0 },
      close: { hour: 23, minute: 59 }
    })
  })
})
