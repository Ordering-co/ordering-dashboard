// redesign SL-F3 (C): Product ScheduleEditor — the UIComponent of the Schedule controller, with the capabilities of the legacy Schedule.
/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  hourFormat: 'HH:mm',
  parseDate: null,
  forced: null
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: { general_hour_format: { value: runtime.hourFormat } } }]
}))
vi.mock('../../../../../../contexts/UtilsContext', () => ({
  useUtils: () => [{ parseDate: (...args) => runtime.parseDate(...args) }]
}))
// The real controller, unless a test forces props on the UI (the manual-add row has no way in through the controller's state).
vi.mock('../../../../../../components/Schedule', async (importOriginal) => {
  const actual = await importOriginal()
  const Schedule = (props) => {
    if (!runtime.forced) return <actual.Schedule {...props} />
    const { UIComponent } = props
    const Forced = uiProps => <UIComponent {...uiProps} {...runtime.forced} />
    return <actual.Schedule {...props} UIComponent={Forced} />
  }
  return { ...actual, Schedule }
})

import { ScheduleEditor } from '../ScheduleEditor'

const css = readFileSync(path.join(__dirname, '..', 'schedule-editor.css'), 'utf8')

const LABELS = {
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  daysAbbreviated: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  schedule: 'Schedule',
  open: 'Open',
  close: 'Close',
  hour: 'Hour',
  minute: 'Minute',
  am: 'AM',
  pm: 'PM',
  unavailable: 'Unavailable',
  addHours: 'Add hours',
  copyHours: 'Copy hours to…',
  copyTitle: 'Copy times to',
  apply: 'Apply',
  cancel: 'Cancel',
  delete: 'Delete',
  deleteQuestion: 'Are you sure to delete this Schedule?',
  accept: 'Accept',
  conflict: 'There is an schedule conflict',
  endTimeLater: 'Choose an end time later than the start time.'
}

const lapse = (openHour, openMinute, closeHour, closeMinute) => ({
  open: { hour: openHour, minute: openMinute },
  close: { hour: closeHour, minute: closeMinute }
})

const week = () => [
  { enabled: true, lapses: [lapse(9, 0, 10, 0), lapse(12, 0, 13, 0)] },
  { enabled: true, lapses: [lapse(8, 30, 9, 30)] },
  { enabled: false, lapses: [lapse(9, 0, 10, 0)] },
  { enabled: true, lapses: [lapse(9, 0, 10, 0)] },
  { enabled: true, lapses: [lapse(9, 0, 10, 0)] },
  { enabled: true, lapses: [lapse(9, 0, 10, 0)] },
  { enabled: true, lapses: [lapse(9, 0, 10, 0)] }
]

const setup = (props = {}) => {
  const handleChangeScheduleState = vi.fn()
  const view = render(
    <ScheduleEditor
      scheduleList={week()}
      handleChangeScheduleState={handleChangeScheduleState}
      labels={LABELS}
      {...props}
    />
  )
  const lastState = () => handleChangeScheduleState.mock.calls.at(-1)?.[0]
  return { ...view, handleChangeScheduleState, lastState }
}

beforeEach(() => {
  runtime.hourFormat = 'HH:mm'
  runtime.parseDate = vi.fn(() => '14 Sep 2026')
  runtime.forced = null
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {})

describe('Product ScheduleEditor labels (SL-F3 C)', () => {
  it.each(['schedule', 'open', 'close', 'hour', 'minute', 'am', 'pm', 'unavailable', 'addHours', 'copyHours', 'copyTitle',
    'apply', 'cancel', 'delete', 'deleteQuestion', 'accept', 'conflict', 'endTimeLater'])('throws without a %s', (name) => {
    const labels = { ...LABELS }
    delete labels[name]
    const error = quiet()
    try {
      expect(() => setup({ labels })).toThrow(`ScheduleEditor needs a label ${name}`)
    } finally {
      error.mockRestore()
    }
  })

  it('throws without labels, without seven days, and without abbreviations when they are asked for', () => {
    const error = quiet()
    try {
      expect(() => setup({ labels: undefined })).toThrow('ScheduleEditor needs labels')
      expect(() => setup({ labels: { ...LABELS, days: LABELS.days.slice(1) } })).toThrow('ScheduleEditor needs seven labels.days')
      const { daysAbbreviated, ...withoutAbbreviations } = LABELS
      expect(() => setup({ labels: withoutAbbreviations, useDaysAbbrevation: true })).toThrow('ScheduleEditor needs seven labels.daysAbbreviated')
      expect(() => setup({ labels: withoutAbbreviations })).not.toThrow()
    } finally {
      error.mockRestore()
    }
  })

  it('paints an empty label empty instead of throwing (a project translation can be empty)', () => {
    setup({ labels: { ...LABELS, unavailable: '' } })
    expect(document.querySelector('.odc-sched-off')).toHaveTextContent('')
  })
})

describe('Product ScheduleEditor rows (SL-F3 C)', () => {
  it('draws one row per day with its switch, in the order Sunday to Saturday', () => {
    setup()
    const days = document.querySelectorAll('[data-slot="schedule-day"]')
    expect(days).toHaveLength(7)
    expect(screen.getByRole('group', { name: 'Sunday' })).toHaveAttribute('data-day', '0')
    expect(screen.getByRole('switch', { name: 'Schedule: Sunday' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Schedule: Tuesday' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('passes the open switch to the controller: the day state changes', async () => {
    const user = userEvent.setup()
    const { lastState } = setup()
    await user.click(screen.getByRole('switch', { name: 'Schedule: Sunday' }))
    expect(lastState()[0].enabled).toBe(false)
    expect(screen.getByRole('switch', { name: 'Schedule: Sunday' })).toHaveAttribute('aria-checked', 'false')
    await user.click(screen.getByRole('switch', { name: 'Schedule: Tuesday' }))
    expect(lastState()[2].enabled).toBe(true)
  })

  it('draws four named native selects per lapse, with the lapse values', () => {
    setup()
    const names = ['Open Hour', 'Open Minute', 'Close Hour', 'Close Minute']
    const values = ['9', '0', '10', '0']
    names.forEach((name, i) => {
      const select = screen.getByRole('combobox', { name: `Sunday ${name} 1` })
      expect(select.tagName).toBe('SELECT')
      expect(select).toHaveValue(values[i])
    })
    expect(screen.getByRole('combobox', { name: 'Sunday Open Hour 2' })).toHaveValue('12')
    expect(screen.getByRole('combobox', { name: 'Monday Open Minute 1' })).toHaveValue('30')
  })

  it('sends hour and minute separately to the controller, as the legacy Schedule did', async () => {
    const user = userEvent.setup()
    const { lastState } = setup()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Open Hour 1' }), '7')
    expect(lastState()[1].lapses[0]).toEqual(lapse(7, 30, 9, 30))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Open Minute 1' }), '15')
    expect(lastState()[1].lapses[0]).toEqual(lapse(7, 15, 9, 30))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Close Hour 1' }), '18')
    expect(lastState()[1].lapses[0]).toEqual(lapse(7, 15, 18, 30))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Monday Close Minute 1' }), '45')
    expect(lastState()[1].lapses[0]).toEqual(lapse(7, 15, 18, 45))
  })

  it('lists 24 hours as 00-23 and 60 minutes as 00-59 in 24 hours', () => {
    setup()
    const hour = screen.getByRole('combobox', { name: 'Sunday Open Hour 1' })
    const options = within(hour).getAllByRole('option')
    expect(options).toHaveLength(24)
    expect(options[0]).toHaveTextContent('00')
    expect(options[13]).toHaveTextContent('13')
    const minute = screen.getByRole('combobox', { name: 'Sunday Open Minute 1' })
    expect(within(minute).getAllByRole('option')).toHaveLength(60)
    expect(within(minute).getAllByRole('option')[5]).toHaveTextContent('05')
  })

  it('lists the hours with AM and PM when configs.general_hour_format is 12 hours, with the same values', async () => {
    runtime.hourFormat = 'hh:mm A'
    const user = userEvent.setup()
    const { lastState } = setup()
    const hour = screen.getByRole('combobox', { name: 'Sunday Open Hour 1' })
    const options = within(hour).getAllByRole('option')
    expect(options[0]).toHaveTextContent('12 AM')
    expect(options[9]).toHaveTextContent('9 AM')
    expect(options[12]).toHaveTextContent('12 PM')
    expect(options[13]).toHaveTextContent('1 PM')
    expect(options[13]).toHaveValue('13')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thursday Close Hour 1' }), '13')
    expect(lastState()[4].lapses[0].close.hour).toBe(13)
  })

  it('uses the abbreviations when useDaysAbbrevation is on', () => {
    setup({ useDaysAbbrevation: true })
    expect(screen.getByRole('group', { name: 'Sun' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Sun Open Hour 1' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Sunday' })).not.toBeInTheDocument()
  })

  it('shows the date of each day in the project format only with isShowDate', () => {
    const { unmount } = setup()
    expect(runtime.parseDate).not.toHaveBeenCalled()
    unmount()
    setup({ isShowDate: true })
    expect(runtime.parseDate).toHaveBeenCalledWith(expect.any(Date), { dateOnly: true })
    expect(screen.getAllByText('14 Sep 2026')).toHaveLength(7)
    expect(screen.getAllByText('14 Sep 2026')[0]).toHaveClass('odc-figure')
  })

  it('keeps the selects editable but hides the switch and every action with disableSchedule', async () => {
    const user = userEvent.setup()
    const { lastState } = setup({ disableSchedule: true })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-schedule-action]')).toHaveLength(0)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sunday Open Minute 1' }), '5')
    expect(lastState()[0].lapses[0].open.minute).toBe(5)
  })
})

describe('Product ScheduleEditor lapses (SL-F3 C)', () => {
  it('adds a lapse in a free slot with Add hours, named by day', async () => {
    const user = userEvent.setup()
    const { lastState } = setup()
    await user.click(screen.getByRole('button', { name: 'Add hours: Monday' }))
    expect(lastState()[1].lapses).toHaveLength(2)
    expect(lastState()[1].lapses[0]).toEqual(lapse(0, 0, 8, 29))
    expect(screen.getByRole('combobox', { name: 'Monday Open Hour 2' })).toBeInTheDocument()
  })

  it('does not offer Add hours or Copy hours for a closed day', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Add hours: Tuesday' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Copy hours to…: Tuesday' })).toBeDisabled()
  })

  it('offers delete only when the day has more than one lapse, and asks first', async () => {
    const user = userEvent.setup()
    const { lastState, handleChangeScheduleState } = setup()
    expect(screen.queryByRole('button', { name: 'Delete Schedule: Monday 1' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete Schedule: Sunday 1' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Are you sure to delete this Schedule?' })
    expect(dialog).toHaveTextContent('Sunday')
    expect(dialog).toHaveTextContent('09:00 – 10:00')
    expect(handleChangeScheduleState).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(lastState()[0].lapses).toEqual([lapse(12, 0, 13, 0)])
  })

  it('keeps the lapse when the delete is cancelled', async () => {
    const user = userEvent.setup()
    const { handleChangeScheduleState } = setup()
    await user.click(screen.getByRole('button', { name: 'Delete Schedule: Sunday 2' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(handleChangeScheduleState).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: 'Sunday Open Hour 2' })).toBeInTheDocument()
  })

  it('draws the manual add row of the controller with apply and cancel, and routes them', async () => {
    const user = userEvent.setup()
    const handlers = {
      handleAddSchedule: vi.fn(),
      handleOpenAddSchedule: vi.fn(),
      handleChangeAddScheduleTime: vi.fn()
    }
    runtime.forced = {
      ...handlers,
      openAddSchedule: { 0: true },
      addScheduleTime: lapse(14, 15, 15, 45)
    }
    setup()
    const manualHour = screen.getByRole('combobox', { name: 'Sunday Open Hour' })
    expect(manualHour).toHaveValue('14')
    expect(manualHour).toHaveAttribute('data-lapse', 'manual')
    await user.selectOptions(manualHour, '16')
    expect(handlers.handleChangeAddScheduleTime).toHaveBeenCalledWith(16, true, 'hour')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sunday Close Minute' }), '50')
    expect(handlers.handleChangeAddScheduleTime).toHaveBeenCalledWith(50, false, 'minute')
    await user.click(screen.getByRole('button', { name: 'Apply Schedule: Sunday' }))
    expect(handlers.handleAddSchedule).toHaveBeenCalledWith(0)
    await user.click(screen.getByRole('button', { name: 'Cancel Schedule: Sunday' }))
    expect(handlers.handleOpenAddSchedule).toHaveBeenCalledWith(null)
  })
})

describe('Product ScheduleEditor copy hours (SL-F3 C)', () => {
  it('opens a dialog with the seven days, the source checked and disabled, and starts from no destination', async () => {
    const user = userEvent.setup()
    const cleanSelectedCopyDays = vi.fn()
    runtime.forced = { cleanSelectedCopyDays }
    setup()
    expect(cleanSelectedCopyDays).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Copy hours to…: Sunday' }))
    const dialog = await screen.findByRole('dialog', { name: 'Copy times to' })
    expect(cleanSelectedCopyDays).toHaveBeenCalledTimes(1)
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(7)
    const source = within(dialog).getByRole('checkbox', { name: 'Sunday' })
    expect(source).toBeDisabled()
    expect(source).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByRole('checkbox', { name: 'Monday' })).toHaveAttribute('aria-checked', 'false')
  })

  it('copies the lapses of the day to the chosen days and closes', async () => {
    const user = userEvent.setup()
    const { lastState } = setup()
    await user.click(screen.getByRole('button', { name: 'Copy hours to…: Sunday' }))
    const dialog = await screen.findByRole('dialog', { name: 'Copy times to' })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Monday' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Wednesday' }))
    expect(within(dialog).getByRole('checkbox', { name: 'Monday' })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))
    expect(lastState()[1].lapses).toEqual([lapse(9, 0, 10, 0), lapse(12, 0, 13, 0)])
    expect(lastState()[3].lapses).toEqual([lapse(9, 0, 10, 0), lapse(12, 0, 13, 0)])
    expect(lastState()[4].lapses).toEqual([lapse(9, 0, 10, 0)])
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Copy times to' })).not.toBeInTheDocument())
  })

  it('changes nothing when the copy dialog is cancelled, and starts clean the next time', async () => {
    const user = userEvent.setup()
    const { handleChangeScheduleState } = setup()
    await user.click(screen.getByRole('button', { name: 'Copy hours to…: Sunday' }))
    let dialog = await screen.findByRole('dialog', { name: 'Copy times to' })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Friday' }))
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Copy times to' })).not.toBeInTheDocument())
    expect(handleChangeScheduleState).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Copy hours to…: Sunday' }))
    dialog = await screen.findByRole('dialog', { name: 'Copy times to' })
    expect(within(dialog).getByRole('checkbox', { name: 'Friday' })).toHaveAttribute('aria-checked', 'false')
  })

  it('names the days in the dialog with copyDays when given', async () => {
    const user = userEvent.setup()
    setup({ labels: { ...LABELS, copyDays: LABELS.days.map(day => `${day}!`) } })
    await user.click(screen.getByRole('button', { name: 'Copy hours to…: Sunday' }))
    const dialog = await screen.findByRole('dialog', { name: 'Copy times to' })
    expect(within(dialog).getByRole('checkbox', { name: 'Monday!' })).toBeInTheDocument()
  })
})

describe('Product ScheduleEditor alerts (SL-F3 C)', () => {
  it('alerts an end time that is not later than the start, and the select goes back to its value', async () => {
    const user = userEvent.setup()
    const { handleChangeScheduleState } = setup()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sunday Open Hour 1' }), '11')
    const alert = await screen.findByRole('alertdialog')
    expect(alert).toHaveTextContent('Choose an end time later than the start time.')
    expect(handleChangeScheduleState).not.toHaveBeenCalled()
    // The page behind a dialog is aria-hidden; the controlled select is back on its value.
    expect(screen.getByRole('combobox', { name: 'Sunday Open Hour 1', hidden: true })).toHaveValue('9')
    await user.click(within(alert).getByRole('button', { name: 'Accept' }))
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('alerts a conflict between lapses of the same day and clears it on accept', async () => {
    const user = userEvent.setup()
    const { handleChangeScheduleState } = setup()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sunday Open Hour 2' }), '9')
    const alert = await screen.findByRole('alertdialog')
    expect(alert).toHaveTextContent('There is an schedule conflict')
    expect(handleChangeScheduleState).not.toHaveBeenCalled()
    await user.click(within(alert).getByRole('button', { name: 'Accept' }))
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    // Cleared: the same alert can open again.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sunday Open Hour 2' }), '9')
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('There is an schedule conflict')
  })
})

describe('Product ScheduleEditor sizes (SL-F3 C)', () => {
  it('draws 32px selects with 16px text and a 44px area under 768px, from tokens only', () => {
    expect(css).toMatch(/\.odc-sched-select\s*\{[^}]*block-size: var\(--od-x-control-height\)/)
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{[^@]*\.odc-sched-select \{ font-size: var\(--od-x-type-lead-size\)/)
    expect(css).toMatch(/\.odc-sched-time::after\s*\{[^}]*inset: var\(--od-x-target-inset\)/)
    // the rows that stack the 44px areas sit >= 12px apart on the dashboard's 14px root, under the reach's own query.
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{[^@]*\.odc-sched-day \{ row-gap: var\(--od-x-space-3-5\); \}/)
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{[^@]*\.odc-sched-lapses \{ gap: var\(--od-x-space-3-5\); \}/)
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{[^@]*\.odc-sched-lapse \{ row-gap: var\(--od-x-space-3-5\); \}/)
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*/g, '')).not.toMatch(/\d(px|rem|em)\b/)
  })

  it('wraps the selects in a frame that focuses the select on a press outside it (the 44px area)', async () => {
    setup()
    const select = screen.getByRole('combobox', { name: 'Sunday Open Hour 1' })
    const frame = select.parentElement
    expect(frame).toHaveClass('odc-sched-time')
    // the touch criterion (e2e/touch-target.js) takes this frame only while it holds exactly one control.
    const frames = document.querySelectorAll('.odc-sched-time')
    expect(frames.length).toBeGreaterThan(0)
    frames.forEach(each => expect(each.querySelectorAll('input, select, textarea')).toHaveLength(1))
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    frame.dispatchEvent(event)
    expect(select).toHaveFocus()
  })
})
