import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Metric, MetricGrid } from '../Metric'

// redesign bi FA0 (promoción, auditor 10): the card of a figure with its references, promoted from Home's TodaySummary
const css = readFileSync(resolve(__dirname, '../metric.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const figure = value => <span className='odc-figure'><bdi>{value}</bdi></span>

describe('Metric', () => {
  it('throws without a label (the contract of P/)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Metric value={figure(1)} />)).toThrow(Error)
    spy.mockRestore()
  })

  it('an empty label is allowed and paints empty', () => {
    const { container } = render(<ul><Metric label='' value={figure(1)} /></ul>)
    expect(container.querySelector('.odc-metric-label')).toHaveTextContent('')
  })

  it('paints the label, the value and every reference as a list item', () => {
    const { container } = render(
      <ul>
        <Metric
          data-card='sales'
          label='Today Sales'
          value={figure('$10.00')}
          refs={[
            { text: 'Friday last week, by now', value: figure('$8.00'), lead: true },
            { text: 'Full day', value: figure('$20.00'), secondary: true }
          ]}
        />
      </ul>
    )
    const root = container.querySelector('li.odc-metric')
    expect(root).toHaveAttribute('data-card', 'sales')
    expect(screen.getByText('Today Sales')).toHaveClass('odc-metric-label')
    expect(root.querySelector('.odc-metric-value .odc-figure')).toHaveTextContent('$10.00')
    const refs = root.querySelectorAll('.odc-metric-ref')
    expect(refs).toHaveLength(2)
    expect(refs[0]).toHaveTextContent('Friday last week, by now $8.00')
    expect(refs[0]).toHaveAttribute('data-lead')
    expect(refs[0]).not.toHaveAttribute('data-secondary')
    expect(refs[1]).toHaveTextContent('Full day $20.00')
    expect(refs[1]).toHaveAttribute('data-secondary')
    expect(refs[1]).not.toHaveAttribute('data-lead')
  })

  it('renders as another element with `as` and keeps a class of the caller', () => {
    const { container } = render(<Metric as='div' label='Orders' value={figure(3)} className='mine' />)
    expect(container.firstChild.tagName).toBe('DIV')
    expect(container.firstChild).toHaveClass('odc-metric', 'mine')
  })

  it('loading paints no text and hides the skeletons from assistive technology', () => {
    const { container } = render(
      <ul>
        <Metric
          label='Today Sales'
          value={figure('$10.00')}
          loading
          refs={[{ text: 'Friday last week, by now', value: figure('$8.00') }, { text: 'Full day', value: figure('$20.00'), secondary: true }]}
        />
      </ul>
    )
    const value = container.querySelector('.odc-metric-value')
    expect(value).toHaveAttribute('aria-hidden', 'true')
    expect(value.querySelector('.odc-skeleton')).toBeInTheDocument()
    expect(value.getAttribute('style')).toBeNull()
    const skeleton = value.querySelector('.odc-skeleton').getAttribute('style')
    expect(skeleton).toContain('60%')
    expect(skeleton).toContain('var(--od-x-type-display-size)')
    expect(skeleton).toContain('var(--od-x-leading-title)')
    const refs = container.querySelectorAll('.odc-metric-ref')
    expect(refs).toHaveLength(2)
    refs.forEach(ref => {
      expect(ref).toHaveAttribute('aria-hidden', 'true')
      expect(ref.querySelector('.odc-skeleton')).toBeInTheDocument()
      expect(ref.textContent).toBe('')
      const style = ref.querySelector('.odc-skeleton').getAttribute('style')
      expect(style).toContain('80%')
      expect(style).toContain('var(--od-x-type-caption-size)')
      expect(style).toContain('var(--od-x-leading-ui)')
    })
    expect(refs[0]).toHaveAttribute('data-lead')
    expect(refs[1]).toHaveAttribute('data-secondary')
    expect(container.textContent).not.toContain('$')
    // the label stays: it is the name of the figure that is coming
    expect(screen.getByText('Today Sales')).toBeInTheDocument()
  })
})

describe('MetricGrid', () => {
  it('is a list with data-columns (4 by default)', () => {
    const { container } = render(<MetricGrid><Metric label='A' value={figure(1)} /></MetricGrid>)
    const grid = container.querySelector('ul.odc-metric-grid')
    expect(grid).toHaveAttribute('data-columns', '4')
    expect(grid.querySelectorAll('li.odc-metric')).toHaveLength(1)
  })

  it('takes the columns and a class of the caller', () => {
    const { container } = render(<MetricGrid columns={6} className='mine'><Metric label='A' value={figure(1)} /></MetricGrid>)
    expect(container.firstChild).toHaveAttribute('data-columns', '6')
    expect(container.firstChild).toHaveClass('odc-metric-grid', 'mine')
  })
})

describe('metric.css', () => {
  it('carries the measures of the Home card with the odc-metric names', () => {
    expect(css).toMatch(/\.odc-metric\s*\{[^}]*padding:\s*var\(--od-space-4\)/)
    expect(css).toMatch(/\.odc-metric-value\s*\{[^}]*font-size:\s*var\(--od-x-type-display-size\)/)
    expect(css).toMatch(/\.odc-metric-ref\[data-secondary\]\s*\{[^}]*color:\s*var\(--od-x-text-subtle\)/)
    expect(css).toMatch(/\.odc-metric-help\s*\{[^}]*var\(--od-x-text-subtle\)/)
    expect(css).not.toContain('odc-today')
  })

  it('reserves two lines for the first reference on a phone', () => {
    const phone = css.split('@media (max-width: 767px)')[1]
    expect(phone).toMatch(/\.odc-metric\s*\{[^}]*padding:\s*var\(--od-space-3\)/)
    expect(phone).toMatch(/\.odc-metric-ref\[data-lead\]\s*\{[^}]*min-block-size:\s*calc\(var\(--od-x-type-caption-size\)\s*\*\s*var\(--od-x-leading-ui\)\s*\*\s*2\)/)
  })

  // redesign bi R1 (F4): a figure with its currency never breaks across lines in a reference («Yesterday by this time: $» / «119.03»)
  it('keeps a figure of a reference on one line', () => {
    expect(css).toMatch(/\.odc-metric-ref\s+\.odc-figure\s*\{[^}]*white-space:\s*nowrap/)
  })

  it('grid: two columns below 1024, the columns from 1024 (6 is three, then six from 1280)', () => {
    expect(css).toMatch(/\.odc-metric-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
    const from1024 = css.split('@media (min-width: 1024px)')[1]
    expect(from1024).toMatch(/\.odc-metric-grid\s*\{[^}]*repeat\(4,/)
    expect(from1024).toMatch(/\.odc-metric-grid\[data-columns='6'\]\s*\{[^}]*repeat\(3,/)
    const from1280 = css.split('@media (min-width: 1280px)')[1]
    expect(from1280).toMatch(/\.odc-metric-grid\[data-columns='6'\]\s*\{[^}]*repeat\(6,/)
  })

  it('uses tokens only: no literal color, length, weight or z-index', () => {
    const declarations = Array.from(css.matchAll(/([a-z-]+):\s*([^;{}]+);/g))
    declarations.forEach(([, property, value]) => {
      expect(value, `${property}: ${value}`).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\d(px|rem|em|ms|s)\b/i)
      if (property === 'z-index' || property === 'font-weight') expect(value).toMatch(/var\(/)
    })
  })
})
