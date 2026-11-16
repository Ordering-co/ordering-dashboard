// Product wrappers of 7 in a real browser (T0-29): fields, switch, radio group, pagination, page header,
// map frame, record panel, section nav, date picker and the legacy-field frames, all in the gallery.
//   pnpm exec playwright test --config scripts/product-ui/playwright.config.mjs w07-wrappers
// Per piece: axe (no serious or critical, light and dark), the keyboard path of its main interaction, a visible focus
// ring, and on a 390×844 touch phone the hit area of the loose controls. Visual baselines are NOT recorded here (they are
// re-recorded when the wave closes); this file does not touch visual.spec.js.
// Values are only the ones the wrapper notes state. Where nobody has said what something must measure it is a
// test.fixme('TODO …'), never a guessed number.
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const GALLERY = '/scripts/product-ui/gallery.html'
const SECTIONS = ['fields', 'switch', 'radio-group', 'pagination', 'page-header', 'map-frame', 'record-panel', 'section-nav', 'date-picker', 'legacy-fields']

// redesign tramo B r2 (W0-QB1-12): a section that loads its pieces on demand (React.lazy in gallery-main.jsx) is ready when they paint.
const READY = { 'legacy-fields': ['.odc-image-field', '.odc-color-field', '.odc-phone-field input.PhoneInputInput'] }

const open = async (page, section, query = '') => {
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`${GALLERY}?section=${section}${query}`)
  await page.getByTestId(`section-${section}`).waitFor()
  for (const selector of READY[section] ?? []) await page.locator(`[data-testid="section-${section}"] ${selector}`).first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  // The gallery starts in light and the script switches the theme: let the colour transitions finish before axe measures contrast.
  await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))))
  return errors
}

// The h2 of a gallery section is the harness, not a wrapper: it is left out here and checked once by «the gallery page keeps its colours».
// `measured.nodes` is how many nodes the last run checked (passes, violations and incomplete): zero means axe ran over an empty page.
const measured = { nodes: 0 }
const seriousViolations = async (page, scope) => {
  const builder = new AxeBuilder({ page }).exclude('.g-section > h2')
  for (const selector of [].concat(scope ?? [])) builder.include(selector)
  const { violations, passes, incomplete } = await builder.analyze()
  measured.nodes = [...violations, ...passes, ...incomplete].reduce((total, rule) => total + rule.nodes.length, 0)
  return violations
    .filter(violation => ['serious', 'critical'].includes(violation.impact))
    .map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(' | ')}`)
}

const activeName = page => page.evaluate(() => {
  const node = document.activeElement
  return node ? (node.getAttribute('aria-label') || node.textContent.trim().slice(0, 40) || node.tagName) : null
})

// Tab until the locator holds the focus (starting from wherever the focus is now).
const tabTo = async (page, locator, limit = 40) => {
  const node = await locator.elementHandle()
  for (let step = 0; step <= limit; step += 1) {
    if (await node.evaluate(element => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Tab did not reach the control in ${limit} presses; the focus is on «${await activeName(page)}»`)
}

// Focus ring (:focus-visible): one Tab so the browser is in keyboard modality, then focus the control and read its outline.
const focusRing = async (page, locator) => {
  await page.keyboard.press('Tab')
  await locator.focus()
  return locator.evaluate(element => {
    const style = getComputedStyle(element)
    return { visible: element.matches(':focus-visible'), style: style.outlineStyle, width: style.outlineWidth }
  })
}
const expectRing = async (page, locator, name = 'control') => {
  const ring = await focusRing(page, locator)
  // soft: a list of controls reports every one that has no ring, not only the first
  expect.soft(ring.visible, `${name}: :focus-visible matched`).toBe(true)
  expect.soft(ring.style, `${name}: outline-style on :focus-visible`).not.toBe('none')
  expect.soft(parseFloat(ring.width), `${name}: outline-width on :focus-visible`).toBeGreaterThan(0)
}

// The eight points at ±21px of the centre (the corners and the edges of a 44px target) must hit the control itself.
const missedPoints = locator => locator.evaluate(node => {
  node.scrollIntoView({ block: 'center', inline: 'center' })
  const box = node.getBoundingClientRect()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  return [[-21, -21], [21, -21], [-21, 21], [21, 21], [0, -21], [0, 21], [-21, 0], [21, 0]]
    .filter(([dx, dy]) => {
      const hit = document.elementFromPoint(x + dx, y + dy)
      return !(hit && (hit === node || node.contains(hit)))
    })
    .map(([dx, dy]) => `${dx},${dy}`)
})

// redesign tramo B r3 (W0-QB2-02): an <input> takes no ::after, so its 44px area is a pseudo-element on its FRAME. The eight points
// at ±21px of the centre must hit the control or its frame (a press on the frame focuses the control), nothing else.
const FRAME = '.odc-field-control, .odc-field-box, .PhoneInput, .odc-dp-input-frame'
// redesign tramo B r4 (W0-PB3-02): also the CORNERS and the edges of the area. The area is the frame's width by 44px (the
// frame is 32px, the area 6px taller above and below), so a neighbour whose own area crosses it shows at the corners, not at the
// centre, where the first eight points look. Four corners (2px inside the frame's sides, ±21px from the centre) and the middle of
// each side: they must hit the control, the frame or something inside the frame (a button in the box has its own area).
const missedFramePoints = locator => locator.evaluate((node, frameSelector) => {
  node.scrollIntoView({ block: 'center', inline: 'center' })
  const frame = node.closest(frameSelector)
  const box = node.getBoundingClientRect()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const centred = [[-21, -21], [21, -21], [-21, 21], [21, 21], [0, -21], [0, 21], [-21, 0], [21, 0]]
    .map(([dx, dy]) => [x + dx, y + dy, `${dx},${dy}`])
  const rect = (frame ?? node).getBoundingClientRect()
  const left = rect.left + 2
  const right = rect.right - 2
  const corners = [[left, y - 21, 'corner-start-top'], [right, y - 21, 'corner-end-top'], [left, y + 21, 'corner-start-bottom'], [right, y + 21, 'corner-end-bottom'], [(left + right) / 2, y - 21, 'edge-top'], [(left + right) / 2, y + 21, 'edge-bottom']]
  return [...centred.map(point => [...point, false]), ...corners.map(point => [...point, true])]
    .filter(([px, py, , inside]) => {
      const hit = document.elementFromPoint(px, py)
      if (!hit) return true
      if (hit === node || node.contains(hit) || hit === frame) return false
      return !(inside && frame && frame.contains(hit))
    })
    .map(([, , name]) => name)
}, FRAME)

const size = async locator => {
  const box = await locator.boundingBox()
  return { width: Math.round(box.width), height: Math.round(box.height) }
}

// The value of a length token, in px (read from the page, so the test follows the token and not a copy of it).
const tokenPx = (page, name) => page.evaluate(token => {
  const probe = document.createElement('div')
  probe.style.blockSize = `var(${token})`
  probe.style.position = 'absolute'
  document.body.appendChild(probe)
  const value = parseFloat(getComputedStyle(probe).blockSize)
  probe.remove()
  return value
}, name)

// ───────────────────────── all sections: errors and axe ─────────────────────────

for (const section of SECTIONS) {
  for (const theme of ['light', 'dark']) {
    test(`${section}: no console errors and no serious axe violations (${theme})`, async ({ page }) => {
      const errors = await open(page, section, `&theme=${theme}`)
      expect(await seriousViolations(page, `[data-testid="section-${section}"]`)).toEqual([])
      expect(measured.nodes, `${section}: axe measured something`).toBeGreaterThan(0)
      if (section === 'legacy-fields') expect(await page.locator('[data-testid="section-legacy-fields"] input, [data-testid="section-legacy-fields"] button').count()).toBeGreaterThan(3)
      expect(errors).toEqual([])
    })
  }
}

test('the gallery page keeps its own colours once every wrapper is loaded (dark)', async ({ page }) => {
  await open(page, 'fields', '&theme=dark')
  const colours = await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.style.color = 'var(--od-text)'
    probe.style.backgroundColor = 'var(--od-surface-subtle)'
    document.body.appendChild(probe)
    const wanted = { color: getComputedStyle(probe).color, background: getComputedStyle(probe).backgroundColor }
    probe.remove()
    return { wanted, body: { color: getComputedStyle(document.body).color, background: getComputedStyle(document.body).backgroundColor } }
  })
  expect(colours.body).toEqual(colours.wanted)
})

// ───────────────────────── fields ─────────────────────────

test.describe('fields', () => {
  test('the label names the control, the hint and the error describe it, required says «Required»', async ({ page }) => {
    await open(page, 'fields')
    const store = page.getByRole('textbox', { name: 'Store name' })
    await expect(store).toHaveAccessibleDescription('Shown to customers on the order screen.')
    const phone = page.getByRole('textbox', { name: 'Phone', exact: true })
    await expect(phone).toHaveAttribute('aria-invalid', 'true')
    await expect(phone).toHaveAccessibleDescription('Enter a phone number with the country code.')
    await expect(page.getByRole('alert').filter({ hasText: 'Enter a phone number with the country code.' })).toBeVisible()
    const email = page.getByRole('textbox', { name: 'Contact email' })
    await expect(email).toHaveAttribute('aria-required', 'true')
    await expect(page.getByText('Required', { exact: true }).first()).toHaveClass(/odc-sr-only/) // two fields are required in the section (Contact email, Start date)
    await expect(page.getByRole('textbox', { name: 'Store ID' })).toBeDisabled()
    await expect(page.getByRole('textbox', { name: 'Search stores' })).toBeVisible()
  })

  test('keyboard: Tab goes field to field in reading order and typing writes to the focused one', async ({ page }) => {
    await open(page, 'fields')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('textbox', { name: 'Store name' })).toBeFocused()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('Burger Hub 2')
    await expect(page.getByRole('textbox', { name: 'Store name' })).toHaveValue('Burger Hub 2')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('textbox', { name: 'Contact email' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('textbox', { name: 'Phone', exact: true })).toBeFocused()
    // The disabled Store ID is skipped.
    await page.keyboard.press('Tab')
    await expect(page.getByRole('textbox', { name: 'Search stores' })).toBeFocused()
  })

  test('password: Enter and Space on the button show and hide the text, and the button keeps the focus', async ({ page }) => {
    await open(page, 'fields')
    const input = page.getByLabel('Password', { exact: true })
    await expect(input).toHaveAttribute('type', 'password')
    const show = page.getByRole('button', { name: 'Show password' })
    await tabTo(page, show)
    await page.keyboard.press('Enter')
    await expect(input).toHaveAttribute('type', 'text')
    const hide = page.getByRole('button', { name: 'Hide password' })
    await expect(hide).toBeFocused()
    await page.keyboard.press('Space')
    await expect(input).toHaveAttribute('type', 'password')
    await expect(page.getByRole('button', { name: 'Show password' })).toBeFocused()
  })

  test('number: arrows step, Home and End go to min and max, the stepper button steps by click', async ({ page }) => {
    await open(page, 'fields')
    const quantity = page.getByRole('textbox', { name: 'Quantity' }).or(page.getByRole('spinbutton', { name: 'Quantity' }))
    await tabTo(page, quantity)
    await expect(quantity).toHaveValue('3')
    await page.keyboard.press('ArrowUp')
    await expect(quantity).toHaveValue('4')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(quantity).toHaveValue('2')
    await page.keyboard.press('End')
    await expect(quantity).toHaveValue('10')
    await page.keyboard.press('Home')
    await expect(quantity).toHaveValue('0')
    // The steppers are for the mouse and the finger: Base UI takes them out of the Tab order (the arrows are the keyboard path).
    await expect(page.getByRole('button', { name: 'Increase quantity' })).toHaveAttribute('tabindex', '-1')
    await page.getByRole('button', { name: 'Increase quantity' }).click()
    await expect(quantity).toHaveValue('1')
  })

  test('number: a stepper stops at the limit it cannot pass and the error describes the field', async ({ page }) => {
    await open(page, 'fields')
    const seats = page.getByRole('textbox', { name: 'Seats' }).or(page.getByRole('spinbutton', { name: 'Seats' }))
    await expect(seats).toHaveValue('10')
    await expect(seats).toHaveAttribute('aria-invalid', 'true')
    await expect(seats).toHaveAccessibleDescription('The most a table seats is 10.')
    await expect(page.getByRole('button', { name: 'Increase seats' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Decrease seats' })).toBeEnabled()
  })

  test('number: currency formats the figure', async ({ page }) => {
    await open(page, 'fields')
    await expect(page.getByRole('textbox', { name: 'Delivery fee' }).or(page.getByRole('spinbutton', { name: 'Delivery fee' }))).toHaveValue('$4.50')
  })

  test('focus is visible on the inputs and on the buttons inside a field', async ({ page }) => {
    await open(page, 'fields')
    for (const [name, control] of [
      ['Store name', page.getByRole('textbox', { name: 'Store name' })],
      ['Order notes', page.getByRole('textbox', { name: 'Order notes' })],
      ['Password', page.getByLabel('Password', { exact: true })],
      ['Show password', page.getByRole('button', { name: 'Show password' })],
      ['Quantity', page.getByRole('textbox', { name: 'Quantity' }).or(page.getByRole('spinbutton', { name: 'Quantity' }))],
      ['Increase quantity', page.getByRole('button', { name: 'Increase quantity' })],
      ['Order type', page.getByRole('combobox', { name: 'Order type' })]
    ]) {
      await expectRing(page, control, name)
    }
  })

  test.describe('touch phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test('the buttons inside a field hit at ±21px of their centre', async ({ page }) => {
      await open(page, 'fields')
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      for (const name of ['Show password', 'Increase quantity', 'Decrease quantity']) {
        expect.soft(await missedPoints(page.getByRole('button', { name, exact: true })), name).toEqual([])
      }
    })

    // redesign tramo B r3 (W0-QB2-02, decision 12): 32px VISIBLE like the buttons, the DatePicker and the ColorField beside them; the
    // 44px area is a pseudo-element on the frame of the control (an <input> takes none)
    test('the text inputs, the number input, the select and the date trigger are 32px visible, and hit at ±21px of their centre', async ({ page }) => {
      await open(page, 'fields')
      const height = await tokenPx(page, '--od-x-control-height')
      expect(height).toBe(32)
      for (const [name, control] of [
        ['Store name', page.getByRole('textbox', { name: 'Store name' })],
        ['Contact email', page.getByRole('textbox', { name: 'Contact email' })],
        ['Search stores', page.getByRole('textbox', { name: 'Search stores' })],
        ['Order type', page.getByRole('combobox', { name: 'Order type' })]
      ]) {
        expect.soft((await size(control)).height, `${name} height`).toBe(height)
        expect.soft(await missedFramePoints(control), `${name} points`).toEqual([])
      }
      // inside a box (the box carries the border and the area): the box is 32 and the input fills it
      for (const [name, control] of [
        ['Password', page.getByLabel('Password', { exact: true })],
        ['Quantity', page.getByRole('textbox', { name: 'Quantity' }).or(page.getByRole('spinbutton', { name: 'Quantity' }))]
      ]) {
        expect.soft((await size(control.locator('xpath=ancestor::*[contains(@class,"odc-field-box")][1]'))).height, `${name} box height`).toBe(height)
        expect.soft((await size(control)).height, `${name} height`).toBeLessThanOrEqual(height)
        expect.soft(await missedFramePoints(control), `${name} points`).toEqual([])
      }
      expect((await size(page.getByRole('combobox', { name: /^Start date/ }))).height, 'Start date height').toBe(height)
      // the textarea grows with its rows; its area is on its frame too
      expect.soft(await missedFramePoints(page.getByRole('textbox', { name: 'Order notes' })), 'Order notes points').toEqual([])
    })

    test('a form has one control height: every text control of the section measures the same as the date trigger', async ({ page }) => {
      await open(page, 'fields')
      const heights = await page.evaluate(() => {
        const boxes = [...document.querySelectorAll('[data-testid="section-fields"] .g-fields .odc-field')]
          .map(field => field.querySelector('.odc-field-box, .odc-field-input:not(textarea), .odc-dp-trigger'))
          .filter(Boolean)
        return boxes.map(node => Math.round(node.getBoundingClientRect().height))
      })
      expect(heights.length).toBeGreaterThan(8)
      expect(new Set(heights)).toEqual(new Set([32]))
    })

    test('stacked controls keep their areas apart: at least 12px between a control and the next one in the section', async ({ page }) => {
      await open(page, 'fields')
      const gaps = await page.evaluate(() => {
        const controls = [...document.querySelectorAll('[data-testid="section-fields"] .g-fields > .odc-field')]
          .map(field => field.querySelector('.odc-field-box, .odc-field-input, .odc-dp-trigger').getBoundingClientRect())
        return controls.slice(1).map((rect, index) => rect.top - controls[index].bottom)
      })
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(12)
    })

    test('a tap on the 6px of area above the input focuses it', async ({ page }) => {
      await open(page, 'fields')
      const input = page.getByRole('textbox', { name: 'Store name' })
      const box = await input.boundingBox()
      await page.touchscreen.tap(box.x + box.width / 2, box.y - 4)
      await expect(input).toBeFocused()
    })
  })
})

// ───────────────────────── switch ─────────────────────────

test.describe('switch', () => {
  test('Tab reaches each enabled switch in order and skips the disabled ones; Space toggles', async ({ page }) => {
    await open(page, 'switch')
    const accept = page.getByRole('switch', { name: 'Accept orders', exact: true })
    await expect(accept).toHaveAttribute('aria-checked', 'false')
    await tabTo(page, accept)
    await page.keyboard.press('Space')
    await expect(accept).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Tab')
    const online = page.getByRole('switch', { name: 'Online ordering', exact: true })
    await expect(online).toBeFocused()
    await expect(online).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Space')
    await expect(online).toHaveAttribute('aria-checked', 'false')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('switch', { name: 'Notify the driver by SMS', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('switch', { name: 'Saving the schedule', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    // «Auto-accept orders» and «Allow tips» are disabled: nothing else in the section takes the focus.
    expect(await page.evaluate(() => document.activeElement === document.body || !document.activeElement.closest('[data-testid="section-switch"]'))).toBe(true)
    await expect(page.getByRole('switch', { name: 'Auto-accept orders', exact: true })).toBeDisabled()
    await expect(page.getByRole('switch', { name: 'Allow tips', exact: true })).toBeDisabled()
    await expect(page.getByRole('switch', { name: 'Allow tips', exact: true })).toHaveAttribute('aria-checked', 'true')
  })

  test('the visible text is part of the switch: a click on it toggles it', async ({ page }) => {
    await open(page, 'switch')
    const sms = page.getByRole('switch', { name: 'Notify the driver by SMS', exact: true })
    await expect(sms).toHaveAttribute('aria-checked', 'false')
    await page.getByText('Notify the driver by SMS').click()
    await expect(sms).toHaveAttribute('aria-checked', 'true')
  })

  test('busy: aria-busy, further presses are ignored and the switch keeps the focus', async ({ page }) => {
    await open(page, 'switch')
    const busy = page.getByRole('switch', { name: 'Saving the schedule', exact: true })
    await expect(busy).toHaveAttribute('aria-busy', 'true')
    await expect(busy).toBeEnabled()
    await tabTo(page, busy)
    await page.keyboard.press('Space')
    await expect(busy).toHaveAttribute('aria-checked', 'true')
    await expect(busy).toBeFocused()
  })

  test('focus is visible', async ({ page }) => {
    await open(page, 'switch')
    await expectRing(page, page.getByRole('switch', { name: 'Accept orders', exact: true }))
    await expectRing(page, page.getByRole('switch', { name: 'Notify the driver by SMS', exact: true }))
  })

  test.describe('touch phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test('each switch hits at ±21px of its centre', async ({ page }) => {
      await open(page, 'switch')
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      for (const name of ['Accept orders', 'Online ordering', 'Notify the driver by SMS', 'Saving the schedule']) {
        expect.soft(await missedPoints(page.getByRole('switch', { name, exact: true })), name).toEqual([])
      }
    })

    test('a tap toggles', async ({ page }) => {
      await open(page, 'switch')
      const accept = page.getByRole('switch', { name: 'Accept orders', exact: true })
      await accept.tap()
      await expect(accept).toHaveAttribute('aria-checked', 'true')
    })
  })
})

// ───────────────────────── radio group ─────────────────────────

test.describe('radio group', () => {
  test('one Tab stop: arrows move and choose, a disabled option is never chosen, Home and End go to the enabled ends', async ({ page }) => {
    await open(page, 'radio-group')
    const group = page.getByRole('radiogroup', { name: 'Delivery time' })
    const later = group.getByRole('radio', { name: 'Schedule for later' })
    const now = group.getByRole('radio', { name: 'As soon as possible' })
    const pickup = group.getByRole('radio', { name: 'Customer pickup' })
    await expect(later).toHaveAttribute('aria-checked', 'true')
    await expect(pickup).toBeDisabled()
    await expect(pickup).toHaveAccessibleDescription('Not offered by this store')
    await tabTo(page, later)
    await page.keyboard.press('ArrowDown')
    await expect(now).toBeFocused()
    await expect(now).toHaveAttribute('aria-checked', 'true')
    await expect(later).toHaveAttribute('aria-checked', 'false')
    await page.keyboard.press('ArrowDown')
    await expect(pickup).not.toBeFocused()
    await expect(pickup).toHaveAttribute('aria-checked', 'false')
    await page.keyboard.press('Home')
    await expect(later).toBeFocused()
    await expect(later).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('End')
    await expect(now).toBeFocused()
    await expect(now).toHaveAttribute('aria-checked', 'true')
    // Tab leaves the group: the other radios are not stops.
    await page.keyboard.press('Tab')
    await expect(group.getByRole('radio', { name: 'Schedule for later' })).not.toBeFocused()
    await expect(group.getByRole('radio', { name: 'As soon as possible' })).not.toBeFocused()
  })

  test('a value that matches no option leaves the Tab stop on the first enabled radio', async ({ page }) => {
    await open(page, 'radio-group')
    const group = page.getByRole('radiogroup', { name: 'Sort orders by' })
    await expect(group.getByRole('radio', { checked: true })).toHaveCount(0)
    await tabTo(page, group.getByRole('radio', { name: 'Oldest first' }))
    await expect(group.getByRole('radio', { name: 'Oldest first' })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(group.getByRole('radio', { name: 'Total' })).toBeFocused()
    await expect(group.getByRole('radio', { name: 'Total' })).toHaveAttribute('aria-checked', 'true')
  })

  test('RTL: the horizontal arrows are inverted', async ({ page }) => {
    await open(page, 'radio-group', '&dir=rtl')
    const group = page.getByRole('radiogroup', { name: 'Sort orders by' })
    await tabTo(page, group.getByRole('radio', { name: 'Oldest first' }))
    await page.keyboard.press('ArrowLeft')
    await expect(group.getByRole('radio', { name: 'Total' })).toBeFocused()
    await expect(group.getByRole('radio', { name: 'Total' })).toHaveAttribute('aria-checked', 'true')
  })

  test('a disabled group has no Tab stop', async ({ page }) => {
    await open(page, 'radio-group')
    const group = page.getByRole('radiogroup', { name: 'Receipt language' })
    for (const radio of await group.getByRole('radio').all()) await expect(radio).toBeDisabled()
    await expect(group.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
  })

  test('focus is visible', async ({ page }) => {
    await open(page, 'radio-group')
    await expectRing(page, page.getByRole('radio', { name: 'Schedule for later' }))
  })

  // redesign tramo B r2 (W0-QB1-06): stacked rows are < 12px apart, so each row is 44px VISIBLE and a ±21px probe lands on its own row
  test.describe('touch phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test('each row is 44px high and the points at ±21px of its centre fall in its own radio, never the neighbour', async ({ page }) => {
      await open(page, 'radio-group')
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      for (const group of ['Delivery time', 'Sort orders by']) {
        const radios = await page.getByRole('radiogroup', { name: group }).getByRole('radio').all()
        for (const radio of radios) {
          expect.soft((await size(radio)).height, `${group}: height`).toBeGreaterThanOrEqual(44)
          expect.soft(await missedPoints(radio), `${group}: points`).toEqual([])
        }
      }
    })
  })
})

// ───────────────────────── pagination ─────────────────────────

test.describe('pagination', () => {
  const nav = (page, name) => page.getByRole('navigation', { name })

  test('next, previous and the page field change the range; Escape drops a typed page', async ({ page }) => {
    await open(page, 'pagination')
    const foot = nav(page, 'Orders pages')
    await expect(foot).toContainText('Showing 31–40 of 123')
    const field = foot.getByRole('textbox', { name: 'Page' })
    await tabTo(page, foot.getByRole('button', { name: 'Next page' }))
    await page.keyboard.press('Enter')
    await expect(foot).toContainText('Showing 41–50 of 123')
    await expect(field).toHaveValue('5')
    await field.focus()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('9')
    await page.keyboard.press('Escape')
    await expect(field).toHaveValue('5')
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('9')
    await page.keyboard.press('Enter')
    await expect(foot).toContainText('Showing 81–90 of 123')
    await foot.getByRole('button', { name: 'Previous page' }).focus()
    await page.keyboard.press('Space')
    await expect(foot).toContainText('Showing 71–80 of 123')
  })

  test('the page field clamps to the last page', async ({ page }) => {
    await open(page, 'pagination')
    const foot = nav(page, 'Orders pages')
    await foot.getByRole('textbox', { name: 'Page' }).fill('99')
    await page.keyboard.press('Enter')
    await expect(foot).toContainText('Showing 121–123 of 123')
  })

  test('rows per page: the menu opens with the keyboard, choosing keeps the first item in view, Escape gives the focus back', async ({ page }) => {
    await open(page, 'pagination')
    const foot = nav(page, 'Orders pages')
    const trigger = foot.getByRole('button', { name: 'Rows per page 10' })
    await tabTo(page, trigger)
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitemradio', { name: '10' })).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitemradio', { name: '25' }).click()
    // Page 4 of 10 starts at item 31: with 25 per page that item is on page 2, items 26–50.
    await expect(foot).toContainText('Showing 26–50 of 123')
    await expect(foot.getByRole('button', { name: 'Rows per page 25' })).toBeVisible()
  })

  test('the edges: the first page cannot go back, the last cannot go on, and a button that reaches its edge hands the focus to the page field', async ({ page }) => {
    await open(page, 'pagination')
    await expect(nav(page, 'First page').getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await expect(nav(page, 'First page').getByRole('button', { name: 'Next page' })).toBeEnabled()
    await expect(nav(page, 'Last page')).toContainText('Showing 121–123 of 123')
    await expect(nav(page, 'Last page').getByRole('button', { name: 'Next page' })).toBeDisabled()
    const foot = nav(page, 'Orders pages')
    await foot.getByRole('textbox', { name: 'Page' }).fill('12')
    await page.keyboard.press('Enter')
    await expect(foot).toContainText('Showing 111–120 of 123')
    const next = foot.getByRole('button', { name: 'Next page' })
    await next.focus()
    await page.keyboard.press('Enter')
    await expect(foot).toContainText('Showing 121–123 of 123')
    await expect(next).toBeDisabled()
    await expect(foot.getByRole('textbox', { name: 'Page' })).toBeFocused()
  })

  test('without a total: no page field, no «of», next stops where hasMore is false', async ({ page }) => {
    await open(page, 'pagination')
    const foot = nav(page, 'Without a total')
    await expect(foot).toContainText('Showing 1–10')
    await expect(foot).not.toContainText('of')
    await expect(foot.getByRole('textbox', { name: 'Page' })).toHaveCount(0)
    const next = foot.getByRole('button', { name: 'Next page' })
    for (let index = 0; index < 4; index += 1) await next.click()
    await expect(foot).toContainText('Showing 41–44')
    await expect(next).toBeDisabled()
  })

  test('busy: aria-busy, the buttons stay enabled and do nothing', async ({ page }) => {
    await open(page, 'pagination')
    const foot = nav(page, 'Saving page')
    await expect(foot).toHaveAttribute('aria-busy', 'true')
    const next = foot.getByRole('button', { name: 'Next page' })
    await expect(next).toBeEnabled()
    await next.focus()
    await page.keyboard.press('Enter')
    await expect(foot).toContainText('Showing 21–30 of 123')
    await expect(next).toBeFocused()
  })

  test('no results: the foot paints nothing', async ({ page }) => {
    await open(page, 'pagination')
    await expect(nav(page, 'No results')).toHaveCount(0)
  })

  test('focus is visible', async ({ page }) => {
    await open(page, 'pagination')
    const foot = nav(page, 'Orders pages')
    for (const control of [
      foot.getByRole('button', { name: 'Rows per page 10' }),
      foot.getByRole('textbox', { name: 'Page' }),
      foot.getByRole('button', { name: 'Previous page' }),
      foot.getByRole('button', { name: 'Next page' })
    ]) {
      await expectRing(page, control)
    }
  })

  test.describe('touch phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    // Notes of the implementer: on a phone the previous and next buttons and the page field are 44px visible.
    test('previous, next and the page field are 44px visible', async ({ page }) => {
      await open(page, 'pagination')
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const foot = nav(page, 'Orders pages')
      for (const [name, control] of [
        ['Previous page', foot.getByRole('button', { name: 'Previous page' })],
        ['Next page', foot.getByRole('button', { name: 'Next page' })],
        ['Page field', foot.getByRole('textbox', { name: 'Page' })]
      ]) {
        const { width, height } = await size(control)
        expect.soft(width, `${name} width`).toBeGreaterThanOrEqual(44)
        expect.soft(height, `${name} height`).toBeGreaterThanOrEqual(44)
      }
    })

    test.fixme('TODO W0-7: size of the «Rows per page» trigger on a phone. The notes do not say what it must measure', async () => {})
  })
})

// ───────────────────────── page header ─────────────────────────

test.describe('page header', () => {
  const header = (page, title) => page.locator('.odc-pagehead').filter({ has: page.getByRole('heading', { level: 1, name: title }) })

  test('the title is the h1, the count is read with its label, the controls come in reading order', async ({ page }) => {
    await open(page, 'page-header')
    const orders = header(page, 'Orders')
    await expect(orders.getByRole('heading', { level: 1, name: 'Orders' })).toHaveAttribute('title', 'Orders')
    await expect(orders.getByText('744 orders')).toHaveClass(/odc-sr-only/)
    await tabTo(page, orders.getByRole('button', { name: 'Live', exact: true }))
    for (const name of ['About this page', 'More actions', 'New order']) {
      await page.keyboard.press('Tab')
      await expect(orders.getByRole('button', { name })).toBeFocused()
    }
  })

  test('the «More» menu opens with the keyboard and Escape gives the focus back', async ({ page }) => {
    await open(page, 'page-header')
    const more = header(page, 'Orders').getByRole('button', { name: 'More actions' })
    await more.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Export…' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(more).toBeFocused()
  })

  test('the back arrow is the first control and has its own name', async ({ page }) => {
    await open(page, 'page-header')
    const detail = header(page, 'Order 1042')
    await tabTo(page, detail.getByRole('button', { name: 'Back to orders' }))
    await page.keyboard.press('Tab')
    await expect(detail.getByRole('button', { name: 'Live', exact: true })).toBeFocused()
  })

  // PH-1 (decision 1 of shared-pieces-fixes): the long title wraps to two lines, then truncates; it never overflows sideways
  test('narrow: the marked texts keep only their icon and stay in the accessible name; the long title wraps to two lines with its full text', async ({ page }) => {
    await open(page, 'page-header')
    const wide = header(page, 'Orders')
    const narrow = page.getByTestId('page-header-narrow')
    const wideText = await size(wide.locator('[data-collapse-label]').first())
    const narrowText = await size(narrow.locator('[data-collapse-label]').first())
    expect(wideText.width).toBeGreaterThan(4)
    expect(narrowText.width).toBeLessThanOrEqual(2)
    await expect(narrow.getByRole('button', { name: 'Live', exact: true })).toBeVisible()
    await expect(narrow.getByRole('button', { name: 'About this page' })).toBeVisible()
    const title = narrow.getByRole('heading', { level: 1 })
    await expect(title).toHaveAttribute('title', 'Deliveries scheduled for the Downtown and Harbour districts this week')
    expect(await title.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    const line = await title.evaluate(node => parseFloat(getComputedStyle(node).lineHeight))
    const height = (await size(title)).height
    expect(height).toBeGreaterThan(line + 2)
    expect(height).toBeLessThanOrEqual(Math.ceil(line * 2) + 2)
  })

  // redesign tramo B r3 (W0-QB2-05): the title is as wide as its text, so the count keeps the row's gap (r2 gave it a 6-figure minimum:
  // «Orders» sat in a 115px box and its count 65px away)
  test('QB2-05: a short title is as wide as its text and its count is a row gap away', async ({ page }) => {
    await open(page, 'page-header')
    const measure = await header(page, 'Orders').evaluate(head => {
      const title = head.querySelector('.odc-pagehead-title')
      const range = document.createRange()
      range.selectNodeContents(title)
      const text = range.getBoundingClientRect()
      const box = title.getBoundingClientRect()
      const count = head.querySelector('.odc-count').getBoundingClientRect()
      return { textWidth: text.width, boxWidth: box.width, gap: count.left - text.right, rowGap: parseFloat(getComputedStyle(head.querySelector('.odc-pagehead-row')).columnGap) }
    })
    expect(measure.boxWidth).toBeLessThanOrEqual(measure.textWidth + 1)
    expect(measure.gap).toBeLessThanOrEqual(measure.rowGap + 1)
  })

  // redesign tramo B r3 (W0-QB2-06), r4 (W0-QB3-01, -02): measures the first header at a given width (and with a given title)
  const widthOf = (page, width, title) => page.locator('.odc-pagehead').first().evaluate((head, [px, text]) => {
    head.style.width = `${px}px`
    if (text) head.querySelector('.odc-pagehead-title').textContent = text
    const rowBox = head.querySelector('.odc-pagehead-row').getBoundingClientRect()
    const titleBox = head.querySelector('.odc-pagehead-title').getBoundingClientRect()
    const actions = head.querySelector('.odc-pagehead-actions').getBoundingClientRect()
    const count = head.querySelector('.odc-count').getBoundingClientRect()
    const lead = head.querySelector('.odc-pagehead-lead').getBoundingClientRect()
    const rowStyle = getComputedStyle(head.querySelector('.odc-pagehead-row'))
    return {
      wrapped: actions.top > titleBox.bottom - 2,
      rowHeight: rowBox.height,
      titleWidth: titleBox.width,
      sideways: head.scrollWidth > head.clientWidth || actions.right > head.getBoundingClientRect().right + 0.5,
      countGap: count.left - titleBox.right,
      rowGap: parseFloat(rowStyle.columnGap),
      leadWidth: lead.width,
      leadBasis: parseFloat(getComputedStyle(head.querySelector('.odc-pagehead-lead')).flexBasis)
    }
  }, [width, title])
  const LONG_TITLE = 'Deliveries scheduled for the Downtown and Harbour districts this week and beyond'

  test('QB2-06: a wide header stays on one row, even with a very long title (it truncates)', async ({ page }) => {
    await open(page, 'page-header')
    for (const width of [1200, 900, 700, 600]) {
      const result = await widthOf(page, width, LONG_TITLE)
      expect(result.wrapped, `${width}px`).toBe(false)
      expect(result.sideways, `${width}px sideways`).toBe(false)
      expect(result.titleWidth, `${width}px title`).toBeGreaterThan(150)
    }
  })

  // redesign tramo B r4 (W0-QB3-01, -02): at any width, with a short or a long title, with or without the back arrow: the block never goes under
  // its minimum, the count stays against the title, nothing overflows, and the actions drop only when the block would go under its minimum.
  for (const [name, headTitle] of [['Orders', 'Orders'], ['Order 1042', 'Order 1042']]) {
    test(`QB3-01/02: ${name}: block minimum, count against the title, no overflow, at 320 to 1440`, async ({ page }) => {
      await open(page, 'page-header')
      const head = await header(page, headTitle).elementHandle() // a handle: the title text changes below, and a locator by name would not find it again
      for (const title of [headTitle, 'La Taquería de Doña Guadalupe — Sucursal Polanco']) {
        for (const width of [320, 390, 600, 620, 640, 700, 1024, 1440]) {
          const result = await head.evaluate((node, [px, text]) => {
            node.style.width = `${px}px`
            node.querySelector('.odc-pagehead-title').textContent = text
            const q = selector => node.querySelector(selector).getBoundingClientRect()
            const titleBox = q('.odc-pagehead-title')
            const actions = q('.odc-pagehead-actions')
            const lead = q('.odc-pagehead-lead')
            const basis = parseFloat(getComputedStyle(node.querySelector('.odc-pagehead-lead')).flexBasis)
            const gap = parseFloat(getComputedStyle(node.querySelector('.odc-pagehead-row')).columnGap)
            return {
              wrapped: actions.top > lead.bottom - 2,
              sideways: node.scrollWidth > node.clientWidth || actions.right > node.getBoundingClientRect().right + 0.5,
              leadWidth: lead.width,
              basis,
              titleWidth: titleBox.width,
              countGap: node.querySelector('.odc-count') ? q('.odc-count').left - titleBox.right : 0, // «Order 1042» has no count
              gap,
              actionsWidth: actions.width,
              container: px
            }
          }, [width, title])
          const where = `${name} / ${title.length > 12 ? 'long' : 'short'} / ${width}`
          expect(result.sideways, `${where} overflow`).toBe(false)
          expect(result.leadWidth, `${where} block`).toBeGreaterThanOrEqual(Math.min(result.basis, result.container) - 1)
          expect(result.countGap, `${where} count gap`).toBeLessThanOrEqual(result.gap + 1)
          expect(result.titleWidth, `${where} title`).toBeGreaterThan(60)
          // the actions drop only when the block at its minimum would not fit beside them
          const fits = result.basis + result.gap + result.actionsWidth <= result.container + 1
          expect(result.wrapped, `${where} wrapped`).toBe(!fits)
        }
      }
    })
  }

  test('the status slot is on the row even when it is empty, with the height of a control', async ({ page }) => {
    await open(page, 'page-header')
    const slot = header(page, 'Without status').locator('.odc-pagehead-status')
    await expect(slot).toHaveAttribute('data-empty', '')
    const controlHeight = await tokenPx(page, '--od-x-control-height')
    expect((await size(slot)).height).toBeGreaterThanOrEqual(controlHeight)
  })

  // (P-1): the page's «Open menu» button in the `leading` slot is the first control, centred with the title, a block gap away
  test('leading: the opener is the first control of the header, centred with the title and in its block', async ({ page }) => {
    await open(page, 'page-header')
    const customers = page.getByTestId('page-header-leading')
    const opener = customers.getByRole('button', { name: 'Open menu' })
    await tabTo(page, opener)
    await page.keyboard.press('Tab')
    await expect(customers.getByRole('button', { name: 'About this page' })).toBeFocused()
    const place = await customers.evaluate(frame => {
      const lead = frame.querySelector('.odc-pagehead-lead')
      const button = lead.firstElementChild.getBoundingClientRect()
      const title = frame.querySelector('.odc-pagehead-title').getBoundingClientRect()
      const description = frame.querySelector('.odc-pagehead-description').getBoundingClientRect()
      const centre = box => box.top + box.height / 2
      return { first: lead.firstElementChild.getAttribute('aria-label'), dy: centre(button) - centre(title), gap: title.left - button.right, leadGap: parseFloat(getComputedStyle(lead).columnGap), descriptionBelow: description.top >= button.bottom - 1 }
    })
    // centred like the back arrow is: both are flex items of the block, which centres its children on the title's box
    const backDy = await header(page, 'Order 1042').evaluate(head => {
      const centre = box => box.top + box.height / 2
      return centre(head.querySelector('.odc-pagehead-lead > .odc-btn').getBoundingClientRect()) - centre(head.querySelector('.odc-pagehead-title').getBoundingClientRect())
    })
    expect(place.first).toBe('Open menu')
    expect(Math.abs(place.dy - backDy)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(place.dy)).toBeLessThanOrEqual(2)
    expect(place.gap).toBeCloseTo(place.leadGap, 0)
    expect(place.descriptionBelow).toBe(true)
    // the block's minimum grows by a control and a block gap: the title keeps the minimum it had beside an outside button
    const basis = async locator => locator.locator('.odc-pagehead-lead').evaluate(lead => parseFloat(getComputedStyle(lead).flexBasis))
    const extra = await customers.evaluate(frame => {
      const probe = document.createElement('div')
      probe.style.inlineSize = 'calc(var(--od-x-control-height) + var(--od-space-3))'
      frame.appendChild(probe)
      const width = probe.getBoundingClientRect().width
      probe.remove()
      return width
    })
    expect(extra).toBeGreaterThan(30)
    expect(await basis(customers)).toBeCloseTo(await basis(header(page, 'Orders')) + extra, 0)
    await expectRing(page, opener, 'Open menu')
    expect(await seriousViolations(page, '[data-testid="page-header-leading"]')).toEqual([])
  })

  test('leading, narrow: opener, back arrow and the wrapped title stay one block; nothing overflows', async ({ page }) => {
    await open(page, 'page-header')
    const narrow = page.getByTestId('page-header-leading-narrow')
    const result = await narrow.evaluate(frame => {
      const lead = frame.querySelector('.odc-pagehead-lead')
      const [opener, back, title] = [...lead.children].map(node => node.getBoundingClientRect())
      const head = frame.querySelector('.odc-pagehead')
      return {
        order: [...lead.children].slice(0, 2).map(node => node.getAttribute('aria-label')),
        sameLine: Math.abs((opener.top + opener.height / 2) - (back.top + back.height / 2)) <= 1,
        titleAfter: title.left >= back.right,
        sideways: head.scrollWidth > head.clientWidth + 1
      }
    })
    expect(result.order).toEqual(['Open menu', 'Back to stores'])
    expect(result.sameLine).toBe(true)
    expect(result.titleAfter).toBe(true)
    expect(result.sideways).toBe(false)
  })

  // (DD-09): a narrow header's actions drop to their own line at its end, as wide as their content. A search there started
  // after the width of the opener (x=54 against 20 on /drivers-dashboard at 390). Marked `data-fill`, it spans the line from the content edge.
  test('data-fill, narrow: the marked action spans the whole line under the block; the others stay at the end; nothing overflows', async ({ page }) => {
    await open(page, 'page-header')
    const result = await page.getByTestId('page-header-fill-narrow').evaluate(frame => {
      const head = frame.querySelector('.odc-pagehead').getBoundingClientRect()
      const lead = frame.querySelector('.odc-pagehead-lead').getBoundingClientRect()
      const fill = frame.querySelector('[data-fill]').getBoundingClientRect()
      const learn = frame.querySelector('.odc-pagehead-actions > :not([data-fill])').getBoundingClientRect()
      return { start: fill.left - head.left, end: head.right - fill.right, below: fill.top >= lead.bottom - 1, learnEnd: head.right - learn.right, sideways: frame.scrollWidth > frame.clientWidth + 1 }
    })
    expect(Math.abs(result.start)).toBeLessThanOrEqual(1)
    expect(Math.abs(result.end)).toBeLessThanOrEqual(1)
    expect(result.below).toBe(true)
    expect(Math.abs(result.learnEnd)).toBeLessThanOrEqual(1)
    expect(result.sideways).toBe(false)
    // only a direct child of the actions: `data-fill` deeper in the header (it means other things in skeletons and cards) is not stretched
    const deeper = await page.getByTestId('page-header-fill-narrow').evaluate(frame => {
      const probe = document.createElement('span')
      probe.setAttribute('data-fill', '')
      frame.querySelector('.odc-pagehead-lead').appendChild(probe)
      const basis = getComputedStyle(probe).flexBasis
      probe.remove()
      return basis
    })
    expect(deeper).not.toBe('100%')
  })

  test('focus is visible', async ({ page }) => {
    await open(page, 'page-header')
    const orders = header(page, 'Orders')
    for (const name of ['Live', 'About this page', 'More actions', 'New order']) await expectRing(page, orders.getByRole('button', { name, exact: true }), name)
    await expectRing(page, header(page, 'Order 1042').getByRole('button', { name: 'Back to orders' }))
  })

  test.describe('touch phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    // redesign tramo B r4 (W0-QB3-01, -02): the block (arrow, title, count, status) has a minimum of its own, so the actions drop to their own
    // line as soon as the block would go under it. that minimum follows the title down inside the narrow container (8.4
    // section sizes, 132.3px in the gallery, just under the 132.7px the «Orders» block measures with 44px touch buttons), so the 44px
    // actions group (196px) stays beside it from 332px up (344, 358, 375 and 414 included) and drops only at 320px, where they really do not fit.
    // It never overflows and the count stays against the title.
    test('QB3-01/02: at a phone\'s width the actions stay beside the block while they fit and drop under it when they do not, no overflow', async ({ page }) => {
      await open(page, 'page-header')
      for (const [width, wrapped] of [[414, false], [375, false], [358, false], [344, false], [320, true]]) {
        const result = await widthOf(page, width)
        expect(result.sideways, `${width} sideways`).toBe(false)
        expect(result.wrapped, `${width} wrapped`).toBe(wrapped)
        expect(result.countGap, `${width} count gap`).toBeLessThanOrEqual(result.rowGap + 1)
        expect(result.titleWidth, `${width} title`).toBeGreaterThan(40)
      }
      // «Orders» has four buttons on the row (the live status in the block and three actions) and each is 44px, on the widths where they stay beside the block too
      const buttons = await page.locator('.odc-pagehead').first().evaluate(head => [...head.querySelectorAll('.odc-pagehead-row .odc-btn')].map(node => node.getBoundingClientRect().height))
      expect(buttons).toHaveLength(4)
      for (const height of buttons) expect(height).toBeGreaterThanOrEqual(44)
      const long = await widthOf(page, 288, LONG_TITLE)
      expect(long.titleWidth, '288 long title').toBeGreaterThan(100)
      expect(long.countGap, '288 count gap').toBeLessThanOrEqual(long.rowGap + 1)
    })

    // Notes of the implementer: on a phone every button of the row is 44px visible, 4px apart.
    test('every button of the row is 44px visible', async ({ page }) => {
      await open(page, 'page-header')
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const detail = header(page, 'Order 1042')
      for (const name of ['Back to orders', 'More order actions']) {
        const { width, height } = await size(detail.getByRole('button', { name }))
        expect(width, name).toBeGreaterThanOrEqual(44)
        expect(height, name).toBeGreaterThanOrEqual(44)
      }
      for (const button of await header(page, 'Orders').getByRole('button').all()) {
        expect((await size(button)).height).toBeGreaterThanOrEqual(44)
      }
    })

    // the opener in `leading` is a button of the row, so it is 44px visible too (the pages' own copies were 32px)
    test('the leading opener is 44px visible, like every button of the row', async ({ page }) => {
      await open(page, 'page-header')
      for (const id of ['page-header-leading', 'page-header-leading-narrow']) {
        const { width, height } = await size(page.getByTestId(id).getByRole('button', { name: 'Open menu' }))
        expect(width, id).toBeGreaterThanOrEqual(44)
        expect(height, id).toBeGreaterThanOrEqual(44)
      }
    })

    // (owner decision 28 B): the report header at a phone's width. Without `wideTitle` the title is squeezed beside «Switch
    // report» (~122px, cut); with it the block takes the row, the actions go to the line below, and the two-line title reads
    // whole. The plain header keeps its own rule (the tests above pin it); here it only never gets wider than the wide one.
    test('wideTitle: the report title takes the whole row and reads in two lines; the plain header is unchanged', async ({ page }) => {
      await open(page, 'page-header')
      const measure = id => page.getByTestId(id).locator('.odc-pagehead').evaluate(head => {
        const row = head.querySelector('.odc-pagehead-row').getBoundingClientRect()
        const lead = head.querySelector('.odc-pagehead-lead').getBoundingClientRect()
        const actions = head.querySelector('.odc-pagehead-actions').getBoundingClientRect()
        const title = head.querySelector('.odc-pagehead-title')
        const titleBox = title.getBoundingClientRect()
        return {
          leadShare: lead.width / row.width,
          actionsBelow: actions.top >= lead.bottom - 1,
          titleWidth: titleBox.width,
          titleCut: title.scrollHeight > title.clientHeight + 1,
          sideways: head.scrollWidth > head.clientWidth + 1
        }
      })
      const wide = await measure('page-header-wide-title-narrow')
      expect(wide.leadShare).toBeGreaterThan(0.98)
      expect(wide.actionsBelow).toBe(true)
      expect(wide.titleWidth).toBeGreaterThan(180)
      expect(wide.titleCut).toBe(false)
      expect(wide.sideways).toBe(false)
      const plain = await measure('page-header-report-narrow')
      expect(plain.titleWidth).toBeLessThanOrEqual(wide.titleWidth)
      expect(plain.sideways).toBe(false)
    })
  })
})

// ───────────────────────── map frame ─────────────────────────

test.describe('map frame', () => {
  test('default and compact take their height from the tokens and never exceed their container', async ({ page }) => {
    await open(page, 'map-frame')
    const ready = page.getByRole('region', { name: 'Delivery location' })
    const compact = page.getByRole('region', { name: 'Driver position' })
    await expect(ready).toHaveAttribute('data-state', 'ready')
    await expect(ready).toHaveAttribute('data-size', 'default')
    await expect(compact).toHaveAttribute('data-size', 'compact')
    expect((await size(ready)).height).toBe(await tokenPx(page, '--od-x-map-height'))
    expect((await size(compact)).height).toBe(await tokenPx(page, '--od-x-map-height-compact'))
    const container = await size(page.getByTestId('map-frame-demo'))
    expect((await size(ready)).width).toBeLessThanOrEqual(container.width)
    expect((await size(compact)).width).toBeLessThanOrEqual(container.width)
  })

  test('unavailable (reported, or no key) draws the notice in the same slot with role status', async ({ page }) => {
    await open(page, 'map-frame')
    const ready = page.getByRole('region', { name: 'Delivery location' })
    const reported = page.getByRole('region', { name: 'Driver position' })
    const noKey = page.getByRole('region', { name: 'Store location' })
    await expect(ready.getByRole('status')).toHaveCount(0)
    for (const frame of [reported, noKey]) {
      await expect(frame).toHaveAttribute('data-state', 'unavailable')
      await expect(frame.getByRole('status')).toContainText('The map is unavailable')
    }
    await expect(reported.getByRole('status')).toContainText('Drivers are listed below until the map loads again.')
    await expect(noKey.getByRole('status')).not.toContainText('Drivers are listed')
    expect((await size(noKey)).height).toBe(await tokenPx(page, '--od-x-map-height'))
  })

  test('the frame is not a Tab stop, and when something hands it the focus the ring is visible', async ({ page }) => {
    await open(page, 'map-frame')
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.closest('.odc-map-frame') === null)).toBe(true)
    await expectRing(page, page.getByRole('region', { name: 'Store location' }))
  })

  test.fixme('TODO W0-7: the provider script failing to load (useGoogleMapsFailure) and a child that throws while it renders. The gallery has no failing map to mount; the wrapper unit tests cover both', async () => {})
})

// ───────────────────────── record panel ─────────────────────────

test.describe('record panel', () => {
  const panel = page => page.getByTestId('record-panel-demo')

  test('tabs: arrows move the focus, Enter shows the panel, every panel stays mounted', async ({ page }) => {
    await open(page, 'record-panel')
    const general = panel(page).getByRole('tab', { name: 'General' })
    const hours = panel(page).getByRole('tab', { name: 'Hours' })
    await expect(general).toHaveAttribute('aria-selected', 'true')
    await tabTo(page, general)
    await page.keyboard.press('ArrowRight')
    await expect(hours).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(hours).toHaveAttribute('aria-selected', 'true')
    await expect(panel(page).getByText('Monday to Sunday, 10:00 to 22:00.')).toBeVisible()
    // The draft of the first tab survives: its textarea is hidden, not unmounted.
    await expect(panel(page).locator('textarea')).toHaveCount(1)
    await expect(panel(page).getByRole('textbox', { name: 'Description' })).toBeHidden()
  })

  test('clean: the close button closes at once', async ({ page }) => {
    await open(page, 'record-panel')
    await panel(page).getByRole('button', { name: 'Close panel' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(panel(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open store record' })).toBeVisible()
  })

  test('dirty: closing asks first, the focus starts on «Keep editing» and goes back to the field; «Discard» closes', async ({ page }) => {
    await open(page, 'record-panel')
    const field = panel(page).getByRole('textbox', { name: 'Description' })
    await field.fill('Neighbourhood burger place, open daily. New menu.')
    const close = panel(page).getByRole('button', { name: 'Close panel' })
    await close.click()
    const dialog = page.getByRole('alertdialog', { name: 'Discard changes?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(field).toBeFocused()
    await expect(field).toHaveValue(/New menu\.$/)
    // Escape on the question is «keep editing» too.
    await close.click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(field).toBeFocused()
    await close.click()
    await dialog.getByRole('button', { name: 'Discard' }).click()
    await expect(panel(page)).toHaveCount(0)
  })

  test('saving makes the panel clean again: closing no longer asks', async ({ page }) => {
    await open(page, 'record-panel')
    const field = panel(page).getByRole('textbox', { name: 'Description' })
    await field.fill('Neighbourhood burger place, open daily. New menu.')
    await panel(page).getByRole('button', { name: 'Save changes' }).click()
    await panel(page).getByRole('button', { name: 'Close panel' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(panel(page)).toHaveCount(0)
  })

  test('navigation slot: a column at the start of the body in a wide panel', async ({ page }) => {
    await open(page, 'record-panel')
    const withNav = page.getByTestId('record-panel-nav-demo')
    await expect(withNav.locator('.odc-record')).toHaveAttribute('data-layout', 'nav')
    const navBox = await withNav.locator('.odc-record-nav').boundingBox()
    const bodyBox = await withNav.locator('.odc-record-body').boundingBox()
    expect(navBox.x + navBox.width).toBeLessThanOrEqual(bodyBox.x + 1)
    await tabTo(page, withNav.getByRole('button', { name: 'Opening hours' }))
    await page.keyboard.press('Enter')
    await expect(withNav.getByText('Section: hours')).toBeVisible()
  })

  test('focus is visible', async ({ page }) => {
    await open(page, 'record-panel')
    await expectRing(page, panel(page).getByRole('button', { name: 'Close panel' }))
    await expectRing(page, panel(page).getByRole('tab', { name: 'General' }))
    await expectRing(page, panel(page).getByRole('textbox', { name: 'Description' }))
    await expectRing(page, panel(page).getByRole('button', { name: 'Save changes' }))
  })

  test.fixme('TODO W0-7: the panel inside a SplitView (Escape and scrim through the close guard, the phone Back arrow) and inside a Sheet (requestClose through the ref). The gallery has no such host for this panel; the wrapper unit tests cover them', async () => {})
  test.fixme('TODO W0-7: the navigation slot in a narrow panel (container under 640px). The gallery has no narrow nav panel', async () => {})
})

// ───────────────────────── section nav ─────────────────────────

test.describe('section nav', () => {
  const list = page => page.getByRole('navigation', { name: 'Store sections', exact: true })

  test('list: every enabled row is a Tab stop, the current one is aria-current, a disabled row is skipped', async ({ page }) => {
    await open(page, 'section-nav')
    await expect(list(page).getByRole('button', { name: 'Opening hours' })).toHaveAttribute('aria-current', 'page')
    await tabTo(page, list(page).getByRole('button', { name: 'Basic information' }))
    for (const name of ['Opening hours', 'Delivery', 'Taxes']) {
      await page.keyboard.press('Tab')
      await expect(list(page).getByRole('button', { name: new RegExp(name) })).toBeFocused()
    }
    await expect(list(page).getByRole('button', { name: 'Payments' })).toBeDisabled()
  })

  test('arrows, Home and End move the focus without activating, and skip the disabled row', async ({ page }) => {
    await open(page, 'section-nav')
    const rows = list(page).getByRole('button')
    await tabTo(page, list(page).getByRole('button', { name: 'Basic information' }))
    await page.keyboard.press('ArrowDown')
    await expect(list(page).getByRole('button', { name: 'Opening hours' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(list(page).getByRole('button', { name: /Delivery/ })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(list(page).getByRole('button', { name: /Taxes/ })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(list(page).getByRole('button', { name: /Taxes/ })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(list(page).getByRole('button', { name: 'Basic information' })).toBeFocused()
    await page.keyboard.press('End')
    await expect(list(page).getByRole('button', { name: /Taxes/ })).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(list(page).getByRole('button', { name: /Delivery/ })).toBeFocused()
    // Moving the focus changed nothing: the current section is still «Opening hours».
    await expect(rows.and(page.locator('[aria-current="page"]'))).toHaveCount(1)
    await expect(list(page).getByRole('button', { name: 'Opening hours' })).toHaveAttribute('aria-current', 'page')
  })

  test('Enter and Space choose a section', async ({ page }) => {
    await open(page, 'section-nav')
    const basic = list(page).getByRole('button', { name: 'Basic information' })
    await basic.focus()
    await page.keyboard.press('Enter')
    await expect(basic).toHaveAttribute('aria-current', 'page')
    await expect(list(page).getByRole('button', { name: 'Opening hours' })).not.toHaveAttribute('aria-current', 'page')
    const taxes = list(page).getByRole('button', { name: /Taxes/ })
    await taxes.focus()
    await page.keyboard.press('Space')
    await expect(taxes).toHaveAttribute('aria-current', 'page')
  })

  test('the count has its own name and the group headings label their lists', async ({ page }) => {
    await open(page, 'section-nav')
    await expect(list(page).getByRole('button', { name: /Delivery/ })).toContainText('3 items need attention')
    await expect(list(page).getByRole('list', { name: 'Store' })).toBeVisible()
    await expect(list(page).getByRole('list', { name: 'Operation' })).toBeVisible()
  })

  test('focus is visible', async ({ page }) => {
    await open(page, 'section-nav')
    await expectRing(page, list(page).getByRole('button', { name: 'Basic information' }))
  })

  test.describe('touch phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test('under 600px of container and 768px of viewport the list is one selector: Enter opens it, choosing changes the section, Escape gives the focus back', async ({ page }) => {
      await open(page, 'section-nav')
      const narrow = page.getByRole('navigation', { name: 'Store sections, narrow' })
      await expect(narrow.locator('xpath=..')).toHaveAttribute('data-mode', 'selector')
      const trigger = narrow.getByRole('button', { name: /Section/ })
      await expect(trigger).toHaveAccessibleName('Section Opening hours')
      await trigger.focus()
      await page.keyboard.press('Enter')
      const menu = page.getByRole('menu')
      await expect(menu).toBeVisible()
      await expect(menu.getByRole('menuitemradio', { name: /Opening hours/ })).toHaveAttribute('aria-checked', 'true')
      await expect(menu.getByRole('menuitemradio', { name: /Payments/ })).toHaveAttribute('aria-disabled', 'true')
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
      await expect(trigger).toBeFocused()
      await trigger.tap()
      await page.getByRole('menuitemradio', { name: /Basic information/ }).tap()
      await expect(trigger).toHaveAccessibleName('Section Basic information')
    })

    test.fixme('TODO W0-7: size of the selector trigger and of the list rows on a phone or a coarse pointer. The notes say «phone rows 44 visible (stacked)» but a phone only ever shows the selector; nobody has stated which target must measure what', async () => {})
  })
})

// ───────────────────────── date picker ─────────────────────────

test.describe('date picker', () => {
  const picker = (page, name) => page.getByRole('combobox', { name: new RegExp(`^${name}`) })
  const activeDay = page => page.evaluate(() => document.activeElement?.getAttribute('data-day') ?? null)

  test('the trigger is named by the label and its value, shows the project format, never ISO', async ({ page }) => {
    await open(page, 'date-picker')
    await expect(picker(page, 'Delivery date')).toHaveAccessibleName('Delivery date 15/03/2026')
    await expect(picker(page, 'Pickup date')).toHaveAccessibleName('Pickup date dd/mm/yyyy')
    await expect(picker(page, 'Pickup date')).toHaveAttribute('data-empty', '')
    await expect(picker(page, 'Snooze until')).toHaveAttribute('data-invalid', '')
    await expect(picker(page, 'Closing date')).toBeDisabled()
    await expect(picker(page, 'Report date')).toHaveAccessibleName('Report date 03/15/2026')
  })

  test('keyboard: Enter opens on the chosen day, arrows and Page keys move, Enter chooses, closes and gives the focus back', async ({ page }) => {
    await open(page, 'date-picker')
    const trigger = picker(page, 'Delivery date')
    await tabTo(page, trigger)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Choose a date' })
    await expect(dialog).toBeVisible()
    expect(await activeDay(page)).toBe('2026-03-15')
    await page.keyboard.press('ArrowRight')
    expect(await activeDay(page)).toBe('2026-03-16')
    await page.keyboard.press('ArrowDown')
    expect(await activeDay(page)).toBe('2026-03-23')
    await page.keyboard.press('ArrowUp')
    expect(await activeDay(page)).toBe('2026-03-16')
    await page.keyboard.press('PageDown')
    expect(await activeDay(page)).toBe('2026-04-16')
    await page.keyboard.press('PageUp')
    expect(await activeDay(page)).toBe('2026-03-16')
    // Home and End are the first and the last cell of the week row, whichever weekday the locale starts on.
    await page.keyboard.press('Home')
    expect(await page.evaluate(() => !document.activeElement.closest('td').previousElementSibling)).toBe(true)
    await page.keyboard.press('End')
    expect(await page.evaluate(() => !document.activeElement.closest('td').nextElementSibling)).toBe(true)
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    await expect(trigger).not.toHaveAccessibleName('Delivery date 15/03/2026')
  })

  test('Escape closes only the picker and gives the focus back to the trigger', async ({ page }) => {
    await open(page, 'date-picker')
    const trigger = picker(page, 'Delivery date')
    await trigger.focus()
    await page.keyboard.press('Space')
    await expect(page.getByRole('dialog', { name: 'Choose a date' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Choose a date' })).toBeHidden()
    await expect(trigger).toBeFocused()
    await expect(trigger).toHaveAccessibleName('Delivery date 15/03/2026')
  })

  test('typed field: a real date is taken as typed, an impossible one and an out-of-range one say why', async ({ page }) => {
    await open(page, 'date-picker')
    await picker(page, 'Event date').focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Choose a date' })
    const field = dialog.getByRole('textbox', { name: 'Event date' })
    await field.fill('31022026')
    await expect(dialog.getByRole('alert')).toHaveText('Enter a real date as dd/mm/yyyy.')
    await field.fill('25032026')
    await expect(dialog.getByRole('alert')).toHaveText('That date is not available.')
    await field.fill('12032026')
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(picker(page, 'Event date')).toHaveAccessibleName('Event date 12/03/2026')
  })

  test('min and max: a day outside is aria-disabled, can hold the focus and cannot be chosen; the month before is blocked', async ({ page }) => {
    await open(page, 'date-picker')
    const trigger = picker(page, 'Event date')
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Choose a date' })
    await expect(dialog.getByText('March 2026')).toBeVisible()
    const early = dialog.locator('[data-day="2026-03-09"]')
    await expect(early).toHaveAttribute('aria-disabled', 'true')
    await early.focus()
    await expect(early).toBeFocused()
    await early.click({ force: true })
    await expect(dialog).toBeVisible()
    await expect(trigger).toHaveAccessibleName('Event date dd/mm/yyyy')
    await expect(dialog.getByRole('button', { name: 'Previous month' })).toHaveAttribute('aria-disabled', 'true')
    await dialog.locator('[data-day="2026-03-15"]').click()
    await expect(dialog).toBeHidden()
    await expect(trigger).toHaveAccessibleName('Event date 15/03/2026')
  })

  test('clearable, Monday first, MM/DD/YYYY: «Clear date» empties the value and closes', async ({ page }) => {
    await open(page, 'date-picker')
    const trigger = picker(page, 'Report date')
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Choose a date' })
    await expect(dialog.getByRole('columnheader').first()).toHaveAttribute('abbr', 'Monday')
    await dialog.getByRole('button', { name: 'Clear date' }).click()
    await expect(dialog).toBeHidden()
    await expect(trigger).toHaveAccessibleName('Report date mm/dd/yyyy')
  })

  test('focus is visible on the trigger and on a day', async ({ page }) => {
    await open(page, 'date-picker')
    await expectRing(page, picker(page, 'Delivery date'))
    await picker(page, 'Delivery date').press('Enter')
    // The popover opens with the focus on the chosen day, by keyboard: read its ring as it is. (A Tab from the last stop of the
    // popover now closes it, T0-29, so the helper that presses Tab first would detach the day.)
    const day = page.locator('[data-day="2026-03-15"]')
    await expect(day).toBeFocused()
    expect(await day.evaluate(node => ({ visible: node.matches(':focus-visible'), style: getComputedStyle(node).outlineStyle, width: parseFloat(getComputedStyle(node).outlineWidth) })))
      .toMatchObject({ visible: true, width: expect.any(Number) })
    expect(await day.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none')
  })

  test('open picker has no serious axe violations, light and dark', async ({ page }) => {
    for (const theme of ['light', 'dark']) {
      await open(page, 'date-picker', `&theme=${theme}`)
      await picker(page, 'Delivery date').click()
      await expect(page.getByRole('dialog', { name: 'Choose a date' })).toBeVisible()
      expect(await seriousViolations(page, ['[data-testid="section-date-picker"]', '[role="dialog"]'])).toEqual([])
    }
  })

  test.describe('touch phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test('each trigger hits at ±21px of its centre', async ({ page }) => {
      await open(page, 'date-picker')
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      for (const name of ['Delivery date', 'Pickup date', 'Snooze until', 'Event date', 'Report date']) {
        expect.soft(await missedPoints(picker(page, name)), name).toEqual([])
      }
    })

    test('under 768px it opens as a bottom sheet with 44px days; Escape closes it and the focus returns', async ({ page }) => {
      await open(page, 'date-picker')
      const trigger = picker(page, 'Delivery date')
      await trigger.tap()
      const sheet = page.getByRole('dialog', { name: 'Choose a date' })
      await expect(sheet).toBeVisible()
      // Notes of the implementer: the days are 44px visible, contiguous; the typed field is 32px visible with its 44px area on its frame (redesign tramo B r3, W0-QB2-02).
      for (const day of ['2026-03-15', '2026-03-16', '2026-03-31']) {
        const { width, height } = await size(sheet.locator(`[data-day="${day}"]`))
        expect(width, day).toBeGreaterThanOrEqual(44)
        expect(height, day).toBeGreaterThanOrEqual(44)
      }
      await page.keyboard.press('Escape')
      await expect(sheet).toBeHidden()
      await expect(trigger).toBeFocused()
    })
  })
})

// ───────────────────────── legacy fields ─────────────────────────

test.describe('legacy fields', () => {
  test('ImageField: a named group with its hint, the buttons carry the object, remove empties the preview', async ({ page }) => {
    await open(page, 'legacy-fields')
    const group = page.getByRole('group', { name: 'Logo' })
    await expect(group).toHaveAccessibleDescription('A square image, at least 300 by 300 pixels.')
    await expect(group.getByRole('img', { name: 'Current logo' })).toBeVisible()
    await expect(group.getByRole('button', { name: 'Change logo' })).toHaveAccessibleDescription('A square image, at least 300 by 300 pixels.')
    await tabTo(page, group.getByRole('button', { name: 'Change logo' }))
    await page.keyboard.press('Tab')
    await expect(group.getByRole('button', { name: 'Remove logo' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(group.getByRole('img', { name: 'Current logo' })).toHaveCount(0)
    await expect(group.getByRole('button', { name: 'Remove logo' })).toHaveCount(0)
    const cover = page.getByRole('group', { name: /^Cover photo/ })
    await expect(cover).toHaveAccessibleDescription('Add a cover photo.')
    await expect(cover.getByRole('alert')).toHaveText('Add a cover photo.')
    await expect(cover.getByText('Required', { exact: true })).toHaveClass(/odc-sr-only/)
  })

  test('ImageField: a picked file opens the crop dialog and Escape gives the focus back to «Change logo»', async ({ page }) => {
    await open(page, 'legacy-fields')
    const change = page.getByRole('group', { name: 'Logo' }).getByRole('button', { name: 'Change logo' })
    // A 1×1 PNG.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    await page.getByRole('group', { name: 'Logo' }).locator('input[type="file"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png })
    const dialog = page.getByRole('dialog', { name: 'Crop the logo' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(change).toBeFocused()
  })

  test('ColorField: the trigger is named by label and value, the value is text beside the swatch, the error describes it', async ({ page }) => {
    await open(page, 'legacy-fields')
    const brand = page.locator('.odc-color-field').filter({ hasText: 'Brand color' })
    await expect(brand.locator('.od-color-picker-trigger')).toHaveAccessibleName('Brand color #2C7BE5')
    await expect(brand.locator('.odc-color-field-value')).toHaveText('#2C7BE5')
    await expect(brand.locator('.od-color-picker-trigger')).toHaveAccessibleDescription('Used for buttons in your storefront.')
    const accent = page.locator('.odc-color-field').filter({ hasText: 'Accent color' })
    await expect(accent.locator('.odc-color-field-value')).toHaveText('#FFFFFF')
    await expect(accent.getByRole('alert')).toHaveText('White does not show on a white page.')
    await expect(accent.locator('.od-color-picker-trigger')).toHaveAccessibleDescription('White does not show on a white page.')
  })

  test('ColorField: Tab reaches the trigger, Enter opens the picker, Escape closes it and gives the focus back', async ({ page }) => {
    await open(page, 'legacy-fields')
    const trigger = page.locator('.odc-color-field').filter({ hasText: 'Brand color' }).locator('.od-color-picker-trigger')
    await tabTo(page, trigger)
    await page.keyboard.press('Enter')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.od-color-picker-panel')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('.od-color-picker-panel')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('PhoneField: the label names the number input, hint, required and error are linked to it, disabled is disabled', async ({ page }) => {
    await open(page, 'legacy-fields')
    const phone = page.getByRole('textbox', { name: 'Phone number' })
    await expect(phone).toHaveAccessibleDescription('Include the country code.')
    await expect(page.getByRole('textbox', { name: 'Mobile phone Required' }).or(page.getByRole('textbox', { name: /^Mobile phone/ }))).toHaveAttribute('aria-required', 'true')
    const backup = page.getByRole('textbox', { name: 'Backup phone' })
    await expect(backup).toHaveAttribute('aria-invalid', 'true')
    await expect(backup).toHaveAccessibleDescription('Add a phone number we can call.')
    await expect(page.getByRole('textbox', { name: 'Store phone' })).toBeDisabled()
  })

  test('PhoneField: Tab goes country then number, and typing changes the number', async ({ page }) => {
    await open(page, 'legacy-fields')
    const phone = page.getByRole('textbox', { name: 'Phone number' })
    await tabTo(page, phone)
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('+12025550123')
    await expect(phone).toHaveValue('+1 202 555 0123')
  })

  test('focus is visible on the buttons and on the phone number', async ({ page }) => {
    await open(page, 'legacy-fields')
    await expectRing(page, page.getByRole('group', { name: 'Logo' }).getByRole('button', { name: 'Change logo' }), 'Change logo')
    await expectRing(page, page.getByRole('textbox', { name: 'Phone number' }), 'Phone number')
  })

  test.describe('touch phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test('the image buttons are 44px visible', async ({ page }) => {
      await open(page, 'legacy-fields')
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const group = page.getByRole('group', { name: 'Logo' })
      for (const name of ['Change logo', 'Remove logo']) {
        expect((await size(group.getByRole('button', { name }))).height, name).toBeGreaterThanOrEqual(44)
      }
    })

    // redesign tramo B r3 (W0-QB2-02, parity L-4): the wrapper does size the phone field (the box is 32px, its 44px area is on the box, see
    // «tramo B r3»); what has no stated number is the ColorField trigger inside its 32px box and the country select inside the phone box
    test.fixme('TODO W0-7: size of the ColorField trigger and of the PhoneField country select on a phone. Nobody has stated a number for them; the phone field itself is 32px visible with a 44px area on its box, see «tramo B r3»', async () => {})
  })

  test.fixme('TODO W0-7: a disabled ColorField (the legacy ColorPicker opens its panel on mount when isDisabled: M-14). Left out of the gallery on purpose', async () => {})
})

// ───────────────────────── tramo B, round 2 (decision 40): QB1-03 … QB1-13 ─────────────────────────

test.describe('tramo B r2', () => {
  test('QB1-04: a native select and a DatePicker inside Field are named, described, invalid and required; the label focuses them', async ({ page }) => {
    await open(page, 'fields')
    const select = page.getByRole('combobox', { name: 'Order type' })
    await expect(select).toHaveAccessibleDescription('Field frames a control that names itself.')
    await page.getByText('Order type', { exact: true }).first().click()
    await expect(select).toBeFocused()

    const start = page.getByRole('combobox', { name: /^Start date/ })
    await expect(start).toHaveAttribute('aria-invalid', 'true')
    await expect(start).toHaveAttribute('aria-required', 'true')
    await expect(start).toHaveAccessibleDescription('The promotion starts at midnight. Choose a start date.')
    await page.locator('.odc-field-label', { hasText: 'Start date' }).click()
    await expect(start).toBeFocused()
    await expect(start).toHaveAttribute('aria-expanded', 'false')
    // not colour alone: a thicker border drawn inside, and the error text with its icon
    expect(await start.evaluate(node => getComputedStyle(node).boxShadow)).not.toBe('none')
    await expect(page.getByRole('alert').filter({ hasText: 'Choose a start date.' })).toBeVisible()
  })

  test('QB1-07: Pagination has a polite live region that announces the new page', async ({ page }) => {
    await open(page, 'pagination')
    const foot = page.getByRole('navigation', { name: 'Orders pages' })
    const live = foot.locator('[aria-live="polite"]')
    await expect(live).toHaveText('Page 4 of 13')
    await foot.getByRole('button', { name: 'Next page' }).click()
    await expect(live).toHaveText('Page 5 of 13')
  })

  test('QB1-08: each PhoneField names its country selector with its own text', async ({ page }) => {
    await open(page, 'legacy-fields')
    for (const name of ['Phone number country', 'Mobile phone country', 'Backup phone country', 'Store phone country']) {
      await expect(page.getByRole('combobox', { name })).toHaveCount(1)
    }
  })

  test('QB1-11: min and max open the calendar on the first selectable day', async ({ page }) => {
    await open(page, 'date-picker')
    await page.getByRole('combobox', { name: /^Event date/ }).press('Enter')
    await expect(page.locator('[data-day="2026-03-10"]')).toBeFocused()
  })

  for (const width of [390, 320]) {
    test.describe(`touch ${width}`, () => {
      test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })

      test('QB1-13: no W0-7 section overflows the page sideways', async ({ page }) => {
        for (const section of SECTIONS) {
          await open(page, section)
          const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
          expect.soft(overflow.scroll, `${section}: scrollWidth ${overflow.scroll} > ${overflow.client}`).toBeLessThanOrEqual(overflow.client)
        }
      })

      test('QB1-03: the page title keeps a legible width; QB1-09: every button of the row is 44px wide and high', async ({ page }) => {
        await open(page, 'page-header')
        const head = page.locator('.odc-pagehead').first()
        const title = head.getByRole('heading', { level: 1, name: 'Orders' })
        expect((await size(title)).width, 'title width').toBeGreaterThanOrEqual(60)
        expect(await title.evaluate(node => node.scrollWidth <= node.clientWidth + 1 || getComputedStyle(node).textOverflow === 'ellipsis')).toBe(true)
        expect(await head.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        for (const button of await head.locator('.odc-btn').all()) {
          const { width, height } = await size(button)
          expect.soft(width, `${await button.innerText() || await button.getAttribute('aria-label')} width`).toBeGreaterThanOrEqual(44)
          expect.soft(height, 'height').toBeGreaterThanOrEqual(44)
        }
      })

      // redesign tramo B r3 (W0-QB2-02): 32px visible, 44px area on the box; the number and the country cover it except the 6px above and below
      test('QB2-02: the phone number field is 32px visible and its 44px area is on its box', async ({ page }) => {
        await open(page, 'legacy-fields')
        const height = await tokenPx(page, '--od-x-control-height')
        const box = page.locator('.odc-phone-field .PhoneInput').first()
        expect((await size(box)).height).toBe(height)
        const number = page.getByRole('textbox', { name: 'Phone number' })
        expect((await size(number)).height).toBeLessThanOrEqual(height)
        expect(await missedFramePoints(number)).toEqual([])
        const rect = await box.boundingBox()
        await page.touchscreen.tap(rect.x + rect.width / 2, rect.y - 4)
        await expect(number).toBeFocused()
      })

      test('QB2-02: the ColorField trigger and the phone field of a form measure the same box height', async ({ page }) => {
        await open(page, 'legacy-fields')
        const heights = await page.evaluate(() => [
          document.querySelector('.odc-color-field-control'),
          document.querySelector('.odc-phone-field .PhoneInput')
        ].map(node => Math.round(node.getBoundingClientRect().height)))
        expect(heights[0]).toBe(heights[1])
      })

      test('QB2-02: the typed field of the DatePicker sheet is 32px visible with its area on its frame', async ({ page }) => {
        await open(page, 'date-picker')
        await page.getByRole('combobox', { name: /^Delivery date/ }).tap()
        const sheet = page.getByRole('dialog', { name: 'Choose a date' })
        await expect(sheet).toBeVisible()
        const input = sheet.getByRole('textbox')
        expect((await size(input)).height).toBe(await tokenPx(page, '--od-x-control-height'))
        expect(await missedFramePoints(input)).toEqual([])
        // redesign tramo B r4 (W0-PB3-02): the field and the month row (Previous month, Next month, Today) are >= 12px apart (their areas, 6 + 8px, do not cross)
        const gap = await sheet.evaluate(root => {
          const frameBottom = root.querySelector('.odc-dp-input-frame').getBoundingClientRect().bottom
          const tops = [...root.querySelectorAll('.odc-dr-cal-head button')].map(button => button.getBoundingClientRect().top)
          return Math.min(...tops) - frameBottom
        })
        expect(gap).toBeGreaterThanOrEqual(14)
      })

      test('QB1-10: in a narrow RecordPanel the close area and the section selector do not cross', async ({ page }) => {
        await open(page, 'record-panel')
        const panel = page.getByTestId('record-panel-nav-demo')
        expect.soft(await missedPoints(panel.getByRole('button', { name: 'Close sections panel' })), 'close').toEqual([])
        expect.soft(await missedPoints(panel.locator('.odc-record-nav button, .odc-record-nav [role="combobox"]').first()), 'selector').toEqual([])
      })
    })
  }

  test('QB1-12: the legacy fields are painted before axe runs (the ready wait measures nodes)', async ({ page }) => {
    await open(page, 'legacy-fields')
    expect(await page.locator('[data-testid="section-legacy-fields"] .odc-phone-field input.PhoneInputInput').count()).toBe(4)
    await seriousViolations(page, '[data-testid="section-legacy-fields"]')
    expect(measured.nodes).toBeGreaterThan(50)
  })
})

// ───────────────────────── tramo B closing polish ─────────────────────────
// redesign tramo B cierre: the three layout/touch fixes that the fourth review round left open, measured in a real browser at the
// widths of a phone.

for (const width of [390, 375, 320]) {
  test.describe(`tramo B cierre · touch ${width}`, () => {
    test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })

    // W0-QB4-02: `actions` given as a node, with text buttons (Learn, Export, Import, the primary): the group wraps onto more lines
    // instead of leaving its container. When the group drops to its own line is not touched (W0-D-10).
    test('QB4-02: a header whose actions are text buttons does not overflow its container or the page', async ({ page }) => {
      await open(page, 'page-header')
      const doc = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(doc, 'document').toBeLessThanOrEqual(0)
      for (const id of ['page-header-text-actions', 'page-header-text-actions-back']) {
        const result = await page.getByTestId(id).locator('.odc-pagehead').evaluate(head => {
          const box = head.getBoundingClientRect()
          const group = head.querySelector('.odc-pagehead-actions')
          const buttons = [...group.children].map(node => node.getBoundingClientRect())
          return {
            container: head.scrollWidth - head.clientWidth,
            groupSideways: Math.max(0, group.getBoundingClientRect().right - box.right, box.left - group.getBoundingClientRect().left),
            buttonSideways: Math.max(0, ...buttons.map(rect => Math.max(rect.right - box.right, box.left - rect.left))),
            lines: new Set(buttons.map(rect => Math.round(rect.top))).size
          }
        })
        expect(result.container, `${id} container`).toBeLessThanOrEqual(0)
        expect(result.groupSideways, `${id} group`).toBeLessThanOrEqual(0.5)
        expect(result.buttonSideways, `${id} buttons`).toBeLessThanOrEqual(0.5)
        expect(result.lines, `${id} lines`).toBeGreaterThan(1) // the four buttons do not fit one line at a phone's width: they wrap
      }
    })

    // W0-QB4-05: «Previous page» and «Next page» are one item of the pager: they wrap together, on the same line, side by side.
    test('QB4-05: Previous page and Next page stay together, on the same line, in every footer', async ({ page }) => {
      for (const dir of ['', '&dir=rtl']) {
        await open(page, 'pagination', dir)
        const feet = await page.locator('.odc-pagination').evaluateAll(navs => navs.map(nav => {
          const previous = nav.querySelector('button[aria-label="Previous page"]').getBoundingClientRect()
          const next = nav.querySelector('button[aria-label="Next page"]').getBoundingClientRect()
          return { name: nav.getAttribute('aria-label'), tops: Math.abs(previous.top - next.top), gap: Math.max(previous.left, next.left) - Math.min(previous.right, next.right) }
        }))
        expect(feet.length).toBeGreaterThanOrEqual(5)
        for (const foot of feet) {
          expect(foot.tops, `${dir || 'ltr'} ${foot.name}: same line`).toBeLessThanOrEqual(1)
          expect(foot.gap, `${dir || 'ltr'} ${foot.name}: side by side`).toBeLessThanOrEqual(8)
        }
      }
    })

    // W0-PB3-02: REAL touches (the touch adjustment of Chromium moves a touch to the nearest node that answers to touches, which
    // elementFromPoint cannot see). 1 to 6px under the typed field, at its corners, its edges and its centre: no month change.
    test('PB3-02: touches 1 to 6px under the typed field of the sheet never change the month', async ({ page }) => {
      await open(page, 'date-picker')
      await page.getByRole('combobox', { name: /^Delivery date/ }).tap()
      const sheet = page.getByRole('dialog', { name: 'Choose a date' })
      await expect(sheet).toBeVisible()
      await page.waitForTimeout(400) // the sheet slides in: measure it still
      const frame = await sheet.locator('.odc-dp-input-frame').boundingBox()
      const gap = await sheet.evaluate(root => {
        const bottom = root.querySelector('.odc-dp-input-frame').getBoundingClientRect().bottom
        return Math.min(...[...root.querySelectorAll('.odc-dr-cal-head button')].map(button => button.getBoundingClientRect().top)) - bottom
      })
      expect(gap, 'field to month row').toBeGreaterThanOrEqual(26)
      const month = () => sheet.locator('.odc-dr-cal-head').innerText()
      const before = await month()
      const changed = []
      let taps = 0
      for (const dy of [1, 2, 3, 4, 5, 6]) {
        for (const dx of [2, 20, frame.width / 2, frame.width - 20, frame.width - 2]) {
          taps++
          await page.touchscreen.tap(frame.x + dx, frame.y + frame.height + dy)
          if (await month() !== before) { changed.push([Math.round(dx), dy]); break }
        }
        if (changed.length) break
      }
      expect(taps).toBeGreaterThan(0)
      expect(changed, 'touches that changed the month').toEqual([])
    })

    // redesign W0-E-14 (decision 12): the month row (Previous, Next, Today), the days and «Done» of the Date range sheet do not cross
    // their 44×44 areas. REAL touches 1 to 6px outside each control toward its neighbour: the neighbour is never activated.
    test('E-14: touches 1 to 6px outside Next month, Go to today, the last row of days and Done never press the neighbour', async ({ page }) => {
      test.setTimeout(120000)
      // October 2026 ends on Saturday: the Sunday-first calendar gives us seven day targets in its last row.
      await page.clock.setFixedTime('2026-10-15T12:00:00Z')
      await open(page, 'date-range')
      const trigger = page.locator('.odc-dr-trigger').nth(1) // the second demo holds the range: «Done» is in the sheet
      const sheet = page.locator('.odc-dr-sheet')
      const listen = () => page.evaluate(() => { window.__clicks = []; document.addEventListener('click', event => { const button = event.target.closest('button'); window.__clicks.push(button ? (button.getAttribute('aria-label') || button.textContent.trim()) : '') }, true) })
      // A press on «Done» (or the close button) closes the sheet: let it leave, open it again and let it stop sliding.
      const reopen = async () => {
        if (await trigger.getAttribute('aria-expanded') === 'true') return
        await page.waitForTimeout(700)
        await trigger.tap()
        await expect(sheet).toBeVisible()
        await listen()
        await page.waitForTimeout(900)
      }
      await trigger.tap()
      await sheet.waitFor()
      await listen()
      await page.waitForTimeout(900) // the sheet slides in: measure it still
      const rect = (selector) => sheet.locator(selector).first().boundingBox()
      const tapped = async (x, y) => { await page.evaluate(() => { window.__clicks = [] }); await page.touchscreen.tap(x, y); await page.waitForTimeout(40); return page.evaluate(() => window.__clicks.slice()) }
      const names = { next: '[aria-label="Next month"]', today: '[aria-label="Go to today"]' }
      const wrong = []
      let taps = 0
      for (const [from, side, label] of [['next', 1, 'Go to today'], ['today', -1, 'Next month']]) {
        for (const d of [1, 2, 3, 4, 5, 6]) {
          await reopen()
          const box = await rect(`.odc-dr-cal-head ${names[from]}`)
          taps++
          const clicks = await tapped(side > 0 ? box.x + box.width + d : box.x - d, box.y + box.height / 2)
          if (clicks.includes(label)) wrong.push(`${from} + ${d}px pressed ${label}`)
        }
      }
      for (const d of [1, 2, 3, 4, 5, 6]) {
        await reopen()
        const cells = await sheet.locator('.odc-dr-day').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height } }))
        const bottom = Math.max(...cells.map(cell => cell.y))
        const lastRow = cells.filter(item => Math.abs(item.y - bottom) < 1)
        expect(lastRow, 'last-row day targets').toHaveLength(7)
        for (const cell of lastRow) {
          taps++
          const clicks = await tapped(cell.x + cell.width / 2, cell.y + cell.height + d)
          if (clicks.includes('Done')) { wrong.push(`last row day at ${Math.round(cell.x)} + ${d}px pressed Done`); await reopen(); break } // one is enough: each press closes the sheet
          await reopen()
        }
        const done = await rect('.odc-dr-foot button')
        taps++
        const clicks = await tapped(done.x + done.width / 2, done.y - d)
        if (clicks.some(label => label && label !== 'Done')) wrong.push(`Done - ${d}px pressed ${clicks.join()}`)
      }
      expect(taps).toBeGreaterThanOrEqual(60)
      expect(wrong, 'touches that pressed the neighbour').toEqual([])
    })

    test('E-14: next to today, and the last row of days to Done, leave the areas apart', async ({ page }) => {
      await open(page, 'date-range')
      await page.locator('.odc-dr-trigger').nth(1).tap()
      const sheet = page.locator('.odc-dr-sheet')
      await sheet.waitFor()
      await page.waitForTimeout(900)
      const gaps = await sheet.evaluate(root => {
        const box = (selector) => root.querySelector(selector).getBoundingClientRect()
        const next = box('[aria-label="Next month"]')
        const today = box('[aria-label="Go to today"]')
        const days = [...root.querySelectorAll('.odc-dr-day')].map(node => node.getBoundingClientRect())
        const done = box('.odc-dr-foot button')
        return { sideways: today.left - next.right, daysToDone: done.top - Math.max(...days.map(day => day.bottom)), dayWidth: Math.min(...days.map(day => day.width)), dayHeight: Math.min(...days.map(day => day.height)) }
      })
      // Next month's area reaches 8px past it; the strip beyond it is 12px (a touch goes to the nearest area): 8 + 12.
      expect(gaps.sideways, 'Next month to Today').toBeGreaterThanOrEqual(20)
      // Done's area reaches 6px above it; 12px of dead strip over the 6.
      expect(gaps.daysToDone, 'last row of days to Done').toBeGreaterThanOrEqual(18)
      expect(gaps.dayHeight, 'day height').toBeGreaterThanOrEqual(44)
      expect(gaps.dayWidth, 'day width').toBeGreaterThanOrEqual(44)
    })
  })
}

// ───────────────────────── ─────────────────────────
// redesign a 390px window with a MOUSE (no touch emulation: the pointer is fine, so only the width query applies). The
// presets and the From / To inputs of the Date range sheet measured 32px with no ::after; their 44px boxes were under
// `(pointer: coarse)` only. Every consumer of P/DateRangePopover (Period of Invoice and of Reports, ...) draws these nodes.
test.describe('· date range at 390px with a mouse', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the presets and the From / To inputs reach 44px, as the days do', async ({ page }) => {
    await open(page, 'date-range')
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches), 'a fine pointer: only the width query applies').toBe(false)
    await page.locator('.odc-dr-trigger').first().click()
    const sheet = page.locator('.odc-dr-sheet')
    await sheet.waitFor()
    await page.waitForTimeout(900) // the sheet slides in: measure it still
    const heights = await sheet.evaluate(root => {
      // The visible box, or the 44px area of its pseudo-element when it is a loose control (inset from the token, as P/Button).
      const height = (node) => {
        const box = node.getBoundingClientRect().height
        const after = getComputedStyle(node, '::after')
        const area = after.content !== 'none' && after.position === 'absolute' ? parseFloat(after.height) : 0
        return Math.max(box, area)
      }
      const measure = (selector) => [...root.querySelectorAll(selector)].map(node => ({ selector, height: height(node) }))
      return [...measure('.odc-dr-preset'), ...measure('.odc-dr-input'), ...measure('.odc-dr-day')]
    })
    expect(heights.filter(item => item.selector === '.odc-dr-preset').length, 'presets measured').toBeGreaterThanOrEqual(5)
    expect(heights.filter(item => item.selector === '.odc-dr-input').length, 'inputs measured').toBe(2)
    expect(heights.filter(item => item.height < 44), 'targets under 44px').toEqual([])
  })
})
