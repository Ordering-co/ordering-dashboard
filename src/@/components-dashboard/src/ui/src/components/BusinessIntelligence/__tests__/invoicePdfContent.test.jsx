/* eslint-disable import/first */
// redesign invoice FB (D10, IV-09, D19): the text of the two invoice PDFs. They are the source of the HTML posted to
// POST /pdf/html, so their inline styles do not change (guard l6-b3 + invoicePdfTypographyBoundary.test.js). Only three
// things change: the period is painted with the date format of the project (not the ISO string), and the driver status
// is translated like the business one. The inline snapshots pin everything else, with the REAL UtilsProviders.
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ configs: {}, dictionary: {} }))

vi.mock('../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))
vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [
    { loading: false, dictionary: mocks.dictionary, language: { code: 'en' } },
    (_key, fallback) => fallback
  ]
}))
vi.mock('../../../../../index', async () => {
  const { useUtils } = await import('../../../../../contexts/UtilsContext')
  return {
    useLanguage: () => [
      { loading: false, dictionary: mocks.dictionary, language: { code: 'en' } },
      (_key, fallback) => fallback
    ],
    useUtils
  }
})

import { UtilsProviders } from '../../../../../contexts/UtilsContext'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { InvoiceBusinessPdf } from '../InvoiceBusinessPdf'
import { InvoiceDriverPdf } from '../InvoiceDriverPdf'

const ORDERS = [
  { id: 101, delivery_datetime: '2026-09-05 10:30:00', status: 11, sub: 20, total: 25 },
  { id: 102, delivery_datetime: '2026-09-29 18:00:00', status: 1, sub: 10.5, total: 12 }
]

const businessInvoice = (extra = {}) => ({
  business: { name: 'Fast Bite' },
  type: 'payout',
  from: '2026-09-01',
  to: '2026-09-30',
  orders: ORDERS,
  orders_subtotal: 30.5,
  orders_total: 37,
  inlcude_discounts: true,
  discounts: 2,
  tax_products: 5,
  percentage_fee: 10,
  percentage_fee_total: 3.05,
  fixed_fee_total: 1,
  misc_amount: 3,
  misc_description: 'Adjustment',
  subtotal: 34.55,
  tax: 7,
  tax_total: 2.42,
  total: 36.97,
  notes: 'Pay within 30 days &lt;b&gt;now&lt;/b&gt;',
  ...extra
})

const driverInvoice = (extra = {}) => ({
  driver: { name: 'Grace Okafor' },
  from: '2026-09-01',
  to: '2026-09-30',
  orders: ORDERS,
  orders_subtotal: 30.5,
  orders_total: 37,
  discounts: 2,
  percentage_fee: 10,
  percentage_fee_total: 3.05,
  fixed_fee_total: 1,
  percentage_delivery_price_total: 4,
  percentage_driver_tip_total: 1.5,
  misc_amount: 3,
  misc_description: 'Adjustment',
  subtotal: 34.55,
  tax: 7,
  tax_total: 2.42,
  total: 36.97,
  notes: 'Pay within 30 days &lt;b&gt;now&lt;/b&gt;',
  ...extra
})

const render = (Pdf, invoice) => renderToStaticMarkup(
  <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
    <UtilsProviders>
      <Pdf
        exportInvoiceList={{ invoice }}
        getSubtotal={(order) => order.sub}
        getTotal={(order) => order.total}
        logoSrc='data:image/png;base64,AAA'
      />
    </UtilsProviders>
  </ConfigFileContext.Provider>
)

// One tag per line so a diff names the line that moved.
const pretty = (html) => html.replace(/></g, '>\n<')

const dictionary = {
  ORDERING_DELIVERY_COMPLETED_BY_DRIVER: 'Entregado por el repartidor',
  ORDERING_COMPLETED_BY_ADMIN: 'Completado por el administrador'
}

const originalTZ = process.env.TZ

beforeEach(() => {
  process.env.TZ = 'America/Los_Angeles'
  mocks.configs = { dates_general_format: { value: 'DD/MM/YYYY HH:mm' } }
  mocks.dictionary = dictionary
})

afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ
  else process.env.TZ = originalTZ
})

describe.each([
  ['InvoiceBusinessPdf', InvoiceBusinessPdf, businessInvoice],
  ['InvoiceDriverPdf', InvoiceDriverPdf, driverInvoice]
])('%s period (D10, IV-09)', (_name, Pdf, makeInvoice) => {
  it('paints the days with the date format of the project, not the ISO string', () => {
    const html = render(Pdf, makeInvoice())
    expect(html).not.toContain('2026-09-01')
    expect(html).not.toContain('2026-09-30')
    expect(html).toContain('<b>01/09/2026</b>')
    expect(html).toContain('<b>30/09/2026</b>')
  })

  it('shows the 1st of September in America/Los_Angeles, never the 31st of August', () => {
    expect(new Date('2026-09-15T12:00:00Z').getTimezoneOffset()).toBe(420)
    const html = render(Pdf, makeInvoice())
    expect(html).not.toContain('31/08/2026')
    expect(html).toContain('<b>01/09/2026</b>')
  })

  it('follows the project date format (a month name format)', () => {
    mocks.configs = { dates_general_format: { value: 'MMM D, YYYY' } }
    const html = render(Pdf, makeInvoice())
    expect(html).toContain('<b>Sep 1, 2026</b>')
    expect(html).toContain('<b>Sep 30, 2026</b>')
  })

  it('keeps the condition of main: the period needs both dates', () => {
    expect(render(Pdf, makeInvoice({ to: '' }))).not.toContain('<b>01/09/2026</b>')
    expect(render(Pdf, makeInvoice({ from: '' }))).not.toContain('<b>30/09/2026</b>')
    expect(render(Pdf, makeInvoice({ from: '', to: '' }))).not.toContain('From')
  })
})

describe('InvoiceDriverPdf status (D19)', () => {
  it('translates the status of each order with getOrderStatusPrefix and the prefix of the project', () => {
    const html = render(InvoiceDriverPdf, driverInvoice())
    expect(html).toContain('Entregado por el repartidor')
    expect(html).toContain('Completado por el administrador')
    expect(html).not.toContain('Delivery completed by driver')
  })

  it('falls back to the English text of getOrderStatusPrefix when the dictionary has no key', () => {
    mocks.dictionary = {}
    const html = render(InvoiceDriverPdf, driverInvoice())
    expect(html).toContain('Delivery completed by driver')
    expect(html).toContain('Completed by admin')
  })
})

// (D-25 a, intelligence-invoice P5): «Orders (Subtotal)» and «Discount» sit among the rows that add up, but the
// subtotal of a driver invoice only adds the fees, misc, delivery price and tip (D20), so the two say they are not added.
describe('InvoiceDriverPdf informative rows', () => {
  const totalsRows = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return [...doc.querySelectorAll('table')[1].querySelectorAll('tbody tr')].map(row => row.querySelector('td').textContent.replace(/\s+/g, ' ').trim())
  }

  it('marks «Orders (Subtotal)» and «Discount» as for reference, and no row that adds up', () => {
    const rows = totalsRows(render(InvoiceDriverPdf, driverInvoice()))
    expect(rows[0]).toBe('Orders (Subtotal) (for reference, not added)')
    expect(rows[1]).toBe('Discount (for reference, not added)')
    rows.slice(2).forEach(label => expect(label).not.toMatch(/not added/))
  })

  it('the business PDF does not get the mark (its rows add up)', () => {
    expect(render(InvoiceBusinessPdf, businessInvoice())).not.toMatch(/not added/)
  })
})

describe('InvoiceBusinessPdf status (unchanged, same helper)', () => {
  it('translates the status with the prefix of the project', () => {
    const html = render(InvoiceBusinessPdf, businessInvoice())
    expect(html).toContain('Entregado por el repartidor')
  })
})

describe('InvoiceBusinessPdf conditions (unchanged)', () => {
  it('hides the optional rows of a charge invoice with no misc amount and no discounts', () => {
    const html = render(InvoiceBusinessPdf, businessInvoice({
      type: 'charge', inlcude_discounts: false, misc_amount: 0, notes: ''
    }))
    expect(html).not.toContain('Discounts by platform')
    expect(html).not.toContain('Misc')
    expect(html).not.toContain('Products Tax')
    expect(html).not.toContain('Orders (Subtotal)')
  })

  it('keeps the tax of the products row only for a payout with tax_products', () => {
    expect(render(InvoiceBusinessPdf, businessInvoice())).toContain('Products Tax')
    expect(render(InvoiceBusinessPdf, businessInvoice({ tax_products: 0 }))).not.toContain('Products Tax')
  })
})

describe('the full HTML of each PDF (everything but the period, the driver status and the driver informative rows is as in main)', () => {
  it('InvoiceBusinessPdf', () => {
    expect(pretty(render(InvoiceBusinessPdf, businessInvoice()))).toMatchInlineSnapshot(`
      "<div style="font-family:Noto Sans Georgian, sans-serif;color:#333">
      <img src="data:image/png;base64,AAA" alt="" style="width:150px;margin-bottom:15px"/>
      <br/>
      <span>Invoice for <b>Fast Bite</b>
      </span>
      <br/>
      <span>From <b>01/09/2026</b> To <b>30/09/2026</b>
      </span>
      <br/>
      <span>Amount to orders: 2</span>
      <table style="width:100%;margin-top:15px;margin-bottom:15px;border-collapse:collapse;thead:[object Object];tbody:[object Object];tfoot:[object Object];number:[object Object]">
      <thead>
      <tr style="color:#fff;font-weight:bold;border:1px solid #222434;background-color:#222434">
      <th style="text-align:center;font-size:16px" colSpan="5">Orders</th>
      </tr>
      <tr style="color:#fff;font-weight:bold;border:1px solid #393d57;background-color:#393d57">
      <th style="text-align:center;font-size:16px">Order number</th>
      <th style="text-align:center;font-size:16px">Date</th>
      <th style="text-align:center;font-size:16px">Status</th>
      <th style="text-align:center;font-size:16px">Subtotal</th>
      <th style="text-align:center;font-size:16px">Total</th>
      </tr>
      </thead>
      <tbody>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">101</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">05/09/2026 10:30</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Entregado por el repartidor</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 20,00</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 25,00</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">102</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">29/09/2026 18:00</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Completado por el administrador</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 10,50</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 12,00</td>
      </tr>
      </tbody>
      <tfoot style="tr:[object Object]">
      <tr style="border:1px solid #ccc;background-color:#ddd;td:[object Object]">
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px" colSpan="4">Subtotal</td>
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">$ 30,50</td>
      </tr>
      <tr style="border:1px solid #ccc;background-color:#ddd;td:[object Object]">
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px" colSpan="4">Total</td>
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">$ 37,00</td>
      </tr>
      </tfoot>
      </table>
      <table style="width:100%;margin-top:15px;margin-bottom:15px;border-collapse:collapse;thead:[object Object];tbody:[object Object];tfoot:[object Object];number:[object Object]">
      <thead>
      <tr style="color:#fff;font-weight:bold;border:1px solid #393d57;background-color:#393d57">
      <th style="text-align:center;font-size:16px" colSpan="2">Totals</th>
      </tr>
      </thead>
      <tbody>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Orders (Subtotal)</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 30,50</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Discounts by platform</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 2,00</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Products Tax</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 5,00</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Percentage Fee (10%)</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 3,05</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Fixed Fee</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 1,00</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Misc <small>(Adjustment)</small>
      </td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 3,00</td>
      </tr>
      </tbody>
      <tfoot style="tr:[object Object]">
      <tr style="border:1px solid #ccc;background-color:#ddd;td:[object Object]">
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">Subtotal</td>
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">$ 34,55</td>
      </tr>
      <tr style="border:1px solid #ccc;background-color:#ddd;td:[object Object]">
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">Tax (7%)</td>
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">$ 2,42</td>
      </tr>
      <tr style="border:1px solid #ccc;background-color:#ddd;td:[object Object]">
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">Total</td>
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">$ 36,97</td>
      </tr>
      </tfoot>
      </table>
      <p style="padding:10px;white-space:normal;font-size:14px;background-color:#eee">Pay within 30 days &lt;b&gt;now&lt;/b&gt;</p>
      </div>"
    `)
  })

  it('InvoiceDriverPdf', () => {
    expect(pretty(render(InvoiceDriverPdf, driverInvoice()))).toMatchInlineSnapshot(`
      "<div style="font-family:Noto Sans Georgian, sans-serif;color:#333">
      <img src="data:image/png;base64,AAA" alt="" style="width:150px;margin-bottom:15px"/>
      <br/>
      <span>Invoice for <b>Grace Okafor</b>
      </span>
      <br/>
      <span>From <b>01/09/2026</b> To <b>30/09/2026</b>
      </span>
      <br/>
      <span>Amount to orders: 2</span>
      <table style="width:100%;margin-top:15px;margin-bottom:15px;border-collapse:collapse;thead:[object Object];tbody:[object Object];tfoot:[object Object];number:[object Object]">
      <thead>
      <tr style="color:#fff;font-weight:bold;border:1px solid #222434;background-color:#222434">
      <th style="text-align:center;font-size:16px" colSpan="5">Orders</th>
      </tr>
      <tr style="color:#fff;font-weight:bold;border:1px solid #393d57;background-color:#393d57">
      <th style="text-align:center;font-size:16px">Order number</th>
      <th style="text-align:center;font-size:16px">Date</th>
      <th style="text-align:center;font-size:16px">Status</th>
      <th style="text-align:center;font-size:16px">Subtotal</th>
      <th style="text-align:center;font-size:16px">Total</th>
      </tr>
      </thead>
      <tbody>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">101</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">05/09/2026 10:30</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Entregado por el repartidor</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 20,00</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 25,00</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">102</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">29/09/2026 18:00</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Completado por el administrador</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 10,50</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 12,00</td>
      </tr>
      </tbody>
      <tfoot style="tr:[object Object]">
      <tr style="border:1px solid #ccc;background-color:#ddd;td:[object Object]">
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px" colSpan="4">Subtotal</td>
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">$ 30,50</td>
      </tr>
      <tr style="border:1px solid #ccc;background-color:#ddd;td:[object Object]">
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px" colSpan="4">Total</td>
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">$ 37,00</td>
      </tr>
      </tfoot>
      </table>
      <table style="width:100%;margin-top:15px;margin-bottom:15px;border-collapse:collapse;thead:[object Object];tbody:[object Object];tfoot:[object Object];number:[object Object]">
      <thead>
      <tr style="color:#fff;font-weight:bold;border:1px solid #393d57;background-color:#393d57">
      <th style="text-align:center;font-size:16px" colSpan="2">Totals</th>
      </tr>
      </thead>
      <tbody>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Orders (Subtotal) <small>(for reference, not added)</small>
      </td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 30,50</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Discount <small>(for reference, not added)</small>
      </td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 2,00</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Percentage Fee (10%)</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 3,05</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Fixed Fee</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 1,00</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Delivery price Percentage</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 4,00</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Driver tip Percentage</td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 1,50</td>
      </tr>
      <tr>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px">Misc <small>(Adjustment)</small>
      </td>
      <td style="border:1px solid #ccc;color:#333;font-size:15px;padding:3px 10px;text-align:right">$ 3,00</td>
      </tr>
      </tbody>
      <tfoot style="tr:[object Object]">
      <tr style="border:1px solid #ccc;background-color:#ddd;td:[object Object]">
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">Subtotal</td>
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">$ 34,55</td>
      </tr>
      <tr style="border:1px solid #ccc;background-color:#ddd;td:[object Object]">
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">Tax (7%)</td>
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">$ 2,42</td>
      </tr>
      <tr style="border:1px solid #ccc;background-color:#ddd;td:[object Object]">
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">Total</td>
      <td style="font-size:15px;border:1px solid #ccc;text-align:right;padding:3px 10px">$ 36,97</td>
      </tr>
      </tfoot>
      </table>
      <p style="padding:10px;white-space:normal;font-size:14px;background-color:#eee">Pay within 30 days &lt;b&gt;now&lt;/b&gt;</p>
      </div>"
    `)
  })
})
