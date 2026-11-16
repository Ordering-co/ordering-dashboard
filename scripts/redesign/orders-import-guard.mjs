// redesign W0-8c (T0-32)
/**
 * Orders import guard (L2-27, plan W0-8c).
 *
 * Nothing under UI/ (src/@/components-dashboard/src/ui/src/components) outside UI/Orders, and no
 * page under src/pages except the Orders pages, imports from UI/Orders. Orders pieces that other
 * surfaces need are promoted to Shared/Product, never imported across the family boundary.
 *
 *  - What exists today is listed in scripts/redesign/orders-import-allow.json as
 *    { file, import, reason, wave }. The import is the specifier as written in the file.
 *  - An unlisted import fails. A listed import that no longer exists fails (the list expires).
 *  - Shared/Product (P/) can NEVER import from Orders. There is no list for it: an entry for a P/
 *    file is invalid, and a P/ import fails even when someone lists it.
 *
 * Resolved: relative paths, `~ui/…`, `~components/…`, `~/…`, and the barrel (`../../Orders`).
 * Not covered on purpose: the `~ui` package barrel (a named import of the barrel is not a path
 * into Orders) and test files outside P/ (a test can mock what its subject imports).
 *
 * CLI: node scripts/redesign/orders-import-guard.mjs [--family <dir>]
 * API: check({ files?, family?, sources?, allow?, root? }) -> { ok, violations, stale, invalid, scanned }
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '../..')
export const ALLOW_FILE = path.join(HERE, 'orders-import-allow.json')

export const UI = 'src/@/components-dashboard/src/ui/src/components'
export const ORDERS_DIR = `${UI}/Orders`
export const PRODUCT_DIR = `${UI}/Shared/Product`
export const PAGES_DIR = 'src/pages'
// Pages that belong to the Orders family: they may import from Orders.
export const ORDERS_PAGES = ['OrdersList']

const ALIASES = [
  ['~ui', 'src/@/components-dashboard/src/ui'],
  ['~components', 'src/@/components-dashboard/src'],
  ['~', 'src']
]
const SCANNED_EXT = /\.(?:js|jsx|mjs|ts|tsx)$/
const TEST_FILE = /(?:^|\/)__tests__\/|\.(?:test|spec)\.[jt]sx?$/
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|\b(?:vi|jest)\.(?:mock|doMock|importActual|requireActual)\s*\(\s*)(['"`])([^'"`\n]+)\1/g

const posix = p => p.split(path.sep).join('/')
const under = (file, dir) => file === dir || file.startsWith(`${dir}/`)

const stripComments = text => text
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/^\s*\/\/.*$/gm, m => ' '.repeat(m.length))

/** [{ specifier, line }] of every import-like string in the source (unique per specifier). */
export const extractImports = source => {
  const text = stripComments(source)
  const seen = new Map()
  for (const match of text.matchAll(SPECIFIER)) {
    const specifier = match[2]
    if (!seen.has(specifier)) seen.set(specifier, text.slice(0, match.index).split('\n').length)
  }
  return [...seen].map(([specifier, line]) => ({ specifier, line }))
}

/** Repo-relative target of a specifier, or null when it is a package. */
export const resolveSpecifier = (file, specifier) => {
  if (specifier.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
  for (const [alias, target] of ALIASES) {
    if (specifier === alias || specifier.startsWith(`${alias}/`)) {
      return path.posix.normalize(`${target}${specifier.slice(alias.length)}`)
    }
  }
  return null
}

export const importsOrders = (file, specifier) => {
  const target = resolveSpecifier(file, specifier)
  return target !== null && under(target, ORDERS_DIR)
}

/** 'product' | 'ui' | 'page' | null: which rule governs this file (null: not governed). */
export const governedKind = file => {
  if (!SCANNED_EXT.test(file)) return null
  if (under(file, PRODUCT_DIR)) return 'product'
  if (TEST_FILE.test(file)) return null
  if (under(file, UI) && !under(file, ORDERS_DIR)) return 'ui'
  if (under(file, PAGES_DIR)) {
    const page = file.slice(PAGES_DIR.length + 1).split('/')[0]
    return ORDERS_PAGES.includes(page) ? null : 'page'
  }
  return null
}

/** Every import from Orders in the given sources: [{ file, import, line, kind }]. */
export const scanSources = sources => {
  const found = []
  for (const [file, text] of Object.entries(sources)) {
    const kind = governedKind(file)
    if (!kind) continue
    for (const { specifier, line } of extractImports(text)) {
      if (importsOrders(file, specifier)) found.push({ file, import: specifier, line, kind })
    }
  }
  return found
}

const walk = (root, dir) => {
  const abs = path.join(root, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs).flatMap(name => {
    const rel = `${dir}/${name}`
    if (statSync(path.join(root, rel)).isDirectory()) return name === 'node_modules' ? [] : walk(root, rel)
    return [rel]
  })
}

export const loadAllow = (file = ALLOW_FILE) => JSON.parse(readFileSync(file, 'utf8')).entries

const toRelative = (root, file) => posix(path.isAbsolute(file) ? path.relative(root, file) : file)

export const check = ({ files, family, sources, allow, root = ROOT } = {}) => {
  const entries = allow || loadAllow()
  const familyDir = family ? toRelative(root, path.resolve(root, family)) : null

  let scanned
  if (sources) {
    scanned = sources
  } else {
    const candidates = files
      ? files.map(f => toRelative(root, f))
      : [UI, PAGES_DIR].flatMap(dir => walk(root, dir))
    scanned = {}
    for (const file of candidates) {
      if (familyDir && !under(file, familyDir)) continue
      if (!governedKind(file) || !existsSync(path.join(root, file))) continue
      scanned[file] = readFileSync(path.join(root, file), 'utf8')
    }
  }
  const scannedFiles = new Set(Object.keys(scanned))
  const findings = scanSources(scanned)

  const invalid = []
  const keyOf = e => `${e.file}\u0000${e.import}`
  const listed = new Map()
  for (const entry of entries) {
    const problems = []
    for (const field of ['file', 'import', 'reason', 'wave']) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) problems.push(`missing ${field}`)
    }
    if (typeof entry.file === 'string' && under(entry.file, PRODUCT_DIR)) {
      problems.push('Shared/Product can never import from Orders: there is no list for it')
    }
    if (listed.has(keyOf(entry))) problems.push('duplicate entry')
    listed.set(keyOf(entry), entry)
    if (problems.length) invalid.push({ entry, problems })
  }

  const violations = []
  const used = new Set()
  for (const finding of findings) {
    if (finding.kind === 'product') {
      violations.push({ ...finding, why: 'Shared/Product must never import from Orders (not listable)' })
    } else if (listed.has(keyOf(finding))) {
      used.add(keyOf(finding))
    } else {
      violations.push({ ...finding, why: 'import from Orders outside Orders, not in orders-import-allow.json' })
    }
  }

  const inReach = entry => {
    if (sources || files) return scannedFiles.has(entry.file)
    if (familyDir) return under(entry.file, familyDir)
    return true
  }
  const stale = entries.filter(entry => inReach(entry) && !used.has(keyOf(entry)))
    .filter(entry => typeof entry.file === 'string' && !under(entry.file, PRODUCT_DIR))

  return {
    ok: !violations.length && !stale.length && !invalid.length,
    violations,
    stale,
    invalid,
    scanned: scannedFiles.size,
    allowed: used.size
  }
}

export const formatReport = result => {
  const lines = []
  for (const v of result.violations) lines.push(`FAIL ${v.file}:${v.line} imports '${v.import}': ${v.why}`)
  for (const e of result.stale) lines.push(`FAIL stale entry (the import no longer exists, remove it): ${e.file} '${e.import}'`)
  for (const { entry, problems } of result.invalid) lines.push(`FAIL invalid entry ${entry.file} '${entry.import}': ${problems.join('; ')}`)
  lines.push(result.ok
    ? `orders-import-guard: OK (${result.scanned} files scanned, ${result.allowed} listed imports)`
    : `orders-import-guard: FAILED (${result.violations.length} new, ${result.stale.length} stale, ${result.invalid.length} invalid entries)`)
  return lines.join('\n')
}

const main = () => {
  const args = process.argv.slice(2)
  const at = args.indexOf('--family')
  const family = at > -1 ? args[at + 1] : undefined
  if (at > -1 && !family) {
    console.error('orders-import-guard: --family needs a directory')
    process.exit(2)
  }
  const result = check({ family })
  console.log(formatReport(result))
  process.exit(result.ok ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
