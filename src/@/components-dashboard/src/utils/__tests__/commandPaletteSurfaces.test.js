import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARAM_POLICY, ROUTE_EXCLUSIONS, SURFACE_REGISTRY } from '../commandPaletteSurfaces'
import { buildNavigationEntries, buildStaticSettingsEntries } from '../commandPaletteCatalog'
import { buildOpenActionEntries } from '../commandPaletteActions'
import { buildIntegrationEntries } from '../commandPaletteIntegrations'
import { BUILDER_PROJECTS } from '../dashboardFeatureAccess'

/**
 * Auto-indexing guard for the ⌘K palette. When this fails, a page, panel,
 * tab or modal was added (or removed) without deciding whether the palette
 * reaches it. Fix: classify it in `utils/commandPaletteSurfaces.js` and, if
 * `indexed`, add the palette entry. See docs/COMMAND_PALETTE.md.
 */

const ROOT = process.cwd()
const COMPONENTS = resolve(ROOT, 'src/@/components-dashboard/src/ui/src/components')
const PARAM_READ = /(?:\b(?:query|params|searchParams|urlParams|search)\.get\(\s*'([A-Za-z_]+)'\s*\))|(?:useOpenFromQuery\(\s*'([A-Za-z_]+)')/g

const scanComponentParams = () => {
  const pairs = new Map()
  const walk = (dir) => {
    readdirSync(dir).forEach(name => {
      const file = join(dir, name)
      if (statSync(file).isDirectory()) {
        if (name !== '__tests__') walk(file)
        return
      }
      if (!/\.(js|jsx)$/.test(name) || /\.test\./.test(name)) return
      const source = readFileSync(file, 'utf8')
      let match
      while ((match = PARAM_READ.exec(source))) {
        const key = `${relative(COMPONENTS, dirname(file))}:${match[1] || match[2]}`
        if (!pairs.has(key)) pairs.set(key, relative(ROOT, file))
      }
    })
  }
  walk(COMPONENTS)
  return pairs
}

const scanAppRoutes = () => {
  const app = readFileSync(resolve(ROOT, 'src/App.js'), 'utf8')
  const routes = new Set()
  for (const match of app.matchAll(/path='([^']+)'/g)) {
    routes.add(match[1].replace(/\/:[^/]+\??/g, ''))
  }
  return routes
}

const ALL_ON = {
  addon_gift_cards: { value: '1' },
  appointments: { value: true },
  addon_appointments: { value: true },
  addon_catering: { value: '1' },
  addon_points_and_levels: { value: '1' },
  show_metafields: { value: '1' },
  web_marketplace_26: { value: true },
  web_dashboard_x: { value: true },
  reservation_enabled: { value: '1' }
}
const CONFIG_SETS = [ALL_ON, { ...ALL_ON, web_franchises_x: { value: true } }]
const USERS = [{ level: 0, user_system_id: 1 }, { level: 2 }, { level: 5 }, { level: 8 }]

const buildCatalogUnion = () => {
  const entries = []
  CONFIG_SETS.forEach(configs => USERS.forEach(user => {
    // A Builder project, so the project-gated section is in the union
    entries.push(...buildNavigationEntries({ user, configs, project: BUILDER_PROJECTS[0] }))
    entries.push(...buildOpenActionEntries({ user, configs, project: BUILDER_PROJECTS[0] }))
  }))
  entries.push(...buildStaticSettingsEntries())
  // Lists loaded from the API at runtime, with one sample row each
  entries.push(...buildIntegrationEntries({
    can: () => true,
    canMyProducts: true,
    integrations: [{ name: 'POS sample', type: 'pos' }, { name: 'Channel sample', type: 'sales_channel' }],
    deliveryCompanies: [{ id: 1, name: 'Courier sample' }],
    builderApps: [{ id: 1, name: 'App sample' }]
  }))
  return {
    ids: new Set(entries.map(entry => entry.id)),
    paths: new Set(entries.map(entry => entry.path).filter(Boolean))
  }
}

const classify = (key) => {
  if (SURFACE_REGISTRY[key]) return SURFACE_REGISTRY[key]
  const param = key.split(':').pop()
  return PARAM_POLICY[param] ? { status: PARAM_POLICY[param] } : null
}

describe('command palette auto-indexing guard', () => {
  const pairs = scanComponentParams()
  const catalog = buildCatalogUnion()

  it('classifies every URL param a component reads', () => {
    const missing = [...pairs.entries()].filter(([key]) => !classify(key)).map(([key, file]) => `${key}  (${file})`)
    expect(missing, `New URL params need a palette decision in utils/commandPaletteSurfaces.js:\n${missing.join('\n')}`).toEqual([])
  })

  it('keeps the registry free of surfaces that no longer exist', () => {
    const stale = Object.keys(SURFACE_REGISTRY).filter(key => !pairs.has(key))
    expect(stale, `Remove from SURFACE_REGISTRY (no longer read by any component):\n${stale.join('\n')}`).toEqual([])
  })

  it('backs every indexed surface with a palette entry', () => {
    const broken = Object.entries(SURFACE_REGISTRY)
      .filter(([, entry]) => entry.status === 'indexed')
      .filter(([, entry]) => entry.proof?.path ? !catalog.paths.has(entry.proof.path) : !catalog.ids.has(entry.proof?.action))
      .map(([key, entry]) => `${key} → ${entry.proof?.path || entry.proof?.action}`)
    expect(broken, `Indexed surfaces without a matching palette entry:\n${broken.join('\n')}`).toEqual([])
  })

  it('explains every non indexed surface', () => {
    const unexplained = Object.entries(SURFACE_REGISTRY)
      .filter(([, entry]) => (entry.status === 'excluded' && !entry.reason) || (entry.status === 'record' && !entry.note))
      .map(([key]) => key)
    expect(unexplained).toEqual([])
  })

  it('opens every route of App.js or excludes it with a reason', () => {
    const routes = scanAppRoutes()
    const pathnames = new Set([...catalog.paths].map(path => path.split('?')[0]))
    const missing = [...routes].filter(route => !pathnames.has(route) && !ROUTE_EXCLUSIONS[route])
    expect(missing, `New routes need a palette entry or a ROUTE_EXCLUSIONS reason:\n${missing.join('\n')}`).toEqual([])
    const stale = Object.keys(ROUTE_EXCLUSIONS).filter(route => !routes.has(route))
    expect(stale, `Remove from ROUTE_EXCLUSIONS (route no longer in App.js):\n${stale.join('\n')}`).toEqual([])
  })
})
