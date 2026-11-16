import React from 'react'

import { Checkbox } from './Checkbox'
import { Skeleton } from './Feedback'
import { cx } from './classNames'
import { useOverflowEdges } from './useOverflowEdges'
import './product.css'
import './data-table.css'

// Controls inside a row that take part in the roving tab stop (the row's own focus
// model decides which row is tabbable; the consumer never sets tabIndex).
const ROW_CONTROLS = [
  'a[href]',
  'button',
  "input:not([type='hidden'])",
  'select',
  'textarea',
  'summary',
  "[role='button']",
  "[role='checkbox']",
  "[role='switch']"
].map(selector => `${selector}:not([aria-hidden='true'])`).join(',')

// Elements that own a click: a click that starts on one of these never opens the row.
const CLICK_OWNERS = `${ROW_CONTROLS},label,[role='menuitem'],[data-odc-no-open]`

// Extra row attributes from the caller: only data-* (tour anchors, status tints) and a class.
const rowAttributes = (attributes = {}) => Object.fromEntries(
  Object.entries(attributes || {}).filter(([key]) => key.startsWith('data-') || key === 'className')
)

// Widths of the loading lines (a share of the cell), rotated by row and column so the block does not read as a grid
// of equal bars; the second line of a cell is always shorter than the first.
const SKELETON_SIZES = ['65%', '85%', '50%', '70%', '40%', '75%']
const SKELETON_SECOND = ['45%', '60%', '35%', '55%']

// The lead of a loading cell, as the content draws it: an avatar (people), a square avatar (businesses), a dot (status).
const SKELETON_LEADS = {
  avatar: { shape: 'round', size: 'var(--od-x-avatar)' },
  business: { shape: 'box', size: 'var(--od-x-avatar)' },
  dot: { shape: 'round', size: 'var(--od-x-dot)' }
}

// redesign F6e-3 (Q4-03): the floor of a column (`column.skeleton.floor`, a token) is a rule of the column, not of the
// loading cell: the header cell, the loading cells and the real cells all carry it (data-floor and --odc-col-floor, which
// data-table.css turns into the same minimum width), so the columns sit where the loading rows drew them.
const floorProps = column => {
  const floor = column.skeleton?.floor
  return floor ? { 'data-floor': '', style: { '--odc-col-floor': floor } } : {}
}

const SkeletonCell = ({ column, rowIndex, columnIndex }) => {
  const { lines = 1, lead } = column.skeleton || {}
  const end = column.align === 'end' ? 'end' : 'start'
  const leadShape = SKELETON_LEADS[lead]
  return (
    <span className='odc-sk-cell' data-align={end}>
      {leadShape && <Skeleton shape={leadShape.shape} size={leadShape.size} block={leadShape.size} />}
      <span className='odc-sk-lines'>
        <Skeleton size={SKELETON_SIZES[(rowIndex + columnIndex) % SKELETON_SIZES.length]} align={end} />
        {lines > 1 && <Skeleton size={SKELETON_SECOND[(rowIndex + columnIndex) % SKELETON_SECOND.length]} align={end} />}
      </span>
    </span>
  )
}

const headerState = (allRows, getRowId, selectedIds, isSelectable = () => true) => {
  const rows = allRows.filter(isSelectable)
  if (rows.length === 0) return false
  const selected = new Set(selectedIds)
  const count = rows.filter(row => selected.has(getRowId(row))).length
  if (count === 0) return false
  return count === rows.length ? true : 'mixed'
}

/**
 * Data table (C6). A real <table> in a scroll container with a sticky 36px header,
 * C2 rows, and a keyboard model with ONE tab stop per table: a roving tabindex on
 * the rows (only one row has tabIndex 0). Up/Down/Home/End move between rows,
 * Enter opens, Space selects, Esc clears the selection; the controls inside the
 * row focused (checkbox, buttons, links) are tabbable, those of other rows are not.
 * Keys that come from a control inside a row never trigger the row's action.
 *
 * Columns drop by priority: `hideBelow` is the container width (px) under which the
 * column hides, `locked` columns never do; `hiddenColumnIds` are the user's choice
 * (column manager) and `onWidthHiddenChange` reports the width-hidden set, once per
 * change. All text (header, cell content, labels, empty state) comes from the caller.
 *
 * redesign fix-qa E7: the scroller carries `data-overflow-start` / `data-overflow-end` while the table
 * has more to show sideways (useOverflowEdges), so a column the consumer pins can show its edge then;
 * the select-all checkbox is inert (aria-disabled, still focusable so the scroller keeps a tab stop) while
 * the table loads: there is nothing to select.
 *
 * redesign F4 (C20): the loading rows are the grid of the content, not a generic block. Each row has the
 * visible columns of the header (the user's hidden ones and the width-hidden ones included), the selection
 * cell, the row height of the density and the class of each column; `column.skeleton` shapes a cell
 * (`{ lines: 1 | 2, lead: 'avatar' | 'business' | 'dot', floor }`: `floor` is a token for the width the
 * real content asks for, so a table that sizes its columns by content lands on the same columns). While
 * loading the region and the table are `aria-busy` and `loadingLabel` is read once, hidden.
 *
 * redesign D-3 (owner, 2026-10-19): `selection.disabledReason(row)` (optional) returns a string for a row that stays
 * in the table but cannot be selected: its checkbox is drawn disabled and the reason is its accessible description (the same
 * pattern as the column manager's notes) and a visible `title` on its cell; the row is out of the select-all state and Space
 * does not toggle it. `null` / no prop: the row is as any other. (`isSelectable` still HIDES the checkbox.)
 *
 * redesign W1 tramo C r1 (C1c, W1-PC1-03, W1-QC1-11, W1-QC1-15): the options below are opt-in.
 * - Rows are interactive (tab stop, `data-interactive`, cursor, hover, Enter, Space, a click) only when the table has
 *   something to do with them: `onOpenRow` or `selection`. A table with neither paints plain rows; the controls inside
 *   them keep their natural tab order, and when the table scrolls the scroller itself is the tab stop (a region named
 *   by `label`) so a keyboard can scroll it.
 * - `scrollLabel` names the scroll region (role=region) and fades the edge that has more to show (`odc-fade-x`, fed by
 *   the overflow edges the scroller already reports). The caller writes the text.
 * - `column.rowHeader` paints that column's body cell as `<th scope="row">`: the cell that names the record.
 */
export const DataTable = ({
  label,
  columns,
  rows,
  getRowId,
  hiddenColumnIds = [],
  onWidthHiddenChange,
  density = 'comfortable',
  selection,
  activeRowId,
  onOpenRow,
  onClearSelection,
  newRowIds = [],
  loading = false,
  loadingLabel,
  skeletonRows = 9,
  empty,
  getRowAttributes,
  scrollLabel,
  className
}) => {
  const scrollRef = React.useRef(null)
  useOverflowEdges(scrollRef)
  const bodyRef = React.useRef(null)
  const [width, setWidth] = React.useState(null)
  const [focusedId, setFocusedId] = React.useState(null)
  const [scrolls, setScrolls] = React.useState(false) // redesign W1 tramo C r1 (C1c, W1-PC1-03): the scroller has more to show
  const reasonIdPrefix = React.useId()
  const widthCallback = React.useRef(onWidthHiddenChange)
  widthCallback.current = onWidthHiddenChange
  const reportedKey = React.useRef('')

  React.useEffect(() => {
    const node = scrollRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(entries => {
      const entry = entries[entries.length - 1]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // redesign W1 tramo C r1 (C1c, W1-PC1-03): does the table scroll? Its own observer, so the width above stays the scroller's.
  React.useEffect(() => {
    const node = scrollRef.current
    if (!node) return undefined
    const measureScroll = () => setScrolls(node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
    measureScroll()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measureScroll)
    observer.observe(node)
    const table = node.querySelector('table')
    if (table) observer.observe(table)
    return () => observer.disconnect()
  }, [])

  const userHidden = new Set(hiddenColumnIds)
  const widthHidden = columns.filter(column =>
    column.hideBelow != null && !column.locked && width != null && width < column.hideBelow
  ).map(column => column.id)
  const visibleColumns = columns.filter(column =>
    !userHidden.has(column.id) && !widthHidden.includes(column.id)
  )

  const widthKey = widthHidden.join('|')
  React.useEffect(() => {
    if (widthKey === reportedKey.current) return
    reportedKey.current = widthKey
    widthCallback.current?.(widthKey ? widthKey.split('|') : [])
  }, [widthKey])

  // The row the user last focused keeps the tab stop; once the active row changes it takes it.
  React.useEffect(() => { setFocusedId(null) }, [activeRowId])

  // redesign W1 tramo C r1 (C1c, W1-PC1-03): a row is interactive only when the table opens or selects it
  const interactive = Boolean(onOpenRow || selection)
  const rowIds = rows.map(getRowId)
  const stopId = [focusedId, activeRowId].find(id => id != null && rowIds.includes(id)) ?? rowIds[0]

  React.useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body || !interactive) return
    body.querySelectorAll('tr[data-row-id]').forEach((row, index) => {
      const tabbable = rowIds[index] === stopId
      row.querySelectorAll(ROW_CONTROLS).forEach(control => { control.tabIndex = tabbable ? 0 : -1 })
    })
  })

  if (label == null) throw new Error('DataTable needs a label') // redesign W0-2 r2 (W0-Q1-01)

  const selectedSet = new Set(selection?.selectedIds ?? [])
  const newSet = new Set(newRowIds)
  const columnCount = visibleColumns.length + (selection ? 1 : 0)

  const focusRow = index => {
    const target = bodyRef.current?.querySelectorAll('tr[data-row-id]')[index]
    if (target) target.focus()
  }

  const onRowKeyDown = (event, row, index) => {
    // Esc clears the selection from anywhere in the row (it activates nothing). Popups
    // portaled out of the row are not DOM descendants, so their own Esc never reaches here.
    if (event.key === 'Escape' && !event.defaultPrevented && event.currentTarget.contains(event.target)) {
      onClearSelection?.()
      return
    }
    // Only the row itself drives the row: a key from a control inside it belongs to that control.
    if (event.target !== event.currentTarget) return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusRow(Math.min(index + 1, rows.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        focusRow(Math.max(index - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        focusRow(0)
        break
      case 'End':
        event.preventDefault()
        focusRow(rows.length - 1)
        break
      case 'Enter':
        event.preventDefault()
        onOpenRow?.(row)
        break
      case ' ':
        event.preventDefault()
        if (selection && (selection.isSelectable?.(row) ?? true) && !selection.disabledReason?.(row)) selection.onToggle(getRowId(row), row)
        break
      default:
    }
  }

  const onRowClick = (event, row) => {
    const owner = event.target.closest(CLICK_OWNERS)
    if (owner && owner !== event.currentTarget && event.currentTarget.contains(owner)) return
    onOpenRow?.(row)
  }

  // redesign D-3: a row with a reason is not part of «all»
  const header = selection
    ? headerState(rows, getRowId, selection.selectedIds, row => (selection.isSelectable?.(row) ?? true) && !selection.disabledReason?.(row))
    : false

  // redesign W1 tramo C r1 (C1c, W1-PC1-03, W1-QC1-11): with no interactive row the scroller is the keyboard's way to scroll,
  // so it is a tab stop (while it overflows) and a named region; `scrollLabel` names it and fades its edge on any table.
  const scrollerStop = !interactive && scrolls
  const regionName = scrollLabel ?? (scrollerStop ? label : undefined)

  return (
    <div
      ref={scrollRef}
      className={cx('odc-root', 'odc-table-scroll', scrollLabel != null && 'odc-fade-x', className)}
      role={regionName != null ? 'region' : undefined}
      aria-label={regionName}
      tabIndex={scrollerStop ? 0 : undefined}
      aria-busy={loading || undefined}
    >
      {loading && loadingLabel && <span className='odc-sr-only'>{loadingLabel}</span>}
      <table className='odc-table' data-density={density} aria-label={label} aria-busy={loading}>
        <thead>
          <tr>
            {selection && (
              <th scope='col' data-selection=''>
                <Checkbox
                  label={selection.allLabel}
                  checked={header}
                  readOnly={loading}
                  aria-disabled={loading || undefined}
                  onCheckedChange={next => { if (!loading) selection.onToggleAll(next) }}
                />
              </th>
            )}
            {visibleColumns.map(column => (
              <th key={column.id} scope='col' data-align={column.align === 'end' ? 'end' : undefined} className={column.className} {...floorProps(column)}>
                {column.header}
                {column.srHeader && <span className='odc-sr-only'>{column.srHeader}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {loading && Array.from({ length: skeletonRows }, (_, rowIndex) => (
            <tr key={rowIndex} data-skeleton='' aria-hidden='true'>
              {selection && (
                <td data-selection=''>
                  <span className='odc-sk-check'>
                    <Skeleton shape='box' size='var(--od-x-checkbox-box)' block='var(--od-x-checkbox-box)' />
                  </span>
                </td>
              )}
              {visibleColumns.map((column, columnIndex) => (
                <td key={column.id} data-align={column.align === 'end' ? 'end' : undefined} className={column.className} {...floorProps(column)}>
                  <SkeletonCell column={column} rowIndex={rowIndex} columnIndex={columnIndex} />
                </td>
              ))}
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td className='odc-table-empty' colSpan={columnCount}>{empty}</td>
            </tr>
          )}
          {!loading && rows.map((row, index) => {
            const id = rowIds[index]
            const checked = selectedSet.has(id)
            const active = activeRowId != null && id === activeRowId
            const selectable = selection ? (selection.isSelectable?.(row) ?? true) : false
            const reason = selectable ? selection.disabledReason?.(row) || null : null
            const reasonId = `${reasonIdPrefix}-${id}-reason`
            return (
              <tr
                key={id}
                data-row-id={id}
                data-checked={checked ? '' : undefined}
                data-active={active ? '' : undefined}
                data-new={newSet.has(id) ? '' : undefined}
                aria-current={active ? 'true' : undefined}
                data-interactive={interactive ? '' : undefined}
                tabIndex={interactive ? (id === stopId ? 0 : -1) : undefined}
                onFocus={interactive ? () => setFocusedId(id) : undefined}
                onKeyDown={interactive ? event => onRowKeyDown(event, row, index) : undefined}
                onClick={interactive ? event => onRowClick(event, row) : undefined}
                {...rowAttributes(getRowAttributes?.(row, index))}
              >
                {selection && (
                  <td data-selection='' title={reason || undefined}>
                    {selectable
                      ? (
                        <>
                          <Checkbox
                            label={selection.rowLabel(row)}
                            checked={checked}
                            className={selection.checkboxClassName}
                            disabled={Boolean(reason)}
                            aria-describedby={reason ? reasonId : undefined}
                            onCheckedChange={() => selection.onToggle(id, row)}
                          />
                          {reason && <span id={reasonId} className='odc-sr-only'>{reason}</span>}
                        </>
                        )
                      : <span aria-hidden='true' />}
                  </td>
                )}
                {visibleColumns.map(column => {
                  const Cell = column.rowHeader ? 'th' : 'td' // redesign W1 tramo C r1 (C1c, W1-QC1-15): the cell that names the record
                  return (
                    <Cell
                      key={column.id}
                      scope={column.rowHeader ? 'row' : undefined}
                      data-align={column.align === 'end' ? 'end' : undefined}
                      data-wrap={column.wrap ? '' : undefined}
                      className={column.className}
                      {...floorProps(column)}
                    >
                      {column.cell(row)}
                    </Cell>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
