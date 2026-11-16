import { writeFileSync } from 'node:fs'
import { test, expect, fixtureUrl } from './fixtures'

const detail = {
  invoice: {
    id: 41,
    business: { name: 'Fixture Payment Business' },
    paymethod: 'stripe',
    period_start: '2026-09-01T00:00:00Z',
    period_end: '2026-09-15T00:00:00Z',
    timezone: 'UTC'
  },
  totals: { prepaid_total: 30, total_charges: 5, deposit_amount: 25 },
  order_summary: {
    card_orders: { count: 1, subtotal: 20, tax: 2, delivery_price: 3, tip: 1, total: 26 },
    cash_orders: { count: 0, subtotal: 0, tax: 0, delivery_price: 0, tip: 0, total: 0 },
    total: { count: 1, subtotal: 20, tax: 2, delivery_price: 3, tip: 1, total: 26 }
  },
  fee_details: {
    order_fees: [{ name: 'Service fee', count: 1, total_amount: 2 }],
    recurring: [{ name: 'Subscription', total_amount: 2 }],
    manual_charges: [{ name: 'Adjustment', total_amount: 1 }],
    manual_credits: [{ name: 'Credit', total_amount: -1 }]
  },
  order_details: [{
    order_id: 7001,
    created_at: '2026-09-14T12:30:00Z',
    delivery_type: 1,
    paymethod_gateway: 'stripe',
    tip: 1,
    order_total: 26,
    fees: [{ name: 'Service fee', fee_total: 2 }]
  }]
}

const installPrintCapture = async page => page.addInitScript(() => {
  const appendChild = Node.prototype.appendChild
  Node.prototype.appendChild = function (node) {
    const result = appendChild.call(this, node)
    if (node instanceof HTMLIFrameElement && node.id === 'printWindow') {
      node.addEventListener('load', () => {
        node.contentWindow.print = () => {
          window.__identityPaymentPrint = node.contentDocument.documentElement.outerHTML
        }
      })
    }
    return result
  }
})

test.beforeEach(async ({ page }) => {
  await installPrintCapture(page)
  await page.route('**/fixture-api/business_payment_invoices/payment-fixture-41/detail', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ error: false, result: detail })
  }))
})

test('payment report uses tenant-configured canonical logo and populated identity content', async ({ page }) => {
  await page.goto(fixtureUrl('surface=identity-payment&mode=light'))
  const fixture = page.getByTestId('identity-payment-fixture')
  await expect(fixture).toContainText('Fixture Payment Business')
  await expect(fixture).toContainText('Payment Report')
  await expect(fixture).toContainText('Service fee')
  await expect(fixture).toContainText('#7001')
  const logo = fixture.getByRole('img', { name: 'Fixture Payment Business' })
  await expect(logo).toHaveAttribute('src', /^data:image\/png;base64,/)
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
})

test('ReactToPrint creates a real iframe containing the converted logo and report HTML', async ({ page }, testInfo) => {
  await page.goto(fixtureUrl('surface=identity-payment&mode=light'))
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
  await page.getByRole('button', { name: 'Download PDF' }).click()
  const printFrame = page.locator('iframe#printWindow')
  await expect(printFrame).toBeAttached()
  const frame = page.frameLocator('iframe#printWindow')
  await expect(frame.locator('body')).toContainText('Fixture Payment Business')
  await expect(frame.locator('body')).toContainText('Transfer Amount')
  await expect(frame.locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/)
  await expect.poll(() => page.evaluate(() => window.__identityPaymentPrint || '')).toContain('Fixture Payment Business')
  const captured = await page.evaluate(() => window.__identityPaymentPrint)
  expect(captured).toContain('data:image/png;base64,')
  expect(captured).toContain('@page { size: A4; margin: 15mm; }')
  writeFileSync(testInfo.outputPath('payment-report.html'), captured)
  if (process.env.ORDERING_BRAND_RENDER_PDF === '1') {
    await page.setContent(captured)
    await page.pdf({ path: testInfo.outputPath('payment-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true })
  }
})
