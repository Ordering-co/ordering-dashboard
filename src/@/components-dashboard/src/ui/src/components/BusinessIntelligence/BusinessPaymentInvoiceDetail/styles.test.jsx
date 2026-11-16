// redesign (row 55): at 1280 the 440px invoice panel wrapped amounts like «$ 3.25» onto two lines. The amount cells
// (SummaryValue, `th.right, td.right` of DataTable, FeeAmount) do not wrap. The stylesheet is read as text (no layout in jsdom).
import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ServerStyleSheet, ThemeProvider } from 'styled-components'

import { DataTable, FeeAmount, OrderDetailsTableScroll, SummaryValue } from './styles'

const cssOf = (node) => {
  const sheet = new ServerStyleSheet()
  try {
    renderToString(sheet.collectStyles(<ThemeProvider theme={{ colors: {} }}>{node}</ThemeProvider>))
    return sheet.getStyleTags()
  } finally {
    sheet.seal()
  }
}

// The declarations of the rule whose selector list ends with `selector` (stylis prefixes it with the component class)
const declarationsOf = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\{([^}]*)\\}`))
  return match ? match[1] : null
}

describe('BusinessPaymentInvoiceDetail amounts', () => {
  it('SummaryValue (the figures of the summary) does not wrap', () => {
    const css = cssOf(<SummaryValue>$ 3.25</SummaryValue>)
    expect(css).toMatch(/font-size:16px;[^}]*white-space:nowrap/)
  })

  it('the right-aligned cells of the data tables do not wrap', () => {
    const css = cssOf(<DataTable />)
    const rule = declarationsOf(css, 'td.right')
    expect(rule).toContain('text-align:right')
    expect(rule).toContain('white-space:nowrap')
    expect(declarationsOf(css, 'td.center')).not.toContain('white-space')
  })

  it('FeeAmount does not wrap', () => {
    const css = cssOf(<FeeAmount>$ 3.25</FeeAmount>)
    expect(css).toMatch(/text-align:right;font-size:11px;[^}]*white-space:nowrap/)
  })

  // redesign the order summary scrolls inside its own container, which shows the brand focus ring when it takes a tab stop
  it('OrderDetailsTableScroll scrolls on its own and shows the brand focus ring', () => {
    const css = cssOf(<OrderDetailsTableScroll />)
    expect(declarationsOf(css, '')).toContain('overflow-x:auto')
    expect(css).toMatch(/:focus-visible\{[^}]*outline:var\(--od-focus-ring-width\) solid var\(--od-focus-ring-color\)/)
  })
})
