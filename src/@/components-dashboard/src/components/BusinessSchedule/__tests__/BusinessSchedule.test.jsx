/* eslint-disable import/first */
// redesign stores 1.A (G2-28): a schedule the API rejected set `result.error: false`, and the request that threw
// said nothing: the store editor showed "Loading" and then nothing. Now both say the API message, translated, the changes stay
// pending and the handler returns `{ ok: false, error }`; a schedule that is saved returns `{ ok: true }` as before.
import React from 'react'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  showToast: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ businesses: () => ({ save: mocks.save }) }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, text) => ({ INVALID_SCHEDULE: 'Horario no válido' }[key] ?? text)]
}))

import { BusinessSchedule } from '../index'

const SCHEDULE = [{ enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 18, minute: 0 } }] }]

let ui
const draw = (props = {}) => {
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  render(<BusinessSchedule UIComponent={UI} business={{ id: 7 }} {...props} />)
  act(() => { ui.handleChangeScheduleState(SCHEDULE) })
}

const toasts = () => mocks.showToast.mock.calls.map(([type, message]) => [type, message])

beforeEach(() => {
  mocks.save.mockReset()
  mocks.showToast.mockReset()
})

describe('BusinessSchedule controller · handleUpdateSchedule', () => {
  it('saves the schedule as JSON, says so and returns { ok: true }', async () => {
    const handleSuccessUpdate = vi.fn()
    mocks.save.mockResolvedValue({ content: { error: false, result: { id: 7 } } })
    draw({ handleSuccessUpdate })
    let result
    await act(async () => { result = await ui.handleUpdateSchedule() })
    expect(mocks.save).toHaveBeenCalledWith({ schedule: JSON.stringify(SCHEDULE) }, { accessToken: 'test-token' })
    expect(result).toEqual({ ok: true })
    expect(handleSuccessUpdate).toHaveBeenCalledWith({ id: 7 })
    expect(ui.formState.changes).toEqual({})
    expect(toasts()).toEqual([['info', 'Loading'], ['success', 'Schedule updated']])
  })

  it('a schedule the API rejects says why, stays pending and returns { ok: false, error }', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Invalid schedule'] } })
    draw()
    let result
    await act(async () => { result = await ui.handleUpdateSchedule() })
    expect(result).toEqual({ ok: false, error: ['Invalid schedule'] })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Horario no válido']])
    expect(ui.formState.changes).toEqual({ schedule: SCHEDULE })
    expect(ui.formState.result.error).toBe(true)
    expect(ui.formState.loading).toBe(false)
  })

  it('a request that throws says so and frees the form', async () => {
    mocks.save.mockRejectedValue(new Error('Network down'))
    draw()
    let result
    await act(async () => { result = await ui.handleUpdateSchedule() })
    expect(result).toEqual({ ok: false, error: ['Network down'] })
    expect(toasts()).toEqual([['info', 'Loading'], ['error', 'Network down']])
    expect(ui.formState.loading).toBe(false)
  })
})

// (P-3): K/Schedule now reports a week that went back to the saved one; the store has nothing pending then.
describe('BusinessSchedule controller · handleChangeScheduleState against the saved schedule', () => {
  const CHANGED = [{ enabled: false, lapses: SCHEDULE[0].lapses }]
  const drawSaved = () => {
    const UI = (uiProps) => {
      ui = uiProps
      return null
    }
    render(<BusinessSchedule UIComponent={UI} business={{ id: 7, schedule: SCHEDULE }} />)
  }

  it('a schedule that differs from the saved one is pending; the saved one again leaves nothing pending', () => {
    drawSaved()
    act(() => { ui.handleChangeScheduleState(CHANGED) })
    expect(ui.formState.changes).toEqual({ schedule: CHANGED })
    act(() => { ui.handleChangeScheduleState(JSON.parse(JSON.stringify(SCHEDULE))) })
    expect(ui.formState.changes).toEqual({})
  })

  it('a store without a saved schedule keeps the first report pending (the tutorial saves it)', () => {
    draw()
    expect(ui.formState.changes).toEqual({ schedule: SCHEDULE })
  })
})
