import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CANONICAL_ORIGIN,
  checkFreshness,
  checkRelease,
  generateAdapterArtifacts,
  resolveDtcgTokens,
  updateRelease
} from './release.mjs'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = resolve(TEST_DIR, '../..')
const LOCK_PATH = 'src/brand/ordering-brand.lock.json'
const temporaryRoots = []

const sha256 = value => createHash('sha256').update(value).digest('hex')

const readLock = async rootDir =>
  JSON.parse(await readFile(join(rootDir, LOCK_PATH), 'utf8'))

const fixtureResponses = async () => {
  const lock = await readLock(REPOSITORY_ROOT)
  const responses = new Map()

  for (const [path, record] of Object.entries(lock.sources)) {
    responses.set(record.url, await readFile(join(REPOSITORY_ROOT, path)))
  }
  for (const [path, record] of Object.entries(lock.managedOutputs)) {
    if (record.kind === 'asset') {
      responses.set(`${CANONICAL_ORIGIN}${record.source}`, await readFile(join(REPOSITORY_ROOT, path)))
    }
  }

  return responses
}

const fetchFrom = responses => async url => {
  const normalized = decodeURIComponent(String(url))
  const bytes = responses.get(normalized)
  return bytes
    ? new Response(bytes, { status: 200 })
    : new Response('not found', { status: 404 })
}

const listFiles = async rootDir => {
  const files = []
  const visit = async (directory, prefix = '') => {
    let entries = []
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) await visit(absolutePath, relativePath)
      if (entry.isFile()) files.push(relativePath)
    }
  }
  await visit(rootDir)
  return files.sort()
}

const snapshotFiles = async rootDir => {
  const snapshot = {}
  for (const path of await listFiles(rootDir)) {
    snapshot[path] = sha256(await readFile(join(rootDir, path)))
  }
  return snapshot
}

const temporaryRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), 'ordering-brand-release-'))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root =>
    rm(root, { recursive: true, force: true })))
})

test('tracked release passes the offline checksum check', async () => {
  const result = await checkRelease({ rootDir: REPOSITORY_ROOT })
  assert.deepEqual(
    { ok: result.ok, networkAccess: result.networkAccess, release: result.release },
    { ok: true, networkAccess: false, release: '1.3.0' }
  )
})

test('generates resolved JS values and scoped Light/Dark CSS', async () => {
  const tokenSource = JSON.parse(await readFile(
    join(REPOSITORY_ROOT, 'src/brand/sources/1.3.0/ordering.tokens.json'),
    'utf8'
  ))
  const generated = generateAdapterArtifacts({ release: '1.3.0', tokenSource })

  assert.equal(generated.tokens.theme.light.semantic.background, '#FFFFFF')
  assert.equal(generated.tokens.theme.dark.semantic.background, '#0B0C0D')
  assert.equal(generated.variables.light['--od-action'], '#266DF0')
  assert.equal(generated.variables.dark['--od-action'], '#266DF0')
  assert.match(generated.css, /\[data-ordering-brand\] \{/)
  assert.match(generated.css, /\[data-ordering-brand\]\[data-od-theme='dark'\]/)
  assert.doesNotMatch(generated.css, /:root/)
})

test('rejects unknown and cyclic DTCG aliases', () => {
  assert.throws(() => resolveDtcgTokens({
    color: { action: { $value: '{color.missing}', $type: 'color' } }
  }), /Unknown DTCG alias: color\.missing/)

  assert.throws(() => resolveDtcgTokens({
    a: { $value: '{b}', $type: 'color' },
    b: { $value: '{a}', $type: 'color' }
  }), /Cyclic DTCG alias: a -> b -> a/)
})

test('updates deliberately and a second update is byte-idempotent', async () => {
  const rootDir = await temporaryRoot()
  const responses = await fixtureResponses()
  const fetchImpl = fetchFrom(responses)

  const first = await updateRelease({
    fetchImpl,
    now: new Date('2026-09-13T12:00:00Z'),
    rootDir
  })
  const firstSnapshot = await snapshotFiles(rootDir)
  const second = await updateRelease({
    fetchImpl,
    now: new Date('2026-09-14T12:00:00Z'),
    rootDir
  })

  assert.equal(first.updated, true)
  assert.equal(second.updated, false)
  assert.deepEqual(second.changedFiles, [])
  assert.deepEqual(await snapshotFiles(rootDir), firstSnapshot)
  assert.equal((await readLock(rootDir)).retrievedAt, '2026-09-13')
})

test('dry-run reports outputs without writing them', async () => {
  const rootDir = await temporaryRoot()
  const result = await updateRelease({
    dryRun: true,
    fetchImpl: fetchFrom(await fixtureResponses()),
    now: new Date('2026-09-13T12:00:00Z'),
    rootDir
  })

  assert.equal(result.dryRun, true)
  assert.equal(result.updated, true)
  assert.deepEqual(await listFiles(rootDir), [])
})

test('rejects an asset checksum mismatch before any file is written', async () => {
  const rootDir = await temporaryRoot()
  const responses = await fixtureResponses()
  responses.set(`${CANONICAL_ORIGIN}/assets/icons/favicon.ico`, Buffer.from('tampered'))

  await assert.rejects(updateRelease({
    fetchImpl: fetchFrom(responses),
    now: new Date('2026-09-13T12:00:00Z'),
    rootDir
  }), error => error.code === 'CHECKSUM_MISMATCH')
  assert.deepEqual(await listFiles(rootDir), [])
})

test('rolls every file back when a transactional write fails', async () => {
  const rootDir = await temporaryRoot()
  const fetchImpl = fetchFrom(await fixtureResponses())
  await updateRelease({
    fetchImpl,
    now: new Date('2026-09-13T12:00:00Z'),
    rootDir
  })
  const before = await snapshotFiles(rootDir)
  await writeFile(join(rootDir, 'src/brand/ordering.tokens.generated.css'), 'changed locally')

  await assert.rejects(updateRelease({
    faultAfterWrites: 2,
    fetchImpl,
    now: new Date('2026-09-13T12:00:00Z'),
    rootDir
  }), error => error.code === 'INJECTED_WRITE_FAILURE')

  const after = await snapshotFiles(rootDir)
  assert.deepEqual(after, {
    ...before,
    'src/brand/ordering.tokens.generated.css': sha256('changed locally')
  })
})

test('offline check detects a modified governed file', async () => {
  const rootDir = await temporaryRoot()
  await updateRelease({
    fetchImpl: fetchFrom(await fixtureResponses()),
    now: new Date('2026-09-13T12:00:00Z'),
    rootDir
  })
  const generatedPath = join(rootDir, 'src/brand/ordering.tokens.generated.js')
  assert.equal((await stat(generatedPath)).isFile(), true)
  await writeFile(generatedPath, 'tampered')

  await assert.rejects(checkRelease({ rootDir }), error =>
    error.code === 'OFFLINE_CHECK_FAILED' &&
    error.details.some(detail => detail.includes('ordering.tokens.generated.js')))
})

test('offline regeneration detects a generated file and lock changed together', async () => {
  const rootDir = await temporaryRoot()
  await updateRelease({
    fetchImpl: fetchFrom(await fixtureResponses()),
    now: new Date('2026-09-13T12:00:00Z'),
    rootDir
  })
  const generatedPath = 'src/brand/ordering.tokens.generated.js'
  const tampered = Buffer.from('export const tokens = {}\n')
  await writeFile(join(rootDir, generatedPath), tampered)
  const lock = await readLock(rootDir)
  lock.managedOutputs[generatedPath].sha256 = sha256(tampered)
  lock.managedOutputs[generatedPath].bytes = tampered.length
  await writeFile(join(rootDir, LOCK_PATH), `${JSON.stringify(lock, null, 2)}\n`)

  await assert.rejects(checkRelease({ rootDir }), error =>
    error.code === 'OFFLINE_CHECK_FAILED' &&
    error.details.some(detail => detail.includes('does not reproduce')))
})

test('offline check rejects a same-size lock with a substituted path', async () => {
  const rootDir = await temporaryRoot()
  await updateRelease({
    fetchImpl: fetchFrom(await fixtureResponses()),
    now: new Date('2026-09-13T12:00:00Z'),
    rootDir
  })
  const lock = await readLock(rootDir)
  const [assetPath] = Object.keys(lock.managedOutputs)
  lock.managedOutputs['public/brand/ordering/1.3.0/assets/rogue.bin'] =
    lock.managedOutputs[assetPath]
  delete lock.managedOutputs[assetPath]
  await writeFile(join(rootDir, LOCK_PATH), `${JSON.stringify(lock, null, 2)}\n`)

  await assert.rejects(checkRelease({ rootDir }), error =>
    error.code === 'OFFLINE_CHECK_FAILED' &&
    error.details.includes('managed output paths differ from the exact release allowlist'))
})

test('offline check rejects a managed file symlinked outside the repository', async () => {
  const rootDir = await temporaryRoot()
  const outsideRoot = await temporaryRoot()
  await updateRelease({
    fetchImpl: fetchFrom(await fixtureResponses()),
    now: new Date('2026-09-13T12:00:00Z'),
    rootDir
  })
  const managedPath = join(rootDir, 'src/brand/ordering.tokens.generated.js')
  const outsidePath = join(outsideRoot, 'ordering.tokens.generated.js')
  await writeFile(outsidePath, await readFile(managedPath))
  await rm(managedPath)
  await symlink(outsidePath, managedPath)

  await assert.rejects(checkRelease({ rootDir }), error =>
    error.code === 'OFFLINE_CHECK_FAILED' &&
    error.details.some(detail => detail.includes('symbolic link is not allowed')))
})

test('freshness is read-only and reports a newer release', async () => {
  const rootDir = await temporaryRoot()
  const responses = await fixtureResponses()
  await updateRelease({
    fetchImpl: fetchFrom(responses),
    now: new Date('2026-09-13T12:00:00Z'),
    rootDir
  })
  const before = await snapshotFiles(rootDir)
  const manifestUrl = `${CANONICAL_ORIGIN}/machine/skill-manifest.json`
  const remoteManifest = JSON.parse(responses.get(manifestUrl).toString('utf8'))
  remoteManifest.skillVersion = '1.4.0'
  remoteManifest.guidelinesVersion = '1.4.0'
  responses.set(manifestUrl, Buffer.from(JSON.stringify(remoteManifest)))

  const result = await checkFreshness({
    fetchImpl: fetchFrom(responses),
    rootDir
  })
  assert.deepEqual({
    currentRelease: result.currentRelease,
    newerReleaseAvailable: result.newerReleaseAvailable,
    remoteRelease: result.remoteRelease,
    wroteFiles: result.wroteFiles
  }, {
    currentRelease: '1.3.0',
    newerReleaseAvailable: true,
    remoteRelease: '1.4.0',
    wroteFiles: false
  })
  assert.deepEqual(await snapshotFiles(rootDir), before)
})
