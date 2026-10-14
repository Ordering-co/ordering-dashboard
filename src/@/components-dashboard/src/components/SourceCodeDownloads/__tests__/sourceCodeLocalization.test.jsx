import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import labels from '../sourceCodeTranslations.generated.json'
import { createSourceCodeTranslator, getSourceCodeLocale, useSourceCodeTranslator } from '../useSourceCodeTranslator'

const require = createRequire(import.meta.url)
const { buildSourceCodeTranslations, SOURCE_CODE_TRANSLATIONS_PATH } = require('../buildSourceCodeTranslations.cjs')
const { scanKeys } = require(path.resolve('i18n/scanKeys.cjs'))
const config = JSON.parse(fs.readFileSync('i18n/config.json', 'utf8'))
const canonical = JSON.parse(fs.readFileSync('i18n/translations.json', 'utf8'))
const titleKey = 'SOURCE_CODE_TITLE'

// Same namespace and nullish fallback behavior as the existing provider.
const provider = (dictionary = {}) => vi.fn((key, fallback = null) => {
  const original = key.startsWith('DASHBOARD_') ? key.slice('DASHBOARD_'.length) : key
  const namespaced = key.startsWith('DASHBOARD_') ? key : `DASHBOARD_${key}`
  return dictionary[namespaced] ?? dictionary[original] ?? fallback ?? namespaced
})

describe('scoped source code label fallback', () => {
  it('contains only canonical source keys with all configured locales and identical values', () => {
    expect(Object.keys(labels).length).toBeGreaterThan(0)
    expect(labels).toEqual(buildSourceCodeTranslations(canonical, config))
    for (const [key, translations] of Object.entries(labels)) {
      expect(key.startsWith('SOURCE_CODE_')).toBe(true)
      expect(Object.keys(translations)).toEqual(['en', ...config.supportedLocales])
      for (const locale of ['en', ...config.supportedLocales]) {
        expect(translations[locale]).toBe(canonical[key][locale])
        expect(translations[locale].trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('retains literal English source fallbacks for the existing generator scan', () => {
    const sourceRows = scanKeys().rows.filter(row => row.key.startsWith('SOURCE_CODE_'))
    expect(sourceRows.length).toBeGreaterThan(0)
    for (const row of sourceRows) expect(row.value).toBe(canonical[row.key].en)
  })

  it.each(['es', 'ar'])('uses the canonical %s labels when the API has not added the feature keys', locale => {
    const api = provider()
    const translate = createSourceCodeTranslator(api, { code: locale })
    expect(translate(titleKey, canonical[titleKey].en)).toBe(canonical[titleKey][locale])
    expect(api).toHaveBeenCalledWith(titleKey, canonical[titleKey][locale])
  })

  it.each(['es-MX', 'ES_mx', { code: 'es-ES' }, { code: 'ar-SA' }])('resolves regional source locale %j', input => {
    const locale = getSourceCodeLocale(input)
    expect(['es', 'ar']).toContain(locale)
    expect(createSourceCodeTranslator(provider(), input)(titleKey)).toBe(canonical[titleKey][locale])
  })

  it.each(['zh-CN', 'not-supported', '', null])('falls back to English for unsupported source locale %j', locale => {
    expect(getSourceCodeLocale(locale)).toBe('en')
    expect(createSourceCodeTranslator(provider(), locale)(titleKey)).toBe(canonical[titleKey].en)
  })

  it('preserves nonempty API priority and the caller namespace/key', () => {
    const api = provider({ DASHBOARD_SOURCE_CODE_TITLE: 'Controlled API label' })
    const translate = createSourceCodeTranslator(api, 'ar')
    expect(translate('DASHBOARD_SOURCE_CODE_TITLE', canonical[titleKey].en)).toBe('Controlled API label')
    expect(api).toHaveBeenCalledWith('DASHBOARD_SOURCE_CODE_TITLE', canonical[titleKey].ar)
    expect(createSourceCodeTranslator(provider({ SOURCE_CODE_TITLE: 'Plain API label' }), 'es')(titleKey)).toBe('Plain API label')
  })

  it.each(['', '   '])('rejects the API empty label %j only for owned source keys', value => {
    const translate = createSourceCodeTranslator(provider({ DASHBOARD_SOURCE_CODE_TITLE: value, DASHBOARD_UNRELATED: value }), 'es')
    expect(translate(titleKey, canonical[titleKey].en)).toBe(canonical[titleKey].es)
    expect(translate('UNRELATED', 'Unrelated fallback')).toBe(value)
  })

  it('keeps unrelated and unowned key behavior and fallback signature unchanged', () => {
    const api = provider({ DASHBOARD_UNRELATED: 0 })
    const translate = createSourceCodeTranslator(api, 'ar')
    expect(translate('UNRELATED', 'Unrelated fallback')).toBe(0)
    expect(api).toHaveBeenLastCalledWith('UNRELATED', 'Unrelated fallback')
    expect(translate('OTHER_MISSING')).toBe('DASHBOARD_OTHER_MISSING')
    expect(api).toHaveBeenLastCalledWith('OTHER_MISSING', null)
    expect(translate('SOURCE_CODE_NOT_OWNED', 'Unowned fallback')).toBe('Unowned fallback')
  })

  it('updates the hook with locale and API translator changes', () => {
    const { result, rerender } = renderHook(({ language, api }) => useSourceCodeTranslator(api, language), { initialProps: { language: { code: 'es' }, api: provider() } })
    expect(result.current(titleKey)).toBe(canonical[titleKey].es)
    rerender({ language: { code: 'ar' }, api: provider() })
    expect(result.current(titleKey)).toBe(canonical[titleKey].ar)
    rerender({ language: { code: 'ar' }, api: provider({ DASHBOARD_SOURCE_CODE_TITLE: 'Loaded API label' }) })
    expect(result.current(titleKey)).toBe('Loaded API label')
  })
})

describe('managed source label generation parity', () => {
  it('detects a stale generated subset through the real checker without changing the canonical catalog', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-localization-test-'))
    const copy = filename => {
      const destination = path.join(root, filename)
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.copyFileSync(filename, destination)
    }
    try {
      for (const file of ['i18n/generate.cjs', 'i18n/check-generated.cjs', 'i18n/loadConfig.cjs', 'i18n/scanKeys.cjs', 'i18n/config.json', 'src/@/components-dashboard/src/components/SourceCodeDownloads/buildSourceCodeTranslations.cjs']) copy(file)
      const catalogFile = path.join(root, 'i18n/translations.json')
      const bytes = JSON.stringify({ ...labels, UNRELATED_LABEL: { en: 'Outside feature' } }, null, 2) + '\n'
      fs.writeFileSync(catalogFile, bytes)
      const run = script => spawnSync(process.execPath, [script, '--source-code-only'], { cwd: root, encoding: 'utf8' })
      expect(run('i18n/generate.cjs').status).toBe(0)
      expect(run('i18n/check-generated.cjs').status).toBe(0)
      const outputFile = path.join(root, SOURCE_CODE_TRANSLATIONS_PATH)
      const stale = JSON.parse(fs.readFileSync(outputFile, 'utf8'))
      stale[titleKey].es = 'Controlled stale generated value'
      fs.writeFileSync(outputFile, JSON.stringify(stale, null, 2) + '\n')
      const result = run('i18n/check-generated.cjs')
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(SOURCE_CODE_TRANSLATIONS_PATH)
      expect(JSON.parse(fs.readFileSync(outputFile, 'utf8'))).toEqual(stale)
      expect(fs.readFileSync(catalogFile, 'utf8')).toBe(bytes)
      expect(run('i18n/generate.cjs').status).toBe(0)
      expect(run('i18n/check-generated.cjs').status).toBe(0)
      expect(JSON.parse(fs.readFileSync(outputFile, 'utf8'))).toEqual(labels)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
