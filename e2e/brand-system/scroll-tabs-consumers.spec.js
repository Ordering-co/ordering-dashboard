import { test, expect, fixtureUrl } from './fixtures'
import { writeFile } from 'node:fs/promises'

const readPaymentState = async page => JSON.parse(await page.getByTestId('payment-tabs-events').textContent())
const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(value => Number(value) / 255)
  .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)

for (const mode of ['light', 'dark']) {
  test.describe(`real scroll tab consumers ${mode}`, () => {
    test.use({ viewport: { width: 1024, height: 900 } })

    test('preserves ProductForm section IDs, mounted content and offset scroll navigation', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl(`surface=scroll-tabs-consumers&mode=${mode}`))
      const product = page.getByTestId('product-form-tabs-consumer')
      const dialog = page.getByTestId('product-dialog-inner')

      await expect(product.getByText('ingredients', { exact: true })).toBeVisible()
      await expect(product.locator('#menu_id_9135').filter({ hasText: 'Fixture option 6' })).toBeVisible()
      await expect(product.locator('#ingredients')).toBeAttached()
      for (let id = 9130; id <= 9135; id++) await expect(product.locator(`#id_${id}`)).toBeAttached()
      const colors = await product.locator('#menu_id_9131').evaluate(element => {
        const foreground = getComputedStyle(element).color
        let current = element
        let background = getComputedStyle(current).backgroundColor
        while (current.parentElement && ['transparent', 'rgba(0, 0, 0, 0)'].includes(background)) {
          current = current.parentElement
          background = getComputedStyle(current).backgroundColor
        }
        return { foreground, background }
      })
      await writeFile(testInfo.outputPath(`product-tab-colors-${mode}.json`), JSON.stringify(colors, null, 2))
      const levels = [luminance(colors.foreground), luminance(colors.background)]
      expect((Math.max(...levels) + 0.05) / (Math.min(...levels) + 0.05)).toBeGreaterThanOrEqual(4.5)

      await dialog.evaluate(element => {
        const original = element.scrollTo.bind(element)
        element.__tabScrollRequests = []
        element.scrollTo = options => {
          element.__tabScrollRequests.push({ ...options })
          original(options)
        }
      })
      await product.locator('#menu_id_9135').filter({ hasText: 'Fixture option 6' }).click()
      expect(await dialog.evaluate(element => element.__tabScrollRequests)).toEqual([{
        top: await product.locator('#id_9135').evaluate(element => element.offsetTop - 55),
        behavior: 'smooth'
      }])
      // Native scrolling clamps a final section when less than a viewport of
      // content remains below it; the requested offset still stays exactly55.
      await expect.poll(async () => dialog.evaluate(element => {
        const requested = document.getElementById('id_9135').offsetTop - 55
        const clamped = Math.max(0, Math.min(requested, element.scrollHeight - element.clientHeight))
        return Math.abs(element.scrollTop - clamped)
      })).toBeLessThanOrEqual(2)
      await page.screenshot({ path: testInfo.outputPath(`scroll-tabs-${mode}.png`), fullPage: false })
    })

    test('adds keyboard activation and keeps ProductForm scroll state synchronized', async ({ page }) => {
      await page.goto(fixtureUrl(`surface=scroll-tabs-consumers&mode=${mode}`))
      const product = page.getByTestId('product-form-tabs-consumer')
      const dialog = page.getByTestId('product-dialog-inner')
      const first = product.getByRole('button', { name: 'ingredients', exact: true })
      const option = product.getByRole('button', { name: 'Fixture option 4', exact: true })

      await expect(first).toHaveAttribute('id', 'menu_ingredients')
      await expect(option).toHaveAttribute('id', 'menu_id_9133')
      await option.focus()
      await option.press('Enter')
      await expect.poll(async () => dialog.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
      await dialog.evaluate(element => {
        const target = document.getElementById('ingredients')
        element.scrollTop = target.offsetTop
        element.dispatchEvent(new Event('scroll'))
      })
      await expect(first).toHaveAttribute('aria-pressed', 'true')
      await first.focus()
      await first.press('Space')
      await expect(first).toBeFocused()
    })

    test('preserves PaymentOptionSquare scalar callbacks, active clicks and loading visibility', async ({ page }) => {
      await page.goto(fixtureUrl(`surface=scroll-tabs-consumers&mode=${mode}`))
      const payment = page.getByTestId('payment-square-tabs-consumer')
      const card = payment.getByText('Card payments', { exact: true })
      const ach = payment.getByText('ACH Bank transfer', { exact: true })

      await card.click()
      await ach.click()
      expect(await readPaymentState(page)).toEqual({ events: ['card_payments', 'ach_bank_transfer'], isLoading: false, methodSelected: 'ach_bank_transfer' })
      await expect(payment.getByText('Pay with Bank Account', { exact: true })).toBeVisible()
      await payment.getByRole('button', { name: 'Toggle payment loading', exact: true }).click()
      await expect(card).toHaveCount(0)
      await expect(ach).toHaveCount(0)
      expect(await readPaymentState(page)).toEqual({ events: ['card_payments', 'ach_bank_transfer'], isLoading: true, methodSelected: 'ach_bank_transfer' })
    })

    test('adds one-shot PaymentOptionSquare keyboard activation without changing its scalar contract', async ({ page }) => {
      await page.goto(fixtureUrl(`surface=scroll-tabs-consumers&mode=${mode}`))
      const payment = page.getByTestId('payment-square-tabs-consumer')
      const card = payment.getByRole('button', { name: 'Card payments', exact: true })
      const gift = payment.getByRole('button', { name: 'Gift Cards', exact: true })

      await expect(card).toHaveAttribute('aria-pressed', 'true')
      await card.focus()
      await card.press('Enter')
      await gift.focus()
      await gift.press('Space')
      expect(await readPaymentState(page)).toEqual({ events: ['card_payments', 'gift_cards'], isLoading: false, methodSelected: 'gift_cards' })
      await expect(gift).toHaveAttribute('aria-pressed', 'true')
      await expect(gift).toBeFocused()
    })
  })
}

test.describe('real scroll tab consumers touch targets', () => {
  test.use({ viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true })

  test('keeps both real navigation actions keyboard reachable and at least 44px tall', async ({ page }) => {
    await page.goto(fixtureUrl('surface=scroll-tabs-consumers&mode=light'))
    const productTab = page.getByTestId('product-form-tabs-consumer').getByRole('button', { name: 'Fixture option 2', exact: true })
    const paymentTab = page.getByTestId('payment-square-tabs-consumer').getByRole('button', { name: 'Card payments', exact: true })

    for (const tab of [productTab, paymentTab]) {
      await tab.scrollIntoViewIfNeeded()
      const box = await tab.boundingBox()
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
      await tab.focus()
      await expect(tab).toBeFocused()
    }
  })
})
