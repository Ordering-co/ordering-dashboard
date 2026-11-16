/* eslint-disable import/first */
// redesign F6b (D-16): the sound notice is decided in the very first render, not in an effect after the
// first paint, so the list below it never moves 40px a frame after the page shows. `renderToString` runs
// no effects: what it prints is exactly what the first frame holds.
import React from 'react'
import { renderToString } from 'react-dom/server'
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

import { OrderNotification } from '..'

const theme = { colors: {}, images: { logos: { isotype: 'iso.png' } }, sounds: { notificationOgg: 'n.ogg', notificationMp3: 'n.mp3' } }
const firstFrame = () => renderToString(<ThemeProvider theme={theme}><OrderNotification /></ThemeProvider>)
const SOUND = 'The sound will be played on this page whenever a new order is received.'

describe('OrderNotification UI · first frame (D-16)', () => {
  beforeEach(() => { localStorage.clear() })

  it('holds the sound notice from the first render when the choice was not saved', () => {
    const html = firstFrame()
    expect(html).toContain(SOUND)
    expect(html).toContain('odc-sound-notice')
  })

  it('holds nothing from the first render when «Don’t show again» was saved', () => {
    localStorage.setItem('new_order_notification', '1')
    expect(firstFrame()).not.toContain(SOUND)
  })
})
