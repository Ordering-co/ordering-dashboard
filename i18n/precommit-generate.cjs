#!/usr/bin/env node
/* Husky helper: if staged changes touch UI source, refresh the i18n catalog
 * and re-stage generated artifacts so the commit stays consistent.
 *
 * Does NOT fill locales (that is /translate-keys). New keys land with empty
 * supportedLocales → CI i18n:verify fails until translate-keys runs.
 */
'use strict'

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { loadConfig } = require('./loadConfig.cjs')
const { isRuntimeVariableCatalogEntry } = require('./isRuntimeVariable.cjs')
const { printTranslateKeysHint } = require('./translateKeysHint.cjs')

function stagedFiles () {
  const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    encoding: 'utf8'
  })
  return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
}

function shouldGenerate (files) {
  return files.some((f) => {
    if (f.startsWith('i18n/') && f.endsWith('.cjs')) return true
    if (!f.startsWith('src/')) return false
    return /\.(js|jsx|ts|tsx)$/.test(f)
  })
}

const files = stagedFiles()
if (!shouldGenerate(files)) {
  process.exit(0)
}

console.log('i18n: source changes detected → running pnpm i18n:generate')
execSync('pnpm i18n:generate', { stdio: 'inherit' })

const artifacts = [
  'i18n/translations.json',
  'i18n/lang_keys.csv',
  'i18n/lang_keys_conflicts.csv',
  'i18n/typo_findings.txt'
].filter((f) => fs.existsSync(path.resolve(process.cwd(), f)))

if (artifacts.length) {
  execSync('git add -- ' + artifacts.join(' '), { stdio: 'inherit' })
  console.log(`i18n: staged ${artifacts.join(', ')}`)
}

// INFO only: do not block the commit. CI verify will fail until locales are filled.
try {
  const config = loadConfig()
  const catalog = JSON.parse(fs.readFileSync(config.catalogPath, 'utf8'))
  let incomplete = 0
  for (const entry of Object.values(catalog)) {
    if (isRuntimeVariableCatalogEntry(entry, config.sourceLanguage)) continue
    const missing = config.supportedLocales.some((loc) => {
      const v = entry[loc]
      return v == null || !String(v).trim()
    })
    if (missing) incomplete++
  }
  if (incomplete > 0) {
    console.log(`\ni18n: INFO — ${incomplete} key(s) still need locale translations.`)
    console.log('i18n: Commit will proceed; PR CI will fail until you run the skill.\n')
    printTranslateKeysHint(console.log)
  }
} catch (e) {
  // best-effort hint; never fail the commit for messaging
}

process.exit(0)
