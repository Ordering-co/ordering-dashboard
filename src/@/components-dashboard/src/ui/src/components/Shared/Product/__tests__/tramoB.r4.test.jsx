// redesign tramo B r4 (decision 40, part B, round 4): fixes of the review of tramo B round 3 in the W0-7 wrappers
// (W0-PB3-02, W0-QB3-01, -02, -03). jsdom has no layout: sizes are pinned in the CSS text and in the browser spec
// (e2e/product-ui/w07-wrappers.spec.js), the wiring here with real Base UI.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Field } from '../Field'
import { DatePicker } from '../DatePicker'
import { PageHeader } from '../PageHeader'
import { IconButton } from '../Button'

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

describe('QB3-03 the error id of aria-describedby follows the prop, not the DOM', () => {
  const Select = props => (
    <Field label='Order type' requiredLabel='Required' {...props}>
      <select defaultValue='delivery'>
        <option value='delivery'>Delivery</option>
      </select>
    </Field>
  )
  const Date = props => (
    <Field label='Start date' hint='Starts at midnight.' requiredLabel='Required' {...props}>
      <DatePicker label='Start date' labels={DATE_LABELS} dateFormat='DD/MM/YYYY' locale='en' value={null} onChange={() => {}} />
    </Field>
  )

  it('a native select (no hint): removing the error leaves no aria-describedby at all, in the same render', () => {
    const { rerender } = render(<Select error='Choose a type.' />)
    const select = screen.getByRole('combobox')
    expect(select.getAttribute('aria-describedby')).toMatch(/-error$/)
    rerender(<Select />)
    expect(select).not.toHaveAttribute('aria-describedby')
    expect(select).not.toHaveAttribute('aria-invalid')
  })

  it('a DatePicker (with a hint): removing the error keeps only the hint', () => {
    const { rerender } = render(<Date error='Choose a start date.' />)
    const trigger = screen.getByRole('combobox', { name: /Start date/ })
    expect(trigger.getAttribute('aria-describedby')).toMatch(/-hint .*-error$/)
    rerender(<Date />)
    const describedby = trigger.getAttribute('aria-describedby')
    expect(describedby).toMatch(/-hint$/)
    expect(describedby).not.toMatch(/-error/)
    // every id it points at exists
    for (const id of describedby.split(' ')) expect(document.getElementById(id)).not.toBeNull()
  })

  it('the source decides it from the prop', () => {
    expect(readFileSync(path.resolve(__dirname, '..', 'Field.jsx'), 'utf8')).toMatch(/errorShown: hasError\(error\)/)
  })
})

// ─────────────── PageHeader (W0-QB3-01, W0-QB3-02) ───────────────
// Layout is not measurable in jsdom; the mechanism is pinned in the CSS text and the widths in the browser spec (w07-wrappers.spec.js).

const stripped = file => readFileSync(path.resolve(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (text, selector) => {
  const found = [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, sel]) => sel.trim().replace(/\s+/g, ' ') === selector)
  return found ? found[2].replace(/\s+/g, ' ') : ''
}

describe('QB3-01 / QB3-02 the arrow, title, count and status are one block; only the actions drop to their own line', () => {
  const PAGE = stripped('page-header.css')

  it('the DOM: the row has two children, the block (arrow, title, count, status) and the actions', () => {
    const { container } = render(
      <PageHeader title='La Taquería de Doña Guadalupe — Sucursal Polanco' count={3} countLabel='3 stores' onBack={() => {}} backLabel='Back' primaryAction={<IconButton label='Save' icon={() => null} />} />
    )
    const row = container.querySelector('.odc-pagehead-row')
    expect([...row.children].map(node => node.className.split(' ')[0])).toEqual(['odc-pagehead-lead', 'odc-pagehead-actions'])
    const lead = row.querySelector('.odc-pagehead-lead')
    expect(lead.firstElementChild.tagName).toBe('BUTTON')
    expect(lead).toContainElement(screen.getByRole('heading', { level: 1 }))
    expect(lead.querySelector('.odc-count')).not.toBeNull()
    expect(lead.querySelector('.odc-pagehead-status')).not.toBeNull()
  })

  it('the row wraps at any width and the block is the only thing with a minimum: its flex-basis, not its text', () => {
    expect(rule(PAGE, '.odc-pagehead-row')).toContain('flex-wrap: wrap')
    const lead = rule(PAGE, '.odc-pagehead-lead')
    expect(lead).toMatch(/flex: 1 1 calc\(var\(--od-x-type-title-size\) \* 10\)/)
    expect(lead).toContain('min-inline-size: 0')
    expect(rule(PAGE, '.odc-pagehead-actions')).toMatch(/flex: none/)
  })

  it('the title never widens (flex 0 1 auto, no minimum above 0) and truncates inside the block; the count does not shrink', () => {
    const title = rule(PAGE, '.odc-pagehead-title')
    expect(title).toContain('flex: 0 1 auto')
    expect(title).toContain('min-inline-size: 0')
    expect(title).toContain('text-overflow: ellipsis')
    expect(rule(PAGE, '.odc-pagehead-lead > *')).toContain('flex: none')
  })
})
