import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'
import { BubbleCustomer, Chat, ImagePreviewWrapper, TabItem, TimeofSent } from '../styles'

// redesign W1-6 (W1-QB1-04, W1-QB1-06): what the chat paints from the theme and from the page direction.
const tenantTheme = {
  ...defaultTheme,
  colors: { ...defaultTheme.colors, primaryContrast: '#ffffff' },
  ordering: {
    actionOverride: '#2c7be5', // the color the tenant stored (dashboard_buttons_colors): 4.14:1 with white text
    semantic: { action: { default: '#266DF0', content: '#1F5FD1', foreground: '#ffffff', focus: '#1F5FD1' } }
  }
}

describe('Messages styles · the operator bubble (W1-QB1-04, decision 30)', () => {
  it('takes the action of the product, never the color of the tenant, as its background', () => {
    const { getByText } = renderWithProviders(<BubbleCustomer>hello</BubbleCustomer>, { theme: tenantTheme })
    const bubble = getByText('hello')
    expect(getComputedStyle(bubble).backgroundColor).toBe('rgb(38, 109, 240)')
    expect(getComputedStyle(bubble).backgroundColor).not.toBe('rgb(44, 123, 229)')
    expect(getComputedStyle(bubble).color).toBe('rgb(255, 255, 255)')
  })

  it('still falls back to the primary color of the legacy theme when the product tokens are missing', () => {
    const { getByText } = renderWithProviders(<BubbleCustomer>hello</BubbleCustomer>, { theme: { ...defaultTheme, colors: { ...defaultTheme.colors, primary: '#123456', primaryContrast: '#fefefe' } } })
    expect(getComputedStyle(getByText('hello')).backgroundColor).toBe('rgb(18, 52, 86)')
  })
})

describe('Messages styles · the relative time (W1-QB1-06, decision 11)', () => {
  it('is a phrase: no mono font and not forced to left-to-right, so Arabic keeps its reading order', () => {
    const { getByText } = renderWithProviders(<TimeofSent>منذ ساعات 7</TimeofSent>, { theme: tenantTheme })
    const time = getByText('منذ ساعات 7')
    expect(getComputedStyle(time).direction).not.toBe('ltr')
    expect(getComputedStyle(time).fontFamily).not.toMatch(/identifier|mono/i)
    expect(getComputedStyle(time).fontVariantNumeric).toBe('tabular-nums')
  })
})

describe('Messages styles · the scrollable chat (W1-QB1-04)', () => {
  it('shows a focus ring of the product when it takes the focus', () => {
    renderWithProviders(<Chat id='chat'>x</Chat>, { theme: tenantTheme })
    const css = [...document.querySelectorAll('style')].map(style => style.textContent).join('\n')
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid #1F5FD1/)
  })
})

describe('Messages styles · the tenant color stays on the primary action (decision 30, W1-D-38)', () => {
  it('paints the open-image link with the action of the product, not the tenant color', () => {
    const { getByText } = renderWithProviders(<ImagePreviewWrapper><a href='#x'>open</a></ImagePreviewWrapper>, { theme: tenantTheme })
    const link = getByText('open')
    expect(getComputedStyle(link).color).not.toBe('rgb(44, 123, 229)')
    expect(getComputedStyle(link).color).toBe('rgb(31, 95, 209)')
  })

  it('underlines the active tab with the action of the product, not the tenant color', () => {
    const { getByText } = renderWithProviders(<TabItem active>Order</TabItem>, { theme: tenantTheme })
    const tab = getByText('Order')
    expect(getComputedStyle(tab).borderBottomColor).not.toBe('rgb(44, 123, 229)')
    expect(getComputedStyle(tab).borderBottomColor).toBe('rgb(38, 109, 240)')
  })
})

describe('Messages styles · the message area keeps a floor (W1-D-38)', () => {
  it('asks for a minimum block size from a token, so a short window scrolls the container instead of squeezing the thread', () => {
    renderWithProviders(<Chat id='chat'>x</Chat>, { theme: tenantTheme })
    const css = [...document.querySelectorAll('style')].map(style => style.textContent).join('\n')
    expect(css).toMatch(/min-block-size:\s*var\(--od-x-chat-min-block\)/)
  })

  it('lets the conversation pane of /messages scroll and floors its thread, instead of clipping it (inbox.css)', () => {
    const css = readFileSync(resolve(__dirname, '..', 'inbox.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const pane = css.match(/\.odi-inbox \.odi-pane > \[data-layout='standalone'\]\s*\{([^}]*)\}/)[1]
    expect(pane).toMatch(/overflow-y:\s*auto/)
    const thread = css.match(/\.odt-chat-log\s*\{([^}]*)\}/)[1]
    expect(thread).toMatch(/min-block-size:\s*var\(--od-x-chat-min-block\)/)
  })
})
