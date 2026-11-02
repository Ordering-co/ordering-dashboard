import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_ROUTE_LEVELS,
  canOpenDashboardRoute,
  getDashboardFooterLinks,
  getDashboardNavSections,
  getDashboardRoleFlags,
  getDashboardRouteLevels
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
