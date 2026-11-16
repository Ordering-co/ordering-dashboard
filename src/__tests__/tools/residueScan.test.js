// redesign W0-8a (T0-30)
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALIASES,
  REPO_ROOT,
  ScanError,
  check,
  loadExceptions,
  loadLegacy,
  parseModule,
  scan
} from '../../../scripts/redesign/residue-scan.mjs'

const fixtureRoot = resolve(__dirname, 'fixtures/residue')
const fixture = name => resolve(fixtureRoot, name)
const run = routes => scan({ routes, root: fixtureRoot, legacyPath: fixture('legacy-modules.json') })
const ids = result => Object.fromEntries(Object.entries(result.routes).map(([path, r]) => [path, r.legacy.map(l => l.id).sort()]))

describe('residue scan: barrels (fixture)', () => {
  it('follows the imported NAME through the barrel, not the whole barrel', () => {
    // The barrel also exports Wanted, whose component imports the legacy Button, and Starred, which
    // imports a legacy package. /clean imports only Other and must see none of it.
    const result = run(['/good', '/clean', '/pkg'])
    expect(ids(result)).toEqual({
      '/good': ['legacy-button'],
      '/clean': [],
      '/pkg': ['pkg-legacy']
    })
  })

  it('reports the chain and the importing files of a hit', () => {
    const hit = run(['/good']).routes['/good'].legacy[0]
    expect(hit.importers).toEqual(['@/components-dashboard/src/ui/components/Wanted/index.js'])
    expect(hit.importerCount).toBe(1)
    expect(hit.chain).toEqual([
      'pages/Good/index.js',
      '@/components-dashboard/src/ui/components/Wanted/index.js',
      '@/components-dashboard/src/ui/styles/Buttons/index.js'
    ])
  })

  it('does not enter the barrel file itself (reached files = page + the defining module + its imports)', () => {
    const result = run(['/clean'])
    expect(result.routes['/clean'].reachedFiles).toBe(2) // pages/Clean + components/Other
  })

  it('a namespace import, a dynamic import and component={X} enter the module whole', () => {
    const result = run(['/ns', '/lazy'])
    expect(ids(result)).toEqual({
      '/ns': ['legacy-button', 'pkg-legacy'],
      '/lazy': ['pkg-legacy']
    })
  })

  it('lists redirect-only routes apart and fails on an unknown route', () => {
    const result = run()
    expect(result.redirects).toEqual([{ path: '/', via: ['Redirect'] }])
    expect(Object.keys(result.routes).sort()).toEqual(['/clean', '/good', '/lazy', '/ns', '/pkg'])
    expect(() => run(['/nope'])).toThrow(ScanError)
  })
})

describe('residue scan: the gate (fixture)', () => {
  const exceptions = path => loadExceptions({ legacy: loadLegacy({ root: fixtureRoot, legacyPath: fixture('legacy-modules.json') }), exceptionsPath: path })

  it('residue not covered by an exception fails; a declared one passes', () => {
    const result = run()
    const withNone = check(result, [])
    expect(withNone.ok).toBe(false)
    expect(withNone.residue.map(r => `${r.route} ${r.legacy}`).sort()).toEqual([
      '/good legacy-button', '/lazy pkg-legacy', '/ns legacy-button', '/ns pkg-legacy', '/pkg pkg-legacy'
    ])
    const covered = check(run(['/good']), exceptions(fixture('exceptions.json')))
    expect(covered).toMatchObject({ ok: true, residue: [], stale: [] })
  })

  it('an exception that is no longer reachable FAILS (it expired)', () => {
    const exception = { route: '/clean', legacy: 'legacy-button', reason: 'fixture: used to be reachable' }
    const verdict = check(run(['/clean']), [exception])
    expect(verdict.ok).toBe(false)
    expect(verdict.stale).toEqual([{ route: '/clean', legacy: 'legacy-button', why: 'no longer reachable from the route' }])
  })

  it('an exception for a route that is not in App.js, or is a redirect, FAILS', () => {
    const verdict = check(run(['/clean']), [
      { route: '/gone', legacy: 'legacy-button', reason: 'x' },
      { route: '/', legacy: 'legacy-button', reason: 'x' }
    ])
    expect(verdict.stale.map(s => s.why)).toEqual(['route is not in App.js', 'route is a pure redirect'])
    expect(verdict.ok).toBe(false)
  })

  it('an exception is only judged for the routes that were scanned', () => {
    const verdict = check(run(['/clean']), exceptions(fixture('exceptions.json')))
    expect(verdict).toMatchObject({ ok: true, stale: [] })
  })

  it('a legacy entry that matches nothing fails the scanner (closed)', () => {
    expect(() => scan({ root: fixtureRoot, legacyPath: fixture('legacy-unmatched.json') })).toThrow(/ghost.*matches nothing/)
  })

  it('an exception that names an unknown legacy id fails to load', () => {
    const legacy = loadLegacy({ root: fixtureRoot, legacyPath: fixture('legacy-modules.json') })
    expect(() => loadExceptions({ legacy, exceptionsPath: fixture('legacy-modules.json') })).toThrow(ScanError)
  })
})

describe('residue scan: the real repo', () => {
  const legacyOf = (result, route, id) => result.routes[route].legacy.find(l => l.id === id)

  it('the aliases are the ones in vite.config.js', () => {
    const vite = readFileSync(resolve(REPO_ROOT, 'vite.config.js'), 'utf8')
    for (const [alias, target] of ALIASES) {
      const expected = target ? `'${alias}': resolve(__dirname, 'src/${target}')` : `'${alias}': resolve(__dirname, 'src')`
      expect(vite).toContain(expected)
    }
  })

  it('legacy-modules.json: every entry matches something, and the required ones are there', () => {
    const legacy = loadLegacy()
    expect(legacy.map(l => l.id)).toEqual(expect.arrayContaining([
      'legacy-button', 'legacy-inputs', 'legacy-modal', 'legacy-confirm', 'legacy-sidebar-panel',
      'legacy-pagination', 'legacy-searchbar', 'pkg-react-bootstrap', 'pkg-react-datepicker',
      'pkg-react-date-range', 'pkg-react-bootstrap-icons', 'pkg-meronex-icons', 'pkg-react-loading-skeleton'
    ]))
    expect(() => loadExceptions({ legacy })).not.toThrow()
  })

  it('/stores/list has more legacy modules than /orders, and /orders still imports the legacy Button', () => {
    const result = scan({ routes: ['/orders', '/stores/list'] })
    const orders = result.routes['/orders']
    const stores = result.routes['/stores/list']
    expect(stores.legacy.length).toBeGreaterThan(orders.legacy.length)
    const button = legacyOf(result, '/orders', 'legacy-button')
    expect(button).toBeTruthy()
    expect(button.importers.some(f => f.includes('/components/Orders/'))).toBe(true)
    expect(button.chain[0]).toBe('pages/OrdersList/index.js')
    expect(button.chain.at(-1)).toBe('@/components-dashboard/src/ui/src/styles/Buttons/index.js')
    // Following names, not barrels: /orders reaches a fraction of the tree, not all of it.
    expect(orders.reachedFiles).toBeLessThan(1000)
    expect(orders.unresolved).toEqual([])
    // The shell navigation is not a legacy module.
    const sidebar = legacyOf(result, '/orders', 'legacy-sidebar-panel')
    expect(sidebar?.importers ?? []).not.toContain('@/components-dashboard/src/ui/src/components/Shared/SideBar/SidebarNav.jsx')
  }, 60000)

  it('every route of App.js resolves to a page or is listed as a redirect', () => {
    const result = scan({ routes: ['/orders'] })
    const resolved = Object.keys(result.routes).length + result.redirects.length
    expect(result.knownRoutes.length).toBeGreaterThan(70)
    expect(result.knownRoutes).toContain('/orders')
    expect(resolved).toBeLessThan(result.knownRoutes.length) // only /orders was scanned, plus every redirect
    const full = scan()
    expect(Object.keys(full.routes).length + full.redirects.length).toBe(full.knownRoutes.length)
    expect(full.redirects.map(r => r.path)).toContain('/settings/basic')
  }, 120000)
})

// redesign tramo B r3 (W0-PB2-01): `lazyWithReload(() => import('spec'))` is read as the import it wraps.
describe('residue scan: lazy bindings (parseModule)', () => {
  const bindingsOf = (code) => {
    const dir = mkdtempSync(join(tmpdir(), 'residue-lazy-'))
    const file = join(dir, 'App.js')
    writeFileSync(file, code)
    try { return parseModule(file).bindings } finally { rmSync(dir, { recursive: true, force: true }) }
  }

  it('reads the three shapes of a lazy page, with and without lazyWithReload', () => {
    const bindings = bindingsOf([
      "const A = lazy(() => import('./pages/A').then(m => ({ default: m.A })))",
      "const B = lazy(() => lazyWithReload(() => import('./pages/B')).then(m => ({ default: m.B })))",
      "const C = lazy(() => lazyWithReload(() => import('./pages/C')))",
      "const D = lazy(() => import('./pages/D'))"
    ].join('\n'))
    expect(Object.fromEntries(bindings)).toEqual({
      A: { spec: './pages/A', imported: 'A' },
      B: { spec: './pages/B', imported: 'B' },
      C: { spec: './pages/C', imported: 'default' },
      D: { spec: './pages/D', imported: 'default' }
    })
  })

  it('does not unwrap any other wrapper', () => {
    expect(bindingsOf("const E = lazy(() => other(() => import('./pages/E')))").size).toBe(0)
  })
})
