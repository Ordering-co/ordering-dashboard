#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  applyPreview,
  createPreview,
  inspectMigration,
  loadRules,
  previewArtifactPath,
  validatePreviewDocument,
  verifyMigration
} from './brand-system/migration.mjs'

const HELP = `Ordering.co brand-system tooling

Usage:
  node scripts/brand-system.mjs inspect --rules <file> --scope <file[,file]> [--json]
  node scripts/brand-system.mjs preview --rules <file> --allowlist <file[,file]> [--out <file>] [--json]
  node scripts/brand-system.mjs apply --preview <file> --id <reviewed-preview-id> --allowlist <file[,file]> [--json]
  node scripts/brand-system.mjs verify --rules <file> --allowlist <file[,file]> [--json]
  node scripts/brand-system.mjs release-update [--dry-run] [--json]
  node scripts/brand-system.mjs release-check [--json]
  node scripts/brand-system.mjs release-freshness [--json]

Migration safety:
  inspect and preview never edit source files. apply requires the saved preview and
  the exact reviewed identifier and allowlist, rejects changed inputs, validates every output,
  and rolls the complete batch back if a write fails.
`

export const parseArgs = (argv) => {
  const [command, ...rest] = argv
  const options = { command }
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`)
    const key = argument.slice(2)
    if (key === 'json' || key === 'help' || key === 'dry-run') {
      options[key === 'dry-run' ? 'dryRun' : key] = true
      continue
    }
    const value = rest[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`)
    index += 1
    if (key === 'allowlist' || key === 'scope') {
      options[key] ??= []
      options[key].push(...value.split(',').filter(Boolean))
    } else options[key] = value
  }
  return options
}

const requireOption = (options, key) => {
  if (!options[key]) throw new Error(`Missing required option --${key}`)
  return options[key]
}

const migrationOptions = async (options, rootDir, { allowScope = false } = {}) => {
  requireOption(options, 'rules')
  const allowlist = (options.allowlist?.length ?? 0) > 0 ? options.allowlist : (allowScope ? (options.scope ?? []) : [])
  if (allowlist.length === 0) throw new Error(`Missing required option --${allowScope ? 'scope' : 'allowlist'}`)
  const loaded = await loadRules(path.resolve(rootDir, options.rules))
  return { rootDir, ruleset: loaded.ruleset, rulesHash: loaded.hash, allowlist }
}

const printResult = (result, json) => {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }
  if (result.id) process.stdout.write(`Preview: ${result.id}\n`)
  if (Array.isArray(result.files)) process.stdout.write(`Files: ${result.files.length}\n`)
  if (Array.isArray(result.changes)) process.stdout.write(`Changes: ${result.changes.length}\n`)
  if (Array.isArray(result.skips)) process.stdout.write(`Skips: ${result.skips.length}\n`)
  if (Array.isArray(result.preservations)) process.stdout.write(`Preservations: ${result.preservations.length}\n`)
  if (Array.isArray(result.consumerUsages)) process.stdout.write(`Consumer usages: ${result.consumerUsages.length}\n`)
  if (Array.isArray(result.outputs)) result.outputs.forEach(output => process.stdout.write(output.diff))
  if (Array.isArray(result.applied)) process.stdout.write(`Applied: ${result.applied.join(', ') || 'none'}\n`)
  if (typeof result.ok === 'boolean') process.stdout.write(`Verified: ${result.ok ? 'yes' : 'no'}\n`)
}

export const run = async (argv = process.argv.slice(2), { rootDir = process.cwd(), releaseModule } = {}) => {
  const options = parseArgs(argv)
  if (!options.command || options.help || options.command === 'help' || options.command === '--help') {
    process.stdout.write(HELP)
    return { exitCode: 0 }
  }

  const allowedOptions = {
    inspect: new Set(['command', 'rules', 'scope', 'json']),
    preview: new Set(['command', 'rules', 'allowlist', 'out', 'json']),
    apply: new Set(['command', 'preview', 'id', 'allowlist', 'json']),
    verify: new Set(['command', 'rules', 'allowlist', 'json']),
    'release-update': new Set(['command', 'dryRun', 'json']),
    'release-check': new Set(['command', 'json']),
    'release-freshness': new Set(['command', 'json'])
  }
  const commandOptions = allowedOptions[options.command]
  if (commandOptions) {
    const unknown = Object.keys(options).find(key => !commandOptions.has(key))
    if (unknown) throw new Error(`Unknown option --${unknown}`)
  }

  let result
  if (options.command === 'inspect') {
    result = await inspectMigration(await migrationOptions(options, rootDir, { allowScope: true }))
  } else if (options.command === 'preview') {
    const migration = await migrationOptions(options, rootDir)
    result = await createPreview(migration)
    if (options.out) {
      const rulePath = path.relative(rootDir, path.resolve(rootDir, options.rules)).split(path.sep).join('/')
      const output = previewArtifactPath(rootDir, options.out, [...result.files.map(file => file.path), rulePath])
      const target = path.resolve(rootDir, output)
      try {
        validatePreviewDocument(JSON.parse(await fs.readFile(target, 'utf8')))
      } catch (error) {
        if (error?.code !== 'ENOENT') throw new Error(`Refusing to overwrite a non-preview artifact: ${output}`)
      }
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    }
  } else if (options.command === 'apply') {
    requireOption(options, 'preview')
    requireOption(options, 'id')
    if ((options.allowlist?.length ?? 0) === 0) throw new Error('Missing required option --allowlist')
    const preview = JSON.parse(await fs.readFile(path.resolve(rootDir, options.preview), 'utf8'))
    result = await applyPreview({ rootDir, preview, previewId: options.id, allowlist: options.allowlist })
  } else if (options.command === 'verify') {
    result = await verifyMigration(await migrationOptions(options, rootDir))
  } else if (options.command.startsWith('release-')) {
    const release = releaseModule ?? await import('./brand-system/release.mjs')
    const releaseOptions = { ...options, rootDir }
    if (options.command === 'release-update') result = await release.updateRelease(releaseOptions)
    else if (options.command === 'release-check') result = await release.checkRelease(releaseOptions)
    else if (options.command === 'release-freshness') result = await release.checkFreshness(releaseOptions)
    else throw new Error(`Unknown command: ${options.command}`)
  } else {
    throw new Error(`Unknown command: ${options.command}`)
  }
  printResult(result, options.json)
  return { result, exitCode: result.ok === false ? 1 : 0 }
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntrypoint) {
  run().then(({ exitCode }) => {
    process.exitCode = exitCode
  }).catch(error => {
    process.stderr.write(`brand-system: ${error.message}\n`)
    process.exitCode = error.exitCode ?? 1
  })
}
