#!/usr/bin/env node
/* i18n verify.
 * Reads locales from i18n/config.json (SSoT). Fails if:
 *  1. Code uses a static t('KEY') not present in the catalog
 *  2. Catalog English (sourceLanguage) does not match code scan
 *  3. Any supportedLocale is missing or empty for a catalog key
 *     (except runtime_variable_fallback keys: no static EN to translate)
 *
 * Orphan keys (in catalog but not in code) are reported as warnings only —
 * they are intentionally kept (no DB delete in this project).
 */
'use strict'

const fs = require('fs')
const { scanKeys } = require('./scanKeys.cjs')
const { loadConfig } = require('./loadConfig.cjs')
const { isRuntimeVariableRow } = require('./isRuntimeVariable.cjs')
const { printTranslateKeysHint } = require('./translateKeysHint.cjs')

const config = loadConfig()
const sourceLang = config.sourceLanguage
const locales = config.supportedLocales
const catalogPath = config.catalogPath

if (!fs.existsSync(catalogPath)) {
  console.error(`FAIL: catalog missing at ${catalogPath}`)
  console.error('Run: pnpm i18n:generate')
  process.exit(1)
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
const { rows } = scanKeys()

const codeByKey = new Map(rows.map(r => [r.key, r]))
const errors = []
const warnings = []
let runtimeSkipped = 0

for (const [key, row] of codeByKey) {
  const entry = catalog[key]
  if (!entry || typeof entry !== 'object') {
    errors.push(`missing catalog key: ${key}`)
    continue
  }

  const codeEn = row.value || ''
  const catalogEn = entry[sourceLang] != null ? String(entry[sourceLang]) : ''
  const runtime = isRuntimeVariableRow(row)

  if (runtime) {
    runtimeSkipped++
    // No static EN: skip EN drift + locale completeness (not translate-keys targets)
    continue
  }

  if (codeEn && catalogEn !== codeEn) {
    errors.push(
      `english mismatch for ${key}: catalog=${JSON.stringify(catalogEn)} code=${JSON.stringify(codeEn)}`
    )
  }

  if (!catalogEn.trim()) {
    errors.push(`empty ${sourceLang} for ${key}`)
  }

  for (const loc of locales) {
    const v = entry[loc]
    if (v == null || !String(v).trim()) {
      errors.push(`missing locale "${loc}" for ${key}`)
    }
  }
}

for (const key of Object.keys(catalog)) {
  if (!codeByKey.has(key)) {
    warnings.push(`orphan catalog key (kept intentionally, not in code): ${key}`)
  }
}

if (warnings.length) {
  console.log(`warnings (${warnings.length}):`)
  for (const w of warnings.slice(0, 50)) console.log('  -', w)
  if (warnings.length > 50) console.log(`  ... and ${warnings.length - 50} more`)
}

if (errors.length) {
  const localeErrors = errors.filter((e) => e.startsWith('missing locale'))
  console.error(`\nFAIL: ${errors.length} i18n issue(s)`)
  for (const e of errors.slice(0, 80)) console.error(`  - ${e}`)
  if (errors.length > 80) console.error(`  ... and ${errors.length - 80} more`)
  if (localeErrors.length) {
    printTranslateKeysHint(console.error)
  } else {
    console.error('\nTips:')
    console.error('  - Run pnpm i18n:generate (or commit: husky runs it) to refresh English from code')
    console.error(`  - Locales required by config: ${locales.join(', ')}`)
    console.error('  - runtime_variable_fallback keys are excluded from locale checks')
  }
  process.exit(1)
}

console.log('OK: i18n catalog complete')
console.log(`  keys: ${codeByKey.size}`)
console.log(`  sourceLanguage: ${sourceLang}`)
console.log(`  supportedLocales: ${locales.join(', ')}`)
console.log(`  runtime_variable skipped: ${runtimeSkipped}`)
console.log(`  orphans (kept): ${warnings.filter(w => w.startsWith('orphan')).length}`)
process.exit(0)
