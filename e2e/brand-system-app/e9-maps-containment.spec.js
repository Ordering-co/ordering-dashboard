import {
  expect,
  expectClosedNetworkBoundary,
  installAppNetworkBoundary,
  installSyntheticSession,
  test
} from './fixtures'
import { installFakeGoogleMaps } from './e9-fake-google-maps'

// redesign fix-qa E9: with Google Maps loaded, the map of «Edit customer» overflowed the order panel to the right and
// covered Cancel / Save and the foot. Our sessions block Google, so nobody saw it; here a fake `window.google.maps`
// (e9-fake-google-maps.js) draws a full-size element in the real map box, so the layout is the real one.
const API_CONFIGS = '**/fixture-api/v1/en/brand-fixture/configs*'
const CONFIGS_WITH_GOOGLE = {
  error: false,
  result: { google_maps_api_key: { key: 'google_maps_api_key', value: 'e2e-fake-key' } },
  pagination: { current_page: 1, total_pages: 1, total: 1 }
}

const inside = (inner, outer, slack = 1) =>
  inner.x >= outer.x - slack &&
  inner.y >= outer.y - slack &&
  inner.x + inner.width <= outer.x + outer.width + slack &&
  inner.y + inner.height <= outer.y + outer.height + slack

// Horizontal containment: the panel scrolls vertically, so only the inline axis says whether something spills out.
const insideX = (inner, outer, slack = 1) =>
  inner.x >= outer.x - slack && inner.x + inner.width <= outer.x + outer.width + slack

const openEditCustomer = async ({ context, page }, viewport) => {
  const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
  await context.route(API_CONFIGS, route => route.fulfill({ json: CONFIGS_WITH_GOOGLE }))
  await installFakeGoogleMaps(context)
  await installSyntheticSession(context, { authenticated: true })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.setViewportSize(viewport)
  await page.goto('/orders', { waitUntil: 'domcontentloaded' })

  const orderRow = page.locator(viewport.width < 768 ? 'li.odc-order-card' : 'tbody tr').filter({ hasText: '910001' }).first()
  await expect(orderRow).toContainText('Pending', { timeout: 90000 })
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.last().click()
  await orderRow.getByText('#910001', { exact: true }).click()

  const detail = page.locator('#orderDetails')
  await expect(detail).toBeVisible()
  await detail.getByRole('button', { name: 'Edit Customer', exact: true }).click()
  return { network, pageErrors, detail }
}

const defineMapCase = (name, viewport, pointer) => {
  test(`${name} the map of Edit customer stays inside the panel, with Cancel and Save below it`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const { network, pageErrors, detail } = await openEditCustomer({ context, page }, viewport)
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(pointer === 'coarse')

    const box = detail.locator('.odt-edit-map')
    await expect(box).toBeVisible()
    const canvas = box.getByTestId('fake-google-map')
    await expect(canvas).toBeVisible()
    await box.scrollIntoViewIfNeeded()

    const form = await detail.locator('.odt-edit').boundingBox()
    const panel = await detail.boundingBox()
    const boxRect = await box.boundingBox()
    const mapElement = await box.locator('#map').boundingBox()
    const canvasRect = await canvas.boundingBox()

    // The map box takes the width of the form (never wider) and the form lives inside the panel.
    expect(insideX(form, panel), 'the form stays inside the panel').toBe(true)
    expect(insideX(boxRect, form), 'the map box stays inside the form').toBe(true)
    expect(Math.abs(boxRect.width - form.width), 'the map box is as wide as the form').toBeLessThanOrEqual(1)
    // Google's own element and its canvas fill the box and not a pixel more.
    expect(inside(mapElement, boxRect), 'the Google element stays inside the box').toBe(true)
    expect(inside(canvasRect, boxRect), 'the Google canvas stays inside the box').toBe(true)
    expect(Math.abs(mapElement.width - (boxRect.width - 2)), 'the Google element fills the box inside its hairline').toBeLessThanOrEqual(1.5)

    // Token height, hairline and brand radius, clipped.
    const style = await box.evaluate(element => {
      const css = getComputedStyle(element)
      const root = getComputedStyle(document.documentElement)
      return {
        height: css.height,
        token: root.getPropertyValue('--od-x-map-edit').trim(),
        overflow: css.overflow,
        borderWidth: css.borderTopWidth,
        borderStyle: css.borderTopStyle,
        radius: css.borderTopLeftRadius,
        radiusToken: root.getPropertyValue('--od-radius-component').trim(),
        hairline: root.getPropertyValue('--od-x-hairline').trim()
      }
    })
    expect(style.token).toBe('200px')
    expect(style.height).toBe(style.token)
    expect(style.overflow).toBe('hidden')
    expect(style.borderStyle).toBe('solid')
    expect(style.borderWidth).toBe(style.hairline)
    expect(style.radius).toBe(style.radiusToken)

    // Cancel and Save come after the map, inside the panel, and nothing is drawn over them.
    const cancel = detail.getByRole('button', { name: 'Cancel', exact: true })
    const save = detail.getByRole('button', { name: 'Save', exact: true })
    await save.scrollIntoViewIfNeeded()
    const cancelRect = await cancel.boundingBox()
    const saveRect = await save.boundingBox()
    const boxAfterScroll = await box.boundingBox()
    for (const [label, rect] of [['Cancel', cancelRect], ['Save', saveRect]]) {
      expect(rect.y, `${label} starts below the map`).toBeGreaterThanOrEqual(boxAfterScroll.y + boxAfterScroll.height - 1)
      expect(insideX(rect, panel), `${label} stays inside the panel`).toBe(true)
    }
    const topmost = await page.evaluate(() => ['Cancel', 'Save'].map(label => {
      const button = [...document.querySelectorAll('#orderDetails .odt-edit-actions button')].find(node => node.textContent.trim() === label)
      const rect = button.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return button.contains(hit)
    }))
    expect(topmost, 'Cancel and Save are the topmost elements at their center').toEqual([true, true])

    // Nothing scrolls sideways: not the page, not the panel.
    const overflow = await page.evaluate(() => {
      const panelElement = document.querySelector('#orderDetails')
      const scrollers = [panelElement, ...panelElement.querySelectorAll('*')].filter(node => !['INPUT', 'TEXTAREA'].includes(node.tagName) && node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== 'visible' && getComputedStyle(node).overflowX !== 'hidden')
      return {
        document: document.documentElement.scrollWidth - innerWidth,
        scrollers: scrollers.map(node => `${node.tagName}.${node.className}`)
      }
    })
    expect(overflow.document).toBeLessThanOrEqual(0)
    expect(overflow.scrollers).toEqual([])

    await page.screenshot({ path: testInfo.outputPath(`${name}-edit-customer-map.png`) })

    // Cancel is clickable and closes the form.
    await cancel.click()
    await expect(detail.locator('.odt-edit-map')).toHaveCount(0)

    expect(pageErrors, 'no runtime error').toEqual([])
    expectClosedNetworkBoundary(network)
  })
}

for (const [name, viewport] of Object.entries({
  'desktop 1440x900': { width: 1440, height: 900 },
  'split 1280x800': { width: 1280, height: 800 },
  'overlay 1024x768': { width: 1024, height: 768 },
  'phone 390x844': { width: 390, height: 844 }
})) {
  defineMapCase(name, viewport, 'fine')
}

test.describe('coarse pointer', () => {
  test.use({ hasTouch: true, isMobile: true })
  defineMapCase('phone 390x844 coarse', { width: 390, height: 844 }, 'coarse')
})

// ── create-order wizard: the map of the Business step and the map of the address form ──
const CUSTOMER_WITH_ADDRESS = {
  id: 930001,
  name: 'Fixture',
  lastname: 'Customer',
  email: 'fixture.customer@example.invalid',
  cellphone: '5550000000',
  phone: '5550000000',
  photo: null,
  enabled: true,
  level: 3,
  addresses: [{
    id: 931001,
    address: '200 Another Very Long Customer Address, Apartment 98765',
    location: { lat: 40.7744, lng: -73.9678 },
    default: true,
    tag: 'home',
    user_id: 930001
  }]
}
const ORDER_OPTIONS_OK = {
  error: false,
  result: { type: 1, moment: null, address: { id: 931001, location: { lat: 40.7744, lng: -73.9678 } }, carts: [] }
}

const openWizardWithCustomer = async ({ context, page }, viewport, { orderOptions = ORDER_OPTIONS_OK } = {}) => {
  const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
  await context.route(API_CONFIGS, route => route.fulfill({ json: CONFIGS_WITH_GOOGLE }))
  await context.route(/\/fixture-api\/v1\/en\/brand-fixture\/users(\?|$)/, route => {
    if (!route.request().url().includes('cellphone')) return route.fallback()
    return route.fulfill({ json: { error: false, result: [CUSTOMER_WITH_ADDRESS], pagination: { current_page: 1, total_pages: 1, total: 1 } } })
  })
  // The order options of the customer's address (the SDK saves them with a PUT): answered here, never sent anywhere.
  await context.route('**/fixture-api/v1/en/brand-fixture/order_options*', route => {
    if (!['POST', 'PUT'].includes(route.request().method())) return route.fallback()
    // The API answers a failure with a 4xx status: the SDK casts a 200 body into the model, which a failure is not.
    return route.fulfill({ status: orderOptions.error ? 422 : 200, json: orderOptions })
  })
  await installFakeGoogleMaps(context)
  await installSyntheticSession(context, { authenticated: true })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.setViewportSize(viewport)
  await page.goto('/orders', { waitUntil: 'domcontentloaded' })
  const open = page.getByRole('button', { name: 'Create custom order', exact: true }).first()
  await expect(open).toBeVisible({ timeout: 90000 })
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.last().click()
  await open.click()
  // redesign F6c (Q2-28): the phone field is a combobox and each suggestion an «option» of its listbox.
  await page.getByRole('combobox', { name: 'Phone number', exact: true }).fill('5550000000')
  await page.getByRole('listbox', { name: 'Customer suggestions' }).getByRole('option', { name: /Fixture Customer/ }).first().click()
  return { network, pageErrors }
}

const defineWizardCase = (name, viewport) => {
  test(`${name} the wizard maps (business step, address form) stay in their box and the form takes the focus`, async ({ context, page }, testInfo) => {
    test.setTimeout(120000)
    const { network, pageErrors } = await openWizardWithCustomer({ context, page }, viewport)
    const sheet = page.locator('#custom_order_details, [role="dialog"]').filter({ has: page.locator('.odc-wizard-panel') }).first()
    await expect(sheet).toBeVisible()

    const expectContained = async (box, label) => {
      await expect(box).toBeVisible()
      await box.scrollIntoViewIfNeeded()
      const outer = await sheet.boundingBox()
      const rect = await box.boundingBox()
      const canvas = await box.getByTestId('fake-google-map').first().boundingBox()
      expect(insideX(rect, outer), `${label}: the box stays inside the sheet`).toBe(true)
      expect(inside(canvas, rect), `${label}: the Google canvas stays inside the box`).toBe(true)
      const style = await box.evaluate(element => {
        const css = getComputedStyle(element)
        const root = getComputedStyle(document.documentElement)
        return {
          height: css.height,
          token: root.getPropertyValue('--od-x-wizard-map').trim(),
          overflow: css.overflow,
          borderStyle: css.borderTopStyle,
          borderWidth: css.borderTopWidth,
          hairline: root.getPropertyValue('--od-x-hairline').trim(),
          radius: css.borderTopLeftRadius,
          radiusToken: root.getPropertyValue('--od-radius-component').trim()
        }
      })
      expect(style.height, `${label}: token height`).toBe(style.token)
      expect(style.overflow).toBe('hidden')
      expect(style.borderStyle).toBe('solid')
      expect(style.borderWidth).toBe(style.hairline)
      expect(style.radius).toBe(style.radiusToken)
    }

    // The customer has a default address with a location: the Business step is reachable and draws its map.
    await page.getByRole('button', { name: /^Continue$/ }).click()
    await expectContained(page.locator('.odc-wizard-map > *').first(), 'business map')
    await page.screenshot({ path: testInfo.outputPath(`${name}-wizard-business-map.png`) })
    await page.getByRole('button', { name: 'Back', exact: true }).click()

    // «Add address»: the title of the form takes the focus when it opens, and keeps it.
    await page.locator('[data-subview-opener="address_list"]').click()
    await page.getByRole('button', { name: 'Add new address', exact: true }).click()
    const title = page.locator('[data-address-form-title]')
    await expect(title).toBeVisible()
    await expect(title).toBeFocused()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    // Editing the address the customer has opens the same form with its map, inside its box.
    await page.getByRole('button', { name: /^Edit 200 Another/ }).click()
    await expect(title).toBeVisible()
    await expect(title).toBeFocused()
    await expectContained(page.locator('.odc-addr-map'), 'address map')
    await page.screenshot({ path: testInfo.outputPath(`${name}-wizard-address-map.png`) })

    expect(pageErrors, 'no runtime error').toEqual([])
    expectClosedNetworkBoundary(network)
  })
}

defineWizardCase('wizard desktop 1440x900', { width: 1440, height: 900 })
defineWizardCase('wizard phone 390x844', { width: 390, height: 844 })

test('wizard: order options that fail say why in the step, with no empty Error modal', async ({ context, page }, testInfo) => {
  test.setTimeout(120000)
  const { network } = await openWizardWithCustomer(
    { context, page },
    { width: 1440, height: 900 },
    { orderOptions: { error: true, result: ['Address out of the delivery area'] } }
  )
  const notice = page.getByRole('alert').filter({ hasText: 'Address out of the delivery area' })
  await expect(notice).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  // The global Alert («Error» + «Accept») stays closed.
  // redesign tramo A r2 (W0-PA1-06): the global Alert is an alertdialog; getByRole('dialog') could never match it
  await expect(page.getByRole('alertdialog').filter({ hasText: /^Error/ })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('wizard-order-options-error.png') })
  expectClosedNetworkBoundary(network)
})

// ── «Message customer» takes the focus to the chat composer; the quick replies read real text ──
test('Message customer moves the focus to the chat composer, and the quick replies are not raw keys', async ({ context, page }) => {
  test.setTimeout(120000)
  const network = await installAppNetworkBoundary(context, { scenario: 'populated' })
  await installSyntheticSession(context, { authenticated: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/orders', { waitUntil: 'domcontentloaded' })
  const orderRow = page.locator('tbody tr').filter({ hasText: '910001' }).first()
  await expect(orderRow).toContainText('Pending', { timeout: 90000 })
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  if (await accept.count()) await accept.last().click()
  await orderRow.getByText('#910001', { exact: true }).click()
  const detail = page.locator('#orderDetails')
  await expect(detail).toBeVisible()

  await detail.getByRole('button', { name: /^Message Fixture/ }).click()
  await expect(detail.getByRole('textbox', { name: 'Write a message...' })).toBeFocused()

  const quick = detail.getByRole('group', { name: 'Quick messages' }).getByRole('button')
  await expect(quick).toHaveCount(4)
  const texts = await quick.allTextContents()
  expect(texts.some(text => /_message_\d/i.test(text)), `quick replies read ${JSON.stringify(texts)}`).toBe(false)
  expectClosedNetworkBoundary(network)
})
