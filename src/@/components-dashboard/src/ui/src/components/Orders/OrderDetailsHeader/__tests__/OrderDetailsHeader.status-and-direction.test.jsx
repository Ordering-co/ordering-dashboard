// (review R1): at 1024 the panel is ~440px wide, so the container rule (≤480px) gave the status badge
// `order: 9` to send it to its own line; but the row still had room, so the badge sat after the actions, right of Close.
// The badge now has a box of its own, like the skeleton's (order-details.css › .odc-od-sk-badge), and that box takes the
// whole line when the panel is narrow: the status is always under the number and Close stays in the corner.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: { change_order_id: { value: '1' } } }],
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ parsePrice: value => `$${value}`, parseDate: value => `date(${value})` }]
}))
vi.mock('react-to-print', () => ({ useReactToPrint: () => vi.fn() }))
vi.mock('../../../Shared', () => ({ ConfirmAdmin: () => null }))
vi.mock('../../OrderTrackingLink', () => ({ useOrderTrackingLink: () => ({ menuItems: [], dialog: null }) }))

import { OrderDetailsHeader } from '..'

const css = readFileSync(path.join(__dirname, '..', 'order-details-header.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const narrow = css.match(/@container odc-order \(max-width: 480px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
const narrowRule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>:]/g, '\\$&')
  return narrow.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? null
}

const renderHeader = ({ dir, isServiceOrder = false, order = { id: 14429, status: 11, delivery_type: 1, created_at: '2026-10-06 08:26' } } = {}) => renderWithProviders(
  <div dir={dir}>
  <OrderDetailsHeader
    order={order}
    isServiceOrder={isServiceOrder}
    actionSidebar={vi.fn()}
    handleShowOption={vi.fn()}
    handleDeleteOrder={vi.fn()}
    setIsTourOpen={vi.fn()}
    isTourOpen={false}
    currentTourStep={0}
    printRef={{ current: null }}
    printTicketRef={{ current: null }}
    isExpand={false}
    setIsExpand={vi.fn()}
  />
  </div>
)

describe('OrderDetailsHeader · the status never lands after Close', () => {
  it('puts the status badge in its own box, between the title and the spacer', () => {
    const { container } = renderHeader()
    const row = container.querySelector('.odc-od-head-row')
    const status = row.querySelector(':scope > .odc-od-head-status')
    expect(status).not.toBeNull()
    expect(status.querySelector('.odc-badge')).not.toBeNull()
    expect(status.previousElementSibling).toHaveClass('odc-od-title')
    expect(status.nextElementSibling).toHaveClass('odc-od-spacer')
  })

  // review of a box that could shrink let a long status («Der Kunde ist fast im Geschäft angekommen», de, 1440)
  // overflow it and cover Print. Like the bare badge before, the box keeps the badge's width and the title is what gives.
  it('never shrinks below its badge in a wide panel', () => {
    const base = css.replace(/@container[\s\S]*?\n\}/g, '')
    const box = base.match(/\.odc-od-head-status\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(box).toMatch(/flex:\s*none/)
    expect(box).not.toMatch(/min-inline-size:\s*0/)
  })

  it('gives that box the whole line in a narrow panel, so the row cannot keep it after the actions', () => {
    const rule = narrowRule('.odc-od-head-row > .odc-od-head-status')
    expect(rule).not.toBeNull()
    expect(rule).toMatch(/order:\s*9/)
    expect(rule).toMatch(/flex-basis:\s*100%/)
  })

  // Arabic, 1440, a long status: «#14428» broke letter by letter. The title keeps its width and the row wraps instead,
  // at any width, so a long status goes to the next line and nothing is hidden.
  it('keeps the title whole: it neither shrinks nor breaks inside the number', () => {
    const base = css.replace(/@container[\s\S]*?\n\}/g, '')
    const title = base.match(/\.odc-od-title\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(title).toMatch(/flex:\s*none/)
    expect(title).toMatch(/white-space:\s*nowrap/)
    expect(title).toMatch(/overflow-wrap:\s*normal/)
    expect(title).not.toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('lets the row wrap at any width, outside the container query', () => {
    const base = css.replace(/@container[\s\S]*?\n\}/g, '')
    const row = base.match(/\.odc-od-head-row\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(row).toMatch(/flex-wrap:\s*wrap/)
  })
})

describe('OrderDetailsHeader · the number reads left to right in a right-to-left panel', () => {
  it('isolates «#id» in a bdi dir=ltr, so Arabic does not paint «14429#»', () => {
    const { container } = renderHeader({ dir: 'rtl' })
    const number = container.querySelector('.odc-od-title bdi[dir=ltr]')
    expect(number).not.toBeNull()
    expect(number).toHaveClass('odc-mono')
    expect(number.textContent).toBe('#14429')
  })

  it('does the same for the number of an appointment', () => {
    const { container } = renderHeader({ dir: 'rtl', isServiceOrder: true })
    const number = container.querySelector('.odc-od-title bdi[dir=ltr]')
    expect(number).not.toBeNull()
    expect(number.textContent).toContain('14429')
  })
})
