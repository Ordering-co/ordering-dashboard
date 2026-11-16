/* eslint-disable import/first */
// redesign cierre W0 (W0-QA4-04): on a phone the notice of /drivers-dashboard sat 0px under the search field. The slot of that page
// is `spaced`: a space token above it while the notice exists. jsdom lays nothing out: this pins the prop, the CSS and the mount.
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

describe('OrderNotificationSlot · spaced (W0-QA4-04)', () => {
  const css = read('Orders/OrderNotification/order-notification.css').replace(/\/\*[\s\S]*?\*\//g, '')

  beforeEach(() => { localStorage.clear() })

  it('only the slot that asks for it carries data-spaced', () => {
    const { container, unmount } = mount({ spaced: true })
    expect(container.querySelector('.odc-notice-slot')).toHaveAttribute('data-spaced')
    unmount()
    const plain = mount({})
    expect(plain.container.querySelector('.odc-notice-slot')).not.toHaveAttribute('data-spaced')
  })

  it('DriversManager is the page that asks for it, and the other three mounts do not', () => {
    expect(read('Orders/DriversManager/index.js')).toMatch(/<OrderNotificationSlot spaced \/>/)
    for (const file of ['Orders/DeliveriesManager/index.js', 'Orders/AllInOne/index.js', 'Shared/UI/MessagesListing.jsx']) {
      expect(read(file)).not.toMatch(/<OrderNotificationSlot[^>]*spaced/)
    }
  })

  it('on a phone, and while the notice exists, a space token goes above it', () => {
    const block = css.match(/@media \(max-width: 767px\) \{\s*\.odc-notice-slot\[data-spaced\]:has\(\.odc-sound-notice\) \{([^}]*)\}/)
    expect(block).not.toBeNull()
    expect(block[1]).toMatch(/margin-block-start:\s*var\(--od-space-2\)/)
  })
})
