import { test, expect, fixtureUrl } from './fixtures'
import { writeFile } from 'node:fs/promises'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`

const openCreateForm = async page => {
  await page.goto(fixtureUrl('surface=standard-field-consumers&mode=light'))
  await page.getByRole('button', { name: 'Add student', exact: true }).click()
  const dialog = page.locator('.popup-dialog').filter({ hasText: 'Add student' })
  await expect(dialog).toBeVisible()
  return dialog
}

const openSelect = async (scope, name) => {
  const trigger = scope.getByRole('button', { name, exact: true })
  await trigger.click()
  return trigger
}

test('SchoolUserStudents preserves five StandardField controls and the existing save payload', async ({ page }) => {
  const dialog = await openCreateForm(page)

  await expect(dialog.locator('.select')).toHaveCount(3)
  await expect(dialog.locator('.multi-select')).toHaveCount(2)

  await openSelect(dialog, 'Select a school')
  await dialog.getByRole('option', { name: 'North Academy', exact: true }).click()

  const textboxes = dialog.getByRole('textbox')
  await textboxes.nth(0).fill('Alex')
  await textboxes.nth(1).fill('Rivera')

  await openSelect(dialog, 'Select a classroom')
  await dialog.getByRole('option', { name: 'Room A', exact: true }).click()
  await openSelect(dialog, 'Select a grade')
  await dialog.getByRole('option', { name: 'Grade 3', exact: true }).click()

  await openSelect(dialog, 'Select allergens')
  await dialog.getByRole('option', { name: 'Nuts', exact: true }).click()
  await page.keyboard.press('Escape')
  await openSelect(dialog, 'Select dietary tags')
  await dialog.getByRole('option', { name: 'Vegan', exact: true }).click()
  await page.keyboard.press('Escape')

  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()

  const writes = JSON.parse(await page.getByTestId('school-writes').textContent())
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({
    method: 'POST',
    pathname: '/backoffice/schools/parents/7001/students',
    payload: {
      school_id: 101,
      classroom_id: 201,
      grade_id: 301,
      name: 'Alex',
      lastname: 'Rivera',
      allergies: ['nuts'],
      dietary_tags: ['vegan']
    }
  })
  expect(writes[0].payload.code).toMatch(/^STU-[A-Z0-9]{6}$/)
})

for (const mode of ['light', 'dark']) {
  test(`SchoolUserStudents StandardFields remain governed in ${mode}`, async ({ page }) => {
    await page.goto(fixtureUrl(`surface=standard-field-consumers&mode=${mode}`))
    await page.getByRole('button', { name: 'Add student', exact: true }).click()
    const dialog = page.locator('.popup-dialog').filter({ hasText: 'Add student' })
    const fields = dialog.locator('.select, .multi-select')
    await expect(fields).toHaveCount(5)
    await expect(fields.first()).toHaveCSS('background-color', rgb(tokens.theme[mode].semantic.surface.default))
    for (const field of await fields.all()) {
      const fieldBox = await field.boundingBox()
      const controlBox = await field.locator(':scope > div:first-child').boundingBox()
      const borders = await field.evaluate(element => parseFloat(getComputedStyle(element).borderLeftWidth) + parseFloat(getComputedStyle(element).borderRightWidth))
      expect(Math.abs(fieldBox.width - borders - controlBox.width)).toBeLessThanOrEqual(1)
      expect(controlBox.height).toBeGreaterThanOrEqual(32)
    }
  })
}

test.describe('SchoolUserStudents StandardFields at 320px RTL', () => {
  test.use({ viewport: { width: 320, height: 900 }, hasTouch: true, isMobile: true })

  test('preserves caller control geometry and document width; Modal visual acceptance remains L2d', async ({ page }, testInfo) => {
    await page.goto(fixtureUrl('surface=standard-field-consumers&mode=dark&rtl=true'))
    await page.getByRole('button', { name: 'Add student', exact: true }).click()
    const dialog = page.locator('.popup-dialog').filter({ hasText: 'Add student' })
    const fields = dialog.locator('.select, .multi-select')
    await expect(fields).toHaveCount(5)
    const metrics = await fields.evaluateAll(elements => elements.map(element => {
      const child = element.firstElementChild
      const style = getComputedStyle(child)
      return { text: child.textContent, height: child.getBoundingClientRect().height, minHeight: style.minHeight, boxSizing: style.boxSizing, transform: style.transform, coarse: matchMedia('(pointer: coarse)').matches }
    }))
    await writeFile(testInfo.outputPath('control-geometry.json'), JSON.stringify(metrics, null, 2))
    await testInfo.attach('control-geometry', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' })
    for (const field of await fields.all()) {
      const fieldBox = await field.boundingBox()
      const box = await field.locator(':scope > div:first-child').boundingBox()
      const borders = await field.evaluate(element => parseFloat(getComputedStyle(element).borderLeftWidth) + parseFloat(getComputedStyle(element).borderRightWidth))
      expect(Math.abs(fieldBox.width - borders - box.width)).toBeLessThanOrEqual(1)
      expect(box.width).toBeGreaterThanOrEqual(44)
      // Existing L5 FormGrid overrides FirstSelect height to 43px; MultiSelect stays 44px.
      const single = await field.evaluate(element => element.classList.contains('select'))
      expect(box.height).toBeGreaterThanOrEqual(single ? 43 : 44)
    }
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, dir: document.documentElement.dir }))
    expect(geometry.dir).toBe('rtl')
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport)
  })
})
