import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CircleAlert } from '../../Icon'
import { OrderRoute } from '../OrderRoute'

const describeStep = step => {
  if (step.state === 'done') return step.at ? `${step.label}, done at ${step.at}` : `${step.label}, done`
  if (step.state === 'next') return `${step.label}, next step`
  if (step.state === 'stop') return `${step.label}, order stopped here`
  return `${step.label}, not reached`
}

const steps = [
  { key: 'placed', label: 'Placed', state: 'done', at: '15:51' },
  { key: 'accepted', label: 'Accepted', state: 'done', at: '15:58' },
  { key: 'ready', label: 'Ready', state: 'next', at: null },
  { key: 'pickedUp', label: 'Picked up', state: 'todo', at: null },
  { key: 'delivered', label: 'Delivered', state: 'todo', at: null }
]

const renderRoute = (props = {}) => render(
  <OrderRoute steps={steps} label='Order progress' describeStep={describeStep} {...props} />
)

describe('Product OrderRoute (C5)', () => {
  it('is a named list with one item per milestone', () => {
    renderRoute()
    const list = screen.getByRole('list', { name: 'Order progress' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(list.closest('.odc-route')).not.toBeNull()
    expect(list.style.getPropertyValue('--steps')).toBe('5')
  })

  it('marks only the next milestone as the current step', () => {
    renderRoute()
    const current = screen.getAllByRole('listitem').filter(item => item.hasAttribute('aria-current'))
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('aria-current', 'step')
    expect(current[0]).toHaveAttribute('data-state', 'next')
  })

  it('has no current step when the order is closed', () => {
    renderRoute({ steps: steps.map(step => ({ ...step, state: 'done' })) })
    expect(screen.getAllByRole('listitem').some(item => item.hasAttribute('aria-current'))).toBe(false)
  })

  it('gives each item its state and reads it to screen readers, hiding the visual copy', () => {
    renderRoute()
    const items = screen.getAllByRole('listitem')
    expect(items.map(item => item.getAttribute('data-state'))).toEqual(['done', 'done', 'next', 'todo', 'todo'])
    expect(within(items[1]).getByText('Accepted, done at 15:58')).toHaveClass('odc-sr-only')
    expect(within(items[2]).getByText('Ready, next step')).toHaveClass('odc-sr-only')
    expect(within(items[4]).getByText('Delivered, not reached')).toHaveClass('odc-sr-only')
    const visibleLabel = within(items[1]).getByText('Accepted')
    expect(visibleLabel).toHaveAttribute('aria-hidden', 'true')
    expect(items[1].querySelector('.odc-route-node')).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws a time only when there is one, in mono, and keeps the grid with a non-breaking space otherwise', () => {
    renderRoute()
    const items = screen.getAllByRole('listitem')
    const time = within(items[0]).getByText('15:51')
    expect(time).toHaveClass('odc-figure') // redesign W0-3a
    expect(time.closest('.odc-route-time')).toHaveAttribute('aria-hidden', 'true')
    expect(items[2].querySelector('.odc-figure')).toBeNull() // redesign W0-3a
    expect(items[2].querySelector('.odc-route-time').textContent).toBe(' ')
    expect(document.querySelectorAll('.odc-figure')).toHaveLength(2) // redesign W0-3a
  })

  it('draws the stop step like any other state, from its own state', () => {
    renderRoute({
      steps: [
        { key: 'placed', label: 'Placed', state: 'done', at: '04:08' },
        { key: 'stop', label: 'Rejected', state: 'stop', at: '04:12' }
      ]
    })
    const items = screen.getAllByRole('listitem')
    expect(items[1]).toHaveAttribute('data-state', 'stop')
    expect(within(items[1]).getByText('Rejected, order stopped here')).toBeInTheDocument()
    expect(screen.getByRole('list').style.getPropertyValue('--steps')).toBe('2')
  })

  it('renders a note under the list with its tone and icon', () => {
    renderRoute({
      note: { tone: 'late', icon: CircleAlert, children: <><b>Delayed 12 min</b> past the estimated time.</> }
    })
    const note = screen.getByText('Delayed 12 min').closest('.odc-route-note')
    expect(note).toHaveAttribute('data-tone', 'late')
    expect(note.querySelector('svg')).not.toBeNull()
    expect(note.previousElementSibling).toBe(screen.getByRole('list'))
  })

  it('renders no note when none is given, and a note without an icon', () => {
    const { container, rerender } = renderRoute()
    expect(container.querySelector('.odc-route-note')).toBeNull()
    rerender(<OrderRoute steps={steps} label='Order progress' describeStep={describeStep} note={{ tone: 'ok', children: 'Completed on time.' }} />)
    const note = screen.getByText('Completed on time.').closest('.odc-route-note')
    expect(note).toHaveAttribute('data-tone', 'ok')
    expect(note.querySelector('svg')).toBeNull()
  })

  it('has no text of its own', () => {
    const { container } = renderRoute({ steps: [] })
    expect(container.textContent).toBe('')
  })

  it('refuses to render without a list name or a screen-reader description', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<OrderRoute steps={steps} describeStep={describeStep} />)).toThrow('OrderRoute needs a label')
    expect(() => render(<OrderRoute steps={steps} label='Order progress' />)).toThrow('OrderRoute needs describeStep')
  })
})

describe('Product OrderRoute with dated milestones (FA-5)', () => {
  const css = readFileSync(path.join(__dirname, '../order-route.css'), 'utf8')
  const rule = selector => {
    const match = css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.[\]]/g, '\\$&')}\\s*{([^}]*)}`))
    return match ? match[1] : ''
  }

  it('lets a dated time break inside its column instead of running past the content edge', () => {
    const time = rule('.odc-route-time')
    expect(time).not.toMatch(/white-space:\s*nowrap/)
    expect(time).toMatch(/overflow-wrap:\s*anywhere/)
  })

  // `anywhere` broke «Angenommen» at any letter («Angenomme» / «n») in a 94px column at 1440 (de). A label
  // breaks between words; a word wider than its column breaks with the language's hyphenation, and only then anywhere.
  it('lets a long label break inside its column, between words or with a hyphen, never cut off or overflowing', () => {
    const label = rule('.odc-route-label')
    expect(label).not.toMatch(/white-space:\s*nowrap/)
    expect(label).not.toMatch(/text-overflow:\s*ellipsis/)
    expect(label).not.toMatch(/overflow-wrap:\s*anywhere/)
    expect(label).toMatch(/overflow-wrap:\s*break-word/)
    expect(label).toMatch(/hyphens:\s*auto/)
  })

  it('keeps the dated time whole and in mono in the markup', () => {
    renderRoute({
      steps: [
        { key: 'placed', label: 'Placed', state: 'done', at: 'Oct 1, 11:51 AM' },
        { key: 'delivered', label: 'Delivered', state: 'done', at: 'Oct 1, 12:53 PM' }
      ]
    })
    const last = screen.getAllByRole('listitem')[1]
    expect(within(last).getByText('Oct 1, 12:53 PM')).toHaveClass('odc-figure') // redesign W0-3a
  })

  it('still turns vertical in a narrow container', () => {
    expect(css).toMatch(/@container \(width < \d+px\)/)
  })
})
