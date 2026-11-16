// · Which routes of src/App.js have a dark variant. With `dashboard_dark_mode` on, only the routes listed in
// src/brand/darkRoutes.json follow the dark mode; every other route is forced to light (fail closed).
//
// A route is dark-ready when the page graph (the walk of residue-scan.mjs) reaches no legacy module and no reached file outside
// the governed set paints a literal color (#hex, rgb(), hsl() in a string or a template, or in a stylesheet the file imports) or
// reads the legacy theme colors (`theme.colors`), which only have light values. Comments do not count. It is a static upper bound:
// a literal can be a brand color that must not change, so a route this scan rejects may still look right in dark.
//
//   node scripts/redesign/dark-routes.mjs           # one line per route, with what keeps it light
//   node scripts/redesign/dark-routes.mjs --check   # exit 1 when src/brand/darkRoutes.json differs from the scan
//   node scripts/redesign/dark-routes.mjs --write   # rewrite src/brand/darkRoutes.json from the scan
import { createRequire } from 'node:module'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REPO_ROOT, scan } from './residue-scan.mjs'

const require = createRequire(import.meta.url)
const SRC = join(REPO_ROOT, 'src')
export const DARK_ROUTES_PATH = join(SRC, 'brand/darkRoutes.json')
const PRODUCT_DIR = '@/components-dashboard/src/ui/src/components/Shared/Product/'
const GOVERNED = new Set(JSON.parse(readFileSync(join(REPO_ROOT, 'scripts/product-ui/governed-files.json'), 'utf8')).files
  .map(file => file.replace(/^src\//, '')))
// Token sources and color math, not paint: the release, the candidates, the adapter and the tenant accent (docs/BRAND.md).
const TOKEN_SOURCES = ['brand/', 'utils/bootTheme.js']

const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/
const exempt = rel => rel.startsWith(PRODUCT_DIR) || GOVERNED.has(rel) || TOKEN_SOURCES.some(prefix => rel.startsWith(prefix))

let babel
const parse = file => {
  babel ??= require('@babel/core')
  return babel.parseSync(readFileSync(file, 'utf8'), {
    filename: file, sourceType: 'module', configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] }
  })
}

const stripCssComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '')

// -> list of reasons this file has no dark variant ([] when it is fine)
const reasonsOf = (rel, cache) => {
  if (cache.has(rel)) return cache.get(rel)
  const file = join(SRC, rel)
  const reasons = []
  if (!exempt(rel)) {
    const visit = node => {
      if (!node || typeof node !== 'object' || reasons.length > 1) return
      if (Array.isArray(node)) { node.forEach(visit); return }
      if (node.type === 'StringLiteral' && COLOR.test(node.value)) reasons.push('literal color')
      if (node.type === 'TemplateElement' && COLOR.test(node.value.raw)) reasons.push('literal color')
      if ((node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') && !node.computed &&
        node.property?.name === 'colors' && /theme/i.test(node.object?.name ?? node.object?.property?.name ?? '')) reasons.push('theme.colors')
      for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'extra' || key.endsWith('Comments')) continue
        if (node[key] && typeof node[key] === 'object') visit(node[key])
      }
    }
    const ast = parse(file)
    visit(ast.program)
    for (const statement of ast.program.body) {
      const spec = statement.type === 'ImportDeclaration' ? statement.source.value : null
      if (!spec?.endsWith('.css') || !spec.startsWith('.')) continue
      const css = resolve(dirname(file), spec)
      if (existsSync(css) && !exempt(relative(SRC, css)) && COLOR.test(stripCssComments(readFileSync(css, 'utf8')))) {
        reasons.push(`literal color in ${relative(SRC, css)}`)
      }
    }
  }
  const unique = [...new Set(reasons)]
  cache.set(rel, unique)
  return unique
}

/** -> { [route]: { dark: boolean, legacy: [ids], files: [{ file, reasons }] } } for every route of App.js that renders a page */
export function scanDarkRoutes () {
  const result = scan()
  const cache = new Map()
  return Object.fromEntries(Object.entries(result.routes).map(([route, { legacy, files }]) => {
    const painted = files.map(file => ({ file, reasons: reasonsOf(file, cache) })).filter(entry => entry.reasons.length)
    const legacyIds = legacy.map(entry => entry.id)
    return [route, { dark: legacyIds.length === 0 && painted.length === 0, legacy: legacyIds, files: painted }]
  }))
}

// `*` (not found) is left out: as a path pattern it matches every url, so listing it would let every route go dark.
export const darkRouteList = routes => Object.keys(routes).filter(route => route !== '*' && routes[route].dark).sort()

const main = () => {
  const args = process.argv.slice(2)
  const routes = scanDarkRoutes()
  const list = darkRouteList(routes)
  if (args.includes('--write')) {
    const current = JSON.parse(readFileSync(DARK_ROUTES_PATH, 'utf8'))
    writeFileSync(DARK_ROUTES_PATH, `${JSON.stringify({ ...current, routes: list }, null, 2)}\n`)
    console.log(`dark-routes: wrote ${list.length} routes to ${relative(REPO_ROOT, DARK_ROUTES_PATH)}`)
    return
  }
  if (args.includes('--check')) {
    const stored = JSON.parse(readFileSync(DARK_ROUTES_PATH, 'utf8')).routes
    const missing = list.filter(route => !stored.includes(route))
    const extra = stored.filter(route => !list.includes(route))
    if (!missing.length && !extra.length) { console.log(`dark-routes: ${list.length} routes, matches the scan`); return }
    if (extra.length) console.error(`listed but not dark-ready (they would show a light-only screen in dark): ${extra.join(', ')}`)
    if (missing.length) console.error(`dark-ready but not listed: ${missing.join(', ')}`)
    console.error('fix the screen or run `node scripts/redesign/dark-routes.mjs --write` and review the diff')
    process.exitCode = 1
    return
  }
  for (const [route, { dark, legacy, files }] of Object.entries(routes)) {
    if (dark) { console.log(`dark   ${route}`); continue }
    const why = [legacy.length && `${legacy.length} legacy`, files.length && `${files.length} painted files (${files[0].file}: ${files[0].reasons.join(', ')})`]
    console.log(`light  ${route}  ← ${why.filter(Boolean).join('; ')}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
