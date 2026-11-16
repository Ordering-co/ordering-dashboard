/* eslint-disable import/first */
// redesign reports FB1 (D6, D8, D9; RP-05, RP-12, RP-13, RP-16; auditor 5, 9, 10): the pivot table of the report tables.
// The content is the real shape of report 3 (`business_spend_times`) of l4-api-shapes.out.json: two header rows with colspan, two
// week groups of six columns, a null, a negative and a day-long duration; the footer is the one the API sends for report 1 shaped
// for this table (it has no footer in the default period), to prove it is formatted like the body (RP-13).
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => {
  const parseNumber = (value, { decimal = 2 } = {}) => (parseFloat(value) || 0).toFixed(decimal).replace('.', ',')
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (key, text) => text],
    useUtils: () => [{
      parseNumber,
      parsePrice: (value) => `$ ${parseNumber(value)}`,
      parseDate: (date) => String(date)
    }]
  }
})

import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'
import { PivotTable } from '../PivotTable'

const h = (value, colspan = 1) => ({ value, colspan })
const c = (value, unit, refers, colspan = 1) => ({ value, colspan, value_unit: unit, value_refers: refers })
const week = (orders, sales, a, b, d, total) => [
  c(orders, 'number', 'quantity'),
  c(sales, 'currency', 'money'),
  c(a, 'seconds', 'time'),
  c(b, 'seconds', 'time'),
  c(d, 'seconds', 'time'),
  c(total, 'seconds', 'time')
]
const weekHeaders = () => [
  h('Orders'), h('Sales'), h('API_REPORT_HEADER_SPEND_4_TO_3'), h('API_REPORT_HEADER_SPEND_3_TO_9'), h('API_REPORT_HEADER_SPEND_9_TO_11'),
  h('Time between business acceptance and delivery completion')
]

const CONTENT = {
  header: {
    rows: [
      [h('Business', 2), h('Week 2026-39', 6), h('Week 2026-40', 6)],
      [h('ID'), h('Name'), ...weekHeaders(), ...weekHeaders()]
    ]
  },
  body: {
    rows: [
      [c(2, 'number', 'id'), c('Fast Bite', 'text', 'business'), ...week(1, 14.05, null, null, 1, 157581), ...week(1, 76.5, 113, 7, 300, 432)],
      [c(9, 'number', 'id'), c('Subway', 'text', 'business'), ...week(0, 0, null, null, null, null), ...week(16, 587.58, -4439, 5, 115, 1002)]
    ]
  },
  footer: {
    rows: [
      [{ value: 'Total', colspan: 2 }, ...week(1, 14.05, null, null, 1, 157581), ...week(17, 664.08, 113, 12, 415, 1434)]
    ]
  }
}

const PERIODS = { 'Week 2026-39': 'Week 39 · 27 Sep – 3 Oct', 'Week 2026-40': 'Week 40 · 4 Oct – 10 Oct' }
const periodText = vi.fn((period, label) => PERIODS[label] ?? label)

const renderTable = (props = {}) => render(
  <PivotTable
    content={CONTENT}
    label='Service times by store'
    periodText={periodText}
    scrollLabel='Service times by store, scrolls sideways'
    emptyText='No data for this period and filters'
    {...props}
  />
)

const rowsOf = (table, section) => within(within(table).getAllByRole('rowgroup')[section]).getAllByRole('row')

describe('the table', () => {
  it('is a real table with a hidden caption that names the object', () => {
    const { container } = renderTable()
    const table = screen.getByRole('table', { name: 'Service times by store' })
    expect(table.tagName).toBe('TABLE')
    expect(container.querySelector('caption')).toHaveTextContent('Service times by store')
    expect(container.querySelector('caption')).toHaveClass('odc-sr-only')
    expect(table.querySelectorAll('thead').length).toBe(1)
    expect(table.querySelectorAll('tbody').length).toBe(1)
    expect(table.querySelectorAll('tfoot').length).toBe(1)
  })

  it('has a scroll region with a name that is a tab stop and fades its edges', () => {
    renderTable()
    const region = screen.getByRole('region', { name: 'Service times by store, scrolls sideways' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveClass('odc-fade-x')
    expect(region).toContainElement(screen.getByRole('table'))
  })

  it('draws no tfoot when the API sends no footer', () => {
    const { container } = renderTable({ content: { ...CONTENT, footer: { rows: [] } } })
    expect(container.querySelector('tfoot')).toBeNull()
  })
})

describe('header', () => {
  it('keeps the colspan of the API and the scope: colgroup in the group row, col in the last one', () => {
    const { container } = renderTable()
    const [group, last] = container.querySelectorAll('thead tr')
    const groups = [...group.children]
    expect(groups.map(th => th.getAttribute('colspan'))).toEqual(['2', '6', '6'])
    groups.forEach(th => expect(th).toHaveAttribute('scope', 'colgroup'))
    expect(last.children).toHaveLength(14)
    ;[...last.children].forEach(th => {
      expect(th.tagName).toBe('TH')
      expect(th).toHaveAttribute('scope', 'col')
    })
  })

  it('gives a header of one column in a group row the scope col', () => {
    const { container } = renderTable({
      content: { header: { rows: [[h('Distance'), h('Week 2026-39', 2)], [h('Distance'), h('Orders'), h('Percentage')]] }, body: { rows: [] } }
    })
    const [group] = container.querySelectorAll('thead tr')
    expect([...group.children].map(th => th.getAttribute('scope'))).toEqual(['col', 'colgroup'])
  })

  it('writes the period with periodText (RP-05), the spans between statuses and the English texts', () => {
    renderTable()
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader', { name: 'Week 39 · 27 Sep – 3 Oct' })).toHaveLength(1)
    expect(within(table).getByRole('columnheader', { name: 'Week 40 · 4 Oct – 10 Oct' })).toHaveAttribute('colspan', '6')
    expect(periodText).toHaveBeenCalledWith(expect.objectContaining({ unit: 'week', number: 39 }), 'Week 2026-39')
    expect(within(table).getAllByRole('columnheader', { name: 'Preparation completed → Driver arrived by business' })).toHaveLength(2)
    expect(within(table).getAllByRole('columnheader', { name: 'Driver arrived by business → Pick up completed by driver' })).toHaveLength(2)
    expect(within(table).getAllByRole('columnheader', { name: 'Time between business acceptance and delivery completion' })).toHaveLength(2)
    expect(within(table).getAllByRole('columnheader', { name: 'Orders' })).toHaveLength(2)
    expect(table.textContent).not.toMatch(/API_REPORT_HEADER/)
  })

  it('aligns the header of a figure column to the end', () => {
    const { container } = renderTable()
    const [, last] = container.querySelectorAll('thead tr')
    const cells = [...last.children]
    expect(cells[0]).toHaveAttribute('data-align', 'end') // the id is a figure
    expect(cells[1]).not.toHaveAttribute('data-align')
    expect(cells[2]).toHaveAttribute('data-align', 'end')
  })
})

describe('body', () => {
  it('formats every cell by its unit and paints figures in an isolated .odc-figure', () => {
    renderTable()
    const first = rowsOf(screen.getByRole('table'), 1)[0]
    const cells = within(first).getAllByRole('cell')
    const header = within(first).getByRole('rowheader')
    expect(header).toHaveTextContent('Fast Bite')
    expect(header).toHaveAttribute('scope', 'row')
    // id (td), then the 12 figures of the two weeks
    expect(cells[0]).toHaveTextContent('2')
    const orders = cells[1]
    expect(orders).toHaveTextContent('1')
    const money = cells[2]
    expect(money).toHaveTextContent('$ 14,05')
    const figure = money.querySelector('.odc-figure')
    expect(figure.tagName).toBe('BDI')
    expect(figure).toHaveTextContent('$ 14,05')
    expect(cells[5]).toHaveTextContent('1 s')
    expect(cells[6]).toHaveTextContent('1 d 19 h')
    expect(cells[12]).toHaveTextContent('7 min 12 s')
    expect(within(header).queryByText('Fast Bite').closest('.odc-figure')).toBeNull()
  })

  it('a negative duration reads with the minus sign', () => {
    renderTable()
    const second = rowsOf(screen.getByRole('table'), 1)[1]
    expect(second).toHaveTextContent('−1 h 13 min')
  })

  it('an empty value is a dash with an accessible name (RP-12)', () => {
    renderTable()
    const first = rowsOf(screen.getByRole('table'), 1)[0]
    const cells = within(first).getAllByRole('cell')
    const empty = cells[3] // the first null
    expect(within(empty).getByText('—')).toHaveAttribute('aria-hidden', 'true')
    expect(within(empty).getByText('No data')).toHaveClass('odc-sr-only')
    expect(empty.querySelector('.odc-figure')).toBeNull()
  })

  it('the dash of a figure column is aligned like the figures', () => {
    renderTable()
    const first = rowsOf(screen.getByRole('table'), 1)[0]
    expect(within(first).getAllByRole('cell')[3]).toHaveAttribute('data-align', 'end')
  })
})

describe('footer (RP-13)', () => {
  it('is formatted like the body and its first cell goes through headerText', () => {
    renderTable()
    const [total] = rowsOf(screen.getByRole('table'), 2)
    const label = within(total).getByRole('rowheader')
    expect(label).toHaveTextContent('Total')
    expect(label).toHaveAttribute('colspan', '2')
    const cells = within(total).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent('$ 14,05')
    expect(cells[5]).toHaveTextContent('1 d 19 h')
    expect(cells[1].querySelector('bdi.odc-figure')).not.toBeNull()
    expect(total.textContent).not.toMatch(/157581|14\.05/)
  })
})

describe('fixed columns and week groups (D9, auditor 5)', () => {
  it('marks the id and the name as fixed in the header, the body and the footer, and the last one as the end', () => {
    const { container } = renderTable()
    const rows = [...container.querySelectorAll('tr')]
    expect(rows).toHaveLength(5)
    const [group, last, firstBody, secondBody, foot] = rows
    // group row: «Business» (colspan 2) is fixed as a whole
    expect(group.children[0]).toHaveAttribute('data-fixed', '0')
    expect(group.children[0]).toHaveAttribute('data-fixed-end')
    expect(group.children[1]).not.toHaveAttribute('data-fixed')
    ;[last, firstBody, secondBody].forEach(row => {
      expect(row.children[0]).toHaveAttribute('data-fixed', '0')
      expect(row.children[0]).not.toHaveAttribute('data-fixed-end')
      expect(row.children[1]).toHaveAttribute('data-fixed', '1')
      expect(row.children[1]).toHaveAttribute('data-fixed-end')
      expect(row.children[2]).not.toHaveAttribute('data-fixed')
    })
    expect(foot.children[0]).toHaveAttribute('data-fixed', '0') // «Total» spans both
    expect(foot.children[0]).toHaveAttribute('data-fixed-end')
    expect(foot.children[1]).not.toHaveAttribute('data-fixed')
  })

  it('starts each week group with a separator, in every row, and only there', () => {
    const { container } = renderTable()
    const rows = [...container.querySelectorAll('tr')]
    // the columns (not the children) where a cell with the separator starts
    const starts = row => {
      const found = []
      let column = 0
      ;[...row.children].forEach(cell => {
        if (cell.hasAttribute('data-group-start')) found.push(column)
        column += Number(cell.getAttribute('colspan') || 1)
      })
      return found
    }
    expect(starts(rows[0])).toEqual([2, 8]) // the week headers
    expect(starts(rows[1])).toEqual([2, 8]) // Orders of each week
    expect(starts(rows[2])).toEqual([2, 8])
    expect(starts(rows[3])).toEqual([2, 8])
    expect(starts(rows[4])).toEqual([2, 8]) // the footer, whose «Total» spans the two fixed columns
  })

  it('takes the first column when no cell says what the row is (report 2)', () => {
    const content = {
      header: { rows: [[h('Distance'), h('Week 2026-39', 2)], [h('Distance'), h('Orders'), h('Percentage')]] },
      body: { rows: [[{ value: 'Between 0 to 1', colspan: 1 }, c(1, 'km', 'distance'), c(100, 'number', 'percentage')]] }
    }
    const { container } = renderTable({ content, report: { columns: { distance: 'count' } } })
    const rows = [...container.querySelectorAll('tr')]
    expect(rows[2].children[0]).toHaveAttribute('data-fixed', '0')
    expect(rows[2].children[0]).toHaveAttribute('data-fixed-end')
    expect(rows[2].children[1]).not.toHaveAttribute('data-fixed')
    expect(rows[2].children[0].tagName).toBe('TH')
    expect(rows[2].children[0]).toHaveTextContent('0–1 km')
    expect(rows[2].children[1]).toHaveTextContent('1') // the rule of the registry: a count
    expect(rows[2].children[2]).toHaveTextContent('100%')
  })
})

describe('no rows', () => {
  it('says so inside the table, in one row that spans every column', () => {
    const { container } = renderTable({ content: { header: CONTENT.header, body: { rows: [] }, footer: { rows: [] } } })
    const cell = container.querySelector('tbody td')
    expect(cell).toHaveTextContent('No data for this period and filters')
    expect(cell).toHaveAttribute('colspan', '14')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('does not throw without content', () => {
    renderTable({ content: undefined })
    expect(screen.getByText('No data for this period and filters')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

describe('what the stylesheet and the markup keep', () => {
  const dir = path.resolve(__dirname, '..')
  const css = readFileSync(path.join(dir, 'pivot-table.css'), 'utf8')

  it('pins the fixed columns with logical properties, in every width', () => {
    expect(css).toMatch(/\[data-fixed\][^{]*\{[^}]*position:\s*sticky/)
    expect(css).toMatch(/inset-inline-start:\s*var\(--odc-rp-start/)
    expect(css).not.toMatch(/@media[^{]*\{[^}]*position:\s*static/)
    expect(css).not.toMatch(/\b(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/)
  })

  it('pins the header on top and gives the figure column the end alignment', () => {
    expect(css).toMatch(/thead\s+th[^{]*\{[^}]*position:\s*sticky/)
    expect(css).toMatch(/inset-block-start:\s*var\(--odc-rp-top/)
    expect(css).toMatch(/\[data-align='end'\][^{]*\{[^}]*text-align:\s*end/)
  })

  it('only uses classes odc-rp-* of its own and no styled-components', () => {
    const source = readFileSync(path.join(dir, 'PivotTable.jsx'), 'utf8')
    expect(source).not.toMatch(/styled-components/)
    expect(css.match(/\.odc-[a-z-]+/g).every(name => /^\.odc-(rp-|fade-x|sr-only|figure)/.test(name))).toBe(true)
  })

  it('has no literal colour, length, weight, duration or z-index (the literal guard)', () => {
    ;['pivot-table.css', 'PivotTable.jsx', 'pivotFormat.js'].forEach(file => {
      const findings = scanSource(readFileSync(path.join(dir, file), 'utf8'), file)
      expect(findings, file).toEqual([])
    })
  })
})
