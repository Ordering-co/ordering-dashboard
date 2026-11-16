// redesign W0-8c (T0-32)
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALLOW_FILE,
  check,
  formatReport,
  governedFiles,
  isFixedDateFormat,
  loadAllow,
  scanFiles,
  scanSource
} from '../../../scripts/redesign/date-iso-guard.mjs'

const UI = 'src/@/components-dashboard/src/ui/src/components'
const FILE = `${UI}/Shared/Product/Sample.jsx`
const entry = (text, extra = {}) => ({ file: FILE, 'line-text': text, reason: 'because', wave: 'W0-4a', ...extra })
const lines = (...rows) => rows.join('\n') + '\n'

// fila 48: `check()` is synchronous (it re-reads every file), so the two mutation loops below block this worker's event loop
// for 35s alone and 150s+ on a loaded machine. Vitest's worker -> main RPC has a fixed 60s timeout that is not configurable; a call in
// flight (`onTaskUpdate`) while the loop blocks past it makes the worker report «Timeout calling "onTaskUpdate"» although every test
// passed, and `pnpm test` exits 1. Yielding once per iteration lets the reply be read; nothing else changes.
const yieldToWorker = () => new Promise(resolve => setImmediate(resolve))

describe('date iso guard: format literals', () => {
  it.each([
    'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD 23:59:59',
    'YYYY-MM-DDTHH:mm:ss', 'YYYYMMDD', 'MMM D', 'DD/MM/YYYY', 'MM/DD/YY · hh:mm A', 'MMMM D, YYYY', 'MMM Do', 'YYYY-MM'
  ])('flags %s', literal => {
    expect(isFixedDateFormat(literal)).toBe(true)
  })

  it.each([
    'HH:mm', 'hh:mm A', 'dddd', 'YYYY', 'MMMM', 'll', 'LL', 'MAD', 'Mad', 'Date', 'D', 'Sent on', '', 'YYYYY-MM-DD', 'yyyy-mm-dd'
  ])('does not flag %s', literal => {
    expect(isFixedDateFormat(literal)).toBe(false)
  })
})

describe('date iso guard: the scanner', () => {
  it('flags a fixed format painted in JSX', () => {
    const found = scanSource("const A = () => <span>{dayjs(x).format('YYYY-MM-DD')}</span>\n")
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ line: 1, reason: "fixed date format 'YYYY-MM-DD'" })
  })

  it('passes the same format in a request parameter', () => {
    expect(scanSource("const q = { params: { from: dayjs(x).format('YYYY-MM-DD') } }\n")).toEqual([])
    expect(scanSource("const where = [{ attribute: 'created_at', value: dayjs(x).format('YYYY-MM-DD') }]\n")).toEqual([])
    expect(scanSource("const url = new URLSearchParams({ day: dayjs(x).format('YYYY-MM-DD') })\n")).toEqual([])
    expect(scanSource("const dateFilter = dayjs(x).format('YYYY-MM-DD')\n")).toEqual([])
    expect(scanSource("const queryString = '?d=' + dayjs(x).format('YYYY-MM-DD')\n")).toEqual([])
  })

  it('passes the body of an object that opens on a request line, not one that closed', () => {
    const open = lines(
      'const request = {',
      '  params: {',
      "    from: dayjs(x).format('YYYY-MM-DD'),",
      '  }',
      '}'
    )
    expect(scanSource(open)).toEqual([])
    const closed = lines(
      'const request = {',
      '  params: { limit: 10 },',
      "  label: dayjs(x).format('YYYY-MM-DD')",
      '}'
    )
    expect(scanSource(closed)).toHaveLength(1)
  })

  it('passes machine attributes', () => {
    expect(scanSource("<time dateTime={dayjs(x).format('YYYY-MM-DD')}>{parseDate(x)}</time>\n")).toEqual([])
    expect(scanSource('<time datetime={x.toISOString()} />\n')).toEqual([])
  })

  it('flags toISOString, toJSON, an empty format() and a bare toLocaleDateString', () => {
    expect(scanSource('const a = <b>{new Date(x).toISOString()}</b>\n')).toHaveLength(1)
    expect(scanSource('const a = <b>{date.toJSON()}</b>\n')).toHaveLength(1)
    expect(scanSource('const a = <b>{moment(x).utc().format()}</b>\n')).toHaveLength(1)
    expect(scanSource("const a = <b>{new Date(x).toLocaleDateString('en-US')}</b>\n")).toHaveLength(1)
  })

  it('passes toLocaleDateString with the project format and parseDate itself', () => {
    expect(scanSource('const a = new Date(x).toLocaleDateString(configs.dates_general_format?.value)\n')).toEqual([])
    expect(scanSource('const a = <b>{parseDate(order.created_at)}</b>\n')).toEqual([])
  })

  it('passes a PARSE format (second argument of dayjs, moment or isValidMoment, or an inputFormat default)', () => {
    expect(scanSource("const d = dayjs(date, 'YYYY-MM-DD HH:mm')\n")).toEqual([])
    expect(scanSource("const d = dayjs.utc(state.options?.moment, 'YYYY-MM-DD HH:mm:ss').unix()\n")).toEqual([])
    expect(scanSource("const d = moment(a + ' ' + b, 'YYYY-MM-DD HH:mm').toDate()\n")).toEqual([])
    expect(scanSource("const n = dayjs(_end, 'YYYY-MM-DD').diff(dayjs(_start, 'YYYY-MM-DD'), 'days')\n")).toEqual([])
    expect(scanSource("if (value && isValidMoment(value, 'YYYY-MM-DD HH:mm:ss')) go()\n")).toEqual([])
    expect(scanSource("inputFormat: options?.inputFormat || ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD hh:mm:ss A']\n")).toEqual([])
  })

  it('still flags every painting use next to a parse format', () => {
    expect(scanSource("const a = <b>{dayjs(x, 'YYYY-MM-DD').format('YYYY-MM-DD')}</b>\n")).toHaveLength(1)
    expect(scanSource("const a = dayjs(x, 'YYYY-MM-DD').format('DD/MM/YYYY')\n")).toHaveLength(1)
    expect(scanSource("const a = dayjs(x).format('YYYY-MM-DD')\n")).toHaveLength(1)
    expect(scanSource("const a = parseDate(x, { outputFormat: 'YYYY-MM-DD' })\n")).toHaveLength(1)
    expect(scanSource("const a = format(x, 'YYYY-MM-DD')\n")).toHaveLength(1)
    expect(scanSource("const a = <b>{dayjs(x, 'YYYY-MM-DD').toISOString()}</b>\n")).toHaveLength(1)
    expect(scanSource("inputFormat: 'YYYY-MM-DD', outputFormat: 'YYYY-MM-DD'\n")).toHaveLength(1)
  })

  it('passes a timestamp written to browser storage, not one painted', () => {
    expect(scanSource("safeStorageSet('local', key, new Date().toISOString())\n")).toEqual([])
    expect(scanSource('localStorage.setItem(key, date.toJSON())\n')).toEqual([])
    expect(scanSource('const a = <b>{new Date().toISOString()}</b>\n')).toHaveLength(1)
  })

  it('flags a fixed outputFormat handed to parseDate', () => {
    expect(scanSource("const a = parseDate(x, { outputFormat: 'YYYY-MM-DD HH:mm' })\n")).toHaveLength(1)
  })

  it('ignores comments and ordinary strings', () => {
    expect(scanSource("// dayjs(x).format('YYYY-MM-DD')\n/* x.toISOString() */\nconst a = 'Sent on'\n")).toEqual([])
  })

  it('reports the trimmed text of the line, not the number', () => {
    const [found] = scanSource("\n\n    const a = dayjs(x).format('YYYY-MM-DD')\n")
    expect(found.line).toBe(3)
    expect(found.text).toBe("const a = dayjs(x).format('YYYY-MM-DD')")
  })
})

describe('date iso guard: the check', () => {
  const jsx = "const A = () => <span>{dayjs(x).format('YYYY-MM-DD')}</span>"

  it('fails a fixed format in JSX with the line named', () => {
    const result = check({ sources: { [FILE]: `${jsx}\n` }, allow: [] })
    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(formatReport(result)).toContain(`FAIL ${FILE}:1`)
  })

  it('passes the same format inside params', () => {
    const text = "const q = { params: { from: dayjs(x).format('YYYY-MM-DD') } }\n"
    expect(check({ sources: { [FILE]: text }, allow: [] }).ok).toBe(true)
  })

  it('ignores test files', () => {
    const test = `${UI}/Shared/Product/__tests__/Sample.test.jsx`
    expect(check({ sources: { [test]: `${jsx}\n` }, allow: [] }).ok).toBe(true)
  })

  it('passes a listed line, and still passes when lines are added above it', () => {
    const allow = [entry(jsx)]
    expect(check({ sources: { [FILE]: `${jsx}\n` }, allow }).ok).toBe(true)
    expect(check({ sources: { [FILE]: `import a from 'a'\n\n\nconst b = 1\n${jsx}\n` }, allow }).ok).toBe(true)
  })

  it('fails an expired entry: the line is gone or changed', () => {
    const gone = check({ sources: { [FILE]: 'const a = 1\n' }, allow: [entry(jsx)] })
    expect(gone.ok).toBe(false)
    expect(gone.stale).toHaveLength(1)
    expect(formatReport(gone)).toContain('stale entry')
    const changed = check({ sources: { [FILE]: `${jsx.replace('<span>', '<b>')}\n` }, allow: [entry(jsx)] })
    expect(changed.ok).toBe(false)
    expect(changed.stale).toHaveLength(1)
    expect(changed.violations).toHaveLength(1)
  })

  it('fails an entry whose file was deleted (full run)', () => {
    const ghost = { ...entry(jsx), file: `${UI}/Shared/UI/Ghost.jsx` }
    const result = check({ allow: [...loadAllow(), ghost] })
    expect(result.ok).toBe(false)
    expect(result.stale.map(s => s.entry)).toEqual([ghost])
  })

  it('counts repeated lines: a new copy fails, a lost copy expires', () => {
    const twice = `${jsx}\n${jsx}\n`
    expect(check({ sources: { [FILE]: twice }, allow: [entry(jsx)] }).violations).toHaveLength(1)
    expect(check({ sources: { [FILE]: twice }, allow: [entry(jsx, { count: 2 })] }).ok).toBe(true)
    expect(check({ sources: { [FILE]: `${jsx}\n` }, allow: [entry(jsx, { count: 2 })] }).stale).toHaveLength(1)
  })

  it('fails an incomplete or duplicated entry', () => {
    const noWave = check({ sources: { [FILE]: `${jsx}\n` }, allow: [{ file: FILE, 'line-text': jsx, reason: 'because' }] })
    expect(noWave.ok).toBe(false)
    expect(noWave.invalid[0].problems).toContain('missing wave')
    const twice = check({ sources: { [FILE]: `${jsx}\n` }, allow: [entry(jsx), entry(jsx)] })
    expect(twice.ok).toBe(false)
    expect(twice.invalid[0].problems).toContain('duplicate entry')
  })
})

describe('date iso guard: the real repository', () => {
  const allow = loadAllow()

  it('passes today with its list', () => {
    const result = check()
    expect(formatReport(result)).toMatch(/date-iso-guard: OK/)
    expect(result.ok).toBe(true)
    expect(result.allowed).toBe(allow.reduce((total, e) => total + (e.count || 1), 0))
  })

  it('governs all of Shared/Product and the governed-files list, never a test', () => {
    const files = governedFiles()
    expect(files.some(f => f.includes('/Shared/Product/DateRangePopover.jsx'))).toBe(true)
    expect(files.some(f => f.includes('/Orders/OrderDetails/DetailsTab.jsx'))).toBe(true)
    expect(files.some(f => /__tests__|\.test\./.test(f))).toBe(false)
    expect(ALLOW_FILE).toMatch(/date-iso-allow\.json$/)
  })

  it('scans all of components-dashboard/src by default, whatever the list says (L1-33)', () => {
    const files = scanFiles()
    const src = 'src/@/components-dashboard/src'
    expect(files.length).toBeGreaterThan(2000)
    expect(files.every(f => f.startsWith(`${src}/`))).toBe(true)
    // controllers, contexts and utils are inside; tests, node_modules and the dead origin theme are out
    for (const inside of ['components/OrdersFilter/index.js', 'contexts/UtilsContext/index.js', 'utils/settingsCustomSections.js', 'ui/src/components/Orders/OrderDetails/DetailsTab.jsx']) {
      expect(files).toContain(`${src}/${inside}`)
    }
    expect(files.some(f => /__tests__|\.test\.|\/node_modules\/|\/ui\/src\/themes\/origin\//.test(f))).toBe(false)
    // every file the list names is scanned with or without the list
    expect(allow.filter(e => !files.includes(e.file))).toEqual([])
    const noList = check({ allow: [] })
    expect(noList.scanned).toBe(files.length)
    expect(new Set(noList.violations.map(v => v.file))).toEqual(new Set(allow.map(e => e.file)))
  })

  it('judges one family by its directory', () => {
    const result = check({ family: `${UI}/Orders` })
    expect(result.ok).toBe(true)
    expect(result.allowed).toBe(allow.filter(e => e.file.startsWith(`${UI}/Orders/`)).reduce((n, e) => n + (e.count || 1), 0))
  })

  it('lists every entry with a reason and a wave', () => {
    for (const e of allow) {
      expect(e.reason).toBeTruthy()
      expect(e.wave).toMatch(/^W\d/)
      expect(e['line-text']).toBeTruthy()
    }
  })

  it('mutation: removing any real entry turns its family run red, naming its line', async () => {
    for (const [index, removed] of allow.entries()) {
      // redesign W0-2 r2: a file outside UI/ (utils) is judged by its own directory
      const family = removed.file.startsWith(`${UI}/`)
        ? removed.file.split('/').slice(0, UI.split('/').length + 1).join('/')
        : path.dirname(removed.file)
      const result = check({ family, allow: allow.filter((_, i) => i !== index) })
      expect(result.ok).toBe(false)
      expect(result.violations.some(v => v.file === removed.file && v.text === removed['line-text'])).toBe(true)
      await yieldToWorker()
    }
  }, 180000) // redesign W0-8c (T0-32): one family scan per entry (all of them); 5s timed out in the full suite under load. redesign tramo A r4 (W0-PA2-07 c): 60s was reached under load (63s measured)

  it('mutation: removing ANY entry turns the default run red, naming its line (L1-33)', async () => {
    // redesign DT-B6 (coordinator): the list goes down as legacy code leaves (a ratchet, not a bar), so no floor number
    // here; this only checks that the file loads and is well formed (the fields, duplicates and stale lines are the guard's own
    // checks, in «passes today with its list»): some entries, each naming a file that exists.
    expect(allow.length).toBeGreaterThan(0)
    for (const entry of allow) expect(existsSync(path.join(process.cwd(), entry.file)), entry.file).toBe(true)
    for (const removed of allow) {
      const result = check({ allow: allow.filter(e => e !== removed) })
      expect(result.ok).toBe(false)
      expect(result.violations.some(v => v.file === removed.file && v.text === removed['line-text'])).toBe(true)
      await yieldToWorker()
    }
  }, 300000) // redesign tramo A r4 (W0-PA2-07 c): same reason as above. fila 48: 35s alone, 146s with 100 busy threads on 36 cores; 180s left no margin

  it('the list keeps every legacy-wave entry with a reason and a wave (the new ones included)', () => {
    const fresh = allow.filter(e => !e.file.includes('/ui/src/components/'))
    expect(fresh.length).toBeGreaterThan(0)
    for (const e of fresh) expect(e.wave).toMatch(/^W\d/)
  })
})
