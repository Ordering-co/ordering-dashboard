// redesign tramo B r3 (decision 40, part B): fixes of the hands-on review of tramo B round 2 in the W0-7 wrappers
// (W0-QB2-01, -02, -05, -06, -08). jsdom has no layout: the sizes are pinned in the CSS text and in the browser spec
// (e2e/product-ui/w07-wrappers.spec.js, which measures boxes and hit areas); the wiring is pinned here with real Base UI.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Field, NumberField, PasswordField, TextArea, TextField } from '../Field'
import { DatePicker } from '../DatePicker'
import { Pagination } from '../Pagination'
import { BREAKPOINT_CONTAINER_NARROW } from '../../../../../../utils/breakpoints'

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

beforeEach(() => {
  window.matchMedia = vi.fn(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
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

// The frame of a phone control: 32px visible, the 44px target is a centred pseudo-element on the container
const AREA = /content: ''; position: absolute; inset: var\(--od-x-target-inset\); z-index: calc\(var\(--od-x-layer-raised\) \* -1\)/

describe('QB2-02 text controls are 32px visible on touch, with the 44px area on the frame (decision 12)', () => {
  const FIELD = css('field.css')
  const fieldTouch = blockAfter(FIELD, TOUCH)

  it('the inputs, the textarea and the box keep the control height: no coarse block-size on the box itself', () => {
    expect(ruleBody(FIELD, '.odc-field-input')).toContain('block-size: var(--od-x-control-height)')
    expect(ruleBody(FIELD, '.odc-field-box')).toContain('block-size: var(--od-x-control-height)')
    expect(ruleBody(fieldTouch, '.odc-field-input')).not.toMatch(/block-size/)
    expect(ruleBody(fieldTouch, '.odc-field-textarea')).not.toMatch(/block-size/)
    expect(ruleBody(fieldTouch, '.odc-field-box')).not.toMatch(/block-size/)
    expect(fieldTouch).not.toMatch(/(?:min-)?block-size:\s*var\(--od-x-target-coarse\)/)
    // the text still grows to the lead size so iOS does not zoom
    expect(ruleBody(fieldTouch, '.odc-field-input')).toContain('font-size: var(--od-x-type-lead-size)')
  })

  it('the area is a pseudo-element on the frame (the container of a bare input, the box of a password or number field)', () => {
    expect(flat(fieldTouch)).toMatch(/\.odc-field-control:has\(> \.odc-field-input\)::after,\s*\.odc-field-box::after \{[^}]*content: ''/)
    expect(flat(fieldTouch)).toMatch(AREA)
    expect(fieldTouch).toMatch(/\.odc-field-control:has\(> \.odc-field-input\),\s*\.odc-field-box\s*\{[^}]*position: relative/)
    // the frame is a stacking context and the area sits one layer below its content (the layer scale, no literal z-index): the control keeps the pointer in its own box
    expect(ruleBody(fieldTouch, '.odc-field-control:has(> .odc-field-input), .odc-field-box')).toContain('isolation: isolate')
  })

  it('a bare control (a TextField input, a native select inside Field) sits in a frame that owns the area', () => {
    const { container } = render(
      <>
        <TextField label='Store name' />
        <TextArea label='Notes' />
        <Field label='Order type'><select className='odc-field-input'><option>Delivery</option></select></Field>
      </>
    )
    for (const control of [screen.getByRole('textbox', { name: 'Store name' }), screen.getByRole('textbox', { name: 'Notes' }), screen.getByRole('combobox')]) {
      expect(control.parentElement, control.tagName).toHaveClass('odc-field-control')
    }
    expect(container.querySelectorAll('.odc-field-control')).toHaveLength(3)
  })

  it('a tap on the frame outside the control (the 6px of the area) focuses the control', () => {
    render(
      <>
        <TextField label='Store name' />
        <Field label='Order type'><select className='odc-field-input' defaultValue='x'><option value='x'>Delivery</option></select></Field>
        <PasswordField label='Password' showLabel='Show' hideLabel='Hide' />
        <NumberField label='Quantity' defaultValue={3} />
      </>
    )
    const frames = [
      [screen.getByRole('textbox', { name: 'Store name' }), screen.getByRole('textbox', { name: 'Store name' }).parentElement],
      [screen.getByRole('combobox', { name: 'Order type' }), screen.getByRole('combobox', { name: 'Order type' }).parentElement],
      [screen.getByLabelText('Password', { selector: 'input' }), screen.getByLabelText('Password', { selector: 'input' }).closest('.odc-field-box')],
      [screen.getByRole('textbox', { name: 'Quantity' }), screen.getByRole('textbox', { name: 'Quantity' }).closest('.odc-field-box')]
    ]
    for (const [control, frame] of frames) {
      expect(control).not.toHaveFocus()
      const notPrevented = fireEvent.mouseDown(frame)
      expect(notPrevented, 'the press on the frame does not move the focus to the body').toBe(false)
      expect(control).toHaveFocus()
      control.blur()
    }
  })

  it('a press on the control itself or on a button in the box is left alone', () => {
    render(<PasswordField label='Password' showLabel='Show' hideLabel='Hide' />)
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Show' }))).toBe(true)
    expect(fireEvent.mouseDown(screen.getByLabelText('Password', { selector: 'input' }))).toBe(true)
  })

  it('PhoneField: the box is 32px and owns the area; the country select and the number sit above it', () => {
    const LEGACY = css('legacy-fields.css')
    const touch = blockAfter(LEGACY, TOUCH)
    expect(ruleBody(touch, '.odc-phone-field .od-phone-input .PhoneInput')).not.toMatch(/block-size/)
    expect(ruleBody(touch, '.odc-phone-field .od-phone-input input.PhoneInputInput')).not.toMatch(/(?<![-\w])block-size/)
    expect(ruleBody(LEGACY, '.odc-phone-field .od-phone-input .PhoneInput')).toContain('block-size: var(--od-x-control-height)')
    expect(flat(touch)).toMatch(/\.odc-phone-field \.od-phone-input \.PhoneInput::after \{[^}]*content: ''/)
    expect(flat(touch)).toMatch(AREA)
    expect(touch).toMatch(/\.odc-phone-field \.od-phone-input \.PhoneInput\s*\{[^}]*position: relative/)
    expect(ruleBody(touch, '.odc-phone-field .od-phone-input .PhoneInput')).toContain('isolation: isolate')
  })

  it('DatePicker typed field: 32px visible, in a frame that owns the area and forwards the press', async () => {
    const DP = css('date-picker.css')
    const touch = blockAfter(DP, TOUCH)
    expect(ruleBody(touch, '.odc-dr-input.odc-dp-input')).toContain('min-block-size: var(--od-x-control-height)')
    expect(ruleBody(touch, '.odc-dr-input.odc-dp-input')).not.toContain('target-coarse')
    expect(flat(touch)).toMatch(/\.odc-dp-input-frame::after \{[^}]*content: ''/)
    expect(flat(touch)).toMatch(AREA)
    const user = userEvent.setup()
    render(<DatePicker label='Delivery date' labels={DATE_LABELS} dateFormat='DD/MM/YYYY' locale='en' value={null} onChange={() => {}} />)
    await user.click(screen.getByRole('combobox', { name: /Delivery date/ }))
    const input = (await screen.findByRole('dialog', { name: 'Choose a date' })).querySelector('input.odc-dp-input')
    expect(input.parentElement).toHaveClass('odc-dp-input-frame')
    input.blur()
    expect(fireEvent.mouseDown(input.parentElement)).toBe(false)
    expect(input).toHaveFocus()
  })

  it('no file cites decision 12 for 44px visible inputs any more, and the RadioGroup rows keep their 44 (W0-D-08)', () => {
    for (const file of ['Field.jsx', 'field.css', 'legacy-fields.css', 'date-picker.css']) {
      expect(flat(source(file)), file).not.toMatch(/44px VISIBLE|44px visible on a phone|is 44px VISIBLE/)
    }
    expect(ruleBody(blockAfter(css('radio-group.css'), TOUCH), '.odc-radio')).toContain('min-block-size: var(--od-x-target-coarse)')
  })
})

describe('QB2-01 Field links an error, a required mark and an invalid state that arrive after the first render', () => {
  const Select = props => (
    <Field label='Order type' hint='Pick one.' requiredLabel='Required' {...props}>
      <select defaultValue='delivery'>
        <option value='delivery'>Delivery</option>
        <option value='pickup'>Pickup</option>
      </select>
    </Field>
  )
  const Date = props => (
    <Field label='Start date' hint='Starts at midnight.' requiredLabel='Required' {...props}>
      <DatePicker label='Start date' labels={DATE_LABELS} dateFormat='DD/MM/YYYY' locale='en' value={null} onChange={() => {}} />
    </Field>
  )

  it('a native select: the error and the required mark that come later are linked, and go away when they go', () => {
    const { rerender } = render(<Select />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveAccessibleDescription('Pick one.')
    expect(select).not.toHaveAttribute('aria-invalid')
    rerender(<Select error='Choose a type.' />)
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAccessibleDescription('Pick one. Choose a type.')
    rerender(<Select error='Choose a type.' required />)
    expect(select).toHaveAttribute('aria-required', 'true')
    rerender(<Select required />)
    expect(select).not.toHaveAttribute('aria-invalid')
    expect(select).toHaveAccessibleDescription('Pick one.')
    expect(select).toHaveAttribute('aria-required', 'true')
    rerender(<Select />)
    expect(select).not.toHaveAttribute('aria-required')
  })

  it('a DatePicker: the same, and the trigger is painted invalid (data-invalid) from the frame, as the others are', () => {
    const { rerender } = render(<Date />)
    const trigger = screen.getByRole('combobox', { name: /Start date/ })
    expect(trigger).not.toHaveAttribute('aria-invalid')
    expect(trigger).not.toHaveAttribute('data-invalid')
    rerender(<Date error='Choose a start date.' />)
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    expect(trigger).toHaveAttribute('data-invalid')
    expect(trigger).toHaveAccessibleDescription('Starts at midnight. Choose a start date.')
    rerender(<Date error='Choose a start date.' required />)
    expect(trigger).toHaveAttribute('aria-required', 'true')
    rerender(<Date />)
    expect(trigger).not.toHaveAttribute('aria-invalid')
    expect(trigger).not.toHaveAttribute('data-invalid')
    expect(trigger).not.toHaveAttribute('aria-required')
    expect(trigger).toHaveAccessibleDescription('Starts at midnight.')
  })

  it('an explicit invalid on the field paints the DatePicker too', () => {
    render(<Date invalid />)
    expect(screen.getByRole('combobox', { name: /Start date/ })).toHaveAttribute('data-invalid')
  })

  it('the control Base UI wires itself is still left alone (id, for and aria stay Base UI\'s)', () => {
    const { rerender } = render(<TextField label='Store name' hint='Hint.' />)
    const input = screen.getByRole('textbox')
    const id = input.id
    rerender(<TextField label='Store name' hint='Hint.' error='Enter a name.' required requiredLabel='Required' />)
    expect(screen.getByRole('textbox').id).toBe(id)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Hint. Enter a name.')
  })
})

describe('QB2-05 the title does not widen to a minimum, so the count keeps its gap', () => {
  const PAGE = css('page-header.css')
  it('no minimum on the title that is above 0: a short title is as wide as its text (r4: min-inline-size 0, the block holds the minimum)', () => {
    expect(ruleBody(PAGE, '.odc-pagehead-title')).toContain('min-inline-size: 0')
    expect(ruleBody(PAGE, '.odc-pagehead-title')).toContain('flex: 0 1 auto')
    expect(ruleBody(PAGE, '.odc-pagehead-title')).toContain('text-overflow: ellipsis')
  })
})

describe('QB2-06 the narrow container still exists (r4: the wrap itself is no longer narrow-only)', () => {
  const PAGE = css('page-header.css')
  it('the narrow container shrinks the title to the section size and tightens the gaps', () => {
    const narrow = blockAfter(PAGE, `@container (max-width: ${BREAKPOINT_CONTAINER_NARROW - 1}px)`)
    expect(narrow).not.toBe('')
    expect(ruleBody(narrow, '.odc-pagehead-title')).toContain('font-size: var(--od-x-type-section-size)')
    expect(ruleBody(narrow, '.odc-pagehead-row')).not.toContain('flex-wrap')
  })
})

describe('QB2-08 Pagination clamps the page when the total drops', () => {
  const NAMES = {
    label: 'Orders pages',
    previousLabel: 'Previous page',
    nextLabel: 'Next page',
    rangeLabel: (from, to, total) => `Showing ${from}–${to} of ${total}`,
    pageStatusLabel: (page, total) => `Page ${page} of ${total}`
  }

  it('shows the last valid page, never a range that ends before it starts nor a page past the last', () => {
    const onPageChange = vi.fn()
    const { rerender, container } = render(<Pagination page={12} pageSize={10} total={123} onPageChange={onPageChange} {...NAMES} />)
    expect(container).toHaveTextContent('Showing 111–120 of 123')
    expect(container).toHaveTextContent('Page 12 of 13')
    expect(onPageChange).not.toHaveBeenCalled()
    rerender(<Pagination page={12} pageSize={10} total={5} onPageChange={onPageChange} {...NAMES} />)
    expect(container).toHaveTextContent('Showing 1–5 of 5')
    expect(container).toHaveTextContent('Page 1 of 1')
    expect(container).not.toHaveTextContent('111')
    expect(container).not.toHaveTextContent('Page 12')
  })

  it('asks the owner of the page for the last valid page, once, and not while the page is valid', () => {
    const onPageChange = vi.fn()
    const { rerender } = render(<Pagination page={12} pageSize={10} total={123} onPageChange={onPageChange} {...NAMES} />)
    rerender(<Pagination page={12} pageSize={10} total={35} onPageChange={onPageChange} {...NAMES} />)
    expect(onPageChange).toHaveBeenCalledTimes(1)
    expect(onPageChange).toHaveBeenLastCalledWith(4)
    rerender(<Pagination page={4} pageSize={10} total={35} onPageChange={onPageChange} {...NAMES} />)
    expect(onPageChange).toHaveBeenCalledTimes(1)
  })

  it('with no results it paints nothing and still asks for page 1', () => {
    const onPageChange = vi.fn()
    const { container } = render(<Pagination page={3} pageSize={10} total={0} onPageChange={onPageChange} {...NAMES} />)
    expect(container).toBeEmptyDOMElement()
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('without a known total (hasMore) the page is left as it is', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={12} pageSize={10} hasMore itemCount={10} onPageChange={onPageChange} {...NAMES} />)
    expect(onPageChange).not.toHaveBeenCalled()
  })
})

describe('L-4 prose of the browser spec', () => {
  it('the legacy-fields fixme no longer says the phone input is not resized by the wrapper', () => {
    const spec = readFileSync(path.resolve(process.cwd(), 'e2e/product-ui/w07-wrappers.spec.js'), 'utf8')
    expect(spec).not.toMatch(/InputPhoneNumber are not resized by the wrapper/)
    expect(spec).not.toMatch(/is 44px visible on a phone/)
  })
})
