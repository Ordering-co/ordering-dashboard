// redesign 5.1 copy: labels in sentence case (C14), approved with the catalog sync on 2026-10-06.
import { test, expect } from './fixtures'

// Reach and layering of the real SidebarMenu next to the real Orders table styles.
// Entry: scripts/brand-system/harness/shell-sidebar-reach.html (own entry; the shared
// registry in main.jsx is not touched). `surface=shell-navigation` selects the
// synthetic shell language contract the harness resolves for SidebarMenu.
const entry = '/scripts/brand-system/harness/shell-sidebar-reach.html?surface=shell-navigation&mode=light&role=0'
const sidebar = page => page.locator('#side_bar')
const OPEN = { name: 'Open navigation', exact: true }

const openNavigation = async page => {
  const nav = sidebar(page)
  // On a phone width the shell starts collapsed; on desktop it starts open.
  if (!await nav.evaluate(element => !element.hasAttribute('data-collapsed'))) {
    await page.getByRole('button', OPEN).click()
  }
  await expect(nav).not.toHaveAttribute('data-collapsed')
  await page.waitForTimeout(450) // the open transition
}

// Every top-level entry of the administrator menu (collapsed submenu links are not entries), then the
// footer. redesign 5.1: the menu is grouped (Shared/SideBar/SidebarNav.jsx), AI agents moved into the
// Grow group, and the footer is one account row whose menu holds profile, Help and Logout.
const topMenuPattern = /^(Home|Orders|Delivery|Schools|Stores|My products|My website|Marketing|Users|Reports|AI agents|Connect|Apps & add-ons|Billing|Settings|Logs audit)$/
const navigationEntries = page => sidebar(page).locator('[data-testid="sidebar-scroll-content"] :is(button, a)').filter({ hasText: topMenuPattern }).filter({ visible: true })
  .or(sidebar(page).locator('#user_info button'))

const reachState = entryLocator => entryLocator.evaluate(element => {
  const rect = element.getBoundingClientRect()
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  const top = document.elementFromPoint(centerX, centerY)
  return {
    name: (element.textContent || '').replace(/\s+/g, ' ').trim(),
    inViewport: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight,
    top: top ? `${top.tagName}.${String(top.className).slice(0, 50)}` : null,
    topIsEntry: Boolean(top && element.contains(top))
  }
})

for (const [width, height] of [[1440, 900], [1440, 700], [390, 844]]) {
  test(`every sidebar entry can be scrolled into view and nothing covers it at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(entry)
    await openNavigation(page)
    const entries = navigationEntries(page)
    const count = await entries.count()
    // redesign 5.1: 15 top-level entries for the administrator (Home, Orders, Delivery, Schools,
    // Stores, My products, My website, Marketing, Users, Reports, AI agents, Connect, Apps & add-ons,
    // Billing, Settings or Logs audit as the harness role allows) + the one account row.
    expect(count).toBe(16)
    const failures = []
    for (let index = 0; index < count; index += 1) {
      const item = entries.nth(index)
      await item.scrollIntoViewIfNeeded()
      const state = await reachState(item)
      if (!state.inViewport || !state.topIsEntry) failures.push(state)
    }
    expect(failures, `entries that cannot be reached or are covered at ${width}x${height}`).toEqual([])
  })
}

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test('the open menu paints above the page, sticky table header and column trigger included', async ({ page }) => {
    await page.goto(entry)
    await expect(page.getByRole('button', { name: 'Manage columns', exact: true })).toBeVisible()
    await openNavigation(page)
    const nav = sidebar(page)
    const navBox = await nav.boundingBox()
    // Probe the whole menu area, and the exact point where the page's column trigger sits.
    const trigger = await page.getByRole('button', { name: 'Manage columns', exact: true }).boundingBox()
    const probes = [
      [trigger.x + trigger.width / 2, trigger.y + trigger.height / 2],
      [navBox.x + 10, navBox.y + 10],
      [navBox.x + navBox.width / 2, navBox.y + navBox.height / 2],
      [navBox.x + navBox.width - 10, navBox.y + navBox.height - 10]
    ]
    // The column trigger must really sit inside the menu area, otherwise the probe proves nothing.
    expect(trigger.x).toBeGreaterThanOrEqual(navBox.x)
    expect(trigger.x + trigger.width).toBeLessThanOrEqual(navBox.x + navBox.width)
    expect(trigger.y + trigger.height).toBeLessThanOrEqual(navBox.y + navBox.height)
    const covered = []
    for (const [x, y] of probes) {
      const owner = await page.evaluate(([px, py]) => {
        const element = document.elementFromPoint(px, py)
        return { inMenu: Boolean(element?.closest('#side_bar')), element: element ? `${element.tagName}.${String(element.className).slice(0, 50)}` : null }
      }, [x, y])
      if (!owner.inMenu) covered.push({ x, y, ...owner })
    }
    expect(covered, 'points of the open menu that the page paints over').toEqual([])
  })
})
