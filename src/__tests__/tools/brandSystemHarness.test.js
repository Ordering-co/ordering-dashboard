import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const readRuntime = port => execFileSync(process.execPath, [
  '-e', "process.stdout.write(JSON.stringify(require('./scripts/brand-system/harness/runtime.cjs')))"
], { env: { ...process.env, BRAND_HARNESS_PORT: port }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

describe('owned harness network origin', () => {
  it('keeps HTTP, WebSocket and server port on the same loopback endpoint', () => {
    expect(JSON.parse(readRuntime('3023'))).toEqual({
      harnessPort: 3023,
      harnessOrigin: 'http://127.0.0.1:3023',
      harnessSocketOrigin: 'ws://127.0.0.1:3023/'
    })
  })

  it.each(['0', '80', '65536', '3023; echo injected', '3023/path', ''])('rejects invalid endpoint %s before building server commands', port => {
    expect(() => readRuntime(port)).toThrow('BRAND_HARNESS_PORT must be an integer')
  })
})

// F-1: the harness prebundles the dependencies of its dynamically mounted fixtures (vite.config.mjs optimizeDeps.include):
// one Vite discovers at run time is prebundled then and the page reloads in the middle of a test, so a cold cache (one per harness
// port) fails the first specs. The redesign brought Base UI subpaths, a dayjs plugin and posthog-js/react without adding them, and
// the list drifted. The families that grow (a new P/ piece on Base UI, a new dayjs plugin, PostHog) must be listed.
const ROOT = path.resolve(__dirname, '../../..')
// review R-2: src/analytics and src/utils are reached by the fixtures too (~/analytics from LoginForm, ProjectContext)
const SOURCES = ['src/@/components-dashboard/src', 'src/components', 'src/analytics', 'src/utils', 'scripts/brand-system/harness']
const WATCHED = /^(@base-ui\/react\/[\w-]+|dayjs\/plugin\/[\w-]+|posthog-js(\/[\w-]+)?)$/
const isSource = name => /\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name) && !name.includes('__tests__')
const walk = dir => readdirSync(dir).flatMap(name => {
  const full = path.join(dir, name)
  if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(full)
  return isSource(full) ? [full] : []
})
const harnessInclude = () => {
  const config = readFileSync(path.join(ROOT, 'scripts/brand-system/harness/vite.config.mjs'), 'utf8')
  // review R-4: a commented-out entry is not listed
  const block = config.slice(config.indexOf('include: ['), config.indexOf('esbuildOptions')).replace(/\/\/.*$/gm, '')
  return new Set([...block.matchAll(/'([^']+)'/g)].map(match => match[1]))
}
const watchedImports = () => {
  const found = new Map()
  for (const file of SOURCES.flatMap(dir => walk(path.join(ROOT, dir)))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
      if (WATCHED.test(match[1]) && !found.has(match[1])) found.set(match[1], path.relative(ROOT, file))
    }
  }
  return found
}

// Vite's dependency scan memoizes a resolution per specifier and importer directory, while the fixture seams are
// per importing file. The scan must get the same per-file seam as the server, or it fails on «No matching export».
const SCAN_PROBE = `
const { default: config } = await import(process.argv[1])
const plugin = (config.optimizeDeps.esbuildOptions.plugins || []).find(p => p.name === 'scan-fixture-seams')
let onResolve
plugin.setup({ onResolve: (options, callback) => { onResolve = callback } })
const ui = process.argv[2] + '/src/@/components-dashboard/src/ui/src/components/Shared/UI/'
const seam = file => onResolve({ path: '../../../../../index', importer: ui + file })?.path?.slice(process.argv[2].length + 1)
process.stdout.write(JSON.stringify({ city: seam('CitySelector.jsx'), logout: seam('LogoutButton.jsx'), other: seam('Modal.jsx') }))
`
const scanSeams = () => JSON.parse(execFileSync(process.execPath, [
  '--input-type=module', '-e', SCAN_PROBE, path.join(ROOT, 'scripts/brand-system/harness/vite.config.mjs'), ROOT
], { env: { ...process.env, BRAND_HARNESS_PORT: '3023' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))

// review: with a short include, a broken scan would leave ~95 dependencies to run-time discovery again, so the real scan runs
// here (vite optimize --force, a throwaway cache) and must find what include does not list.
const runScan = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'brand-harness-scan-'))
  const config = path.join(dir, 'vite.config.mjs')
  writeFileSync(config, `import base from ${JSON.stringify(path.join(ROOT, 'scripts/brand-system/harness/vite.config.mjs'))}\nexport default { ...base, cacheDir: ${JSON.stringify(path.join(dir, 'cache'))} }\n`)
  try {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'optimize', '--force', '--config', config], { cwd: ROOT, env: { ...process.env, BRAND_HARNESS_PORT: '3023' }, encoding: 'utf8' })
    const metadata = path.join(dir, 'cache/deps/_metadata.json')
    return { status: result.status, output: `${result.stdout}${result.stderr}`, optimized: existsSync(metadata) ? Object.keys(JSON.parse(readFileSync(metadata, 'utf8')).optimized) : [] }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('harness dependency scan', () => {
  it('scans every harness page without errors and prebundles what include does not list', () => {
    const scan = runScan()
    expect(scan.output).not.toMatch(/No matching export|Failed to (run dependency scan|scan for dependencies)/)
    expect(scan.status).toBe(0)
    expect(scan.optimized).toEqual(expect.arrayContaining(['react-dom', 'styled-components', '@handsontable/react']))
  }, 120000)

  it('resolves the fixture seams per importing file, not per directory', () => {
    expect(scanSeams()).toEqual({
      city: 'scripts/brand-system/harness/entity-selector-language.jsx',
      logout: 'scripts/brand-system/harness/shell-navigation-language.jsx',
      other: 'scripts/brand-system/harness/language.js'
    })
  })
})

describe('harness dependency prebundling', () => {
  // with the scan working, include holds 39 entries: the 28 of the watched families (20 Base UI subpaths, 6 dayjs
  // plugins, posthog-js and posthog-js/react) and the 11 a cold run still discovers out of the scan's reach. One known entry of
  // each group must be read, so a truncated or misread list still fails.
  it('reads the include list and finds the watched imports', () => {
    const include = harnessInclude()
    expect(include.size).toBeGreaterThan(30)
    for (const entry of ['@base-ui/react/button', 'dayjs/plugin/utc', 'posthog-js', '@sentry/react']) expect(include.has(entry)).toBe(true)
    expect(watchedImports().has('@base-ui/react/button')).toBe(true)
  })

  it('prebundles every Base UI subpath, dayjs plugin and posthog-js entry the dashboard imports', () => {
    const include = harnessInclude()
    const missing = [...watchedImports()].filter(([specifier]) => !include.has(specifier)).map(([specifier, file]) => `${specifier} (${file})`)
    expect(missing).toEqual([])
  })
})
