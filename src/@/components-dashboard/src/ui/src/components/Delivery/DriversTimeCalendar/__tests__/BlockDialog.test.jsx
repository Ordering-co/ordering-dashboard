/* eslint-disable import/first */
// redesign DT-B2 (decisions 12, 13 | DT-01, DT-03, DT-12, DT-14, DT-19, DT-22; auditor 8): the block dialog, add and edit. The real Product
// Dialog, Field, TextField, TextArea, DatePicker, Switch, RadioGroup and Checkbox; only the contexts are stand-ins (the default text of
// every key, the project's date and hour formats). The clock is faked (the date only) at Sunday 11 Oct 2026, 10:20.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ configs: {} }))

vi.mock('../../../../../../index', async () => {
  const dayjs = (await import('dayjs')).default
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
    useConfig: () => [{ configs: mockState.configs }],
    useUtils: () => [{
      parseDate: (date) => dayjs(String(date).slice(0, 10)).format('DD/MM/YYYY')
    }]
  }
})

import { BlockDialog } from '../BlockDialog'

const TODAY = '2026-10-11'
const FUTURE = '2026-10-20'
const driver = { id: 42, name: 'Carlos', lastname: 'Mendoza' }
// a block already in local time, with a break, that does not repeat
const block = {
  id: 7,
  name: 'Morning',
  description: 'Route north',
  start: `${FUTURE} 08:00:00`,
  end: `${FUTURE} 17:00:00`,
  break_start: `${FUTURE} 12:00:00`,
  break_end: `${FUTURE} 12:30:00`,
  rrule: null,
  until: null
}
const plainBlock = { ...block, break_start: null, break_end: null }
const weeklyBlock = { ...plainBlock, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE', until: '2026-11-30 23:59:59' }

beforeEach(() => {
  mockState.configs = { dates_general_format: { value: 'DD/MM/YYYY HH:mm' } }
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 11, 10, 20, 0))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.getElementById('app-modals')?.remove()
})

const setup = (props = {}) => {
  const spies = { onSubmit: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() }
  const view = render(
    <BlockDialog open mode='add' driver={driver} block={null} day={FUTURE} startTime='10:00' busy={false} {...spies} {...props} />
  )
  return { ...spies, ...view, user: userEvent.setup() }
}

const field = (name) => screen.getByRole('combobox', { name })
const values = (select) => within(select).getAllByRole('option').map(option => option.value)
const addButton = () => screen.getByRole('button', { name: 'Add' })
const saveButton = () => screen.getByRole('button', { name: 'Save' })

describe('BlockDialog · the driver and the title (DT-12)', () => {
  it('add: «Add new shift» and names the driver with the #id', async () => {
    setup()
    const dialog = await screen.findByRole('dialog', { name: 'Add new shift' })
    expect(dialog).toHaveTextContent('Carlos Mendoza · #42')
    expect(dialog.querySelector('.odc-overlay-desc .odc-figure')).toHaveTextContent('#42')
  })

  it('edit: «Edit shift» and names the driver', async () => {
    setup({ mode: 'edit', block: plainBlock })
    const dialog = await screen.findByRole('dialog', { name: 'Edit shift' })
    expect(dialog).toHaveTextContent('Carlos Mendoza · #42')
  })

  it('the close button asks onClose', async () => {
    const { user, onClose } = setup()
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('draws nothing while it has never been open', () => {
    render(<BlockDialog open={false} mode='add' onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('BlockDialog · the fields', () => {
  it('add starts empty: name, description, the pressed hour, 23:59 and the day', async () => {
    setup()
    await screen.findByRole('dialog')
    expect(screen.getByRole('textbox', { name: 'Shift Name' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Shift Name' })).toHaveAttribute('placeholder', 'Shift name (Optional)')
    expect(screen.getByRole('textbox', { name: 'Shift Description' })).toHaveAttribute('placeholder', 'Shift description (Optional)')
    expect(field('Start time')).toHaveValue('10:00')
    expect(field('End time')).toHaveValue('23:59')
    expect(field(/^Shift date/)).toHaveTextContent('20/10/2026')
    expect(screen.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Break' })).not.toBeChecked()
  })

  it('edit loads the block', async () => {
    setup({ mode: 'edit', block })
    await screen.findByRole('dialog')
    expect(screen.getByRole('textbox', { name: 'Shift Name' })).toHaveValue('Morning')
    expect(screen.getByRole('textbox', { name: 'Shift Description' })).toHaveValue('Route north')
    expect(field('Start time')).toHaveValue('08:00')
    expect(field('End time')).toHaveValue('17:00')
    expect(screen.getByRole('switch', { name: 'Break' })).toBeChecked()
    expect(field('Break start')).toHaveValue('12:00')
    expect(field('Break end')).toHaveValue('12:30')
  })

  it('the hours are .odc-figure nodes (decision 11)', async () => {
    setup()
    await screen.findByRole('dialog')
    expect(field('Start time')).toHaveClass('odc-figure')
    expect(field('End time')).toHaveClass('odc-figure')
  })

  it('starts again from the props each time it opens', async () => {
    const { user, rerender, onSubmit, onDelete, onClose } = setup()
    await user.type(await screen.findByRole('textbox', { name: 'Shift Name' }), 'Typed')
    rerender(<BlockDialog open={false} mode='add' driver={driver} block={null} day={FUTURE} startTime='10:00' onSubmit={onSubmit} onDelete={onDelete} onClose={onClose} />)
    rerender(<BlockDialog open mode='add' driver={driver} block={null} day={FUTURE} startTime='11:00' onSubmit={onSubmit} onDelete={onDelete} onClose={onClose} />)
    expect(await screen.findByRole('textbox', { name: 'Shift Name' })).toHaveValue('')
    expect(field('Start time')).toHaveValue('11:00')
  })
})

describe('BlockDialog · the hours (auditor 8)', () => {
  it('on a future day the select gives every quarter and 23:59, ordered', async () => {
    setup()
    await screen.findByRole('dialog')
    const options = values(field('Start time'))
    expect(options).toHaveLength(97)
    expect(options[0]).toBe('00:00')
    expect(options[1]).toBe('00:15')
    expect(options.at(-2)).toBe('23:45')
    expect(options.at(-1)).toBe('23:59')
  })

  it('today the hours that already passed are not offered: up to 10:20 nothing, 10:30 is the first', async () => {
    setup({ day: TODAY, startTime: null })
    await screen.findByRole('dialog')
    const options = values(field('Start time'))
    expect(options[0]).toBe('10:30')
    expect(options).not.toContain('09:45')
    expect(options).not.toContain('10:15')
    expect(options).not.toContain('10:20')
    expect(options.at(-1)).toBe('23:59')
    expect(field('Start time')).toHaveValue('10:30')
  })

  it('editing today adds the hours of the block, in their place', async () => {
    setup({ mode: 'edit', block: { ...block, start: `${TODAY} 08:00:00`, end: `${TODAY} 17:00:00`, break_start: `${TODAY} 12:00:00`, break_end: `${TODAY} 12:30:00` }, day: TODAY })
    await screen.findByRole('dialog')
    const options = values(field('Start time'))
    expect(options.slice(0, 3)).toEqual(['08:00', '10:30', '10:45'])
    expect(options).toContain('12:00')
    expect(options).not.toContain('09:00')
    expect(field('Start time')).toHaveValue('08:00')
  })

  it('a break that was not chosen yet shows «Choose a time»', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('switch', { name: 'Break' }))
    const breakStart = field('Break start')
    expect(breakStart).toHaveValue('')
    expect(within(breakStart).getByRole('option', { name: 'Choose a time' })).toBeDisabled()
    await user.selectOptions(breakStart, '12:00')
    expect(breakStart).toHaveValue('12:00')
  })

  it('a 12-hour project reads AM / PM', async () => {
    mockState.configs = { dates_general_format: { value: 'DD/MM/YYYY hh:mm a' }, general_hour_format: { value: 'hh:mm a' } }
    setup()
    await screen.findByRole('dialog')
    const select = field('Start time')
    expect(within(select).getByRole('option', { name: '12:00 AM' })).toHaveValue('00:00')
    expect(within(select).getByRole('option', { name: '01:15 PM' })).toHaveValue('13:15')
    expect(within(select).getByRole('option', { name: '11:59 PM' })).toHaveValue('23:59')
  })
})

describe('BlockDialog · the errors of the hours (DT-19, DT-22)', () => {
  it('an end before the start is said in the End field and Add is disabled with the reason linked', async () => {
    const { user } = setup()
    await screen.findByRole('dialog')
    expect(addButton()).toBeEnabled()
    await user.selectOptions(field('End time'), '09:00')
    const message = 'Choose an end time later than the start time.'
    expect(field('End time')).toBeInvalid()
    expect(field('End time')).toHaveAccessibleDescription(message)
    expect(field('Start time')).toBeValid()
    expect(addButton()).toBeDisabled()
    expect(addButton()).toHaveAccessibleDescription(/Fix the hours marked/)
  })

  it('fixing the hours enables Add again and the reason goes', async () => {
    const { user } = setup()
    await screen.findByRole('dialog')
    await user.selectOptions(field('End time'), '09:00')
    await user.selectOptions(field('End time'), '18:00')
    expect(field('End time')).toBeValid()
    expect(addButton()).toBeEnabled()
    expect(addButton()).not.toHaveAttribute('aria-describedby')
  })

  it('changing the start does not touch the end (the error shows, the value stays)', async () => {
    const { user } = setup()
    await screen.findByRole('dialog')
    await user.selectOptions(field('End time'), '12:00')
    await user.selectOptions(field('Start time'), '15:00')
    expect(field('End time')).toHaveValue('12:00')
    expect(field('End time')).toBeInvalid()
    expect(addButton()).toBeDisabled()
  })

  it('a break needs its hours: with the switch on and no hours both fields say so', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('switch', { name: 'Break' }))
    expect(field('Break start')).toHaveAccessibleDescription('Choose a break start time later than the start times and earlier than end/break end times.')
    expect(field('Break end')).toHaveAccessibleDescription('Choose a break end time later than the start/break start time and earlier than end time.')
    expect(addButton()).toBeDisabled()
    await user.selectOptions(field('Break start'), '12:00')
    await user.selectOptions(field('Break end'), '12:30')
    expect(field('Break start')).toBeValid()
    expect(field('Break end')).toBeValid()
    expect(addButton()).toBeEnabled()
  })

  it('edit: Save is disabled with the reason when the hours are wrong', async () => {
    const { user } = setup({ mode: 'edit', block: plainBlock })
    await screen.findByRole('dialog')
    await user.selectOptions(field('End time'), '07:00')
    expect(saveButton()).toBeDisabled()
    expect(saveButton()).toHaveAccessibleDescription(/Fix the hours marked/)
  })
})

describe('BlockDialog · the break in edit (as main, DriverBlockAddForm:119)', () => {
  it('a block that has a break cannot have it switched off', async () => {
    setup({ mode: 'edit', block })
    expect(await screen.findByRole('switch', { name: 'Break' })).toBeDisabled()
  })

  it('a block without a break can get one', async () => {
    const { user } = setup({ mode: 'edit', block: plainBlock })
    const toggle = await screen.findByRole('switch', { name: 'Break' })
    expect(toggle).toBeEnabled()
    await user.click(toggle)
    expect(field('Break start')).toBeInTheDocument()
  })

  it('add can switch it on and off', async () => {
    const { user } = setup()
    const toggle = await screen.findByRole('switch', { name: 'Break' })
    await user.click(toggle)
    expect(field('Break end')).toBeInTheDocument()
    await user.click(toggle)
    expect(screen.queryByRole('combobox', { name: 'Break end' })).toBeNull()
  })
})

describe('BlockDialog · the repetition (DT-03, DT-14)', () => {
  // review r1 R-03: a later Until, so the line describes a series that repeats
  const pickUntil = async (user, digits) => {
    await user.click(screen.getByRole('combobox', { name: /^Until date/ }))
    const picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.clear(within(picker).getByRole('textbox'))
    await user.type(within(picker).getByRole('textbox'), `${digits}{Enter}`)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
  }

  it('None hides the days, Until and the line', async () => {
    setup()
    await screen.findByRole('dialog')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('combobox', { name: /^Until date/ })).toBeNull()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('Weekly shows seven days from Sunday, Until (add) and says what it does', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('radio', { name: 'Weekly' }))
    const group = screen.getByRole('group', { name: 'By week day' })
    expect(within(group).getAllByRole('checkbox').map(box => box.textContent)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    // a new repetition starts with Until one month after the block's day, so it repeats
    expect(screen.getByRole('combobox', { name: /^Until date/ })).toHaveTextContent('20/11/2026')
    expect(screen.getByRole('status')).toHaveTextContent('Repeats every week until 20/11/2026')
    await pickUntil(user, '03112026')
    expect(screen.getByRole('status')).toHaveTextContent('Repeats every week until 03/11/2026')
  })

  // the default moves Until, but the user can still put it back on the shift's day, and the line then says it will not repeat
  it('Until picked on the block day still says it will not repeat (review r1 R-03)', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('radio', { name: 'Weekly' }))
    await pickUntil(user, '20102026')
    expect(screen.getByRole('combobox', { name: /^Until date/ })).toHaveTextContent('20/10/2026')
    expect(screen.getByRole('status')).toHaveTextContent("With «Until» on the shift's day, it will not repeat.")
  })

  it('Daily also starts a month out, and an Until the user picked survives a change of frequency', async () => {
    const { user, onSubmit } = setup()
    await user.click(await screen.findByRole('radio', { name: 'Daily' }))
    expect(screen.getByRole('combobox', { name: /^Until date/ })).toHaveTextContent('20/11/2026')
    await pickUntil(user, '03112026')
    await user.click(screen.getByRole('radio', { name: 'Weekly' }))
    expect(screen.getByRole('combobox', { name: /^Until date/ })).toHaveTextContent('03/11/2026')
    await user.click(addButton())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ freq: 'weekly', untilDay: '2026-11-03' })
  })

  it('the days wrap onto the next line instead of overflowing (a class; the width is not measured here)', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('radio', { name: 'Daily' }))
    expect(screen.getByRole('group', { name: 'By week day' })).toHaveClass('odc-bd-days')
  })

  it('marking days writes them in the line, short names, in week order', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('radio', { name: 'Weekly' }))
    await user.click(screen.getByRole('checkbox', { name: 'Wed' }))
    await user.click(screen.getByRole('checkbox', { name: 'Mon' }))
    expect(screen.getByRole('checkbox', { name: 'Mon' })).toBeChecked()
    await pickUntil(user, '03112026')
    expect(screen.getByRole('status')).toHaveTextContent('Repeats every week on Mon and Wed until 03/11/2026')
    await user.click(screen.getByRole('checkbox', { name: 'Wed' }))
    expect(screen.getByRole('status')).toHaveTextContent('Repeats every week on Mon until 03/11/2026')
  })

  it('Daily with days and without', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('radio', { name: 'Daily' }))
    await pickUntil(user, '03112026')
    expect(screen.getByRole('status')).toHaveTextContent('Repeats every day until 03/11/2026')
    await user.click(screen.getByRole('checkbox', { name: 'Sun' }))
    expect(screen.getByRole('status')).toHaveTextContent('Repeats every day on Sun until 03/11/2026')
  })

  it('edit keeps its repetition and has no Until (the block keeps the one it had)', async () => {
    setup({ mode: 'edit', block: weeklyBlock })
    await screen.findByRole('dialog')
    expect(screen.getByRole('radio', { name: 'Weekly' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Mon' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Wed' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Tue' })).not.toBeChecked()
    expect(screen.queryByRole('combobox', { name: /^Until date/ })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Repeats every week on Mon and Wed until 30/11/2026')
  })
})

describe('BlockDialog · the dates', () => {
  const pickDate = async (user, name, digits) => {
    await user.click(screen.getByRole('combobox', { name }))
    const picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.clear(within(picker).getByRole('textbox'))
    await user.type(within(picker).getByRole('textbox'), `${digits}{Enter}`)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
  }

  it('a date after Until takes Until with it', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('radio', { name: 'Weekly' }))
    await pickDate(user, /^Until date/, '22102026')
    await pickDate(user, /^Shift date/, '25102026')
    expect(field(/^Shift date/)).toHaveTextContent('25/10/2026')
    expect(field(/^Until date/)).toHaveTextContent('25/10/2026')
  })

  it('a date before Until leaves Until where it was', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('radio', { name: 'Weekly' }))
    await pickDate(user, /^Until date/, '30102026')
    await pickDate(user, /^Shift date/, '22102026')
    expect(field(/^Shift date/)).toHaveTextContent('22/10/2026')
    expect(field(/^Until date/)).toHaveTextContent('30/10/2026')
  })

  it('the picker refuses a day in the past', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('radio', { name: 'Weekly' }))
    await user.click(field(/^Shift date/))
    const picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.clear(within(picker).getByRole('textbox'))
    await user.type(within(picker).getByRole('textbox'), '10102026')
    expect(within(picker).getByRole('alert')).toHaveTextContent('That date is not available.')
  })
})

describe('BlockDialog · the footer', () => {
  it('add: Cancel and Add, the primary last; Cancel closes', async () => {
    const { user, onClose } = setup()
    await screen.findByRole('dialog')
    expect(screen.queryByRole('button', { name: 'Delete shift' })).toBeNull()
    expect(addButton()).toHaveAttribute('data-variant', 'primary')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('add: busy shows the spinner and blocks a second press', async () => {
    const { user, onSubmit } = setup({ busy: true })
    await screen.findByRole('dialog')
    expect(addButton()).toHaveAttribute('aria-busy', 'true')
    await user.click(addButton())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('edit: «Delete shift» (danger) first, then Cancel and Save', async () => {
    const { user, onDelete } = setup({ mode: 'edit', block: plainBlock })
    await screen.findByRole('dialog')
    const remove = screen.getByRole('button', { name: 'Delete shift' })
    expect(remove).toHaveAttribute('data-variant', 'danger')
    const foot = document.querySelector('.odc-overlay-foot')
    expect([...foot.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Delete shift', 'Cancel', 'Save'])
    expect(saveButton()).toHaveAttribute('data-variant', 'primary')
    await user.click(remove)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('Add hands the form over, as typed', async () => {
    const { user, onSubmit } = setup()
    await user.type(await screen.findByRole('textbox', { name: 'Shift Name' }), 'Night shift')
    await user.type(screen.getByRole('textbox', { name: 'Shift Description' }), 'Dock 4')
    await user.selectOptions(field('End time'), '18:00')
    await user.click(addButton())
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Night shift',
      description: 'Dock 4',
      day: FUTURE,
      start: '10:00',
      end: '18:00',
      showBreak: false,
      breakStart: '',
      breakEnd: '',
      freq: null,
      byweekday: [],
      untilDay: FUTURE
    })
  })

  it('a weekly add hands over the days as rrule indexes (Mon = 0 … Sun = 6)', async () => {
    const { user, onSubmit } = setup()
    await user.click(await screen.findByRole('radio', { name: 'Weekly' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sun' }))
    await user.click(screen.getByRole('checkbox', { name: 'Mon' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sat' }))
    await user.click(addButton())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ freq: 'weekly', byweekday: [0, 5, 6], untilDay: '2026-11-20' })
  })

  it('Save hands over the edited form', async () => {
    const { user, onSubmit } = setup({ mode: 'edit', block })
    await user.clear(await screen.findByRole('textbox', { name: 'Shift Name' }))
    await user.type(screen.getByRole('textbox', { name: 'Shift Name' }), 'Late')
    await user.selectOptions(field('End time'), '18:00')
    await user.click(saveButton())
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Late',
      description: 'Route north',
      day: FUTURE,
      start: '08:00',
      end: '18:00',
      showBreak: true,
      breakStart: '12:00',
      breakEnd: '12:30',
      freq: null,
      byweekday: [],
      untilDay: FUTURE
    })
  })

  it('does not hand over a form with wrong hours', async () => {
    const { user, onSubmit } = setup()
    await screen.findByRole('dialog')
    await user.selectOptions(field('End time'), '09:00')
    await user.click(addButton())
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
