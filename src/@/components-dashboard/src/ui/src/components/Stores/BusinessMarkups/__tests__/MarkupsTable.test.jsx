/* eslint-disable import/first */
// redesign (lot A): the two opt-in props of the markups table, for the /stores/markups page. `storeOf` adds a «Business»
// column after Name (and the business in the line of a card); `columns` orders and hides the columns of the table, and Name (and ID)
// cannot be hidden. Without them the table is the one of before. `MARKUP_COLUMN_IDS` lists the ids for the host.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const probe = vi.hoisted(() => ({ phone: false }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: (value) => `Q ${Number(value).toFixed(2)}` }]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => probe.phone }))

import { MarkupsTable, MARKUP_COLUMN_IDS } from '../MarkupsTable'

const OWN = { id: 21, name: 'Own markup', business_id: 7, site_id: 4, delivery_type: 'delivery', enabled: true, rules: { products: { markup_type: 'percentage', markup_value: 10 }, suboptions: { markup_type: 'percentage', markup_value: 10 } } }

const renderTable = (props = {}) => render(
  <MarkupsTable
    markups={[OWN]}
    loading={false}
    selectedIds={[]}
    onToggle={() => {}}
    onToggleAll={() => {}}
    onOpen={() => {}}
    onToggleEnabled={async () => ({ ok: true })}
    isGlobal={() => false}
    appliesTo={() => 'Main site · Delivery'}
    {...props}
  />
)

// the names of the columns (the selection column has a checkbox and no text of its own)
const headers = () => screen.getAllByRole('columnheader').map(node => node.textContent.trim()).filter(Boolean)

beforeEach(() => { probe.phone = false })

describe('MarkupsTable · the column of the business (storeOf)', () => {
  it('has no «Business» column without storeOf', () => {
    renderTable()
    expect(screen.queryByRole('columnheader', { name: 'Business' })).toBeNull()
    expect(headers()).toEqual(['ID', 'Name', 'Applies to', 'Rule', 'Status'])
  })

  it('adds «Business» right after Name, with what storeOf says as the cell', () => {
    renderTable({ storeOf: (markup) => `Business of ${markup.id}` })
    expect(headers()).toEqual(['ID', 'Name', 'Business', 'Applies to', 'Rule', 'Status'])
    expect(screen.getByText('Business of 21')).toBeInTheDocument()
  })

  it('puts the business in the line of a card under 768px, after the ID and before what it applies to', () => {
    probe.phone = true
    renderTable({ storeOf: () => 'Burger Place' })
    const line = screen.getByText((_content, node) => node.classList?.contains('odc-bm-sub') && /Burger Place/.test(node.textContent))
    expect(line.textContent.replace(/\s+/g, ' ').trim()).toBe('ID 21 · Burger Place · Main site · Delivery')
  })

  it('keeps the card line of before without storeOf', () => {
    probe.phone = true
    renderTable()
    const line = screen.getByText((_content, node) => node.classList?.contains('odc-bm-sub') && /Main site/.test(node.textContent))
    expect(line.textContent.replace(/\s+/g, ' ').trim()).toBe('ID 21 · Main site · Delivery')
  })
})

describe('MarkupsTable · the columns that can be chosen (columns)', () => {
  it('exports the ids for the host', () => {
    expect(MARKUP_COLUMN_IDS).toEqual(['id', 'name', 'store', 'applies', 'rule', 'status'])
  })

  it('hides a column that is not visible', () => {
    renderTable({ columns: MARKUP_COLUMN_IDS.map(id => ({ id, visible: id !== 'rule' })) })
    expect(screen.queryByRole('columnheader', { name: 'Rule' })).toBeNull()
    expect(headers()).toEqual(['ID', 'Name', 'Applies to', 'Status'])
  })

  it('paints the columns in the order given', () => {
    renderTable({ columns: [{ id: 'id', visible: true }, { id: 'name', visible: true }, { id: 'status', visible: true }, { id: 'rule', visible: true }] })
    expect(headers()).toEqual(['ID', 'Name', 'Status', 'Rule'])
  })

  it('cannot hide Name or ID', () => {
    renderTable({ columns: [{ id: 'id', visible: false }, { id: 'name', visible: false }, { id: 'rule', visible: true }] })
    expect(headers()).toEqual(['ID', 'Name', 'Rule'])
  })

  it('paints ID and Name first even when the list leaves them out', () => {
    renderTable({ columns: [{ id: 'rule', visible: true }] })
    expect(headers()).toEqual(['ID', 'Name', 'Rule'])
  })

  it('ignores an id it does not know', () => {
    renderTable({ columns: [{ id: 'id', visible: true }, { id: 'nope', visible: true }, { id: 'name', visible: true }] })
    expect(headers()).toEqual(['ID', 'Name'])
  })

  it('shows the business column only when storeOf is there and it is visible', () => {
    const all = MARKUP_COLUMN_IDS.map(id => ({ id, visible: true }))
    const { unmount } = renderTable({ columns: all })
    expect(screen.queryByRole('columnheader', { name: 'Business' })).toBeNull()
    unmount()
    const { unmount: unmountHidden } = renderTable({ columns: all.map(column => ({ ...column, visible: column.id !== 'store' })), storeOf: () => 'Burger Place' })
    expect(screen.queryByRole('columnheader', { name: 'Business' })).toBeNull()
    unmountHidden()
    renderTable({ columns: all, storeOf: () => 'Burger Place' })
    expect(headers()).toEqual(['ID', 'Name', 'Business', 'Applies to', 'Rule', 'Status'])
  })

  it('does not change the cards under 768px', () => {
    probe.phone = true
    renderTable({ columns: [{ id: 'id', visible: true }, { id: 'name', visible: false }] })
    expect(screen.getByRole('list', { name: 'Markups' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enabled: Own markup' })).toBeInTheDocument()
  })
})

// redesign tanda AB (S-3): the Rule column is a figure («+10%», «+$2.00»), so it is aligned to the end
describe('MarkupsTable · the Rule column is aligned to the end (S-3)', () => {
  it('aligns the header and the cells of Rule to the end, and leaves the text columns at the start', () => {
    renderTable()
    expect(screen.getByRole('columnheader', { name: 'Rule' })).toHaveAttribute('data-align', 'end')
    expect(screen.getByRole('columnheader', { name: 'Name' })).not.toHaveAttribute('data-align')
    const cell = screen.getAllByText('+10%')[0].closest('td')
    expect(cell).toHaveAttribute('data-align', 'end')
  })

  // S-3 review: ID is a figure too, as in StoresTable
  it('aligns the header and the cells of ID to the end as well', () => {
    renderTable()
    expect(screen.getByRole('columnheader', { name: 'ID' })).toHaveAttribute('data-align', 'end')
    expect(screen.getByText('21').closest('td')).toHaveAttribute('data-align', 'end')
  })
})
