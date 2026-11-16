// redesign stores 5.18: the shared Product pieces that the store editor's wave 5 found wrong outside its lots, measured
// in a real browser (computed styles and boxes jsdom cannot give). Each probe is plain markup with the pieces' classes, mounted in
// an `.odc-root` of the gallery page, so the test reads exactly what product CSS paints. Runs with `pnpm ui:test:browser`.
import { expect, test } from '@playwright/test'

const GALLERY = '/scripts/product-ui/gallery.html'

const open = async (page, { width = 1440, height = 900 } = {}) => {
  await page.setViewportSize({ width, height })
  await page.goto(GALLERY)
  await page.getByRole('heading', { name: 'Product wrappers' }).waitFor()
  await page.evaluate(() => document.fonts.ready)
}

// The first load of the gallery compiles it: once, with room, so no test pays for it.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(180000)
  const page = await browser.newPage()
  await page.goto(GALLERY)
  await page.getByRole('heading', { name: 'Product wrappers' }).waitFor({ timeout: 170000 })
  await page.close()
})

// Mounts `html` in a fresh `.odc-root` probe at the top of the page and answers its node's id.
const probe = (page, html) => page.evaluate(markup => {
  document.getElementById('wave5-probe')?.remove()
  const root = document.createElement('div')
  root.id = 'wave5-probe'
  root.className = 'odc-root'
  root.innerHTML = markup
  document.body.prepend(root)
}, html)

test.describe('P/Button · a disabled button looks off in every variant', () => {
  for (const variant of ['ghost', 'link', 'danger']) {
    test(`${variant}: disabled takes the subtle text colour, as secondary does`, async ({ page }) => {
      await open(page)
      await probe(page, `
        <button class="odc-btn" data-variant="secondary" data-size="md" disabled id="off-secondary">Remove</button>
        <button class="odc-btn" data-variant="${variant}" data-size="md" id="on">Remove</button>
        <button class="odc-btn" data-variant="${variant}" data-size="md" disabled id="off">Remove</button>
        <button class="odc-btn" data-variant="${variant}" data-size="md" aria-disabled="true" id="aria-off">Remove</button>`)
      const colors = await page.evaluate(() => Object.fromEntries(['off-secondary', 'on', 'off', 'aria-off'].map(id => {
        const style = getComputedStyle(document.getElementById(id))
        return [id, { color: style.color, background: style.backgroundColor, filter: style.filter }]
      })))
      expect(colors.off.color).toBe(colors['off-secondary'].color)
      expect(colors['aria-off'].color).toBe(colors['off-secondary'].color)
      expect(colors.off.color).not.toBe(colors.on.color)
      // hovering a disabled button changes nothing
      await page.locator('#off').hover()
      const hovered = await page.evaluate(() => {
        const style = getComputedStyle(document.getElementById('off'))
        return { color: style.color, background: style.backgroundColor, filter: style.filter }
      })
      expect(hovered).toEqual(colors.off)
    })
  }

  test('ghost and link stay without a fill when disabled; danger loses its strong fill', async ({ page }) => {
    await open(page)
    await probe(page, `
      <button class="odc-btn" data-variant="ghost" disabled id="ghost">A</button>
      <button class="odc-btn" data-variant="link" disabled id="link">B</button>
      <button class="odc-btn" data-variant="danger" id="danger-on">C</button>
      <button class="odc-btn" data-variant="danger" disabled id="danger">C</button>
      <button class="odc-btn" data-variant="primary" disabled id="primary">D</button>`)
    const style = await page.evaluate(() => Object.fromEntries(['ghost', 'link', 'danger-on', 'danger', 'primary'].map(id => {
      const css = getComputedStyle(document.getElementById(id))
      return [id, { background: css.backgroundColor, border: css.borderTopColor }]
    })))
    expect(style.ghost.background).toBe('rgba(0, 0, 0, 0)')
    expect(style.link.background).toBe('rgba(0, 0, 0, 0)')
    expect(style.danger.background).not.toBe(style['danger-on'].background)
    expect(style.danger).toEqual(style.primary)
  })
})

test.describe('P/SegmentedControl · the hidden measuring copy gives no width to the flow', () => {
  for (const width of [1440, 390]) {
    test(`at ${width}, a narrow scroller holding a control with long labels does not scroll sideways`, async ({ page }) => {
      await open(page, { width })
      await page.goto(`${GALLERY}?section=segmented-narrow`)
      const box = page.getByTestId('narrow-seg')
      await expect(box.getByRole('combobox', { name: 'Show' })).toBeVisible()
      // the box becomes the scroller the control lives in (the store editor's panel at 390, a card…)
      const facts = await box.evaluate(node => {
        node.style.overflow = 'auto'
        const measure = node.querySelector('.odc-seg-measure')
        return { scroll: node.scrollWidth, client: node.clientWidth, natural: measure.offsetWidth }
      })
      // the copy is still as wide as the options need (that is how the control knows it does not fit)…
      expect(facts.natural).toBeGreaterThan(facts.client)
      // …and the scroller does not grow with it
      expect(facts.scroll).toBeLessThanOrEqual(facts.client)
    })
  }
})

// The dashboard loads Bootstrap 4 globally (`label { display: inline-block; margin-bottom: .5rem }`); the gallery does not. The probe
// adds that rule, as the dashboard has it, and reads the space between the label and the box.
const BOOTSTRAP_LABEL = 'label { display: inline-block; margin-bottom: .5rem; }'

test.describe('P/Field · the global label margin of Bootstrap does not reach the field family', () => {
  // the legacy frame's sheet comes with its lazy pieces: its gallery section loads it
  for (const [name, frame, label, section] of [['Field', 'odc-field', 'odc-field-label', 'fields'], ['legacy field frame', 'odc-legacy-field', 'odc-legacy-field-label', 'legacy-fields']]) {
    test(`${name}: the label sits at the family's own gap from the box`, async ({ page }) => {
      await open(page)
      await page.goto(`${GALLERY}?section=${section}`)
      await page.locator(`.${frame}`).first().waitFor()
      await page.addStyleTag({ content: BOOTSTRAP_LABEL })
      await probe(page, `
        <div class="${frame}" id="frame">
          <label class="${label}" for="slug"><span>Slug</span></label>
          <input id="slug" class="odc-field-input" value="fast-bite" />
        </div>`)
      const facts = await page.evaluate(() => {
        const frame = document.getElementById('frame')
        const label = frame.querySelector('label')
        const input = frame.querySelector('input')
        return {
          margin: getComputedStyle(label).marginBottom,
          gap: Math.round(input.getBoundingClientRect().top - label.getBoundingClientRect().bottom),
          rowGap: Math.round(parseFloat(getComputedStyle(frame).rowGap) || 0)
        }
      })
      expect(facts.margin).toBe('0px')
      expect(facts.gap).toBe(facts.rowGap)
    })
  }
})

// F7 of 5.11 and m3 of 5.13: at 390 the bar has two rows (≈100px) and covered the field being typed in.
test.describe('P/SaveBar · the field being typed in stays above the sticky bar', () => {
  const fieldAndBar = (page, name) => page.evaluate(label => {
    const input = [...document.querySelectorAll('[data-testid="savebar-scroller"] input')].find(node => node.labels?.[0]?.textContent.includes(label))
    const bar = document.querySelector('[data-testid="savebar-scroller"] .odc-savebar')
    const field = input.getBoundingClientRect()
    return { fieldTop: field.top, fieldBottom: field.bottom, barTop: bar ? bar.getBoundingClientRect().top : null, focused: document.activeElement === input }
  }, name)

  for (const width of [390, 1440]) {
    test(`at ${width}: the bar appears with the first keystroke and the field stays in view above it`, async ({ page }) => {
      await open(page, { width })
      await page.goto(`${GALLERY}?section=save-bar-reveal`)
      const scroller = page.getByTestId('savebar-scroller')
      await scroller.waitFor()
      // the last field just above the foot of the scroller, where the bar is about to appear
      await scroller.evaluate(node => { node.scrollTop = node.scrollHeight })
      const notes = scroller.getByRole('textbox', { name: 'Notes' })
      await notes.click()
      await page.keyboard.type('Ring twice')
      await expect(scroller.locator('.odc-savebar')).toBeVisible()
      await expect.poll(async () => {
        const facts = await fieldAndBar(page, 'Notes')
        return facts.focused && facts.fieldBottom <= facts.barTop
      }).toBe(true)
    })

    test(`at ${width}: with the bar shown, moving the focus to a field under it brings that field above it`, async ({ page }) => {
      await open(page, { width })
      await page.goto(`${GALLERY}?section=save-bar-reveal`)
      const scroller = page.getByTestId('savebar-scroller')
      await scroller.waitFor()
      await scroller.getByRole('textbox', { name: 'Name' }).fill('Ana')
      await expect(scroller.locator('.odc-savebar')).toBeVisible()
      // scroll so «Website» sits under the bar (the bar is stuck: «Notes» and the bar's own place are still below), then reach it
      // from the keyboard
      await scroller.evaluate(node => {
        const input = [...node.querySelectorAll('input')].find(field => field.labels?.[0]?.textContent.includes('Website'))
        const bar = node.querySelector('.odc-savebar')
        node.scrollTop += input.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom + 4
      })
      const before = await fieldAndBar(page, 'Website')
      expect(before.fieldBottom).toBeGreaterThan(before.barTop)
      await scroller.getByRole('textbox', { name: 'Company' }).evaluate(node => node.focus({ preventScroll: true }))
      await page.keyboard.press('Tab')
      await expect.poll(async () => {
        const facts = await fieldAndBar(page, 'Website')
        return facts.focused && facts.fieldBottom <= facts.barTop
      }).toBe(true)
    })
  }
})

// From 5.13: the title link of the card was `flex: none`, so a long name pushed the card past a 390 panel. An order number (one word)
// must keep its width; a name breaks into lines inside the card.
test.describe('P/RecordCard · the title link stays inside the card at 390', () => {
  const card = (title, status) => `
    <div class="odc-order-cards" style="margin-inline: 0">
      <ul class="odc-order-card-list">
        <li class="odc-order-card" id="card">
          <div class="odc-order-card-top">
            <a class="odc-mono odc-order-card-link" href="#" id="link">${title}</a>
            <span class="odc-order-card-status" id="status">${status}</span>
          </div>
        </li>
      </ul>
    </div>`

  test('a long name wraps inside the card, which does not grow', async ({ page }) => {
    await open(page, { width: 390 })
    await probe(page, card('<span style="overflow-wrap: anywhere">Service fee for the northern district on weekends and holidays</span>', 'Fixed'))
    const facts = await page.evaluate(() => {
      const card = document.getElementById('card')
      const link = document.getElementById('link')
      return { cardScroll: card.scrollWidth, cardClient: card.clientWidth, linkRight: link.getBoundingClientRect().right, cardRight: card.getBoundingClientRect().right }
    })
    expect(facts.cardScroll).toBeLessThanOrEqual(facts.cardClient)
    expect(facts.linkRight).toBeLessThanOrEqual(facts.cardRight)
  })

  test('an order number keeps its whole width next to a long status (the status wraps, as before)', async ({ page }) => {
    await open(page, { width: 390 })
    await probe(page, card('#1234567', 'Driver almost arrived to the business and is waiting for the order'))
    const facts = await page.evaluate(() => {
      const link = document.getElementById('link')
      return { scroll: link.scrollWidth, client: link.clientWidth, height: link.getBoundingClientRect().height, status: document.getElementById('status').getBoundingClientRect().height }
    })
    expect(facts.scroll).toBeLessThanOrEqual(facts.client)
    expect(facts.status).toBeGreaterThan(facts.height)
  })
})
