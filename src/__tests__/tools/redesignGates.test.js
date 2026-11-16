// redesign W0-8b (T0-31)
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  FAMILY_NAMES,
  GatesError,
  loadFamilies,
  ratchet,
  runPlaywright,
  runRatchet,
  runVitest,
  verifyRulesets
} from '../../../scripts/redesign/gates.mjs'
import { loadExceptions, loadLegacy, scan } from '../../../scripts/redesign/residue-scan.mjs'

const root = resolve(__dirname, '../../..')
const UI = 'src/@/components-dashboard/src/ui/src/components'
const realConfig = () => JSON.parse(readFileSync(join(root, 'scripts/redesign/families.json'), 'utf8'))
const realBaseline = () => JSON.parse(readFileSync(join(root, 'scripts/redesign/residue-baseline.json'), 'utf8'))

// One scan of App.js for the whole file (about 7s); the negative cases inject their own config.
let result
let appRoutes
let exceptions
beforeAll(() => {
  result = scan()
  appRoutes = new Set(result.knownRoutes)
  exceptions = loadExceptions({ legacy: loadLegacy() })
}, 120000)

const load = config => loadFamilies({ config, appRoutes })
const mutated = edit => { const config = realConfig(); edit(config.families); return config }

// fila 48: every `load()` walks the repo with a dozen globs (fs bound) and the CLI cases spawn node. A case takes 0.1 to
// 0.8s alone and 6.8s on a loaded machine (the five loads of «owned twice» hit the 5s default), so the three suites get their own
// budget; the assertions are untouched.
const FS_BOUND_MS = 30_000

describe('families.json', { timeout: FS_BOUND_MS }, () => {
  it('is valid: the ten families, every dir, route, ruleset and test glob resolves', () => {
    const families = load(realConfig())
    expect(Object.keys(families)).toEqual(FAMILY_NAMES)
    for (const f of Object.values(families)) {
      expect(f.dirs.length, f.name).toBeGreaterThan(0)
      expect(f.routes.length, f.name).toBeGreaterThan(0)
      expect(f.rulesetFiles.length, f.name).toBeGreaterThan(0)
      expect(f.tests.length, f.name).toBeGreaterThan(0)
    }
  })

  it('loads without the injected route list too (parses the real App.js)', () => {
    expect(Object.keys(loadFamilies())).toEqual(FAMILY_NAMES)
  })

  it('owns every route of App.js exactly once (the shell mounts them all)', () => {
    const families = load(realConfig())
    const owned = Object.values(families).filter(f => f.name !== 'shell').flatMap(f => f.routes)
    expect(new Set(owned).size).toBe(owned.length)
    expect([...owned].sort()).toEqual([...appRoutes].sort())
    expect(families.shell.routes.sort()).toEqual([...appRoutes].sort())
  })

  it('every test file under a family dir is in that family tests, and every UI directory is owned', () => {
    const families = load(realConfig())
    const walk = dir => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e => {
      const p = `${dir}/${e.name}`
      return e.isDirectory() ? walk(p) : /\.(?:test|spec)\.[jt]sx?$/.test(e.name) ? [p] : []
    })
    for (const f of Object.values(families)) {
      const own = new Set(f.tests)
      for (const dir of f.dirs) for (const file of walk(dir)) expect(own.has(file), `${f.name}: ${file} is not in its tests`).toBe(true)
    }
    const dirs = Object.values(families).flatMap(f => f.dirs)
    const covered = dir => dirs.some(d => dir === d || dir.startsWith(`${d}/`))
    const unowned = []
    for (const top of readdirSync(join(root, UI), { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== '__tests__')) {
      const topDir = `${UI}/${top.name}`
      if (covered(topDir)) continue
      // A domain split between families (Stores, Delivery, Settings): every child must be owned.
      for (const child of readdirSync(join(root, topDir), { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== '__tests__')) {
        if (!covered(`${topDir}/${child.name}`)) unowned.push(`${topDir}/${child.name}`)
      }
      if (!readdirSync(join(root, topDir), { withFileTypes: true }).some(e => e.isDirectory())) unowned.push(topDir)
    }
    expect(unowned).toEqual([])
  })

  it('fails closed on a family with a directory that does not exist', () => {
    const config = mutated(f => { f.stores.dirs.push('UI/Stores/NoSuchDirectory') })
    expect(() => load(config)).toThrow(GatesError)
    expect(() => load(config)).toThrow(/stores\.dirs: .*Stores\/NoSuchDirectory does not exist/)
  })

  it('fails closed on a route that is not in App.js, a ruleset or a test glob that matches nothing', () => {
    expect(() => load(mutated(f => { f.bi.routes.push('/intelligence/nope') }))).toThrow(/bi\.routes: \/intelligence\/nope is not in src\/App\.js/)
    expect(() => load(mutated(f => { f.bi.rulesets.push('l6-zz') }))).toThrow(/bi\.rulesets: "l6-zz" matches no/)
    expect(() => load(mutated(f => { f.bi.tests.push('UI/BusinessIntelligence/**/*.nothing.js') }))).toThrow(/bi\.tests: .* matches no test file/)
  })

  it('fails closed on a route owned twice, a route owned by nobody, an unknown or missing family', () => {
    expect(() => load(mutated(f => { f.growth.routes.push('/orders') }))).toThrow(/growth\.routes: \/orders is also owned by orders/)
    expect(() => load(mutated(f => { f.growth.routes = f.growth.routes.filter(r => r !== '/schools') }))).toThrow(/route \/schools of src\/App\.js is owned by no family/)
    expect(() => load(mutated(f => { f.extra = f.shell }))).toThrow(/family "extra" is not one of/)
    expect(() => load(mutated(f => { delete f.access }))).toThrow(/family "access" is missing/)
    expect(() => load(mutated(f => { f.shell.dirs = [] }))).toThrow(/shell\.dirs must be a non-empty array/)
  })

  // growth runs the transition specs, which mount SchoolModuleToggle; they went red after and no gate ran them
  it('growth and operations run the brand-system specs that mount their pieces (Schools, the inbox), and only families that declare specs have them', () => {
    const families = load(realConfig())
    expect(families.growth.specs).toEqual([
      'e2e/brand-system/transition-isolation.spec.js',
      'e2e/brand-system/transition-locales.spec.js',
      'e2e/brand-system/transition.spec.js'
    ])
    expect(families.operations.specs).toEqual(['e2e/brand-system/messages-shell.spec.js'])
    expect(families.orders.specs).toEqual([])
  })

  // four more specs went red after integrations no gate re-ran them for (); each family runs its own
  it('stores, bi, access and shell run the brand-system specs of the pieces they own', () => {
    const families = load(realConfig())
    expect(families.stores.specs).toEqual(['e2e/brand-system/schedule-consumers.spec.js'])
    expect(families.bi.specs).toEqual(['e2e/brand-system/home-page.spec.js'])
    expect(families.access.specs).toEqual(['e2e/brand-system/auth-forms.spec.js', 'e2e/brand-system/profile-sessions.spec.js'])
    expect(families.shell.specs).toEqual(['e2e/brand-system/confirm-admin-consumers.spec.js', 'e2e/brand-system/isolation.spec.js'])
  })

  // profile-sessions went red unseen when J5 row 56 renamed the opener to «Open menu»
  it('access runs the profile and sessions spec', () => {
    expect(load(realConfig()).access.specs).toContain('e2e/brand-system/profile-sessions.spec.js')
  })

  // billing-d1-styles (row 82) and the isolation boot contract (bugs H #76a) went red the same way
  it('settings runs billing-d1-styles and shell the isolation boot contract', () => {
    const families = load(realConfig())
    expect(families.settings.specs).toEqual(['e2e/brand-system/billing-d1-styles.spec.js'])
    expect(families.shell.specs).toContain('e2e/brand-system/isolation.spec.js')
  })

  it('fails closed on browser specs that are empty, match nothing or sit outside the brand-system testDir', () => {
    expect(() => load(mutated(f => { f.growth.specs = [] }))).toThrow(/growth\.specs must be a non-empty array/)
    expect(() => load(mutated(f => { f.growth.specs.push('e2e/brand-system/no-such*.spec.js') }))).toThrow(/growth\.specs: .*no-such\*\.spec\.js matches no spec file/)
    expect(() => load(mutated(f => { f.growth.specs.push('e2e/brand-system-app/*.spec.js') }))).toThrow(/growth\.specs: "e2e\/brand-system-app\/\*\.spec\.js" is not a glob under e2e\/brand-system\//)
  })

  it('rejects a path that escapes the repo', () => {
    expect(() => load(mutated(f => { f.orders.dirs.push('UI/../../../etc') }))).toThrow(/not a valid repo-relative path/)
  })
})

describe('gate steps cannot be skipped', { timeout: FS_BOUND_MS }, () => {
  it('a family with no test files is a FAIL, not a pass', () => {
    const row = runVitest([])
    expect(row.ok).toBe(false)
    expect(row.detail).toBe('no test files')
  })

  it('a family with no browser spec files is a FAIL, not a pass', () => {
    const row = runPlaywright([])
    expect(row.ok).toBe(false)
    expect(row.detail).toBe('no spec files')
  })

  it('a ruleset that cannot be loaded is a FAIL', async () => {
    const row = await verifyRulesets(['scripts/brand-system/no-such-ruleset-rules.json'])
    expect(row.ok).toBe(false)
    expect(row.output).toContain('no-such-ruleset-rules.json')
  })

  it('the CLI lists the families, and refuses an unknown one with exit 2', () => {
    const list = spawnSync(process.execPath, ['scripts/redesign/gates.mjs', '--list'], { cwd: root, encoding: 'utf8' })
    expect(list.status).toBe(0)
    for (const name of FAMILY_NAMES) expect(list.stdout).toContain(name)
    const unknown = spawnSync(process.execPath, ['scripts/redesign/gates.mjs', 'nope'], { cwd: root, encoding: 'utf8' })
    expect(unknown.status).toBe(2)
    expect(unknown.stderr).toContain('usage')
  })
})

describe('residue ratchet', { timeout: FS_BOUND_MS }, () => {
  // A synthetic scan result: /a reaches the legacy button and modal, /b reaches nothing.
  const hit = id => ({ id, importerCount: 3, chain: ['pages/A/index.js', `@/components-dashboard/src/ui/${id}.js`], importers: [] })
  const fake = (legacyA = ['legacy-button', 'legacy-modal']) => ({
    routes: {
      '/a': { path: '/a', legacy: legacyA.map(hit), unresolved: [] },
      '/b': { path: '/b', legacy: [], unresolved: [] }
    },
    redirects: [{ path: '/r', via: ['Redirect'] }],
    knownRoutes: ['/a', '/b', '/r']
  })
  const base = routes => ({ routes })

  it('passes when the baseline is exactly what is reachable', () => {
    const r = ratchet({ result: fake(), baseline: base({ '/a': ['legacy-button', 'legacy-modal'], '/b': [] }), exceptions: [], full: true })
    expect(r.ok).toBe(true)
  })

  it('fails with a legacy module the baseline does not have (regression)', () => {
    const r = ratchet({ result: fake(), baseline: base({ '/a': ['legacy-button'], '/b': [] }), exceptions: [] })
    expect(r.ok).toBe(false)
    expect(r.regressions).toEqual([expect.objectContaining({ route: '/a', legacy: 'legacy-modal' })])
    expect(r.expired).toEqual([])
  })

  it('fails with a baseline entry the route no longer reaches (stale: lower it)', () => {
    const r = ratchet({ result: fake(['legacy-button']), baseline: base({ '/a': ['legacy-button', 'legacy-modal'], '/b': [] }), exceptions: [] })
    expect(r.ok).toBe(false)
    expect(r.expired).toEqual([{ route: '/a', legacy: 'legacy-modal' }])
    expect(r.regressions).toEqual([])
  })

  it('fails a route with a page and no baseline entry, and (full) a baseline route that is gone or has no page', () => {
    const noEntry = ratchet({ result: fake(), baseline: base({ '/a': ['legacy-button', 'legacy-modal'] }), exceptions: [] })
    expect(noEntry.missing).toEqual(['/b'])
    expect(noEntry.ok).toBe(false)
    const orphan = ratchet({ result: fake(), baseline: base({ '/a': ['legacy-button', 'legacy-modal'], '/b': [], '/r': [], '/gone': [] }), exceptions: [], full: true })
    expect(orphan.orphans.sort()).toEqual(['/gone', '/r'])
    expect(orphan.ok).toBe(false)
    // A family run (not full) only judges its own routes.
    expect(ratchet({ result: fake(), baseline: base({ '/a': ['legacy-button', 'legacy-modal'], '/b': [], '/gone': [] }), exceptions: [] }).ok).toBe(true)
  })

  it('a declared exception is not residue, and an exception that is no longer reachable fails', () => {
    const ex = (legacy, route = '/a') => ({ route, legacy, reason: 'documentary truth' })
    expect(ratchet({ result: fake(), baseline: base({ '/a': ['legacy-button'], '/b': [] }), exceptions: [ex('legacy-modal')] }).ok).toBe(true)
    const stale = ratchet({ result: fake(['legacy-button']), baseline: base({ '/a': ['legacy-button'], '/b': [] }), exceptions: [ex('legacy-modal')] })
    expect(stale.ok).toBe(false)
    expect(stale.stale).toEqual([expect.objectContaining({ route: '/a', legacy: 'legacy-modal' })])
  })

  it('an unresolved import fails the ratchet', () => {
    const bad = fake()
    bad.routes['/b'].unresolved = [{ from: 'pages/B/index.js', what: 'does not resolve' }]
    const r = ratchet({ result: bad, baseline: base({ '/a': ['legacy-button', 'legacy-modal'], '/b': [] }), exceptions: [] })
    expect(r.ok).toBe(false)
    expect(r.unresolved).toHaveLength(1)
  })

  it('requires a baseline with routes', () => {
    expect(() => ratchet({ result: fake(), baseline: {}, exceptions: [] })).toThrow(GatesError)
  })

  describe('the real baseline', () => {
    it('matches today: every route of App.js, nothing regressed, nothing stale', () => {
      const r = ratchet({ result, baseline: realBaseline(), exceptions, full: true })
      expect(r.ok, JSON.stringify([r.regressions, r.expired, r.missing, r.orphans, r.stale, r.unresolved])).toBe(true)
      expect(r.scanned).toBe(Object.keys(result.routes).length)
    })

    it('runRatchet over a family of routes agrees', () => {
      expect(runRatchet({ routes: ['/orders', '/stores/list'] }).ok).toBe(true)
    })

    it('a baseline with a real entry removed fails with that route and id (the mutation)', () => {
      const baseline = realBaseline()
      expect(baseline.routes['/orders']).toContain('legacy-button')
      baseline.routes['/orders'] = baseline.routes['/orders'].filter(id => id !== 'legacy-button')
      const r = ratchet({ result, baseline, exceptions, full: true })
      expect(r.ok).toBe(false)
      expect(r.regressions).toEqual([expect.objectContaining({ route: '/orders', legacy: 'legacy-button' })])
    })

    it('a baseline that lists a module the route does not reach fails as stale', () => {
      const baseline = realBaseline()
      expect(result.routes['/login'].legacy.map(l => l.id)).not.toContain('legacy-modal')
      baseline.routes['/login'] = [...baseline.routes['/login'], 'legacy-modal']
      const r = ratchet({ result, baseline, exceptions, full: true })
      expect(r.ok).toBe(false)
      expect(r.expired).toEqual([{ route: '/login', legacy: 'legacy-modal' }])
    })

    it('the stores listing reaches more legacy than /orders, as the plan says', () => {
      const baseline = realBaseline()
      expect(baseline.routes['/stores/list'].length).toBeGreaterThan(baseline.routes['/orders'].length)
    })
  })
})
