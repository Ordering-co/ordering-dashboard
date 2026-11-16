import { createHash, randomUUID } from 'node:crypto'
import {
  access,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CANONICAL_ORIGIN = 'https://brand.ordering.co'

export const SOURCE_ALLOWLIST = Object.freeze([
  '/machine/ordering.tokens.json',
  '/machine/design-system.json',
  '/machine/asset-manifest.json',
  '/machine/skill-manifest.json'
])

export const ASSET_ALLOWLIST = Object.freeze([
  '/assets/fonts/inter/InterVariable.woff2',
  '/assets/fonts/inter/OFL.txt',
  '/assets/fonts/jetbrains-mono/JetBrainsMono[wght].woff2',
  '/assets/fonts/jetbrains-mono/OFL.txt',
  '/assets/logos/ordering-lockup-color.svg',
  '/assets/logos/ordering-lockup-color-reversed.svg',
  '/assets/logos/ordering-lockup-color-on-white.svg',
  '/assets/logos/ordering-lockup-color-on-dark.svg',
  '/assets/logos/png/ordering-lockup-color-512.png',
  '/assets/logos/ordering-symbol-contained-light.svg',
  '/assets/logos/ordering-symbol-contained-dark.svg',
  '/assets/icons/ordering-app-icon-192.png',
  '/assets/icons/ordering-app-icon-512.png',
  '/assets/icons/favicon.ico',
  '/assets/icons/ordering-favicon-32.png',
  '/assets/icons/ordering-apple-touch-icon-180.png'
])

const SOURCE_FILENAMES = Object.freeze({
  '/machine/ordering.tokens.json': 'ordering.tokens.json',
  '/machine/design-system.json': 'design-system.json',
  '/machine/asset-manifest.json': 'asset-manifest.json',
  '/machine/skill-manifest.json': 'skill-manifest.json'
})

const GENERATED_JS_PATH = 'src/brand/ordering.tokens.generated.js'
const GENERATED_CSS_PATH = 'src/brand/ordering.tokens.generated.css'
const LOCK_PATH = 'src/brand/ordering-brand.lock.json'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT_DIR = resolve(MODULE_DIR, '../..')
const EXACT_ALIAS = /^\{([^{}]+)\}$/
const TOKEN_FIELDS = new Set(['$value', '$type', '$description', '$extensions'])

export class ReleaseError extends Error {
  constructor (message, { code = 'BRAND_RELEASE_ERROR', exitCode = 1 } = {}) {
    super(message)
    this.name = 'ReleaseError'
    this.code = code
    this.exitCode = exitCode
  }
}

const sha256 = value => createHash('sha256').update(value).digest('hex')

const stableJson = value => `${JSON.stringify(value, null, 2)}\n`

const toBuffer = value => Buffer.isBuffer(value) ? value : Buffer.from(value)

const assertObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReleaseError(`${label} must be a JSON object`, {
      code: 'INVALID_MANIFEST'
    })
  }
}

const parseJson = (bytes, label) => {
  try {
    const value = JSON.parse(bytes.toString('utf8'))
    assertObject(value, label)
    return value
  } catch (error) {
    if (error instanceof ReleaseError) throw error
    throw new ReleaseError(`${label} is not valid JSON: ${error.message}`, {
      code: 'INVALID_MANIFEST'
    })
  }
}

const assertSafeRelativePath = path => {
  if (!path || isAbsolute(path) || path.split(/[\\/]/).includes('..')) {
    throw new ReleaseError(`Unsafe managed path: ${path}`, {
      code: 'UNSAFE_PATH'
    })
  }
}

const targetPath = (rootDir, path) => {
  assertSafeRelativePath(path)
  const root = resolve(rootDir)
  const target = resolve(root, path)
  const rel = relative(root, target)
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..') {
    throw new ReleaseError(`Managed path escapes repository root: ${path}`, {
      code: 'UNSAFE_PATH'
    })
  }
  return target
}

const ensureNoSymlinkParents = async (rootDir, path) => {
  const parts = path.split('/')
  let current = resolve(rootDir)
  for (const part of parts.slice(0, -1)) {
    current = join(current, part)
    try {
      const entry = await lstat(current)
      if (entry.isSymbolicLink()) {
        throw new ReleaseError(`Managed path uses symlinked directory: ${path}`, {
          code: 'UNSAFE_PATH'
        })
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      break
    }
  }
}

const fetchBytes = async (url, fetchImpl) => {
  let response
  try {
    const requestUrl = url.replaceAll('[', '%5B').replaceAll(']', '%5D')
    response = await fetchImpl(requestUrl, {
      headers: { accept: '*/*' },
      redirect: 'error'
    })
  } catch (error) {
    throw new ReleaseError(`Unable to fetch ${url}: ${error.message}`, {
      code: 'NETWORK_ERROR',
      exitCode: 2
    })
  }
  if (!response?.ok) {
    throw new ReleaseError(`Unable to fetch ${url}: HTTP ${response?.status ?? 'unknown'}`, {
      code: 'NETWORK_ERROR',
      exitCode: 2
    })
  }
  return Buffer.from(await response.arrayBuffer())
}

const sourceOutputPath = (release, sourcePath) =>
  `src/brand/sources/${release}/${SOURCE_FILENAMES[sourcePath]}`

const assetOutputPath = (release, assetPath) =>
  `public/brand/ordering/${release}${assetPath}`

const getSkillFile = (skillManifest, filename) => {
  const suffix = `/machine/${filename}`
  return skillManifest.files?.find(file => file.path?.endsWith(suffix))
}

const validateReleaseManifests = ({ skillManifest, assetManifest, designSystem, tokenSource }) => {
  const release = skillManifest.skillVersion
  if (!/^\d+\.\d+\.\d+$/.test(release) || skillManifest.guidelinesVersion !== release) {
    throw new ReleaseError('Skill and guidelines versions must be present and equal', {
      code: 'VERSION_MISMATCH'
    })
  }
  if (skillManifest.canonicalOrigin !== CANONICAL_ORIGIN ||
      assetManifest.canonicalOrigin !== CANONICAL_ORIGIN) {
    throw new ReleaseError('Canonical origin does not match the approved Ordering.co origin', {
      code: 'ORIGIN_MISMATCH'
    })
  }
  if (assetManifest.release !== release || designSystem.version !== release) {
    throw new ReleaseError('Machine manifests do not describe one release', {
      code: 'VERSION_MISMATCH'
    })
  }
  if (designSystem.skill?.version !== release ||
      designSystem.skill?.guidelinesVersion !== release) {
    throw new ReleaseError('Design-system skill metadata does not match the release', {
      code: 'VERSION_MISMATCH'
    })
  }
  if (!tokenSource.version || tokenSource.$extensions?.ordering?.status !== 'released') {
    throw new ReleaseError('DTCG token source is not a released contract', {
      code: 'INVALID_TOKEN_SOURCE'
    })
  }
  return release
}

const collectTokenDefinitions = source => {
  const definitions = new Map()

  const visit = (node, path = [], inherited = {}) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    const extensions = node.$extensions?.ordering ?? {}
    const context = {
      type: node.$type ?? inherited.type,
      cssScope: extensions.cssScope ?? inherited.cssScope
    }

    if (Object.hasOwn(node, '$value')) {
      const name = path.join('.')
      if (!name) {
        throw new ReleaseError('A DTCG token cannot exist at the document root', {
          code: 'INVALID_TOKEN_SOURCE'
        })
      }
      definitions.set(name, {
        path: name,
        rawValue: node.$value,
        type: context.type,
        cssScope: context.cssScope,
        cssVariable: extensions.cssVariable
      })
      return
    }

    for (const [key, value] of Object.entries(node)) {
      if (!TOKEN_FIELDS.has(key)) visit(value, [...path, key], context)
    }
  }

  visit(source)
  return definitions
}

const setNested = (target, path, value) => {
  const parts = path.split('.')
  let node = target
  for (const part of parts.slice(0, -1)) {
    node[part] ??= {}
    node = node[part]
  }
  node[parts.at(-1)] = value
}

export const resolveDtcgTokens = source => {
  assertObject(source, 'DTCG token source')
  const definitions = collectTokenDefinitions(source)
  const resolved = new Map()
  const resolving = []

  const resolveToken = name => {
    if (resolved.has(name)) return resolved.get(name)
    const definition = definitions.get(name)
    if (!definition) {
      throw new ReleaseError(`Unknown DTCG alias: ${name}`, {
        code: 'UNKNOWN_TOKEN_ALIAS'
      })
    }
    const cycleIndex = resolving.indexOf(name)
    if (cycleIndex >= 0) {
      const cycle = [...resolving.slice(cycleIndex), name].join(' -> ')
      throw new ReleaseError(`Cyclic DTCG alias: ${cycle}`, {
        code: 'CYCLIC_TOKEN_ALIAS'
      })
    }

    resolving.push(name)
    const alias = typeof definition.rawValue === 'string'
      ? definition.rawValue.match(EXACT_ALIAS)
      : null
    const value = alias ? resolveToken(alias[1]) : definition.rawValue
    resolving.pop()
    resolved.set(name, value)
    return value
  }

  const tokens = {}
  const tokenMeta = {}
  for (const [name, definition] of definitions) {
    const value = resolveToken(name)
    setNested(tokens, name, value)
    tokenMeta[name] = {
      type: definition.type ?? null,
      cssScope: definition.cssScope ?? null,
      cssVariable: definition.cssVariable ?? null,
      value
    }
  }

  return { tokens, tokenMeta }
}

const cssValue = (value, type, tokenPath) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value) && type === 'cubicBezier' && value.length === 4) {
    return `cubic-bezier(${value.join(', ')})`
  }
  throw new ReleaseError(`Token ${tokenPath} cannot be represented as a CSS variable`, {
    code: 'UNSUPPORTED_CSS_TOKEN'
  })
}

const buildVariableMaps = tokenMeta => {
  const variables = {
    root: {},
    light: {},
    dark: {},
    product: {},
    reducedMotion: {}
  }
  const scopeMap = {
    root: 'root',
    'theme-light': 'light',
    'theme-dark': 'dark',
    'expression-product': 'product',
    'reduced-motion': 'reducedMotion'
  }

  for (const [path, token] of Object.entries(tokenMeta)) {
    if (!token.cssVariable) continue
    const scope = scopeMap[token.cssScope]
    if (!scope) {
      throw new ReleaseError(`Token ${path} has unknown CSS scope: ${token.cssScope}`, {
        code: 'UNKNOWN_CSS_SCOPE'
      })
    }
    if (Object.hasOwn(variables[scope], token.cssVariable)) {
      throw new ReleaseError(`Duplicate CSS variable in ${scope}: ${token.cssVariable}`, {
        code: 'DUPLICATE_CSS_VARIABLE'
      })
    }
    variables[scope][token.cssVariable] = cssValue(token.value, token.type, path)
  }
  return variables
}

const cssDeclarations = values => Object.entries(values)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, value]) => `  ${name}: ${value};`)
  .join('\n')

export const generateAdapterArtifacts = ({ tokenSource, release }) => {
  const { tokens, tokenMeta } = resolveDtcgTokens(tokenSource)
  const variables = buildVariableMaps(tokenMeta)
  const metadata = {
    brand: 'Ordering.co',
    release,
    tokensVersion: tokenSource.version,
    generatedFrom: 'src/brand/sources/' + release + '/ordering.tokens.json'
  }

  const js = [
    '// Generated by scripts/brand-system/release.mjs. Do not edit.',
    '/* eslint-disable quote-props, quotes */',
    `export const metadata = ${JSON.stringify(metadata, null, 2)}`,
    '',
    `export const tokens = ${JSON.stringify(tokens, null, 2)}`,
    '',
    `export const variables = ${JSON.stringify(variables, null, 2)}`,
    '',
    'export default tokens',
    ''
  ].join('\n')

  const fontBase = `/brand/ordering/${release}/assets/fonts`
  const css = [
    '/* Generated by scripts/brand-system/release.mjs. Do not edit. */',
    '@font-face {',
    "  font-family: 'Ordering Inter Local';",
    `  src: url('${fontBase}/inter/InterVariable.woff2') format('woff2');`,
    '  font-style: normal;',
    '  font-weight: 100 900;',
    '  font-display: swap;',
    '}',
    '',
    '@font-face {',
    "  font-family: 'Ordering JetBrains Mono Local';",
    `  src: url('${fontBase}/jetbrains-mono/JetBrainsMono%5Bwght%5D.woff2') format('woff2');`,
    '  font-style: normal;',
    '  font-weight: 100 800;',
    '  font-display: swap;',
    '}',
    '',
    '[data-ordering-brand] {',
    cssDeclarations({ ...variables.root, ...variables.product, ...variables.light }),
    '}',
    '',
    "[data-ordering-brand][data-od-theme='light'] {",
    cssDeclarations(variables.light),
    '}',
    '',
    "[data-ordering-brand][data-od-theme='dark'] {",
    cssDeclarations(variables.dark),
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    '  [data-ordering-brand] {',
    cssDeclarations(variables.reducedMotion).split('\n').map(line => `  ${line}`).join('\n'),
    '  }',
    '}',
    ''
  ].join('\n')

  return { css, js, metadata, tokenMeta, tokens, variables }
}

const readExistingLock = async rootDir => {
  try {
    await ensureNoSymlinkParents(rootDir, LOCK_PATH)
    const target = targetPath(rootDir, LOCK_PATH)
    const entry = await lstat(target)
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new ReleaseError(`Release lock must be a regular file: ${LOCK_PATH}`, { code: 'UNSAFE_PATH' })
    }
    return parseJson(await readFile(target), LOCK_PATH)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

const sameRemoteSources = (lock, sourceRecords) => {
  if (!lock?.sources) return false
  return Object.entries(sourceRecords).every(([path, record]) =>
    lock.sources[path]?.sha256 === record.sha256)
}

const isoDate = now => {
  const value = typeof now === 'function' ? now() : now
  const date = value instanceof Date ? value : new Date(value ?? Date.now())
  if (Number.isNaN(date.valueOf())) {
    throw new ReleaseError('now must produce a valid date', { code: 'INVALID_DATE' })
  }
  return date.toISOString().slice(0, 10)
}

const verifyExpectedBytes = (bytes, entry, label) => {
  const actualSha256 = sha256(bytes)
  if (entry.sha256 !== actualSha256) {
    throw new ReleaseError(`${label} checksum mismatch: expected ${entry.sha256}, received ${actualSha256}`, {
      code: 'CHECKSUM_MISMATCH'
    })
  }
  if (Number.isInteger(entry.bytes) && entry.bytes !== bytes.length) {
    throw new ReleaseError(`${label} byte count mismatch: expected ${entry.bytes}, received ${bytes.length}`, {
      code: 'BYTE_COUNT_MISMATCH'
    })
  }
  return actualSha256
}

const filesDiffer = async (rootDir, outputs) => {
  const changed = []
  for (const [path, bytes] of outputs) {
    try {
      const current = await readFile(targetPath(rootDir, path))
      if (!current.equals(toBuffer(bytes))) changed.push(path)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      changed.push(path)
    }
  }
  return changed
}

const transactionalWrite = async (rootDir, outputs, { faultAfterWrites } = {}) => {
  const root = resolve(rootDir)
  const transactionRoot = join(root, `.brand-release-${randomUUID()}`)
  const stagedRoot = join(transactionRoot, 'staged')
  const backupRoot = join(transactionRoot, 'backup')
  const applied = []

  try {
    await mkdir(stagedRoot, { recursive: true })
    for (const [path, bytes] of outputs) {
      await ensureNoSymlinkParents(root, path)
      const staged = targetPath(stagedRoot, path)
      await mkdir(dirname(staged), { recursive: true })
      await writeFile(staged, bytes)
    }

    for (const [path] of outputs) {
      const target = targetPath(root, path)
      const staged = targetPath(stagedRoot, path)
      const backup = targetPath(backupRoot, path)
      await mkdir(dirname(target), { recursive: true })

      let hadOriginal = false
      try {
        await access(target)
        hadOriginal = true
        await mkdir(dirname(backup), { recursive: true })
        await rename(target, backup)
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }

      const journal = { backup, hadOriginal, target }
      applied.push(journal)
      await rename(staged, target)
      if (faultAfterWrites && applied.length >= faultAfterWrites) {
        throw new ReleaseError('Injected transactional write failure', {
          code: 'INJECTED_WRITE_FAILURE'
        })
      }
    }
  } catch (error) {
    for (const entry of applied.reverse()) {
      await rm(entry.target, { force: true })
      if (entry.hadOriginal) {
        await mkdir(dirname(entry.target), { recursive: true })
        await rename(entry.backup, entry.target)
      }
    }
    throw error
  } finally {
    await rm(transactionRoot, { recursive: true, force: true })
  }
}

export const updateRelease = async (options = {}) => {
  const rootDir = resolve(options.rootDir ?? DEFAULT_ROOT_DIR)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new ReleaseError('A Fetch-compatible implementation is required', {
      code: 'NETWORK_UNAVAILABLE',
      exitCode: 2
    })
  }

  const sourceBytes = {}
  for (const sourcePath of SOURCE_ALLOWLIST) {
    sourceBytes[sourcePath] = await fetchBytes(`${CANONICAL_ORIGIN}${sourcePath}`, fetchImpl)
  }

  const tokenSource = parseJson(sourceBytes['/machine/ordering.tokens.json'], 'DTCG token source')
  const designSystem = parseJson(sourceBytes['/machine/design-system.json'], 'design-system manifest')
  const assetManifest = parseJson(sourceBytes['/machine/asset-manifest.json'], 'asset manifest')
  const skillManifest = parseJson(sourceBytes['/machine/skill-manifest.json'], 'skill manifest')
  const release = validateReleaseManifests({ assetManifest, designSystem, skillManifest, tokenSource })

  const sourceRecords = {}
  for (const sourcePath of SOURCE_ALLOWLIST) {
    const filename = SOURCE_FILENAMES[sourcePath]
    const outputPath = sourceOutputPath(release, sourcePath)
    const bytes = sourceBytes[sourcePath]
    const actualSha256 = sha256(bytes)
    const upstream = sourcePath === '/machine/skill-manifest.json'
      ? null
      : getSkillFile(skillManifest, filename)

    if (sourcePath !== '/machine/skill-manifest.json') {
      if (!upstream?.sha256) {
        throw new ReleaseError(`Skill manifest does not publish ${filename}`, {
          code: 'MISSING_UPSTREAM_CHECKSUM'
        })
      }
      verifyExpectedBytes(bytes, upstream, sourcePath)
    }

    sourceRecords[outputPath] = {
      url: `${CANONICAL_ORIGIN}${sourcePath}`,
      bytes: bytes.length,
      sha256: actualSha256,
      verification: upstream
        ? { method: 'skill-manifest', expectedSha256: upstream.sha256 }
        : { method: 'audited-root', expectedSha256: null }
    }
  }

  const assetOutputs = new Map()
  const managedOutputs = {}
  for (const assetPath of ASSET_ALLOWLIST) {
    const entry = assetManifest.assets?.find(asset => asset.path === assetPath)
    if (!entry) {
      throw new ReleaseError(`Asset manifest does not contain allowlisted asset: ${assetPath}`, {
        code: 'MISSING_ASSET'
      })
    }
    if (entry.url !== `${CANONICAL_ORIGIN}${assetPath}`) {
      throw new ReleaseError(`Asset URL differs from its canonical allowlisted path: ${assetPath}`, {
        code: 'ASSET_URL_MISMATCH'
      })
    }
    const bytes = await fetchBytes(entry.url, fetchImpl)
    verifyExpectedBytes(bytes, entry, assetPath)
    const outputPath = assetOutputPath(release, assetPath)
    assetOutputs.set(outputPath, bytes)
    managedOutputs[outputPath] = {
      kind: 'asset',
      source: assetPath,
      bytes: bytes.length,
      sha256: sha256(bytes),
      upstreamSha256: entry.sha256,
      upstreamImmutable: entry.immutable === true
    }
  }

  const generated = generateAdapterArtifacts({ release, tokenSource })
  const generatedOutputs = new Map([
    [GENERATED_JS_PATH, Buffer.from(generated.js)],
    [GENERATED_CSS_PATH, Buffer.from(generated.css)]
  ])
  for (const [path, bytes] of generatedOutputs) {
    managedOutputs[path] = {
      kind: 'generated',
      source: sourceOutputPath(release, '/machine/ordering.tokens.json'),
      bytes: bytes.length,
      sha256: sha256(bytes)
    }
  }

  const existingLock = await readExistingLock(rootDir)
  const retrievedAt = sameRemoteSources(existingLock, sourceRecords)
    ? existingLock.retrievedAt
    : isoDate(options.now)
  const lock = {
    schemaVersion: '1.0.0',
    brand: 'Ordering.co',
    canonicalOrigin: CANONICAL_ORIGIN,
    guidelinesVersion: skillManifest.guidelinesVersion,
    skillVersion: skillManifest.skillVersion,
    tokensVersion: tokenSource.version,
    releasedAt: skillManifest.releasedAt,
    retrievedAt,
    allowlist: {
      sources: [...SOURCE_ALLOWLIST],
      assets: [...ASSET_ALLOWLIST]
    },
    upstreamSourceChecksums: assetManifest.sourceChecksums ?? {},
    sources: sourceRecords,
    managedOutputs
  }

  const outputs = new Map()
  for (const sourcePath of SOURCE_ALLOWLIST) {
    outputs.set(sourceOutputPath(release, sourcePath), sourceBytes[sourcePath])
  }
  for (const entry of assetOutputs) outputs.set(...entry)
  for (const entry of generatedOutputs) outputs.set(...entry)
  outputs.set(LOCK_PATH, Buffer.from(stableJson(lock)))

  const changedFiles = await filesDiffer(rootDir, outputs)
  if (!options.dryRun && changedFiles.length > 0) {
    await transactionalWrite(rootDir, outputs, {
      faultAfterWrites: options.faultAfterWrites
    })
  }

  return {
    ok: true,
    command: 'release-update',
    release,
    retrievedAt,
    dryRun: options.dryRun === true,
    updated: changedFiles.length > 0,
    changedFiles,
    sourceCount: SOURCE_ALLOWLIST.length,
    assetCount: ASSET_ALLOWLIST.length,
    generatedCount: generatedOutputs.size
  }
}

const readLockedFile = async (rootDir, path, expected) => {
  let bytes
  try {
    await ensureNoSymlinkParents(rootDir, path)
    const target = targetPath(rootDir, path)
    const entry = await lstat(target)
    if (!entry.isFile() || entry.isSymbolicLink()) return `${path}: regular file required; symbolic link is not allowed`
    bytes = await readFile(target)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return `${path}: missing`
    }
    throw error
  }
  const actual = sha256(bytes)
  if (actual !== expected.sha256) {
    return `${path}: expected ${expected.sha256}, found ${actual}`
  }
  if (Number.isInteger(expected.bytes) && bytes.length !== expected.bytes) {
    return `${path}: expected ${expected.bytes} bytes, found ${bytes.length}`
  }
  return null
}

const samePathSet = (actual, expected) => {
  const left = [...actual].sort()
  const right = [...expected].sort()
  return JSON.stringify(left) === JSON.stringify(right)
}

export const checkRelease = async (options = {}) => {
  const rootDir = resolve(options.rootDir ?? DEFAULT_ROOT_DIR)
  const lock = await readExistingLock(rootDir)
  if (!lock) {
    throw new ReleaseError(`Release lock is missing: ${LOCK_PATH}`, {
      code: 'MISSING_LOCK'
    })
  }

  const errors = []
  if (lock.canonicalOrigin !== CANONICAL_ORIGIN) {
    errors.push(`canonicalOrigin: expected ${CANONICAL_ORIGIN}, found ${lock.canonicalOrigin}`)
  }
  if (JSON.stringify(lock.allowlist?.sources) !== JSON.stringify(SOURCE_ALLOWLIST)) {
    errors.push('source allowlist differs from the approved release contract')
  }
  if (JSON.stringify(lock.allowlist?.assets) !== JSON.stringify(ASSET_ALLOWLIST)) {
    errors.push('asset allowlist differs from the approved release contract')
  }

  const records = {
    ...(lock.sources ?? {}),
    ...(lock.managedOutputs ?? {})
  }
  for (const [path, expected] of Object.entries(records)) {
    assertSafeRelativePath(path)
    const error = await readLockedFile(rootDir, path, expected)
    if (error) errors.push(error)
  }

  if (!/^\d+\.\d+\.\d+$/.test(lock.skillVersion)) {
    errors.push(`skillVersion is not an exact release: ${lock.skillVersion}`)
  } else {
    const expectedSourcePaths = SOURCE_ALLOWLIST.map(sourcePath =>
      sourceOutputPath(lock.skillVersion, sourcePath))
    const expectedManagedPaths = [
      ...ASSET_ALLOWLIST.map(assetPath => assetOutputPath(lock.skillVersion, assetPath)),
      GENERATED_JS_PATH,
      GENERATED_CSS_PATH
    ]
    if (!samePathSet(Object.keys(lock.sources ?? {}), expectedSourcePaths)) {
      errors.push('locked source paths differ from the exact release allowlist')
    }
    if (!samePathSet(Object.keys(lock.managedOutputs ?? {}), expectedManagedPaths)) {
      errors.push('managed output paths differ from the exact release allowlist')
    }

    try {
      const lockedSourceBytes = {}
      for (const sourcePath of SOURCE_ALLOWLIST) {
        lockedSourceBytes[sourcePath] = await readFile(targetPath(
          rootDir,
          sourceOutputPath(lock.skillVersion, sourcePath)
        ))
      }
      const tokenSource = parseJson(
        lockedSourceBytes['/machine/ordering.tokens.json'],
        'locked DTCG token source'
      )
      const designSystem = parseJson(
        lockedSourceBytes['/machine/design-system.json'],
        'locked design-system manifest'
      )
      const assetManifest = parseJson(
        lockedSourceBytes['/machine/asset-manifest.json'],
        'locked asset manifest'
      )
      const skillManifest = parseJson(
        lockedSourceBytes['/machine/skill-manifest.json'],
        'locked skill manifest'
      )
      const release = validateReleaseManifests({
        assetManifest,
        designSystem,
        skillManifest,
        tokenSource
      })

      if (release !== lock.skillVersion ||
          skillManifest.guidelinesVersion !== lock.guidelinesVersion ||
          skillManifest.releasedAt !== lock.releasedAt ||
          tokenSource.version !== lock.tokensVersion) {
        errors.push('lock release metadata differs from its locked machine sources')
      }
      if (JSON.stringify(assetManifest.sourceChecksums ?? {}) !==
          JSON.stringify(lock.upstreamSourceChecksums ?? {})) {
        errors.push('upstream source hashes differ from the locked asset-manifest metadata')
      }

      for (const sourcePath of SOURCE_ALLOWLIST) {
        const filename = SOURCE_FILENAMES[sourcePath]
        const outputPath = sourceOutputPath(release, sourcePath)
        const record = lock.sources?.[outputPath]
        const upstream = sourcePath === '/machine/skill-manifest.json'
          ? null
          : getSkillFile(skillManifest, filename)
        if (record?.url !== `${CANONICAL_ORIGIN}${sourcePath}` ||
            record?.bytes !== lockedSourceBytes[sourcePath].length) {
          errors.push(`${outputPath}: source URL or byte metadata differs from locked bytes`)
        }
        if (upstream) {
          if (record?.verification?.method !== 'skill-manifest' ||
              record.verification.expectedSha256 !== upstream.sha256 ||
              record.sha256 !== upstream.sha256 ||
              record.bytes !== upstream.bytes) {
            errors.push(`${outputPath}: published skill-manifest checksum linkage differs`)
          }
        } else if (record?.verification?.method !== 'audited-root' ||
                   record.verification.expectedSha256 !== null) {
          errors.push(`${outputPath}: root manifest must remain explicitly unauthenticated upstream`)
        }
      }

      for (const assetPath of ASSET_ALLOWLIST) {
        const outputPath = assetOutputPath(release, assetPath)
        const record = lock.managedOutputs?.[outputPath]
        const upstream = assetManifest.assets?.find(asset => asset.path === assetPath)
        if (!upstream) {
          errors.push(`${assetPath}: missing from locked asset manifest`)
          continue
        }
        if (upstream.url !== `${CANONICAL_ORIGIN}${assetPath}` ||
            record?.kind !== 'asset' ||
            record?.source !== assetPath ||
            record?.sha256 !== upstream.sha256 ||
            record?.upstreamSha256 !== upstream.sha256 ||
            record?.bytes !== upstream.bytes ||
            record?.upstreamImmutable !== (upstream.immutable === true)) {
          errors.push(`${outputPath}: lock metadata differs from the published asset entry`)
        }
      }

      const generated = generateAdapterArtifacts({ release, tokenSource })
      const expectedGenerated = {
        [GENERATED_JS_PATH]: Buffer.from(generated.js),
        [GENERATED_CSS_PATH]: Buffer.from(generated.css)
      }
      for (const [path, expectedBytes] of Object.entries(expectedGenerated)) {
        const actualBytes = await readFile(targetPath(rootDir, path))
        const record = lock.managedOutputs?.[path]
        if (!actualBytes.equals(expectedBytes)) {
          errors.push(`${path}: output does not reproduce from the locked DTCG source`)
        }
        if (record?.kind !== 'generated' ||
            record?.source !== sourceOutputPath(release, '/machine/ordering.tokens.json') ||
            record?.sha256 !== sha256(expectedBytes) ||
            record?.bytes !== expectedBytes.length) {
          errors.push(`${path}: generated output metadata does not match regenerated bytes`)
        }
      }
    } catch (error) {
      errors.push(`locked release consistency check failed: ${error.message}`)
    }
  }

  if (errors.length > 0) {
    const error = new ReleaseError(`Offline release check failed:\n- ${errors.join('\n- ')}`, {
      code: 'OFFLINE_CHECK_FAILED'
    })
    error.details = errors
    throw error
  }

  return {
    ok: true,
    command: 'release-check',
    release: lock.skillVersion,
    networkAccess: false,
    checkedFiles: Object.keys(records).length + 1,
    regeneratedOutputs: 2
  }
}

const compareVersions = (left, right) => {
  const parse = version => String(version).split('.').map(part => {
    const value = Number.parseInt(part, 10)
    return Number.isFinite(value) ? value : 0
  })
  const leftParts = parse(left)
  const rightParts = parse(right)
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

export const checkFreshness = async (options = {}) => {
  const rootDir = resolve(options.rootDir ?? DEFAULT_ROOT_DIR)
  const lock = await readExistingLock(rootDir)
  if (!lock) {
    throw new ReleaseError(`Release lock is missing: ${LOCK_PATH}`, {
      code: 'MISSING_LOCK'
    })
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new ReleaseError('A Fetch-compatible implementation is required', {
      code: 'NETWORK_UNAVAILABLE',
      exitCode: 2
    })
  }

  const url = `${CANONICAL_ORIGIN}/machine/skill-manifest.json`
  const bytes = await fetchBytes(url, fetchImpl)
  const remote = parseJson(bytes, 'remote skill manifest')
  if (remote.canonicalOrigin !== CANONICAL_ORIGIN) {
    throw new ReleaseError('Remote skill manifest has an unexpected canonical origin', {
      code: 'ORIGIN_MISMATCH'
    })
  }
  if (!/^\d+\.\d+\.\d+$/.test(remote.skillVersion) ||
      remote.guidelinesVersion !== remote.skillVersion) {
    throw new ReleaseError('Remote skill manifest does not describe one exact release', {
      code: 'VERSION_MISMATCH'
    })
  }

  const localRootSource = Object.values(lock.sources ?? {})
    .find(source => source.url === url)
  const remoteRootSha256 = sha256(bytes)
  const versionComparison = compareVersions(remote.skillVersion, lock.skillVersion)
  const sameReleaseChanged = versionComparison === 0 &&
    localRootSource?.sha256 !== remoteRootSha256

  return {
    ok: true,
    command: 'release-freshness',
    currentRelease: lock.skillVersion,
    remoteRelease: remote.skillVersion,
    newerReleaseAvailable: versionComparison > 0,
    currentAheadOfRemote: versionComparison < 0,
    sameReleaseChanged,
    upToDate: versionComparison === 0 && !sameReleaseChanged,
    wroteFiles: false,
    remoteRootSha256,
    localRootSha256: localRootSource?.sha256 ?? null
  }
}

export const releasePaths = Object.freeze({
  generatedCss: GENERATED_CSS_PATH,
  generatedJs: GENERATED_JS_PATH,
  lock: LOCK_PATH
})
