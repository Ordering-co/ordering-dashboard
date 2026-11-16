import { test, expect, fixtureUrl } from './fixtures'
import { tokens } from '../../src/brand/ordering.tokens.generated'

const receipts = page => page.evaluate(() => globalThis.__OD_PROFILE_RECEIPTS__ || [])
const byKind = async (page, kind) => (await receipts(page)).filter(value => value.kind === kind)
// redesign the legacy locators (More info, p:has-text rows, the heading's sibling button) are gone with the legacy components
const profileImage = page => page.locator('.odc-profile-avatar img')
const profileInitials = page => page.locator('.odc-profile-avatar .odc-avatar-initials')
// the opener is «Open menu» since J5 row 56 (page-header-menu-opener P-1, 2e771480c)
const menuAction = page => page.getByRole('button', { name: 'Open menu', exact: true })
const sessionRows = page => page.locator('[data-slot="profile-session"]')
const rowDate = (row, label) => row.locator('.odc-profile-session-date').filter({ hasText: label }).locator('time')
// the ✕ of the current session is «Log out this browser (session started …)»; the others keep «Log out the session started …»
const signOutRow = (page, index) => sessionRows(page).nth(index).getByRole('button', { name: /^Log out (the session started|this browser)/ })
const sessionsCard = page => page.locator('[data-slot="profile-sessions"]')
const confirmDialog = page => page.getByRole('alertdialog')
const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`
const contrast = (first, second) => {
  const luminance = color => color.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
// redesign the Product buttons paint color-mix()/color() values; a 1px canvas turns any CSS color into sRGB bytes
const effectiveColors = locator => locator.evaluate(element => {
  const toRgb = value => {
    const context = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3)
  }
  let current = element
  let background = getComputedStyle(current).backgroundColor
  while (current.parentElement && ['transparent', 'rgba(0, 0, 0, 0)'].includes(background)) {
    current = current.parentElement
    background = getComputedStyle(current).backgroundColor
  }
  return { background: toRgb(background), foreground: toRgb(getComputedStyle(element).color) }
})
const focusByKeyboard = async (page, target) => {
  for (let index = 0; index < 80 && !await target.evaluate(element => element === document.activeElement); index += 1) await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
}

// redesign (D1 A): the page is one column of cards: h1 «Profile», account, Google Calendar (level 8) and sessions.
test('profile preserves level 8, photo/initials, phone in bdi, Google callback and same-mount session updates', async ({ page }) => { // redesign
  await page.goto(fixtureUrl('surface=profile-sessions&view=profile&mode=light&level=8&photo=1'))
  await expect(page.getByRole('heading', { level: 1, name: 'Profile', exact: true })).toBeVisible()
  await expect(page.locator('.odc-profile-name')).toHaveText('Professional Profile With A Long Fixture Name Example')
  await expect(page.locator('.odc-profile-tag')).toHaveText('Professional') // D5: the role next to the name
  await expect(page.getByText('professional@example.com', { exact: true })).toBeVisible()
  const phone = page.locator('.odc-profile-line bdi')
  await expect(phone).toHaveText('+1 555 0100')
  await expect(phone).toHaveAttribute('dir', 'ltr')
  const image = profileImage(page)
  await expect(image).toHaveJSProperty('complete', true)
  expect(await image.evaluate(element => element.naturalWidth)).toBeGreaterThan(0)
  await expect(profileInitials(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: 'Google Calendar', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Sync with Google calendar$/ }).click()
  await expect.poll(async () => (await byKind(page, 'google-link')).length).toBe(1)
  expect(await byKind(page, 'google-link')).toEqual([{ kind: 'google-link', payload: { args: [] } }])
  expect(await page.evaluate(() => globalThis.__OD_PROFILE_USER_DETAILS__)).toEqual({ userId: 81 })
  await expect(page.getByText(/Your browser blocked the Google window/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Toggle profile photo', exact: true }).click()
  await expect(profileImage(page)).toHaveCount(0)
  await expect(profileInitials(page)).toHaveText('PE') // first letter of the first and last word of the name
  await page.getByRole('button', { name: 'Toggle cellphone', exact: true }).click()
  await expect(phone).toHaveCount(0)
  await page.getByRole('button', { name: 'Toggle session strategy', exact: true }).click()
  await expect(page.getByText(/You don't have enabled the sessions/)).toBeVisible()
  await page.getByRole('button', { name: 'Toggle professional level', exact: true }).click()
  await expect(page.getByRole('button', { name: /Sync with Google calendar$/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: 'Google Calendar', exact: true })).toHaveCount(0)
  await expect(page.locator('.odc-profile-tag')).toHaveText('Administrator')
})

test('a blocked Google window shows the notice on every press', async ({ page }) => { // redesign (B1-2)
  await page.goto(fixtureUrl('surface=profile-sessions&view=profile&mode=light&level=8&popup=blocked'))
  await page.getByRole('button', { name: /Sync with Google calendar$/ }).click()
  await expect(page.getByText(/Your browser blocked the Google window/)).toBeVisible()
  await page.getByRole('button', { name: /Sync with Google calendar$/ }).click()
  await expect.poll(async () => (await byKind(page, 'google-link')).length).toBe(2)
  await expect(page.getByText(/Your browser blocked the Google window/)).toBeVisible()
})

test('sessions are sorted newest first without touching the source, mark the current one and ask for the project date format', async ({ page }) => { // redesign (D2, PF-01, PF-05)
  await page.goto(fixtureUrl('surface=profile-sessions&view=sessions&mode=light&strategy=jwt'))
  await expect(sessionsCard(page).getByRole('heading', { level: 2, name: 'Sessions', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'More info', exact: true })).toHaveCount(0) // D2: the list lives in the card
  await expect(sessionRows(page)).toHaveCount(3)
  await expect(rowDate(sessionRows(page).nth(0), 'Started')).toHaveText('DATE:2026-09-03 10:00:00')
  await expect(rowDate(sessionRows(page).nth(1), 'Started')).toHaveText('DATE:2026-09-02 09:00:00')
  await expect(rowDate(sessionRows(page).nth(2), 'Started')).toHaveText('DATE:2026-09-01 08:00:00')
  await expect(rowDate(sessionRows(page).nth(0), 'Expires')).toHaveText('DATE:2026-10-03 10:00:00')
  await expect(sessionRows(page).nth(0)).toHaveAttribute('data-current', 'true')
  await expect(page.getByText('This browser', { exact: true })).toHaveCount(1)
  await expect(sessionRows(page).nth(0).getByText('This browser', { exact: true })).toBeVisible()
  await expect(page.locator('.odc-profile-summary')).toHaveText('3 signed-in sessions')
  expect(await page.evaluate(() => globalThis.__OD_PROFILE_SESSION_SOURCE__.map(session => session.id))).toEqual([11, 13, 12]) // PF-05: never sorted in place
  // PF-01: no hard-coded output format; the project's own comes from parseDate
  const calls = await byKind(page, 'parse-date')
  expect(calls.length).toBeGreaterThanOrEqual(6)
  for (const call of calls) expect(call.payload.options).toEqual({})
  const nav = page.getByRole('navigation', { name: 'Sessions pages', exact: true })
  await expect(nav).toContainText('1–3 of 3')
})

test('twenty-five sessions are paginated by ten, newest first, with the current one marked on its page', async ({ page }) => { // redesign (D2)
  await page.goto(fixtureUrl('surface=profile-sessions&view=sessions&mode=light&strategy=jwt&count=25'))
  const nav = page.getByRole('navigation', { name: 'Sessions pages', exact: true })
  await expect(sessionRows(page)).toHaveCount(10)
  await expect(rowDate(sessionRows(page).first(), 'Started')).toHaveText('DATE:2026-09-25 10:00:00')
  await expect(rowDate(sessionRows(page).last(), 'Started')).toHaveText('DATE:2026-09-16 10:00:00')
  await expect(nav).toContainText('1–10 of 25')
  await expect(page.locator('.odc-profile-summary')).toHaveText('25 signed-in sessions')
  await expect(page.locator('[data-slot="profile-session"][data-current="true"]')).toHaveCount(1) // the 20th, on this page
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(nav).toContainText('11–20 of 25')
  await expect(rowDate(sessionRows(page).first(), 'Started')).toHaveText('DATE:2026-09-15 10:00:00')
  await expect(page.locator('[data-slot="profile-session"][data-current="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(nav).toContainText('21–25 of 25')
  await expect(sessionRows(page)).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page.getByRole('spinbutton', { name: 'Page', exact: true }).or(page.getByRole('textbox', { name: 'Page', exact: true })).fill('2')
  await page.keyboard.press('Enter')
  await expect(nav).toContainText('11–20 of 25')
  expect(await page.evaluate(() => globalThis.__OD_PROFILE_SESSION_SOURCE__.map(session => session.id).slice(0, 3))).toEqual([101, 102, 103]) // the source keeps its order
})

test('sign out asks first: Cancel focused, Escape and the scrim cancel, only the button confirms, with bulk true/false', async ({ page }) => { // redesign (D3, D4)
  await page.goto(fixtureUrl('surface=profile-sessions&view=sessions&mode=light&strategy=jwt'))
  // the current session first: the dialog says it signs you out and the focus starts on Cancel
  await signOutRow(page, 0).click()
  let confirm = confirmDialog(page)
  await expect(confirm).toContainText('Log out this browser?')
  await expect(confirm).toContainText('You will go back to the sign-in page.')
  await expect(confirm.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(confirm).toHaveCount(0)
  await signOutRow(page, 0).click()
  await expect(confirmDialog(page)).toBeVisible()
  await page.mouse.click(2, 2) // the scrim cancels
  await expect(confirmDialog(page)).toHaveCount(0)
  expect(await byKind(page, 'delete-session')).toEqual([])
  await signOutRow(page, 0).click()
  await confirmDialog(page).getByRole('button', { name: 'Log out', exact: true }).click()
  await expect.poll(async () => (await byKind(page, 'delete-session')).length).toBe(1)
  expect(await byKind(page, 'delete-session')).toEqual([{ kind: 'delete-session', payload: { id: 13, sameReference: true } }])

  // another session: the object in the title, the date in the body, the verb in the button
  await signOutRow(page, 1).click()
  confirm = confirmDialog(page)
  await expect(confirm).toContainText('Log out this session?')
  await expect(confirm).toContainText('DATE:2026-09-02 09:00:00')
  await confirm.getByRole('button', { name: 'Log out session', exact: true }).click()
  await expect.poll(async () => (await byKind(page, 'delete-session')).length).toBe(2)
  expect((await byKind(page, 'delete-session'))[1].payload).toEqual({ id: 12, sameReference: true })

  await page.getByRole('button', { name: 'Log out everywhere', exact: true }).click()
  confirm = confirmDialog(page)
  await expect(confirm).toContainText('Log out everywhere?')
  await expect(confirm).toContainText('All your sessions end, this one too.')
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(confirmDialog(page)).toHaveCount(0)
  expect(await byKind(page, 'delete-all')).toEqual([])
  await page.getByRole('button', { name: 'Log out other sessions', exact: true }).click()
  confirm = confirmDialog(page)
  await expect(confirm).toContainText('Log out 2 other sessions?')
  await confirm.getByRole('button', { name: 'Log out other sessions', exact: true }).click()
  await page.getByRole('button', { name: 'Log out everywhere', exact: true }).click()
  await confirmDialog(page).getByRole('button', { name: 'Log out everywhere', exact: true }).click()
  await expect.poll(async () => (await byKind(page, 'delete-all')).length).toBe(2)
  expect(await byKind(page, 'delete-all')).toEqual([
    { kind: 'delete-all', payload: { deleteCurrent: false } },
    { kind: 'delete-all', payload: { deleteCurrent: true } }
  ])
})

test('with only the current session «Log out other sessions» is off and «Log out everywhere» stays on', async ({ page }) => { // redesign (D3)
  await page.goto(fixtureUrl('surface=profile-sessions&view=sessions&mode=light&strategy=jwt&state=current'))
  await expect(sessionRows(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Log out other sessions', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Log out everywhere', exact: true })).toBeEnabled()
  await expect(page.locator('.odc-profile-summary')).toHaveText('1 signed-in session')
})

test('old, loading, empty, read error, action loading and action error states preserve controls and dialogs', async ({ page }) => { // redesign (D7)
  await page.goto(fixtureUrl('surface=profile-sessions&view=sessions&mode=light&strategy=old'))
  await expect(page.getByText(/You don't have enabled the sessions/)).toBeVisible()
  await page.getByRole('button', { name: 'Active sessions', exact: true }).click()
  const confirm = confirmDialog(page)
  await expect(confirm).toContainText('Are you sure to enable all sessions?')
  await confirm.getByRole('button', { name: 'Active sessions', exact: true }).click()
  await expect.poll(async () => (await byKind(page, 'delete-all')).length).toBe(1)
  expect(await byKind(page, 'delete-all')).toEqual([{ kind: 'delete-all', payload: { deleteCurrent: false } }])

  await page.goto(fixtureUrl('surface=profile-sessions&view=sessions&mode=light&state=loading'))
  await expect(page.locator('[data-slot="profile-session-skeleton"]')).toHaveCount(5)
  await expect(page.locator('.odc-profile-sessions-loading')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('button', { name: 'Log out everywhere', exact: true })).toHaveCount(0)
  await page.goto(fixtureUrl('surface=profile-sessions&view=sessions&mode=light&state=empty'))
  await expect(page.getByText("You don't have any sessions", { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log out everywhere', exact: true })).toHaveCount(0)

  // D7 (PF-02): a failed read is not «no sessions»; it offers Try again
  await page.goto(fixtureUrl('surface=profile-sessions&view=sessions&mode=light&state=error'))
  await expect(page.getByText('We couldn\'t load your sessions', { exact: true })).toBeVisible()
  await expect(page.getByText("You don't have any sessions", { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect.poll(async () => (await byKind(page, 'reload-sessions')).length).toBe(1)

  await page.goto(fixtureUrl('surface=profile-sessions&view=sessions&mode=light&actionLoading=1'))
  await expect(page.getByRole('button', { name: 'Log out other sessions', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Log out everywhere', exact: true })).toBeDisabled()
  await expect(signOutRow(page, 0)).toBeDisabled()
  await page.goto(fixtureUrl('surface=profile-sessions&view=sessions&mode=light&actionError=1'))
  const alert = confirmDialog(page)
  await expect(alert).toContainText('Fixture session action error')
  await alert.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(alert).toHaveCount(0)
})

test('profile menu is absent by default and collapsed state forwards false exactly once', async ({ page }) => { // redesign (h1 «Profile» is the PageHeader title)
  await page.goto(fixtureUrl('surface=profile-sessions&view=profile&mode=light'))
  await expect(page.getByRole('heading', { level: 1, name: 'Profile', exact: true })).toBeVisible()
  await expect(menuAction(page)).toHaveCount(0)
  await page.goto(fixtureUrl('surface=profile-sessions&view=profile&mode=light&collapsed=1'))
  await menuAction(page).click()
  await expect(page.getByTestId('profile-collapse-state')).toHaveText('false')
  await expect(page.getByTestId('profile-collapse-calls')).toHaveText('[false]')
})

for (const mode of ['light', 'dark']) {
  test(`profile and sessions keep readable ${mode} text, initials fallback and visible keyboard focus`, async ({ page }, testInfo) => { // redesign (no tooltip: D6)
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.goto(fixtureUrl(`surface=profile-sessions&view=profile&mode=${mode}&level=8&cell=0`))
    const profile = page.locator('[data-slot="profile-page"]')
    const google = profile.getByRole('button', { name: /Sync with Google calendar$/ })
    await expect(profileInitials(page)).toHaveText('PE')
    await expect(profile.getByRole('button', { name: 'Information', exact: true })).toHaveCount(0) // D6: the (i) is gone, the text is visible
    await expect(profile.locator('[data-slot="profile-info"]')).toHaveCount(0)
    for (const target of [
      page.getByText('professional@example.com', { exact: true }),
      page.locator('.odc-profile-tag'),
      page.locator('.odc-profile-google-text'),
      page.locator('.odc-profile-session-date').first(),
      page.locator('.odc-profile-session-label').first(),
      google,
      page.getByRole('button', { name: 'Log out everywhere', exact: true })
    ]) {
      const colors = await effectiveColors(target)
      expect.soft(contrast(colors.foreground, colors.background), await target.evaluate(element => `${element.className} ${element.textContent.trim().slice(0, 40)}`)).toBeGreaterThanOrEqual(4.5)
    }
    await page.evaluate(() => document.activeElement?.blur())
    await focusByKeyboard(page, google)
    const focus = await google.evaluate(element => {
      const style = getComputedStyle(element)
      return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), outlineColor: style.outlineColor, boxShadow: style.boxShadow }
    })
    expect(focus.outlineStyle, JSON.stringify(focus)).not.toBe('none')
    expect(focus.outlineWidth, JSON.stringify(focus)).toBeGreaterThan(0)
    expect(focus.outlineColor, JSON.stringify(focus)).toBe(rgb(tokens.theme[mode].semantic.action.focus))
    await page.screenshot({ path: testInfo.outputPath(`profile-sessions-${mode}.png`), fullPage: false })
  })
}

for (const width of [320, 390]) {
  test.describe(`profile sessions at ${width}px coarse pointer`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    test('RTL controls are 32px visible with a 44px hit area (probed at ±21px) and the confirmation fits', async ({ page }, testInfo) => { // redesign (decision 12)
      await page.goto(fixtureUrl('surface=profile-sessions&view=profile&mode=dark&rtl=true&locale=ar&level=8&count=12&strategy=jwt'))
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      const profile = page.locator('[data-slot="profile-page"]')
      await expect(profile).toBeVisible()
      await expect(sessionRows(page)).toHaveCount(10)
      // Google, 10 sign-out rows, the two group actions and Previous/Next (Previous is disabled on page 1)
      expect(await profile.locator('button:enabled').count()).toBeGreaterThanOrEqual(13)
      await page.screenshot({ path: testInfo.outputPath(`profile-sessions-${width}-before.png`) })
      const failures = []
      for (const control of await profile.locator('button:enabled').all()) {
        await control.evaluate(element => element.scrollIntoView({ block: 'center' }))
        const result = await control.evaluate(element => {
          const rect = element.getBoundingClientRect()
          const cx = rect.x + rect.width / 2
          const cy = rect.y + rect.height / 2
          const owns = (x, y) => { const hit = document.elementFromPoint(x, y); return hit === element || element.contains(hit) }
          return {
            label: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 40),
            x: rect.x,
            right: rect.right,
            width: rect.width,
            height: rect.height,
            center: owns(cx, cy),
            up: owns(cx, cy - 21),
            down: owns(cx, cy + 21),
            start: owns(cx - 21, cy),
            end: owns(cx + 21, cy)
          }
        })
        if (result.x < 0 || result.right > width) failures.push(`outside viewport ${JSON.stringify(result)}`)
        if (result.height < 28) failures.push(`visible height ${result.height} ${result.label}`) // Product sm is 28, md 32
        if (!(result.center && result.up && result.down && result.start && result.end)) failures.push(`hit area ${JSON.stringify(result)}`)
      }
      expect(failures, failures.join('\n')).toEqual([])
      // the visible boxes of the owned row controls are 32 (the 44px lives in the hit area, not the box)
      const rowButton = await sessionRows(page).nth(0).locator('button').boundingBox()
      expect(rowButton.width).toBeGreaterThanOrEqual(32)
      expect(rowButton.height).toBeGreaterThanOrEqual(32)

      const everywhere = page.locator('.odc-profile-actions > .odc-btn').last() // the label is in Arabic here
      await everywhere.evaluate(element => element.scrollIntoView({ block: 'center' }))
      await everywhere.click()
      const dialog = page.locator('.odc-dialog')
      await expect(dialog).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      await dialog.locator('.odc-overlay-foot button').first().click() // Cancel, the first of the two
      await expect(dialog).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`profile-sessions-${width}-after.png`) })
    })
  })
}

test('profile and its confirmation portal share one font even when the tenant theme names a serif', async ({ page }) => { // redesign Product surfaces read --od-font-sans (the Ordering Inter), no longer theme.fonts.primary
  await page.goto(fixtureUrl('surface=profile-sessions&view=profile&mode=dark&level=8&font=serif&strategy=jwt'))
  const profile = page.locator('[data-slot="profile-page"]')
  const pageFont = await profile.evaluate(element => getComputedStyle(element).fontFamily)
  expect(pageFont).toContain('Ordering Inter Local')
  await page.getByRole('button', { name: 'Log out everywhere', exact: true }).click()
  const popup = confirmDialog(page)
  await expect(popup).toBeVisible()
  await expect(popup).toHaveCSS('font-family', pageFont)
  const colors = await effectiveColors(popup)
  expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)
})

for (const width of [320, 390]) {
  test.describe(`profile phone at ${width}px`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true })
    test('phone retains its numeric reading order inside RTL content', async ({ page }, testInfo) => { // redesign (the phone is a <bdi dir="ltr"> in the account card)
      await page.goto(fixtureUrl('surface=profile-sessions&view=profile&mode=dark&rtl=true&locale=ar&level=8'))
      const phone = page.locator('.odc-profile-line bdi')
      await expect(phone).toHaveText('+1 555 0100')
      await expect(phone).toHaveAttribute('dir', 'ltr')
      await phone.scrollIntoViewIfNeeded()
      const positions = await phone.evaluate(element => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        let node = walker.nextNode()
        while (node && !node.textContent.includes('+1 555 0100')) node = walker.nextNode()
        const first = document.createRange()
        first.setStart(node, 0)
        first.setEnd(node, 1)
        const last = document.createRange()
        last.setStart(node, node.textContent.length - 1)
        last.setEnd(node, node.textContent.length)
        return { first: first.getBoundingClientRect().x, last: last.getBoundingClientRect().x }
      })
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`profile-phone-${width}.png`), fullPage: false })
      expect(positions.first, JSON.stringify(positions)).toBeLessThan(positions.last)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
  })
}
