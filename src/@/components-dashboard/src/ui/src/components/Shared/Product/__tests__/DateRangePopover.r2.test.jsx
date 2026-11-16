// redesign W0-2 r2 (W0-Q1-03): on a phone the date popover is a bottom sheet, and its foot («Done») was hidden for good.
// With `onApplyRange` the range is a draft that only «Done» hands over, so on a phone a custom range could not be applied.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DateRangePopover } from '../DateRangePopover'

const stubMatchMedia = (phone) => {
  window.matchMedia = vi.fn((query) => ({
    matches: phone && query.includes('max-width: 767px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
}

const labels = {
  title: 'Select a date',
  presets: 'Date',
  close: 'Close',
  done: 'Done',
  from: 'From',
  to: 'To',
  today: 'Today',
  goToToday: 'Go to today',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  rangeOrder: 'The start date must not be after the end date.',
  invalidDate: (format) => `Enter a real date as ${format}.`
}

const presets = [{ value: 'default', label: 'Any' }, { value: 'today', label: 'Today' }]

const mount = (props) => render(
  <DateRangePopover
    presets={presets}
    presetValue='default'
    dateFormat='DD-MM-YYYY'
    triggerText='Date'
    labels={labels}
    locale='en'
    onPreset={vi.fn()}
    onRange={vi.fn()}
    renderTrigger={({ ref, expanded, toggle }) => (
      <button ref={ref} type='button' aria-expanded={expanded} onClick={toggle}>Date</button>
    )}
    {...props}
  />
)

const open = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Date' }))
  return screen.findByRole('dialog', { name: 'Select a date' })
}

const pickTwoDays = async (user, dialog) => {
  await user.click(dialog.querySelector('[data-day$="-10"]'))
  await user.click(dialog.querySelector('[data-day$="-14"]'))
}

const cssOf = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

beforeEach(() => stubMatchMedia(true))

afterEach(() => {
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
})

describe('DateRangePopover · draft range on a phone sheet', () => {
  it('«Done» applies the picked range once and closes; nothing is applied before it', async () => {
    const user = userEvent.setup()
    const onApplyRange = vi.fn()
    const onRange = vi.fn()
    mount({ onApplyRange, onRange })
    const dialog = await open(user)
    await pickTwoDays(user, dialog)
    expect(onApplyRange).not.toHaveBeenCalled()
    const foot = dialog.querySelector('.odc-dr-foot')
    expect(foot).toHaveAttribute('data-hold')
    await user.click(within(foot).getByRole('button', { name: 'Done' }))
    expect(onApplyRange).toHaveBeenCalledTimes(1)
    const { from, to } = onApplyRange.mock.calls[0][0]
    expect(from).toMatch(/^\d{4}-\d{2}-10$/)
    expect(to).toMatch(/^\d{4}-\d{2}-14$/)
    expect(onRange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Select a date' })).not.toBeInTheDocument()
  })

  it('the close button discards the draft: no call', async () => {
    const user = userEvent.setup()
    const onApplyRange = vi.fn()
    mount({ onApplyRange })
    const dialog = await open(user)
    await pickTwoDays(user, dialog)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onApplyRange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Select a date' })).not.toBeInTheDocument()
  })

  it('Escape discards the draft: no call', async () => {
    const user = userEvent.setup()
    const onApplyRange = vi.fn()
    mount({ onApplyRange })
    const dialog = await open(user)
    await pickTwoDays(user, dialog)
    await user.keyboard('{Escape}')
    expect(onApplyRange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Select a date' })).not.toBeInTheDocument()
  })

  it('without a draft (live onRange) the foot is not marked as held, so the sheet keeps hiding it', async () => {
    const user = userEvent.setup()
    const onRange = vi.fn()
    mount({ onRange })
    const dialog = await open(user)
    expect(dialog.querySelector('.odc-dr-foot')).not.toHaveAttribute('data-hold')
    await user.click(dialog.querySelector('[data-day$="-10"]'))
    expect(onRange).toHaveBeenCalledTimes(1)
  })
})

describe('date-range.css · the sheet foot', () => {
  const css = cssOf('date-range.css')

  it('never hides the foot of the sheet unconditionally: only the one without a draft', () => {
    expect(css).not.toMatch(/\.odc-dr-sheet\s+\.odc-dr-foot\s*\{[^}]*display:\s*none/)
    expect(css).toMatch(/\.odc-dr-sheet\s+\.odc-dr-foot:not\(\[data-hold\]\)\s*\{\s*display:\s*none/)
  })

  it('pins the held foot to the bottom of the sheet body, with tokens only', () => {
    const rule = css.match(/\.odc-dr-sheet\s+\.odc-dr-foot\[data-hold\]\s*\{([^}]*)\}/)?.[1] || ''
    expect(rule).toMatch(/position:\s*sticky/)
    // redesign W0-E-14: Chromium measures `bottom` from the content edge, so `0` pulled the foot 21px up over the last row of days
    // (1px between them and «Done»). It sticks to the padding edge (minus the body padding, a token), where it sits unscrolled.
    expect(rule).toMatch(/inset-block-end:\s*calc\(var\(--od-space-5\)\s*\*\s*-1\)/)
    expect(rule).not.toMatch(/\d+px/)
  })
})

// redesign tramo A (W0-Q2-03): the Date popover is a non-modal layer on desktop: Tab out of it closes it and lands on the next
// visible control, Shift+Tab from the first stop goes back to the trigger, never <body>. On a phone it is a modal sheet: the
// focus does not leave it.
describe('DateRangePopover · Tab out (W0-Q2-03)', () => {
  const mountDesktop = (props) => {
    stubMatchMedia(false)
    return render(
      <>
        <button type='button'>Before</button>
        <DateRangePopover
          presets={presets}
          presetValue='default'
          dateFormat='DD-MM-YYYY'
          triggerText='Date'
          labels={labels}
          locale='en'
          onPreset={vi.fn()}
          onRange={vi.fn()}
          renderTrigger={({ ref, expanded, toggle }) => (
            <button ref={ref} type='button' aria-expanded={expanded} onClick={toggle}>Date</button>
          )}
          {...props}
        />
        <span data-empty=''><button type='button' style={{ visibility: 'hidden' }}>+0 more filters</button></span>
        <button type='button'>Filters</button>
      </>
    )
  }
  const EXIT = { timeout: 4000 }
  const stops = dialog => Array.from(dialog.querySelectorAll('button, input')).filter(node => node.tabIndex >= 0 && !node.disabled)

  it('Tab from the last stop closes the popover and lands on the next visible control after the trigger', async () => {
    const user = userEvent.setup()
    mountDesktop()
    const dialog = await open(user)
    const all = stops(dialog)
    all[all.length - 1].focus()
    await user.tab()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull(), EXIT)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Filters', hidden: true }))
  })

  it('Shift+Tab from the first stop closes the popover and goes back to the trigger', async () => {
    const user = userEvent.setup()
    mountDesktop()
    const dialog = await open(user)
    stops(dialog)[0].focus()
    await user.tab({ shift: true })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull(), EXIT)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Date' }))
  })

  it('Tab between stops inside the popover does not close it', async () => {
    const user = userEvent.setup()
    mountDesktop()
    const dialog = await open(user)
    stops(dialog)[0].focus()
    await user.tab()
    expect(screen.getByRole('dialog', { name: 'Select a date' })).toBeInTheDocument()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('on a phone the sheet is modal: Tab from its last stop keeps the focus inside it', async () => {
    const user = userEvent.setup()
    stubMatchMedia(true)
    mount()
    const dialog = await open(user)
    const all = stops(dialog)
    all[all.length - 1].focus()
    await user.tab()
    expect(screen.getByRole('dialog', { name: 'Select a date' })).toBeInTheDocument()
    expect(document.activeElement).not.toBe(document.body)
  })
})

// redesign tramo A r5 (W0-QA3-04): the month title is the text of the formatter, never capitalized word by word («Octubre De 2026»).
// DayCalendar draws it for the Date range popover and the DatePicker, which share date-range.css.
describe('date-range.css · the month title', () => {
  it('does not transform the title of the calendar', () => {
    const block = cssOf('date-range.css').match(/\.odc-dr-cal-title\s*\{[^}]*\}/)[0]
    expect(block).not.toMatch(/text-transform/)
  })
})

// redesign at 390px with a mouse the presets and the From / To inputs measured 32px with no area, because their 44px boxes
// were under `(pointer: coarse)` only. jsdom has no layout, so the rule is pinned in the text; the measure at 390 is in
// e2e/product-ui/w07-wrappers.spec.js.
describe('date-range.css · the touch target below 768px', () => {
  const css = cssOf('date-range.css')
  const mediaBody = (query) => {
    const start = css.search(new RegExp(`@media\\s*${query}\\s*\\{`))
    if (start < 0) return ''
    const open = css.indexOf('{', start)
    let depth = 0
    for (let index = open; index < css.length; index++) {
      if (css[index] === '{') depth++
      if (css[index] === '}' && --depth === 0) return css.slice(open + 1, index)
    }
    return ''
  }

  const BOX = /\.odc-dr-preset,\s*\.odc-dr-input\s*\{[^}]*min-block-size:\s*var\(--od-x-target-coarse\)/

  it('gives the presets and the inputs the 44px box below 768px, with a mouse too', () => {
    expect(mediaBody('\\(max-width:\\s*767px\\)')).toMatch(BOX)
  })

  it('keeps the box with a coarse pointer at any width (W0-3d2)', () => {
    expect(mediaBody('\\(pointer:\\s*coarse\\)')).toMatch(BOX)
  })

  it('makes the days of the sheet 44px below 768px', () => {
    expect(mediaBody('\\(max-width:\\s*767px\\)')).toMatch(/\.odc-dr-sheet\s*\{[^}]*--odc-dr-day:\s*var\(--od-x-target-coarse\)/)
  })
})

// R-02 (of ): a «From» typed after «To» says so, but typing «To» next sent the range out with the OLD saved
// «From» and the effect rewrote the field back to it. What was typed in «From» is kept: the fixed «To» makes the range
// From(typed)-To(new) and the error goes.
describe('DateRangePopover · a From typed after To is kept (R-02)', () => {
  const Host = ({ onChange, hold = false, initial = { from: '2026-10-10', to: '2026-10-14' } }) => {
    const [range, setRange] = React.useState(initial)
    const handle = (next) => { setRange(next); onChange(next) }
    return (
      <DateRangePopover
        presets={presets}
        presetValue='custom'
        from={range.from}
        to={range.to}
        dateFormat='DD-MM-YYYY'
        triggerText='Date'
        labels={labels}
        locale='en'
        onPreset={vi.fn()}
        {...(hold ? { onApplyRange: handle } : { onRange: handle })}
        renderTrigger={({ ref, expanded, toggle }) => (
          <button ref={ref} type='button' aria-expanded={expanded} onClick={toggle}>Date</button>
        )}
      />
    )
  }

  const typeInto = async (user, dialog, name, digits) => {
    // typed over the selected text, as a person does: clearing first would be a change of its own (an empty field)
    const input = within(dialog).getByLabelText(name)
    await user.type(input, digits, { initialSelectionStart: 0, initialSelectionEnd: input.value.length })
    return input
  }

  it('keeps the typed From when To is then corrected to a valid range, and the error goes', async () => {
    stubMatchMedia(false)
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Host onChange={onChange} />)
    const dialog = await open(user)
    const from = await typeInto(user, dialog, 'From', '20102026')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('The start date must not be after the end date.')
    expect(onChange).not.toHaveBeenCalled()
    const to = await typeInto(user, dialog, 'To', '25102026')
    expect(from).toHaveValue('20-10-2026')
    expect(to).toHaveValue('25-10-2026')
    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(from).not.toHaveAttribute('aria-invalid')
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-10-20', to: '2026-10-25' })
  })

  it('keeps it when To is emptied too: From(typed) with no end', async () => {
    stubMatchMedia(false)
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Host onChange={onChange} />)
    const dialog = await open(user)
    const from = await typeInto(user, dialog, 'From', '20102026')
    await user.clear(within(dialog).getByLabelText('To'))
    expect(from).toHaveValue('20-10-2026')
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-10-20', to: null })
  })

  it('still says the order is wrong while To stays before the typed From', async () => {
    stubMatchMedia(false)
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Host onChange={onChange} />)
    const dialog = await open(user)
    const from = await typeInto(user, dialog, 'From', '20102026')
    await typeInto(user, dialog, 'To', '15102026')
    expect(from).toHaveValue('20-10-2026')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('The start date must not be after the end date.')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps the typed From in a held draft (a phone sheet) and hands From(typed)-To(new) over with Done', async () => {
    stubMatchMedia(true)
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Host onChange={onChange} hold />)
    const dialog = await open(user)
    const from = await typeInto(user, dialog, 'From', '20102026')
    await typeInto(user, dialog, 'To', '25102026')
    expect(from).toHaveValue('20-10-2026')
    expect(within(dialog).queryByRole('alert')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-20', to: '2026-10-25' })
  })
})
