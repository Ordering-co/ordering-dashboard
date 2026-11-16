import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DataTable } from '../DataTable'
import { Skeleton } from '../Feedback'

// redesign F4 (C20): the loading rows of the table are the grid of the final content: the same visible columns,
// the same selection column, the header in place, the shape of each cell (lines and a lead), and the busy
// region says what it waits for. Nothing here depends on the orders page.

const ROWS = [{ id: 'a', number: '#1' }]
const COLUMNS = [
  { id: 'number', header: 'Order', cell: row => row.number, className: 'col-first', skeleton: { lines: 2, floor: 'var(--od-x-sk-order)' } },
  { id: 'status', header: 'Status', cell: () => 'Done', skeleton: { lead: 'dot' } },
  { id: 'customer', header: 'Customer', cell: () => 'Grace', skeleton: { lines: 2, lead: 'avatar' } },
  { id: 'plain', header: 'Plain', cell: () => 'x' },
  { id: 'total', header: 'Total', cell: () => '$1', align: 'end', skeleton: { lines: 2 } }
]
const SELECTION = {
  selectedIds: [],
  onToggle: vi.fn(),
  onToggleAll: vi.fn(),
  rowLabel: row => `Select ${row.number}`,
  allLabel: 'Select all'
}

class MockResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}
beforeEach(() => vi.stubGlobal('ResizeObserver', MockResizeObserver))
afterEach(() => vi.unstubAllGlobals())

const renderLoading = (props = {}) => render(
  <DataTable label='Orders' columns={COLUMNS} rows={[]} getRowId={row => row.id} loading {...props} />
)
const skeletonRows = container => Array.from(container.querySelectorAll('tbody tr[data-skeleton]'))

describe('DataTable loading rows: the grid of the content', () => {
  it('draws skeletonRows rows, each with one cell per header cell', () => {
    const { container } = renderLoading({ skeletonRows: 7, selection: SELECTION })
    const rows = skeletonRows(container)
    expect(rows).toHaveLength(7)
    const headers = container.querySelectorAll('thead th').length
    expect(headers).toBe(COLUMNS.length + 1)
    rows.forEach(row => expect(row.querySelectorAll('td')).toHaveLength(headers))
  })

  it('keeps the sticky header with the visible columns only', () => {
    const { container } = renderLoading({ hiddenColumnIds: ['plain'] })
    expect(Array.from(container.querySelectorAll('thead th')).map(th => th.textContent)).toEqual(['Order', 'Status', 'Customer', 'Total'])
    skeletonRows(container).forEach(row => expect(row.querySelectorAll('td')).toHaveLength(4))
  })

  it('has no skeleton cell for a column the user hid, whatever its shape', () => {
    const { container } = renderLoading({ hiddenColumnIds: ['customer'] })
    expect(container.querySelector('.odc-skeleton[data-shape="round"][style*="--od-x-avatar"]')).toBeNull()
  })

  it('gives the selection cell and the column class of the content to the skeleton cells', () => {
    const { container } = renderLoading({ selection: SELECTION })
    const row = skeletonRows(container)[0]
    expect(row.querySelector('td[data-selection]')).not.toBeNull()
    expect(row.querySelectorAll('td')[1]).toHaveClass('col-first')
  })

  it('draws the selection cell as a checkbox-shaped box, not a text line', () => {
    const { container } = renderLoading({ selection: SELECTION })
    const cell = skeletonRows(container)[0].querySelector('td[data-selection]')
    const box = cell.querySelector('.odc-skeleton')
    expect(box).toHaveAttribute('data-shape', 'box')
    expect(box.style.inlineSize).toBe('var(--od-x-checkbox-box)')
    expect(box.style.blockSize).toBe('var(--od-x-checkbox-box)')
  })

  it('shapes a cell from column.skeleton: lines, lead and floor', () => {
    const { container } = renderLoading()
    const [number, status, customer, plain, total] = Array.from(skeletonRows(container)[0].querySelectorAll('td'))
    // two lines, and the width the content asks for
    expect(number.querySelectorAll('.odc-sk-lines > .odc-skeleton')).toHaveLength(2)
    // redesign F6e-3 (Q4-03): the floor sits on the cell itself (as on the real cell), not on a box inside it
    expect(number.style.getPropertyValue('--odc-col-floor')).toBe('var(--od-x-sk-order)')
    // a dot, then one line
    expect(status.querySelectorAll('.odc-skeleton[data-shape="round"]')).toHaveLength(1)
    expect(status.querySelectorAll('.odc-sk-lines > .odc-skeleton')).toHaveLength(1)
    // an avatar of the avatar token, then two lines
    const avatar = customer.querySelector('.odc-skeleton[data-shape="round"]')
    expect(avatar.style.inlineSize).toBe('var(--od-x-avatar)')
    expect(avatar.style.blockSize).toBe('var(--od-x-avatar)')
    expect(customer.querySelectorAll('.odc-sk-lines > .odc-skeleton')).toHaveLength(2)
    // no descriptor: what the table drew before (one line)
    expect(plain.querySelectorAll('.odc-sk-lines > .odc-skeleton')).toHaveLength(1)
    expect(plain.style.getPropertyValue('--odc-col-floor')).toBe('')
    expect(plain).not.toHaveAttribute('data-floor')
    // the end-aligned column keeps its alignment
    expect(total).toHaveAttribute('data-align', 'end')
    total.querySelectorAll('.odc-sk-lines > .odc-skeleton').forEach(line => expect(line).toHaveAttribute('data-align', 'end'))
  })

  it('keeps the density of the table, so the skeleton rows are as tall as the real ones', () => {
    const { container } = renderLoading({ density: 'compact' })
    expect(container.querySelector('table')).toHaveAttribute('data-density', 'compact')
    expect(skeletonRows(container)[0]).toHaveAttribute('data-skeleton')
  })
})

describe('DataTable loading: the busy region', () => {
  it('marks the region and the table busy and says what it waits for in hidden text', () => {
    const { container } = renderLoading({ loadingLabel: 'Loading orders' })
    expect(container.querySelector('.odc-table-scroll')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('table', { name: 'Orders' })).toHaveAttribute('aria-busy', 'true')
    const label = screen.getByText('Loading orders')
    expect(label).toHaveClass('odc-sr-only')
    expect(container.querySelector('.odc-table-scroll').contains(label)).toBe(true)
    // the table's own rows stay out of the accessibility tree
    skeletonRows(container).forEach(row => expect(row).toHaveAttribute('aria-hidden', 'true'))
  })

  it('without a loadingLabel nothing extra is drawn (backwards compatible)', () => {
    const { container } = renderLoading()
    expect(container.querySelector('.odc-table-scroll > .odc-sr-only')).toBeNull()
  })

  it('is not busy and has no label once the rows are there', () => {
    const { container } = render(
      <DataTable label='Orders' columns={COLUMNS} rows={ROWS} getRowId={row => row.id} loading={false} loadingLabel='Loading orders' />
    )
    expect(container.querySelector('.odc-table-scroll')).not.toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('table', { name: 'Orders' })).not.toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Loading orders')).toBeNull()
    expect(container.querySelector('[data-skeleton]')).toBeNull()
  })
})

describe('Skeleton primitive', () => {
  it('draws a box or a circle of a given size, still decorative', () => {
    const { container } = render(<Skeleton size='var(--od-x-avatar)' block='var(--od-x-avatar)' shape='round' />)
    const node = container.firstChild
    expect(node).toHaveAttribute('aria-hidden', 'true')
    expect(node).toHaveAttribute('data-shape', 'round')
    expect(node.style.blockSize).toBe('var(--od-x-avatar)')
  })

  it('keeps the line by default', () => {
    const { container } = render(<Skeleton size='40%' />)
    expect(container.firstChild).toHaveAttribute('data-shape', 'line')
    expect(container.firstChild.style.blockSize).toBe('')
  })
})

describe('Skeleton stylesheet', () => {
  const css = readFileSync(resolve(__dirname, '../feedback.css'), 'utf8')
  const tableCss = readFileSync(resolve(__dirname, '../data-table.css'), 'utf8')

  it('shimmers with --od-x-shimmer and stops under prefers-reduced-motion', () => {
    expect(css).toMatch(/animation:\s*odc-shimmer var\(--od-x-shimmer\) infinite/)
    const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)
    expect(reduced?.[1]).toMatch(/\.odc-skeleton::after\s*\{\s*animation:\s*none/)
  })

  it('draws the shapes of the rows from tokens', () => {
    expect(css).toMatch(/\.odc-skeleton\[data-shape='round'\][^}]*border-radius:\s*var\(--od-radius-round\)/)
    // redesign F6e-3 (Q4-03): the floor is a rule of the cell, shared by the loading and the loaded rows (see below)
    expect(tableCss).not.toMatch(/\.odc-sk-cell\s*\{[^}]*min-inline-size/)
    expect(tableCss).toMatch(/\.odc-sk-check\s*\{[^}]*inline-size:\s*var\(--od-x-target-fine\)/)
  })
})

// redesign F6e-3 (Q4-03): a column that names a floor asks for the same width while it loads and once the rows are
// there: the header cell, the loading cell and the real cell carry the same floor, and one stylesheet rule turns it
// into a minimum width of the cell (content plus the padding that cell has), so the grid does not move when the rows arrive.
describe('DataTable floor: the same width rule before and after the rows', () => {
  const tableCss = readFileSync(resolve(__dirname, '../data-table.css'), 'utf8')
  const floors = cells => cells.map(node => node.style.getPropertyValue('--odc-col-floor'))
  const dataRows = [{ id: 'a', number: '#1' }, { id: 'b', number: '#2' }]
  const renderLoaded = (props = {}) => render(
    <DataTable label='Orders' columns={COLUMNS} rows={dataRows} getRowId={row => row.id} {...props} />
  )

  it('puts the floor on the header cell, on the loading cell and on the real cell of the column', () => {
    const loading = renderLoading({ selection: SELECTION })
    const loadingHead = floors(Array.from(loading.container.querySelectorAll('thead th')))
    const loadingCells = floors(Array.from(skeletonRows(loading.container)[0].querySelectorAll('td')))
    loading.unmount()
    const loaded = renderLoaded({ selection: SELECTION })
    const loadedHead = floors(Array.from(loaded.container.querySelectorAll('thead th')))
    const loadedCells = floors(Array.from(loaded.container.querySelectorAll('tbody tr[data-row-id]')[0].querySelectorAll('td')))
    const expected = ['', 'var(--od-x-sk-order)', '', '', '', '']
    expect(loadingHead).toEqual(expected)
    expect(loadingCells).toEqual(expected)
    expect(loadedHead).toEqual(expected)
    expect(loadedCells).toEqual(expected)
    expect(loaded.container.querySelectorAll('[data-floor]')).toHaveLength(1 + dataRows.length)
  })

  it('drops the floor of a column the user hid, in both states', () => {
    const { container } = renderLoaded({ hiddenColumnIds: ['number'] })
    expect(container.querySelectorAll('[data-floor]')).toHaveLength(0)
  })

  it('turns the floor into a minimum width that adds the padding of the cell, the page gutter at the ends', () => {
    const rule = selector => {
      const escaped = selector.replace(/[.[\]()*:]/g, '\\$&')
      return (tableCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`)) || [])[1] || ''
    }
    expect(rule('.odc-table [data-floor]')).toMatch(/min-inline-size:\s*calc\(var\(--odc-col-floor\)\s*\+\s*var\(--odc-floor-pad\)\)/)
    expect(rule('.odc-table [data-floor]')).toMatch(/--odc-floor-pad:\s*calc\(2 \* var\(--od-space-3\)\)/)
    expect(rule('.odc-table [data-floor]:first-child')).toMatch(/--odc-floor-pad:\s*calc\(var\(--od-x-page-gutter\)\s*\+\s*var\(--od-space-3\)\)/)
    expect(rule('.odc-table [data-floor]:last-child')).toMatch(/--odc-floor-pad:\s*calc\(var\(--od-space-3\)\s*\+\s*var\(--od-x-page-gutter\)\)/)
    expect(rule('.odc-table [data-floor]:first-child:last-child')).toMatch(/--odc-floor-pad:\s*calc\(2 \* var\(--od-x-page-gutter\)\)/)
  })
})
