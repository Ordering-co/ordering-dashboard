#!/usr/bin/env node
/* sync catalog → api-core system bulk upsert.
 *
 * Reads product/prefix/locales from i18n/config.json.
 * Default mode is --dry-run (no HTTP). Live POST requires --live + env.
 *
 * Usage:
 *   node i18n/sync.cjs
 *   node i18n/sync.cjs --dry-run
 *   node i18n/sync.cjs --live
 *   node i18n/sync.cjs --live --allow-incomplete   # smoke only; skips completeness gate
 *   node i18n/sync.cjs --chunk-size 500 --limit 20
 *   node i18n/sync.cjs --dump-dir i18n/sync-dumps
 *
 * By default sync FAILS if any catalog key is missing EN or any supportedLocale
 * (run /translate-keys + pnpm i18n:verify first). Use --allow-incomplete only for
 * staging smokes.
 *
 * Live env:
 *   ORDERING_API_BASE_URL           e.g. https://apiv4.ordering.co
 *   ORDERING_API_VERSION            default v400
 *   ORDERING_TRANSLATION_SYNC_KEY   X-Translation-Sync-Key-X (api-core TRANSLATION_SYNC_API_KEY)
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { loadConfig } = require('./loadConfig.cjs')
const { isRuntimeVariableCatalogEntry } = require('./isRuntimeVariable.cjs')

function loadEnvFile (filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value
    }
  }
}

// Prefer i18n/.env for local --live; shell/CI env still wins when already set.
loadEnvFile(path.join(__dirname, '.env'))

const DEFAULT_CHUNK = 500

function parseArgs (argv) {
  const out = {
    dryRun: true,
    live: false,
    chunkSize: DEFAULT_CHUNK,
    limit: null,
    dumpDir: null,
    allowIncomplete: false
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') continue
    if (a === '--dry-run') {
      out.dryRun = true
      out.live = false
    } else if (a === '--live') {
      out.live = true
      out.dryRun = false
    } else if (a === '--allow-incomplete') {
      out.allowIncomplete = true
    } else if (a === '--chunk-size') {
      out.chunkSize = Number(argv[++i])
    } else if (a === '--limit') {
      out.limit = Number(argv[++i])
    } else if (a === '--dump-dir') {
      out.dumpDir = argv[++i]
    } else if (a === '--help' || a === '-h') {
      out.help = true
    } else {
      console.error(`Unknown arg: ${a}`)
      process.exit(1)
    }
  }
  return out
}

function chunkArray (arr, size) {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function buildItems (catalog, config) {
  const sourceLang = config.sourceLanguage
  const locales = config.supportedLocales
  const prefix = config.prefix
  const items = []
  const skippedNoEn = []
  let emptyLocaleSlots = 0

  const keys = Object.keys(catalog).sort((a, b) => a.localeCompare(b))
  for (const key of keys) {
    const entry = catalog[key] || {}
    const en = entry[sourceLang] != null ? String(entry[sourceLang]).trim() : ''
    if (!en) {
      skippedNoEn.push(key)
      continue
    }

    const langs = {}
    for (const loc of locales) {
      const v = entry[loc] != null ? String(entry[loc]).trim() : ''
      if (v) langs[loc] = v
      else emptyLocaleSlots++
    }

    items.push({
      key: `${prefix}${key}`,
      value: en,
      langs
    })
  }

  return { items, skippedNoEn, emptyLocaleSlots }
}

/**
 * Completeness for sync: every non-runtime catalog key must have every
 * supportedLocale. runtime_variable keys (empty EN) are skipped here and at
 * upload time — they are not translate-keys targets.
 */
function catalogCompleteness (catalog, config) {
  const sourceLang = config.sourceLanguage
  const locales = config.supportedLocales
  let incompleteKeys = 0
  let runtimeSkipped = 0
  let emptyLocaleSlots = 0
  const sample = []

  for (const key of Object.keys(catalog).sort((a, b) => a.localeCompare(b))) {
    const entry = catalog[key] || {}
    if (isRuntimeVariableCatalogEntry(entry, sourceLang)) {
      runtimeSkipped++
      continue
    }

    const missing = []
    for (const loc of locales) {
      const v = entry[loc] != null ? String(entry[loc]).trim() : ''
      if (!v) {
        emptyLocaleSlots++
        missing.push(loc)
      }
    }
    if (missing.length) {
      incompleteKeys++
      if (sample.length < 5) {
        sample.push(`${key} (missing: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', ...' : ''})`)
      }
    }
  }

  return { incompleteKeys, runtimeSkipped, emptyLocaleSlots, sample }
}

function requireLiveEnv () {
  const baseUrl = (process.env.ORDERING_API_BASE_URL || '').replace(/\/$/, '')
  const version = process.env.ORDERING_API_VERSION || 'v400'
  const syncKey = process.env.ORDERING_TRANSLATION_SYNC_KEY || ''

  const missing = []
  if (!baseUrl) missing.push('ORDERING_API_BASE_URL')
  if (!syncKey) missing.push('ORDERING_TRANSLATION_SYNC_KEY')
  if (missing.length) {
    throw new Error(`--live requires env: ${missing.join(', ')}`)
  }

  // system route + dedicated translation sync key (global main DB upsert)
  const url = `${baseUrl}/${version}/system/bulks/translations`
  return { url, syncKey }
}

async function postChunk (url, syncKey, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Translation-Sync-Key-X': syncKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  if (!res.ok || json.error === true) {
    const err = new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`)
    err.response = json
    throw err
  }
  return json
}

async function main () {
  const args = parseArgs(process.argv)
  if (args.help) {
    console.log(
      'Usage: node i18n/sync.cjs [--dry-run|--live] [--allow-incomplete] [--chunk-size N] [--limit N] [--dump-dir DIR]'
    )
    process.exit(0)
  }

  if (!Number.isFinite(args.chunkSize) || args.chunkSize < 1 || args.chunkSize > 500) {
    console.error('FAIL: --chunk-size must be 1..500 (api-core contract max)')
    process.exit(1)
  }

  const config = loadConfig()
  if (!fs.existsSync(config.catalogPath)) {
    console.error(`FAIL: catalog missing at ${config.catalogPath}`)
    process.exit(1)
  }

  const catalog = JSON.parse(fs.readFileSync(config.catalogPath, 'utf8'))
  const completeness = catalogCompleteness(catalog, config)

  console.log(`i18n sync (${args.live ? 'live' : 'dry-run'})`)
  console.log(`  product: ${config.product}`)
  console.log(`  prefix: ${config.prefix}`)
  console.log(`  sourceLanguage: ${config.sourceLanguage}`)
  console.log(`  supportedLocales: ${config.supportedLocales.join(', ')}`)
  console.log(`  catalog keys: ${Object.keys(catalog).length}`)
  console.log(
    `  incomplete keys: ${completeness.incompleteKeys}` +
    ` (empty locale slots: ${completeness.emptyLocaleSlots}, runtime_variable skipped: ${completeness.runtimeSkipped})`
  )

  if (completeness.incompleteKeys > 0 && !args.allowIncomplete) {
    console.error('FAIL: catalog is incomplete; refusing to sync.')
    console.error('  Fill locales with /translate-keys, then: pnpm i18n:verify')
    console.error('  Check progress: pnpm i18n:missing --summary')
    for (const s of completeness.sample) console.error(`  - ${s}`)
    if (completeness.incompleteKeys > completeness.sample.length) {
      console.error(`  ... and ${completeness.incompleteKeys - completeness.sample.length} more`)
    }
    console.error('  Override (smoke only): --allow-incomplete')
    process.exit(1)
  }
  if (completeness.incompleteKeys > 0 && args.allowIncomplete) {
    console.warn(
      `WARN: --allow-incomplete: syncing despite ${completeness.incompleteKeys} incomplete key(s); empty locales will be omitted from langs`
    )
  }

  let { items, skippedNoEn, emptyLocaleSlots } = buildItems(catalog, config)

  if (args.limit != null && Number.isFinite(args.limit)) {
    items = items.slice(0, args.limit)
  }

  const chunks = chunkArray(items, args.chunkSize)

  console.log(`  items to sync: ${items.length} (skipped no EN: ${skippedNoEn.length})`)
  console.log(`  empty locale slots omitted from langs: ${emptyLocaleSlots}`)
  console.log(`  chunk size: ${args.chunkSize} → ${chunks.length} request(s)`)

  if (skippedNoEn.length) {
    console.warn(`WARN: ${skippedNoEn.length} key(s) skipped (empty ${config.sourceLanguage}). First: ${skippedNoEn.slice(0, 5).join(', ')}`)
  }

  if (args.dumpDir) {
    const dir = path.resolve(process.cwd(), args.dumpDir)
    fs.mkdirSync(dir, { recursive: true })
    chunks.forEach((chunk, i) => {
      const payload = { product: config.product, translations: chunk }
      const file = path.join(dir, `chunk-${String(i + 1).padStart(3, '0')}.json`)
      fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n')
    })
    console.log(`  dumped ${chunks.length} chunk file(s) → ${dir}`)
  }

  if (!args.live) {
    chunks.forEach((chunk, i) => {
      const sample = chunk[0]
      console.log(
        `  chunk ${i + 1}/${chunks.length}: ${chunk.length} keys` +
        (sample ? ` (e.g. ${sample.key}, langs=${Object.keys(sample.langs).length})` : '')
      )
    })
    console.log('OK dry-run (no HTTP). Use --live with your configured API credentials to sync.')
    process.exit(0)
  }

  const { url, syncKey } = requireLiveEnv()
  console.log(`  POST ${url}`)

  let created = 0
  let updated = 0
  let skipped = 0

  for (let i = 0; i < chunks.length; i++) {
    const payload = { product: config.product, translations: chunks[i] }
    process.stdout.write(`  chunk ${i + 1}/${chunks.length} (${chunks[i].length} keys)... `)
    try {
      const json = await postChunk(url, syncKey, payload)
      const t = json.result?.translations || {}
      const l = json.result?.translation_lang || {}
      created += (t.created || 0) + (l.created || 0)
      updated += (t.updated || 0) + (l.updated || 0)
      skipped += (t.skipped || 0) + (l.skipped || 0)
      console.log(
        `ok cache=${json.result?.cache_invalidated} ` +
        `t=${JSON.stringify(t)} lang=${JSON.stringify(l)}`
      )
    } catch (e) {
      console.log('FAIL')
      console.error(e.message)
      process.exit(1)
    }
  }

  console.log(`OK live sync complete. created=${created} updated=${updated} skipped=${skipped}`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
