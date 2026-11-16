// redesign tramo B r2 (decision 40): fixes of the hands-on review of tramo B (QB1-03 … QB1-13) in the W0-7 wrappers.
// jsdom has no layout: the sizes are pinned in the CSS text (as touch.w07fix does) and in the browser spec; the wiring is
// pinned here with real Base UI.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Field } from '../Field'
import { DatePicker } from '../DatePicker'
import { Pagination } from '../Pagination'

const css = file => readFileSync(path.resolve(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const source = file => readFileSync(path.resolve(__dirname, '..', file), 'utf8')
const flat = text => text.replace(/\s+/g, ' ')

// The body of the block that opens at `opener` (balanced braces).
const blockAfter = (text, opener) => {
  const start = text.indexOf(opener)
  if (start === -1) return ''
  let depth = 0
  const open = text.indexOf('{', start)
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1
    if (text[index] === '}') depth -= 1
    if (depth === 0) return text.slice(open + 1, index)
  }
  return ''
}
const ruleBody = (block, selector) => {
  const found = [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, sel]) => sel.trim().replace(/\s+/g, ' ') === selector)
  return found ? found[2].replace(/\s+/g, ' ') : ''
}
const TOUCH = '@media (pointer: coarse), (max-width: 767px)'

const stubMatchMedia = () => {
  window.matchMedia = vi.fn(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}
beforeEach(stubMatchMedia)
afterEach(() => {
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
})

const DATE_LABELS = {
  title: 'Choose a date',
  close: 'Close',
  today: 'Today',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  invalidDate: format => `Enter a real date as ${format}.`,
  outOfRange: 'That date is not available.'
}

// redesign tramo B r3 (W0-QB2-05, -06): the minimum width of the title (r2) widened short titles; the row now wraps only in the
// narrow container. The pins are in tramoB.r3.test.jsx.
describe('QB1-03 PageHeader keeps a legible title', () => {
  const PAGE = css('page-header.css')
  it('the title is never 0px: in the narrow container the row wraps before it gives its width up', () => {
    // redesign tramo B r4 (W0-QB3-01): the block (arrow, title, count, status) holds the minimum, the row wraps at any width (tramoB.r4.test.jsx)
    expect(ruleBody(PAGE, '.odc-pagehead-lead')).toMatch(/flex: 1 1 calc\(var\(--od-x-type-title-size\) \* 10\)/)
    expect(ruleBody(PAGE, '.odc-pagehead-row')).toContain('flex-wrap: wrap')
  })
})

describe('QB1-04 Field links label, hint, error and required to any child control', () => {
  it('a native select: the label focuses it, hint and error describe it, invalid and required are on it', async () => {
    const user = userEvent.setup()
    render(
      <Field label='Order type' hint='Pick one.' error='Choose a type.' required requiredLabel='Required'>
        <select defaultValue='delivery'>
          <option value='delivery'>Delivery</option>
          <option value='pickup'>Pickup</option>
        </select>
      </Field>
    )
    const select = screen.getByRole('combobox')
    expect(select).toHaveAccessibleName(/Order type/)
    expect(select).toHaveAccessibleDescription('Pick one. Choose a type.')
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAttribute('aria-required', 'true')
    await user.click(screen.getByText('Order type'))
    expect(select).toHaveFocus()
  })

  it('a field with no error does not mark its child invalid', () => {
    render(<Field label='Order type'><select><option>Delivery</option></select></Field>)
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-required')
  })

  it('a DatePicker: named by the visible label and its value, described, invalid, required; the label focuses it without opening', async () => {
    const user = userEvent.setup()
    render(
      <Field label='Start date' hint='Starts at midnight.' error='Choose a start date.' required requiredLabel='Required'>
        <DatePicker label='Start date' labels={DATE_LABELS} dateFormat='DD/MM/YYYY' locale='en' value={null} onChange={() => {}} invalid />
      </Field>
    )
    const trigger = screen.getByRole('combobox', { name: /Start date/ })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    expect(trigger).toHaveAttribute('aria-required', 'true')
    expect(trigger).toHaveAccessibleDescription('Starts at midnight. Choose a start date.')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByText('Start date', { selector: '.odc-field-label-text' }))
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('a DatePicker alone that is invalid says so to assistive tech and does not rely on the colour', () => {
    render(<DatePicker label='Snooze until' labels={DATE_LABELS} dateFormat='DD/MM/YYYY' locale='en' value='2026-03-02' onChange={() => {}} invalid />)
    expect(screen.getByRole('combobox', { name: /Snooze until/ })).toHaveAttribute('aria-invalid', 'true')
    const rule = ruleBody(css('date-picker.css'), '.odc-dp-trigger[data-invalid]')
    expect(rule).toContain('border-color: var(--od-danger-functional)')
    expect(rule).toMatch(/box-shadow: inset 0 0 0 var\(--od-x-hairline\) var\(--od-danger-functional\)/)
  })
})

// redesign tramo B r3 (W0-QB2-02): r2 made the inputs 44px visible; decision 12 says 32px visible with a 44px area. See tramoB.r3.test.jsx.
describe('QB1-05 text inputs reach 44px on touch', () => {
  it('through the area on their frame, not by growing: no coarse block-size on the input, the box or the textarea', () => {
    const fieldTouch = blockAfter(css('field.css'), TOUCH)
    expect(ruleBody(fieldTouch, '.odc-field-input')).not.toContain('block-size')
    expect(ruleBody(fieldTouch, '.odc-field-box')).not.toContain('block-size')
    expect(flat(fieldTouch)).toContain('inset: var(--od-x-target-inset)')
    for (const file of ['Field.jsx', 'field.css', 'legacy-fields.css', 'date-picker.css']) {
      expect(flat(source(file)), file).not.toMatch(/listed exception|is a listed|an exception/i)
    }
  })
})

describe('QB1-06 RadioGroup rows never overlap their neighbours', () => {
  it('on touch each row is 44px visible and no pseudo-element area is added', () => {
    const touch = blockAfter(css('radio-group.css'), TOUCH)
    expect(ruleBody(touch, '.odc-radio')).toContain('min-block-size: var(--od-x-target-coarse)')
    expect(touch).not.toContain('::after')
  })
})

describe('QB1-07 Pagination announces the new page', () => {
  const NAMES = {
    label: 'Orders pages',
    previousLabel: 'Previous page',
    nextLabel: 'Next page',
    rangeLabel: (from, to, total) => `Showing ${from}–${to} of ${total}`,
    pageStatusLabel: (page, total) => `Page ${page} of ${total}`
  }
  const make = page => <Pagination page={page} pageSize={10} total={123} onPageChange={() => {}} {...NAMES} />

  it('has a polite live region mounted from the first render, with the text it is given', () => {
    const { container, rerender } = render(make(4))
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live).toHaveAttribute('role', 'status')
    expect(live).toHaveAttribute('aria-atomic', 'true')
    expect(live).toHaveTextContent('Page 4 of 13')
    rerender(make(5))
    expect(container.querySelector('[aria-live="polite"]')).toBe(live)
    expect(live).toHaveTextContent('Page 5 of 13')
  })

  it('throws without a pageStatusLabel (missing, not empty)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { pageStatusLabel, ...rest } = NAMES
    expect(() => render(<Pagination page={1} pageSize={10} total={123} {...rest} />)).toThrow('Pagination needs a pageStatusLabel')
    spy.mockRestore()
    expect(typeof pageStatusLabel).toBe('function')
  })

  it('the live region is not the range line, so the range keeps one reading', () => {
    render(make(2))
    expect(within(screen.getByRole('navigation')).getByRole('status')).toHaveTextContent('Page 2 of 13')
  })
})

describe('QB1-09 collapsed PageHeader buttons are 44px wide on a phone', () => {
  it('every button of the row has the coarse minimum inline size, not only the icon-only ones', () => {
    const touch = blockAfter(css('page-header.css'), TOUCH)
    expect(ruleBody(touch, '.odc-pagehead-row .odc-btn')).toContain('min-inline-size: var(--od-x-target-coarse)')
  })
})

describe('QB1-10 RecordPanel narrow nav keeps its distance from the close area', () => {
  it('the header gives the nav row room under the close button on touch', () => {
    const touch = blockAfter(css('record-panel.css'), TOUCH)
    expect(ruleBody(touch, ".odc-record[data-layout='nav'] .odc-record-head")).toMatch(/padding-block-end: var\(--od-space-/)
  })
})

describe('QB1-11 DatePicker with min and max opens on a selectable day', () => {
  it('with no value it focuses the first selectable day of the month shown', async () => {
    const user = userEvent.setup()
    render(<DatePicker label='Event date' labels={DATE_LABELS} dateFormat='DD/MM/YYYY' locale='en' firstDayOfWeek={0} value={null} onChange={() => {}} min='2026-03-10' max='2026-03-20' />)
    await user.click(screen.getByRole('combobox', { name: /Event date/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Choose a date' })
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('data-day')).toBe('2026-03-10'))
    expect(dialog.querySelector('[data-day="2026-03-10"]')).toHaveAttribute('tabindex', '0')
    expect(dialog.querySelector('[data-day="2026-03-01"]')).toHaveAttribute('tabindex', '-1')
  })

  it('with a chosen day it still opens on it', async () => {
    const user = userEvent.setup()
    render(<DatePicker label='Event date' labels={DATE_LABELS} dateFormat='DD/MM/YYYY' locale='en' firstDayOfWeek={0} value='2026-03-15' onChange={() => {}} min='2026-03-10' max='2026-03-20' />)
    await user.click(screen.getByRole('combobox', { name: /Event date/ }))
    await screen.findByRole('dialog', { name: 'Choose a date' })
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('data-day')).toBe('2026-03-15'))
  })
})

describe('QB1-13 gallery sections fit a phone', () => {
  it('the section body is a single shrinkable column at any width', () => {
    const gallery = readFileSync(path.resolve(process.cwd(), 'scripts/product-ui/gallery.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(ruleBody(gallery, '.g-body')).toContain('grid-template-columns: minmax(0, 1fr)')
  })
})
