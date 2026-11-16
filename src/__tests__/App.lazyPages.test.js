import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// redesign W0-10b (T0-41, decision 33): the pages are code-split by route. App.js keeps the shell (Layout, SidebarMenu,
// ProtectedRoute, providers, command palette, banners) static and loads every page of src/pages with React.lazy behind a
// single Suspense whose fallback is the boot skeleton (AppBootLoader, resolveBootScreen(pathname)): the one the boot paints.
const src = join(__dirname, '..')
const app = readFileSync(join(src, 'App.js'), 'utf8')

// `import … from './pages/X'` (any specifier list), `import './pages/X'` and `export … from './pages/X'`.
const staticPageImports = app
  .split('\n')
  .filter(line => /^\s*(import|export)\b[^(]*['"]\.{1,2}\/(\.\.\/)*pages\//.test(line) && !/import\(/.test(line))

describe('App.js code-splits the pages (W0-10b)', () => {
  it('does not statically import any page of src/pages', () => {
    expect(staticPageImports).toEqual([])
  })

  it('loads every page that a route renders with React.lazy', () => {
    const pageDirs = readdirSync(join(src, 'pages'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
    // redesign tramo B r3 (W0-PB2-01): each import is wrapped in lazyWithReload (a chunk gone after a deploy reloads the page once).
    const lazyImports = [...app.matchAll(/lazy\(\(\) => lazyWithReload\(\(\) => import\('\.\/pages\/([\w/]+)'\)\)/g)].map(match => match[1].split('/')[0])
    expect(lazyImports.length).toBeGreaterThan(55)
    lazyImports.forEach(dir => expect(pageDirs).toContain(dir))
    // The routes the pilot and the entry flow depend on are among them.
    ;['Home', 'OrdersList', 'Settings', 'Login'].forEach(dir => expect(lazyImports).toContain(dir))
  })

  // redesign tramo B r3 (W0-PB2-01): no page import escapes the reload wrapper, and there is no global `vite:preloadError` listener.
  it('wraps every lazy page import in lazyWithReload', () => {
    const lazies = app.match(/\blazy\(/g) ?? []
    expect(lazies.length).toBeGreaterThan(55)
    expect(app.match(/\blazy\(\(\) => lazyWithReload\(\(\) => import\(/g)).toHaveLength(lazies.length)
    expect(app).toMatch(/import \{ lazyWithReload \} from '\.\/utils\/chunkReload'/)
    expect(readFileSync(join(src, 'index.js'), 'utf8')).not.toMatch(/addEventListener\(\s*['"]vite:preloadError|installChunkReloadGuard\(/)
  })

  // T0-50 (W0-PB1-03): main brought a second place that draws a page, the docs.ordering.co popup (`DocsConnectApp` draws
  // `<Login>` outside the routes). So App.js has two Suspense blocks: the one around the routes, and the popup's own.
  const routeSuspenseOpen = '<Suspense fallback={<RouteFallback'
  const suspenseBlocks = () => {
    const blocks = []
    let from = app.indexOf('<Suspense')
    while (from !== -1) {
      const to = app.indexOf('</Suspense>', from)
      blocks.push([from, to])
      from = app.indexOf('<Suspense', to)
    }
    return blocks
  }

  it('wraps the routes in one Suspense whose fallback is the boot skeleton of the current path', () => {
    expect(app.split(routeSuspenseOpen)).toHaveLength(2)
    const routeAt = app.indexOf(routeSuspenseOpen)
    const fallback = app.slice(routeAt).match(/<Suspense fallback=\{([\s\S]*?)\}>\s*\n/)
    expect(fallback).not.toBeNull()
    expect(fallback[1]).toMatch(/RouteFallback|AppBootLoader/)
    // The component the fallback names renders AppBootLoader with the pathname the boot screen is resolved from.
    expect(app).toMatch(/<AppBootLoader[\s\S]{0,200}route=\{pathname\}/)
    // The real sidebar is already on screen around the routes: the skeleton is asked for no sidebar column, not styled away.
    expect(app).toMatch(/<AppBootLoader[\s\S]{0,300}shell=\{false\}/)
    expect(app).not.toMatch(/boot-sidebar/)
    // The Suspense sits around the Switch, not around the shell.
    const routeEnd = app.indexOf('</Suspense>', routeAt)
    expect(routeAt).toBeGreaterThan(app.indexOf('<Layout>'))
    expect(routeAt).toBeLessThan(app.indexOf('<Switch location={routesLocation}>'))
    expect(routeEnd).toBeGreaterThan(app.indexOf('</Switch>'))
    expect(routeEnd).toBeLessThan(app.indexOf('</Layout>'))
  })

  // redesign tramo B r2 (W0-PB1-03): a lazy page suspends. Outside a Suspense (a popup, a banner, a `{cond && <Login />}`
  // before the routes) it would suspend without a limit: blank until the chunk arrives, and blank for good if it fails.
  it('uses every lazy binding only inside a <Suspense>…</Suspense> block', () => {
    const bindings = [...app.matchAll(/^const (\w+) = lazy\(/gm)].map(match => match[1])
    expect(bindings.length).toBeGreaterThan(55)
    const blocks = suspenseBlocks()
    expect(blocks.length).toBeGreaterThan(0)
    blocks.forEach(([from, to]) => expect(to).toBeGreaterThan(from))
    // Outside the blocks the bindings may only be declared (the `const X = lazy(…)` lines), never used; comments do not count.
    let outside = ''
    let cursor = 0
    blocks.forEach(([from, to]) => {
      outside += app.slice(cursor, from)
      cursor = to
    })
    outside = (outside + app.slice(cursor))
      .split('\n')
      // the shell's by-file import paths name folders like Assistant or Login; an import is not a use.
      .filter(line => !/^const \w+ = lazy\(/.test(line) && !/^\s*(\/\/|\*)/.test(line) && !/^import\b/.test(line))
      .join('\n')
    const used = bindings.filter(name => new RegExp(`<${name}[\\s/>]|\\b${name}\\b`).test(outside))
    expect(used).toEqual([])
  })

  // T0-50 (W0-PB1-03): the pages main brought are lazy like the rest, and the popup's Login waits behind the boot skeleton.
  it('loads the pages main brought (Builder, BuilderProduct, OpenSourceCode) lazily, and the popup Login inside its own Suspense', () => {
    ;['Builder', 'BuilderProduct', 'OpenSourceCode'].forEach(name => {
      expect(app).toMatch(new RegExp(`^const ${name} = lazy\\(\\(\\) => lazyWithReload\\(\\(\\) => import\\('\\./pages/${name}'\\)\\)`, 'm'))
    })
    const docsAt = app.indexOf('const DocsConnectApp')
    const dashboardAt = app.indexOf('const DashboardApp')
    expect(docsAt).toBeGreaterThan(0)
    const docs = app.slice(docsAt, dashboardAt)
    const loginAt = docs.indexOf('<Login')
    expect(loginAt).toBeGreaterThan(0)
    expect(docs.lastIndexOf('<Suspense', loginAt)).toBeGreaterThan(-1)
    expect(docs.indexOf('</Suspense>', loginAt)).toBeGreaterThan(loginAt)
    expect(docs.slice(docs.lastIndexOf('<Suspense', loginAt), loginAt)).toMatch(/fallback=\{\(?\s*<AppBootLoader/)
    expect(docs.slice(0, loginAt).lastIndexOf('<ChunkErrorBoundary')).toBeGreaterThan(-1)
  })

  // redesign tramo B r2 (W0-PB1-01): a chunk that fails to load must not blank the app.
  it('wraps the Suspense in a ChunkErrorBoundary inside Layout, keyed by the pathname, so the menu stays', () => {
    const routeAt = app.indexOf(routeSuspenseOpen)
    const routeEnd = app.indexOf('</Suspense>', routeAt)
    // the routes match the last location with network (routesLocation), and the boundary resets with the same path
    expect(app.match(/<ChunkErrorBoundary resetKey=\{routesLocation\.pathname\}>/g)).toHaveLength(1)
    const boundaryAt = app.indexOf('<ChunkErrorBoundary resetKey={routesLocation.pathname}>')
    const boundaryEnd = app.indexOf('</ChunkErrorBoundary>', routeEnd)
    expect(boundaryAt).toBeGreaterThan(app.indexOf('<Layout>'))
    expect(boundaryAt).toBeLessThan(routeAt)
    expect(boundaryEnd).toBeGreaterThan(routeEnd)
    expect(boundaryEnd).toBeLessThan(app.indexOf('</Layout>'))
    // The sidebar is a sibling of the boundary, not inside it.
    expect(app.indexOf('<SidebarMenu')).toBeLessThan(boundaryAt)
    // Every Suspense has a ChunkErrorBoundary around it.
    expect(app.match(/<ChunkErrorBoundary\b/g)).toHaveLength(suspenseBlocks().length)
    suspenseBlocks().forEach(([from, to]) => {
      expect(app.lastIndexOf('<ChunkErrorBoundary', from)).toBeGreaterThan(app.lastIndexOf('</ChunkErrorBoundary>', from))
      expect(app.indexOf('</ChunkErrorBoundary>', to)).toBeGreaterThan(to)
    })
  })

  it('keeps the shell static', () => {
    ;['Layout', 'SidebarMenu', 'ProtectedRoute', 'CommandPalette', 'CommandPaletteProvider', 'AppBootLoader'].forEach(name => {
      // static, by file (import { X } from '~ui/…'), never from the ~ui index.
      expect(app).toMatch(new RegExp(`^import \\{[^}]*\\b${name}\\b[^}]*\\} from '~ui/`, 'm'))
    })
  })
})
