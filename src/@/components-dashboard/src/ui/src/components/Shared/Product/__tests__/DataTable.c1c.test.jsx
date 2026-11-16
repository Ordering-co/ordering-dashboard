import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DataTable } from '../DataTable'

// redesign W1 tramo C r1 fixes (C1c): the opt-in options DataTable gained for «Estado de tiendas» (W1-PC1-03, W1-QC1-11, W1-QC1-15).
const ROWS = [
  { id: 'a', name: 'North Store', total: 4 },
  { id: 'b', name: 'South Store', total: 7 },
  { id: 'c', name: 'East Store', total: 1 }
]
const COLUMNS = [
  { id: 'name', header: 'Store', cell: row => row.name, rowHeader: true },
  { id: 'total', header: 'Total', cell: row => String(row.total), align: 'end' },
  { id: 'link', header: 'Link', cell: row => <a href={`#${row.id}`}>{`Open ${row.name}`}</a> }
]

let observers = []
class MockResizeObserver {
  constructor (callback) { this.callback = callback; observers.push(this) }
  observe () {}
  unobserve () {}
  disconnect () { observers = observers.filter(item => item !== this) }
}
beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
})
afterEach(() => vi.unstubAllGlobals())

const renderTable = (props = {}) => render(
  <DataTable label='Stores' columns={COLUMNS} rows={ROWS} getRowId={row => row.id} {...props} />
)
const bodyRows = () => Array.from(document.querySelectorAll('tbody tr[data-row-id]'))
const overflowing = (fn) => {
  const scrollWidth = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(601)
  const clientWidth = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(342)
  try { return fn() } finally { scrollWidth.mockRestore(); clientWidth.mockRestore() }
}
const css = readFileSync(path.resolve(__dirname, '../data-table.css'), 'utf8')

describe('DataTable rows without an action (W1-PC1-03)', () => {
  it('without onOpenRow or selection the rows are not interactive: no tab stop, no mark, no key or click handling', async () => {
    renderTable()
    bodyRows().forEach(row => {
      expect(row).not.toHaveAttribute('tabindex')
      expect(row).not.toHaveAttribute('data-interactive')
    })
    bodyRows()[0].focus()
    expect(bodyRows()[0]).not.toHaveFocus() // not focusable
    fireEvent.click(screen.getByText('South Store'))
    await userEvent.keyboard('{ArrowDown}')
    expect(document.body).toHaveFocus()
  })

  it('leaves the controls inside inert rows in the natural tab order (no roving tab stop to manage)', () => {
    renderTable()
    screen.getAllByRole('link').forEach(link => expect(link.tabIndex).toBe(0))
  })

  it('an onOpenRow makes the rows interactive: tab stop on one row, the mark, Enter and click open it', async () => {
    const onOpenRow = vi.fn()
    renderTable({ onOpenRow })
    expect(bodyRows().map(row => row.tabIndex)).toEqual([0, -1, -1])
    bodyRows().forEach(row => expect(row).toHaveAttribute('data-interactive'))
    bodyRows()[1].focus()
    await userEvent.keyboard('{Enter}')
    expect(onOpenRow).toHaveBeenCalledWith(ROWS[1])
  })

  it('a selection alone makes the rows interactive too (Space selects)', () => {
    const onToggle = vi.fn()
    renderTable({ selection: { selectedIds: [], onToggle, onToggleAll: vi.fn(), rowLabel: row => `Select ${row.name}`, allLabel: 'Select all' } })
    bodyRows().forEach(row => expect(row).toHaveAttribute('data-interactive'))
    expect(bodyRows().map(row => row.tabIndex)).toEqual([0, -1, -1])
  })

  it('the cursor and the hover of action live on the interactive rows only', () => {
    expect(css).toMatch(/tbody tr\[data-interactive\] \{ cursor: pointer; \}/)
    expect(css).toMatch(/tbody tr\[data-interactive\]:hover td/)
    expect(css).not.toMatch(/tbody tr\[data-row-id\] \{ cursor: pointer; \}/)
    expect(css).not.toMatch(/tbody tr\[data-row-id\]:hover td/)
  })
})

describe('DataTable scroll region (W1-PC1-03, W1-QC1-11)', () => {
  it('an inert table that overflows has a focusable scroller named by the table label', () => {
    const { container } = overflowing(() => renderTable())
    const scroller = container.querySelector('.odc-table-scroll')
    expect(scroller).toHaveAttribute('tabindex', '0')
    expect(scroller).toHaveAttribute('role', 'region')
    expect(scroller).toHaveAttribute('aria-label', 'Stores')
  })

  it('an inert table that fits has no tab stop on the scroller', () => {
    const { container } = renderTable()
    const scroller = container.querySelector('.odc-table-scroll')
    expect(scroller).not.toHaveAttribute('tabindex')
    expect(scroller).not.toHaveAttribute('role')
  })

  it('a table with interactive rows never makes the scroller a tab stop (its rows are the stop)', () => {
    const { container } = overflowing(() => renderTable({ onOpenRow: vi.fn() }))
    expect(container.querySelector('.odc-table-scroll')).not.toHaveAttribute('tabindex')
  })

  it('the focus ring of the scroller uses the tokens', () => {
    expect(css).toMatch(/\.odc-table-scroll\[tabindex\]:focus-visible \{[^}]*outline: var\(--od-focus-ring-width\) solid var\(--od-focus-ring-color\)/)
  })

  it('scrollLabel names the region and adds the edge fade, whatever the rows do', () => {
    const { container } = renderTable({ scrollLabel: 'Stores table, scrolls sideways', onOpenRow: vi.fn() })
    const scroller = container.querySelector('.odc-table-scroll')
    expect(scroller).toHaveClass('odc-fade-x')
    expect(scroller).toHaveAttribute('role', 'region')
    expect(scroller).toHaveAttribute('aria-label', 'Stores table, scrolls sideways')
    expect(screen.getByRole('region', { name: 'Stores table, scrolls sideways' })).toContainElement(screen.getByRole('table', { name: 'Stores' }))
  })

  it('without scrollLabel the scroller has no fade class (opt-in: /orders is unchanged)', () => {
    const { container } = renderTable({ onOpenRow: vi.fn() })
    expect(container.querySelector('.odc-table-scroll')).not.toHaveClass('odc-fade-x')
  })

  it('the fade shows while there is more to the end, through the overflow edges the scroller already reports', () => {
    const { container } = overflowing(() => renderTable({ scrollLabel: 'Stores' }))
    expect(container.querySelector('.odc-table-scroll')).toHaveAttribute('data-overflow-end')
  })
})

describe('DataTable row header (W1-QC1-15)', () => {
  it('a column with rowHeader paints th[scope=row] in the body, and the other cells stay td', () => {
    const { container } = renderTable()
    const first = container.querySelector('tbody tr[data-row-id]')
    expect(first.children[0].tagName).toBe('TH')
    expect(first.children[0]).toHaveAttribute('scope', 'row')
    expect(first.children[1].tagName).toBe('TD')
    expect(screen.getAllByRole('rowheader').map(node => node.textContent)).toEqual(['North Store', 'South Store', 'East Store'])
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(3)
  })

  it('without rowHeader every body cell is a td, as before', () => {
    const { container } = renderTable({ columns: COLUMNS.map(({ rowHeader, ...column }) => column) })
    expect(container.querySelectorAll('tbody th')).toHaveLength(0)
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0)
  })

  it('the row header carries the same cell rules: height, padding, border, wrap, alignment, hover and selection layers', () => {
    ;[
      /tbody :where\(td, th\[scope='row'\]\) \{[^}]*block-size: var\(--od-x-row-comfortable\)/,
      /compact'\] tbody :where\(td, th\[scope='row'\]\) \{ block-size: var\(--od-x-row-compact\)/,
      /tbody tr\[data-interactive\]:hover th\[scope='row'\]/,
      /tbody tr\[data-checked\] th\[scope='row'\]/,
      /tbody tr\[data-new\] th\[scope='row'\]/,
      /th\[scope='row'\][^{]*\{[^}]*font-weight: inherit/,
      /@media \(pointer: coarse\) \{[\s\S]*tbody th\[scope='row'\],\s*\.odc-table\[data-density='compact'\] tbody th\[scope='row'\] \{\s*block-size: var\(--od-x-target-coarse\)/
    ].forEach(pattern => expect(css).toMatch(pattern))
  })

  it('the loading rows keep their td cells (they are decoration)', () => {
    const { container } = renderTable({ loading: true })
    expect(container.querySelectorAll('tbody th')).toHaveLength(0)
    expect(container.querySelectorAll('tbody tr[data-skeleton] td').length).toBeGreaterThan(0)
    act(() => {})
  })
})
