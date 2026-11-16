/* eslint-disable import/first */
// redesign (B1a): the Schedule section of a professional's record. The UIComponent is mounted with a fake controller
// (a stateful host that keeps `changes` the way K/ProfessionalSchedule does); the Product wrappers (RadioGroup, NumberField,
// ScheduleEditor, Button, AlertDialog) are the real ones. NOTHING here reaches a server.
import React, { useState } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  controllerProps: null,
  changeItem: null,
  removeKey: null,
  updateClick: null
}))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../contexts/UtilsContext', () => ({
  useUtils: () => [{ parseDate: () => 'Oct 12, 2026' }]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  ProfessionalSchedule: (props) => {
    mocks.controllerProps = props
    return <div data-testid='controller' />
  }
}))

import { ProfessionalScheduleSection, ProfessionalScheduleSectionUI } from '../ProfessionalScheduleSection'

const lapse = () => ({ open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } })
const week = () => Array.from({ length: 7 }, () => ({ enabled: true, lapses: [lapse()] }))

const professional = (extra = {}) => ({ id: 41, name: 'Dana', schedule: week(), max_days_in_future: 7, ...extra })

// The controller, as far as the section needs it: `changes` accumulate, `loading` and `result` are given by the test
const Host = ({ user = professional(), changes: initialChanges = {}, loading = false, result = { error: false }, onDirtyChange }) => {
  const [changes, setChanges] = useState(initialChanges)
  const handleChangeItem = (next) => {
    mocks.changeItem(next)
    setChanges(previous => ({ ...previous, ...next }))
  }
  const handleRemoveKey = (key) => {
    mocks.removeKey(key)
    setChanges(({ [key]: _gone, ...rest }) => rest)
  }
  return (
    <ProfessionalScheduleSectionUI
      user={user}
      onDirtyChange={onDirtyChange}
      formState={{ loading, changes, result }}
      handleChangeItem={handleChangeItem}
      handleRemoveKey={handleRemoveKey}
      handleUpdateClick={mocks.updateClick}
    />
  )
}

const days = () => screen.getByRole('radio', { name: 'days into the future' })
const indefinitely = () => screen.getByRole('radio', { name: 'Indefinitely into the future' })
// P/NumberField paints a text input with a numeric keyboard (its role is textbox, not spinbutton)
const number = () => screen.getByRole('textbox', { name: 'days into the future' })
const save = () => screen.getByRole('button', { name: 'Save' })
const toggleDay = (name) => screen.getByRole('switch', { name: `Schedule: ${name}` })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.changeItem = vi.fn()
  mocks.removeKey = vi.fn()
  mocks.updateClick = vi.fn()
  mocks.controllerProps = null
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('the date range', () => {
  it('is a named radio group with the visible explanation of main', () => {
    render(<Host />)
    expect(screen.getByRole('radiogroup', { name: 'Date range' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Date range' })).toBeInTheDocument()
    expect(screen.getByText('Customers can schedule...')).toBeVisible()
    expect(screen.getByRole('radiogroup', { name: 'Date range' })).toHaveAccessibleDescription('Customers can schedule...')
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('starts on «days» with the number when the professional has one (0 included)', () => {
    render(<Host user={professional({ max_days_in_future: 7 })} />)
    expect(days()).toHaveAttribute('aria-checked', 'true')
    expect(indefinitely()).toHaveAttribute('aria-checked', 'false')
    expect(number()).toBeEnabled()
    expect(number()).toHaveValue('7')
    cleanup()
    render(<Host user={professional({ max_days_in_future: 0 })} />)
    expect(days()).toHaveAttribute('aria-checked', 'true')
    expect(number()).toHaveValue('0')
  })

  it('starts on «Indefinitely» when there is no number, with the number disabled and empty', () => {
    for (const value of [null, undefined]) {
      render(<Host user={professional({ max_days_in_future: value })} />)
      expect(indefinitely()).toHaveAttribute('aria-checked', 'true')
      expect(days()).toHaveAttribute('aria-checked', 'false')
      expect(number()).toBeDisabled()
      expect(number()).toHaveValue('')
      cleanup()
    }
  })

  it('choosing «Indefinitely» sends max_days_in_future: null and disables the number', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(indefinitely())
    expect(mocks.changeItem).toHaveBeenCalledTimes(1)
    expect(mocks.changeItem).toHaveBeenCalledWith({ max_days_in_future: null })
    expect(indefinitely()).toHaveAttribute('aria-checked', 'true')
    expect(number()).toBeDisabled()
  })

  it('choosing «days» changes nothing until a number is typed', async () => {
    const user = userEvent.setup()
    render(<Host user={professional({ max_days_in_future: null })} />)
    await user.click(days())
    expect(days()).toHaveAttribute('aria-checked', 'true')
    expect(number()).toBeEnabled()
    expect(mocks.changeItem).not.toHaveBeenCalled()
    await user.type(number(), '30')
    expect(mocks.changeItem).toHaveBeenLastCalledWith({ max_days_in_future: 30 })
  })

  it('the number only takes digits and sends a whole number', async () => {
    const user = userEvent.setup()
    render(<Host user={professional({ max_days_in_future: null })} />)
    await user.click(days())
    await user.type(number(), 'a1b-2.')
    expect(number()).toHaveValue('12')
    for (const [call] of mocks.changeItem.mock.calls) {
      expect(Number.isInteger(call.max_days_in_future)).toBe(true)
      expect(call.max_days_in_future).toBeGreaterThanOrEqual(0)
    }
    expect(mocks.changeItem).toHaveBeenLastCalledWith({ max_days_in_future: 12 })
  })

  it('emptying the number goes back to what is stored instead of sending nothing useful', async () => {
    const user = userEvent.setup()
    render(<Host user={professional({ max_days_in_future: 5 })} />)
    await user.clear(number())
    expect(mocks.removeKey).toHaveBeenCalledWith('max_days_in_future')
    expect(save()).toBeDisabled()
  })

  it('going back to «days» after «Indefinitely» brings the number back and keeps the change in step with it', async () => {
    const user = userEvent.setup()
    render(<Host user={professional({ max_days_in_future: 5 })} />)
    await user.click(indefinitely())
    expect(save()).toBeEnabled()
    await user.click(days())
    expect(number()).toHaveValue('5')
    expect(mocks.changeItem).toHaveBeenLastCalledWith({ max_days_in_future: 5 })
    expect(save()).toBeDisabled()
  })
})

describe('the weekly schedule', () => {
  it('draws the Product editor with the professional\'s week', () => {
    render(<Host />)
    expect(document.querySelector('[data-slot="schedule-editor"]')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="schedule-day"]')).toHaveLength(7)
    expect(toggleDay('Sunday')).toHaveAttribute('aria-checked', 'true')
    // no dates beside the days: this is a weekly pattern, not a calendar
    expect(document.querySelector('.odc-sched-date')).toBeNull()
  })

  it('a change in the editor is sent as { schedule } with the whole week', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(toggleDay('Monday'))
    const call = mocks.changeItem.mock.calls.find(([next]) => 'schedule' in next)[0]
    expect(call.schedule).toHaveLength(7)
    expect(call.schedule[1].enabled).toBe(false)
    expect(call.schedule[0].enabled).toBe(true)
  })
})

describe('Save and the draft', () => {
  it('is disabled with no changes', () => {
    render(<Host />)
    expect(save()).toBeDisabled()
  })

  it('stays disabled when the editor only handed back the same schedule or the same days', () => {
    const user = professional({ max_days_in_future: 7 })
    render(<Host user={user} changes={{ schedule: week(), max_days_in_future: 7 }} />)
    expect(save()).toBeDisabled()
  })

  it('is enabled with a real change of days or of schedule', () => {
    const view = render(<Host changes={{ max_days_in_future: 9 }} />)
    expect(save()).toBeEnabled()
    view.unmount()
    const changed = week()
    changed[2].enabled = false
    render(<Host changes={{ schedule: changed }} />)
    expect(save()).toBeEnabled()
  })

  it('is enabled by «Indefinitely» on a professional that had a number', () => {
    render(<Host changes={{ max_days_in_future: null }} />)
    expect(save()).toBeEnabled()
  })

  it('tells the host when the draft appears and when it goes away, only when it changes', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<Host onDirtyChange={onDirtyChange} />)
    expect(onDirtyChange).not.toHaveBeenCalled()
    await user.click(indefinitely())
    expect(onDirtyChange).toHaveBeenCalledTimes(1)
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(days())
    expect(onDirtyChange).toHaveBeenCalledTimes(2)
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('a schedule change that is undone in the editor is no draft', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<Host onDirtyChange={onDirtyChange} />)
    await user.click(toggleDay('Monday'))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(save()).toBeEnabled()
    await user.click(toggleDay('Monday'))
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    expect(onDirtyChange).toHaveBeenCalledTimes(2)
    expect(save()).toBeDisabled()
  })

  it('says it is clean when it goes away with a draft', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const view = render(<Host onDirtyChange={onDirtyChange} />)
    await user.click(indefinitely())
    view.unmount()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  // live check: a professional with no stored schedule (`null`, the API's answer for one that never saved it) gets main's
  // default week from the editor on mount. That fill is no draft (closing the record must not ask to discard), but Save stays available
  // to store the week on screen, as main's Save was
  it('the default week the editor fills in for a professional with no schedule is no draft, and Save can still store it', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<Host user={professional({ schedule: null })} onDirtyChange={onDirtyChange} />)
    // the editor handed the default week over on mount
    expect(mocks.changeItem.mock.calls.some(([next]) => 'schedule' in next)).toBe(true)
    expect(onDirtyChange).not.toHaveBeenCalled()
    expect(save()).toBeEnabled()
    // a real change on top of it is a draft
    await user.click(toggleDay('Monday'))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  // review r1 #1: the SDK turns the draft's schedule into text IN PLACE while it saves (Ordering.js:355-358). The editor must keep
  // drawing the seven days (not one row per character) and nothing is handed back row by row
  it('a draft whose schedule the save turned into text still draws seven days and sends nothing back', () => {
    const changed = week()
    changed[1].lapses[0].close.hour = 18
    render(<Host changes={{ schedule: JSON.stringify(changed) }} loading />)
    expect(document.querySelectorAll('[data-slot="schedule-day"]')).toHaveLength(7)
    expect(mocks.changeItem.mock.calls.some(([next]) => 'schedule' in next)).toBe(false)
  })

  it('a stored schedule that comes as text is read as the week (seven days, no draft)', () => {
    const onDirtyChange = vi.fn()
    render(<Host user={professional({ schedule: JSON.stringify(week()) })} onDirtyChange={onDirtyChange} />)
    expect(document.querySelectorAll('[data-slot="schedule-day"]')).toHaveLength(7)
    expect(onDirtyChange).not.toHaveBeenCalled()
    expect(save()).toBeDisabled()
  })

  it('calls the controller\'s update once when pressed', async () => {
    const user = userEvent.setup()
    render(<Host changes={{ max_days_in_future: 9 }} />)
    await user.click(save())
    expect(mocks.updateClick).toHaveBeenCalledTimes(1)
    expect(mocks.updateClick).toHaveBeenCalledWith()
  })

  it('while it saves the button is busy and a second press does nothing', async () => {
    const user = userEvent.setup()
    render(<Host changes={{ max_days_in_future: 9 }} loading />)
    expect(save()).toHaveAttribute('aria-busy', 'true')
    await user.click(save())
    expect(mocks.updateClick).not.toHaveBeenCalled()
  })
})

describe('a save that fails', () => {
  it('says what the server answered, in an alert dialog', () => {
    render(<Host changes={{ max_days_in_future: 9 }} result={['Max days is invalid']} />)
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('Max days is invalid')).toBeInTheDocument()
  })

  it('says it when the request itself failed', () => {
    render(<Host changes={{ max_days_in_future: 9 }} result={{ error: true, result: 'Network down' }} />)
    expect(within(screen.getByRole('alertdialog')).getByText('Network down')).toBeInTheDocument()
  })

  it('has its own words when there is no message', () => {
    render(<Host changes={{ max_days_in_future: 9 }} result={{ error: true }} />)
    expect(within(screen.getByRole('alertdialog')).getByText("We couldn't save the schedule. Try again.")).toBeInTheDocument()
  })

  it('closes with OK and keeps the draft', async () => {
    const user = userEvent.setup()
    render(<Host changes={{ max_days_in_future: 9 }} result={['Max days is invalid']} />)
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'OK' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(save()).toBeEnabled()
  })

  it('says nothing after a good save or before saving', () => {
    render(<Host result={{ id: 41, max_days_in_future: 9 }} />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    cleanup()
    render(<Host result={{ error: false }} />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('ProfessionalScheduleSection', () => {
  it('mounts the controller with this UI, the user, and the host\'s callbacks, once per professional', () => {
    const handleSuccessUpdate = vi.fn()
    const onDirtyChange = vi.fn()
    const user = professional()
    render(<ProfessionalScheduleSection user={user} handleSuccessUpdate={handleSuccessUpdate} onDirtyChange={onDirtyChange} />)
    expect(screen.getByTestId('controller')).toBeInTheDocument()
    expect(mocks.controllerProps.UIComponent).toBe(ProfessionalScheduleSectionUI)
    expect(mocks.controllerProps.user).toBe(user)
    expect(mocks.controllerProps.handleSuccessUpdate).toBe(handleSuccessUpdate)
    expect(mocks.controllerProps.onDirtyChange).toBe(onDirtyChange)
  })
})

describe('the styles', () => {
  // the rules, not the comments (a comment may name the value it explains)
  const css = readFileSync(resolve(__dirname, '../professional-schedule.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

  it('only take colors and sizes from the tokens', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\brgba?\(/)
    expect(css).not.toMatch(/:\s*-?\d*\.?\d+(px|rem|em)\b/)
  })

  it('use logical properties only', () => {
    expect(css).not.toMatch(/\b(margin|padding)-(left|right|top|bottom)\b/)
    expect(css).not.toMatch(/(^|[\s{;])(left|right|width|height)\s*:/)
  })
})
