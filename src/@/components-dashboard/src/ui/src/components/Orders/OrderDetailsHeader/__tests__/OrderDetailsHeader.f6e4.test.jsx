// redesign F6e (Q4-05): in the metadata line the icon of an item and its text stay together. At 1280 with the panel
// open the wallet icon sat alone on one line and «Stripe connect (ch_…) (Success)» dropped under it, because the item
// let its children wrap as separate boxes. The text is its own box that wraps after the icon.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { screen } from '@testing-library/react'
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
const rule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>:]/g, '\\$&')
  return css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? null
}

const order = {
  id: 13601,
  status: 11,
  delivery_type: 1,
  created_at: '2026-10-06 08:26',
  app_id: 'ordering-web',
  external_id: 'EXT-9',
  payment_events: [{
    event: 'payment',
    paymethod: { gateway: 'stripe_connect', name: 'Stripe connect' },
    data: { gateway: 'stripe_connect', result: { pay_data: 'ch_3UL9cHDqHP0jk7WJ1WB5r2ch' } }
  }]
}

const renderHeader = () => renderWithProviders(
  <OrderDetailsHeader
    order={order}
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
)

describe('OrderDetailsHeader · metadata items keep icon and text together (Q4-05)', () => {
  it('puts the payment text, with its Stripe link, in one text box next to the icon', () => {
    renderHeader()
    const item = screen.getByTestId('order-meta').querySelectorAll(':scope > span')[2]
    expect(item.querySelector(':scope > svg.odc-od-meta-icon')).not.toBeNull()
    const text = item.querySelector(':scope > .odc-od-meta-text')
    expect(text).not.toBeNull()
    expect(text).toHaveTextContent('Stripe connect (ch_3UL9cHDqHP0jk7WJ1WB5r2ch)')
    expect(text.querySelector('a.odc-od-link')).toHaveTextContent('ch_3UL9cHDqHP0jk7WJ1WB5r2ch')
  })

  it('gives every text of the line the same box (created, delivery, channel, external id)', () => {
    renderHeader()
    const meta = screen.getByTestId('order-meta')
    const items = [...meta.querySelectorAll(':scope > span')]
    expect(items).toHaveLength(5)
    items.slice(0, 4).forEach(item => {
      expect(item.querySelectorAll(':scope > .odc-od-meta-text')).toHaveLength(1)
    })
    // external id: caption and mono value are both text boxes
    expect(items[4].querySelectorAll(':scope > .odc-od-meta-text')).toHaveLength(2)
  })

  it('does not let the children of an item wrap into separate lines', () => {
    expect(rule('.odc-od-meta > span')).toMatch(/flex-wrap:\s*nowrap/)
    expect(rule('.odc-od-meta > span')).not.toMatch(/flex-wrap:\s*wrap/)
  })

  it('keeps the icon at its size and lets the text shrink and break a long transaction id', () => {
    expect(rule('.odc-od-meta .odc-od-meta-icon')).toMatch(/flex:\s*none/)
    const text = rule('.odc-od-meta-text')
    expect(text).toMatch(/min-inline-size:\s*0/)
    expect(text).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('aligns the icon with the first line of the text when the text wraps', () => {
    expect(rule('.odc-od-meta > span')).toMatch(/align-items:\s*flex-start/)
    expect(rule('.odc-od-meta .odc-od-meta-icon')).toMatch(/margin-block-start:\s*calc\(\(var\(--od-x-type-ui-size\) \* var\(--od-x-leading-ui\) - var\(--od-x-icon-sm\)\) \/ 2\)/)
  })

  it('keeps the Not prepaid badge centred on its line and never squeezed', () => {
    expect(rule('.odc-od-meta > span:has(> .odc-badge)')).toMatch(/align-items:\s*center/)
    expect(rule('.odc-od-meta > span > .odc-badge')).toMatch(/flex:\s*none/)
  })
})
