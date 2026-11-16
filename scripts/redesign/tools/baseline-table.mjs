// Generates .local/redesign-evidence/baseline/metrics.md (git-ignored) from the measurement JSON files that measure.mjs
// wrote to .local/redesign-evidence/baseline/screens/ (evidence stays out of the repository).
// Every figure in that table comes from here; never edit metrics.md by hand.
//   node scripts/redesign/tools/baseline-table.mjs          # write
//   node scripts/redesign/tools/baseline-table.mjs --check  # fail if metrics.md drifted
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const evidence = resolve(here, '../../../.local/redesign-evidence/baseline')
const dir = resolve(evidence, 'screens')
const out = resolve(evidence, 'metrics.md')
const list = readFileSync(resolve(here, 'screens.txt'), 'utf8').split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split(/\s+/))

const FAMILY = {
  ctl: 'Control', ops: 'Operations', dlv: 'Delivery management', sto: 'Stores and catalog', myp: 'My products and add-ons',
  usr: 'Users', mkt: 'Marketing', loy: 'Loyalty and gift cards', crt: 'Cart recovery', set: 'Settings',
  con: 'Connect', bi: 'BI and reports', home: 'Home', profile: 'Account'
}
const need = (value, what) => {
  if (value === undefined) throw new Error(`undefined value: ${what}`)
  return value
}
const cell = v => (v === null ? '—' : String(v))

const rows = []
for (const [id, url] of list) {
  const file = resolve(dir, `${id}.json`)
  if (!existsSync(file)) throw new Error(`missing measurement for ${id}: ${file}`)
  const json = JSON.parse(readFileSync(file, 'utf8'))
  if (!json.ok) throw new Error(`failed measurement for ${id}`)
  const family = FAMILY[id.split('-')[0]]
  if (!family) throw new Error(`unknown family prefix in ${id}`)
  for (const r of need(json.result.results, `${id}.results`)) {
    const m = r.metrics
    const noRing = r.focus.filter(f => f.startsWith('NO-RING')).length
    const bodyFocus = r.focus.filter(f => f === 'body').length
    rows.push([
      family, `\`${id}\``, `\`${url}\``, r.width,
      need(m.overflowX, 'overflowX'),
      m.rows.count ? `${m.rows.median}` : '—',
      cell(m.controls.medianHeight), need(m.controls.below24, 'below24'), need(m.controls.below44, 'below44'),
      need(m.type.distinctSizes, 'sizes'), need(m.type.below12, 'below12'),
      need(m.color.legacyBlue2C7BE5, 'legacyBlue'), need(m.color.brandBlue266DF0, 'brandBlue'),
      `${m.icons.lucide}/${m.icons.svg}`,
      need(m.dates.iso, 'iso'),
      need(m.legacy.nativeSelect, 'nativeSelect'), need(m.legacy.productWrappers, 'productWrappers'),
      `${noRing}/${r.focus.length - bodyFocus}`,
      need(r.axe.seriousCritical, 'axe')
    ])
  }
}

// Summary at 1440 over the audited screens (control screens excluded), so prose never retypes a figure.
const audited = rows.filter(r => r[0] !== 'Control' && r[3] === 1440)
const by = (col, n = 5) => [...audited].sort((a, b) => b[col] - a[col]).filter(r => r[col] > 0).slice(0, n).map(r => `${r[1]} ${r[col]}`).join(', ') || 'none'
const summary = [
  '## Summary at 1440 (generated)',
  '',
  `- Audited screens: ${audited.length}.`,
  `- Screens painting the legacy blue #2C7BE5: ${audited.filter(r => r[11] > 0).length}; without it: ${audited.filter(r => r[11] === 0).map(r => r[1]).join(', ') || 'none'}.`,
  `- Screens painting the brand blue #266DF0: ${audited.filter(r => r[12] > 0).length}.`,
  `- Most axe serious+critical nodes: ${by(18)}.`,
  `- Screens with visible ISO dates: ${audited.filter(r => r[14] > 0).length} (${by(14, 10)}).`,
  `- Most controls below 24px: ${by(7)}.`,
  `- Table row medians (px): ${audited.filter(r => r[5] !== '—').map(r => `${r[1]} ${r[5]}`).join(', ')}.`,
  `- Screens with a native select: ${audited.filter(r => r[15] > 0).length}.`,
  `- Screens whose first Tab stops include one without a focus ring: ${audited.filter(r => !r[17].startsWith('0/')).length}.`,
  '',
  '## Tool control (generated)',
  '',
  'The redesigned `/orders` against the legacy `/stores/list`: the tool must separate them, or its figures prove nothing.',
  '',
  '| measure | ctl-orders 1440 | ctl-stores 1440 | ctl-orders 390 | ctl-stores 390 |',
  '| --- | --- | --- | --- | --- |',
  ...[[11, '#2C7BE5 nodes'], [12, '#266DF0 nodes'], [18, 'axe serious+critical'], [13, 'Lucide/svg'], [5, 'row median px'], [14, 'ISO dates'], [8, 'controls <44px']].map(([col, label]) => {
    const pick = (id, w) => {
      const r = rows.find(x => x[1] === `\`${id}\`` && x[3] === w)
      if (!r) throw new Error(`missing control row ${id} ${w}`)
      return r[col]
    }
    return `| ${label} | ${pick('ctl-orders', 1440)} | ${pick('ctl-stores', 1440)} | ${pick('ctl-orders', 390)} | ${pick('ctl-stores', 390)} |`
  }),
  ''
]

const header = ['family', 'screen', 'url', 'width', 'overflow-x px', 'row median px', 'control median px', 'controls <24px', 'controls <44px', 'font sizes', 'text <12px', '#2C7BE5 nodes', '#266DF0 nodes', 'Lucide/svg', 'ISO dates', 'native select', 'odc- nodes', 'Tab stops without ring', 'axe serious+critical']
const lines = [
  '# Baseline metrics (generated)',
  '',
  'Generated by `node scripts/redesign/tools/baseline-table.mjs` from `baseline/screens/*.json` (written by `tools/measure.mjs` against the read-only live session, orderingv1, `--fake-maps`). Do not edit by hand; run with `--check` to detect drift.',
  '',
  'Columns: see `redesign/dashboard/inventory.md` (tag `archive/redesign-evidence-2026-10-27`) › Live baseline. «Tab stops without ring» counts the first five Tab stops from the top of the page whose focused element has neither an outline nor a box-shadow. «odc- nodes» counts elements with a Product (`odc-`) class: 0 means the screen renders no Product wrapper.',
  '',
  `| ${header.join(' | ')} |`,
  `| ${header.map(() => '---').join(' | ')} |`,
  ...rows.map(r => `| ${r.join(' | ')} |`),
  '',
  ...summary
]
const text = lines.join('\n')
if (text.includes('undefined')) throw new Error('generated text contains "undefined"')
if (process.argv.includes('--check')) {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : ''
  if (current !== text) { console.error('metrics.md drifted from the measurements; regenerate it'); process.exit(1) }
  console.log(`metrics.md matches ${rows.length} measurements`)
} else {
  writeFileSync(out, text)
  console.log(`wrote ${rows.length} rows to ${out}`)
}
