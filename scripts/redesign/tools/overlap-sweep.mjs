// Measure overlaps in a local browser session backed by synthetic data.
// In the dirty state the probe enters values without submitting the form.
// Use a session that intercepts writes before running the probe.
//
//   pnpm redesign:overlaps --session 4451 [--session 4452 …] [--routes scripts/redesign/tools/overlap-routes.txt]
//     [--only /settings,/my-products/dashboard] [--widths 1440,1280,912,390] [--states initial,dirty] [--concurrency 3]
//     [--wait 6000] [--settle 1500] [--reload] [--out <dir>, default .local/redesign-evidence/overlaps (git-ignored)] [--baseline scripts/redesign/overlap-baseline.json] [--write-baseline]
//
// For each url it loads the page once and, at each width, scrolls the main scroller through (overlapScroll) and runs overlapProbe at
// each step (state «initial»); then it types into up to three fields (overlapDirty) and does the same again at each width (state
// «dirty»; «n/a» when the page has no field). Pairs are merged by their key (the two selectors). Output: <out>/overlaps.json, one line per
// measurement, and the pairs.
//
// Baseline (scripts/redesign/overlap-baseline.json, its own file): { "<url> @<width> <state>": [pair keys] }. With --baseline the
// sweep fails (exit 1) when a measurement has a pair its entry does not list (NEW); a listed pair that is gone is reported as
// STALE (lower the baseline in the same change, with --write-baseline). A url × width × state with no entry must have 0 pairs.
// --write-baseline rewrites the entries of what was measured and keeps the rest.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { overlapProbeSource, overlapScrollSource, overlapDirtySource } from './overlap-probe.mjs'
import { compareBaseline, entryKey, readRoutes, rewriteBaseline } from './overlap-baseline.mjs'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i > -1 ? args[i + 1] : fallback
}
const all = name => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []))
const sessions = all('session')
if (!sessions.length) throw new Error('Use --session with an explicit local synthetic browser session.')
const widths = arg('widths', '1440,1280,912,390').split(',').map(Number)
const states = arg('states', 'initial,dirty').split(',')
const concurrency = Number(arg('concurrency', '3'))
const wait = Number(arg('wait', '6000'))
const steps = Number(arg('steps', '12'))
const settle = Number(arg('settle', '1500'))
const out = resolve(arg('out', '.local/redesign-evidence/overlaps'))
const baselinePath = arg('baseline') ? resolve(arg('baseline')) : null
const routesFile = resolve(arg('routes', 'scripts/redesign/tools/overlap-routes.txt'))

const urls = arg('only') ? arg('only').split(',') : readRoutes(routesFile)
mkdirSync(out, { recursive: true })

// One load per URL: the tab is loaded once at the first
// width and resized for the others (`--settle` ms after each resize), so each page asks the API for its data once instead of four
// times. `--reload` loads the page again at every width, for a component that only reads the width when it mounts.
const job = (url, list) => `async (page, ctx) => {
  const probe = new Function('return (' + ${JSON.stringify(overlapProbeSource)} + ')')()
  const scroll = new Function('return (' + ${JSON.stringify(overlapScrollSource)} + ')')()
  const dirty = new Function('return (' + ${JSON.stringify(overlapDirtySource)} + ')')()
  const tab = await ctx.context.newPage()
  const scan = async () => {
    const pairs = new Map()
    let items = 0
    for (let step = 0; step < ${steps}; step++) {
      const at = await tab.evaluate(scroll, step)
      await tab.waitForTimeout(250)
      const r = await tab.evaluate(probe, { samples: 1000 })
      items = Math.max(items, r.items)
      for (const p of r.pairs) { const prev = pairs.get(p.key); if (!prev || prev.overlap.w * prev.overlap.h < p.overlap.w * p.overlap.h) pairs.set(p.key, { ...p, scrollTop: at.at }) }
      if (at.done) break
    }
    await tab.evaluate(scroll, 0)
    return { items, count: pairs.size, pairs: [...pairs.values()] }
  }
  const widths = ${JSON.stringify(list)}
  const states = ${JSON.stringify(states)}
  const size = async (w, settle) => {
    await tab.setViewportSize({ width: w, height: w < 768 ? 844 : 900 })
    if (settle) await tab.waitForTimeout(${settle})
  }
  try {
    await size(widths[0], false)
    await tab.goto(new URL(${JSON.stringify(url)}, page.url()).href, { waitUntil: 'domcontentloaded' })
    await tab.waitForTimeout(${wait})
    const finalUrl = tab.url().replace(/^https?:\\/\\/[^/]+/, '')
    const res = Object.fromEntries(widths.map(w => [w, {}]))
    if (states.includes('initial')) {
      for (const [i, w] of widths.entries()) {
        if (i) await size(w, true)
        res[w].initial = await scan()
      }
    }
    if (states.includes('dirty')) {
      // the fields are typed once, at the first width that has any; the change stays while the tab is resized
      let typed = null
      for (const [i, w] of widths.entries()) {
        if (i || states.includes('initial')) await size(w, i > 0 || widths.length > 1)
        if (!typed) {
          const fields = await tab.evaluate(dirty, 3)
          for (const f of fields) {
            const field = tab.locator('[data-overlap-dirty="' + f.n + '"]')
            if (f.kind === 'select') await field.selectOption(f.value).catch(() => {})
            else if (f.kind === 'click') await field.click({ timeout: 3000, force: true }).catch(() => field.dispatchEvent('click').catch(() => {}))
            else await field.fill(f.value).catch(() => {})
          }
          if (fields.length) { await tab.waitForTimeout(900); typed = fields }
        }
        res[w].dirty = typed ? { fields: typed.map(f => f.selector), ...(await scan()) } : { na: true, items: 0, count: 0, pairs: [] }
      }
    }
    return { finalUrl, res, synthetic: ctx.synthetic().length }
  } finally { await tab.close() }
}`

const run = async (session, fn) => {
  const res = await fetch(`http://127.0.0.1:${session}/run`, { method: 'POST', body: fn })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error)
  return json.result
}

const jobs = []
for (const url of urls) {
  if (args.includes('--reload')) for (const width of widths) jobs.push({ url, list: [width] })
  else jobs.push({ url, list: widths })
}
const rows = []
let next = 0
const workers = sessions.flatMap(session => Array.from({ length: concurrency }, () => session))
await Promise.all(workers.map(async session => {
  while (next < jobs.length) {
    const i = next++
    const { url, list } = jobs[i]
    const stamp = new Date().toISOString()
    try {
      const r = await run(session, job(url, list))
      for (const width of list) {
        for (const state of states) {
          const m = r.res[width][state]
          rows.push({ url, width, state: m.na ? 'n/a' : state, finalUrl: r.finalUrl, items: m.items, count: m.count, fields: m.fields, pairs: m.pairs, timestamp: stamp })
        }
      }
      console.log(`[${i + 1}/${jobs.length}] ${url} -> ${r.finalUrl} ${list.map(w => `@${w} ${states.map(s => `${s}=${r.res[w][s].na ? 'n/a' : r.res[w][s].count}`).join(' ')}`).join(' · ')}`)
    } catch (error) {
      for (const width of list) rows.push({ url, width, state: 'error', error: String(error).slice(0, 300), timestamp: stamp })
      console.log(`[${i + 1}/${jobs.length}] ${url} -> ERROR ${String(error).slice(0, 120)}`)
    }
  }
}))
rows.sort((a, b) => urls.indexOf(a.url) - urls.indexOf(b.url) || widths.indexOf(a.width) - widths.indexOf(b.width) || String(a.state).localeCompare(String(b.state)))
writeFileSync(`${out}/overlaps.json`, JSON.stringify(rows, null, 1))

const measured = rows.filter(r => r.state !== 'error' && r.state !== 'n/a')
const total = measured.reduce((a, r) => a + r.count, 0)
console.log(`\n${measured.length} measurements, ${total} overlapping pairs, ${rows.filter(r => r.state === 'error').length} errors -> ${out}/overlaps.json`)
for (const r of measured.filter(x => x.count)) {
  console.log(`\n${entryKey(r.url, r.width, r.state)} (${r.finalUrl}): ${r.count}`)
  for (const p of r.pairs.slice(0, 8)) console.log(`   ${p.a.selector} «${p.a.text}» ${JSON.stringify(p.a.box)}  ×  ${p.b.selector} «${p.b.text}» ${JSON.stringify(p.b.box)}  ${p.overlap.w}x${p.overlap.h}`)
}

let failed = rows.some(r => r.state === 'error')
if (baselinePath) {
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : { entries: {}, reasons: {} }
  if (args.includes('--write-baseline')) {
    writeFileSync(baselinePath, JSON.stringify(rewriteBaseline({ rows, baseline }), null, 1) + '\n')
    console.log(`\nbaseline written: ${baselinePath} (give every entry a reason in "reasons")`)
  } else {
    const { fresh, stale } = compareBaseline({ rows, baseline })
    for (const { entry, pair } of fresh) console.log(`NEW ${entry}: ${pair.key}  («${pair.a.text}» × «${pair.b.text}» ${pair.overlap.w}x${pair.overlap.h})`)
    for (const { entry, key } of stale) console.log(`STALE ${entry}: ${key} (gone: lower the baseline with --write-baseline)`)
    console.log(fresh.length ? `overlap baseline: FAILED (${fresh.length} new pairs, ${stale.length} stale)` : `overlap baseline: OK (${stale.length} stale)`)
    if (fresh.length) failed = true
  }
}
process.exitCode = failed ? 1 : 0
