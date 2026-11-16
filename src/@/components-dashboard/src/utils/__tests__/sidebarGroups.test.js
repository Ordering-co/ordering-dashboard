import { describe, expect, it } from 'vitest'

import { canOpenDashboardRoute, getDashboardNavSections } from '../dashboardNavigation'
import { getCurrentSectionKey, getSidebarGroups } from '../sidebarGroups'

const admin = { level: 0, name: 'Ada', lastname: 'Admin', user_system_id: 7 }
// redesign (D1–D3, owner 2026-10-11): the sidebar no longer offers a section entry its route guard denies
// (M-06 Devices at 2, M-07 Messages at 5, M-11 Gift card manager at 5), so no mismatch is inherited any more.
const PROFILES = [
  admin,
  { level: 0, readOnlyAdmin: true, user_system_id: 7 },
  { level: 0, readOnlyDeliveryManager: true },
  { level: 2 },
  { level: 2, readOnlyBusinessOwner: true },
  { level: 5 },
  { level: 5, readOnlyDeliveryManager: true },
  { level: 5, readOnlyAdmin: true },
  { level: 8 }
]
const ADDONS = { web_dashboard_x: { value: '1' }, web_marketplace_26: { value: '1' }, web_franchises_x: { value: '1' } }
const at = pathname => ({ pathname, search: '', state: null })
const all = result => result.groups.flatMap(group => group.items)
const flat = result => all(result).flatMap(item => item.kind === 'section' ? [item, ...item.items] : [item]).concat(result.account)
const currents = result => flat(result).filter(item => item.current).map(item => item.key)

describe('sidebar groups (C11)', () => {
  it('groups the admin sections by job, in order, with no empty group', () => {
    const result = getSidebarGroups({ user: admin, location: at('/home'), plan: { upgrade_plan_id: 3 } })
    expect(result.groups.map(group => group.key)).toEqual(['operate', 'catalog', 'grow', 'platform'])
    expect(result.groups.map(group => group.items.map(item => item.key))).toEqual([
      ['home', 'orders', 'delivery', 'schools'],
      ['stores', 'myProducts', 'builder'], // main: Builder for every project at level 0
      ['marketing', 'users', 'intelligence', 'aiAgents'],
      ['connect', 'billing', 'upgrade', 'settings', 'logs'] // main: Apps & add-ons retired
    ])
    expect(result.account.map(item => item.key)).toEqual(['profile', 'free_products', 'open_source_code', 'share_ideas', 'help'])
    expect(result.showLanguage).toBe(true)
  })

  // main (): Builder after My products at level 0, for every project since (main dropped the list of
  // Builder projects); Open Source Code for levels 0 and 2.
  it('adds Builder after My products for level 0 in any project, never read-only', () => {
    const builder = getSidebarGroups({ user: admin, location: at('/builder/4') })
    const catalog = builder.groups.find(group => group.key === 'catalog').items
    expect(catalog.map(item => item.key)).toEqual(['stores', 'myProducts', 'builder'])
    expect(catalog[2]).toMatchObject({ kind: 'link', url: '/builder', page: 'builder', icon: 'Phone', current: true, badge: 'New' })
    expect(currents(builder)).toEqual(['builder'])
    expect(flat(getSidebarGroups({ user: admin, location: at('/home') })).map(item => item.key)).toContain('builder')
    for (const user of [{ level: 2 }, { ...admin, readOnlyAdmin: true }]) {
      expect(flat(getSidebarGroups({ user, location: at('/home') })).map(item => item.key)).not.toContain('builder')
    }
  })

  // main: administrators only
  it('offers Open Source Code in the account menu to level 0, read-only or not, through the router', () => {
    for (const user of [{ level: 0 }, { level: 0, readOnlyAdmin: true }]) {
      const item = getSidebarGroups({ user, location: at('/open-source-code') }).account.find(entry => entry.key === 'open_source_code')
      expect(item).toMatchObject({ kind: 'link', url: '/open-source-code', route: '/open-source-code', current: true })
    }
    for (const user of [undefined, { level: 1 }, { level: 2 }, { level: 2, readOnlyBusinessOwner: true }, { level: 5 }, { level: 8 }, { level: '2' }]) {
      expect(getSidebarGroups({ user, location: at('/home') }).account.map(item => item.key)).not.toContain('open_source_code')
    }
  })

  it('keeps every section item the command palette offers, in the order', () => {
    const configs = {}
    const sections = getDashboardNavSections({ user: admin, configs })
    const result = getSidebarGroups({ user: admin, configs, location: at('/home') })
    const byKey = Object.fromEntries(all(result).filter(item => item.kind === 'section').map(item => [item.key, item]))
    for (const key of ['orders', 'delivery', 'stores', 'users', 'marketing', 'intelligence']) {
      expect(byKey[key].items.map(item => item.url)).toEqual(sections[key].items.filter(item => item.enabled).map(item => item.url))
    }
  })

  // owner decision 33: the active item follows the pathname, so both tabs of the page keep Promotions current
  it.each(['', '?view=journeys', '?view=advanced_offers'])('marks Promotions current on /marketing/promotions-enterprise%s', search => {
    const result = getSidebarGroups({ user: admin, location: { pathname: '/marketing/promotions-enterprise', search, state: null } })
    expect(currents(result)).toEqual(['enterprise_promotions'])
    const marketing = all(result).find(item => item.key === 'marketing')
    expect(marketing.containsCurrent).toBe(true)
    expect(marketing.items.find(item => item.current)).toMatchObject({ label: 'Promotions', url: '/marketing/promotions-enterprise' })
    expect(getCurrentSectionKey(result.groups)).toBe('marketing')
  })

  it.each([
    ['/home', ['home'], null],
    ['/orders', ['orders'], 'orders'],
    ['/messages', ['messages'], 'orders'],
    ['/delivery/drivers-list', ['delivery_drivers'], 'delivery'],
    ['/stores/list', ['businesses'], 'stores'],
    ['/intelligence/reviews', ['reviews'], 'intelligence'],
    ['/settings', ['settings'], null],
    ['/profile', ['profile'], null]
  ])('on %s exactly one entry is current, and its section opens', (pathname, expected, open) => {
    const result = getSidebarGroups({ user: admin, location: at(pathname) })
    expect(currents(result)).toEqual(expected)
    expect(getCurrentSectionKey(result.groups)).toBe(open)
  })

  it('marks the parent of the current page as containing it, never as current', () => {
    const result = getSidebarGroups({ user: admin, location: at('/orders') })
    const orders = all(result).find(item => item.key === 'orders')
    expect(orders.containsCurrent).toBe(true)
    expect(orders.current).toBeUndefined()
  })

  // main: Logs audit opens its only page straight from the sidebar
  it('makes Logs audit a direct link, current on /settings/logs', () => {
    const result = getSidebarGroups({ user: admin, location: at('/settings/logs') })
    const logs = all(result).find(item => item.key === 'logs')
    expect(logs.kind).toBe('link')
    expect(logs.url).toBe('/settings/logs')
    expect(logs.current).toBe(true)
  })

  it('offers only routes the user can open, for every profile, with and without add-ons', () => {
    const mismatches = []
    for (const user of PROFILES) {
      for (const configs of [{}, ADDONS]) {
        const result = getSidebarGroups({ user, configs, location: at('/home'), plan: { upgrade_plan_id: 3 } })
        // /home has no ProtectedRoute in App.js, so it is not in DASHBOARD_ROUTE_LEVELS.
        flat(result)
          .filter(item => item.kind === 'link' && item.url !== '/home')
          .filter(item => !canOpenDashboardRoute(item.url, user.level))
          .forEach(item => mismatches.push(`${JSON.stringify(user)} ${item.url}`))
      }
    }
    expect(mismatches).toEqual([])
  })

  it('still offers what each level can open in the sections it had (no capability lost)', () => {
    const urls = user => flat(getSidebarGroups({ user, location: at('/home') })).filter(item => item.kind === 'link').map(item => item.url)
    expect(urls({ level: 2 })).toEqual(expect.arrayContaining(['/home', '/orders', '/messages', '/appointments', '/stores/list', '/stores/products']))
    expect(urls({ level: 2 })).not.toContain('/stores/devices')
    expect(urls({ level: 5 })).toEqual(expect.arrayContaining(['/orders', '/deliveries', '/drivers-dashboard', '/delivery/drivers-list']))
    expect(urls({ level: 5 })).not.toContain('/messages')
    expect(urls({ level: 5 })).not.toContain('/gift-cards')
    expect(urls(admin)).toEqual(expect.arrayContaining(['/stores/devices', '/messages', '/gift-cards']))
  })

  // Owner decision 30 A (2026-10-21): AI agents takes the session to ai.ordering.co; a read-only admin is not offered it until
  // gives the token a safe transport. Any other level 0 keeps it, as main.
  it('offers AI agents to level 0 but not to a read-only one (owner decision 30)', () => {
    const keys = user => all(getSidebarGroups({ user, location: at('/home') })).map(item => item.key)
    expect(keys(admin)).toContain('aiAgents')
    for (const user of [{ level: 0, readOnlyAdmin: true }, { level: 0, readOnlyDeliveryManager: true }, { level: 2 }, { level: 5 }, { level: 8 }]) {
      expect(keys(user)).not.toContain('aiAgents')
    }
  })

  it('applies the level and read-only gates of the old sidebar', () => {
    const driverManager = getSidebarGroups({ user: { level: 5 }, location: at('/orders') })
    expect(all(driverManager).map(item => item.key)).toEqual(['orders', 'delivery'])
    expect(driverManager.account.map(item => item.key)).toEqual(['profile', 'help'])
    expect(driverManager.showLanguage).toBe(true)

    const readOnly = getSidebarGroups({ user: { level: 0, readOnlyAdmin: true, user_system_id: 1 }, location: at('/orders') })
    expect(all(readOnly).map(item => item.key)).toEqual(['orders', 'delivery'])
    expect(readOnly.account.map(item => item.key)).toEqual(['profile', 'free_products', 'open_source_code', 'help'])
    expect(readOnly.showLanguage).toBe(false)

    const whiteLabelOwner = getSidebarGroups({ user: { level: 2 }, configs: { white_label_module: { value: '1' } }, location: at('/home') })
    expect(whiteLabelOwner.account.map(item => item.key)).toEqual(['profile'])
  })

  it('hides billing, apps and upgrade without a system user, and the website without destinations', () => {
    const result = getSidebarGroups({ user: { level: 0 }, location: at('/home'), website: { loading: false, hasProduct: true, destinations: [] } })
    const keys = all(result).map(item => item.key)
    expect(keys).not.toContain('billing')
    expect(keys).not.toContain('upgrade')
    expect(keys).not.toContain('website')
  })

  it('lists website destinations as external links and disables the section while it loads', () => {
    const loaded = getSidebarGroups({ user: admin, location: at('/home'), website: { loading: false, hasProduct: true, destinations: [{ key: 'live', url: 'https://shop.example' }] } })
    const website = all(loaded).find(item => item.key === 'website')
    expect(website.disabled).toBe(false)
    expect(website.items).toEqual([{ kind: 'external', key: 'website-live', label: 'Live website', href: 'https://shop.example' }])
    const loading = getSidebarGroups({ user: admin, location: at('/home'), website: { loading: true, hasProduct: true, destinations: [] } })
    expect(all(loading).find(item => item.key === 'website').disabled).toBe(true)
  })

  it('adds product apps under My products with the old go_to_page payload', () => {
    const result = getSidebarGroups({ user: admin, location: { pathname: '/my-products', search: '?id=12', state: null }, productApps: [{ id: 12, title: 'Kiosk', type: 'app' }] })
    const app = all(result).find(item => item.key === 'myProducts').items.find(item => item.key === 'app-12')
    expect(app).toMatchObject({ kind: 'link', url: '/my-products?id=12', page: 'products', search: '?id=12', state: { productId: 12, type: 'app' } })
  })
})

describe('· Order with Google in the sidebar', () => {
  const connectItems = (result) => all(result).find(item => item.key === 'connect')?.items || []

  it('is listed under Connect while the project shows it, with «New» while its announcement runs', () => {
    const hidden = getSidebarGroups({ user: admin, configs: ADDONS, location: at('/home') })
    expect(connectItems(hidden).map(item => item.url)).not.toContain('/connect/order-with-google')

    const shown = getSidebarGroups({ user: admin, configs: ADDONS, location: at('/home'), googleActionsVisible: true, newFeatureUrls: ['/connect/order-with-google'] })
    const google = connectItems(shown).find(item => item.url === '/connect/order-with-google')
    expect(google).toMatchObject({ kind: 'link', page: 'order_with_google', badge: 'New' })
    expect(connectItems(shown).filter(item => item.badge).map(item => item.url)).toEqual(['/connect/order-with-google'])
  })
})
