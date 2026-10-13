'use strict'

const fs = require('fs')
const path = require('path')

const CONFIG_PATH = path.join(__dirname, 'config.json')

function loadConfig () {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  if (!raw.sourceLanguage || typeof raw.sourceLanguage !== 'string') {
    throw new Error('i18n/config.json: sourceLanguage is required')
  }
  if (!Array.isArray(raw.supportedLocales) || raw.supportedLocales.length === 0) {
    throw new Error('i18n/config.json: supportedLocales must be a non-empty array')
  }
  if (!raw.product || !raw.prefix) {
    throw new Error('i18n/config.json: product and prefix are required')
  }
  // Resolve catalog relative to this i18n/ directory (not process.cwd())
  const catalogPath = raw.catalogPath
    ? (path.isAbsolute(raw.catalogPath)
        ? raw.catalogPath
        : path.join(__dirname, path.basename(raw.catalogPath)))
    : path.join(__dirname, 'translations.json')
  return { ...raw, catalogPath, configPath: CONFIG_PATH }
}

module.exports = { loadConfig, CONFIG_PATH }
