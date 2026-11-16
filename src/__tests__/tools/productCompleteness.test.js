// redesign W0-8d (T0-33): Shared/Product stays complete.
// 1. Every component or hook a Product file exports is also exported by the barrel (P/index.js).
// 2. Every component the barrel exports is used in the gallery (scripts/product-ui/gallery-main.jsx).
// 3. The barrel re-exports nothing that does not exist.
// Exceptions live in scripts/product-ui/completeness-allow.json as { file, export, reason };
// an entry that no longer applies fails, so the list cannot rot.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../..')
const PRODUCT_DIR = 'src/@/components-dashboard/src/ui/src/components/Shared/Product'
const GALLERY = 'scripts/product-ui/gallery-main.jsx'
const ALLOW_FILE = 'scripts/product-ui/completeness-allow.json'

const abs = rel => path.join(ROOT, rel)
const read = rel => readFileSync(abs(rel), 'utf8')
const rel = full => path.relative(ROOT, full).split(path.sep).join('/')

const ALLOW = JSON.parse(read(ALLOW_FILE))
const allowFor = kind => ALLOW[kind] || []

// Component: PascalCase with a lowercase letter (not STATUS_FAMILIES). Hook: useXxx.
const isComponent = name => /^[A-Z][a-z][A-Za-z0-9]*$/.test(name)
const isHook = name => /^use[A-Z]/.test(name)

const walk = dir => readdirSync(dir).flatMap(name => {
  const full = path.join(dir, name)
  if (statSync(full).isDirectory()) return name === '__tests__' ? [] : walk(full)
  return /\.(js|jsx)$/.test(name) ? [full] : []
})

const stripComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter(line => !line.trim().startsWith('//'))
  .join('\n')

// Resolves './X' from a file to a source file (X.js, X.jsx or X/index.js).
const resolveSource = (fromFile, spec) => {
  const base = path.resolve(path.dirname(abs(fromFile)), spec)
  return ['.js', '.jsx', '/index.js', '/index.jsx'].map(ext => base + ext).find(existsSync)
}

// Names a file exports: declarations, `export { a, b as c }` and `export { x } from './y'`.
// Returns [{ name, from }] where `from` is the local name when re-exported (a -> exported b).
const exportsOf = file => {
  const source = stripComments(read(file))
  const out = []
  for (const m of source.matchAll(/^export\s+(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    out.push({ name: m[1] })
  }
  for (const m of source.matchAll(/^export\s*\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/gm)) {
    for (const part of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
      const [local, exported] = part.split(/\s+as\s+/)
      out.push({ name: exported || local, local, spec: m[2] })
    }
  }
  return out
}

const productFiles = walk(abs(PRODUCT_DIR)).map(rel)
const BARREL = `${PRODUCT_DIR}/index.js`
const barrelExports = exportsOf(BARREL)
const barrelNames = new Set(barrelExports.map(e => e.name))

// The gallery either uses the namespace (`import * as P ... P.Name`) or imports by name.
const gallerySource = stripComments(read(GALLERY))
const productImports = [...gallerySource.matchAll(/import\s+([^'"]+?)\s+from\s+['"]([^'"]+)['"]/g)]
  .filter(m => /Shared\/Product(\/index(\.js)?)?$/.test(m[2]))
const galleryNamespaces = productImports.flatMap(m => [...m[1].matchAll(/\*\s+as\s+(\w+)/g)].map(n => n[1]))
const galleryNamed = new Set(productImports.flatMap(m => {
  const braces = m[1].match(/\{([^}]*)\}/)
  return braces ? braces[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()).filter(Boolean) : []
}))
const galleryBody = gallerySource.replace(/import\s+[^'"]+?\s+from\s+['"][^'"]+['"]/g, '')
const galleryUses = name =>
  galleryNamespaces.some(ns => new RegExp(`\\b${ns}\\.${name}\\b`).test(galleryBody)) ||
  (galleryNamed.has(name) && new RegExp(`\\b${name}\\b`).test(galleryBody))

const hasAllowed = (kind, file, name) => allowFor(kind).some(a => a.file === file && a.export === name)

describe('product completeness - the allow list', () => {
  it('has a reason on every entry', () => {
    for (const kind of ['barrel', 'gallery']) {
      for (const entry of allowFor(kind)) {
        expect(entry.file, `${kind} entry without file`).toBeTruthy()
        expect(entry.export, `${kind} entry without export`).toBeTruthy()
        expect(String(entry.reason || '').trim().length, `${kind} ${entry.file}:${entry.export} needs a reason`).toBeGreaterThan(10)
      }
    }
  })

  it('has no expired barrel entry (the export is gone, the barrel now has it, or the test never asks for it)', () => {
    // L1-33 (mutation 5c): only components and hooks are asked to reach the barrel, so an entry for
    // anything else (a helper such as resolveOpener) excuses nothing and is expired by definition.
    const expired = allowFor('barrel').filter(a => {
      const there = productFiles.includes(a.file) && exportsOf(a.file).some(e => e.name === a.export)
      return !there || barrelNames.has(a.export) || !(isComponent(a.export) || isHook(a.export))
    })
    expect(expired.map(a => `${a.file}:${a.export}`)).toEqual([])
  })

  it('has no expired gallery entry (the export is gone from the barrel or the gallery now uses it)', () => {
    const expired = allowFor('gallery').filter(a => !barrelNames.has(a.export) || galleryUses(a.export))
    expect(expired.map(a => `${a.file}:${a.export}`)).toEqual([])
  })

  it('still has the evidence behind every indirect gallery entry', () => {
    const lost = allowFor('gallery')
      .filter(a => a.evidence)
      .filter(a => !existsSync(abs(a.evidence.file)) || !read(a.evidence.file).includes(a.evidence.contains))
    expect(lost.map(a => `${a.file}:${a.export} (${a.evidence.file} lost ${a.evidence.contains})`)).toEqual([])
  })
})

describe('product completeness - every Product export reaches the barrel', () => {
  it('exports each component and hook of a Product file from P/index.js', () => {
    const missing = []
    for (const file of productFiles) {
      if (file === BARREL || path.basename(file).startsWith('index.')) continue
      for (const { name } of exportsOf(file)) {
        if (!(isComponent(name) || isHook(name))) continue
        if (barrelNames.has(name) || hasAllowed('barrel', file, name)) continue
        missing.push(`${file}:${name}`)
      }
    }
    expect(missing, 'add the export to P/index.js, or list it in completeness-allow.json with a reason').toEqual([])
  })
})

describe('product completeness - the barrel only re-exports what exists', () => {
  it('resolves every `export { X } from` to a real export of its source', () => {
    const broken = []
    for (const entry of barrelExports) {
      if (!entry.spec) continue
      const target = resolveSource(BARREL, entry.spec)
      if (!target) {
        broken.push(`${entry.name}: ${entry.spec} does not resolve to a file`)
        continue
      }
      if (!exportsOf(rel(target)).some(e => e.name === entry.local)) {
        broken.push(`${entry.name}: ${entry.spec} has no export ${entry.local}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('the sub-barrels it goes through also only re-export what exists', () => {
    const broken = []
    for (const file of productFiles.filter(f => path.basename(f).startsWith('index.') && f !== BARREL)) {
      for (const entry of exportsOf(file).filter(e => e.spec)) {
        const target = resolveSource(file, entry.spec)
        if (!target || !exportsOf(rel(target)).some(e => e.name === entry.local)) {
          broken.push(`${file}: ${entry.name} from ${entry.spec}`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})

describe('product completeness - the gallery shows every barrel component', () => {
  it('uses each component the barrel exports', () => {
    const unused = [...barrelNames]
      .filter(isComponent)
      .filter(name => !galleryUses(name) && !allowFor('gallery').some(a => a.export === name))
    expect(unused, 'mount it in scripts/product-ui/gallery-main.jsx, or list it in completeness-allow.json with a reason').toEqual([])
  })
})
