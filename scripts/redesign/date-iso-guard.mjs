// redesign W0-8c (T0-32)
/**
 * ISO date guard (decision 13: an ISO date is never visible; one format per surface, the one in
 * `dates_general_format`, through `parseDate`).
 *
 * A static scanner over all of src/@/components-dashboard/src (UI and controllers; no tests, no
 * node_modules). The scanned set never depends on the list, so removing an entry
 * can only turn the run red; an entry whose file is gone expires. With --family <dir>, every
 * non-test .js/.jsx under that directory.
 * It flags the patterns that paint an ISO date or a fixed format:
 *
 *  - a string literal that is a fixed date format: 'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY-MM-DD HH:mm',
 *    'MMM D', 'DD/MM/YYYY'… (two of year, month, day), e.g. in `.format(` of moment/dayjs or in
 *    `parseDate(x, { outputFormat })`
 *  - an empty `.format()` on moment/dayjs (it prints ISO 8601), `toISOString(`, `.toJSON(`
 *  - `toLocaleDateString(` without the project format on the same line
 *
 * Allowed without a list: machine attributes (`dateTime=`, `datetime`), request parameters (a line
 * with where, params, query, URLSearchParams or filter, or the body of an object that opens on such
 * a line), comments and tests. Two more machine uses are recognised per literal (L1-33):
 *  - a PARSE format: the literal is the second argument of dayjs( / moment( / dayjs.utc( /
 *    moment.utc( / dayjs.tz( / isValidMoment( , or the line is an `inputFormat` default. A parse
 *    format reads a string; it cannot paint one (painting is `.format(`, `outputFormat`, which stay
 *    flagged even on the same line).
 *  - a STORAGE write: a toISOString( / toJSON( on a line that calls safeStorageSet( or
 *    localStorage|sessionStorage.setItem( (a timestamp kept in the browser, never rendered).
 *
 * What exists today is listed in scripts/redesign/date-iso-allow.json as
 * { file, line-text, reason, wave [, count] }. It matches on the text of the line (trimmed), never
 * on its number, so edits above do not break it. `count` (default 1) is how many lines with that
 * text the file has. An entry that no longer matches exactly fails: remove it or fix the count.
 *
 * CLI: node scripts/redesign/date-iso-guard.mjs [--family <dir>]
 * API: check({ files?, family?, sources?, allow?, root? }) -> { ok, violations, stale, invalid, scanned }
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '../..')
export const ALLOW_FILE = path.join(HERE, 'date-iso-allow.json')
export const GOVERNED_FILE = path.join(ROOT, 'scripts/product-ui/governed-files.json')
export const PRODUCT_DIR = 'src/@/components-dashboard/src/ui/src/components/Shared/Product'
// The default scan: all of the dashboard source (UI and controllers). It never depends on the list.
export const SCAN_ROOT = 'src/@/components-dashboard/src'

const SCANNED_EXT = /\.(?:js|jsx|mjs)$/
const TEST_FILE = /(?:^|\/)__tests__\/|\.(?:test|spec)\.[jt]sx?$/

const posix = p => p.split(path.sep).join('/')
const under = (file, dir) => file === dir || file.startsWith(`${dir}/`)

const stripComments = text => text
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|\s)\/\/.*$/gm, (m, lead) => lead + ' '.repeat(m.length - lead.length))

// moment/dayjs token runs: letter -> allowed run lengths, and which part of the date it is.
const TOKENS = new Map([
  ['Y', [2, 4, 'year']],
  ['M', [1, 4, 'month']],
  ['D', [1, 4, 'day']],
  ['d', [1, 4, null]],
  ['H', [1, 2, null]],
  ['h', [1, 2, null]],
  ['m', [1, 2, null]],
  ['s', [1, 2, null]],
  ['S', [1, 3, null]],
  ['A', [1, 1, null]],
  ['a', [1, 1, null]],
  ['Z', [1, 2, null]]
])

/** True when the whole string is a moment/dayjs format that names two of year, month and day. */
export const isFixedDateFormat = literal => {
  if (/YYYYMMDD/.test(literal)) return true
  const text = literal
    .replace(/\[[^\]]*\]/g, '|')
    .replace(/(?<=D)T(?=[Hh])/g, ' ')
    .replace(/\b(DDDo|Do|Mo)\b/g, 'D')
  const parts = new Set()
  for (const run of text.split(/[^A-Za-z]+/).filter(Boolean)) {
    const rule = TOKENS.get(run[0])
    if (!rule || [...run].some(ch => ch !== run[0]) || run.length < rule[0] || run.length > rule[1]) return false
    if (rule[2]) parts.add(rule[2])
  }
  return parts.size >= 2
}

const STRING = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g
const REQUEST_WORD = /(?<![A-Za-z])(?:where|params|query|URLSearchParams|filters?)(?![a-z])|(?<=[a-z])(?:Where|Params|Query|Filters?)(?![a-z])/
const REQUEST_OPENER = new RegExp(`${REQUEST_WORD.source}[^\\n]*[{(\\[]\\s*$`)
const MACHINE_ATTRIBUTE = /(?<![\w])(?:dateTime|datetime)(?![\w])/
const EMPTY_FORMAT = /\b(?:moment|dayjs)\([^)]*\)(?:\.\w+\([^)]*\))*\.format\(\s*\)/

const indentOf = line => line.length - line.trimStart().length

const isMachineContext = (lines, index) => {
  const line = lines[index]
  if (MACHINE_ATTRIBUTE.test(line) || REQUEST_WORD.test(line)) return true
  // The body of an object or call that opens on a request line (params: {, where: [, query = {).
  for (let back = index - 1; back >= Math.max(0, index - 6); back -= 1) {
    const previous = lines[back]
    if (!previous.trim() || indentOf(previous) >= indentOf(line)) continue
    return REQUEST_OPENER.test(previous)
  }
  return false
}

// The text just before a literal ends in `dayjs(<first argument>, ` : the literal is a parse format.
const PARSE_ARGUMENT = /(?:\b(?:dayjs|moment)(?:\.(?:utc|tz))?|\bisValidMoment)\((?:[^()]|\([^()]*\))*,\s*$/
const INPUT_FORMAT_LINE = /\binputFormat\b/
const STORAGE_WRITE = /\bsafeStorageSet\s*\(|\b(?:localStorage|sessionStorage)\.setItem\s*\(/

const reasonsOf = line => {
  const reasons = []
  for (const match of line.matchAll(STRING)) {
    if (match[2].includes('${') || !isFixedDateFormat(match[2])) continue
    if (PARSE_ARGUMENT.test(line.slice(0, match.index)) || (INPUT_FORMAT_LINE.test(line) && !/\boutputFormat\b/.test(line))) continue
    reasons.push(`fixed date format '${match[2]}'`)
  }
  const stored = STORAGE_WRITE.test(line)
  if (EMPTY_FORMAT.test(line)) reasons.push('moment/dayjs .format() with no format prints ISO 8601')
  if (!stored && /\btoISOString\s*\(/.test(line)) reasons.push('toISOString(')
  if (!stored && /\.toJSON\s*\(/.test(line)) reasons.push('.toJSON(')
  if (/\btoLocaleDateString\s*\(/.test(line) && !/dates_general_format|parseDate\s*\(/.test(line)) {
    reasons.push('toLocaleDateString( without the project format')
  }
  return reasons
}

/** Findings in one source: [{ line, text, reason }] (text is the trimmed line). */
export const scanSource = source => {
  const lines = stripComments(source).split('\n')
  const raw = source.split('\n')
  const findings = []
  lines.forEach((line, index) => {
    if (!line.trim()) return
    const reasons = reasonsOf(line)
    if (reasons.length && !isMachineContext(lines, index)) {
      findings.push({ line: index + 1, text: raw[index].trim(), reason: reasons.join('; ') })
    }
  })
  return findings
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

const scannable = file => SCANNED_EXT.test(file) && !TEST_FILE.test(file)

/** The files governed by the Product guards: all of Shared/Product plus governed-files.json (code files only). */
export const governedFiles = (root = ROOT) => {
  const listed = JSON.parse(readFileSync(path.join(root, 'scripts/product-ui/governed-files.json'), 'utf8')).files
  return [...new Set([...walk(root, PRODUCT_DIR), ...listed])].filter(scannable).sort()
}

/**
 * The default scan set: every code file under src/@/components-dashboard/src (no tests, no
 * node_modules). It does not read the allow list: removing an entry can never
 * shrink what is scanned (L1-33, mutation 3).
 */
export const scanFiles = (root = ROOT) => [...new Set([...walk(root, SCAN_ROOT), ...governedFiles(root)])]
  .filter(scannable)
  .sort()

export const loadAllow = (file = ALLOW_FILE) => JSON.parse(readFileSync(file, 'utf8')).entries

// Findings per source text: a run that repeats the same scan (the tests remove one entry at a time) pays once.
const scanCache = new Map()
const findingsOf = text => {
  if (!scanCache.has(text)) scanCache.set(text, scanSource(text))
  return scanCache.get(text)
}

const toRelative = (root, file) => posix(path.isAbsolute(file) ? path.relative(root, file) : file)
const keyOf = (file, text) => `${file}\u0000${text}`

export const check = ({ files, family, sources, allow, root = ROOT } = {}) => {
  const entries = allow || loadAllow()
  const familyDir = family ? toRelative(root, path.resolve(root, family)) : null

  const scanned = {}
  if (sources) {
    for (const [file, text] of Object.entries(sources)) if (scannable(file)) scanned[file] = text
  } else {
    const candidates = familyDir
      ? walk(root, familyDir)
      : (files ? files.map(f => toRelative(root, f)) : scanFiles(root))
    for (const file of candidates) {
      if (!scannable(file) || !existsSync(path.join(root, file))) continue
      scanned[file] = readFileSync(path.join(root, file), 'utf8')
    }
  }
  const scannedFiles = new Set(Object.keys(scanned))

  const invalid = []
  const listed = new Map()
  for (const entry of entries) {
    const problems = []
    for (const field of ['file', 'line-text', 'reason', 'wave']) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) problems.push(`missing ${field}`)
    }
    if (entry.count !== undefined && !(Number.isInteger(entry.count) && entry.count > 1)) problems.push('count must be an integer above 1 (omit it for 1)')
    if (listed.has(keyOf(entry.file, entry['line-text']))) problems.push('duplicate entry')
    listed.set(keyOf(entry.file, entry['line-text']), entry)
    if (problems.length) invalid.push({ entry, problems })
  }

  // Group findings by (file, line text): the list is keyed on text, not on line number.
  const groups = new Map()
  for (const [file, text] of Object.entries(scanned)) {
    for (const finding of findingsOf(text)) {
      const key = keyOf(file, finding.text)
      if (!groups.has(key)) groups.set(key, { file, text: finding.text, reason: finding.reason, lines: [] })
      groups.get(key).lines.push(finding.line)
    }
  }

  const violations = []
  const stale = []
  let allowed = 0
  for (const [key, group] of groups) {
    const entry = listed.get(key)
    const expected = entry ? (entry.count || 1) : 0
    if (!entry) {
      for (const line of group.lines) violations.push({ file: group.file, line, text: group.text, why: `${group.reason}; not in date-iso-allow.json` })
    } else if (group.lines.length > expected) {
      for (const line of group.lines.slice(expected)) violations.push({ file: group.file, line, text: group.text, why: `${group.reason}; listed ${expected} time(s), found ${group.lines.length}` })
      allowed += expected
    } else if (group.lines.length < expected) {
      stale.push({ entry, found: group.lines.length })
    } else {
      allowed += expected
    }
  }

  const inReach = entry => {
    if (familyDir) return under(entry.file, familyDir)
    if (sources || files) return scannedFiles.has(entry.file)
    return true
  }
  for (const entry of entries) {
    if (inReach(entry) && !groups.has(keyOf(entry.file, entry['line-text']))) stale.push({ entry, found: 0 })
  }

  return {
    ok: !violations.length && !stale.length && !invalid.length,
    violations,
    stale,
    invalid,
    scanned: scannedFiles.size,
    allowed
  }
}

export const formatReport = result => {
  const lines = []
  for (const v of result.violations) lines.push(`FAIL ${v.file}:${v.line} ${v.why}\n     ${v.text}`)
  for (const { entry, found } of result.stale) {
    lines.push(`FAIL stale entry (listed ${entry.count || 1}, found ${found}; fix or remove it): ${entry.file}\n     ${entry['line-text']}`)
  }
  for (const { entry, problems } of result.invalid) lines.push(`FAIL invalid entry ${entry.file} '${entry['line-text']}': ${problems.join('; ')}`)
  lines.push(result.ok
    ? `date-iso-guard: OK (${result.scanned} files scanned, ${result.allowed} listed lines)`
    : `date-iso-guard: FAILED (${result.violations.length} new, ${result.stale.length} stale, ${result.invalid.length} invalid entries)`)
  return lines.join('\n')
}

const main = () => {
  const args = process.argv.slice(2)
  const at = args.indexOf('--family')
  const family = at > -1 ? args[at + 1] : undefined
  if (at > -1 && !family) {
    console.error('date-iso-guard: --family needs a directory')
    process.exit(2)
  }
  const result = check({ family })
  console.log(formatReport(result))
  process.exit(result.ok ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
