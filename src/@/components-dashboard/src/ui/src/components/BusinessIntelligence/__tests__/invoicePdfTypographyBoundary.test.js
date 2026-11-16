import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { buildInvoicePdfHtml } from '../downloadInvoicePdf'

// The Ordering.co Brand System governs typography through CSS custom properties on
// `:root`. The two invoice PDF rows are the one place in this adoption where that
// mechanism CANNOT reach, and this file is what keeps that boundary from being
// crossed by a later good intention.
//
// Why it cannot reach: `InvoiceBusinessManager` renders `<InvoiceBusinessPdf>` inside
// `InvoicePdfWrapper { display: none }`, serialises it with
// `invoicePdfRef.current.innerHTML`, and POSTs that string to `${root}/pdf/html`,
// where the server renders it. The document the server receives is built by
// `buildInvoicePdfHtml`, whose `<style>` block defines a font-family and an img rule
// and NOTHING else. No `:root`, no custom properties, no app stylesheet.
//
// So a `var(--od-type-content-size)` written into those inline styles would travel to
// the server as literal text, resolve to nothing, and the generated PDF would lose
// the size. The failure is silent and lands in a customer-facing document, which is
// why it is asserted here rather than left as a note in a review.
//
// Note the contrast with the OTHER print surface in the same batch:
// `BusinessPaymentInvoiceDetail` prints through `react-to-print`, whose `copyStyles`
// rebuilds every `<style>` from `sheet.cssRules[].cssText` into the print iframe and
// therefore DOES carry the `:root` block across. Same batch, same word "print", and
// the opposite answer -- which is the reason each one was traced to its own mechanism
// instead of being decided by the folder they share.

const here = path.dirname(fileURLToPath(import.meta.url))
const pdfRows = ['InvoiceBusinessPdf', 'InvoiceDriverPdf']

describe('the invoice PDF typography boundary', () => {
  it('builds a document that defines no custom properties at all', () => {
    const html = buildInvoicePdfHtml({ bodyHtml: '<div><span>Invoice</span></div>', logoSrc: '' })
    const head = html.slice(0, html.indexOf('<body>'))

    expect(head).not.toContain(':root')
    expect(head).not.toContain('--od-type-')
    expect(head).not.toContain('--od-')
  })

  it('carries an unresolved custom property straight through to the server', () => {
    // Not a claim about what the code does today -- a demonstration of the mechanism
    // the other test protects against. Nothing resolves this; it is sent as text.
    const html = buildInvoicePdfHtml({
      bodyHtml: '<span style="font-size:var(--od-type-content-size)">Total</span>',
      logoSrc: ''
    })

    expect(html).toContain('font-size:var(--od-type-content-size)')
    expect(html.slice(0, html.indexOf('<body>'))).not.toContain('--od-type-content-size')
  })

  for (const row of pdfRows) {
    it(`${row} governs its sizes with literals, never with a custom property`, () => {
      const source = readFileSync(path.join(here, '..', row, 'index.js'), 'utf8')

      expect(source, `${row} declares sizes`).toMatch(/fontSize:/)
      expect(source, `${row} must not reach for a CSS variable`).not.toContain('--od-type-')
      expect(source, `${row} must not reach for var()`).not.toMatch(/var\(\s*--/)
    })
  }
})
