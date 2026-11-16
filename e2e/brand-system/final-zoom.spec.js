import { writeFile } from 'node:fs/promises'
import { test, expect, fixtureUrl } from './fixtures'

const viewportMetrics = page => page.evaluate(() => ({
  coarse: matchMedia('(pointer: coarse)').matches,
  cssZoom: getComputedStyle(document.documentElement).zoom,
  devicePixelRatio,
  innerHeight,
  innerWidth,
  visualHeight: visualViewport?.height ?? innerHeight,
  visualOffsetLeft: visualViewport?.offsetLeft ?? 0,
  visualOffsetTop: visualViewport?.offsetTop ?? 0,
  visualScale: visualViewport?.scale ?? 1,
  visualWidth: visualViewport?.width ?? innerWidth
}))

const applyCompositorScale = async (page, scale) => {
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: scale })
  await expect.poll(async () => (await viewportMetrics(page)).visualScale).toBeCloseTo(scale, 1)
  return session
}

const applyTouchPinch = async (page, scaleFactor) => {
  const session = await page.context().newCDPSession(page)
  const viewport = page.viewportSize()
  await session.send('Input.synthesizePinchGesture', {
    x: Math.round(viewport.width / 2),
    y: Math.round(viewport.height / 2),
    scaleFactor,
    relativeSpeed: 800,
    gestureSourceType: 'touch'
  })
  await expect.poll(async () => (await viewportMetrics(page)).visualScale).toBeCloseTo(scaleFactor, 1)
  return session
}

const expectVisuallyReachable = async (page, locator) => {
  for (let index = 0; index < 200 && !await locator.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(locator).toBeFocused()
  await expect.poll(() => locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const viewport = window.visualViewport
    const left = viewport?.offsetLeft ?? 0
    const top = viewport?.offsetTop ?? 0
    const right = left + (viewport?.width ?? innerWidth)
    const bottom = top + (viewport?.height ?? innerHeight)
    const scale = viewport?.scale ?? 1
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    return centerX >= left && centerX <= right && centerY >= top && centerY <= bottom &&
      (Math.min(rect.right, right) - Math.max(rect.left, left)) * scale >= 44 &&
      (Math.min(rect.bottom, bottom) - Math.max(rect.top, top)) * scale >= 44
  })).toBe(true)
}

test('desktop Chromium compositor zoom changes visualViewport without CSS zoom and keeps closed controls reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(fixtureUrl('surface=buttons&mode=dark'))
  const before = await viewportMetrics(page)
  expect(before.visualScale).toBe(1)
  expect(before.cssZoom).toBe('1')
  await page.screenshot({ path: testInfo.outputPath('final-zoom-desktop-before.png') })

  const session = await applyCompositorScale(page, 2)
  const after = await viewportMetrics(page)
  expect(after.cssZoom).toBe('1')
  expect(after.visualWidth).toBeCloseTo(before.visualWidth / 2, 0)
  expect(after.devicePixelRatio).toBe(before.devicePixelRatio)
  await expectVisuallyReachable(page, page.getByTestId('button-long-label'))
  await expectVisuallyReachable(page, page.getByTestId('icon-primary'))
  await page.screenshot({ path: testInfo.outputPath('final-zoom-desktop-after.png') })
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 })
})

for (const width of [320, 390]) {
  test.describe(`native page-scale acceptance at ${width}px`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })

    test('a synthesized native touch pinch reaches scale 2 and keeps owned dialog controls reachable', async ({ page }, testInfo) => {
      await page.goto(fixtureUrl('surface=dialog-consumers&mode=light'))
      const before = await viewportMetrics(page)
      expect(before.coarse).toBe(true)
      expect(before.visualScale).toBe(1)
      expect(before.cssZoom).toBe('1')
      await page.getByRole('button', { name: 'Open primary dialog', exact: true }).click()
      const dialog = page.locator('.popup-dialog').filter({ has: page.getByText('Edit populated record', { exact: true }) })
      await expect(dialog).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath(`final-zoom-${width}-before.png`) })

      const session = await applyTouchPinch(page, 2)
      const after = await viewportMetrics(page)
      expect(after.coarse).toBe(true)
      expect(after.cssZoom).toBe('1')
      expect(after.visualWidth).toBeCloseTo(before.visualWidth / 2, 0)
      expect(after.visualHeight).toBeCloseTo(before.visualHeight / 2, 0)
      const keep = dialog.getByRole('button', { name: 'Keep changes', exact: true })
      const discard = dialog.getByRole('button', { name: 'Discard changes', exact: true })
      await expectVisuallyReachable(page, keep)
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('dialog-events')).toContainText('primary-accept')
      await expect(dialog).toBeVisible()
      await expectVisuallyReachable(page, discard)
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('dialog-events')).toContainText('primary-cancel')
      await expect(dialog).toBeVisible()
      await expectVisuallyReachable(page, dialog.locator('.modal-close-icon button'))
      await page.screenshot({ path: testInfo.outputPath(`final-zoom-${width}-after.png`) })

      const close = dialog.locator('.modal-close-icon button')
      const point = await close.evaluate(element => {
        const rect = element.getBoundingClientRect()
        const viewport = window.visualViewport
        const x = rect.x + rect.width / 2
        const y = rect.y + rect.height / 2
        window.__OD_ZOOM_CLOSE_EVENTS__ = []
        for (const type of ['pointerdown', 'touchstart', 'mousedown', 'pointerup', 'touchend', 'mouseup', 'click']) {
          document.addEventListener(type, event => {
            const contact = event.changedTouches?.[0] || event.touches?.[0] || event
            window.__OD_ZOOM_CLOSE_EVENTS__.push({
              type,
              matches: event.target.closest?.('button') === element,
              target: event.target.outerHTML?.slice(0, 300) || event.target.nodeName,
              clientX: contact.clientX,
              clientY: contact.clientY
            })
          }, { capture: true, once: true })
        }
        const hit = document.elementFromPoint(x, y)
        return {
          x,
          y,
          visualX: x - viewport.offsetLeft,
          visualY: y - viewport.offsetTop,
          hitMatches: hit?.closest?.('button') === element,
          hitTarget: hit?.outerHTML?.slice(0, 300),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          viewport: { left: viewport.offsetLeft, top: viewport.offsetTop, scale: viewport.scale, width: viewport.width, height: viewport.height, layoutWidth: innerWidth, layoutHeight: innerHeight }
        }
      })
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThan(point.viewport.layoutWidth)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThan(point.viewport.layoutHeight)
      expect(point.hitMatches, JSON.stringify(point)).toBe(true)
      await session.send('Input.synthesizeTapGesture', {
        x: Math.round(point.visualX),
        y: Math.round(point.visualY),
        duration: 100,
        gestureSourceType: 'touch'
      })
      await expect.poll(() => page.evaluate(() => window.__OD_ZOOM_CLOSE_EVENTS__.length)).toBeGreaterThan(0)
      const events = await page.evaluate(() => window.__OD_ZOOM_CLOSE_EVENTS__)
      await writeFile(testInfo.outputPath('touch-hit.json'), JSON.stringify({ point, events }, null, 2))
      expect(events.some(event => event.type === 'touchstart' && event.matches), JSON.stringify({ point, events })).toBe(true)
      expect(events.some(event => event.type === 'pointerdown' && event.matches), JSON.stringify({ point, events })).toBe(true)
      expect(events.some(event => event.type === 'click' && event.matches), JSON.stringify({ point, events })).toBe(true)
      await expect(dialog).not.toBeVisible()
      await writeFile(testInfo.outputPath('native-zoom.json'), JSON.stringify({ mechanism: 'CDP Input.synthesizePinchGesture followed by CDP Input.synthesizeTapGesture with touch input', coordinateSpace: 'the layout target center is translated by visualViewport offsets into its CSS-coordinate space; CDP applies the active page scale', before, after, closeTap: point, closeEvents: events }, null, 2))
      // Reset only: acceptance above comes from Input.synthesizePinchGesture.
      await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 })
    })
  })
}
