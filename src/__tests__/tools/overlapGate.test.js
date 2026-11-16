// redesign AH: step 8 of the redesign gates (overlaps) and the overlap baseline it validates.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OVERLAP_BASELINE_PATH, OVERLAP_ROUTES, runOverlaps } from '../../../scripts/redesign/gates.mjs'
import {
  compareBaseline,
  entryKey,
  parseEntryKey,
  readRoutes,
  rewriteBaseline,
  validateBaseline
} from '../../../scripts/redesign/tools/overlap-baseline.mjs'

const root = resolve(__dirname, '../../..')
const routes = readRoutes(join(root, OVERLAP_ROUTES))
const pair = key => ({ key, a: { text: 'a' }, b: { text: 'b' }, overlap: { w: 10, h: 10 } })
const SAVE = 'div.InputFormWrapper > div.SubmitBtnWrapper > button.Button × div.InputFormWrapper > div.InnerBlock > p'

describe('overlap baseline', () => {
  it('lists the routes served by the default synthetic browser session without duplicates', () => {
    expect(routes).toEqual([
      '/login',
      '/orders',
      '/stores/list',
      '/marketing/promotions-enterprise',
      '/settings/basic',
      '/profile'
    ])
    expect(new Set(routes).size).toBe(routes.length)
  })

  it('an entry key reads back', () => {
    expect(parseEntryKey(entryKey('/settings?group=orders', 390, 'dirty'))).toEqual({ url: '/settings?group=orders', width: 390, state: 'dirty' })
    expect(parseEntryKey('/settings 390 dirty')).toBeNull()
  })

  it('the real baseline is well formed', () => {
    const baseline = JSON.parse(readFileSync(OVERLAP_BASELINE_PATH, 'utf8'))
    expect(validateBaseline({ baseline, routes })).toEqual([])
  })

  it('rejects an entry for a url, width or state the sweep does not measure, an empty entry, and an entry with no reason', () => {
    const problems = validateBaseline({
      routes,
      baseline: {
        entries: {
          '/nowhere @1440 initial': [SAVE],
          '/home @1024 initial': [SAVE],
          '/home @1440 hover': [SAVE],
          '/home @390 initial': [],
          '/orders @390 initial': [SAVE]
        },
        reasons: { '/nowhere @1440 initial': 'x', '/home @1024 initial': 'x', '/home @1440 hover': 'x', '/home @390 initial': 'x', '/gone @390 initial': 'x' }
      }
    })
    expect(problems.join('\n')).toMatch(/\/nowhere is not in overlap-routes.txt/)
    expect(problems.join('\n')).toMatch(/width 1024/)
    expect(problems.join('\n')).toMatch(/state hover/)
    expect(problems.join('\n')).toMatch(/\/home @390 initial: must be a non-empty list/)
    expect(problems.join('\n')).toMatch(/\/orders @390 initial: no reason/)
    expect(problems.join('\n')).toMatch(/reasons\.\/gone @390 initial: no such entry/)
    expect(validateBaseline({ routes, baseline: {} })).toEqual(['overlap-baseline.json has no "entries" object'])
  })

  it('a pair the baseline does not list is new (the owner\'s case comes back), a listed pair that is gone is stale', () => {
    const rows = [
      { url: '/my-products/dashboard', width: 1440, state: 'dirty', pairs: [pair(SAVE)] },
      { url: '/home', width: 390, state: 'initial', pairs: [] },
      { url: '/home', width: 390, state: 'n/a', pairs: [pair('ignored × too')] }
    ]
    const empty = compareBaseline({ rows, baseline: { entries: {} } })
    expect(empty.fresh).toEqual([{ entry: '/my-products/dashboard @1440 dirty', pair: pair(SAVE) }])
    expect(empty.stale).toEqual([])
    const listed = compareBaseline({ rows, baseline: { entries: { '/my-products/dashboard @1440 dirty': [SAVE], '/home @390 initial': ['x × y'] } } })
    expect(listed.fresh).toEqual([])
    expect(listed.stale).toEqual([{ entry: '/home @390 initial', key: 'x × y' }])
  })

  it('rewriting keeps what was not measured, lists what was found and drops what is clean (with its reason)', () => {
    const baseline = { entries: { '/a @390 initial': ['p × q'], '/b @390 initial': ['r × s'] }, reasons: { '/a @390 initial': 'kept', '/b @390 initial': 'fixed now' } }
    const next = rewriteBaseline({ baseline, rows: [{ url: '/b', width: 390, state: 'initial', pairs: [] }, { url: '/c', width: 1440, state: 'dirty', pairs: [pair('t × u'), pair('t × u')] }] })
    expect(next.entries).toEqual({ '/a @390 initial': ['p × q'], '/c @1440 dirty': ['t × u'] })
    expect(next.reasons).toEqual({ '/a @390 initial': 'kept' })
  })
})

// The probe's own check needs Chromium, which the CI test shards do not install (review of AH): here it is replaced by small
// scripts that print what it prints. `pnpm redesign:gates <family>` runs the real one (step 8).
const fakeCheck = (lines, code) => {
  const dir = mkdtempSync(join(tmpdir(), 'overlap-check-'))
  const file = join(dir, 'check.mjs')
  writeFileSync(file, `console.log(${JSON.stringify(lines.join('\n'))}); process.exit(${code})\n`)
  return file
}
const PASSING = fakeCheck(['ok   two buttons crossing by 10px: 1 pair(s)', 'ok   the owner\'s case: 3 pair(s)', 'all cases as expected'], 0)

describe('gate step 8 · overlaps', { timeout: 30_000 }, () => {
  it('passes when the probe check passes and the real baseline is well formed', () => {
    const row = runOverlaps({ root, check: PASSING })
    expect(row.ok, row.output).toBe(true)
    expect(row.detail).toBe('probe 2/2 cases · baseline ok')
  })

  it('a failing probe case is a FAIL, with the output of the check', () => {
    const row = runOverlaps({ root, check: fakeCheck(['ok   a', 'FAIL the owner\'s case: 3 pair(s)  {"count":0}', '1 case(s) failed'], 1) })
    expect(row.ok).toBe(false)
    expect(row.detail).toBe('probe 1/2 cases · baseline ok')
    expect(row.output).toContain('FAIL the owner')
  })

  it('a broken baseline is a FAIL', () => {
    const dir = mkdtempSync(join(tmpdir(), 'overlap-baseline-'))
    const bad = join(dir, 'overlap-baseline.json')
    writeFileSync(bad, JSON.stringify({ entries: { '/nowhere @1440 initial': [SAVE] } }))
    const row = runOverlaps({ root, check: PASSING, baselinePath: bad })
    expect(row.ok).toBe(false)
    expect(row.output).toMatch(/\/nowhere is not in overlap-routes.txt/)
  })

  it('a probe check that cannot run is a FAIL, not a pass', () => {
    const row = runOverlaps({ root, check: 'scripts/redesign/tools/no-such-check.mjs' })
    expect(row.ok).toBe(false)
    expect(row.detail).toMatch(/0\/0 cases/)
  })
})
