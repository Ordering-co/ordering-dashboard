// redesign W0-7 (T0-28): DatePicker, one day with the calendar of the date range.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DatePicker } from '../DatePicker'

const stubMatchMedia = (phone) => {
  window.matchMedia = vi.fn((query) => ({
    matches: phone && query.includes('max-width: 767px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
}

const labels = {
  title: 'Choose a date',
  close: 'Close',
  today: 'Today',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  invalidDate: (format) => `Enter a real date as ${format}.`,
  outOfRange: 'That date is not available.'
}

const ISO = /\d{4}-\d{2}-\d{2}/

// The picker is controlled: the harness keeps the value the way a form would.
const Harness = ({ initial = '2026-03-15', onChange, ...props }) => {
  const [value, setValue] = useState(initial)
  return (
    <DatePicker
      label='Snooze until'
      labels={labels}
      dateFormat='DD/MM/YYYY'
      locale='en'
      firstDayOfWeek={0}
      value={value}
      onChange={(day) => { setValue(day); onChange?.(day) }}
      {...props}
    />
  )
}

const trigger = () => screen.getByRole('combobox', { name: /Snooze until/ })
const open = async (user) => {
  await user.click(trigger())
  return screen.findByRole('dialog', { name: 'Choose a date' })
}
const dayButton = (dialog, day) => dialog.querySelector(`[data-day="${day}"]`)

const cssOf = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

beforeEach(() => stubMatchMedia(false))

afterEach(() => {
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
})

describe('DatePicker · trigger', () => {
  it('shows the day in the project format, never ISO, and names itself with the label and the value', () => {
    render(<Harness />)
    const button = trigger()
    expect(button).toHaveAccessibleName('Snooze until 15/03/2026')
    expect(button.textContent).toContain('15/03/2026')
    expect(button.textContent).not.toMatch(ISO)
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).not.toHaveAttribute('data-empty')
    expect(button.querySelector('svg')).not.toBeNull()
  })

  it('shows the placeholder (or the project format) when there is no day', () => {
    const { unmount } = render(<Harness initial={null} placeholder='Pick a day' />)
    expect(trigger()).toHaveAttribute('data-empty')
    expect(trigger()).toHaveTextContent('Pick a day')
    unmount()
    render(<Harness initial={null} />)
    expect(trigger()).toHaveTextContent('dd/mm/yyyy')
  })

  it('writes MM/DD/YYYY and a month-name format as the project asks, and nothing in the page is ISO text', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness dateFormat='MM/DD/YYYY' />)
    expect(trigger()).toHaveTextContent('03/15/2026')
    unmount()
    render(<Harness dateFormat='DD MMM YYYY' />)
    expect(trigger()).toHaveTextContent('15 Mar 2026')
    await open(user)
    expect(document.body.textContent).not.toMatch(ISO)
  })

  it('open: no ISO text anywhere with DD/MM/YYYY (the machine day lives in data-day only)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await open(user)
    expect(document.body.textContent).not.toMatch(ISO)
    expect(dialog.querySelector('input').value).toBe('15/03/2026')
    expect(dayButton(dialog, '2026-03-15')).toBeTruthy()
  })

  it('a disabled picker does not open; an invalid one says so in data-invalid', async () => {
    const user = userEvent.setup()
    render(<Harness disabled invalid />)
    expect(trigger()).toBeDisabled()
    expect(trigger()).toHaveAttribute('data-disabled')
    expect(trigger()).toHaveAttribute('data-invalid')
    await user.click(trigger())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('DatePicker · mouse', () => {
  it('picks a day with the mouse: onChange gets the machine day, the layer closes, the focus returns to the trigger', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const dialog = await open(user)
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    await user.click(within(dialog).getByRole('button', { name: /March 20, 2026/ }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('2026-03-20')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger()).toHaveTextContent('20/03/2026')
    expect(trigger()).toHaveFocus()
  })

  it('marks the chosen day (aria-selected) and navigates by month with named buttons', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await open(user)
    expect(dayButton(dialog, '2026-03-15').closest('td')).toHaveAttribute('aria-selected', 'true')
    expect(dayButton(dialog, '2026-03-16').closest('td')).toHaveAttribute('aria-selected', 'false')
    expect(within(dialog).getByText('March 2026')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Next month' }))
    expect(within(dialog).getByText('April 2026')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Previous month' }))
    await user.click(within(dialog).getByRole('button', { name: 'Previous month' }))
    expect(within(dialog).getByText('February 2026')).toBeInTheDocument()
  })

  it('Today takes the calendar to the current month without choosing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial='2020-01-10' onChange={onChange} />)
    const dialog = await open(user)
    expect(within(dialog).getByText('January 2020')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Today' }))
    expect(within(dialog).queryByText('January 2020')).not.toBeInTheDocument()
    expect(dialog.querySelector('[data-today]')).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('the week starts where firstDayOfWeek says', async () => {
    const user = userEvent.setup()
    render(<Harness firstDayOfWeek={1} />)
    const dialog = await open(user)
    const headers = within(dialog).getAllByRole('columnheader')
    expect(headers[0]).toHaveAttribute('abbr', 'Monday')
    expect(headers[6]).toHaveAttribute('abbr', 'Sunday')
  })
})

describe('DatePicker · keyboard', () => {
  it('opens with the focus on the chosen day; arrows, PageUp / PageDown, Home / End move it; Enter chooses', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    trigger().focus()
    await user.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', { name: 'Choose a date' })
    expect(dayButton(dialog, '2026-03-15')).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(dayButton(dialog, '2026-03-16')).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(dayButton(dialog, '2026-03-14')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(dayButton(dialog, '2026-03-21')).toHaveFocus()
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(dayButton(dialog, '2026-03-07')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(dayButton(dialog, '2026-03-01')).toHaveFocus() // Sunday 1 March, the week starts on Sunday
    await user.keyboard('{End}')
    expect(dayButton(dialog, '2026-03-07')).toHaveFocus()
    await user.keyboard('{PageDown}')
    expect(within(dialog).getByText('April 2026')).toBeInTheDocument()
    expect(dayButton(dialog, '2026-04-07')).toHaveFocus()
    await user.keyboard('{PageUp}{PageUp}')
    expect(within(dialog).getByText('February 2026')).toBeInTheDocument()
    expect(dayButton(dialog, '2026-02-07')).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('2026-02-07')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })

  it('Escape closes only the picker, chooses nothing and gives the focus back to the trigger', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const dialog = await open(user)
    await user.keyboard('{ArrowRight}{Escape}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Choose a date' })).not.toBeInTheDocument()
    expect(dialog).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
    expect(trigger()).toHaveTextContent('15/03/2026')
  })

  it('mirrors the arrows in RTL', async () => {
    document.documentElement.dir = 'rtl'
    try {
      const user = userEvent.setup()
      render(<Harness />)
      const dialog = await open(user)
      await user.keyboard('{ArrowLeft}')
      expect(dayButton(dialog, '2026-03-16')).toHaveFocus()
    } finally {
      document.documentElement.dir = ''
    }
  })
})

describe('DatePicker · typed field', () => {
  it('masks the digits to the project format and reports a valid day as it is typed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={null} onChange={onChange} />)
    const dialog = await open(user)
    const input = within(dialog).getByRole('textbox', { name: 'Snooze until' })
    expect(input).toHaveAttribute('placeholder', 'dd/mm/yyyy')
    await user.type(input, '2203')
    expect(input).toHaveValue('22/03')
    expect(onChange).not.toHaveBeenCalled()
    await user.type(input, '2026')
    expect(input).toHaveValue('22/03/2026')
    expect(onChange).toHaveBeenLastCalledWith('2026-03-22')
    expect(within(dialog).getByText('March 2026')).toBeInTheDocument()
    expect(dayButton(dialog, '2026-03-22').closest('td')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('dialog')).toBeInTheDocument() // typing keeps it open
  })

  it('a text that is not a real date says so (alert, aria-invalid) and reports nothing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={null} onChange={onChange} />)
    const dialog = await open(user)
    const input = within(dialog).getByRole('textbox')
    await user.type(input, '31022026')
    expect(input).toHaveValue('31/02/2026')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a real date as dd/mm/yyyy.')
    expect(input).toHaveAttribute('aria-describedby', within(dialog).getByRole('alert').id)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Enter on a valid typed date chooses it and closes; on an invalid one it keeps the layer open', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={null} onChange={onChange} />)
    const dialog = await open(user)
    const input = within(dialog).getByRole('textbox')
    await user.type(input, '1203{Enter}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    await user.type(input, '2026{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('2026-03-12')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger()).toHaveTextContent('12/03/2026')
  })

  it('emptying the field clears the day only when the project offers «clear»', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { unmount } = render(<Harness onChange={onChange} />)
    let dialog = await open(user)
    await user.clear(within(dialog).getByRole('textbox'))
    expect(onChange).not.toHaveBeenCalled()
    unmount()
    document.getElementById('app-modals')?.remove()

    render(<Harness onChange={onChange} labels={{ ...labels, clear: 'Remove date' }} />)
    dialog = await open(user)
    await user.click(within(dialog).getByRole('button', { name: 'Remove date' }))
    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger()).toHaveAttribute('data-empty')
  })
})

describe('DatePicker · min, max and disabled days', () => {
  it('days outside min / max are aria-disabled and data-disabled, stay focusable and are never chosen', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness min='2026-03-10' max='2026-03-20' onChange={onChange} />)
    const dialog = await open(user)
    const before = dayButton(dialog, '2026-03-09')
    const after = dayButton(dialog, '2026-03-21')
    const inside = dayButton(dialog, '2026-03-10')
    ;[before, after].forEach(button => {
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).toHaveAttribute('data-disabled')
    })
    expect(inside).not.toHaveAttribute('aria-disabled')
    expect(dayButton(dialog, '2026-03-20')).not.toHaveAttribute('aria-disabled')
    await user.click(before)
    await user.click(after)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    before.focus()
    await user.keyboard('{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    await user.click(inside)
    expect(onChange).toHaveBeenCalledWith('2026-03-10')
  })

  it('isDayDisabled marks any day, and a typed disabled day says «not available»', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    // Weekends are not available.
    const isWeekend = (day) => [0, 6].includes(new Date(day + 'T12:00:00').getDay())
    render(<Harness initial={null} isDayDisabled={isWeekend} onChange={onChange} />)
    const dialog = await open(user)
    await user.type(within(dialog).getByRole('textbox'), '14032026') // a Saturday
    expect(within(dialog).getByRole('alert')).toHaveTextContent('That date is not available.')
    expect(onChange).not.toHaveBeenCalled()
    expect(dayButton(dialog, '2026-03-14')).toHaveAttribute('aria-disabled', 'true')
    expect(dayButton(dialog, '2026-03-16')).not.toHaveAttribute('aria-disabled')
  })

  it('a typed day out of min / max says «not available» and a bound is typed as it is', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={null} min='2026-03-10' max='2026-03-20' onChange={onChange} />)
    const dialog = await open(user)
    const input = within(dialog).getByRole('textbox')
    await user.type(input, '09032026')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('That date is not available.')
    expect(onChange).not.toHaveBeenCalled()
    await user.clear(input)
    await user.type(input, '10032026')
    expect(onChange).toHaveBeenLastCalledWith('2026-03-10')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('the month buttons stop at the bounds but keep the focus (aria-disabled, no dead end)', async () => {
    const user = userEvent.setup()
    render(<Harness min='2026-03-10' max='2026-03-20' />)
    const dialog = await open(user)
    const previous = within(dialog).getByRole('button', { name: 'Previous month' })
    const next = within(dialog).getByRole('button', { name: 'Next month' })
    expect(previous).toHaveAttribute('aria-disabled', 'true')
    expect(next).toHaveAttribute('aria-disabled', 'true')
    await user.click(next)
    expect(within(dialog).getByText('March 2026')).toBeInTheDocument()
  })

  it('opens on the month of the nearest allowed day when there is no value and today is out of range', async () => {
    const user = userEvent.setup()
    render(<Harness initial={null} min='2001-05-10' max='2001-05-20' />)
    const dialog = await open(user)
    expect(within(dialog).getByText('May 2001')).toBeInTheDocument()
  })
})

describe('DatePicker · phone', () => {
  it('is a bottom sheet under 768px: title, close button, pick a day, focus back on the trigger', async () => {
    stubMatchMedia(true)
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const sheet = await open(user)
    expect(sheet.className).toContain('odc-dp-sheet')
    expect(within(sheet).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    // the sheet (a modal Dialog) moves the focus to its initial target and back to the trigger after
    // the open and close transitions, not in the same task as the popover; wait for it instead of reading it at once.
    await waitFor(() => expect(dayButton(sheet, '2026-03-15')).toHaveFocus())
    await user.click(dayButton(sheet, '2026-03-18'))
    expect(onChange).toHaveBeenCalledWith('2026-03-18')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger()).toHaveFocus())
  })

  it('the close button and Escape choose nothing', async () => {
    stubMatchMedia(true)
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await open(user)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('DatePicker · Tab out (T0-29)', () => {
  // redesign W0-7 (T0-29): the desktop popover is non-modal and answers Tab like the filter popovers (usePopoverTabOut).
  const mountAround = () => render(
    <>
      <button type='button'>Before</button>
      <Harness />
      <button type='button'>After</button>
    </>
  )
  const EXIT = { timeout: 4000 }
  const stops = dialog => Array.from(dialog.querySelectorAll('button, input')).filter(node => node.tabIndex >= 0 && !node.disabled)

  it('Tab from the last stop closes the popover and lands on the next control after the trigger', async () => {
    const user = userEvent.setup()
    mountAround()
    const dialog = await open(user)
    const all = stops(dialog)
    all[all.length - 1].focus()
    await user.tab()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), EXIT)
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
  })

  it('Shift+Tab from the first stop closes the popover and goes back to the trigger, never <body>', async () => {
    const user = userEvent.setup()
    mountAround()
    const dialog = await open(user)
    stops(dialog)[0].focus()
    await user.tab({ shift: true })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), EXIT)
    expect(trigger()).toHaveFocus()
  })

  it('on a phone the sheet is modal: Tab from its last stop keeps the focus inside it', async () => {
    stubMatchMedia(true)
    const user = userEvent.setup()
    mountAround()
    const sheet = await open(user)
    const all = stops(sheet)
    all[all.length - 1].focus()
    await user.tab()
    expect(screen.getByRole('dialog', { name: 'Choose a date' })).toBeInTheDocument()
    expect(document.activeElement).not.toBe(document.body)
    expect(screen.getByRole('button', { name: 'After', hidden: true })).not.toHaveFocus()
  })
})

describe('DatePicker · contract', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('throws without a label (undefined or null), and without the labels it needs', () => {
    expect(() => render(<DatePicker labels={labels} onChange={vi.fn()} />)).toThrow('DatePicker needs a label')
    expect(() => render(<DatePicker label={null} labels={labels} onChange={vi.fn()} />)).toThrow('DatePicker needs a label')
    expect(() => render(<DatePicker label='Day' onChange={vi.fn()} />)).toThrow('DatePicker needs labels')
    ;['title', 'close', 'today', 'previousMonth', 'nextMonth', 'invalidDate', 'outOfRange'].forEach(key => {
      const partial = { ...labels }
      delete partial[key]
      expect(() => render(<DatePicker label='Day' labels={partial} onChange={vi.fn()} />)).toThrow(`DatePicker needs labels.${key}`)
    })
  })

  it('an empty label or empty labels paint empty, they do not throw', async () => {
    const user = userEvent.setup()
    const empty = { ...labels, title: '', today: '', outOfRange: '' }
    render(<DatePicker label='' labels={empty} value='2026-03-15' dateFormat='DD/MM/YYYY' locale='en' onChange={vi.fn()} />)
    const button = screen.getAllByRole('combobox')[0]
    expect(button).toHaveTextContent('15/03/2026')
    await user.click(button)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('keeps its state in data-* and aria-*, and its CSS uses tokens only', () => {
    render(<Harness invalid />)
    expect(trigger()).toHaveAttribute('data-invalid')
    expect(trigger()).toHaveAttribute('aria-expanded')
    const css = cssOf('date-picker.css')
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(css.replace(/@media[^{]*/g, '')).not.toMatch(/[^-\w]\d+(\.\d+)?(px|rem|em)\b/)
    // Decision 12: the trigger keeps 32px visible and gets its 44px target from a pseudo-element.
    expect(css).toMatch(/\.odc-dp-trigger::after[\s\S]*inset: var\(--od-x-target-inset\)/)
  })
})
