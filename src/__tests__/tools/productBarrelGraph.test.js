// redesign W0-7 (T0-29): the Product barrel (P/index.js) must not pull the legacy bundle.
// ImageField, ColorField and PhoneField import legacy pieces (Shared/UI) whose index loads components-dashboard/src/index,
// which loads bootstrap.css; any consumer of the barrel (the gallery, a page) would get bootstrap's page colors.
// Those three are imported by file. This walks the barrel's static import graph and fails on bootstrap or that index.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../..')
const BARREL = path.join(ROOT, 'src/@/components-dashboard/src/ui/src/components/Shared/Product/index.js')
const ALIASES = [
  ['~components', 'src/@/components-dashboard/src'],
  ['~ui', 'src/@/components-dashboard/src/ui'],
  ['~', 'src']
]

const resolveFile = base => ['', '.js', '.jsx', '/index.js', '/index.jsx']
  .map(ext => base + ext).find(p => existsSync(p) && /\.(js|jsx)$/.test(p) && !p.endsWith('/'))

const staticImports = source => {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  return [
    ...[...clean.matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1]),
    ...[...clean.matchAll(/^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/gm)].map(m => m[1])
  ]
}

const resolveSpec = (from, spec) => {
  if (spec.startsWith('.')) return path.resolve(path.dirname(from), spec)
  const hit = ALIASES.find(([a]) => spec === a || spec.startsWith(a + '/'))
  return hit ? path.join(ROOT, hit[1], spec.slice(hit[0].length)) : null
}

// Returns the first import chain that reaches bootstrap or the components-dashboard index, or null.
const findLeak = () => {
  const seen = new Set()
  const visit = (file, chain) => {
    if (seen.has(file)) return null
    seen.add(file)
    for (const spec of staticImports(readFileSync(file, 'utf8'))) {
      if (/bootstrap.*\.css$/i.test(spec)) return [...chain, spec]
      const base = resolveSpec(file, spec)
      if (!base) continue
      const target = resolveFile(base)
      if (!target) continue
      if (/\.(js|jsx)$/.test(target)) {
        const leak = visit(target, [...chain, path.relative(ROOT, target)])
        if (leak) return leak
      }
    }
    return null
  }
  return visit(BARREL, [path.relative(ROOT, BARREL)])
}

describe('Product barrel import graph (W0-7, T0-29)', () => {
  it('does not export the three legacy-piece fields (imported by file)', () => {
    const source = readFileSync(BARREL, 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(source).not.toMatch(/\b(ImageField|ColorField|PhoneField)\b/)
  })

  it('does not reach bootstrap or components-dashboard/src/index through static imports', () => {
    expect(findLeak()).toBeNull()
  })
})
