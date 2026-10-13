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

  it('hides stores and reports from read-only roles', () => {
    const sections = getDashboardNavSections({ user: { level: 0, readOnlyAdmin: true }, configs: {} })
    expect(sections.stores.visible).toBe(false)
    expect(sections.intelligence.visible).toBe(false)
    expect(sections.home.visible).toBe(false)
    expect(sections.logs.visible).toBe(false)
  })

  it('shows Builder only to editing admins of a Builder project', () => {
    expect(getDashboardNavSections({ user: { level: 0 }, configs: {}, project: 'development' }).builder.visible).toBe(true)
    expect(getDashboardNavSections({ user: { level: 0 }, configs: {}, project: 'orderingplus' }).builder.visible).toBe(false)
    expect(getDashboardNavSections({ user: { level: 0 }, configs: {} }).builder.visible).toBe(false)
    expect(getDashboardNavSections({ user: { level: 2 }, configs: {}, project: 'development' }).builder.visible).toBe(false)
    expect(getDashboardNavSections({ user: { level: 0, readOnlyAdmin: true }, configs: {}, project: 'development' }).builder.visible).toBe(false)
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
  it('offers source code to admins and business owners only', () => {
    const admin = getDashboardFooterLinks({ user: { level: 0, user_system_id: 1 } })
    const owner = getDashboardFooterLinks({ user: { level: 2 } })
    const driver = getDashboardFooterLinks({ user: { level: 5 } })
    expect(admin.filter(link => link.enabled).map(link => link.url)).toEqual(['/settings', '/free-downloads', '/open-source-code', '/purchase/addons', '/profile'])
    expect(owner.filter(link => link.enabled).map(link => link.url)).toEqual(['/open-source-code', '/profile'])
    expect(driver.filter(link => link.enabled).map(link => link.url)).toEqual(['/profile'])
  })
})
