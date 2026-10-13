#!/usr/bin/env node
/* Merge a filled batch JSON into i18n/translations.json.
 *
 * Batch shape (from missing.cjs, with translations filled):
 * {
 *   "keys": [
 *     {
 *       "key": "ADD_TO_CART",
 *       "en": "Add to Cart",
 *       "missingLocales": ["es", "fr"],
 *       "translations": { "es": "...", "fr": "..." }
 *     }
 *   ]
 * }
 *
 * Usage:
 *   node i18n/applyBatch.cjs i18n/batch-filled.json
 *   node i18n/applyBatch.cjs i18n/batch-filled.json --strict
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { loadConfig } = require('./loadConfig.cjs')

const args = process.argv.slice(2).filter(a => a !== '--')
const strict = args.includes('--strict')
const batchPath = args.find(a => a !== '--strict')

if (!batchPath) {
  console.error('Usage: node i18n/applyBatch.cjs <batch.json> [--strict]')
  process.exit(1)
}

const config = loadConfig()
const catalog = JSON.parse(fs.readFileSync(config.catalogPath, 'utf8'))
const batch = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), batchPath), 'utf8'))
const locales = new Set(config.supportedLocales)
const sourceLang = config.sourceLanguage

if (!Array.isArray(batch.keys)) {
  console.error('FAIL: batch.keys must be an array')
  process.exit(1)
}

let applied = 0
let skipped = 0
const errors = []

for (const row of batch.keys) {
  if (!row || !row.key) {
    errors.push('row missing key')
    continue
  }
  if (!catalog[row.key]) {
    errors.push(`unknown catalog key: ${row.key}`)
    continue
  }

  const missing = Array.isArray(row.missingLocales) ? row.missingLocales : []
  const translations = row.translations && typeof row.translations === 'object' ? row.translations : {}

  if (strict) {
    for (const loc of missing) {
      const v = translations[loc]
      if (v == null || !String(v).trim()) {
        errors.push(`${row.key}: missing filled translation for "${loc}"`)
      }
    }
    const extra = Object.keys(translations).filter(loc => !missing.includes(loc))
    if (extra.length) {
      errors.push(`${row.key}: unexpected translation locales: ${extra.join(', ')}`)
    }
  }

  // Count input vs output for skill no-skip check
  const expected = missing.length
  const provided = missing.filter(loc => translations[loc] != null && String(translations[loc]).trim()).length
  if (provided !== expected) {
    errors.push(`${row.key}: expected ${expected} translations, got ${provided}`)
    continue
  }

  for (const loc of missing) {
    if (!locales.has(loc)) {
      errors.push(`${row.key}: locale "${loc}" not in supportedLocales`)
      continue
    }
    const value = String(translations[loc]).trim()
    if (!value) {
      skipped++
      continue
    }
    catalog[row.key][loc] = value
    applied++
  }

  // Never overwrite sourceLanguage from batch unless explicitly present and non-empty
  if (row[sourceLang] && String(row[sourceLang]).trim() && !catalog[row.key][sourceLang]) {
    catalog[row.key][sourceLang] = String(row[sourceLang]).trim()
  }
}

if (errors.length) {
  console.error(`FAIL: ${errors.length} issue(s)`)
  for (const e of errors.slice(0, 40)) console.error('  -', e)
  if (errors.length > 40) console.error(`  ... and ${errors.length - 40} more`)
  process.exit(1)
}

const sorted = {}
for (const key of Object.keys(catalog).sort((a, b) => a.localeCompare(b))) {
  sorted[key] = catalog[key]
}
fs.writeFileSync(config.catalogPath, JSON.stringify(sorted, null, 2) + '\n')
console.log(`OK: applied ${applied} locale value(s); skipped empty ${skipped}`)
console.log(`catalog: ${path.relative(process.cwd(), config.catalogPath)}`)
console.log(`keys in batch: ${batch.keys.length}`)
