import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { configure, doctor, restore, detect, validateManifest, verifyPublicProject } from './core.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
// Isolated fixture manifest; consumers customize product.json without changing these checks.
const manifest = { schemaVersion: 1, product: 'example-product', configFile: 'src/config.json', projectPaths: [{ path: ['project'], required: true }, { path: ['configurations', 'subdomain'], required: false }], projectPlaceholders: ['', 'YOUR_PROJECT', 'your-project', 'your-project-slug'] }
function initial (extra = {}) {
  return {
    project: 'YOUR_PROJECT', api: { url: 'https://api.ordering.co/', version: 'v400', language: 'en', timeout: 9000 },
    socket: { url: 'https://custom-sockets.example.test', reconnect: false },
    app_id: 'app_my_product', configurations: { subdomain: 'YOUR_PROJECT', map: { enabled: false } },
    custom: { colors: ['red', 'blue'], value: 'a customized value' }, use_kiosk: true,
    ...extra
  }
}
async function fixture (t, config = initial()) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ordering-onboarding-test-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'src'))
  const filename = path.join(root, 'src/config.json')
  const raw = JSON.stringify(config, null, 4) + '\n'
  await fs.writeFile(filename, raw, { mode: 0o640 })
  return { root, filename, raw, config }
}
function publicRequest (project = 'chosen', change = {}) {
  const calls = []
  const request = async (url, options) => {
    calls.push({ url, options })
    if (change.throw) throw new Error('sensitive-network-detail')
    return { ok: change.ok ?? true, json: async () => change.body ?? { error: false, result: { code: project, unrelated: 'not-exported' } } }
  }
  return { calls, request }
}
test('configure changes only project paths and preserves personalized API/socket/IDs/flags', async t => {
  const f = await fixture(t); const api = publicRequest()
  const result = await configure(f.root, manifest, { project: 'chosen' }, api.request)
  const current = JSON.parse(await fs.readFile(f.filename, 'utf8'))
  assert.deepEqual(current, { ...f.config, project: 'chosen', configurations: { ...f.config.configurations, subdomain: 'chosen' } })
  assert.equal(result.changed, true)
  assert.deepEqual(result.verification, { project: true, authenticated: false })
  assert.equal(api.calls.length, 1)
  assert.equal(api.calls[0].url, 'https://api.ordering.co/v400/en/chosen/current')
  assert.equal(api.calls[0].options.method, 'GET')
  assert.equal(api.calls[0].options.credentials, 'omit')
  assert.equal(api.calls[0].options.redirect, 'error')
  assert.deepEqual(api.calls[0].options.headers, { Accept: 'application/json' })
  const state = path.join(f.root, '.ordering-setup')
  assert.equal(await fs.readFile(path.join(state, result.backup), 'utf8'), f.raw)
  assert.equal((await fs.stat(state)).mode & 0o777, 0o700)
  assert.equal((await fs.stat(path.join(state, result.backup))).mode & 0o777, 0o600)
  assert.equal((await fs.stat(f.filename)).mode & 0o777, 0o640)
  assert.equal(JSON.stringify(result).includes('customized'), false)
})
test('same project no-op preserves bytes and creates no backup, but still verifies public project', async t => {
  const f = await fixture(t, initial({ project: 'chosen', configurations: { subdomain: 'chosen' } })); const api = publicRequest()
  assert.deepEqual(await configure(f.root, manifest, { project: 'chosen' }, api.request), { changed: false, project: 'chosen', verification: { project: true, authenticated: false } })
  assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
  await assert.rejects(fs.access(path.join(f.root, '.ordering-setup')), { code: 'ENOENT' })
  assert.equal(api.calls.length, 1)
})
test('HTTP/envelope/mismatched project/network errors never overwrite config or create backup', async t => {
  const f = await fixture(t)
  for (const change of [{ ok: false }, { throw: true }, { body: { error: true, result: { code: 'chosen' } } }, { body: { error: false, result: { code: 'foreign' } } }]) {
    await assert.rejects(configure(f.root, manifest, { project: 'chosen' }, publicRequest('chosen', change).request), /public_project_(?:unavailable|mismatch)/)
    assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
    await assert.rejects(fs.access(path.join(f.root, '.ordering-setup')), { code: 'ENOENT' })
  }
})
test('changing a configured tenant requires explicit confirmation before any network request', async t => {
  const f = await fixture(t, initial({ project: 'original', configurations: { subdomain: 'original' } })); const api = publicRequest()
  await assert.rejects(configure(f.root, manifest, { project: 'chosen' }, api.request), /project_change_confirmation_required/)
  assert.equal(api.calls.length, 0); assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
  assert.equal((await configure(f.root, manifest, { project: 'chosen', confirmProjectChange: true }, api.request)).changed, true)
})
test('a different nested tenant also needs confirmation and optional absent path is preserved', async t => {
  const f = await fixture(t, initial({ configurations: { subdomain: 'foreign', other: true } }))
  await assert.rejects(configure(f.root, manifest, { project: 'chosen' }, publicRequest().request), /project_change_confirmation_required/)
  await configure(f.root, manifest, { project: 'chosen', confirmProjectChange: true }, publicRequest().request)
  const missing = await fixture(t, initial({ configurations: { other: true } }))
  await configure(missing.root, manifest, { project: 'chosen' }, publicRequest().request)
  assert.deepEqual(JSON.parse(await fs.readFile(missing.filename, 'utf8')).configurations, { other: true })
})
test('explicit API/language overrides update only supplied keys', async t => {
  const f = await fixture(t); const api = publicRequest()
  await configure(f.root, manifest, { project: 'chosen', apiUrl: 'https://api.example.test', language: 'es' }, api.request)
  const next = JSON.parse(await fs.readFile(f.filename, 'utf8'))
  assert.deepEqual(next.api, { ...f.config.api, url: 'https://api.example.test', language: 'es' })
  assert.deepEqual(next.socket, f.config.socket)
  assert.equal(api.calls[0].url, 'https://api.example.test/v400/es/chosen/current')
})
test('default backend language is preserved and accepted for Business/Driver templates', async t => {
  const f = await fixture(t, initial({ api: { url: 'https://api.orderingplus.com', version: 'v400', language: 'default', custom: true } })); const api = publicRequest()
  await configure(f.root, manifest, { project: 'chosen' }, api.request)
  assert.deepEqual(JSON.parse(await fs.readFile(f.filename, 'utf8')).api, f.config.api)
  assert.equal(api.calls[0].url, 'https://api.orderingplus.com/v400/default/chosen/current')
})
test('invalid project/HTTP host/userinfo/URL path/version/language fail before network or writes', async t => {
  const f = await fixture(t); const api = publicRequest()
  for (const options of [{ project: '../bad' }, { project: 'chosen', apiUrl: 'http://api.example.test' }, { project: 'chosen', apiUrl: 'https://key:secret@api.example.test' }, { project: 'chosen', apiUrl: 'https://api.example.test/path' }, { project: 'chosen', apiVersion: 'v999' }, { project: 'chosen', language: '../en' }]) await assert.rejects(configure(f.root, manifest, options, api.request), /invalid_/)
  assert.equal(api.calls.length, 0); assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
  await assert.rejects(verifyPublicProject('chosen', { url: 'http://x.test', version: 'v400', language: 'en' }, api.request), /invalid_api_url/)
})
test('doctor verifies consistent configured public identity without membership claim', async t => {
  const f = await fixture(t, initial({ project: 'chosen', configurations: { subdomain: 'chosen' } }))
  assert.deepEqual(await doctor(f.root, manifest, publicRequest().request), { project: 'chosen', verification: { project: true, authenticated: false } })
  const mismatch = await fixture(t, initial({ project: 'chosen', configurations: { subdomain: 'foreign' } }))
  const api = publicRequest(); await assert.rejects(doctor(mismatch.root, manifest, api.request), /configured_project_mismatch/); assert.equal(api.calls.length, 0)
})
test('restore recovers exact bytes/mode and saves current customization for undo', async t => {
  const f = await fixture(t)
  const result = await configure(f.root, manifest, { project: 'chosen' }, publicRequest().request)
  const custom = JSON.parse(await fs.readFile(f.filename, 'utf8')); custom.custom.extra = 'new edit'
  const customized = JSON.stringify(custom) + '\n'; await fs.writeFile(f.filename, customized)
  const restored = await restore(f.root, manifest, result.backup)
  assert.equal(restored.changed, true); assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
  assert.equal((await fs.stat(f.filename)).mode & 0o777, 0o640)
  assert.equal(await fs.readFile(path.join(f.root, '.ordering-setup', restored.backup), 'utf8'), customized)
  assert.deepEqual(await restore(f.root, manifest, result.backup), { restored: false, changed: false })
  await restore(f.root, manifest, restored.backup)
  assert.equal(await fs.readFile(f.filename, 'utf8'), customized)
})
test('restore rejects traversal, altered backup bytes and foreign receipt without overwriting', async t => {
  const f = await fixture(t); const result = await configure(f.root, manifest, { project: 'chosen' }, publicRequest().request)
  const current = await fs.readFile(f.filename, 'utf8')
  for (const name of ['../config.json', '/tmp/outside', 'config.json']) await assert.rejects(restore(f.root, manifest, name), /invalid_backup/)
  const filename = path.join(f.root, '.ordering-setup', result.backup)
  await fs.writeFile(filename, f.raw + ' '); await assert.rejects(restore(f.root, manifest, result.backup), /invalid_backup/)
  await fs.writeFile(filename, f.raw)
  const metaPath = filename + '.meta.json'; const meta = JSON.parse(await fs.readFile(metaPath, 'utf8')); meta.configFile = '../outside.json'
  await fs.writeFile(metaPath, JSON.stringify(meta)); await assert.rejects(restore(f.root, manifest, result.backup), /invalid_backup/)
  assert.equal(await fs.readFile(f.filename, 'utf8'), current)
})
test('config, parent-directory and backup-state symlinks are refused without altering destinations', async t => {
  const f = await fixture(t); const outside = await fixture(t)
  await fs.unlink(f.filename); await fs.symlink(outside.filename, f.filename)
  const api = publicRequest(); await assert.rejects(configure(f.root, manifest, { project: 'chosen' }, api.request), /unsafe_path/); assert.equal(api.calls.length, 0)
  await fs.unlink(f.filename); await fs.rmdir(path.join(f.root, 'src')); await fs.symlink(path.join(outside.root, 'src'), path.join(f.root, 'src'))
  await assert.rejects(configure(f.root, manifest, { project: 'chosen' }, api.request), /unsafe_path/)
  assert.equal(await fs.readFile(outside.filename, 'utf8'), outside.raw)
  const state = await fixture(t); await fs.symlink(outside.root, path.join(state.root, '.ordering-setup'))
  await assert.rejects(configure(state.root, manifest, { project: 'chosen' }, publicRequest().request), /unsafe_path/)
  assert.equal(await fs.readFile(state.filename, 'utf8'), state.raw)
})
test('restore refuses a symlinked backup file', async t => {
  const f = await fixture(t); const result = await configure(f.root, manifest, { project: 'chosen' }, publicRequest().request)
  const before = await fs.readFile(f.filename, 'utf8'); const filename = path.join(f.root, '.ordering-setup', result.backup)
  await fs.unlink(filename); await fs.symlink(f.filename, filename)
  await assert.rejects(restore(f.root, manifest, result.backup), /unsafe_path/)
  assert.equal(await fs.readFile(f.filename, 'utf8'), before)
})
test('configuration modified during public validation is preserved', async t => {
  const f = await fixture(t); const edited = JSON.stringify({ ...f.config, custom: 'concurrent edit' })
  const request = async () => { await fs.writeFile(f.filename, edited); return { ok: true, json: async () => ({ error: false, result: { code: 'chosen' } }) } }
  await assert.rejects(configure(f.root, manifest, { project: 'chosen' }, request), /configuration_changed_during_setup/)
  assert.equal(await fs.readFile(f.filename, 'utf8'), edited)
  assert.equal((await fs.readdir(path.join(f.root, 'src'))).filter(file => file.endsWith('.tmp')).length, 0)
})
test('manifest cannot escape checkout or inject prototype paths', () => {
  for (const configFile of ['../config.json', '/tmp/config.json', 'src/../config.json', 'src\\config.json']) assert.throws(() => validateManifest({ ...manifest, configFile }), /invalid_config_path/)
  assert.throws(() => validateManifest({ ...manifest, projectPaths: [{ path: ['__proto__', 'project'], required: true }] }), /invalid_project_path/)
})

const franchiseManifest = { ...manifest, additionalSelection: { field: 'franchiseSlug', flag: 'franchise-slug', endpoint: 'franchises', identity: 'slug', required: true } }
function franchiseRequest (items = [{ id: 5, slug: 'selected-store', enabled: true }]) {
  const calls = []
  const request = async (url, options) => {
    calls.push({ url, options })
    return { ok: true, json: async () => ({ error: false, result: url.endsWith('/current') ? { code: 'chosen' } : items }) }
  }
  return { calls, request }
}
test('required franchise selection is exact and enabled, with public validation before write', async t => {
  const f = await fixture(t, initial({ franchiseSlug: '' })); const api = franchiseRequest()
  await assert.rejects(configure(f.root, franchiseManifest, { project: 'chosen' }, api.request), /franchise_selection_required/)
  assert.equal(api.calls.length, 0)
  const result = await configure(f.root, franchiseManifest, { project: 'chosen', franchiseSlug: 'selected-store' }, api.request)
  assert.equal(JSON.parse(await fs.readFile(f.filename, 'utf8')).franchiseSlug, 'selected-store')
  assert.deepEqual(result.verification, { project: true, authenticated: false, franchise: true })
  const endpoint = new URL(api.calls[1].url)
  assert.equal(endpoint.origin + endpoint.pathname, 'https://api.ordering.co/v400/en/chosen/franchises')
  assert.deepEqual(JSON.parse(endpoint.searchParams.get('where')), { conditions: [{ attribute: 'slug', value: 'selected-store' }], conector: 'AND' })
  assert.equal(endpoint.searchParams.get('params'), 'id,slug,enabled')
  assert.equal(endpoint.searchParams.get('page'), '1')
  assert.equal(endpoint.searchParams.get('page_size'), '2')
  assert.equal(api.calls.every(call => call.options.method === 'GET' && !call.options.headers.Authorization && !call.options.headers['X-Api-Key']), true)
  assert.deepEqual((await doctor(f.root, franchiseManifest, franchiseRequest().request)).verification, result.verification)
})
test('unavailable/disabled/duplicate franchise is rejected and existing selection needs confirmation', async t => {
  const f = await fixture(t, initial({ franchiseSlug: '' }))
  for (const items of [[], [{ id: 1, slug: 'different', enabled: true }], [{ id: 1, slug: 'selected-store', enabled: false }], [{ id: 1, slug: 'selected-store', enabled: true }, { id: 2, slug: 'selected-store', enabled: true }]]) {
    await assert.rejects(configure(f.root, franchiseManifest, { project: 'chosen', franchiseSlug: 'selected-store' }, franchiseRequest(items).request), /franchise_selection_not_enabled/)
    assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
    await assert.rejects(fs.access(path.join(f.root, '.ordering-setup')), { code: 'ENOENT' })
  }
  const old = await fixture(t, initial({ project: 'chosen', configurations: { subdomain: 'chosen' }, franchiseSlug: 'old-store' })); const api = franchiseRequest()
  await assert.rejects(configure(old.root, franchiseManifest, { project: 'chosen', franchiseSlug: 'selected-store' }, api.request), /selection_change_confirmation_required/)
  assert.equal(api.calls.length, 0)
  await configure(old.root, franchiseManifest, { project: 'chosen', franchiseSlug: 'selected-store', confirmProjectChange: true }, api.request)
})
test('generic consumers cannot write franchiseSlug without an explicit manifest allowlist', async t => {
  const f = await fixture(t, initial({ franchiseSlug: 'custom-preserved' })); const api = publicRequest()
  await assert.rejects(configure(f.root, manifest, { project: 'chosen', franchiseSlug: 'selected-store' }, api.request), /franchise_selection_not_supported/)
  assert.equal(api.calls.length, 0)
  await configure(f.root, manifest, { project: 'chosen' }, api.request)
  assert.equal(JSON.parse(await fs.readFile(f.filename, 'utf8')).franchiseSlug, 'custom-preserved')
  assert.throws(() => validateManifest({ ...franchiseManifest, additionalSelection: { ...franchiseManifest.additionalSelection, field: 'apiKey' } }), /invalid_manifest/)
})
test('filtered franchise lookup rejects invalid IDs or ignored filter without writing configuration', async t => {
  const f = await fixture(t, initial({ franchiseSlug: '' }))
  for (const items of [
    [{ slug: 'selected-store', enabled: true }],
    [{ id: 0, slug: 'selected-store', enabled: true }],
    [{ id: -2, slug: 'selected-store', enabled: true }],
    [{ id: '5', slug: 'selected-store', enabled: true }],
    [{ id: 5.5, slug: 'selected-store', enabled: true }],
    [{ id: 5, slug: 'selected-store', enabled: true }, { id: 6, slug: 'other', enabled: true }]
  ]) {
    await assert.rejects(configure(f.root, franchiseManifest, { project: 'chosen', franchiseSlug: 'selected-store' }, franchiseRequest(items).request), /franchise_selection_not_enabled/)
    assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
    await assert.rejects(fs.access(path.join(f.root, '.ordering-setup')), { code: 'ENOENT' })
  }
})
test('unsupported filter HTTP failure and ambiguous pagination keep configuration unchanged', async t => {
  const f = await fixture(t, initial({ franchiseSlug: '' }))
  for (const failure of ['http', 'pagination', 'envelope']) {
    const request = async url => url.endsWith('/current')
      ? { ok: true, json: async () => ({ error: false, result: { code: 'chosen' } }) }
      : { ok: failure !== 'http', json: async () => ({ error: failure === 'envelope', result: [{ id: 5, slug: 'selected-store', enabled: true }], pagination: { total: 2 } }) }
    await assert.rejects(configure(f.root, franchiseManifest, { project: 'chosen', franchiseSlug: 'selected-store' }, request), /franchise_(?:unavailable|selection_not_enabled)/)
    assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
    await assert.rejects(fs.access(path.join(f.root, '.ordering-setup')), { code: 'ENOENT' })
  }
})

const numericFranchiseManifest = { ...franchiseManifest, additionalSelection: { ...franchiseManifest.additionalSelection, persist: 'id' } }
test('SDK-compatible franchise setup persists verified numeric ID and exports only resolved public selection', async t => {
  const f = await fixture(t, initial({ franchiseSlug: null })); const api = franchiseRequest()
  const result = await configure(f.root, numericFranchiseManifest, { project: 'chosen', franchiseSlug: 'selected-store' }, api.request)
  const config = JSON.parse(await fs.readFile(f.filename, 'utf8'))
  assert.equal(config.franchiseSlug, 5); assert.equal(typeof config.franchiseSlug, 'number')
  assert.deepEqual(config, { ...f.config, project: 'chosen', franchiseSlug: 5, configurations: { ...f.config.configurations, subdomain: 'chosen' } })
  assert.deepEqual(result.selection, { id: 5, slug: 'selected-store' })
  assert.equal(JSON.stringify(result).includes('enabled'), false)
  const checked = await doctor(f.root, numericFranchiseManifest, api.request)
  assert.deepEqual(checked.selection, result.selection)
  const lookup = new URL(api.calls.at(-1).url)
  assert.deepEqual(JSON.parse(lookup.searchParams.get('where')), { conditions: [{ attribute: 'id', value: 5 }], conector: 'AND' })
  assert.equal(lookup.searchParams.get('page_size'), '2')
})
test('configured same-project numeric identity can be verified and reused without slug flag, preserving bytes', async t => {
  const f = await fixture(t, initial({ project: 'chosen', configurations: { subdomain: 'chosen' }, franchiseSlug: 5 })); const api = franchiseRequest()
  const result = await configure(f.root, numericFranchiseManifest, { project: 'chosen' }, api.request)
  assert.equal(result.changed, false); assert.deepEqual(result.selection, { id: 5, slug: 'selected-store' })
  assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
  assert.deepEqual(JSON.parse(new URL(api.calls[1].url).searchParams.get('where')).conditions, [{ attribute: 'id', value: 5 }])
  await assert.rejects(fs.access(path.join(f.root, '.ordering-setup')), { code: 'ENOENT' })
  const unselected = await fixture(t, initial({ franchiseSlug: null }))
  await assert.rejects(configure(unselected.root, numericFranchiseManifest, { project: 'chosen' }, api.request), /franchise_selection_required/)
})
test('same source slug migrates atomically to numeric ID with exact restore of customization', async t => {
  const f = await fixture(t, initial({ project: 'chosen', configurations: { subdomain: 'chosen', custom: 'preserved' }, franchiseSlug: 'selected-store' }))
  const result = await configure(f.root, numericFranchiseManifest, { project: 'chosen', franchiseSlug: 'selected-store' }, franchiseRequest().request)
  assert.equal(result.changed, true)
  const next = JSON.parse(await fs.readFile(f.filename, 'utf8'))
  assert.deepEqual(next, { ...f.config, franchiseSlug: 5 })
  await restore(f.root, numericFranchiseManifest, result.backup)
  assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
})
test('a real change of resolved numeric or slug identity requires confirmation and never writes first', async t => {
  for (const previous of [7, 'old-store']) {
    const f = await fixture(t, initial({ project: 'chosen', configurations: { subdomain: 'chosen' }, franchiseSlug: previous }))
    await assert.rejects(configure(f.root, numericFranchiseManifest, { project: 'chosen', franchiseSlug: 'selected-store' }, franchiseRequest().request), /selection_change_confirmation_required/)
    assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
    await assert.rejects(fs.access(path.join(f.root, '.ordering-setup')), { code: 'ENOENT' })
    await configure(f.root, numericFranchiseManifest, { project: 'chosen', franchiseSlug: 'selected-store', confirmProjectChange: true }, franchiseRequest().request)
    assert.equal(JSON.parse(await fs.readFile(f.filename, 'utf8')).franchiseSlug, 5)
  }
})
test('changing project cannot reuse an old numeric selection implicitly, even with project confirmation', async t => {
  const f = await fixture(t, initial({ project: 'original', configurations: { subdomain: 'original' }, franchiseSlug: 5 })); const api = franchiseRequest()
  await assert.rejects(configure(f.root, numericFranchiseManifest, { project: 'chosen', confirmProjectChange: true }, api.request), /franchise_selection_required/)
  assert.equal(api.calls.length, 0); assert.equal(await fs.readFile(f.filename, 'utf8'), f.raw)
})
test('numeric doctor rejects wrong ID/string configuration and persist only accepts id or slug', async t => {
  const f = await fixture(t, initial({ project: 'chosen', configurations: { subdomain: 'chosen' }, franchiseSlug: 7 }))
  await assert.rejects(doctor(f.root, numericFranchiseManifest, franchiseRequest().request), /franchise_selection_not_enabled/)
  const legacy = await fixture(t, initial({ project: 'chosen', configurations: { subdomain: 'chosen' }, franchiseSlug: 'selected-store' }))
  await assert.rejects(doctor(legacy.root, numericFranchiseManifest, franchiseRequest().request), /invalid_franchise_selection/)
  for (const persist of ['name', 1, true, null]) assert.throws(() => validateManifest({ ...franchiseManifest, additionalSelection: { ...franchiseManifest.additionalSelection, persist } }), /invalid_manifest/)
  validateManifest({ ...franchiseManifest, additionalSelection: { ...franchiseManifest.additionalSelection, persist: 'slug' } })
})

async function launcher (t, identity, extra = '') {
  const f = await fixture(t); const quickstart = path.join(f.root, 'ordering-dev-quickstart')
  await fs.mkdir(path.join(quickstart, '.clients'), { recursive: true })
  await fs.writeFile(path.join(quickstart, '.clients/runtime-ready'), '')
  const helper = path.join(quickstart, 'ordering')
  const source = `#!${process.execPath}\nimport readline from 'node:readline';\n${extra}\nconst lines=readline.createInterface({input:process.stdin});lines.on('line',line=>{const input=JSON.parse(line);if(input.method==='initialize')console.log(JSON.stringify({jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-03-26'}}));if(input.method==='tools/call')console.log(JSON.stringify({jsonrpc:'2.0',id:2,result:{structuredContent:${JSON.stringify(identity)}}}));});\n`
  // Extensionless executables default to CommonJS. Feed an isolated .mjs via a shell launcher.
  const runtime = path.join(quickstart, 'fixture.mjs'); await fs.writeFile(runtime, source.split('\n').slice(1).join('\n'))
  await fs.writeFile(helper, `#!/bin/sh\nexec '${process.execPath}' '${runtime}'\n`, { mode: 0o700 })
  return { ...f, helper }
}
test('known launcher probe exports only project/status, not user data or keys', async t => {
  const f = await launcher(t, { project: 'chosen', user: { id: 1, role: 'administrator', email: 'hidden@example.test' }, token: { scope: 'read', key: 'ord_mcp_secret' } }, "console.error('hidden secret on stderr')")
  assert.deepEqual(await detect({ home: f.root }), { status: 'connected', project: 'chosen', source: 'existing-launcher', authenticated: true })
})
test('expired/foreign permission launcher is unavailable and missing/unprepared helper is none', async t => {
  const f = await launcher(t, { project: 'chosen', user: { id: 1, role: 'customer' }, token: { scope: 'read' } })
  assert.deepEqual(await detect({ helper: f.helper }), { status: 'unavailable' })
  await fs.unlink(path.join(path.dirname(f.helper), '.clients/runtime-ready'))
  assert.deepEqual(await detect({ helper: f.helper }), { status: 'none' })
  assert.deepEqual(await detect({ home: path.join(f.root, 'absent') }), { status: 'none' })
  await assert.rejects(detect({ helper: '/bin/sh' }), /invalid_helper/)
})
test('launcher timeout ends probe without attempting installation/login', async t => {
  const f = await launcher(t, {}, 'setInterval(()=>{},1000);')
  await fs.writeFile(f.helper, `#!/bin/sh\nexec '${process.execPath}' -e 'setInterval(()=>{},1000)'\n`, { mode: 0o700 })
  assert.deepEqual(await detect({ helper: f.helper, timeoutMs: 50 }), { status: 'unavailable' })
})
test('CLI rejects unsupported/duplicate commands without dumping arguments or responses', async t => {
  const f = await fixture(t); const scripts = path.join(f.root, 'scripts/onboarding'); await fs.mkdir(scripts, { recursive: true })
  for (const filename of ['cli.mjs', 'core.mjs', 'product.json']) await fs.copyFile(path.join(directory, filename), path.join(scripts, filename))
  for (const args of [['login', '--secret', 'do-not-print'], ['configure', '--project', 'chosen', '--project', 'do-not-print'], ['restore', '--backup'], ['doctor', '--yes']]) {
    try { execFileSync(process.execPath, [path.join(scripts, 'cli.mjs'), ...args], { encoding: 'utf8', stdio: 'pipe' }); assert.fail('CLI accepted invalid arguments') } catch (error) { assert.equal(error.status, 1); assert.match(error.stderr, /invalid_arguments/); assert.equal(error.stderr.includes('do-not-print'), false) }
  }
})
