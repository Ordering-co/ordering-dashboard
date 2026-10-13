#!/usr/bin/env node
/* List catalog keys with empty supportedLocales (from i18n/config.json).
 *
 * Skips runtime_variable keys (empty EN / no static t() fallback): those are
 * not translate-keys targets.
 *
 * Usage:
 *   node i18n/missing.cjs              # summary
 *   node i18n/missing.cjs --limit 40   # print first N incomplete keys as JSON batch
 *   node i18n/missing.cjs --offset 40 --limit 40
 *   node i18n/missing.cjs --write i18n/batch-missing.json
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { loadConfig } = require('./loadConfig.cjs')
const { isRuntimeVariableCatalogEntry } = require('./isRuntimeVariable.cjs')
const { printTranslateKeysHint } = require('./translateKeysHint.cjs')

function parseArgs (argv) {
  const out = { limit: null, offset: 0, write: null, summaryOnly: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') continue
    if (a === '--limit') out.limit = Number(argv[++i])
    else if (a === '--offset') out.offset = Number(argv[++i])
    else if (a === '--write') out.write = argv[++i]
    else if (a === '--summary') out.summaryOnly = true
  }
  return out
}

const args = parseArgs(process.argv)
const config = loadConfig()
const catalog = JSON.parse(fs.readFileSync(config.catalogPath, 'utf8'))
const sourceLang = config.sourceLanguage
const locales = config.supportedLocales

const incomplete = []
let runtimeSkipped = 0
for (const key of Object.keys(catalog).sort((a, b) => a.localeCompare(b))) {
  const entry = catalog[key] || {}
  if (isRuntimeVariableCatalogEntry(entry, sourceLang)) {
    runtimeSkipped++
    continue
  }
  const en = entry[sourceLang] != null ? String(entry[sourceLang]) : ''
  const missingLocales = locales.filter(loc => {
    const v = entry[loc]
    return v == null || !String(v).trim()
  })
  if (missingLocales.length) {
    incomplete.push({
      key,
      [sourceLang]: en,
      missingLocales
    })
  }
}

const totalEmptySlots = incomplete.reduce((n, row) => n + row.missingLocales.length, 0)

console.error(`incomplete keys: ${incomplete.length} / ${Object.keys(catalog).length}`)
console.error(`empty locale slots: ${totalEmptySlots}`)
console.error(`runtime_variable skipped: ${runtimeSkipped}`)
console.error(`supportedLocales: ${locales.join(', ')}`)

if (incomplete.length > 0) {
  printTranslateKeysHint(console.error)
}

if (args.summaryOnly) process.exit(0)

const slice = incomplete.slice(args.offset, args.limit == null ? undefined : args.offset + args.limit)
const batch = {
  product: config.product,
  sourceLanguage: sourceLang,
  supportedLocales: locales,
  offset: args.offset,
  count: slice.length,
  keys: slice.map(row => ({
    key: row.key,
    [sourceLang]: row[sourceLang],
    // Agent must fill every missingLocales entry; preserve placeholders from English
    missingLocales: row.missingLocales,
    translations: Object.fromEntries(row.missingLocales.map(loc => [loc, '']))
  }))
}

const json = JSON.stringify(batch, null, 2) + '\n'
if (args.write) {
  const outPath = path.resolve(process.cwd(), args.write)
  fs.writeFileSync(outPath, json)
  console.error(`wrote ${outPath} (${batch.count} keys)`)
} else {
  process.stdout.write(json)
}
