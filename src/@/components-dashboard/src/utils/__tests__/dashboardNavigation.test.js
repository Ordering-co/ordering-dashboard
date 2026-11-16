import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_ROUTE_LEVELS,
  canOpenDashboardRoute,
  getDashboardFooterLinks,
  getDashboardNavSections,
  getDashboardRoleFlags,
  getDashboardRouteLevels,
  getDashboardStartPath,
  isHiddenByReadOnly
} from '../dashboardNavigation'

const enabledUrls = (section) => section.items.filter(item => item.enabled).map(item => item.url)

describe('DASHBOARD_ROUTE_LEVELS', () => {
  it('matches every literal ProtectedRoute guard in App.js', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.js'), 'utf8')
    const guards = [...app.matchAll(/<ProtectedRoute(?: exact)? path='([^']+)' allowedLevels=\{\[([\d,\s]*)\]\}>/g)]
    expect(guards.length).toBeGreaterThan(30)
    guards.forEach(([, path, levels]) => {
      if (path.includes(':')) return
      const appLevels = levels.split(',').map(level => Number(level.trim())).sort()
      const mapped = getDashboardRouteLevels(path)
      if (!mapped) return
      expect([...mapped].sort(), path).toEqual(appLevels)
    })
  })

  it('registers the Builder routes for every project', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.js'), 'utf8')
    expect(app).not.toMatch(/isBuilderProject|BUILDER_PROJECTS/)
    // Not behind a condition
    expect(app).not.toMatch(/&& \(\s*<ProtectedRoute path='\/builder/)
    expect(app).toMatch(/\n\s*<ProtectedRoute path='\/builder\/:productId' allowedLevels=\{\[0\]\}>/)
    expect(app).toMatch(/\n\s*<ProtectedRoute path='\/builder' allowedLevels=\{\[0\]\}>/)
    expect(DASHBOARD_ROUTE_LEVELS['/builder']).toEqual([0])
  })

  it('lists every guarded top level destination used by the sidebar', () => {
    const sections = getDashboardNavSections({ user: { level: 0 }, configs: {} })
    Object.values(sections).forEach(section => {
      section.items.filter(item => item.url !== '/home').forEach(item => {
        expect(DASHBOARD_ROUTE_LEVELS[item.url], item.url).toBeDefined()
      })
    })
  })

  it('denies unknown routes and resolves nested paths to their guard', () => {
    expect(canOpenDashboardRoute('/unknown', 0)).toBe(false)
    expect(getDashboardRouteLevels('/stores/products/burger-place')).toEqual([0, 2])
    expect(canOpenDashboardRoute('/stores/list?id=4', 2)).toBe(true)
    expect(canOpenDashboardRoute('/stores/devices', 2)).toBe(false)
  })
})

describe('getDashboardRoleFlags', () => {
  it('reads read-only flags like getUserType', () => {
    expect(getDashboardRoleFlags({ level: 2, viewOnlyBusinessOwner: true }).isReadOnly).toBe(true)
    expect(getDashboardRoleFlags({ level: 0 }).isReadOnly).toBe(false)
    expect(getDashboardRoleFlags(undefined).level).toBeUndefined()
  })
})

describe('getDashboardNavSections', () => {
  it('leaves a migrated website out of My products 15 days after its migration', () => {
    const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const configs = { web_marketplace_26: { value: true } }
    const enabledIds = (sites) => getDashboardNavSections({ user: { level: 0 }, configs, sites }).myProducts.items
      .filter(item => item.enabled).map(item => item.id)
    expect(enabledIds([])).toEqual(expect.arrayContaining(['web', 'web_marketplace_26']))
    expect(enabledIds([{ code: 'website', migrated_at: daysAgo(10) }, { code: 'web_marketplace_26', migrated_at: null }])).toEqual(expect.arrayContaining(['web', 'web_marketplace_26']))
    const later = enabledIds([{ code: 'website', migrated_at: daysAgo(16) }, { code: 'web_marketplace_26', migrated_at: daysAgo(15.5) }])
    expect(later).not.toContain('web')
    expect(later).not.toContain('web_marketplace_26')
  })

  it('shows the admin every main section', () => {
    const sections = getDashboardNavSections({ user: { level: 0 }, configs: {} })
    expect(sections.users.visible).toBe(true)
    expect(sections.marketing.visible).toBe(true)
    expect(sections.stores.visible).toBe(true)
    expect(enabledUrls(sections.stores)).toContain('/stores/markups')
  })

  // owner decision 33: the page opens on Quick offers and its H1 says Promotions, so the menu does too
  it('names the first Marketing entry Promotions, same route and page', () => {
    const { marketing } = getDashboardNavSections({ user: { level: 0 }, configs: {} })
    expect(marketing.items[0]).toMatchObject({ title: 'Promotions', pageName: 'enterprise_promotions', url: '/marketing/promotions-enterprise', enabled: true })
    expect(marketing.items.map(item => item.title)).not.toContain('Advanced offers')
  })

  it('keeps business owners out of admin sections', () => {
    const sections = getDashboardNavSections({ user: { level: 2 }, configs: {} })
    expect(sections.users.visible).toBe(false)
    expect(sections.marketing.visible).toBe(false)
    expect(sections.delivery.visible).toBe(false)
    expect(enabledUrls(sections.stores)).not.toContain('/stores/brand')
    expect(enabledUrls(sections.intelligence)).toEqual(['/intelligence/business', '/intelligence/business-payments'])
    expect(sections.connect.items.map(item => item.pageName)).toEqual(['pos_menu'])
  })

  it('offers WhatsApp bots under Connect to admins only', () => {
    const admin = getDashboardNavSections({ user: { level: 0 }, configs: {} })
    expect(enabledUrls(admin.connect)).toContain('/connect/whatsapp-bots')
    expect(admin.connect.items.map(item => item.pageName).slice(-1)).toEqual(['whatsapp_bots'])
    expect(getDashboardRouteLevels('/connect/whatsapp-bots')).toEqual([0])
    expect(canOpenDashboardRoute('/connect/whatsapp-bots', 2)).toBe(false)
    expect(getDashboardNavSections({ user: { level: 2 }, configs: {} }).connect.items.map(item => item.url))
      .not.toContain('/connect/whatsapp-bots')
  })

  it('lists Order with Google under Connect only while the project shows it, for admins and business owners', () => {
    expect(enabledUrls(getDashboardNavSections({ user: { level: 0 }, configs: {} }).connect)).not.toContain('/connect/order-with-google')
    const admin = getDashboardNavSections({ user: { level: 0 }, configs: {}, googleActionsVisible: true })
    expect(admin.connect.items.map(item => item.pageName).slice(-1)).toEqual(['order_with_google'])
    const owner = getDashboardNavSections({ user: { level: 2 }, configs: {}, googleActionsVisible: true })
    expect(owner.connect.items.map(item => item.pageName)).toEqual(['pos_menu', 'order_with_google'])
    expect(getDashboardRouteLevels('/connect/order-with-google')).toEqual([0, 2])
  })

  it('hides stores and reports from read-only roles', () => {
    const sections = getDashboardNavSections({ user: { level: 0, readOnlyAdmin: true }, configs: {} })
    expect(sections.stores.visible).toBe(false)
    expect(sections.intelligence.visible).toBe(false)
    expect(sections.home.visible).toBe(false)
    expect(sections.logs.visible).toBe(false)
  })

  it('shows Builder to editing admins of every project', () => {
    expect(getDashboardNavSections({ user: { level: 0 }, configs: {} }).builder.visible).toBe(true)
    expect(getDashboardNavSections({ user: { level: 0 }, configs: {}, project: 'orderingplus' }).builder.visible).toBe(true)
    expect(getDashboardNavSections({ user: { level: 2 }, configs: {} }).builder.visible).toBe(false)
    expect(getDashboardNavSections({ user: { level: 0, readOnlyAdmin: true }, configs: {} }).builder.visible).toBe(false)
    expect(canOpenDashboardRoute('/builder/41', 0)).toBe(true)
    expect(canOpenDashboardRoute('/builder', 2)).toBe(false)
  })

  it('shows gift cards, appointments and professionals without an addon flag', () => {
    const sections = getDashboardNavSections({ user: { level: 0 }, configs: {} })
    expect(enabledUrls(sections.orders)).toEqual(expect.arrayContaining(['/gift-cards', '/appointments']))
    expect(enabledUrls(sections.users)).toContain('/users/professionals')
  })

  it('keeps the sidebar order', () => {
    const sections = getDashboardNavSections({ user: { level: 0 }, configs: {} })
    expect(sections.users.items.map(item => item.pageName)[0]).toBe('customers')
  })
})

describe('getDashboardFooterLinks', () => {
  it('offers source code to admins only', () => {
    const admin = getDashboardFooterLinks({ user: { level: 0, user_system_id: 1 } })
    const owner = getDashboardFooterLinks({ user: { level: 2 } })
    const driver = getDashboardFooterLinks({ user: { level: 5 } })
    expect(admin.filter(link => link.enabled).map(link => link.url)).toEqual(['/settings', '/free-downloads', '/open-source-code', '/profile'])
    expect(owner.filter(link => link.enabled).map(link => link.url)).toEqual(['/profile'])
    expect(driver.filter(link => link.enabled).map(link => link.url)).toEqual(['/profile'])
  })
})

// (owner decision D-68): what the menu hides from a read-only user, the route hides too
describe('isHiddenByReadOnly', () => {
  const readOnlyAdmin = { level: 0, readOnlyAdmin: true, user_system_id: 1 }
  const readOnlyDeliveryManager = { level: 5, readOnlyDeliveryManager: true }

  it('blocks for readOnlyAdmin the pages the menu hides from it, and leaves the rest', () => {
    ;['/deliveries', '/all-in-one', '/delivery/drivers-groups', '/delivery/drivers-managers', '/delivery/drivers-companies',
      '/delivery/drivers-time-display', '/driver-store-status', '/gift-cards', '/marketing/campaign', '/marketing/promotions-enterprise',
      '/users/customers', '/stores/list', '/stores/add', '/intelligence/reports', '/intelligence/ecommerce_reports', '/settings',
      '/settings/logs', '/cart-recovery/open-carts', '/my-products', '/my-products/ordering-website']
      .forEach(path => expect(isHiddenByReadOnly({ path, user: readOnlyAdmin }), path).toBe(true))
    ;['/orders', '/messages', '/appointments', '/drivers-dashboard', '/delivery/drivers-list', '/profile', '/free-downloads']
      .forEach(path => expect(isHiddenByReadOnly({ path, user: readOnlyAdmin }), path).toBe(false))
  })

  it('reads the path without its query, and nested paths by their entry', () => {
    expect(isHiddenByReadOnly({ path: '/marketing/campaign?id=3', user: readOnlyAdmin })).toBe(true)
    expect(isHiddenByReadOnly({ path: '/stores/products/burger-place', user: readOnlyAdmin })).toBe(true)
    expect(isHiddenByReadOnly({ path: '/orders?id=8', user: readOnlyAdmin })).toBe(false)
  })

  it('blocks for readOnlyDeliveryManager the delivery pages the menu hides from it', () => {
    ;['/deliveries', '/all-in-one', '/delivery/drivers-groups', '/delivery/drivers-time-display', '/driver-store-status']
      .forEach(path => expect(isHiddenByReadOnly({ path, user: readOnlyDeliveryManager }), path).toBe(true))
    ;['/orders', '/drivers-dashboard', '/delivery/drivers-list', '/profile']
      .forEach(path => expect(isHiddenByReadOnly({ path, user: readOnlyDeliveryManager }), path).toBe(false))
  })

  it('does not change what the levels see (decision 26): without the flags, or for other read-only roles, nothing is blocked', () => {
    ;['/deliveries', '/users/customers', '/marketing/campaign', '/settings'].forEach(path => {
      expect(isHiddenByReadOnly({ path, user: { level: 0 } }), path).toBe(false)
      expect(isHiddenByReadOnly({ path, user: { level: 2, readOnlyBusinessOwner: true } }), path).toBe(false)
    })
    // a page the level does not have stays with its own guard (PageNotFound of ProtectedRoute), not this one
    expect(isHiddenByReadOnly({ path: '/delivery/drivers-companies', user: readOnlyDeliveryManager })).toBe(false)
  })

  it('leaves / and /home to their own redirect, and routes the menu does not know', () => {
    expect(isHiddenByReadOnly({ path: '/', user: readOnlyAdmin })).toBe(false)
    expect(isHiddenByReadOnly({ path: '/home', user: readOnlyAdmin })).toBe(false)
    expect(isHiddenByReadOnly({ path: '/support', user: readOnlyAdmin })).toBe(false)
  })

  it('App.js answers a hidden route with PageNotFound before any other route, with the same user and configs', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.js'), 'utf8')
    const at = app.indexOf('isHiddenByReadOnly({')
    expect(at).toBeGreaterThan(-1)
    expect(app.indexOf("<Route exact path='/'>")).toBeGreaterThan(at)
    // the routes match `routesLocation` (the last location with network), so the guard reads the same path they do
    expect(app.slice(at, at + 240)).toMatch(/path: routesLocation\.pathname, user, configs/)
    expect(app.slice(at, at + 280)).toMatch(/<PageNotFound \/>/)
  })
})

// (#76b): a level that cannot open /orders with a read-only flag looped / -> /orders -> 404 -> /
describe('getDashboardStartPath', () => {
  it.each([
    [{ level: 0 }, '/home'],
    [{ level: 2 }, '/home'],
    [{ level: 1 }, '/home'],
    [{ level: 3 }, '/home'],
    [{ level: 5 }, '/orders'],
    [{ level: 8 }, '/profile'],
    [{ level: 8, readOnlyAdmin: true }, '/profile'],
    [{ level: 0, readOnlyAdmin: true }, '/orders'],
    [{ level: 0, readOnlyDeliveryManager: true }, '/orders'],
    [{ level: 2, readOnlyBusinessOwner: true }, '/orders'],
    [{ level: 2, viewOnlyBusinessOwner: true }, '/orders'],
    [{ level: 5, readOnlyAdmin: true }, '/orders']
  ])('keeps %j going to %s', (user, path) => {
    expect(getDashboardStartPath(user)).toBe(path)
  })

  it.each([
    [{ level: 1, readOnlyAdmin: true }],
    [{ level: 1, readOnlyDeliveryManager: true }],
    [{ level: 3, readOnlyBusinessOwner: true }],
    [{ level: 4, readOnlyAdmin: true }]
  ])('does not send %j to /orders, which its level cannot open', (user) => {
    expect(canOpenDashboardRoute('/orders', user.level)).toBe(false)
    expect(getDashboardStartPath(user)).toBe('/home')
  })

  it('never returns a path the user level cannot open, for any level and flag', () => {
    for (const level of [0, 1, 2, 3, 4, 5, 6, 7, 8, undefined]) {
      for (const flag of [undefined, 'readOnlyAdmin', 'readOnlyDeliveryManager', 'readOnlyBusinessOwner', 'viewOnlyBusinessOwner']) {
        const user = { level, ...(flag ? { [flag]: true } : {}) }
        const path = getDashboardStartPath(user)
        if (path !== '/home') expect(canOpenDashboardRoute(path, level), JSON.stringify(user)).toBe(true)
      }
    }
  })

  it('handles a missing user', () => {
    expect(getDashboardStartPath()).toBe('/home')
    expect(getDashboardStartPath(null)).toBe('/home')
  })

  it('App.js uses it at / and /home instead of its own flag chain', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.js'), 'utf8')
    expect(app.match(/getDashboardStartPath\(user\)/g)).toHaveLength(1)
    expect(app.match(/<Redirect to=\{startPath\} \/>/g)).toHaveLength(2)
    expect(app).toMatch(/startPath === '\/home' \? <Home \/>/)
    expect(app).not.toMatch(/readOnlyAdmin \|\| readOnlyDeliveryManager \|\| readOnlyBusinessOwner/)
  })
})

describe('shell landmarks in App.js', () => {
  const app = readFileSync(resolve(process.cwd(), 'src/App.js'), 'utf8')

  // (R1-03): the offline page took >= 100vh as a loose block above the Layout and pushed the menu below the fold
  it('mounts NotNetworkConnectivity inside Layout, after SidebarMenu', () => {
    const layout = app.indexOf('<Layout>')
    const menu = app.indexOf('<SidebarMenu ')
    const offline = app.indexOf('<NotNetworkConnectivity />')
    expect(app.match(/<NotNetworkConnectivity \/>/g)).toHaveLength(1)
    expect(layout).toBeGreaterThan(-1)
    expect(menu).toBeGreaterThan(layout)
    expect(offline).toBeGreaterThan(menu)
    expect(offline).toBeLessThan(app.indexOf('</Layout>'))
  })

  // (#76a): the shell had no <main>; the skip link points at #main-content
  it('wraps the routed content of Layout in ShellMain, after SidebarMenu', () => {
    const layout = app.indexOf('<Layout>')
    const main = app.indexOf('<ShellMain>')
    expect(main).toBeGreaterThan(app.indexOf('<SidebarMenu '))
    expect(main).toBeGreaterThan(layout)
    expect(app.indexOf('<ScrollToTop>')).toBeGreaterThan(main)
    expect(app.indexOf('</ScrollToTop>')).toBeLessThan(app.indexOf('</ShellMain>'))
    expect(app.indexOf('</ShellMain>')).toBeLessThan(app.indexOf('</Layout>'))
  })
})
