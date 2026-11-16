/* eslint-disable import/first */
// redesign W0-12 (W0-A0-01): the sound notice is a one-line slot INSIDE the page, never a bare sibling of it.
// Mounted as a fragment sibling it became a flex column of the shell next to the page (685px wide at 1440, 350px at 390,
// the list left at 40px). jsdom lays nothing out, so this pins the placement: what each mount renders it through, where it
// sits against the head and the list, and the CSS that makes the slot a block that takes no height when empty.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: {}, loading: false }],
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useEvent: () => [{ on: vi.fn(), off: vi.fn() }],
  OrderNotification: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('react-toastify', () => ({ toast: Object.assign(vi.fn(), { configure: vi.fn() }) }))
vi.mock('react-toastify/dist/ReactToastify.css', () => ({}))

import { OrderNotificationSlot } from '..'

const COMPONENTS = path.join(__dirname, '..', '..', '..')
const read = file => readFileSync(path.join(COMPONENTS, file), 'utf8')
const theme = { colors: {}, images: { logos: { isotype: 'iso.png' } }, sounds: { notificationOgg: 'n.ogg', notificationMp3: 'n.mp3' } }
const mount = (props) => render(<ThemeProvider theme={theme}><div data-testid='page'><OrderNotificationSlot {...props} /></div></ThemeProvider>)

// The four pages that mount it as the page's own notice (/orders keeps `.odc-orders-notices` in OrdersContentHeader).
// `head` is the last element of the page head and `list` the first element of its list, in source order.
const MOUNTS = [
  ['DeliveriesManager (/deliveries)', 'Orders/DeliveriesManager/index.js', '<OrdersContentHeader', '<OrdersContent>'],
  ['DriversManager (/drivers-dashboard)', 'Orders/DriversManager/index.js', '</DriversHeader>', '<DriversContent>'],
  // redesign all-in-one B2 (decision 1): the list of /all-in-one starts at its board (MainContentContainer went with the old layout)
  ['AllInOne (/all-in-one)', 'Orders/AllInOne/index.js', '<OrdersContentHeader', "<div className='aio-board'"],
  // redesign messages B3b (decision 1A): the /messages list is now the inbox, still under the head and the slot
  ['MessagesListing (/messages)', 'Shared/UI/MessagesListing.jsx', '<OrdersContentHeader', '<Inbox']
]

describe('OrderNotificationSlot · the slot', () => {
  beforeEach(() => { localStorage.clear() })

  it('holds the sound notice inside one slot element of the page, not as a bare sibling', () => {
    const { container, getByTestId } = mount()
    const slot = container.querySelector('.odc-notice-slot')
    expect(slot).not.toBeNull()
    expect(slot.parentElement).toBe(getByTestId('page'))
    expect(slot.querySelector('.odc-sound-notice')).not.toBeNull()
    // the page has ONE element for it: whatever the notice renders is inside the slot
    expect(getByTestId('page').children).toHaveLength(1)
  })

  it('leaves the slot with no notice (so no height) once «Don’t show again» was saved', () => {
    localStorage.setItem('new_order_notification', '1')
    const { container } = mount()
    expect(container.querySelector('.odc-notice-slot')).not.toBeNull()
    expect(container.querySelector('.odc-sound-notice')).toBeNull()
  })

  it('passes the page scope (customer, delivery only) to the notice', () => {
    const { container } = mount({ isOnlyDelivery: true, customerId: 7 })
    expect(container.querySelector('.odc-notice-slot .odc-sound-notice')).not.toBeNull()
  })
})

describe('OrderNotificationSlot · the mounts', () => {
  it.each(MOUNTS)('%s mounts it through the slot, under the head and above the list, once', (_name, file, head, list) => {
    const source = read(file)
    expect(source.match(/<OrderNotificationSlot\b/g)).toHaveLength(1)
    expect(source).not.toMatch(/<OrderNotification\b(?!Slot)/)
    const at = source.indexOf('<OrderNotificationSlot')
    expect(source.indexOf(head)).toBeGreaterThan(-1)
    expect(source.indexOf(head)).toBeLessThan(at)
    expect(at).toBeLessThan(source.indexOf(list))
  })

  it('the mounts are inside the page container: nothing mounts it after the container closes', () => {
    const deliveries = read('Orders/DeliveriesManager/index.js')
    expect(deliveries.indexOf('<OrderNotificationSlot')).toBeLessThan(deliveries.indexOf('</DeliveriesContainer>'))
    const drivers = read('Orders/DriversManager/index.js')
    expect(drivers.indexOf('<OrderNotificationSlot')).toBeLessThan(drivers.indexOf('</DriversContainer>'))
    const allInOne = read('Orders/AllInOne/index.js')
    expect(allInOne.indexOf('<OrderNotificationSlot')).toBeLessThan(allInOne.indexOf('</OrdersListContainer>'))
    const messages = read('Shared/UI/MessagesListing.jsx')
    expect(messages.indexOf('<OrderNotificationSlot')).toBeLessThan(messages.indexOf('</MessagesListingContainer>'))
  })

  it('/orders is unchanged: its notice stays in the slot of OrdersContentHeader\'s tab panel', () => {
    const orders = read('Orders/OrdersManager/index.js')
    expect(orders).toMatch(/<div className='odc-orders-notices'>[\s\S]*<OrderNotification customerId=\{props\.customerId\} \/>/)
    expect(orders).not.toContain('OrderNotificationSlot')
  })
})

describe('OrderNotificationSlot · the CSS', () => {
  const css = read('Orders/OrderNotification/order-notification.css').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = Array.from(css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)).map(([, selector, body]) => ({ selector: selector.trim(), body }))
  const bodyOf = (selector) => rules.filter(rule => rule.selector.split(',').some(item => item.trim() === selector)).map(rule => rule.body).join(' ')

  it('the slot is a block grid of the page that can shrink: it never grows into a flex column', () => {
    const body = bodyOf('.odc-notice-slot')
    expect(body).toMatch(/display:\s*grid/)
    expect(body).toMatch(/min-inline-size:\s*0/)
    expect(body).not.toMatch(/flex(-grow)?:\s*[1-9]/)
  })

  it('the gap under the notice exists only while the notice does', () => {
    expect(bodyOf('.odc-notice-slot')).not.toMatch(/margin/)
    expect(bodyOf('.odc-notice-slot:has(.odc-sound-notice)')).toMatch(/margin-block-end:\s*var\(--od-space-2\)/)
  })

  it('the notice in the slot has no margin of its own (the slot does the spacing) and keeps the width of its container', () => {
    expect(bodyOf('.odc-notice-slot .odc-notice.odc-sound-notice')).toMatch(/margin-block-end:\s*0/)
    expect(bodyOf('.odc-notice-slot > *')).toMatch(/min-inline-size:\s*0/)
  })
})
