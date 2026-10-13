import React, { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
