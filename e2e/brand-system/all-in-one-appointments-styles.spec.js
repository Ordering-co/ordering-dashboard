// redesign C1a (W1-PC1-07): Adapted 2026-10-08 (W1 tramo C r1). The appointments surface of the fixture draws what the page draws
// (P/PageHeader with the business Button as its action, the toolbar on P/IconButton, a month event beside rbc's measuring one). The
// assertions on pieces the page no longer paints (Header, BusinessName, the breadcrumb, the legacy IconButton) are replaced by the same
// kind of assertion on the piece that took their place; the assertions on what still exists (calendar heading and label, events, the
// all-in-one surface, live regions, the 320 RTL reflow) are unchanged. Nothing was loosened: the target check of Product buttons is the
// real reach (a hit test over the 44px area), stricter than the visible box the legacy button had.
import { expect, test } from './fixtures'

// The batch keeps its own harness entry so the shared compact registry in
// scripts/brand-system/harness/main.jsx is never edited by a parallel session.
const batchUrl = (query = '') => `/scripts/brand-system/harness/all-in-one-appointments.html?${query}`

const ROLES = ['title', 'section-title', 'content', 'secondary', 'control', 'control-value', 'identifier']

const setRoleSizes = (page, sizes) => page.evaluate(values => {
  for (const [role, value] of Object.entries(values)) document.documentElement.style.setProperty(`--od-type-${role}-size`, value)
}, sizes)
const restoreRoleSizes = (page, roles) => page.evaluate(values => {
  for (const role of values) document.documentElement.style.removeProperty(`--od-type-${role}-size`)
}, roles)

for (const mode of ['light', 'dark']) {
  test(`all-in-one and appointments keep governed typography and separated actions in ${mode}`, async ({ page }, testInfo) => {
    await page.goto(batchUrl(`mode=${mode}`))
    const surface = page.getByTestId('all-in-one-appointments-styles')

    await expect(surface.getByTestId('selection-indicator')).toHaveCSS('font-size', '13px')
    // The page title, the business selector (a control) and the «Calendar» crumb are P/PageHeader and P/Button: Product type tokens.
    await expect(surface.getByRole('heading', { name: 'Appointment', exact: true })).toHaveCSS('font-size', '22px')
    await expect(surface.getByRole('button', { name: 'Ordering.co demonstration store' })).toHaveCSS('font-size', '13px')
    await expect(surface.locator('.odc-pagehead-description')).toHaveText('Calendar')
    await expect(surface.getByTestId('calendar-day-heading')).toHaveCSS('font-size', '18px')
    await expect(surface.getByTestId('calendar-label')).toHaveCSS('font-size', '18px')
    await expect(surface.getByTestId('event-name')).toHaveCSS('font-size', '12px')
    await expect(surface.getByTestId('event-time')).toHaveCSS('font-size', '12px')

    // The count overlay reads as an identifier, so it also takes the mono family.
    const indicatorFamily = await surface.getByTestId('selection-indicator').evaluate(element => getComputedStyle(element).fontFamily)
    expect(indicatorFamily).toContain('JetBrains Mono')

    // Native, separated actions: every control is a real button with a name.
    const businessName = surface.getByRole('button', { name: 'Ordering.co demonstration store' })
    await expect(businessName).toHaveAttribute('type', 'button')
    await expect(businessName).toHaveAttribute('aria-haspopup', 'true')
    await expect(businessName).toHaveAttribute('aria-expanded', 'false')
    await businessName.click()
    await expect(businessName).toHaveAttribute('aria-expanded', 'true')

    const month = surface.getByRole('button', { name: 'Month', exact: true })
    const week = surface.getByRole('button', { name: 'Week', exact: true })
    await expect(month).toHaveAttribute('aria-pressed', 'true')
    await week.click()
    await expect(week).toHaveAttribute('aria-pressed', 'true')
    await expect(month).toHaveAttribute('aria-pressed', 'false')
    await expect(surface.getByRole('button', { name: 'Previous', exact: true })).toBeVisible()
    await expect(surface.getByRole('button', { name: 'Next', exact: true })).toBeVisible()

    // The live regions announce loading and selection (main dropped the disabled-feature warning).
    await expect(surface.getByTestId('appointments-loader')).toHaveAttribute('aria-live', 'polite')
    await expect(surface.getByTestId('selection-indicator')).toHaveAttribute('aria-live', 'polite')

    // Keyboard focus, not a pointer, must paint the governed focus ring.
    await surface.getByRole('button', { name: 'Open menu' }).last().focus()
    await page.keyboard.press('Tab')
    await expect(businessName).toBeFocused()
    await expect(businessName).toHaveCSS('outline-width', '2px')
    await expect(businessName).toHaveCSS('outline-style', 'solid')

    await page.screenshot({ path: testInfo.outputPath(`all-in-one-appointments-${mode}.png`), fullPage: true })
  })
}

// redesign W1-5 (T1-5-4): the All-in-One title (HeaderTitleContainer, dead code) is no longer part of this check; the title role is still
// checked through the Appointments title.
test('central roles drive the real all-in-one and appointments styles and restore', async ({ page }, testInfo) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('all-in-one-appointments-styles')
  const checks = [
    // Adapted 2026-10-08 (W1-5 over W1 tramo C r1): neither title is this family's any more — the all-in-one title wrapper was dead code
    // (removed) and the appointments title is P/PageHeader's (its own role, checked at 22px above).
    [surface.getByTestId('selection-indicator'), '18px'],
    [surface.getByTestId('calendar-day-heading'), '25px'],
    [surface.getByTestId('calendar-label'), '25px'],
    [surface.getByTestId('event-name'), '16px'],
    [surface.getByTestId('event-time'), '16px']
  ]

  await setRoleSizes(page, { title: '28px', 'section-title': '25px', content: '19px', secondary: '16px', control: '17px', 'control-value': '18px', identifier: '18px' })
  for (const [locator, size] of checks) await expect(locator).toHaveCSS('font-size', size)
  await page.screenshot({ path: testInfo.outputPath('all-in-one-appointments-propagated.png'), fullPage: true })

  await restoreRoleSizes(page, ROLES)
  await expect(surface.getByTestId('calendar-label')).toHaveCSS('font-size', '18px')
  await expect(surface.getByTestId('event-time')).toHaveCSS('font-size', '12px')
})

// redesign C1a (W1-PC1-07): the page title and the business selector are P/ pieces, which read the Product type tokens (not the
// role tokens above): the same propagation check, on the token they do read.
test('the Product type tokens drive the appointments title and the business selector and restore', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('all-in-one-appointments-styles')
  const title = surface.getByRole('heading', { name: 'Appointment', exact: true })
  const business = surface.getByRole('button', { name: 'Ordering.co demonstration store' })

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--od-x-type-title-size', '30px')
    document.documentElement.style.setProperty('--od-x-type-ui-size', '17px')
  })
  await expect(title).toHaveCSS('font-size', '30px')
  await expect(business).toHaveCSS('font-size', '17px')

  await page.evaluate(() => {
    document.documentElement.style.removeProperty('--od-x-type-title-size')
    document.documentElement.style.removeProperty('--od-x-type-ui-size')
  })
  await expect(title).toHaveCSS('font-size', '22px')
  await expect(business).toHaveCSS('font-size', '13px')
})

// redesign C1a (W1-QC1-01, W1-QC1-02): rbc decides how many events fit a month row by measuring a dummy event, so the dummy and the
// real month event must have ONE height (the real one used to be 39px against 24px, and «+N more» fell outside its row); the real
// month event is a button with the ring of the calendar's focus.
test('the month event measures the same as rbc\'s measuring event and is a focus-ringed button', async ({ page }) => {
  await page.goto(batchUrl('mode=light'))
  const surface = page.getByTestId('all-in-one-appointments-styles')
  const measure = await surface.getByTestId('month-event-measure').boundingBox()
  const real = await surface.getByTestId('month-event').boundingBox()
  expect(real.height).toBeGreaterThan(0)
  expect(measure.height).toBe(real.height)

  const button = surface.getByRole('button', { name: 'Grace Hopper, 09:00 - 09:30' })
  await expect(button).toHaveAttribute('tabindex', '0')
  await surface.getByRole('button', { name: 'Day', exact: true }).focus()
  await page.keyboard.press('Tab') // the focus ring only paints for keyboard focus
  await button.focus()
  await expect(button).toBeFocused()
  await expect(button).toHaveCSS('outline-width', '2px')
  await expect(button).toHaveCSS('outline-style', 'solid')
})

test.describe('the month event keeps one height with a coarse pointer', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('the measuring event and the real one are both 44px', async ({ page }) => {
    await page.goto(batchUrl('mode=light'))
    const surface = page.getByTestId('all-in-one-appointments-styles')
    const measure = await surface.getByTestId('month-event-measure').boundingBox()
    const real = await surface.getByTestId('month-event').boundingBox()
    expect(measure.height).toBe(44)
    expect(real.height).toBe(44)
  })
})

// redesign C1a (W1-QC1-08): the hours are isolated, so a right-to-left page keeps digits and meridiem together and in order
test('the hours of the event and of the gutter keep their order in a right-to-left page', async ({ page }) => {
  await page.goto(batchUrl('mode=light&rtl=true&locale=ar'))
  const surface = page.getByTestId('all-in-one-appointments-styles')
  await expect(surface.getByTestId('gutter-label')).toHaveCSS('direction', 'ltr')
  await expect(surface.getByTestId('gutter-label')).toHaveCSS('unicode-bidi', 'isolate')
  const hours = surface.getByTestId('event-time').locator('bdi')
  await expect(hours).toHaveCount(2)
  for (const hour of await hours.all()) await expect(hour).toHaveAttribute('dir', 'ltr')
  const [start, end] = await hours.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().left))
  expect(start).toBeGreaterThan(end) // right to left: the start of the appointment is on the right
})

test.describe('all-in-one and appointments at 320px RTL coarse pointer and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 760 }, hasTouch: true, isMobile: true })

  test('keeps the batch surfaces reflowed with 44px actions and no motion', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(batchUrl('mode=dark&rtl=true&locale=ar'))
    const surface = page.getByTestId('all-in-one-appointments-styles')

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    // redesign all-in-one B3: all-in-one-drivers gone with AllInOne/styles.js DriversContainer (layout moved to all-in-one-board.css)
    // redesign all-in-one B3: all-in-one-top, drivers-manager, drivers-header, drivers-search, driver-list, driver-filters, drivers-list,
    // all-in-one-orders and drivers-location gone with TopContent, DriversManager/styles.js, OrdersContainer and WrapperDriversLocation (never asserted here)
    for (const id of ['all-in-one-surface', 'appointments-header', 'business-picker', 'calendar-toolbar']) {
      const box = surface.getByTestId(id)
      const sizes = await box.evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
      expect(sizes.scrollWidth, id).toBeLessThanOrEqual(sizes.clientWidth + 1)
    }

    // The calendar keeps its own minimum width, so it scrolls inside its own
    // wrapper instead of widening the document.
    const calendar = await surface.getByTestId('calendar-wrapper').evaluate(element => ({ clientWidth: element.clientWidth, overflowX: getComputedStyle(element).overflowX }))
    expect(calendar.overflowX).toBe('auto')
    expect(calendar.clientWidth).toBeLessThanOrEqual(320)

    await expect(surface.getByTestId('orders-list-container')).toHaveCSS('transition-duration', '0s')
    await expect(surface.getByTestId('appointments-container')).toHaveCSS('transition-duration', '0s')

    for (const button of await surface.getByRole('button').all()) {
      await button.scrollIntoViewIfNeeded()
      const name = await button.getAttribute('aria-label') || await button.textContent()
      const isProduct = await button.evaluate(element => element.classList.contains('odc-btn'))
      if (!isProduct) {
        // the legacy buttons of the all-in-one surface are 44px boxes
        const box = await button.boundingBox()
        expect(box.width, name).toBeGreaterThanOrEqual(44)
        expect(box.height, name).toBeGreaterThanOrEqual(44)
        continue
      }
      // redesign C1a (W1-PC1-07): a Product button is 32px seen and reaches 44px through a centered pseudo-element: the real check is a
      // hit test over the 44px area (its eight edge and corner points must land on the button), not the visible box
      const reach = await button.evaluate(element => {
        const box = element.getBoundingClientRect()
        const cx = box.left + box.width / 2
        const cy = box.top + box.height / 2
        return [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([dx, dy]) => {
          const hit = document.elementFromPoint(cx + dx * 20.5, cy + dy * 20.5)
          return Boolean(hit) && (hit === element || element.contains(hit))
        })
      })
      expect(reach.every(Boolean), `${name} reaches 44px`).toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath('all-in-one-appointments-dark-rtl-320.png'), fullPage: true })
  })
})
