import { describe, expect, it } from 'vitest'
import { darkRouteList, scanDarkRoutes } from '../../../scripts/redesign/dark-routes.mjs'
import darkRoutes from '../darkRoutes.json'

// the routes that follow the dark mode are the ones the scan finds with no legacy module and no light-only paint.
// A screen that gains a literal color or a legacy import drops out of dark (fail closed) and this test asks to update the list.
describe('src/brand/darkRoutes.json', () => {
  const routes = scanDarkRoutes()

  it('matches the scan (node scripts/redesign/dark-routes.mjs --write)', () => {
    expect(darkRoutes.routes).toEqual(darkRouteList(routes))
  })

  it('never lists the not-found pattern, which matches every url', () => {
    expect(darkRoutes.routes).not.toContain('*')
  })

  it('keeps routes with legacy modules light', () => {
    expect(routes['/orders'].dark).toBe(false)
    expect(routes['/orders'].legacy.length).toBeGreaterThan(0)
  })
}, 60000)
