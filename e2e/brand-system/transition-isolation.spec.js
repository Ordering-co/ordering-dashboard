import { test, expect, fixtureUrl } from './fixtures'
import { readFileSync, writeFileSync } from 'node:fs'

const url = mode => fixtureUrl(`surface=transition&mode=${mode}&fixtureUserLevel=0`)
const siblingAppearance = page => page.getByTestId('legacy-sibling').locator('button,input').evaluateAll(elements => elements.map(element => {
  const computed = getComputedStyle(element)
  const box = element.getBoundingClientRect()
  return { text: element.textContent, tag: element.tagName, width: box.width, height: box.height, styles: Object.fromEntries(['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'background-color', 'border-color', 'border-radius', 'padding', 'display', 'outline', 'margin'].map(key => [key, computed.getPropertyValue(key)])) }
}))

for (const mode of ['light', 'dark']) {
  test(`shared action adoption preserves measured real extensions and the approved L3 comment in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(url(mode))
    await expect(page.getByTestId('legacy-button')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const imported = await siblingAppearance(page)
    writeFileSync(testInfo.outputPath(`legacy-appearance-${mode}.json`), JSON.stringify(imported, null, 2))
    const baseline = JSON.parse(readFileSync(`e2e/brand-system/baselines/l2-actions/legacy-appearance-${mode}.json`, 'utf8'))
    const withoutComment = rows => rows.filter(row => row.text !== 'Existing comment')
    expect(withoutComment(imported)).toEqual(withoutComment(baseline))
    const comment = imported.find(row => row.text === 'Existing comment')
    expect(comment.styles).toMatchObject({
      'font-size': '13px',
      'border-radius': '999px',
      color: mode === 'light' ? 'rgb(11, 12, 13)' : 'rgb(255, 255, 255)',
      'background-color': mode === 'light' ? 'rgb(246, 247, 247)' : 'rgb(33, 34, 36)'
    })

    // Negative control proves this comparison catches an actual leaked reset.
    const violation = await page.addStyleTag({ content: 'button { border-radius: 99px !important; }' })
    await expect.poll(() => siblingAppearance(page)).not.toEqual(imported)
    await violation.evaluate(element => element.remove())
    await expect.poll(() => siblingAppearance(page)).toEqual(imported)
  })

  test(`recipient portal works inside the real legacy Modal in ${mode}`, async ({ page }) => {
    await page.goto(url(mode))
    await page.getByRole('button', { name: 'Open legacy modal fixture', exact: true }).click()
    const recipient = page.getByTestId('modal-recipient')
    await expect(recipient).toBeVisible()
    const trigger = recipient.getByRole('combobox')
    await trigger.click()
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.getByRole('option', { name: 'Platform', exact: true }).click()
    await expect(page.getByTestId('recipient-value')).toHaveText('platform')
    await expect(recipient).toBeVisible()
    await trigger.focus()
    await page.keyboard.press('Space')
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(recipient).toBeVisible()
    await expect(trigger).toBeFocused()
    await page.getByRole('button', { name: 'Close legacy modal fixture', exact: true }).click()
    await expect(recipient).toHaveCount(0)
  })
}

test('the application viewport permits browser zoom', async () => {
  const html = readFileSync('index.html', 'utf8')
  const viewport = html.match(/name="viewport"\s+content="([^"]+)"/)[1]
  expect(viewport).toContain('width=device-width')
  expect(viewport).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/)
})

test('new controls and confirm remain reachable at 200 percent zoom', async ({ page }) => {
  // redesign (Z-1): the browser's 200% zoom lays a 1440x900 window out as 720x450 CSS pixels, and
  // that is what is checked here. CSS `zoom: 2` on <html> is not the same thing: Base UI writes popover coordinates in visual
  // pixels and the zoomed <html> scales them again, so every Product popover of the overlay host lands off its trigger. No
  // product surface sets CSS zoom; supporting it (a Base UI patch) is a later phase.
  await page.setViewportSize({ width: 720, height: 450 })
  await page.goto(url('dark'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const recipient = page.getByTestId('recipient-consumer').getByRole('combobox')
  await recipient.click()
  const platform = page.getByRole('option', { name: 'Platform', exact: true })
  await expect(platform).toBeInViewport()
  await platform.click()
  await expect(page.getByTestId('recipient-value')).toHaveText('platform')
  await page.getByTestId('school-consumer').getByRole('button', { name: 'Disable school module', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
  await cancel.scrollIntoViewIfNeeded()
  await expect(cancel).toBeInViewport()
  await cancel.click()
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
