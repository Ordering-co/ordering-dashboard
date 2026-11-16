import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanCss, scanJs, scanSource } from '../../../scripts/product-ui/literal-guard.mjs'

const ROOT = path.resolve(__dirname, '../../..')
const PRODUCT_DIR = 'src/@/components-dashboard/src/ui/src/components/Shared/Product'
// Pilot files outside Shared/Product that are new code under this guard (wave 5 adds them).
const GOVERNED = JSON.parse(readFileSync(path.join(ROOT, 'scripts/product-ui/governed-files.json'), 'utf8'))

const walk = dir => readdirSync(dir).flatMap(name => {
  const full = path.join(dir, name)
  if (statSync(full).isDirectory()) return name === '__tests__' ? [] : walk(full)
  return /\.(css|js|jsx)$/.test(name) ? [full] : []
})

describe('product literal guard — the scanner', () => {
  it.each([
    ['hex color', '.a { color: #266DF0; }'],
    ['short hex', '.a { border: 1px solid #fff; }'],
    ['color function', '.a { background: rgb(11 12 13 / 0.3); }'],
    ['named color', '.a { color: white; }'],
    ['px length', '.a { padding: 12px; }'],
    ['rem length', '.a { font-size: 0.8125rem; }'],
    ['duration', '.a { transition: opacity 180ms; }'],
    ['font-weight number', '.a { font-weight: 600; }'],
    ['line-height number', '.a { line-height: 1.45; }'],
    ['custom property literal', '.a { --local: 4px; }'],
    ['literal inside calc', '.a { inline-size: calc(100% - 16px); }'],
    // redesign W0-5 (T0-17): z-index reads the layer scale, a number is a finding (0 and -1 too).
    ['z-index number', '.a { z-index: 5; }'],
    ['z-index zero', '.a { z-index: 0; }'],
    ['z-index negative', '.a { z-index: -1; }'],
    ['z-index important number', '.a { z-index: 1000 !important; }'],
    ['z-index calc with a number only', '.a { z-index: calc(1000 + 5); }'],
    ['z-index calc of something else', '.a { z-index: calc(var(--od-space-2) + 1); }']
  ])('rejects a %s in CSS', (_, css) => {
    expect(scanCss(css)).toHaveLength(1)
  })

  it.each([
    ['token reference', '.a { color: var(--od-text); padding: var(--od-space-2) var(--od-x-space-2-5); }'],
    ['zero and percentages', '.a { margin: 0; inline-size: 100%; inset: 0; }'],
    ['layout units', '.a { block-size: 100dvh; grid-template-columns: minmax(0, 1fr) var(--od-x-panel); }'],
    ['keywords', '.a { background: transparent; color: currentColor; border: 0; }'],
    ['unitless factors', '.a { flex: 1; opacity: 0.55; scale: -1 1; }'],
    ['z-index layer token', '.a { z-index: var(--od-x-layer-chrome); }'],
    ['z-index layer token plus n', '.a { z-index: calc(var(--od-x-layer-raised) + 9); }'],
    ['z-index layer token minus n', '.a { z-index: calc(var(--od-x-layer-chrome) - 1); }'],
    ['z-index layer token times -1', '.a { z-index: calc(var(--od-x-layer-raised) * -1); }'],
    ['z-index of the overlay registry', '.a { z-index: var(--od-dialog-layer); }'],
    ['z-index keywords', '.a { z-index: auto; } .b { z-index: inherit; }'],
    ['calc multiplier', '.a { margin-inline: calc(var(--od-x-space-1-5) * -1); }'],
    ['breakpoint prelude', '@media (max-width: 767px) { .a { display: none; } }'],
    ['container prelude', '@container list (max-width: 1100px) { .a { display: none; } }'],
    ['comments', '/* 12px is the floor, #fff is not used */ .a { color: var(--od-text); }']
  ])('accepts %s in CSS', (_, css) => {
    expect(scanCss(css)).toEqual([])
  })

  it.each([
    ['hex in a string', "const c = '#EB3B3B'"],
    ['px in a string', "const style = { width: '24px' }"],
    ['numeric inline size', 'const el = <div style={{ paddingInline: 12 }} />'],
    ['numeric font size', 'const el = <span style={{ fontSize: 13 }} />'],
    ['numeric z-index', 'const el = <div style={{ zIndex: 5 }} />'],
    ['zero z-index', 'const el = <div style={{ zIndex: 0 }} />'],
    ['negative z-index', 'const el = <div style={{ zIndex: -1 }} />'],
    ['z-index in a css string', "const css = 'position: relative; z-index: 3;'"]
  ])('rejects a %s in JS', (_, js) => {
    expect(scanJs(js).length).toBeGreaterThan(0)
  })

  it.each([
    ['class names', "const c = 'odc-badge od-flex od-items-center'"],
    ['imports', "import x from './badge.css'"],
    ['token style', "const s = { inlineSize: 'var(--od-x-avatar)', '--steps': 5 }"],
    ['zero', 'const el = <div style={{ margin: 0 }} />'],
    ['token z-index', "const s = { zIndex: 'var(--od-x-layer-raised)' }"]
  ])('accepts %s in JS', (_, js) => {
    expect(scanJs(js)).toEqual([])
  })

  it('reports the line of the literal', () => {
    expect(scanSource('.a {\n  color: var(--od-text);\n  gap: 6px;\n}', 'x.css')).toEqual([
      { line: 3, property: 'gap', value: '6px', reason: 'literal length or duration' }
    ])
  })
})

// redesign W0-5 (T0-17): mutation test. A real governed file with one z-index: 5 added must turn red and name the file and the line.
describe('z-index mutation', () => {
  const MUTATED = 'src/@/components-dashboard/src/ui/src/components/Shared/Product/menu.css'
  const original = readFileSync(path.join(ROOT, MUTATED), 'utf8')
  it('control: the file as it is has no finding', () => {
    expect(scanSource(original, MUTATED)).toEqual([])
  })
  it('a z-index: 5 added to the file is reported with its line', () => {
    const lines = original.split('\n')
    lines.splice(2, 0, '.odc-mutation { z-index: 5; }')
    const findings = scanSource(lines.join('\n'), MUTATED)
    expect(findings).toEqual([{ line: 3, property: 'z-index', value: '5', reason: 'literal z-index' }])
    expect(`${MUTATED}:${findings[0].line}`).toMatch(/Shared\/Product\/menu\.css:3$/)
  })
})

describe('product literal guard — governed pilot code', () => {
  const files = [
    ...walk(path.join(ROOT, PRODUCT_DIR)),
    ...GOVERNED.files.map(file => path.join(ROOT, file))
  ]

  it('governs at least the Product wrappers folder', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  // Replaces the Part 1 e1-sidebarmenu-* icon rules (retired in batch 5.1 when the sidebar
  // moved to Shared/SideBar): pilot code takes its glyphs only from the governed Lucide module.
  const jsFiles = [...files, path.join(ROOT, 'src/@/components-dashboard/src/ui/src/components/Shared/UI/SidebarMenu.jsx')]
    .filter(file => /\.jsx?$/.test(file))
  it.each(jsFiles.map(file => [path.relative(ROOT, file)]))('%s imports icons only from Shared/Icon', file => {
    const source = readFileSync(file, 'utf8')
    expect(source.match(/from ['"](?:react-bootstrap-icons|@meronex\/icons[^'"]*|lucide-react|react-icons[^'"]*)['"]/g) ?? []).toEqual([])
  })

  it.each(files.map(file => [path.relative(ROOT, file)]))('%s has no literal color, size, space, weight or duration', file => {
    const findings = scanSource(readFileSync(path.join(ROOT, file), 'utf8'), file)
    expect(findings).toEqual([])
  })
})
