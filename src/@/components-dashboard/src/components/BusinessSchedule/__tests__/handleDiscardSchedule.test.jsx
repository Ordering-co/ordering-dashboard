/* eslint-disable import/first */
// redesign stores 5.4: the schedule section lets the user discard what they edited. `handleDiscardSchedule`
// empties the pending changes and the previous result, and nothing else.
import React from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
const mocks = vi.hoisted(() => ({ save: vi.fn(), showToast: vi.fn() }))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ businesses: () => ({ save: mocks.save }) }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => text]
}))

import { BusinessSchedule } from '../index'

const SCHEDULE = [{ enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 18, minute: 0 } }] }]

let ui
const draw = () => {
  const UI = (props) => {
    ui = props
    return null
  }
  render(<BusinessSchedule UIComponent={UI} business={{ id: 7 }} />)
}

describe('BusinessSchedule controller · handleDiscardSchedule', () => {
  it('empties the pending changes after handleChangeScheduleState', () => {
    draw()
    expect(typeof ui.handleDiscardSchedule).toBe('function')
    act(() => { ui.handleChangeScheduleState(SCHEDULE) })
    expect(ui.formState.changes).toEqual({ schedule: SCHEDULE })
    act(() => { ui.handleDiscardSchedule() })
    expect(ui.formState).toEqual({ loading: false, changes: {}, result: { error: false } })
  })
})

describe('BusinessSchedule controller · handleUpdateSchedule({ inlineError })', () => {
  it('paints no Loading or error toast for a screen that shows the failure itself; without the option both stay', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Bad schedule'] } })
    draw()
    act(() => { ui.handleChangeScheduleState(SCHEDULE) })
    let result
    await act(async () => { result = await ui.handleUpdateSchedule({ inlineError: true }) })
    expect(result).toEqual({ ok: false, error: ['Bad schedule'] })
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(ui.formState.result).toEqual({ error: true, result: ['Bad schedule'] })
    await act(async () => { await ui.handleUpdateSchedule() })
    expect(mocks.showToast).toHaveBeenCalledWith('info', 'Loading')
    expect(mocks.showToast).toHaveBeenCalledWith('error', 'Bad schedule')
  })
})

// redesign stores: the store editor's SaveBar already says «Saved»; `silentSuccess` drops only the success toast.
describe('BusinessSchedule controller · handleUpdateSchedule({ silentSuccess })', () => {
  it('omits the success toast with silentSuccess and keeps it without the option', async () => {
    mocks.showToast.mockClear()
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7 } } })
    draw()
    act(() => { ui.handleChangeScheduleState(SCHEDULE) })
    let result
    await act(async () => { result = await ui.handleUpdateSchedule({ inlineError: true, silentSuccess: true }) })
    expect(result).toEqual({ ok: true })
    expect(mocks.showToast).not.toHaveBeenCalled()
    act(() => { ui.handleChangeScheduleState(SCHEDULE) })
    await act(async () => { await ui.handleUpdateSchedule({ inlineError: true }) })
    expect(mocks.showToast).toHaveBeenCalledWith('success', 'Schedule updated')
  })

  it('still reports errors with silentSuccess', async () => {
    mocks.showToast.mockClear()
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Bad schedule'] } })
    draw()
    act(() => { ui.handleChangeScheduleState(SCHEDULE) })
    let result
    await act(async () => { result = await ui.handleUpdateSchedule({ silentSuccess: true }) })
    expect(result).toEqual({ ok: false, error: ['Bad schedule'] })
    expect(mocks.showToast).toHaveBeenCalledWith('error', 'Bad schedule')
  })
})
