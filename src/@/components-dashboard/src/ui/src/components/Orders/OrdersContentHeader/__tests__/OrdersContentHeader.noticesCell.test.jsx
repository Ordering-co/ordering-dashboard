/* eslint-disable import/first */
// redesign F6d (Q3-03): the cell of the notices under the tabs measured in a real browser. jsdom has no layout, so this renders
// the real UIs of the two notices (the sound one and the connection one, wired as OrdersManager wires them), takes their
// markup, and measures it in headless Chromium with the real stylesheets. It is skipped, loudly named, where no Chromium is
// installed (CI runs the browser specs apart).
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { chromium } from '@playwright/test'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ socketStatus: 1 }))

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: {}, loading: false }],
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: date => `${date}` }],
  useEvent: () => [{ on: vi.fn(), off: vi.fn(), emit: vi.fn() }],
  OrderNotification: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  WebsocketStatus: ({ UIComponent, ...props }) => (
    <UIComponent {...props} socketStatus={runtime.socketStatus} connectedDate='2026-10-05' isConnectionDegraded={false} />
  )
}))
// (row 32): WebsocketStatus now lives in Shared/Product and imports each context and its controller by file, not the root index
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_key, fallback) => fallback] }))
vi.mock('../../../../../../contexts/UtilsContext', () => ({ useUtils: () => [{ parseDate: date => `${date}` }] }))
vi.mock('../../../../../../contexts/EventContext', () => ({ useEvent: () => [{ on: vi.fn(), off: vi.fn(), emit: vi.fn() }] }))
vi.mock('../../../../../../components/WebsocketStatus', () => ({
  WebsocketStatus: ({ UIComponent, ...props }) => (
    <UIComponent {...props} socketStatus={runtime.socketStatus} connectedDate='2026-10-05' isConnectionDegraded={false} />
  )
}))
vi.mock('react-toastify', () => ({ toast: Object.assign(vi.fn(), { configure: vi.fn() }) }))
vi.mock('react-toastify/dist/ReactToastify.css', () => ({}))

import { OrderNotification } from '../../OrderNotification'
import { WebsocketStatus } from '../../WebsocketStatus'

const components = path.resolve(__dirname, '../../..')
const brand = path.resolve(__dirname, '../../../../../../../../../brand')
const productDir = path.join(components, 'Shared/Product')
const publicDir = path.resolve(brand, '../../public')
const stylesheet = [
  path.join(brand, 'ordering.tokens.generated.css'),
  path.join(brand, 'candidates.css'),
  ...readdirSync(productDir).filter(file => file.endsWith('.css')).map(file => path.join(productDir, file)),
  path.join(components, 'Orders/OrdersContentHeader/content-header.css'),
  path.join(components, 'Orders/OrderNotification/order-notification.css') // websocket-status.css moved to Shared/Product: the readdir of productDir above already carries it
].map(file => readFileSync(file, 'utf8')).join('\n')

const theme = { colors: {}, images: { logos: { isotype: 'iso.png' } }, sounds: { notificationOgg: 'n.ogg', notificationMp3: 'n.mp3' } }

// The same composition as OrdersManager: the notices cell holds a host for the connection notice and the sound notice.
const Notices = () => {
  const [host, setHost] = useState(null)
  return (
    <>
      <WebsocketStatus renderNotice={notice => (host ? createPortal(notice, host) : null)} />
      <div className='odc-orders-notices'>
        <div ref={setHost} />
        <OrderNotification />
      </div>
    </>
  )
}

// The markup of one state: `sound` is whether the user has not said «Don't show again», `connection` a lost connection.
const markupOf = ({ sound, connection }) => {
  localStorage.clear()
  if (!sound) localStorage.setItem('new_order_notification', '1')
  runtime.socketStatus = 1
  const { container, rerender } = render(<ThemeProvider theme={theme}><Notices /></ThemeProvider>)
  if (connection) {
    runtime.socketStatus = 2
    act(() => rerender(<ThemeProvider theme={theme}><Notices /></ThemeProvider>))
  }
  return container.querySelector('.odc-orders-notices')?.outerHTML ?? ''
}

const hasChromium = existsSync(chromium.executablePath())

describe.skipIf(!hasChromium)('the notices cell, measured in Chromium (Q3-03)', () => {
  let browser
  beforeAll(async () => { browser = await chromium.launch() })
  afterAll(async () => { await browser?.close() })
  beforeEach(() => { document.body.innerHTML = '' })

  // viewport: the page; list: the width of the column the notices sit in (the list beside the order panel is narrower).
  const measure = async ({ viewport, list }, state) => {
    const html = markupOf(state)
    document.body.innerHTML = ''
    const page = await browser.newPage({ viewport: { width: viewport, height: 800 } })
    // The page is served from memory and the brand fonts from /public, so the text wraps where the real one does.
    await page.route('http://harness.test/**', (route) => {
      const { pathname } = new URL(route.request().url())
      if (pathname === '/') {
        return route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><html data-ordering-brand><head><style>${stylesheet}</style></head><body><div style="inline-size:${list}px">${html}<div id="below">list</div></div></body></html>`
        })
      }
      const file = path.join(publicDir, decodeURIComponent(pathname))
      return existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: '' })
    })
    try {
      await page.goto('http://harness.test/')
      await page.evaluate(() => document.fonts.ready)
      return await page.evaluate(() => {
        const shown = element => {
          const style = getComputedStyle(element)
          return style.display !== 'none' && style.visibility !== 'hidden'
        }
        const notices = [...document.querySelectorAll('.odc-notice')]
        return {
          cell: document.querySelector('.odc-orders-notices').getBoundingClientRect().height,
          below: document.getElementById('below').getBoundingClientRect().top,
          // the tallest notice that is actually on screen: the cell must be exactly this tall, never taller
          tallestShown: Math.max(0, ...notices.filter(shown).map(notice => notice.getBoundingClientRect().height)),
          sound: document.querySelector('.odc-sound-notice')?.getBoundingClientRect().height ?? 0,
          connection: document.querySelector('.odc-connection-notice')?.getBoundingClientRect().height ?? 0,
          connectionDisplay: document.querySelector('.odc-connection-notice') && getComputedStyle(document.querySelector('.odc-connection-notice')).display
        }
      })
    } finally {
      await page.close()
    }
  }

  const none = { sound: false, connection: false }
  const soundOnly = { sound: true, connection: false }
  const connectionOnly = { sound: false, connection: true }
  const both = { sound: true, connection: true }

  it.each([
    ['1280 with the menu expanded and the order panel open (list of 552px)', { viewport: 1280, list: 552 }],
    ['1440 without the panel', { viewport: 1440, list: 1152 }]
  ])('at %s: no notice takes nothing, each notice is one line, and both never add up or change the height', async (_name, size) => {
    const empty = await measure(size, none)
    const sound = await measure(size, soundOnly)
    const connection = await measure(size, connectionOnly)
    const bothShown = await measure(size, both)
    expect(empty.cell).toBe(0)
    expect(sound.cell).toBeGreaterThan(0)
    // a notice that is not shown adds nothing: in every state the cell is as tall as the tallest one on screen
    for (const state of [empty, sound, connection, bothShown]) expect(state.cell).toBe(state.tallestShown)
    // one line each: the same height (the old sound notice wrapped to 66px against the 40px of the connection one)
    expect(sound.cell).toBe(connection.cell)
    expect(sound.cell).toBeLessThanOrEqual(44)
    // both: the height of one, and the list below does not move from the sound-only case
    expect(bothShown.cell).toBe(sound.cell)
    expect(bothShown.below).toBe(sound.below)
    // the one that waits takes no space at all
    expect(bothShown.connectionDisplay).toBe('none')
    expect(bothShown.connection).toBe(0)
  })

  it('on a phone (390px) the cell is exactly the notice that is shown: no blank left by the one that waits', async () => {
    const size = { viewport: 390, list: 358 }
    const sound = await measure(size, soundOnly)
    const connection = await measure(size, connectionOnly)
    const bothShown = await measure(size, both)
    for (const state of [sound, connection, bothShown]) expect(state.cell).toBe(state.tallestShown)
    expect(bothShown.cell).toBe(sound.cell)
    expect(bothShown.cell).toBe(sound.sound)
    expect(connection.cell).toBe(connection.connection)
    expect(bothShown.connection).toBe(0)
  })
})
