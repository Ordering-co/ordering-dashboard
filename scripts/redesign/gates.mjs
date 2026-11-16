// redesign W0-8b (T0-31)
/**
 * `pnpm redesign:gates <family>`: every gate of a redesign family, in series, summarised in a
 * PASS/FAIL table. Exit 1 if anything fails. A step that cannot run is a FAIL, never a skip.
 *
 *   node scripts/redesign/gates.mjs <family>   # orders operations stores catalog users settings growth bi access shell
 *   node scripts/redesign/gates.mjs --list     # the families and what they own
 *   node scripts/redesign/gates.mjs --ratchet  # only the residue ratchet, on every route (CI, W0-8f)
 *
 * Steps (plan.md > Puertas, W0-8):
 *   1 unit tests       vitest on the family's test files (families.json `tests`)
 *   2 rulesets         every brand-system ruleset of the family, verified with the same engine
 *                      brandSystemMigration.test.js uses (loadRules + verifyMigration). Not through
 *                      `vitest -t`: that test only enumerates the l3 and t1 rulesets (24), so a
 *                      name filter would silently skip every l4/l5/l6/l8 ruleset.
 *   3 literal guard    src/__tests__/tools/productLiteralGuard.test.js (governed files; it is not
 *                      family-scoped, it guards Shared/Product and the governed list)
 *   4 residue ratchet  the legacy residue reachable from the family's routes may only go down
 *                      (scripts/redesign/residue-baseline.json, see ratchet())
 *   5 ISO dates        date-iso-guard on each directory of the family
 *   6 Orders imports   orders-import-guard on each directory of the family
 *   7 browser specs    only in a family that declares `specs` (globs under e2e/brand-system): Playwright with
 *                      the brand-system config, on the shared harness port (BRAND_HARNESS_PORT, 3017 by
 *                      default). growth runs the transition specs, which mount SchoolModuleToggle;
 *                      they went red after the /schools redesign and no gate ran them.
 *   8 overlaps         , every family: the browser check of the overlap probe (its static cases, among them the
 *                      owner's «Save over Dashboard order alerts») and the overlap baseline
 *                      (scripts/redesign/overlap-baseline.json, its own file) well formed. The sweep itself needs a live
 *                      session, which CI does not have: `pnpm redesign:overlaps --session <port>` fails on a new pair
 *                      (docs/REDESIGN_PLAYBOOK.md › Overlaps).
 *
 * families.json is loaded FAIL-CLOSED (loadFamilies): a directory that does not exist, a route
 * that is not in src/App.js, a ruleset or a test glob that matches nothing, a route owned by two
 * families or by none, a `specs` list that is empty, matches nothing or leaves e2e/brand-system, all
 * stop the gate.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, globSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { check as checkResidue, createContext, loadExceptions, loadLegacy, parseRoutes, scan } from './residue-scan.mjs'
import { readRoutes, validateBaseline } from './tools/overlap-baseline.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '../..')
export const FAMILIES_PATH = path.join(HERE, 'families.json')
export const BASELINE_PATH = path.join(HERE, 'residue-baseline.json')
export const BRAND_DIR = 'scripts/brand-system'
export const LITERAL_GUARD_TEST = 'src/__tests__/tools/productLiteralGuard.test.js'
// the testDir of the brand-system Playwright config; a spec elsewhere would not be found by it
export const SPECS_DIR = 'e2e/brand-system'
export const PLAYWRIGHT_CONFIG = 'scripts/brand-system/playwright.config.mjs'
// the overlap probe's browser check, its baseline and the urls the sweep measures
export const OVERLAP_CHECK = 'scripts/redesign/tools/overlap-probe.check.mjs'
export const OVERLAP_BASELINE_PATH = path.join(HERE, 'overlap-baseline.json')
export const OVERLAP_ROUTES = 'scripts/redesign/tools/overlap-routes.txt'
// The ten families of plan.md. families.json must have exactly these.
export const FAMILY_NAMES = ['orders', 'operations', 'stores', 'catalog', 'users', 'settings', 'growth', 'bi', 'access', 'shell']

export class GatesError extends Error {}

const posix = p => p.split(path.sep).join('/')
const isDir = p => { try { return statSync(p).isDirectory() } catch { return false } }
const readJson = (file, what) => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch (error) { throw new GatesError(`${what} (${file}) cannot be read: ${error.message}`) }
}

// ---------------------------------------------------------------- families.json

/**
 * Load and validate families.json. `config` replaces the file (tests inject broken ones).
 * -> { [name]: { dirs, routes, rulesets, rulesetFiles, tests, testGlobs } } with every path
 * relative to the repo root, prefixes expanded, globs resolved.
 */
export function loadFamilies ({ root = ROOT, config, familiesPath = FAMILIES_PATH, appRoutes } = {}) {
  const cfg = config ?? readJson(familiesPath, 'families.json')
  const problems = []
  const prefixes = cfg.prefixes && typeof cfg.prefixes === 'object' ? cfg.prefixes : {}
  if (!cfg.prefixes) problems.push('"prefixes" is missing')
  const known = appRoutes ?? new Set(parseRoutes(createContext({ root })).keys())

  const expand = value => {
    if (typeof value !== 'string' || !value.trim()) return null
    const [head, ...rest] = value.split('/')
    const full = Object.hasOwn(prefixes, head) ? [prefixes[head], ...rest].join('/') : value
    if (path.isAbsolute(full) || full.split('/').includes('..')) return null
    return full
  }

  const families = cfg.families && typeof cfg.families === 'object' ? cfg.families : {}
  if (!cfg.families) problems.push('"families" is missing')
  for (const name of FAMILY_NAMES) if (!families[name]) problems.push(`family "${name}" is missing`)
  for (const name of Object.keys(families)) if (!FAMILY_NAMES.includes(name)) problems.push(`family "${name}" is not one of the plan's families (${FAMILY_NAMES.join(', ')})`)

  const out = {}
  const owner = new Map() // route -> family (shell excluded: it mounts every route)
  for (const name of FAMILY_NAMES) {
    const f = families[name]
    if (!f) continue
    const list = key => {
      if (!Array.isArray(f[key]) || f[key].length === 0) { problems.push(`${name}.${key} must be a non-empty array`); return [] }
      return f[key]
    }

    const dirs = []
    for (const raw of list('dirs')) {
      const dir = expand(raw)
      if (!dir) problems.push(`${name}.dirs: "${raw}" is not a valid repo-relative path`)
      else if (!isDir(path.join(root, dir))) problems.push(`${name}.dirs: ${dir} does not exist`)
      else dirs.push(dir)
    }

    let routes = []
    if (f.routes === 'all') routes = [...known]
    else {
      routes = list('routes')
      for (const route of routes) {
        if (typeof route !== 'string' || !known.has(route)) problems.push(`${name}.routes: ${route} is not in src/App.js`)
        else if (owner.has(route)) problems.push(`${name}.routes: ${route} is also owned by ${owner.get(route)}`)
        else owner.set(route, name)
      }
    }

    const rulesets = list('rulesets')
    const rulesetFiles = []
    for (const id of rulesets) {
      const found = typeof id === 'string' && id
        ? globSync(`${BRAND_DIR}/${id}-*rules.json`, { cwd: root }).map(posix).sort()
        : []
      if (found.length === 0) problems.push(`${name}.rulesets: "${id}" matches no ${BRAND_DIR}/${id}-*rules.json`)
      for (const file of found) if (!rulesetFiles.includes(file)) rulesetFiles.push(file)
    }

    const tests = new Set()
    const testGlobs = list('tests')
    for (const raw of testGlobs) {
      const pattern = expand(raw)
      if (!pattern) { problems.push(`${name}.tests: "${raw}" is not a valid repo-relative glob`); continue }
      const found = globSync(pattern, { cwd: root }).map(posix)
      if (found.length === 0) problems.push(`${name}.tests: ${pattern} matches no test file`)
      for (const file of found) tests.add(file)
    }

    // browser specs are optional; when a family declares them they load fail-closed like the rest
    const specs = new Set()
    const specGlobs = f.specs === undefined ? [] : list('specs')
    for (const raw of specGlobs) {
      const pattern = expand(raw)
      if (!pattern || !pattern.startsWith(`${SPECS_DIR}/`)) { problems.push(`${name}.specs: "${raw}" is not a glob under ${SPECS_DIR}/`); continue }
      const found = globSync(pattern, { cwd: root }).map(posix).filter(file => file.endsWith('.spec.js'))
      if (found.length === 0) problems.push(`${name}.specs: ${pattern} matches no spec file`)
      for (const file of found) specs.add(file)
    }

    out[name] = { name, dirs, routes, rulesets, rulesetFiles, tests: [...tests].sort(), testGlobs, specs: [...specs].sort(), specGlobs }
  }

  for (const route of known) {
    if (!owner.has(route)) problems.push(`route ${route} of src/App.js is owned by no family`)
  }
  if (problems.length) throw new GatesError(`families.json is invalid:\n  - ${problems.join('\n  - ')}`)
  return out
}

// ---------------------------------------------------------------- residue ratchet

/**
 * Compare the residue reachable today with the baseline, per route.
 *  - regression: a route reaches a legacy id (not covered by an exception) its baseline does not list.
 *  - expired: the baseline lists an id the route no longer reaches (lower it in the same change).
 *  - missing: a route with a page has no baseline entry.
 *  - orphan (only with `full`): a baseline route that is not in App.js or has no page.
 * Stale exceptions and unresolved imports from the scanner fail too.
 *
 * `result`: scan() output; `baseline`: { routes: { path: [ids] } }; `exceptions`: loadExceptions().
 * -> { ok, regressions, expired, missing, orphans, stale, unresolved, scanned }
 */
export function ratchet ({ result, baseline, exceptions, full = false }) {
  const verdict = checkResidue(result, exceptions)
  const listed = baseline?.routes
  if (!listed || typeof listed !== 'object') throw new GatesError('residue-baseline.json has no "routes" object')
  const regressions = []
  const expired = []
  const missing = []
  for (const route of Object.values(result.routes)) {
    const reached = new Set(verdict.residue.filter(r => r.route === route.path).map(r => r.legacy))
    if (!Object.hasOwn(listed, route.path)) { missing.push(route.path); continue }
    const base = new Set(listed[route.path])
    for (const hit of verdict.residue.filter(r => r.route === route.path)) {
      if (!base.has(hit.legacy)) regressions.push({ route: route.path, legacy: hit.legacy, importerCount: hit.importerCount, chain: hit.chain })
    }
    for (const id of base) if (!reached.has(id)) expired.push({ route: route.path, legacy: id })
  }
  const orphans = []
  if (full) {
    for (const route of Object.keys(listed)) if (!Object.hasOwn(result.routes, route)) orphans.push(route)
  }
  const ok = !regressions.length && !expired.length && !missing.length && !orphans.length && !verdict.stale.length && !verdict.unresolved.length
  return { ok, regressions, expired, missing, orphans, stale: verdict.stale, unresolved: verdict.unresolved, scanned: Object.keys(result.routes).length }
}

const fmtChain = chain => (chain ?? []).map(f => f.replace('@/components-dashboard/src/', 'C/')).join(' -> ')

export function formatRatchet (r) {
  const lines = []
  for (const x of r.regressions) lines.push(`REGRESSION ${x.route}: reaches ${x.legacy} (${x.importerCount} importing files), not in residue-baseline.json\n    ${fmtChain(x.chain)}`)
  for (const x of r.expired) lines.push(`STALE BASELINE ${x.route}: ${x.legacy} is no longer reachable; lower residue-baseline.json (node scripts/redesign/residue-scan.mjs --write-baseline) in the same change`)
  for (const route of r.missing) lines.push(`MISSING BASELINE ${route}: route has a page but no entry in residue-baseline.json (--write-baseline)`)
  for (const route of r.orphans) lines.push(`ORPHAN BASELINE ${route}: not a route with a page in src/App.js`)
  for (const s of r.stale) lines.push(`STALE EXCEPTION ${s.route}: ${s.legacy} (${s.why})`)
  for (const u of r.unresolved) lines.push(`UNRESOLVED ${u.route}: ${u.from}: ${u.what}`)
  lines.push(r.ok ? `residue ratchet: OK (${r.scanned} routes)` : `residue ratchet: FAILED (${r.regressions.length} regressions, ${r.expired.length} stale baseline ids, ${r.missing.length} missing, ${r.orphans.length} orphans, ${r.stale.length} stale exceptions, ${r.unresolved.length} unresolved)`)
  return lines.join('\n')
}

/** Run the ratchet over `routes` (default: every route of App.js). */
export function runRatchet ({ routes, root = ROOT, baselinePath = BASELINE_PATH } = {}) {
  const baseline = readJson(baselinePath, 'residue-baseline.json')
  const result = scan({ routes, root })
  const exceptions = loadExceptions({ legacy: loadLegacy({ root }) })
  return ratchet({ result, baseline, exceptions, full: routes === undefined })
}

// ---------------------------------------------------------------- steps

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
const stripAnsi = text => text.replace(ANSI, '')

export function runVitest (files, root = ROOT) {
  if (!files.length) return { ok: false, detail: 'no test files', output: 'no test files to run' }
  const bin = createRequire(path.join(root, 'package.json')).resolve('vitest/vitest.mjs')
  const run = spawnSync(process.execPath, [bin, '--run', ...files], {
    cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', CI: '1' }
  })
  const output = stripAnsi(`${run.stdout ?? ''}${run.stderr ?? ''}`)
  const files_ = output.match(/Test Files\s+(.*)/)?.[1]?.trim()
  const tests_ = output.match(/^\s*Tests\s+(.*)/m)?.[1]?.trim()
  const detail = run.error ? `could not run vitest: ${run.error.message}` : [files_ && `files ${files_}`, tests_ && `tests ${tests_}`].filter(Boolean).join(' · ') || `vitest exited ${run.status}`
  return { ok: run.status === 0 && !run.error, detail, output }
}

// the family's brand-system specs, in one Playwright run with the harness config.
export function runPlaywright (files, root = ROOT) {
  if (!files.length) return { ok: false, detail: 'no spec files', output: 'no spec files to run' }
  const bin = createRequire(path.join(root, 'package.json')).resolve('@playwright/test/cli')
  const run = spawnSync(process.execPath, [bin, 'test', '--config', PLAYWRIGHT_CONFIG, ...files], {
    cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', CI: '1' }
  })
  const output = stripAnsi(`${run.stdout ?? ''}${run.stderr ?? ''}`)
  const counts = ['passed', 'failed', 'flaky', 'skipped', 'did not run'].map(kind => {
    const n = output.match(new RegExp(`^\\s*(\\d+) ${kind}`, 'm'))?.[1]
    return n && `${n} ${kind}`
  }).filter(Boolean)
  // the harness port is shared by every session (3017 unless BRAND_HARNESS_PORT): say so when that is why it failed
  const portTaken = /already used|EADDRINUSE/.test(output) ? `; harness port ${process.env.BRAND_HARNESS_PORT ?? 3017} is taken: wait for it or set BRAND_HARNESS_PORT` : ''
  const detail = run.error ? `could not run playwright: ${run.error.message}` : `${files.length} specs${counts.length ? `: ${counts.join(' · ')}` : `, playwright exited ${run.status}`}${portTaken}`
  return { ok: run.status === 0 && !run.error, detail, output }
}

export async function verifyRulesets (files, root = ROOT) {
  const { loadRules, verifyMigration } = await import(pathToFileURL(path.join(root, BRAND_DIR, 'migration.mjs')).href)
  const failures = []
  for (const file of files) {
    try {
      const { ruleset, hash } = await loadRules(path.join(root, file))
      const allowlist = [...new Set([...ruleset.rules, ...(ruleset.preservations ?? [])].map(rule => rule.file))]
      const result = await verifyMigration({ rootDir: root, ruleset, rulesHash: hash, allowlist })
      if (!result.ok || result.changes.length || result.skips.length) {
        const sample = result.skips.slice(0, 5).map(s => `    ${s.file} ${s.rule ?? ''} ${s.reason}${s.property ? ` (${s.property})` : ''}`).join('\n')
        failures.push(`${file}: ok=${result.ok}, ${result.changes.length} changes, ${result.skips.length} skips\n${sample}`)
      }
    } catch (error) {
      failures.push(`${file}: ${error.message}`)
    }
  }
  return { ok: failures.length === 0, detail: `${files.length} rulesets${failures.length ? `, ${failures.length} not conformant` : ''}`, output: failures.join('\n') }
}

// step 8. The probe's static cases in chromium (a probe that stops seeing the owner's case fails), then the baseline.
export function runOverlaps ({ root = ROOT, baselinePath = OVERLAP_BASELINE_PATH, check = OVERLAP_CHECK } = {}) {
  const run = spawnSync(process.execPath, [check], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 })
  const output = stripAnsi(`${run.stdout ?? ''}${run.stderr ?? ''}`)
  const failedCases = (output.match(/^FAIL /gm) || []).length
  const cases = (output.match(/^(ok|FAIL) /gm) || []).length
  let problems
  try {
    problems = validateBaseline({ baseline: readJson(baselinePath, 'overlap-baseline.json'), routes: readRoutes(path.join(root, OVERLAP_ROUTES)) })
  } catch (error) {
    problems = [error.message]
  }
  const probeOk = run.status === 0 && !run.error && cases > 0
  const detail = `probe ${run.error ? `could not run: ${run.error.message}` : `${cases - failedCases}/${cases} cases`} · baseline ${problems.length ? `${problems.length} problems` : 'ok'}`
  return { ok: probeOk && problems.length === 0, detail, output: [probeOk ? '' : output, ...problems].filter(Boolean).join('\n') }
}

async function stepGuard (name, dirs, root) {
  const guard = await import(pathToFileURL(path.join(HERE, `${name}.mjs`)).href)
  const failures = []
  let scanned = 0
  for (const dir of dirs) {
    const result = guard.check({ family: dir, root })
    scanned += result.scanned
    if (!result.ok) failures.push(`${dir}\n${guard.formatReport(result)}`)
  }
  return { ok: failures.length === 0, detail: `${dirs.length} dirs, ${scanned} files${failures.length ? `, ${failures.length} dirs fail` : ''}`, output: failures.join('\n') }
}

/** Run every gate of one family. -> [{ step, ok, detail, output, seconds }] */
export async function runFamily (family, { root = ROOT } = {}) {
  const steps = [
    ['1 unit tests', () => runVitest(family.tests, root)],
    ['2 brand rulesets', () => verifyRulesets(family.rulesetFiles, root)],
    ['3 literal guard', () => runVitest([LITERAL_GUARD_TEST], root)],
    ['4 residue ratchet', () => {
      const r = runRatchet({ routes: family.routes, root })
      return { ok: r.ok, detail: `${r.scanned} routes${r.ok ? '' : `: ${r.regressions.length} regressions, ${r.expired.length} stale`}`, output: formatRatchet(r) }
    }],
    ['5 ISO dates', () => stepGuard('date-iso-guard', family.dirs, root)],
    ['6 Orders imports', () => stepGuard('orders-import-guard', family.dirs, root)]
  ]
  if (family.specs?.length) steps.push(['7 browser specs', () => runPlaywright(family.specs, root)]) //
  steps.push(['8 overlaps', () => runOverlaps({ root })]) //
  const rows = []
  for (const [step, fn] of steps) {
    const started = Date.now()
    let row
    try {
      row = await fn()
    } catch (error) {
      row = { ok: false, detail: `could not run: ${error.message}`, output: error.stack ?? String(error) }
    }
    rows.push({ step, ...row, seconds: (Date.now() - started) / 1000 })
  }
  return rows
}

export function formatTable (name, rows) {
  const width = Math.max(...rows.map(r => r.step.length), 4)
  const lines = [`redesign gates: ${name}`, '']
  for (const r of rows) lines.push(`${r.step.padEnd(width)}  ${r.ok ? 'PASS' : 'FAIL'}  ${r.detail}  (${r.seconds.toFixed(1)}s)`)
  const failed = rows.filter(r => !r.ok)
  lines.push('', failed.length ? `FAILED: ${failed.length} of ${rows.length} steps (${failed.map(r => r.step).join('; ')})` : `PASS: ${rows.length} of ${rows.length} steps`)
  return lines.join('\n')
}

const tailLines = (text, max) => {
  const lines = text.trimEnd().split('\n')
  return lines.length > max ? [`... (${lines.length - max} earlier lines omitted)`, ...lines.slice(-max)].join('\n') : lines.join('\n')
}

// ---------------------------------------------------------------- CLI

export function formatList (families) {
  return Object.values(families).map(f =>
    `${f.name.padEnd(11)} ${String(f.dirs.length).padStart(3)} dirs  ${String(f.routes.length).padStart(2)} routes  ${String(f.rulesetFiles.length).padStart(3)} rulesets  ${String(f.tests.length).padStart(3)} test files${f.specs.length ? `  ${f.specs.length} browser specs` : ''}`
  ).join('\n')
}

async function main (argv) {
  const args = argv.filter(a => a !== '--')
  let families
  try {
    families = loadFamilies()
  } catch (error) {
    if (!(error instanceof GatesError)) throw error
    console.error(`redesign gates: ${error.message}`)
    return 1
  }
  if (args[0] === '--list') {
    console.log(formatList(families))
    return 0
  }
  if (args[0] === '--ratchet') {
    const r = runRatchet()
    console.log(formatRatchet(r))
    return r.ok ? 0 : 1
  }
  const name = args[0]
  if (!name || args.length !== 1 || !Object.hasOwn(families, name)) {
    console.error(`usage: gates.mjs <family> | --list | --ratchet\nfamilies: ${FAMILY_NAMES.join(', ')}`)
    return 2
  }
  const rows = await runFamily(families[name])
  console.log(formatTable(name, rows))
  for (const r of rows.filter(x => !x.ok)) console.log(`\n--- ${r.step}: ${r.detail}\n${tailLines(r.output ?? '', 80)}`)
  return rows.every(r => r.ok) ? 0 : 1
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code }, error => {
    console.error(error)
    process.exitCode = 1
  })
}
