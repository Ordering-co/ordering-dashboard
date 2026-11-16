// Baseline measurement driver for the dashboard redesign plan (read-only).
// Usage: node measure.mjs --session 4491 --id stores-list --url "/stores/list" --widths 1440,390 --out <dir>
// Opens its OWN tab in the live session, navigates, waits, takes a viewport screenshot per width and
// collects generated figures. Never clicks anything. Output: <out>/<id>-<width>.png and <out>/<id>.json
// (<out> defaults to .local/redesign-evidence/measure, git-ignored: evidence stays out of the repository, ).
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { touchProbeSource } from './touch-probe.mjs' // redesign W0-8e (T0-34)
import { resolveAxeSource } from './axe-path.mjs' // redesign messages R2.5
import { overlapProbeSource } from './overlap-probe.mjs' // redesign AH

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const session = arg('session', '4491')
const id = arg('id')
const url = arg('url')
const widths = arg('widths', '1440,390').split(',').map(Number)
const out = resolve(arg('out', '.local/redesign-evidence/measure'))
const wait = Number(arg('wait', '6000'))
if (!id || !url) throw new Error('--id and --url are required')
mkdirSync(out, { recursive: true })

// redesign W0-8e (T0-34): the probe travels as text and is rebuilt inside the session (no escaping issues).
const TOUCH_PROBE = JSON.stringify(touchProbeSource)

// redesign AH: things drawn over each other, at every width (the viewport as loaded; overlap-sweep.mjs also
// scrolls and types into the forms)
const OVERLAP_PROBE = JSON.stringify(overlapProbeSource)

const AXE = resolveAxeSource() // redesign messages R2.5: resolved on this machine, not a fixed folder

const fn = `async (page, ctx) => {
  const results = []
  const tab = await ctx.context.newPage()
  try {
    for (const width of ${JSON.stringify(widths)}) {
      await tab.setViewportSize({ width, height: width < 768 ? 844 : 900 })
      await tab.goto(new URL(${JSON.stringify(url)}, page.url()).href, { waitUntil: 'domcontentloaded' })
      await tab.waitForTimeout(${wait})
      const shot = ${JSON.stringify(out)} + '/' + ${JSON.stringify(id)} + '-' + width + '.png'
      await tab.screenshot({ path: shot })
      const metrics = await tab.evaluate(() => {
        const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight * 3 }
        const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
        const round = n => Math.round(n * 10) / 10
        const rows = [...document.querySelectorAll('tbody tr, [role=row]')].filter(vis).map(r => round(r.getBoundingClientRect().height))
        const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox], [role=switch], [role=combobox]')].filter(vis)
        const ch = controls.map(c => round(c.getBoundingClientRect().height))
        const cw = controls.map(c => round(c.getBoundingClientRect().width))
        const small24 = controls.filter(c => { const r = c.getBoundingClientRect(); return r.height < 24 || r.width < 24 }).length
        const under44 = controls.filter(c => { const r = c.getBoundingClientRect(); return r.height < 44 }).length
        const texts = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) { const n = walker.currentNode; if (n.textContent.trim() && n.parentElement && vis(n.parentElement)) texts.push(n) }
        const sizes = {}
        const families = {}
        for (const n of texts) { const s = getComputedStyle(n.parentElement); sizes[s.fontSize] = (sizes[s.fontSize] || 0) + 1; const f = s.fontFamily.split(',')[0].replace(/["']/g, '').trim(); families[f] = (families[f] || 0) + 1 }
        const below12 = Object.entries(sizes).filter(([k]) => parseFloat(k) < 12).reduce((a, [, v]) => a + v, 0)
        const all = [...document.querySelectorAll('body *')].filter(vis)
        let legacyBlue = 0; let brandBlue = 0
        for (const el of all) { const s = getComputedStyle(el); const v = s.backgroundColor + '|' + s.color + '|' + s.borderTopColor; if (v.includes('rgb(44, 123, 229)')) legacyBlue++; if (v.includes('rgb(38, 109, 240)')) brandBlue++ }
        const svgs = [...document.querySelectorAll('svg')].filter(vis)
        const lucide = svgs.filter(s => (s.getAttribute('class') || '').includes('lucide')).length
        const bootstrapIcon = svgs.filter(s => /\\bbi\\b|bi-/.test(s.getAttribute('class') || '')).length
        const text = document.body.innerText
        const iso = (text.match(/\\b\\d{4}-\\d{2}-\\d{2}(?:[ T]\\d{2}:\\d{2})?/g) || [])
        const datePatterns = {
          iso: iso.length,
          slashDMYorMDY: (text.match(/\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b/g) || []).length,
          dashDMY: (text.match(/\\b\\d{2}-\\d{2}-\\d{4}\\b/g) || []).length,
          monthName: (text.match(/\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \\d{1,2}\\b/g) || []).length
        }
        const rawKeys = [...new Set((text.match(/\\b[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+\\b/g) || []))].slice(0, 12)
        const titleCaseButtons = [...document.querySelectorAll('button')].filter(vis).map(b => b.innerText.trim()).filter(t => /^[A-Z][a-z]+(?: [A-Z][a-z]+)+$/.test(t)).slice(0, 12)
        return {
          url: location.pathname + location.search,
          overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          rows: { count: rows.length, median: med(rows), max: rows.length ? Math.max(...rows) : null },
          controls: { count: controls.length, medianHeight: med(ch), medianWidth: med(cw), below24: small24, below44: under44 },
          type: { distinctSizes: Object.keys(sizes).length, sizes, below12, families },
          color: { legacyBlue2C7BE5: legacyBlue, brandBlue266DF0: brandBlue },
          icons: { svg: svgs.length, lucide, bootstrapIcon, other: svgs.length - lucide - bootstrapIcon },
          legacy: {
            reactDatepicker: document.querySelectorAll('.react-datepicker, .react-datepicker-wrapper').length,
            bootstrapModal: document.querySelectorAll('.modal.show, .modal-dialog').length,
            nativeSelect: [...document.querySelectorAll('select')].filter(vis).length,
            formControl: [...document.querySelectorAll('.form-control')].filter(vis).length,
            productWrappers: document.querySelectorAll('[class*="odc-"]').length
          },
          dates: { ...datePatterns, isoSamples: iso.slice(0, 5) },
          copy: { rawKeys, titleCaseButtons },
          headings: [...document.querySelectorAll('h1,h2')].filter(vis).map(h => h.tagName + ':' + h.innerText.trim().slice(0, 60)).slice(0, 6)
        }
      })
      // redesign W0-8e (T0-34): phone touch targets (visible box, 44px reach by elementFromPoint, crossings). null at >= 768.
      metrics.overlaps = await tab.evaluate(new Function('return (' + ${OVERLAP_PROBE} + ')')(), { samples: 5 })
      metrics.touch = width < 768 ? await tab.evaluate(new Function('return (' + ${TOUCH_PROBE} + ')')()) : null
      // Keyboard: five Tabs from the top, is focus visible on each stop?
      await tab.mouse.click(1, 1).catch(() => {})
      const focus = []
      for (let i = 0; i < 5; i++) {
        await tab.keyboard.press('Tab')
        focus.push(await tab.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'body'; const s = getComputedStyle(a); const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none'); return (ring ? 'ring ' : 'NO-RING ') + a.tagName.toLowerCase() + ':' + (a.getAttribute('aria-label') || a.innerText || '').trim().slice(0, 30) }))
      }
      await tab.addScriptTag({ path: ${JSON.stringify(AXE)} })
      const axe = await tab.evaluate(async () => { const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }); const by = {}; for (const v of r.violations) { if (['serious', 'critical'].includes(v.impact)) by[v.id] = (by[v.id] || 0) + v.nodes.length } return { seriousCritical: Object.values(by).reduce((a, b) => a + b, 0), rules: by } })
      results.push({ width, shot, metrics, focus, axe })
    }
  } finally { await tab.close() }
  return { results, blocked: ctx.blocked() }
}`

const res = await fetch(`http://127.0.0.1:${session}/run`, { method: 'POST', body: fn })
const json = await res.json()
writeFileSync(`${out}/${id}.json`, JSON.stringify(json, null, 1))
if (!json.ok) { console.error(json.error); process.exit(1) }
for (const r of json.result.results) {
  const m = r.metrics
  console.log(`${id} @${r.width}: url=${m.url} overflowX=${m.overflowX} rows=${m.rows.count}/med${m.rows.median} controls med h${m.controls.medianHeight} <24:${m.controls.below24} <44:${m.controls.below44} sizes=${m.type.distinctSizes} <12:${m.type.below12} legacyBlue=${m.color.legacyBlue2C7BE5} brandBlue=${m.color.brandBlue266DF0} icons lucide ${m.icons.lucide}/${m.icons.svg} iso=${m.dates.iso} axe=${r.axe.seriousCritical}`)
  if (m.overlaps) { // redesign AH
    console.log(`${id} @${r.width}: overlaps=${m.overlaps.count}${m.overlaps.pairs.map(p => `\n   ${p.a.selector} «${p.a.text}» × ${p.b.selector} «${p.b.text}» ${p.overlap.w}x${p.overlap.h}`).join('')}`)
  }
  if (m.touch) { // redesign W0-8e (T0-34)
    const t = m.touch
    console.log(`${id} @${r.width}: touch controls=${t.controls} box <32:${t.visibleBox.below32} =32:${t.visibleBox.at32} 32-44:${t.visibleBox.between32and44} >=44:${t.visibleBox.atLeast44} reach44 ok=${t.reach44.ok} fail=${t.reach44.fail} crossings=${t.crossings.count}`)
  }
}
