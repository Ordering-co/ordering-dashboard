import { expect, fixtureUrl, test } from './fixtures'

for (const document of ['normal', 'ticket']) {
  test(`${document} order document preserves physical typography and printable bounds`, async ({ page }, testInfo) => {
    await page.emulateMedia({ media: 'print' })
    await page.goto(fixtureUrl(`surface=print-order-documents&document=${document}&mode=light`))
    const printable = page.getByTestId('print-order-document').locator('[role="document"]')
    await expect(printable).toBeVisible()
    await expect(printable.getByRole('heading').first()).toHaveCSS('font-size', '20px')
    const before = await printable.getByRole('heading').first().evaluate(element => getComputedStyle(element).fontSize)

    await page.evaluate(() => {
      document.documentElement.style.setProperty('--od-type-content-size', '19px')
      document.documentElement.style.setProperty('--od-type-section-title-size', '24px')
      document.documentElement.style.setProperty('--od-type-identifier-size', '18px')
    })
    await expect(printable.getByRole('heading').first()).toHaveCSS('font-size', before)
    if (document === 'ticket') {
      await expect(printable).toHaveCSS('font-family', /Arial/i)
      await expect(printable.getByText(/Pending/).first()).toHaveCSS('font-size', '16px')
      await expect(printable).toHaveCSS('max-width', '420px')
    } else {
      await expect(printable.getByText('Summary', { exact: true })).toHaveCSS('font-size', '24px')
    }

    const bounds = await printable.evaluate(element => {
      const root = element.getBoundingClientRect()
      const offenders = [...element.querySelectorAll('*')].filter(node => {
        const box = node.getBoundingClientRect()
        return box.width > 0 && (box.left < root.left - 1 || box.right > root.right + 1)
      }).map(node => ({ tag: node.tagName, text: node.textContent?.slice(0, 80) }))
      return { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, offenders }
    })
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1)
    expect(bounds.offenders).toEqual([])
    await printable.screenshot({ path: testInfo.outputPath(`print-${document}.png`) })
  })
}
