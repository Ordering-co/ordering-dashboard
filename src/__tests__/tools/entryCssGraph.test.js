// the entry stylesheet (dist/assets/index-*.css) blocks the first paint, and Vite puts in it the CSS of every module
// the entry reaches through static imports. The ~ui index and the Shared index reach every component, so importing either from
// the shell put the whole app's CSS there (1.16 MB). Pages are lazy chunks and bring their own CSS. This walks the static import
// graph of src/index.js (import() is skipped) and fails on those indexes and on the heavy legacy sheets that only some pages use.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../..')
const require = createRequire(path.join(ROOT, 'package.json'))
const ENTRY = path.join(ROOT, 'src/index.js')
const UI = 'src/@/components-dashboard/src/ui'
const ALIASES = [
  ['~components', 'src/@/components-dashboard/src'],
  ['~ui', UI],
  ['~', 'src']
]
const FORBIDDEN = [
  `${UI}/index.js`,
  `${UI}/src/components/Shared/index.js`,
  ...['multi-select', 'first-select', 'spreadsheet', 'schedule', 'range-calendar', 'phone-input']
    .map(name => `${UI}/src/components/Shared/UI/${name}.css`)
]
// Source bytes of every stylesheet the entry reaches (bootstrap included), not the minified build: 545,608 after
// (352,963 B in dist/assets/index-*.css), 1,820,891 before. A page piece that lands in the shell again goes over it.
const ENTRY_CSS_BUDGET = 600000

const resolveFile = base => ['', '.js', '.jsx', '/index.js', '/index.jsx']
  .map(ext => base + ext).find(p => existsSync(p) && statSync(p).isFile())

const staticImports = source => {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  return [
    ...[...clean.matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1]),
    ...[...clean.matchAll(/^\s*export\s+(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/gm)].map(m => m[1])
  ]
}

const resolveSpec = (from, spec) => {
  if (spec.startsWith('.')) return resolveFile(path.resolve(path.dirname(from), spec))
  const hit = ALIASES.find(([a]) => spec === a || spec.startsWith(a + '/'))
  if (hit) return resolveFile(path.join(ROOT, hit[1], spec.slice(hit[0].length)))
  // A package stylesheet (bootstrap, react-toastify…) counts toward the budget; package JS is not walked.
  if (spec.endsWith('.css')) { try { return require.resolve(spec) } catch { return null } }
  return null
}

// Every file the entry reaches through static imports, each with the file that imported it first.
const walk = () => {
  const from = new Map([[ENTRY, null]])
  const queue = [ENTRY]
  while (queue.length) {
    const file = queue.shift()
    if (!/\.(js|jsx)$/.test(file)) continue
    for (const spec of staticImports(readFileSync(file, 'utf8'))) {
      const target = resolveSpec(file, spec)
      if (target && !from.has(target)) { from.set(target, file); queue.push(target) }
    }
  }
  return from
}

// Every forbidden file the entry reaches, each with the first import chain that gets there.
const findLeaks = () => {
  const from = walk()
  return FORBIDDEN.filter(rel => from.has(path.join(ROOT, rel))).map(rel => {
    const chain = []
    for (let file = path.join(ROOT, rel); file; file = from.get(file)) chain.unshift(path.relative(ROOT, file))
    return chain.join(' > ')
  })
}

describe('entry stylesheet import graph', () => {
  it('the entry does not reach the ~ui or Shared indexes, nor the heavy legacy sheets, through static imports', () => {
    expect(findLeaks()).toEqual([])
  })

  it(`keeps the stylesheets the entry reaches under ${ENTRY_CSS_BUDGET} source bytes`, () => {
    const bytes = [...walk().keys()].filter(file => file.endsWith('.css')).reduce((total, file) => total + statSync(file).size, 0)
    expect(bytes).toBeGreaterThan(0)
    expect(bytes).toBeLessThanOrEqual(ENTRY_CSS_BUDGET)
  })

  // Chunk stylesheets are appended to <head> when a page loads; styled-components must stay after them, as it was after the
  // single entry stylesheet, or on equal specificity a page sheet starts beating a component.
  it('renders the app with styled-components injecting into <body>', () => {
    expect(readFileSync(ENTRY, 'utf8')).toMatch(/<StyleSheetManager\b[^>]*\btarget=\{\s*document\.body\s*\}/)
  })
})
