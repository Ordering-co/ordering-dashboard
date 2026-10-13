import React, { useState } from 'react'
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/react'
import { vi, it, expect, afterEach } from 'vitest'
import { Schedule as NativeController } from '../../../../../components/Schedule'
import { HoursEditor } from './HoursEditor'
import { createDraft, validSchedule, businessPayload } from '../../../../../utils/storeOnboarding'
vi.mock('../../../components/Shared/Schedule', () => ({ Schedule: props => <NativeController {...props} UIComponent={p => <><button onClick={() => p.handleAddSchedule(1)}>Add period</button><button onClick={() => p.handleEnabledSchedule(0, true)}>Open Sunday</button><button onClick={() => p.handleAddSchedule(0)}>Add Sunday period</button><button onClick={() => p.handleSelectCopyTimes(2)}>Select Tuesday</button><button onClick={() => p.handleApplyScheduleCopyTimes(1)}>Copy Monday</button></>} /> }))
afterEach(cleanup)
it('round-trips native multiple periods and copy through the existing schedule controller', async () => {
  let form
  const Harness = () => {
    const [current, setCurrent] = useState(createDraft('owner@example.com').form)
    form = current
    return <HoursEditor form={current} onChange={schedule => setCurrent(f => ({ ...f, schedule }))} />
  }
  render(<Harness />)
  fireEvent.click(screen.getByText('Add period'))
  await waitFor(() => expect(form.schedule[1].lapses).toHaveLength(2))
  fireEvent.click(screen.getByText('Select Tuesday'))
  fireEvent.click(screen.getByText('Copy Monday'))
  await waitFor(() => expect(form.schedule[2]).toEqual(form.schedule[1]))
  expect(validSchedule(form.schedule)).toBe(true)
  expect(JSON.parse(businessPayload({ ...createDraft('owner@example.com'), form }, 1).schedule)).toEqual(form.schedule)
})
it('freezes the existing editor once publication starts', () => {
  render(<HoursEditor form={createDraft('owner@example.com').form} disabled onChange={vi.fn()} />)
  expect(screen.getByText('Add period')).toBeDisabled()
})

it('opens an initially closed day and adds its first additional period through the unchanged controller', async () => {
  let form
  const Harness = () => {
    const [current, setCurrent] = useState(createDraft('owner@example.com').form)
    form = current
    return <HoursEditor form={current} onChange={schedule => setCurrent(f => ({ ...f, schedule }))} />
  }
  render(<Harness />)
  fireEvent.click(screen.getByText('Open Sunday'))
  await waitFor(() => expect(form.schedule[0].lapses).toHaveLength(1))
  expect(validSchedule(form.schedule)).toBe(true)
  fireEvent.click(screen.getByText('Add Sunday period'))
  await waitFor(() => expect(form.schedule[0].lapses).toHaveLength(2))
  expect(validSchedule(form.schedule)).toBe(true)
})
