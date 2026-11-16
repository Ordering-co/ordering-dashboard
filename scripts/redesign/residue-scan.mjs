// redesign W0-8a (T0-30)
// Legacy residue scanner. For every route of src/App.js it walks the import graph from the
// page component and lists the LEGACY modules (scripts/redesign/legacy-modules.json) that are
// reachable. The family gate wants zero, except the exceptions declared in
// scripts/redesign/residue-exceptions.json (each with a reason; one that is no longer
// reachable FAILS, so the list cannot rot).
//
//   node scripts/redesign/residue-scan.mjs --route /orders      # legacy modules reachable from one route
//   node scripts/redesign/residue-scan.mjs --all                # one line per route
//   node scripts/redesign/residue-scan.mjs --check /orders ...  # exit 1 on residue or a stale exception
//   node scripts/redesign/residue-scan.mjs --check              # same, every route
//   add --json to any of them for machine output
//
// How the graph is walked:
//  - Imports: `import … from`, `export … from`, `import('…')` and `require('…')`, with the vite aliases.
//  - BARRELS: a name imported through a barrel is followed through `export { A } from`,
//    `export { A as B } from`, `export * from` and `import { A }; export { A }` to the module that
//    really defines it. Only that module is entered; the rest of the barrel is not. A module that is
//    entered counts with ALL its import statements (each followed by name again).
//    Namespace imports, side-effect imports, dynamic imports and require() enter the module whole.
//  - Fail closed: a route that does not resolve to a page, a missing file, a name that no module
//    exports, a legacy entry that matches nothing, or an exception that names an unknown legacy
//    id are errors, never silently skipped.
import { createRequire } from 'node:module'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(here, '../..')

// Same as resolve.alias in vite.config.js (a test pins them against it).
export const ALIASES = [
  ['~components', '@/components-dashboard/src'],
  ['~ui', '@/components-dashboard/src/ui'],
  ['~', '']
]
const CODE_EXTS = ['.js', '.jsx', '.mjs', '.cjs']
// Components that are redirects, listed apart from the pages.
const REDIRECT_COMPONENTS = new Set(['SettingsLegacyRedirect', 'Redirect'])
const ROUTE_ELEMENTS = new Set(['Route', 'ProtectedRoute'])

export class ScanError extends Error {}

let babel
const parser = () => {
  babel ??= require('@babel/core')
  return babel
}

const toPosix = p => p.split(sep).join('/')
const isFile = p => { try { return statSync(p).isFile() } catch { return false } }

// ---------------------------------------------------------------- module analysis

const strOf = node => {
  if (!node) return null
  if (node.type === 'StringLiteral') return node.value
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked
  return null
}
const nameOf = node => (node.type === 'StringLiteral' ? node.value : node.name)

function declaredNames (declaration) {
  if (!declaration) return []
  if (declaration.type === 'VariableDeclaration') {
    const names = []
    const collect = id => {
      if (!id) return
      if (id.type === 'Identifier') names.push(id.name)
      else if (id.type === 'ObjectPattern') id.properties.forEach(p => collect(p.value ?? p.argument))
      else if (id.type === 'ArrayPattern') id.elements.forEach(collect)
      else if (id.type === 'AssignmentPattern') collect(id.left)
      else if (id.type === 'RestElement') collect(id.argument)
    }
    declaration.declarations.forEach(d => collect(d.id))
    return names
  }
  return declaration.id ? [declaration.id.name] : []
}

// `lazy(() => import('spec'))` -> { spec, imported: 'default' }; `.then(m => ({ default: m.Y }))` -> imported: 'Y'.
function lazyImportOf (declarator) {
  const init = declarator.init
  if (declarator.id.type !== 'Identifier' || init?.type !== 'CallExpression') return null
  const callee = init.callee
  if (!(callee.type === 'Identifier' && callee.name === 'lazy') && !(callee.type === 'MemberExpression' && nameOf(callee.property) === 'lazy')) return null
  const loader = init.arguments[0]
  if (loader?.type !== 'ArrowFunctionExpression') return null
  const body = loader.body
  const isImport = n => (n?.type === 'CallExpression' && n.callee.type === 'Import') || n?.type === 'ImportExpression'
  // redesign tramo B r3 (W0-PB2-01): `lazyWithReload(() => import('spec'))` (utils/chunkReload.js) is the import it wraps.
  const unwrap = n => {
    if (n?.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'lazyWithReload') {
      const inner = n.arguments[0]
      if (inner?.type === 'ArrowFunctionExpression' && isImport(inner.body)) return inner.body
    }
    return n
  }
  if (isImport(unwrap(body))) return { spec: strOf(unwrap(body).arguments?.[0] ?? unwrap(body).source), imported: 'default' }
  if (body?.type === 'CallExpression' && body.callee.type === 'MemberExpression' && nameOf(body.callee.property) === 'then' && isImport(unwrap(body.callee.object))) {
    const importCall = unwrap(body.callee.object)
    const spec = strOf(importCall.arguments?.[0] ?? importCall.source)
    const mapper = body.arguments[0]
    const result = mapper?.body
    const object = result?.type === 'ObjectExpression' ? result : null
    const prop = object?.properties.find(p => nameOf(p.key) === 'default')
    if (spec && prop?.value?.type === 'MemberExpression') return { spec, imported: nameOf(prop.value.property) }
  }
  return null
}

export function parseModule (file) {
  let ast
  try {
    ast = parser().parseSync(readFileSync(file, 'utf8'), {
      filename: file,
      sourceType: 'module',
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['jsx'] }
    })
  } catch (error) {
    throw new ScanError(`cannot parse ${file}: ${error.message.split('\n')[0]}`)
  }
  const mod = {
    ast,
    imports: [], // { spec, names: [{ imported, local }], whole }
    reexports: [], // { spec, kind: 'named'|'star'|'ns', imported, exported }
    localExports: new Map(), // exported name -> local binding name | null
    bindings: new Map(), // local -> { spec, imported }
    dynamic: [], // specs entered whole (import() and require())
    nonStatic: [] // import()/require() whose argument is not a string
  }
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const entry = { spec: node.source.value, names: [], whole: false }
      if (node.specifiers.length === 0) entry.whole = true
      for (const s of node.specifiers) {
        if (s.type === 'ImportDefaultSpecifier') entry.names.push({ imported: 'default', local: s.local.name })
        else if (s.type === 'ImportNamespaceSpecifier') {
          entry.whole = true
          entry.names.push({ imported: '*', local: s.local.name })
        } else entry.names.push({ imported: nameOf(s.imported), local: s.local.name })
      }
      for (const n of entry.names) mod.bindings.set(n.local, { spec: entry.spec, imported: n.imported })
      mod.imports.push(entry)
    } else if (node.type === 'VariableDeclaration') {
      // redesign W0-10b: `const X = lazy(() => import('spec').then(m => ({ default: m.Y })))` binds X like `import { Y } from 'spec'`
      // (or like the default export when the callback is `lazy(() => import('spec'))`).
      for (const d of node.declarations) {
        const lazyBinding = lazyImportOf(d)
        if (lazyBinding) mod.bindings.set(d.id.name, lazyBinding)
      }
    } else if (node.type === 'ExportNamedDeclaration') {
      if (node.source) {
        for (const s of node.specifiers) {
          if (s.type === 'ExportNamespaceSpecifier') mod.reexports.push({ spec: node.source.value, kind: 'ns', exported: nameOf(s.exported) })
          else mod.reexports.push({ spec: node.source.value, kind: 'named', imported: nameOf(s.local), exported: nameOf(s.exported) })
        }
      } else {
        for (const name of declaredNames(node.declaration)) mod.localExports.set(name, null)
        for (const s of node.specifiers) mod.localExports.set(nameOf(s.exported), nameOf(s.local))
      }
    } else if (node.type === 'ExportAllDeclaration') {
      mod.reexports.push({ spec: node.source.value, kind: 'star' })
    } else if (node.type === 'ExportDefaultDeclaration') {
      const d = node.declaration
      mod.localExports.set('default', d.type === 'Identifier' ? d.name : null)
    }
  }
  const seen = new Set()
  const walk = node => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (node.type === 'CallExpression' && (node.callee.type === 'Import' || (node.callee.type === 'Identifier' && node.callee.name === 'require'))) {
      const spec = strOf(node.arguments[0])
      if (spec) mod.dynamic.push(spec)
      else mod.nonStatic.push(`${node.callee.type === 'Import' ? 'import' : 'require'}() with a computed argument`)
    } else if (node.type === 'ImportExpression') {
      const spec = strOf(node.source)
      if (spec) mod.dynamic.push(spec)
      else mod.nonStatic.push('import() with a computed argument')
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'extra' || key.endsWith('Comments')) continue
      const value = node[key]
      if (value && typeof value === 'object') walk(value)
    }
  }
  walk(ast.program)
  return mod
}

// ---------------------------------------------------------------- context (resolution + caches)

export function createContext ({ root = REPO_ROOT } = {}) {
  const src = join(root, 'src')
  const cache = new Map()
  const analyze = file => {
    if (!cache.has(file)) cache.set(file, parseModule(file))
    return cache.get(file)
  }
  const rel = file => toPosix(relative(src, file))

  const aliasBase = spec => {
    for (const [alias, target] of ALIASES) {
      if (spec === alias) return join(src, target)
      if (spec.startsWith(`${alias}/`)) return join(src, target, spec.slice(alias.length + 1))
    }
    return null
  }

  // -> { kind: 'file', file } | { kind: 'asset' } | { kind: 'package', spec } | { kind: 'missing' }
  const resolveSpec = (fromFile, spec) => {
    let base = null
    if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
    else base = aliasBase(spec)
    if (base === null) return { kind: 'package', spec }
    if (isFile(base)) return CODE_EXTS.includes(extname(base)) ? { kind: 'file', file: base } : { kind: 'asset' }
    for (const ext of CODE_EXTS) if (isFile(base + ext)) return { kind: 'file', file: base + ext }
    for (const ext of CODE_EXTS) if (isFile(join(base, `index${ext}`))) return { kind: 'file', file: join(base, `index${ext}`) }
    if (extname(base) && !CODE_EXTS.includes(extname(base))) return { kind: 'missing' }
    return { kind: 'missing' }
  }

  // Follows `name` through barrels. -> { file, via: [pass-through files] } | { pkg: spec, via } | { whole: file, via } | null
  const resolveName = (file, name, visiting = new Set()) => {
    const key = `${file}\0${name}`
    if (visiting.has(key)) return null
    visiting.add(key)
    const mod = analyze(file)
    if (mod.localExports.has(name)) {
      const local = mod.localExports.get(name)
      const binding = local && mod.bindings.get(local)
      if (binding) {
        const target = resolveSpec(file, binding.spec)
        if (target.kind === 'package') return { pkg: target.spec, via: [file] }
        if (target.kind === 'file') {
          if (binding.imported === '*') return { whole: target.file, via: [file] }
          const inner = resolveName(target.file, binding.imported, visiting)
          if (inner) return { ...inner, via: [file, ...inner.via] }
        }
        if (target.kind === 'asset') return { asset: true, via: [file] }
        return null
      }
      return { file, via: [] }
    }
    for (const re of mod.reexports) {
      if (re.kind === 'star') continue
      if (re.exported !== name) continue
      const target = resolveSpec(file, re.spec)
      if (target.kind === 'package') return { pkg: target.spec, via: [file] }
      if (target.kind !== 'file') return null
      if (re.kind === 'ns') return { whole: target.file, via: [file] }
      const inner = resolveName(target.file, re.imported, visiting)
      return inner ? { ...inner, via: [file, ...inner.via] } : null
    }
    if (name !== 'default') {
      for (const re of mod.reexports) {
        if (re.kind !== 'star') continue
        const target = resolveSpec(file, re.spec)
        if (target.kind === 'package') continue
        if (target.kind !== 'file') continue
        const inner = resolveName(target.file, name, visiting)
        if (inner) return { ...inner, via: [file, ...inner.via] }
      }
    }
    return null
  }

  return { root, src, analyze, rel, resolveSpec, resolveName }
}

// ---------------------------------------------------------------- legacy list

const readJson = (file, what) => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch (error) {
    throw new ScanError(`${what}: cannot read ${file}: ${error.message}`)
  }
}

const asList = match => (Array.isArray(match) ? match : [match])
const matchPath = (matchStr, relFile) => {
  const noExt = relFile.slice(0, relFile.length - extname(relFile).length)
  return relFile === matchStr || noExt === matchStr || relFile.startsWith(`${matchStr}/`)
}
const matchPackage = (pkg, spec) => spec === pkg || spec.startsWith(`${pkg}/`)

export function loadLegacy ({ root = REPO_ROOT, legacyPath = join(here, 'legacy-modules.json') } = {}) {
  const list = readJson(legacyPath, 'legacy-modules')
  if (!Array.isArray(list)) throw new ScanError('legacy-modules: expected an array of {id, match, reason}')
  const pkgJson = readJson(join(root, 'package.json'), 'package.json')
  const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies, ...pkgJson.peerDependencies }
  const src = join(root, 'src')
  const ids = new Set()
  return list.map((entry, i) => {
    const at = `legacy-modules[${i}]`
    if (!entry || typeof entry.id !== 'string' || !entry.id) throw new ScanError(`${at}: missing id`)
    if (ids.has(entry.id)) throw new ScanError(`${at}: duplicate id ${entry.id}`)
    ids.add(entry.id)
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) throw new ScanError(`${at} (${entry.id}): missing reason`)
    const matches = asList(entry.match)
    if (!matches.length || matches.some(m => typeof m !== 'string' || !m)) throw new ScanError(`${at} (${entry.id}): missing match`)
    const kinds = matches.map(m => {
      const asPath = [m, ...CODE_EXTS.map(e => m + e)].some(p => existsSync(join(src, p)))
      if (asPath) return 'path'
      if (Object.prototype.hasOwnProperty.call(deps, m)) return 'package'
      throw new ScanError(`${at} (${entry.id}): "${m}" matches nothing (no file under src/, no dependency in package.json)`)
    })
    return { id: entry.id, reason: entry.reason, matches, kinds }
  })
}

export function loadExceptions ({ legacy, exceptionsPath = join(here, 'residue-exceptions.json') } = {}) {
  const list = readJson(exceptionsPath, 'residue-exceptions')
  if (!Array.isArray(list)) throw new ScanError('residue-exceptions: expected an array of {route, legacy, reason}')
  const ids = new Set(legacy.map(l => l.id))
  return list.map((entry, i) => {
    const at = `residue-exceptions[${i}]`
    if (!entry || typeof entry.route !== 'string' || !entry.route) throw new ScanError(`${at}: missing route`)
    if (!ids.has(entry.legacy)) throw new ScanError(`${at}: legacy "${entry.legacy}" is not an id in legacy-modules.json`)
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) throw new ScanError(`${at}: missing reason`)
    return { route: entry.route, legacy: entry.legacy, reason: entry.reason }
  })
}

const legacyHitsFor = (legacy, ctx, files, specs) => {
  const ids = new Set()
  for (const entry of legacy) {
    entry.matches.forEach((m, i) => {
      if (entry.kinds[i] === 'path') {
        if (files.some(f => matchPath(m, ctx.rel(f)))) ids.add(entry.id)
      } else if (specs.some(s => matchPackage(m, s))) ids.add(entry.id)
    })
  }
  return ids
}

// ---------------------------------------------------------------- routes of App.js

export function parseRoutes (ctx, appFile = join(ctx.src, 'App.js')) {
  const app = ctx.analyze(appFile)
  const routes = new Map() // path -> { entries: Map(key -> {name,file}), redirects: Set }
  const jsxName = n => (n.type === 'JSXIdentifier' ? n.name : n.type === 'JSXMemberExpression' ? jsxName(n.object) : null)
  const attrValue = (opening, attr) => opening.attributes.find(a => a.type === 'JSXAttribute' && a.name.name === attr)?.value
  const seen = new Set()

  const collect = (node, found) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) { node.forEach(n => collect(n, found)); return }
    if (node.type === 'JSXOpeningElement') {
      const name = jsxName(node.name)
      if (name && /^[A-Z]/.test(name) && !ROUTE_ELEMENTS.has(name)) found.add(name)
      const component = attrValue(node, 'component')
      if (component?.type === 'JSXExpressionContainer' && component.expression.type === 'Identifier') found.add(component.expression.name)
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'extra' || key.endsWith('Comments')) continue
      if (node[key] && typeof node[key] === 'object') collect(node[key], found)
    }
  }

  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (node.type === 'JSXElement' && ROUTE_ELEMENTS.has(jsxName(node.openingElement.name))) {
      const pathAttr = attrValue(node.openingElement, 'path')
      const path = pathAttr?.type === 'StringLiteral' ? pathAttr.value : strOf(pathAttr?.expression)
      if (path) {
        const found = new Set()
        collect(node.children, found)
        const component = attrValue(node.openingElement, 'component')
        if (component?.type === 'JSXExpressionContainer' && component.expression.type === 'Identifier') found.add(component.expression.name)
        if (!routes.has(path)) routes.set(path, { entries: new Map(), redirects: new Set(), names: new Set() })
        const route = routes.get(path)
        for (const name of found) {
          route.names.add(name)
          if (REDIRECT_COMPONENTS.has(name)) { route.redirects.add(name); continue }
          const binding = app.bindings.get(name)
          if (!binding) throw new ScanError(`route ${path}: <${name}> is not imported by App.js`)
          const target = ctx.resolveSpec(appFile, binding.spec)
          if (target.kind === 'package') continue // react-router Link, etc.
          if (target.kind !== 'file') throw new ScanError(`route ${path}: <${name}> imports ${binding.spec}, which does not resolve`)
          const resolved = ctx.resolveName(target.file, binding.imported)
          if (!resolved || !resolved.file) throw new ScanError(`route ${path}: <${name}> (${binding.imported} from ${binding.spec}) does not resolve to a module`)
          route.entries.set(`${name}\0${resolved.file}`, { name, file: resolved.file })
        }
        if (route.entries.size === 0 && route.redirects.size === 0) {
          throw new ScanError(`route ${path}: no page component resolved from its children`)
        }
        // Keep walking the children for nested routes (none today).
        node.children.forEach(visit)
        return
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'extra' || key.endsWith('Comments')) continue
      if (node[key] && typeof node[key] === 'object') visit(node[key])
    }
  }
  visit(app.ast.program)
  if (routes.size === 0) throw new ScanError(`no <Route>/<ProtectedRoute> with a path found in ${appFile}`)
  return routes
}

// ---------------------------------------------------------------- the walk

function walkRoute (ctx, legacy, entries) {
  const entered = new Map() // file -> { parent, whole }
  const queue = []
  const unresolved = []
  const hits = new Map() // id -> { importers: Map(file -> true), chain: [files] }

  const chainTo = file => {
    const chain = []
    for (let f = file; f; f = entered.get(f)?.parent) chain.unshift(f)
    return chain
  }
  const record = (importer, ids, extraFile) => {
    for (const id of ids) {
      const entry = legacy.find(l => l.id === id)
      // An importer that is itself part of the legacy module does not count as a user of it.
      const importerRel = ctx.rel(importer)
      const internal = entry.matches.some((m, i) => entry.kinds[i] === 'path' && matchPath(m, importerRel))
      if (internal) continue
      if (!hits.has(id)) hits.set(id, { importers: new Set(), chain: [...chainTo(importer), ...(extraFile ? [extraFile] : [])] })
      hits.get(id).importers.add(importer)
    }
  }
  const enter = (file, parent, whole) => {
    const prev = entered.get(file)
    if (prev && (prev.whole || !whole)) return
    entered.set(file, { parent: prev ? prev.parent : parent, whole })
    queue.push(file)
  }

  // `importer` references `names` of `spec` (names === null: the module whole).
  const follow = (importer, spec, names) => {
    const target = ctx.resolveSpec(importer, spec)
    if (target.kind === 'asset') return
    if (target.kind === 'missing') { unresolved.push({ from: ctx.rel(importer), what: `cannot resolve "${spec}"` }); return }
    if (target.kind === 'package') {
      record(importer, legacyHitsFor(legacy, ctx, [], [spec]))
      return
    }
    if (names === null) {
      record(importer, legacyHitsFor(legacy, ctx, [target.file], []), ctx.rel(target.file))
      enter(target.file, importer, true)
      return
    }
    for (const name of names) {
      if (name === '*') {
        record(importer, legacyHitsFor(legacy, ctx, [target.file], []), ctx.rel(target.file))
        enter(target.file, importer, true)
        continue
      }
      const r = ctx.resolveName(target.file, name)
      if (!r) { unresolved.push({ from: ctx.rel(importer), what: `"${name}" is not exported by ${spec}` }); continue }
      const files = [target.file, ...r.via, ...(r.file ? [r.file] : []), ...(r.whole ? [r.whole] : [])]
      const specs = r.pkg ? [r.pkg] : []
      const ids = legacyHitsFor(legacy, ctx, files, specs)
      const last = r.file ?? r.whole
      record(importer, ids, last ? ctx.rel(last) : undefined)
      if (r.file) enter(r.file, importer, false)
      if (r.whole) enter(r.whole, importer, true)
    }
  }

  for (const { file } of entries) enter(file, null, false)

  while (queue.length) {
    const file = queue.shift()
    const state = entered.get(file)
    const mod = ctx.analyze(file)
    mod.nonStatic.forEach(what => unresolved.push({ from: ctx.rel(file), what }))
    for (const imp of mod.imports) follow(file, imp.spec, imp.whole && !imp.names.length ? null : imp.names.map(n => n.imported))
    for (const spec of mod.dynamic) follow(file, spec, null)
    if (state.whole) {
      for (const re of mod.reexports) {
        if (re.kind === 'named') follow(file, re.spec, [re.imported])
        else follow(file, re.spec, null)
      }
    }
  }

  const legacyOut = []
  for (const entry of legacy) {
    const hit = hits.get(entry.id)
    if (!hit) continue
    legacyOut.push({
      id: entry.id,
      reason: entry.reason,
      importerCount: hit.importers.size,
      importers: [...hit.importers].map(f => ctx.rel(f)).sort(),
      chain: hit.chain.map(f => (f.startsWith('/') ? ctx.rel(f) : f))
    })
  }
  return { reachedFiles: entered.size, files: [...entered.keys()].map(f => ctx.rel(f)).sort(), legacy: legacyOut, unresolved }
}

// ---------------------------------------------------------------- API

/**
 * Scan routes of src/App.js. `routes`: array of route paths (default: all).
 * -> { routes: { [path]: { path, entries, reachedFiles, legacy, unresolved } }, redirects, legacy: [...] }
 */
export function scan ({ routes, root = REPO_ROOT, legacyPath, appFile } = {}) {
  const ctx = createContext({ root })
  const legacy = loadLegacy({ root, legacyPath })
  const all = parseRoutes(ctx, appFile)
  const wanted = routes ?? [...all.keys()]
  for (const path of wanted) {
    if (!all.has(path)) throw new ScanError(`route ${path} is not in App.js (known: ${[...all.keys()].join(', ')})`)
  }
  const out = {}
  for (const path of wanted) {
    const route = all.get(path)
    if (route.entries.size === 0) continue
    const entries = [...route.entries.values()]
    out[path] = {
      path,
      entries: entries.map(e => ({ name: e.name, file: `src/${ctx.rel(e.file)}` })),
      ...walkRoute(ctx, legacy, entries)
    }
  }
  // Redirect-only routes (every one of App.js, whatever was asked), listed apart from the pages.
  const redirects = [...all.keys()]
    .filter(p => all.get(p).entries.size === 0)
    .map(p => ({ path: p, via: [...all.get(p).redirects] }))
  return { routes: out, redirects, knownRoutes: [...all.keys()], legacy: legacy.map(({ id, reason }) => ({ id, reason })) }
}

/**
 * Gate. `result`: output of scan(). `exceptions`: [{route, legacy, reason}].
 * -> { ok, residue: [{route, legacy, importerCount, chain}], stale: [{route, legacy, why}], unresolved }
 */
export function check (result, exceptions) {
  const scanned = new Set(Object.keys(result.routes))
  const redirectPaths = new Set(result.redirects.map(r => r.path))
  const excepted = new Set(exceptions.map(e => `${e.route}\0${e.legacy}`))
  const residue = []
  const unresolved = []
  for (const route of Object.values(result.routes)) {
    for (const hit of route.legacy) {
      if (!excepted.has(`${route.path}\0${hit.id}`)) residue.push({ route: route.path, legacy: hit.id, importerCount: hit.importerCount, chain: hit.chain })
    }
    route.unresolved.forEach(u => unresolved.push({ route: route.path, ...u }))
  }
  const stale = []
  const reachable = new Set()
  for (const route of Object.values(result.routes)) for (const hit of route.legacy) reachable.add(`${route.path}\0${hit.id}`)
  for (const e of exceptions) {
    // Only an exception for a scanned route can be judged here; one for a route that is not in
    // App.js, or that is a pure redirect, can never be reached and is always stale.
    if (!result.knownRoutes.includes(e.route)) stale.push({ route: e.route, legacy: e.legacy, why: 'route is not in App.js' })
    else if (redirectPaths.has(e.route)) stale.push({ route: e.route, legacy: e.legacy, why: 'route is a pure redirect' })
    else if (scanned.has(e.route) && !reachable.has(`${e.route}\0${e.legacy}`)) stale.push({ route: e.route, legacy: e.legacy, why: 'no longer reachable from the route' })
  }
  return { ok: residue.length === 0 && stale.length === 0 && unresolved.length === 0, residue, stale, unresolved }
}

// ---------------------------------------------------------------- ratchet baseline (redesign W0-8b, T0-31)

// scripts/redesign/residue-baseline.json: per route, the legacy ids reachable TODAY that no
// exception covers. scripts/redesign/gates.mjs compares against it (a ratchet: the residue can
// only go down). Generated here, never by hand.
export const BASELINE_PATH = join(here, 'residue-baseline.json')
export const BASELINE_COMMENT = 'Ratchet baseline of the legacy residue (redesign W0-8b, T0-31). Per route of src/App.js that renders a page: the legacy ids (scripts/redesign/legacy-modules.json) reachable from it today that no entry of residue-exceptions.json covers. Generated by `node scripts/redesign/residue-scan.mjs --write-baseline`, never by hand. gates.mjs fails a route that reaches a legacy id missing here (regression) and a baseline id the route no longer reaches (stale: lower it in the same change).'

/** { route: [legacy ids, sorted] } for every scanned route: reachable and not excepted. */
export function baselineFrom (result, verdict) {
  const routes = {}
  for (const path of Object.keys(result.routes).sort()) routes[path] = []
  for (const r of verdict.residue) routes[r.route].push(r.legacy)
  for (const path of Object.keys(routes)) routes[path].sort()
  return routes
}

// ---------------------------------------------------------------- CLI

// C/ = src/@/components-dashboard/src/ (display only; --json keeps the full paths)
const fmtChain = chain => chain.map(f => f.replace('@/components-dashboard/src/', 'C/')).join(' -> ')

function main (argv) {
  const json = argv.includes('--json')
  const args = argv.filter(a => a !== '--json')
  const mode = args.find(a => ['--route', '--all', '--check', '--write-baseline'].includes(a))
  if (!mode) {
    console.error('usage: residue-scan.mjs --route <path> | --all | --check [paths...] | --write-baseline  [--json]')
    return 2
  }
  const tail = args.slice(args.indexOf(mode) + 1).filter(a => !a.startsWith('--'))
  let wanted
  if (mode === '--route') {
    if (tail.length !== 1) { console.error('--route takes exactly one route path'); return 2 }
    wanted = tail
  } else if (mode === '--check' && tail.length) wanted = tail
  const result = scan({ routes: wanted })

  if (mode === '--write-baseline') {
    // redesign W0-8b (T0-31): fail closed, nothing is written unless the scan is clean of
    // unresolved imports and stale exceptions.
    if (tail.length) { console.error('--write-baseline scans every route; it takes no route paths'); return 2 }
    const verdict = check(result, loadExceptions({ legacy: loadLegacy() }))
    if (verdict.stale.length || verdict.unresolved.length) {
      for (const s of verdict.stale) console.error(`STALE EXCEPTION ${s.route}: ${s.legacy} (${s.why})`)
      for (const u of verdict.unresolved) console.error(`UNRESOLVED ${u.route}: ${u.from}: ${u.what}`)
      console.error('baseline not written')
      return 1
    }
    const routes = baselineFrom(result, verdict)
    writeFileSync(BASELINE_PATH, `${JSON.stringify({ _comment: BASELINE_COMMENT, routes }, null, 2)}\n`)
    const total = Object.values(routes).reduce((n, ids) => n + ids.length, 0)
    console.log(`wrote ${relative(REPO_ROOT, BASELINE_PATH)}: ${Object.keys(routes).length} routes, ${total} legacy ids`)
    return 0
  }

  if (mode === '--check') {
    const exceptions = loadExceptions({ legacy: loadLegacy() })
    const verdict = check(result, exceptions)
    if (json) console.log(JSON.stringify({ ...verdict, scanned: Object.keys(result.routes) }, null, 2))
    else {
      console.log(`residue check: ${Object.keys(result.routes).length} routes scanned, ${exceptions.length} declared exceptions`)
      for (const r of verdict.residue) console.log(`RESIDUE ${r.route}: ${r.legacy} (${r.importerCount} importers)\n    ${fmtChain(r.chain)}`)
      for (const s of verdict.stale) console.log(`STALE EXCEPTION ${s.route}: ${s.legacy} (${s.why})`)
      for (const u of verdict.unresolved) console.log(`UNRESOLVED ${u.route}: ${u.from}: ${u.what}`)
      console.log(verdict.ok ? 'OK' : 'FAIL')
    }
    return verdict.ok ? 0 : 1
  }

  if (json) { console.log(JSON.stringify(result, null, 2)); return 0 }
  if (mode === '--route') {
    const route = result.routes[wanted[0]]
    if (!route) { console.log(`${wanted[0]} is a redirect (${result.redirects.find(r => r.path === wanted[0])?.via.join(', ')}): nothing to scan`); return 0 }
    console.log(`${route.path}  pages: ${route.entries.map(e => `${e.name} (${e.file})`).join(', ')}`)
    console.log(`${route.reachedFiles} files reached, ${route.legacy.length} legacy modules`)
    for (const hit of route.legacy) {
      console.log(`\n${hit.id}  [${hit.importerCount} importing files]`)
      console.log(`  ${hit.reason}`)
      console.log(`  e.g. ${fmtChain(hit.chain)}`)
    }
    route.unresolved.forEach(u => console.log(`UNRESOLVED ${u.from}: ${u.what}`))
    return 0
  }
  // --all
  const rows = Object.values(result.routes).sort((a, b) => a.path.localeCompare(b.path))
  for (const r of rows) console.log(`${r.path}: ${r.legacy.length}${r.unresolved.length ? ` (${r.unresolved.length} unresolved)` : ''}`)
  console.log(`\n${rows.length} routes with a page; ${result.redirects.length} redirects: ${result.redirects.map(r => r.path).join(', ')}`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    if (!(error instanceof ScanError)) throw error
    console.error(`residue-scan: ${error.message}`)
    process.exitCode = 1
  }
}
