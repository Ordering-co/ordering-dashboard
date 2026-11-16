import React from 'react'
import { useLanguage, useUtils } from '../../../../../index'
import { cx } from '../../Shared/Product/classNames'
import { useOverflowEdges } from '../../Shared/Product/useOverflowEdges'
import { parsePeriodLabel } from '../../../../../utils/reportPeriods'
import { formatCell, headerText, pivotLayout } from './pivotFormat'
import '../../Shared/Product/product.css'
import './pivot-table.css'

// redesign reports FB1 (D6, D8, D9; RP-03, RP-05, RP-12, RP-13, RP-16; auditor 2, 5, 9, 10): the pivot table of the report tables.
// It paints the `{ header, body, footer }.rows` that `/reports/*` sends, as they arrive: cells with `colspan`, the groups of periods
// side by side. It decides nothing about the data: the text of every cell comes from `pivotFormat.js` (unit and column rule), the
// text of a period header from `periodText` (the UI knows the dates of the project and the range of the report).

const spanOf = cell => Math.max(1, Number(cell?.colspan) || 1)
const rowsOf = section => (Array.isArray(section?.rows) ? section.rows.filter(Array.isArray) : [])

// the cells of a row with the column each one starts at (the colspan moves the next one)
const place = (row) => {
  let column = 0
  return row.map(cell => {
    const placed = { cell, start: column, span: spanOf(cell) }
    column += placed.span
    return placed
  })
}

// The pinned offsets (redesign reports FB1, D9): a cell pinned after another one starts where the width of the ones before it ends,
// and a header row starts where the rows above it end. Both are measured, never written down: the columns size by their content.
// jsdom has no layout, so there every offset is 0.
const syncOffsets = (root) => {
  const table = root?.querySelector('table')
  if (!table) return
  let top = 0
  table.querySelectorAll('thead tr').forEach(row => {
    row.querySelectorAll('th').forEach(cell => cell.style.setProperty('--odc-rp-top', `${top}px`))
    top += row.getBoundingClientRect().height
  })
  const widths = []
  const rows = table.querySelectorAll('tr')
  rows.forEach(row => {
    row.querySelectorAll('[data-fixed]').forEach(cell => {
      const index = Number(cell.getAttribute('data-fixed'))
      if (widths[index] === undefined && (Number(cell.getAttribute('colspan')) || 1) === 1) widths[index] = cell.getBoundingClientRect().width
    })
  })
  const starts = []
  widths.reduce((sum, width, index) => {
    starts[index] = sum
    return sum + (width || 0)
  }, 0)
  table.querySelectorAll('[data-fixed]').forEach(cell => {
    cell.style.setProperty('--odc-rp-start', `${starts[Number(cell.getAttribute('data-fixed'))] || 0}px`)
  })
}

/**
 * Pivot table of a report. `content` is `{ header, body, footer }` with `rows` of cells `{ value, colspan, value_unit, value_refers }`;
 * `report` is the registry's entry (its `columns` rules decide a count, a km); `label` names the table (hidden caption);
 * `periodText(period, label)` writes a period header with the dates of the project; `scrollLabel` names the sideways scroll
 * region; `emptyText` goes in one row of the table when there are no rows; `distanceUnit` ('MI' for a miles project, km otherwise)
 * is the unit the distance cells and ranges are written in (redesign , row 4).
 *
 * - The columns that say what the row is (id, name, …) stay pinned while the table scrolls sideways, at every width, and the
 *   header stays pinned on top (`data-fixed`, `data-fixed-end`; the stylesheet does the pinning).
 * - Each group of periods starts with a visible separator (`data-group-start`).
 * - A figure sits at the end of its cell in an isolated `<bdi class="odc-figure">`; an empty value is a dash that reads «No data».
 * - The footer is formatted like the body (RP-13); its first text cell (the «Total») is written like a header.
 */
export const PivotTable = ({ content, report, label, periodText, scrollLabel, emptyText, className, distanceUnit }) => {
  const [, t] = useLanguage()
  const [utils] = useUtils() || []
  const scrollRef = React.useRef(null)
  useOverflowEdges(scrollRef)

  const fmt = { t, parsePrice: utils?.parsePrice, parseNumber: utils?.parseNumber, parseDate: utils?.parseDate, distanceUnit }
  const headerOptions = { t, periodText }

  const headerRows = rowsOf(content?.header).map(place)
  const bodyRows = rowsOf(content?.body).map(row => place(row).map(placed => ({ ...placed, out: formatCell(placed.cell, { report, fmt }) })))
  const footerRows = rowsOf(content?.footer).map(row => place(row).map(placed => ({ ...placed, out: formatCell(placed.cell, { report, fmt }) })))

  const layout = pivotLayout(content)
  const groupStarts = new Set(layout.groupStarts)
  // A column of figures is aligned to the end, header included. A column whose cells are all empty (a period with no times) is
  // still a column of figures: the unit of its empty cells says so.
  const figureColumns = new Set()
  ;[...bodyRows, ...footerRows].forEach(row => row.forEach(({ cell, start, span, out }) => {
    const numeric = out.figure || (out.empty && Boolean(cell?.value_unit) && cell.value_unit !== 'text')
    if (span === 1 && numeric) figureColumns.add(start)
  }))

  // a cell that sits inside the pinned columns is pinned; the one that ends them draws the edge
  const marks = (start, span) => {
    const end = start + span
    const pinned = start < layout.fixedCount && end <= layout.fixedCount
    return {
      'data-fixed': pinned ? start : undefined,
      'data-fixed-end': pinned && end === layout.fixedCount ? '' : undefined,
      'data-group-start': groupStarts.has(start) ? '' : undefined
    }
  }

  // After every render: the widths depend on the content, and again when the table or the fonts change size
  React.useLayoutEffect(() => {
    const root = scrollRef.current
    syncOffsets(root)
    if (!root || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => syncOffsets(root))
    const table = root.querySelector('table')
    if (table) observer.observe(table)
    return () => observer.disconnect()
  })

  const renderValue = out => {
    if (out.empty) {
      return (
        <span className='odc-rp-dash'>
          <span aria-hidden='true'>{out.text}</span>
          <span className='odc-sr-only'>{t('NO_DATA', 'No data')}</span>
        </span>
      )
    }
    return out.figure ? <bdi className='odc-figure'>{out.text}</bdi> : out.text
  }

  const lastHeader = headerRows.length - 1

  return (
    <div
      ref={scrollRef}
      className={cx('odc-root', 'odc-rp-scroll', 'odc-fade-x', className)}
      role='region'
      aria-label={scrollLabel}
      tabIndex={0}
    >
      <table className='odc-rp-table'>
        <caption className='odc-sr-only'>{label}</caption>
        {headerRows.length > 0 && (
          <thead>
            {headerRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map(({ cell, start, span }, index) => {
                  const text = headerText(cell?.value, headerOptions)
                  const isPeriod = parsePeriodLabel(String(cell?.value ?? '')) !== null
                  const last = rowIndex === lastHeader
                  return (
                    <th
                      key={index}
                      scope={last || span === 1 ? 'col' : 'colgroup'}
                      colSpan={span > 1 ? span : undefined}
                      data-align={last && span === 1 && figureColumns.has(start) ? 'end' : undefined}
                      {...marks(start, span)}
                    >
                      {isPeriod ? <bdi>{text}</bdi> : text}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
        )}
        <tbody>
          {bodyRows.length === 0 && (
            <tr>
              <td className='odc-rp-empty' colSpan={layout.columnCount}>{emptyText}</td>
            </tr>
          )}
          {bodyRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map(({ cell, start, span, out }, index) => {
                const Cell = start === layout.rowHeaderColumn && start < layout.fixedCount ? 'th' : 'td'
                return (
                  <Cell
                    key={index}
                    scope={Cell === 'th' ? 'row' : undefined}
                    colSpan={span > 1 ? span : undefined}
                    data-align={figureColumns.has(start) ? 'end' : undefined}
                    {...marks(start, span)}
                  >
                    {renderValue(out)}
                  </Cell>
                )
              })}
            </tr>
          ))}
        </tbody>
        {footerRows.length > 0 && (
          <tfoot>
            {footerRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map(({ cell, start, span, out }, index) => {
                  // the label of the row («Total») is written like a header; every other cell like the body (RP-13)
                  const isLabel = start === 0 && !out.figure && !out.empty
                  const Cell = isLabel ? 'th' : 'td'
                  return (
                    <Cell
                      key={index}
                      scope={isLabel ? 'row' : undefined}
                      colSpan={span > 1 ? span : undefined}
                      data-align={figureColumns.has(start) ? 'end' : undefined}
                      {...marks(start, span)}
                    >
                      {isLabel ? headerText(cell.value, headerOptions) : renderValue(out)}
                    </Cell>
                  )
                })}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  )
}
