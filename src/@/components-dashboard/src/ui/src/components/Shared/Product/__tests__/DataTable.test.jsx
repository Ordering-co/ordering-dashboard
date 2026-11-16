import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'
import { DataTable } from '../DataTable'

const ROWS = [
  { id: 'a', number: '#13792', customer: 'Grace Okafor', total: '$35.23' },
  { id: 'b', number: '#13791', customer: 'Mei Tanaka', total: '$18.00' },
  { id: 'c', number: '#13790', customer: 'Luis Ortega', total: '$62.10' }
]

const COLUMNS = [
  { id: 'number', header: 'Order', cell: row => <b>{row.number}</b>, locked: true },
  { id: 'customer', header: 'Customer', cell: row => row.customer, hideBelow: 800 },
  { id: 'total', header: 'Total', cell: row => row.total, align: 'end', hideBelow: 600 },
  {
    id: 'actions',
    header: null,
    srHeader: 'Actions',
    cell: row => <Button size='sm' onClick={row.onAction}>{`Assign ${row.number}`}</Button>
  }
]

let observers = []
class MockResizeObserver {
  constructor (callback) {
    this.callback = callback
    observers.push(this)
  }

  observe () {}
  unobserve () {}
  disconnect () { observers = observers.filter(item => item !== this) }
}
const resizeTo = width => act(() => {
  observers.forEach(item => item.callback([{ contentRect: { width } }], item))
})

beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
})
afterEach(() => vi.unstubAllGlobals())

const selectionProps = (selectedIds = [], extra = {}) => ({
  selection: {
    selectedIds,
    onToggle: vi.fn(),
    onToggleAll: vi.fn(),
    rowLabel: row => `Select order ${row.number}`,
    allLabel: 'Select all orders on this page'
  },
  ...extra
})

const renderTable = (props = {}) => render(
  <DataTable label='Orders' columns={COLUMNS} rows={ROWS} getRowId={row => row.id} {...props} />
)

const rowOf = number => screen.getByText(number).closest('tr')

describe('DataTable structure (C6)', () => {
  it('is a named table inside a scroll container, with column headers', () => {
    const { container } = renderTable({ density: 'compact' })
    const table = screen.getByRole('table', { name: 'Orders' })
    expect(table.closest('.odc-table-scroll')).not.toBeNull()
    expect(table).toHaveAttribute('data-density', 'compact')
    expect(table).toHaveAttribute('aria-busy', 'false')
    expect(screen.getAllByRole('columnheader')).toHaveLength(4)
    expect(screen.getByRole('columnheader', { name: 'Order' })).toHaveAttribute('scope', 'col')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
  })

  it('names a visually empty header for assistive technology and right-aligns numbers', () => {
    renderTable()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.getByText('Actions')).toHaveClass('odc-sr-only')
    expect(screen.getByText('$35.23').closest('td')).toHaveAttribute('data-align', 'end')
    expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveAttribute('data-align', 'end')
  })

  it('refuses a table without a label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<DataTable columns={COLUMNS} rows={ROWS} getRowId={row => row.id} />)).toThrow('DataTable needs a label')
  })

  it('marks the active, checked and newly arrived rows with data attributes', () => {
    renderTable({ ...selectionProps(['b']), activeRowId: 'a', newRowIds: ['c'] })
    expect(rowOf('#13792')).toHaveAttribute('data-active')
    expect(rowOf('#13792')).toHaveAttribute('aria-current', 'true')
    expect(rowOf('#13791')).toHaveAttribute('data-checked')
    expect(rowOf('#13790')).toHaveAttribute('data-new')
    expect(rowOf('#13790')).not.toHaveAttribute('data-checked')
  })
})

describe('DataTable selection (C6)', () => {
  it.each([
    [[], 'false'],
    [['a'], 'mixed'],
    [['a', 'b', 'c'], 'true']
  ])('header checkbox with %j selected reads aria-checked=%s', (selectedIds, expected) => {
    renderTable(selectionProps(selectedIds))
    expect(screen.getByRole('checkbox', { name: 'Select all orders on this page' })).toHaveAttribute('aria-checked', expected)
  })

  it('ignores selected ids that are not on the page when it computes the header', () => {
    renderTable(selectionProps(['zz']))
    expect(screen.getByRole('checkbox', { name: 'Select all orders on this page' })).toHaveAttribute('aria-checked', 'false')
  })

  it('selects every row from the header, and clears when all are selected', async () => {
    const empty = selectionProps([])
    const { unmount } = renderTable(empty)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all orders on this page' }))
    expect(empty.selection.onToggleAll).toHaveBeenCalledWith(true)
    unmount()
    const full = selectionProps(['a', 'b', 'c'])
    renderTable(full)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all orders on this page' }))
    expect(full.selection.onToggleAll).toHaveBeenCalledWith(false)
  })

  it('names each row checkbox with rowLabel and toggles it without opening the row', async () => {
    const onOpenRow = vi.fn()
    const props = selectionProps([])
    renderTable({ ...props, onOpenRow })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select order #13791' }))
    expect(props.selection.onToggle).toHaveBeenCalledWith('b', ROWS[1])
    expect(onOpenRow).not.toHaveBeenCalled()
  })

  // redesign fix-qa E7: while the rows load there is nothing to select, so the header checkbox is inert. It stays
  // focusable (aria-disabled, not disabled): a scroller with no focusable content fails axe's scrollable-region-focusable.
  it('makes the select-all checkbox inert while the table loads, and live after', async () => {
    const props = selectionProps()
    const { rerender } = renderTable({ ...props, loading: true })
    const all = () => screen.getByRole('checkbox', { name: 'Select all orders on this page' })
    expect(all()).toHaveAttribute('aria-disabled', 'true')
    expect(all()).not.toBeDisabled()
    await userEvent.setup().click(all())
    expect(props.selection.onToggleAll).not.toHaveBeenCalled()
    rerender(<DataTable label='Orders' columns={COLUMNS} rows={ROWS} getRowId={row => row.id} {...props} />)
    expect(all()).not.toHaveAttribute('aria-disabled')
    await userEvent.setup().click(all())
    expect(props.selection.onToggleAll).toHaveBeenCalledWith(true)
  })

  // redesign fix-qa E7: a table that overflows sideways says which edges have more (the pinned column shows its edge then).
  it('marks the scroller with the overflow edges while it has more to show sideways', () => {
    const scrollWidth = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400)
    const clientWidth = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(900)
    try {
      const { container } = renderTable()
      const scroller = container.querySelector('.odc-table-scroll')
      expect(scroller).toHaveAttribute('data-overflow-end')
      expect(scroller).not.toHaveAttribute('data-overflow-start')
      scroller.scrollLeft = 200
      fireEvent.scroll(scroller)
      expect(scroller).toHaveAttribute('data-overflow-start')
    } finally {
      scrollWidth.mockRestore()
      clientWidth.mockRestore()
    }
  })

  it('marks no overflow edge when everything fits', () => {
    const { container } = renderTable()
    const scroller = container.querySelector('.odc-table-scroll')
    expect(scroller).not.toHaveAttribute('data-overflow-end')
    expect(scroller).not.toHaveAttribute('data-overflow-start')
  })

  it('has no selection column without a selection prop', () => {
    renderTable()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('DataTable keyboard: one tab stop per table (C6)', () => {
  const rows = () => Array.from(document.querySelectorAll('tbody tr'))
  const onOpenRow = () => {} // redesign W1 tramo C r1 (C1c): a table with neither onOpenRow nor selection has no interactive rows (DataTable.c1c.test.jsx)

  it('gives tabIndex 0 only to the first row, or to the active row when it is on the page', () => {
    const { unmount } = renderTable(selectionProps())
    expect(rows().map(row => row.tabIndex)).toEqual([0, -1, -1])
    unmount()
    renderTable({ ...selectionProps(), activeRowId: 'b' })
    expect(rows().map(row => row.tabIndex)).toEqual([-1, 0, -1])
  })

  it('falls back to the first row when the active row is not on the page', () => {
    renderTable({ activeRowId: 'elsewhere', onOpenRow }) // redesign W1 tramo C r1 (C1c): rows are interactive when the table opens or selects them
    expect(rows().map(row => row.tabIndex)).toEqual([0, -1, -1])
  })

  it('takes the controls of every other row out of the tab order', () => {
    renderTable(selectionProps())
    const [first, second, third] = rows()
    ;[second, third].forEach(row => {
      row.querySelectorAll('button').forEach(button => expect(button.tabIndex).toBe(-1))
    })
    first.querySelectorAll('button').forEach(button => expect(button.tabIndex).toBe(0))
    expect(within(second).getByRole('checkbox').tabIndex).toBe(-1)
    expect(within(first).getByRole('checkbox').tabIndex).toBe(0)
  })

  it('Tab enters on the row, then its checkbox and button, then leaves the table', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type='button'>before</button>
        <DataTable label='Orders' columns={COLUMNS} rows={ROWS} getRowId={row => row.id} {...selectionProps()} />
        <button type='button'>after</button>
      </>
    )
    await user.tab()
    expect(screen.getByRole('button', { name: 'before' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('checkbox', { name: 'Select all orders on this page' })).toHaveFocus()
    await user.tab()
    expect(rows()[0]).toHaveFocus()
    await user.tab()
    expect(within(rows()[0]).getByRole('checkbox')).toHaveFocus()
    await user.tab()
    expect(within(rows()[0]).getByRole('button', { name: 'Assign #13792' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus()
  })

  it('moves the tab stop with the focus: arrows, Home and End', async () => {
    const user = userEvent.setup()
    renderTable({ onOpenRow }) // redesign W1 tramo C r1 (C1c): rows are interactive when the table opens or selects them
    rows()[0].focus()
    await user.keyboard('{ArrowDown}')
    expect(rows()[1]).toHaveFocus()
    expect(rows().map(row => row.tabIndex)).toEqual([-1, 0, -1])
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(rows()[2]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(rows()[1]).toHaveFocus()
    await user.keyboard('{End}')
    expect(rows()[2]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(rows()[0]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(rows()[0]).toHaveFocus()
  })

  it('Enter opens the row', async () => {
    const onOpenRow = vi.fn()
    renderTable({ onOpenRow })
    rows()[1].focus()
    await userEvent.keyboard('{Enter}')
    expect(onOpenRow).toHaveBeenCalledWith(ROWS[1])
  })

  it('Space toggles the row selection and does not scroll', async () => {
    const props = selectionProps()
    renderTable(props)
    rows()[2].focus()
    const notPrevented = fireEvent.keyDown(rows()[2], { key: ' ', code: 'Space' })
    expect(props.selection.onToggle).toHaveBeenCalledWith('c', ROWS[2])
    expect(notPrevented).toBe(false)
  })

  it('Space does nothing when there is no selection, Esc clears the selection', async () => {
    const onOpenRow = vi.fn()
    const onClearSelection = vi.fn()
    renderTable({ onOpenRow, onClearSelection })
    rows()[0].focus()
    await userEvent.keyboard(' ')
    expect(onOpenRow).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClearSelection).toHaveBeenCalledOnce()
  })

  it('does not run a row action for keys that come from a control inside the row', async () => {
    const onOpenRow = vi.fn()
    const onClearSelection = vi.fn()
    const onAction = vi.fn()
    const props = selectionProps()
    const rowsWithAction = ROWS.map(row => ({ ...row, onAction }))
    renderTable({ ...props, rows: rowsWithAction, onOpenRow, onClearSelection })
    const button = screen.getByRole('button', { name: 'Assign #13792' })
    button.focus()
    await userEvent.keyboard(' ')
    expect(onAction).toHaveBeenCalledOnce()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{ArrowDown}')
    expect(props.selection.onToggle).not.toHaveBeenCalled()
    expect(onOpenRow).not.toHaveBeenCalled()
    expect(button).toHaveFocus()
  })

  it('clears the selection with Esc from anywhere in the row, a control included (it activates nothing)', async () => {
    const onClearSelection = vi.fn()
    renderTable({ ...selectionProps(), onClearSelection })
    within(rows()[1]).getByRole('checkbox').focus()
    await userEvent.keyboard('{Escape}')
    expect(onClearSelection).toHaveBeenCalledOnce()
  })

  it('makes the row the tab stop when focus lands on one of its controls', async () => {
    renderTable(selectionProps())
    await userEvent.click(within(rows()[2]).getByRole('checkbox'))
    expect(rows().map(row => row.tabIndex)).toEqual([-1, -1, 0])
  })

  it('shows a visible keyboard focus target on the row (outline lives in CSS)', () => {
    renderTable({ onOpenRow }) // redesign W1 tramo C r1 (C1c): rows are interactive when the table opens or selects them
    expect(rows()[0]).toHaveAttribute('tabindex', '0')
  })
})

describe('DataTable pointer', () => {
  it('opens the row on a click outside any control, but not from a button inside it', async () => {
    const onOpenRow = vi.fn()
    const onAction = vi.fn()
    renderTable({ onOpenRow, rows: ROWS.map(row => ({ ...row, onAction })) })
    await userEvent.click(screen.getByText('Mei Tanaka'))
    expect(onOpenRow).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }))
    onOpenRow.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Assign #13791' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(onOpenRow).not.toHaveBeenCalled()
  })
})

describe('DataTable columns', () => {
  it('does not paint the columns the user hid', () => {
    renderTable({ hiddenColumnIds: ['customer'] })
    expect(screen.queryByRole('columnheader', { name: 'Customer' })).toBeNull()
    expect(screen.queryByText('Grace Okafor')).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument()
  })

  it('hides the columns whose hideBelow is above the container width, never the locked ones', () => {
    const onWidthHiddenChange = vi.fn()
    renderTable({ onWidthHiddenChange })
    expect(screen.getByRole('columnheader', { name: 'Customer' })).toBeInTheDocument()
    resizeTo(700)
    expect(screen.queryByRole('columnheader', { name: 'Customer' })).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument()
    resizeTo(300)
    expect(screen.queryByRole('columnheader', { name: 'Total' })).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Order' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
    resizeTo(1200)
    expect(screen.getByRole('columnheader', { name: 'Customer' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument()
  })

  it('reports the width-hidden set once per change, not once per resize', () => {
    const onWidthHiddenChange = vi.fn()
    renderTable({ onWidthHiddenChange })
    resizeTo(1200)
    expect(onWidthHiddenChange).not.toHaveBeenCalled()
    resizeTo(700)
    resizeTo(750)
    resizeTo(790)
    expect(onWidthHiddenChange).toHaveBeenCalledTimes(1)
    expect(onWidthHiddenChange).toHaveBeenLastCalledWith(['customer'])
    resizeTo(500)
    expect(onWidthHiddenChange).toHaveBeenCalledTimes(2)
    expect(onWidthHiddenChange).toHaveBeenLastCalledWith(['customer', 'total'])
    resizeTo(1000)
    expect(onWidthHiddenChange).toHaveBeenCalledTimes(3)
    expect(onWidthHiddenChange).toHaveBeenLastCalledWith([])
  })

  it('does not report again when the user hides a column that is not width-hidden', () => {
    const onWidthHiddenChange = vi.fn()
    const { rerender } = renderTable({ onWidthHiddenChange })
    resizeTo(700)
    rerender(
      <DataTable label='Orders' columns={COLUMNS} rows={ROWS} getRowId={row => row.id} onWidthHiddenChange={onWidthHiddenChange} hiddenColumnIds={['total']} />
    )
    expect(onWidthHiddenChange).toHaveBeenCalledTimes(1)
  })
})

describe('DataTable loading and empty (C10)', () => {
  it('keeps the header, is busy, and draws skeleton rows instead of data', () => {
    const { container } = renderTable({ loading: true, skeletonRows: 4, ...selectionProps() })
    expect(screen.getByRole('table', { name: 'Orders' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('columnheader', { name: 'Order' })).toBeInTheDocument()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(4)
    expect(container.querySelector('.odc-skeleton[data-align="end"]')).not.toBeNull()
    expect(screen.queryByText('#13792')).toBeNull()
    expect(container.querySelector('tbody tr').tabIndex).toBe(-1)
  })

  it('draws nine skeleton rows by default', () => {
    const { container } = renderTable({ loading: true })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(9)
  })

  it('shows the empty node in one cell that spans every visible column', () => {
    const { container } = renderTable({ rows: [], empty: <p>No orders match</p>, ...selectionProps() })
    expect(screen.getByText('No orders match')).toBeInTheDocument()
    const cells = container.querySelectorAll('tbody td')
    expect(cells).toHaveLength(1)
    expect(cells[0]).toHaveAttribute('colspan', '5')
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false')
  })

  it('does not show the empty node while loading', () => {
    renderTable({ rows: [], loading: true, empty: <p>No orders match</p> })
    expect(screen.queryByText('No orders match')).toBeNull()
  })

  it('has no interface text of its own', () => {
    const { container } = renderTable({ rows: [] })
    expect(container.querySelector('tbody').textContent).toBe('')
  })
})

describe('DataTable — caller row attributes and rows that cannot be selected', () => {
  it('passes data-* attributes and a class to the row, nothing else', () => {
    render(
      <DataTable
        label='Orders'
        columns={[{ id: 'id', header: 'Order', cell: row => row.id }]}
        rows={[{ id: 1 }, { id: 2 }]}
        getRowId={row => row.id}
        getRowAttributes={(row, index) => ({ 'data-tour': index === 0 ? 'tour_start' : undefined, className: 'tinted', onClick: () => {}, id: 'x' })}
      />
    )
    const first = screen.getAllByRole('row')[1]
    expect(first).toHaveAttribute('data-tour', 'tour_start')
    expect(first).toHaveClass('tinted')
    expect(first).not.toHaveAttribute('id')
  })

  it('draws no checkbox for a row that cannot be selected and leaves it out of the header state', async () => {
    const onToggle = vi.fn()
    render(
      <DataTable
        label='Orders'
        columns={[{ id: 'id', header: 'Order', cell: row => row.id }]}
        rows={[{ id: 1, locked: true }, { id: 2 }]}
        getRowId={row => row.id}
        selection={{ selectedIds: [2], onToggle, onToggleAll: vi.fn(), rowLabel: row => `Select ${row.id}`, allLabel: 'Select all', isSelectable: row => !row.locked, checkboxClassName: 'orderCheckBox' }}
      />
    )
    expect(screen.queryByRole('checkbox', { name: 'Select 1' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Select 2' })).toHaveClass('orderCheckBox')
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'true')
    screen.getAllByRole('row')[1].focus()
    await userEvent.keyboard(' ')
    expect(onToggle).not.toHaveBeenCalled()
  })
})

// redesign D-3 (owner, 2026-10-19): `selection.disabledReason(row)` keeps the checkbox but disables it, with the reason
describe('DataTable — a row whose selection is disabled with a reason', () => {
  const reasonProps = (selectedIds = [], extra = {}) => ({
    selectedIds,
    onToggle: vi.fn(),
    onToggleAll: vi.fn(),
    rowLabel: row => `Select order ${row.number}`,
    allLabel: 'Select all orders on this page',
    disabledReason: row => (row.id === 'b' ? "You can't delete your own account." : null),
    ...extra
  })

  it('draws the checkbox disabled, with the reason as its description and as a visible title', async () => {
    const selection = reasonProps()
    renderTable({ selection })
    const checkbox = screen.getByRole('checkbox', { name: 'Select order #13791' })
    expect(checkbox).toBeDisabled()
    expect(checkbox).toHaveAccessibleDescription("You can't delete your own account.")
    expect(screen.getByTitle("You can't delete your own account.")).toContainElement(checkbox)
    await userEvent.click(checkbox)
    expect(selection.onToggle).not.toHaveBeenCalled()
  })

  it('leaves the other rows untouched', () => {
    renderTable({ selection: reasonProps() })
    const other = screen.getByRole('checkbox', { name: 'Select order #13792' })
    expect(other).not.toBeDisabled()
    expect(other).not.toHaveAttribute('aria-describedby')
    expect(screen.getAllByTitle(/own account/)).toHaveLength(1)
  })

  it('leaves the row out of the select-all state', () => {
    renderTable({ selection: reasonProps(['a', 'c']) })
    expect(screen.getByRole('checkbox', { name: 'Select all orders on this page' })).toHaveAttribute('aria-checked', 'true')
  })

  it('does not select the row with Space', () => {
    const selection = reasonProps()
    renderTable({ selection })
    const row = document.querySelectorAll('tbody tr')[1]
    row.focus()
    fireEvent.keyDown(row, { key: ' ', code: 'Space' })
    expect(selection.onToggle).not.toHaveBeenCalled()
  })

  it('changes nothing when the prop is absent or answers null for every row', () => {
    renderTable({ selection: reasonProps([], { disabledReason: () => null }) })
    screen.getAllByRole('checkbox').forEach(checkbox => expect(checkbox).not.toBeDisabled())
  })
})
