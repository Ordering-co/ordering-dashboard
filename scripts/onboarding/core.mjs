import { promises as fs, constants } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'

const STATE = '.ordering-setup'
const validProject = value => typeof value === 'string' && /^[a-z0-9_-]{1,120}$/.test(value)
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = value => createHash('sha256').update(value).digest('hex')
const fail = code => { throw new Error(code) }
const forbidden = new Set(['__proto__', 'prototype', 'constructor'])

export function validateManifest (manifest) {
  if (!plain(manifest) || manifest.schemaVersion !== 1 || !/^[a-z0-9-]+$/.test(manifest.product || '')) fail('invalid_manifest')
  const segments = typeof manifest.configFile === 'string' ? manifest.configFile.split('/') : []
  if (!segments.length || segments.some(part => !part || part === '.' || part === '..' || part.includes('\\')) || path.isAbsolute(manifest.configFile) || !manifest.configFile.endsWith('.json')) fail('invalid_config_path')
  if (!Array.isArray(manifest.projectPaths) || !manifest.projectPaths.length) fail('invalid_manifest')
  for (const entry of manifest.projectPaths) {
    if (!plain(entry) || !Array.isArray(entry.path) || !entry.path.length || entry.path.some(key => typeof key !== 'string' || !key || forbidden.has(key)) || typeof entry.required !== 'boolean') fail('invalid_project_path')
  }
  if (!manifest.projectPaths.some(entry => entry.required)) fail('invalid_manifest')
  if (!Array.isArray(manifest.projectPlaceholders) || manifest.projectPlaceholders.some(value => typeof value !== 'string')) fail('invalid_manifest')
  if (manifest.additionalSelection !== undefined) {
    const selection = manifest.additionalSelection
    if (!plain(selection) || selection.field !== 'franchiseSlug' || selection.flag !== 'franchise-slug' || selection.endpoint !== 'franchises' || selection.identity !== 'slug' || typeof selection.required !== 'boolean' || (selection.placeholders !== undefined && (!Array.isArray(selection.placeholders) || selection.placeholders.some(value => typeof value !== 'string')))) fail('invalid_manifest')
    if (selection.persist !== undefined && !['id', 'slug'].includes(selection.persist)) fail('invalid_manifest')
  }
  return manifest
}

function valueAt (object, keys) {
  let value = object
  for (const key of keys) {
    if (!plain(value) || !Object.hasOwn(value, key)) return undefined
    value = value[key]
  }
  return value
}

function setProject (config, entry, project) {
  let parent = config
  for (const key of entry.path.slice(0, -1)) {
    if (!Object.hasOwn(parent, key)) {
      if (!entry.required) return
      fail('invalid_configuration_structure')
    }
    if (!plain(parent[key])) fail('invalid_configuration_structure')
    parent = parent[key]
  }
  const last = entry.path.at(-1)
  if (entry.required || Object.hasOwn(parent, last)) parent[last] = project
}

function apiSettings (config, options) {
  if (!plain(config.api)) fail('missing_api_configuration')
  const api = {
    url: options.apiUrl ?? config.api.url,
    version: options.apiVersion ?? config.api.version,
    language: options.language ?? config.api.language
  }
  let url
  try { url = new URL(api.url) } catch { fail('invalid_api_url') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') fail('invalid_api_url')
  if (api.version !== 'v400') fail('invalid_api_version')
  if (typeof api.language !== 'string' || (api.language !== 'default' && !/^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(api.language))) fail('invalid_language')
  // Preserve the exact existing URL unless the developer explicitly overrides it.
  return api
}

export async function verifyPublicProject (project, api, request = fetch) {
  if (!validProject(project)) fail('invalid_project')
  api = apiSettings({ api }, {})
  const base = api.url.replace(/\/$/, '')
  let response
  let body
  try {
    response = await request(`${base}/${api.version}/${api.language}/${project}/current`, {
      method: 'GET', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) fail('public_project_unavailable')
    body = await response.json()
  } catch { fail('public_project_unavailable') }
  if (body?.error !== false || body.result?.code !== project) fail('public_project_mismatch')
  return { project: true, authenticated: false }
}

async function verifySelection (project, api, selection, value, request) {
  const byId = selection.persist === 'id' && typeof value === 'number'
  if (byId ? !Number.isSafeInteger(value) || value <= 0 : typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) fail('invalid_franchise_selection')
  const attribute = byId ? 'id' : selection.identity
  let response
  let body
  try {
    // Filter server-side so a selected slug outside page one can still be found.
    // Request two rows to detect ambiguity; never choose an arbitrary first row.
    const query = new URLSearchParams({
      where: JSON.stringify({ conditions: [{ attribute, value }], conector: 'AND' }),
      params: 'id,slug,enabled', page: '1', page_size: '2'
    })
    response = await request(`${api.url.replace(/\/$/, '')}/${api.version}/${api.language}/${project}/${selection.endpoint}?${query}`, {
      method: 'GET', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' }
    })
    if (!response.ok) fail('franchise_unavailable')
    body = await response.json()
  } catch { fail('franchise_unavailable') }
  if (body?.error !== false || !Array.isArray(body.result)) fail('franchise_unavailable')
  const selected = body.result[0]
  if (body.result.length !== 1 || selected?.[attribute] !== value || !Number.isSafeInteger(selected.id) || selected.id <= 0 || typeof selected.slug !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(selected.slug) || ![true, 1, '1'].includes(selected.enabled) || (body.pagination?.total != null && Number(body.pagination.total) !== 1)) fail('franchise_selection_not_enabled')
  return { id: selected.id, slug: selected.slug }
}

// Every path component used for mutation is checked; symlinks are never followed.
// Atomic replacement changes only this checkout's config; it cannot configure clients.
async function safePath (root, relative, missingLeaf = false) {
  const fullRoot = path.resolve(root)
  const rootInfo = await fs.lstat(fullRoot)
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) fail('unsafe_path')
  const target = path.resolve(fullRoot, relative)
  if (!target.startsWith(fullRoot + path.sep)) fail('unsafe_path')
  const parts = path.relative(fullRoot, target).split(path.sep)
  let current = fullRoot
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i])
    let info
    try { info = await fs.lstat(current) } catch (error) {
      if (error.code === 'ENOENT' && missingLeaf && i === parts.length - 1) return target
      throw error
    }
    if (info.isSymbolicLink() || (i < parts.length - 1 ? !info.isDirectory() : !info.isFile())) fail('unsafe_path')
  }
  return target
}

async function stateDirectory (root) {
  const state = path.join(path.resolve(root), STATE)
  const rootInfo = await fs.lstat(path.resolve(root))
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) fail('unsafe_path')
  try { await fs.mkdir(state, { mode: 0o700 }) } catch (error) { if (error.code !== 'EEXIST') throw error }
  const info = await fs.lstat(state)
  if (info.isSymbolicLink() || !info.isDirectory()) fail('unsafe_path')
  await fs.chmod(state, 0o700)
  return state
}

async function readSafeFile (filename, limit = 4 * 1024 * 1024) {
  const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.size > limit) fail('invalid_backup')
    return await handle.readFile()
  } finally { await handle.close() }
}

async function readConfig (root, manifest) {
  validateManifest(manifest)
  const target = await safePath(root, manifest.configFile)
  const handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.size > 4 * 1024 * 1024) fail('invalid_configuration')
    const bytes = await handle.readFile()
    let config
    try { config = JSON.parse(bytes.toString('utf8')) } catch { fail('invalid_configuration') }
    if (!plain(config)) fail('invalid_configuration')
    return { target, bytes, config, mode: info.mode & 0o777 }
  } finally { await handle.close() }
}

async function backup (root, manifest, original) {
  await stateDirectory(root)
  const name = `${hash(original.bytes)}-${randomBytes(8).toString('hex')}.json`
  const filename = await safePath(root, `${STATE}/${name}`, true)
  const metaPath = await safePath(root, `${STATE}/${name}.meta.json`, true)
  await fs.writeFile(filename, original.bytes, { mode: 0o600, flag: 'wx' })
  await fs.writeFile(metaPath, JSON.stringify({ schemaVersion: 1, product: manifest.product, configFile: manifest.configFile, sha256: hash(original.bytes), mode: original.mode }) + '\n', { mode: 0o600, flag: 'wx' })
  return name
}

async function replaceConfig (root, manifest, original, bytes, mode) {
  const temporaryRelative = `${manifest.configFile}.${randomBytes(8).toString('hex')}.tmp`
  const temporary = await safePath(root, temporaryRelative, true)
  let created = false
  try {
    const handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    created = true
    try { await handle.writeFile(bytes); await handle.chmod(mode); await handle.sync() } finally { await handle.close() }
    const current = await readConfig(root, manifest)
    if (!current.bytes.equals(original.bytes)) fail('configuration_changed_during_setup')
    await safePath(root, manifest.configFile)
    await fs.rename(temporary, original.target)
    created = false
  } finally { if (created) await fs.unlink(temporary).catch(() => {}) }
}

export async function configure (root, manifest, options, request = fetch) {
  const original = await readConfig(root, manifest)
  const project = options.project
  if (!validProject(project)) fail('invalid_project')
  const oldProjects = manifest.projectPaths.map(entry => valueAt(original.config, entry.path)).filter(value => value !== undefined && value !== null && !manifest.projectPlaceholders.includes(value))
  if (oldProjects.some(value => value !== project) && !options.confirmProjectChange) fail('project_change_confirmation_required')
  const selection = manifest.additionalSelection
  if (!selection && options.franchiseSlug !== undefined) fail('franchise_selection_not_supported')
  const previous = selection ? original.config[selection.field] : undefined
  const canReuseId = selection?.persist === 'id' && Number.isSafeInteger(previous) && previous > 0 && oldProjects.length > 0 && oldProjects.every(value => value === project)
  const selectionInput = options.franchiseSlug ?? (canReuseId ? previous : undefined)
  if (selection?.required && selectionInput === undefined) fail('franchise_selection_required')
  if (selection && selectionInput !== undefined && selection.persist !== 'id') {
    if (previous && previous !== options.franchiseSlug && !(selection.placeholders || ['']).includes(previous) && !options.confirmProjectChange) fail('selection_change_confirmation_required')
  }
  const api = apiSettings(original.config, options)
  const verification = await verifyPublicProject(project, api, request)
  let resolvedSelection
  if (selection && selectionInput !== undefined) {
    resolvedSelection = await verifySelection(project, api, selection, selectionInput, request)
    // A source slug matching the selected identity can migrate to its numeric ID.
    // Any actual switch of identity still requires the explicit tenant confirmation.
    const sameIdentity = previous === resolvedSelection.id || previous === resolvedSelection.slug
    if (selection.persist === 'id' && previous && !sameIdentity && !(selection.placeholders || ['']).includes(previous) && !options.confirmProjectChange) fail('selection_change_confirmation_required')
    verification.franchise = true
  }
  const next = structuredClone(original.config)
  for (const entry of manifest.projectPaths) setProject(next, entry, project)
  if (resolvedSelection) next[selection.field] = selection.persist === 'id' ? resolvedSelection.id : resolvedSelection.slug
  if (options.apiUrl !== undefined) next.api.url = api.url
  if (options.apiVersion !== undefined) next.api.version = api.version
  if (options.language !== undefined) next.api.language = api.language
  const summary = resolvedSelection ? { selection: resolvedSelection } : {}
  if (JSON.stringify(next) === JSON.stringify(original.config)) return { changed: false, project, verification, ...summary }
  const name = await backup(root, manifest, original)
  await replaceConfig(root, manifest, original, Buffer.from(JSON.stringify(next, null, 2) + '\n'), original.mode)
  return { changed: true, project, backup: name, verification, ...summary }
}

export async function doctor (root, manifest, request = fetch) {
  const { config } = await readConfig(root, manifest)
  const values = manifest.projectPaths.map(entry => valueAt(config, entry.path)).filter(value => value !== undefined && value !== null)
  const project = values[0]
  if (!validProject(project) || values.some(value => value !== project)) fail('configured_project_mismatch')
  const api = apiSettings(config, {})
  const verification = await verifyPublicProject(project, api, request)
  let resolvedSelection
  if (manifest.additionalSelection) {
    const selection = manifest.additionalSelection
    if (selection.required || config[selection.field]) {
      if (selection.persist === 'id' && (!Number.isSafeInteger(config[selection.field]) || config[selection.field] <= 0)) fail('invalid_franchise_selection')
      resolvedSelection = await verifySelection(project, api, selection, config[selection.field], request)
      verification.franchise = true
    }
  }
  return { project, verification, ...(resolvedSelection ? { selection: resolvedSelection } : {}) }
}

export async function restore (root, manifest, name) {
  if (typeof name !== 'string' || !/^[a-f0-9]{64}-[a-f0-9]{16}\.json$/.test(name)) fail('invalid_backup')
  const original = await readConfig(root, manifest)
  const filename = await safePath(root, `${STATE}/${name}`)
  const metaPath = await safePath(root, `${STATE}/${name}.meta.json`)
  const bytes = await readSafeFile(filename)
  let meta
  try { meta = JSON.parse((await readSafeFile(metaPath, 16384)).toString('utf8')); if (!plain(JSON.parse(bytes.toString('utf8')))) fail('invalid_backup') } catch { fail('invalid_backup') }
  if (meta?.schemaVersion !== 1 || meta.product !== manifest.product || meta.configFile !== manifest.configFile || meta.sha256 !== hash(bytes) || !name.startsWith(meta.sha256 + '-') || !Number.isInteger(meta.mode) || meta.mode < 0 || meta.mode > 0o777) fail('invalid_backup')
  if (bytes.equals(original.bytes)) return { restored: false, changed: false }
  const saved = await backup(root, manifest, original)
  await replaceConfig(root, manifest, original, bytes, meta.mode)
  return { restored: true, changed: true, backup: saved }
}

export async function detect ({ helper, home = os.homedir(), timeoutMs = 15000 } = {}) {
  const launcher = path.resolve(helper || path.join(home, 'ordering-dev-quickstart/ordering'))
  // An explicit helper is a developer-selected checkout, never a command extracted
  // from arbitrary global client config. Require the prepared Quickstart marker.
  if (path.basename(launcher) !== 'ordering') fail('invalid_helper')
  try {
    const info = await fs.stat(launcher)
    if (!info.isFile()) return { status: 'none' }
    await fs.access(launcher, constants.X_OK)
    await fs.access(path.join(path.dirname(launcher), '.clients/runtime-ready'))
  } catch { return { status: 'none' } }
  return new Promise(resolve => {
    const child = spawn(launcher, ['mcp'], { stdio: ['pipe', 'pipe', 'ignore'] })
    let buffer = ''; let finished = false; let stage = 1
    const complete = result => {
      if (finished) return
      finished = true; clearTimeout(timer); child.stdin.end(); child.kill('SIGTERM'); resolve(result)
    }
    const timer = setTimeout(() => complete({ status: 'unavailable' }), timeoutMs)
    const send = message => child.stdin.write(JSON.stringify(message) + '\n')
    child.on('error', () => complete({ status: 'unavailable' }))
    child.on('exit', () => complete({ status: 'unavailable' }))
    child.stdin.on('error', () => complete({ status: 'unavailable' }))
    child.stdout.on('data', chunk => {
      buffer += chunk.toString()
      if (buffer.length > 65536) return complete({ status: 'unavailable' })
      let end
      while (!finished && (end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1)
        let message
        try { message = JSON.parse(line) } catch { continue }
        if (stage === 1 && message.id === 1) {
          if (message.error || !message.result) return complete({ status: 'unavailable' })
          stage = 2
          send({ jsonrpc: '2.0', method: 'notifications/initialized' })
          send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'whoami', arguments: {} } })
        } else if (stage === 2 && message.id === 2) {
          const identity = message.result?.structuredContent
          if (message.error || message.result?.isError || !validProject(identity?.project) || !identity.user?.id || !['administrator', 'business_manager', 'owner'].includes(identity.user.role) || !['read', 'write'].includes(identity.token?.scope)) return complete({ status: 'unavailable' })
          complete({ status: 'connected', project: identity.project, source: 'existing-launcher', authenticated: true })
        }
      }
    })
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'ordering-public-project-detection', version: '1.0.0' } } })
  })
}
