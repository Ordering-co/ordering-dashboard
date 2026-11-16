/* eslint-disable no-template-curly-in-string */
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyPreview as applyReviewedPreview,
  createPreview,
  inspectMigration,
  loadRules,
  sha256,
  verifyMigration
} from '../../../scripts/brand-system/migration.mjs'
import { parseArgs, run } from '../../../scripts/brand-system.mjs'

const roots = []

// The existing pnpm test / CI coverage gate also checks the real migrated files.
// Fixture-only engine tests cannot catch a rule/configuration mismatch in the app.
it.each([
  't1-consumer-rules.json',
  't1-guard-rules.json',
  'l3-orders-list-typography-rules.json',
  'l3-orders-list-guard-rules.json',
  'l3-order-details-d1-typography-rules.json',
  'l3-order-details-d1-guard-rules.json',
  'l3-order-details-d2-typography-rules.json',
  'l3-order-details-d2-guard-rules.json',
  'l3-details-d3-print-typography-rules.json',
  'l3-details-d3-print-guard-rules.json',
  'l3-orders-delivery-maps-typography-rules.json',
  'l3-orders-delivery-maps-guard-rules.json',
  'l3-delivery-1-typography-rules.json',
  'l3-delivery-1-guard-rules.json',
  'l3-delivery-2-typography-rules.json',
  'l3-delivery-2-guard-rules.json',
  'l3-delivery-3-typography-rules.json',
  'l3-delivery-3-guard-rules.json',
  'l3-create-custom-order-1-typography-rules.json',
  'l3-create-custom-order-1-guard-rules.json',
  'l3-create-custom-order-2-typography-rules.json',
  'l3-create-custom-order-2-guard-rules.json',
  'l3-all-in-one-appointments-typography-rules.json',
  'l3-all-in-one-appointments-guard-rules.json'
])('keeps the checked-in pilot conformant to %s', async rulesFile => {
  const { ruleset, hash } = await loadRules(path.resolve('scripts/brand-system', rulesFile))
  const allowlist = [...new Set([...ruleset.rules, ...(ruleset.preservations ?? [])].map(rule => rule.file))]
  const result = await verifyMigration({ rootDir: process.cwd(), ruleset, rulesHash: hash, allowlist })
  expect(result.ok).toBe(true)
  expect(result.changes).toEqual([])
  expect(result.skips).toEqual([])
})

// FL-2: this one reads every source file under src/ (thousands, one await each) and verifies the ones that import
// @base-ui. That is 0.5-1.5 s alone but I/O and CPU bound, so with the whole suite running in parallel it passes the 5 s default.
// Only the limit moves: the walk and every assertion are unchanged.
it('keeps every actual source Base UI import behind the exact registered owners', async () => {
  const { ruleset: registered } = await loadRules(path.resolve('scripts/brand-system/t1-guard-rules.json'))
  const owners = new Map(registered.rules.filter(rule => rule.allowedBaseUiSources !== undefined).map(rule => [rule.file, rule.allowedBaseUiSources]))
  const entries = await fs.readdir(path.resolve('src'), { recursive: true, withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.isSymbolicLink() && (!path.extname(entry.name) || /\.(?:[cm]?js|jsx|tsx?)$/.test(entry.name))) throw new Error(`Unclassified source symlink: ${entry.name}`)
    if (!entry.isFile() || !/\.(?:[cm]?js|jsx|tsx?)$/.test(entry.name)) continue
    const absolute = path.join(entry.parentPath ?? entry.path, entry.name)
    if ((await fs.readFile(absolute, 'utf8')).includes('@base-ui')) files.push(path.relative(process.cwd(), absolute).split(path.sep).join('/'))
  }
  files.sort()
  expect(files.length).toBeGreaterThan(0)
  const boundary = {
    schemaVersion: 1,
    id: 'actual-source-base-ui-boundary',
    categories: ['pilot-guards'],
    rules: files.map((file, index) => ({ id: `source-${index}`, kind: 'pilot-guard', file, allowedBaseUiSources: owners.get(file) ?? [] })),
    preservations: []
  }
  const result = await verifyMigration({ rootDir: process.cwd(), ruleset: boundary, rulesHash: sha256(JSON.stringify(boundary)), allowlist: files })
  expect(result.ok).toBe(true)
  expect(result.skips).toEqual([])
}, 60_000)

it('keeps the exact phone input owner, facades, CSS and extracted helper guarded', async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
  const { ruleset: registered } = await loadRules(path.resolve('scripts/brand-system/t1-guard-rules.json'))
  const phoneRules = registered.rules.filter(rule => rule.id.startsWith('l2-phone-input-'))
  const phoneRuleset = ruleset(phoneRules, [], ['pilot-guards'])
  const files = [...new Set(phoneRules.map(rule => rule.file))]
  const migration = { rootDir: repositoryRoot, ruleset: phoneRuleset, rulesHash: hashRules(phoneRuleset), allowlist: files }

  const first = await createPreview(migration)
  const second = await createPreview(migration)
  expect(first).toMatchObject({ changes: [], skips: [], outputs: [] })
  expect(second).toMatchObject({ changes: [], skips: [], outputs: [] })

  const sources = Object.fromEntries(await Promise.all(files.map(async file => [file, await fs.readFile(path.join(repositoryRoot, file), 'utf8')])))
  const rootDir = await makeRoot(sources)
  const verify = () => verifyMigration({ ...migration, rootDir })
  const owner = 'src/@/components-dashboard/src/ui/src/components/Shared/UI/InputPhoneNumber.jsx'
  const facades = [
    'src/@/components-dashboard/src/ui/src/components/Shared/InputPhoneNumber/index.js',
    'src/@/components-dashboard/src/ui/src/components/Shared/InputPhoneNumber/styles.js'
  ]
  const css = 'src/@/components-dashboard/src/ui/src/components/Shared/UI/phone-input.css'
  const helper = 'src/@/components-dashboard/src/ui/src/utils/findExitingCode.js'

  await fs.writeFile(path.join(rootDir, owner), sources[owner].replace("import { NativeInput } from './Input'", "import { Input as NativeInput } from '@base-ui/react/input'"))
  expect((await verify()).skips).toContainEqual(expect.objectContaining({ file: owner, reason: 'direct-base-ui-import' }))
  await fs.writeFile(path.join(rootDir, owner), sources[owner])

  for (const facade of facades) {
    await fs.writeFile(path.join(rootDir, facade), `${sources[facade]}export { Input } from '@base-ui/react/input'\n`)
    expect((await verify()).skips).toContainEqual(expect.objectContaining({ file: facade, reason: 'direct-base-ui-import' }))
    await fs.writeFile(path.join(rootDir, facade), sources[facade])
  }

  await fs.writeFile(path.join(rootDir, css), `${sources[css]}\n@tailwind base;\n`)
  expect((await verify()).skips).toContainEqual(expect.objectContaining({ file: css, reason: 'tailwind-preflight-enabled' }))
  await fs.writeFile(path.join(rootDir, css), sources[css])

  await fs.writeFile(path.join(rootDir, helper), sources[helper].replace("(countryCode || '').toUpperCase()", "String(countryCode || '').trim().toUpperCase()"))
  expect((await verify()).skips).toContainEqual(expect.objectContaining({ file: helper, reason: 'class-recipe-binding-mismatch', expression: 'findExitingCode' }))
})

it('keeps administrator confirmation behind its exact public action owner', async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
  const { ruleset: registered } = await loadRules(path.resolve('scripts/brand-system/t1-guard-rules.json'))
  const rules = registered.rules.filter(rule => rule.id.startsWith('l2-confirm-admin-'))
  expect(rules).toHaveLength(6)
  const scoped = ruleset(rules, [], ['pilot-guards'])
  const files = rules.map(rule => rule.file)
  const migration = { rootDir: repositoryRoot, ruleset: scoped, rulesHash: hashRules(scoped), allowlist: files }
  expect(await createPreview(migration)).toMatchObject({ changes: [], skips: [], outputs: [] })
  expect(await createPreview(migration)).toMatchObject({ changes: [], skips: [], outputs: [] })
  const sources = Object.fromEntries(await Promise.all(files.map(async file => [file, await fs.readFile(path.join(repositoryRoot, file), 'utf8')])))
  const rootDir = await makeRoot(sources)
  const style = files.find(file => file.endsWith('confirm-admin-styles.js'))
  await fs.writeFile(path.join(rootDir, style), sources[style].replace('@base-ui/react/button', '@base-ui/react/internals/button'))
  expect((await verifyMigration({ ...migration, rootDir })).skips).toContainEqual(expect.objectContaining({ file: style, reason: 'direct-base-ui-import' }))
})

it('keeps sidebar surfaces and their compatible facades within the registered ownership boundary', async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
  const { ruleset: registered } = await loadRules(path.resolve('scripts/brand-system/t1-guard-rules.json'))
  const rules = registered.rules.filter(rule => /^l2-(?:sidebar-|more-sidebar-)/.test(rule.id))
  // the five l2-more-sidebar-* rules went with the dead Shared/MoreSidebarLayout (15 -> 10)
  expect(rules).toHaveLength(10)
  const scoped = ruleset(rules, [], ['pilot-guards'])
  const files = rules.map(rule => rule.file)
  const migration = { rootDir: repositoryRoot, ruleset: scoped, rulesHash: hashRules(scoped), allowlist: files }
  expect(await createPreview(migration)).toMatchObject({ changes: [], skips: [], outputs: [] })
  expect(await createPreview(migration)).toMatchObject({ changes: [], skips: [], outputs: [] })
  const sources = Object.fromEntries(await Promise.all(files.map(async file => [file, await fs.readFile(path.join(repositoryRoot, file), 'utf8')])))
  const rootDir = await makeRoot(sources)
  const owner = files.find(file => file.endsWith('/UI/SideBar.jsx'))
  await fs.writeFile(path.join(rootDir, owner), sources[owner].replace("import { IconButton } from '../../../styles/Buttons'", "import { Button as IconButton } from '@base-ui/react/button'"))
  expect((await verifyMigration({ ...migration, rootDir })).skips).toContainEqual(expect.objectContaining({ file: owner, reason: 'direct-base-ui-import' }))
})

const makeRoot = async (files) => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brand-migration-'))
  roots.push(rootDir)
  for (const [file, source] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(rootDir, file)), { recursive: true })
    await fs.writeFile(path.join(rootDir, file), source)
  }
  return rootDir
}

const ruleset = (rules, preservations = [], categories) => ({ schemaVersion: 1, id: 'fixture', rules, preservations, ...(categories && { categories }) })
const importRuleset = rules => ruleset(rules, [], ['imports'])
const typographyRuleset = (rules, preservations = []) => ruleset(rules, preservations, ['typography'])
const hashRules = (rules) => sha256(JSON.stringify(rules))
const options = (rootDir, rules, allowlist) => ({ rootDir, ruleset: rules, rulesHash: hashRules(rules), allowlist })
const applyPreview = options => applyReviewedPreview({ previewId: options.preview.id, ...options })
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : (value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
      : value)
const resealPreview = preview => {
  const { id, ...payload } = preview
  return { ...preview, id: sha256(JSON.stringify(stable(payload))) }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('brand migration contract', () => {
  it('previews and applies an isolated typography category without classifying unrelated visuals', async () => {
    const source = "import styled, { css } from 'styled-components'\nexport const Copy = styled.p`color: red; font-size: 14px; span { font-size: 14px; } ${props => props.bold && 'font-weight: 700;'} `\nexport const Conditional = styled.p`${props => props.active && css`font-size: 14px;`}`\nexport const Icon = styled.i`font-size: 16px;`\n"
    const rootDir = await makeRoot({ 'styles.js': source })
    const rules = typographyRuleset(
      [
        { id: 'copy', kind: 'static-declaration', file: 'styles.js', component: 'Copy', property: 'font-size', context: '<root>', match: '14px', replace: 'var(--od-type-content-size)' },
        { id: 'copy-child', kind: 'static-declaration', file: 'styles.js', component: 'Copy', property: 'font-size', context: 'span', match: '14px', replace: 'var(--od-type-control-size)' },
        { id: 'conditional', kind: 'static-declaration', file: 'styles.js', component: 'Conditional', property: 'font-size', context: '<root>', match: '14px', replace: 'var(--od-type-control-size)' }
      ],
      [{ id: 'icon', kind: 'static-declaration', file: 'styles.js', component: 'Icon', property: 'font-size', match: '16px', reason: 'Icon glyph geometry is not readable text.', evidence: 'The fixture preserves one exact icon declaration.' }]
    )
    const preview = await createPreview(options(rootDir, rules, ['styles.js']))

    expect(preview.changes).toHaveLength(3)
    expect(preview.skips).toEqual([])
    expect(preview.preservations).toHaveLength(1)
    await applyPreview({ rootDir, preview, allowlist: ['styles.js'] })
    const migrated = await fs.readFile(path.join(rootDir, 'styles.js'), 'utf8')
    expect(migrated).toContain('color: red; font-size: var(--od-type-content-size);')
    expect(migrated).toContain('span { font-size: var(--od-type-control-size); }')
    expect(await createPreview(options(rootDir, rules, ['styles.js']))).toMatchObject({ changes: [], skips: [], outputs: [] })
  })

  it('rejects non-typographic rules in the typography category', async () => {
    const rootDir = await makeRoot({
      'rules.json': JSON.stringify(typographyRuleset([{
        id: 'color', kind: 'static-declaration', file: 'styles.js', component: 'Copy', property: 'color', match: 'red', replace: 'blue'
      }]))
    })
    await expect(loadRules(path.join(rootDir, 'rules.json'))).rejects.toThrow('Typography category')
  })

  it('matches styled-components through an aliased import and only in the reviewed context', async () => {
    const source = 'import sc from \'styled-components\'\nexport const CTA = sc.button`color: ${p => p.theme.colors.primary || \'#266DF0\'};`\nexport const Series = sc.i`color: ${p => p.series.color || \'#266DF0\'};`\nexport const Datum = sc.i`background: ${p => p.data.color || \'#266DF0\'};`\n'
    const rootDir = await makeRoot({ 'styles.js': source })
    const rules = ruleset(
      [{ id: 'cta', kind: 'styled-expression', file: 'styles.js', component: 'CTA', property: 'color', match: "p => p.theme.colors.primary || '#266DF0'", replace: "p => p.theme.ordering?.semantic.action.default ?? (p.theme.colors.primary || '#266DF0')" }],
      [
        { id: 'series-data', kind: 'styled-expression', file: 'styles.js', component: 'Series', property: 'color', match: "p => p.series.color || '#266DF0'", reason: 'Series color is customer data.', evidence: 'The series prop supplies the dataset color.' },
        { id: 'datum-data', kind: 'styled-expression', file: 'styles.js', component: 'Datum', property: 'background', match: "p => p.data.color || '#266DF0'", reason: 'Datum color is customer data.', evidence: 'The data prop supplies the datum color.' }
      ]
    )

    const preview = await createPreview(options(rootDir, rules, ['styles.js']))

    expect(preview.changes).toHaveLength(1)
    expect(preview.changes[0]).toMatchObject({ component: 'CTA', property: 'color', rule: 'cta' })
    expect(preview.skips).toEqual([])
    expect(preview.outputs[0].diff).toContain('ordering?.semantic.action.default')
    expect(await fs.readFile(path.join(rootDir, 'styles.js'), 'utf8')).toBe(source)
  })

  it('reports dynamic expressions, competing rules, and unsupported icon transforms explicitly', async () => {
    const rootDir = await makeRoot({
      'styles.js': 'import styled from \'styled-components\'\nexport const Dynamic = styled.div`color: ${p => p.theme.colors[p.kind]};`\n',
      'view.jsx': 'export const View = () => <LegacyIcon />\n'
    })
    const rules = ruleset([
      { id: 'dynamic-a', kind: 'styled-expression', file: 'styles.js', component: 'Dynamic', property: 'color', match: 'p => p.theme.colors.primary', replace: 'p => p.theme.ordering.semantic.action.default' },
      { id: 'dynamic-b', kind: 'styled-expression', file: 'styles.js', component: 'Dynamic', property: 'color', match: 'p => p.theme.colors[p.kind]', replace: 'p => p.theme.ordering.semantic.text.default' },
      { id: 'dynamic-c', kind: 'styled-expression', file: 'styles.js', component: 'Dynamic', property: 'color', match: 'p => p.theme.colors[p.kind]', replace: 'p => p.theme.ordering.semantic.action.default' },
      { id: 'no-icon-equivalent', kind: 'jsx-icon', file: 'view.jsx', component: 'LegacyIcon', match: 'LegacyIcon', replace: null }
    ])

    const result = await inspectMigration(options(rootDir, rules, ['styles.js', 'view.jsx']))

    expect(result.skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'conflicting-rules', rules: ['dynamic-b', 'dynamic-c'] }),
      expect.objectContaining({ reason: 'unsupported-rule-kind', rule: 'no-icon-equivalent' })
    ]))
  })

  it('reports a non-matching dynamic value instead of approximating it', async () => {
    const rootDir = await makeRoot({ 'styles.js': 'import styled from \'styled-components\'\nexport const Dynamic = styled.div`color: ${p => p.theme.colors[p.kind]};`\n' })
    const rules = ruleset([{ id: 'fixed-only', kind: 'styled-expression', file: 'styles.js', component: 'Dynamic', property: 'color', match: 'p => p.theme.colors.primary', replace: 'p => p.theme.ordering.semantic.action.default' }])

    const result = await inspectMigration(options(rootDir, rules, ['styles.js']))

    expect(result.changes).toEqual([])
    expect(result.skips).toContainEqual(expect.objectContaining({ reason: 'expression-mismatch', expression: 'p => p.theme.colors[p.kind]' }))
  })

  it('rejects a stale preview after an input changes', async () => {
    const source = 'import styled from \'styled-components\'\nexport const Box = styled.div`color: ${p => p.old};`\n'
    const rootDir = await makeRoot({ 'styles.js': source })
    const rules = ruleset([{ id: 'color', kind: 'styled-expression', file: 'styles.js', component: 'Box', property: 'color', match: 'p => p.old', replace: 'p => p.next' }])
    const preview = await createPreview(options(rootDir, rules, ['styles.js']))
    await fs.appendFile(path.join(rootDir, 'styles.js'), '// concurrent edit\n')

    await expect(applyPreview({ rootDir, preview, allowlist: ['styles.js'] })).rejects.toThrow('Stale preview input')
  })

  it('rolls every file back when a failure happens after the first write', async () => {
    const first = 'import styled from \'styled-components\'\nexport const A = styled.div`color: ${p => p.old};`\n'
    const second = 'import styled from \'styled-components\'\nexport const B = styled.div`color: ${p => p.old};`\n'
    const rootDir = await makeRoot({ 'a.js': first, 'b.js': second })
    const rules = ruleset([
      { id: 'a', kind: 'styled-expression', file: 'a.js', component: 'A', property: 'color', match: 'p => p.old', replace: 'p => p.next' },
      { id: 'b', kind: 'styled-expression', file: 'b.js', component: 'B', property: 'color', match: 'p => p.old', replace: 'p => p.next' }
    ])
    const preview = await createPreview(options(rootDir, rules, ['a.js', 'b.js']))

    await expect(applyPreview({ rootDir, preview, allowlist: ['a.js', 'b.js'], failAfterWrites: 1 })).rejects.toThrow('Injected mid-write failure')
    expect(await fs.readFile(path.join(rootDir, 'a.js'), 'utf8')).toBe(first)
    expect(await fs.readFile(path.join(rootDir, 'b.js'), 'utf8')).toBe(second)
  })

  it('is deterministic and produces no second-pass diff', async () => {
    const rootDir = await makeRoot({ 'styles.js': 'import styled from \'styled-components\'\nexport const Box = styled.div`color: ${p => p.old};`\n' })
    const rules = ruleset([{ id: 'color', kind: 'styled-expression', file: 'styles.js', component: 'Box', property: 'color', match: 'p => p.old', replace: 'p => p.next' }])
    const migration = options(rootDir, rules, ['styles.js'])
    const preview = await createPreview(migration)

    await applyPreview({ rootDir, preview, allowlist: ['styles.js'] })
    const second = await createPreview(migration)

    expect(second.changes).toEqual([])
    expect(second.outputs).toEqual([])
    expect(second.skips).toEqual([])
  })

  it('rewrites selected mixed import specifiers and preserves aliases, comments, and unrelated bindings', async () => {
    const source = '// keep file comment\nimport BootstrapDefault, { X as CloseIcon, /* search icon */ Search, Keep /* keep binding */ } from \'react-bootstrap-icons\' // keep source comment\nimport { Menu } from \'lucide-react\' // keep target comment\nexport const View = () => <><BootstrapDefault /><CloseIcon /><Search /><Keep /><Menu /></>\n'
    const rootDir = await makeRoot({ 'view.jsx': source })
    const rules = importRuleset([
      { id: 'close', kind: 'import-specifier', file: 'view.jsx', source: 'react-bootstrap-icons', imported: 'X', local: 'CloseIcon', targetSource: 'lucide-react', targetImported: 'X' },
      { id: 'search', kind: 'import-specifier', file: 'view.jsx', source: 'react-bootstrap-icons', imported: 'Search', local: 'Search', targetSource: 'lucide-react', targetImported: 'Search' }
    ])
    const migration = options(rootDir, rules, ['view.jsx'])
    const preview = await createPreview(migration)

    expect(preview.skips).toEqual([])
    expect(preview.changes).toHaveLength(2)
    await applyPreview({ rootDir, preview, allowlist: ['view.jsx'] })
    expect(await fs.readFile(path.join(rootDir, 'view.jsx'), 'utf8')).toBe('// keep file comment\nimport BootstrapDefault, { Keep /* keep binding */ } from \'react-bootstrap-icons\' // keep source comment\nimport { Menu, /* search icon */ Search, X as CloseIcon } from \'lucide-react\' // keep target comment\nexport const View = () => <><BootstrapDefault /><CloseIcon /><Search /><Keep /><Menu /></>\n')
  })

  it('migrates a deep default import without changing its local binding and is idempotent', async () => {
    const source = '// close control\nimport MdClose from \'@meronex/icons/ios/MdClose\'\nexport const View = () => <MdClose aria-label="close" />\n'
    const rootDir = await makeRoot({ 'view.jsx': source })
    const rules = importRuleset([
      { id: 'close', kind: 'import-specifier', file: 'view.jsx', source: '@meronex/icons/ios/MdClose', imported: 'default', local: 'MdClose', targetSource: 'lucide-react', targetImported: 'X' }
    ])
    const migration = options(rootDir, rules, ['view.jsx'])
    const preview = await createPreview(migration)

    expect(preview.skips).toEqual([])
    await applyPreview({ rootDir, preview, allowlist: ['view.jsx'] })
    expect(await fs.readFile(path.join(rootDir, 'view.jsx'), 'utf8')).toBe('// close control\nimport { X as MdClose } from \'lucide-react\'\nexport const View = () => <MdClose aria-label="close" />\n')
    expect(await createPreview(migration)).toMatchObject({ changes: [], skips: [], outputs: [] })
  })

  it('guards opted-in consumer binding usage without rewriting JSX', async () => {
    const source = 'import { Button } from \'legacy-ui\'\nexport const View = () => <Button type="button">Go</Button>\n'
    const rootDir = await makeRoot({ 'view.jsx': source })
    const rules = importRuleset([{
      id: 'button',
      kind: 'import-specifier',
      file: 'view.jsx',
      source: 'legacy-ui',
      imported: 'Button',
      local: 'Button',
      targetSource: 'new-ui',
      targetImported: 'Button',
      consumerUsage: { allowed: ['jsx-element'], min: 2, max: 2 }
    }])
    const migration = options(rootDir, rules, ['view.jsx'])
    const preview = await createPreview(migration)

    expect(preview.skips).toEqual([])
    expect(preview.consumerUsages).toContainEqual(expect.objectContaining({
      rule: 'button',
      total: 2,
      kinds: { 'jsx-element': 2 }
    }))
    await applyPreview({ rootDir, preview, allowlist: ['view.jsx'] })
    expect(await fs.readFile(path.join(rootDir, 'view.jsx'), 'utf8')).toContain('<Button type="button">Go</Button>')
    expect((await verifyMigration(migration)).ok).toBe(true)
  })

  it('fails closed when an opted-in consumer uses a binding through styled()', async () => {
    const tick = String.fromCharCode(96)
    const source = `import styled from 'styled-components'\nimport { Button } from 'legacy-ui'\nexport const Extended = styled(Button)${tick}color:red;${tick}\n`
    const rootDir = await makeRoot({ 'view.jsx': source })
    const rules = importRuleset([{
      id: 'button',
      kind: 'import-specifier',
      file: 'view.jsx',
      source: 'legacy-ui',
      imported: 'Button',
      local: 'Button',
      targetSource: 'new-ui',
      targetImported: 'Button',
      consumerUsage: { allowed: ['jsx-element'], min: 1 }
    }])
    const preview = await createPreview(options(rootDir, rules, ['view.jsx']))

    expect(preview.changes).toEqual([])
    expect(preview.skips).toContainEqual(expect.objectContaining({ reason: 'consumer-usage-mismatch' }))
    expect(preview.consumerUsages).toContainEqual(expect.objectContaining({ kinds: { 'styled-component': 1 } }))
  })

  it('escapes a generated target module literal without changing the binding', async () => {
    const source = 'import CloseIcon from \'legacy-close\'\nexport const View = CloseIcon\n'
    const rootDir = await makeRoot({ 'view.js': source })
    const rules = importRuleset([
      { id: 'quoted-source', kind: 'import-specifier', file: 'view.js', source: 'legacy-close', imported: 'default', local: 'CloseIcon', targetSource: "icons'quoted", targetImported: 'X' }
    ])
    const preview = await createPreview(options(rootDir, rules, ['view.js']))

    expect(preview.skips).toEqual([])
    await applyPreview({ rootDir, preview, allowlist: ['view.js'] })
    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toBe('import { X as CloseIcon } from \'icons\\\'quoted\'\nexport const View = CloseIcon\n')
  })

  it('verifies aliased consumer usage before and after migration without counting shadowed bindings', async () => {
    const source = "import { OldIcon as LocalIcon } from 'legacy-icons'\nexport const View = () => <LocalIcon />\nexport const Shadow = ({ LocalIcon }) => <LocalIcon />\n"
    const rootDir = await makeRoot({ 'view.jsx': source })
    const rules = importRuleset([
      { id: 'icon', kind: 'import-specifier', file: 'view.jsx', source: 'legacy-icons', imported: 'OldIcon', local: 'LocalIcon', targetSource: 'owned-icons', targetImported: 'NewIcon', consumerUsage: { allowed: ['jsx-element'], min: 1, max: 1 } }
    ])
    const migration = options(rootDir, rules, ['view.jsx'])
    const preview = await createPreview(migration)
    expect(preview.skips).toEqual([])
    expect(preview.changes).toHaveLength(1)
    await applyPreview({ rootDir, preview, allowlist: ['view.jsx'] })
    expect((await verifyMigration(migration)).ok).toBe(true)
    expect(await createPreview(migration)).toMatchObject({ changes: [], skips: [], outputs: [] })
  })

  it('supports the same target export under distinct preserved local aliases', async () => {
    const source = 'import { X as CloseIcon } from \'react-bootstrap-icons\'\nimport { X as RemoveIcon } from \'lucide-react\'\nexport const View = () => [CloseIcon, RemoveIcon]\n'
    const rootDir = await makeRoot({ 'view.js': source })
    const rules = importRuleset([
      { id: 'close', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'CloseIcon', targetSource: 'lucide-react', targetImported: 'X' }
    ])
    const preview = await createPreview(options(rootDir, rules, ['view.js']))

    expect(preview.skips).toEqual([])
    await applyPreview({ rootDir, preview, allowlist: ['view.js'] })
    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toBe('import { X as RemoveIcon, X as CloseIcon } from \'lucide-react\'\nexport const View = () => [CloseIcon, RemoveIcon]\n')
  })

  it.each([
    'import { Search, Keep } from \'legacy-icons\' with { mode: \'strict\' }\n',
    'import { Search } from \'legacy-icons\'\nimport { Keep } from \'lucide-react\' with { mode: \'strict\' }\n'
  ])('fails closed for source or target import metadata that cannot be regenerated', async (source) => {
    const rootDir = await makeRoot({ 'view.js': source })
    const rules = importRuleset([
      { id: 'search', kind: 'import-specifier', file: 'view.js', source: 'legacy-icons', imported: 'Search', local: 'Search', targetSource: 'lucide-react', targetImported: 'Search' }
    ])
    const preview = await createPreview(options(rootDir, rules, ['view.js']))

    expect(preview.changes).toEqual([])
    expect(preview.outputs).toEqual([])
    expect(preview.skips).toContainEqual(expect.objectContaining({ reason: 'unsupported-import-metadata' }))
    await expect(applyPreview({ rootDir, preview, allowlist: ['view.js'] })).rejects.toThrow('unresolved skips')
    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toBe(source)
  })

  it('inserts a target after an eslint line comment on a semicolon mixed import', async () => {
    const source = 'import DefaultIcon, { Keep } from \'legacy-icons\'; // eslint-disable-line keep legacy import\nexport const View = () => [DefaultIcon, Keep]\n'
    const rootDir = await makeRoot({ 'view.js': source })
    const rules = importRuleset([
      { id: 'default-icon', kind: 'import-specifier', file: 'view.js', source: 'legacy-icons', imported: 'default', local: 'DefaultIcon', targetSource: 'lucide-react', targetImported: 'X' }
    ])
    const migration = options(rootDir, rules, ['view.js'])
    const preview = await createPreview(migration)

    expect(preview.skips).toEqual([])
    await applyPreview({ rootDir, preview, allowlist: ['view.js'] })
    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toBe('import { Keep } from \'legacy-icons\'; // eslint-disable-line keep legacy import\nimport { X as DefaultIcon } from \'lucide-react\'\nexport const View = () => [DefaultIcon, Keep]\n')
    expect(await createPreview(migration)).toMatchObject({ changes: [], skips: [], outputs: [] })
  })

  it('limits an imports category run to explicit bindings without classifying styled CSS', async () => {
    const source = 'import { Search, Keep } from \'react-bootstrap-icons\'\nimport styled from \'styled-components\'\nexport const Box = styled.div`color: /*`\nexport const View = () => <><Search /><Keep /></>\n'
    const rootDir = await makeRoot({ 'view.jsx': source })
    const rules = importRuleset([
      { id: 'search', kind: 'import-specifier', file: 'view.jsx', source: 'react-bootstrap-icons', imported: 'Search', local: 'Search', targetSource: 'lucide-react', targetImported: 'Search' }
    ])
    const preview = await createPreview(options(rootDir, rules, ['view.jsx']))

    expect(preview.skips).toEqual([])
    expect(preview.changes).toHaveLength(2)
    expect(preview.categories).toEqual(['imports'])
    expect(preview.changes.every(change => !change.before.includes('color: /*'))).toBe(true)
    await applyPreview({ rootDir, preview, allowlist: ['view.jsx'] })
    expect(await fs.readFile(path.join(rootDir, 'view.jsx'), 'utf8')).toContain('styled.div`color: /*`')
  })

  it('requires the imports category and a complete import-specifier schema when loading rules', async () => {
    const rule = { id: 'search', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'Search', local: 'Search', targetSource: 'lucide-react', targetImported: 'Search' }
    const rootDir = await makeRoot({
      'valid.json': JSON.stringify(importRuleset([rule])),
      'missing-category.json': JSON.stringify(ruleset([rule])),
      'mixed-category.json': JSON.stringify(ruleset([rule, { id: 'style', kind: 'static-declaration', file: 'view.js', component: 'Box', property: 'color', match: 'red', replace: 'blue' }], [], ['imports'])),
      'invalid-target.json': JSON.stringify(importRuleset([{ ...rule, targetImported: 'default' }])),
      'invalid-identifier.json': JSON.stringify(importRuleset([{ ...rule, local: 'not-valid!' }]))
    })

    await expect(loadRules(path.join(rootDir, 'valid.json'))).resolves.toMatchObject({ ruleset: { categories: ['imports'] } })
    await expect(loadRules(path.join(rootDir, 'missing-category.json'))).rejects.toThrow('require the imports category')
    await expect(loadRules(path.join(rootDir, 'mixed-category.json'))).rejects.toThrow('accepts only import-specifier')
    await expect(loadRules(path.join(rootDir, 'invalid-target.json'))).rejects.toThrow('Invalid import-specifier')
    await expect(loadRules(path.join(rootDir, 'invalid-identifier.json'))).rejects.toThrow('Invalid import-specifier')
  })

  it.each([
    {
      name: 'missing binding',
      source: 'import { Keep } from \'react-bootstrap-icons\'\n',
      rules: [{ id: 'missing', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'X', targetSource: 'lucide-react', targetImported: 'X' }],
      reason: 'import-binding-not-found'
    },
    {
      name: 'namespace import',
      source: 'import * as Icons from \'react-bootstrap-icons\'\n',
      rules: [{ id: 'namespace', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'X', targetSource: 'lucide-react', targetImported: 'X' }],
      reason: 'namespace-import-unsupported'
    },
    {
      name: 'ambiguous target declarations',
      source: 'import { X as CloseIcon } from \'react-bootstrap-icons\'\nimport { Menu } from \'lucide-react\'\nimport { Search } from \'lucide-react\'\n',
      rules: [{ id: 'collision', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'CloseIcon', targetSource: 'lucide-react', targetImported: 'X' }],
      reason: 'ambiguous-target-import'
    },
    {
      name: 'string-named target specifier',
      source: 'import { X as CloseIcon } from \'react-bootstrap-icons\'\nimport { \'x-y\' as Exotic } from \'lucide-react\'\n',
      rules: [{ id: 'string-name', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'CloseIcon', targetSource: 'lucide-react', targetImported: 'X' }],
      reason: 'unsupported-import-specifier'
    },
    {
      name: 'competing rules',
      source: 'import { X as CloseIcon } from \'react-bootstrap-icons\'\n',
      rules: [
        { id: 'first', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'CloseIcon', targetSource: 'lucide-react', targetImported: 'X' },
        { id: 'second', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'CloseIcon', targetSource: 'lucide-react', targetImported: 'CircleX' }
      ],
      reason: 'conflicting-import-rules'
    }
  ])('aborts an imports preview for $name', async ({ source, rules, reason }) => {
    const rootDir = await makeRoot({ 'view.js': source })
    const migration = options(rootDir, importRuleset(rules), ['view.js'])
    const preview = await createPreview(migration)

    expect(preview.changes).toEqual([])
    expect(preview.skips).toContainEqual(expect.objectContaining({ reason }))
    await expect(applyPreview({ rootDir, preview, allowlist: ['view.js'] })).rejects.toThrow('unresolved skips')
    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toBe(source)
  })

  it.each([
    'import { X, // keep line comment\nKeep } from \'react-bootstrap-icons\'\n',
    'import { X } from /* keep source comment */ \'react-bootstrap-icons\'\n'
  ])('fails closed when an affected import contains a comment that cannot be safely regenerated', async (source) => {
    const rootDir = await makeRoot({ 'view.js': source })
    const rules = importRuleset([
      { id: 'close', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'X', targetSource: 'lucide-react', targetImported: 'X' }
    ])
    const preview = await createPreview(options(rootDir, rules, ['view.js']))

    expect(preview.changes).toEqual([])
    expect(preview.skips).toContainEqual(expect.objectContaining({ reason: 'unsupported-import-comments' }))
    await expect(applyPreview({ rootDir, preview, allowlist: ['view.js'] })).rejects.toThrow('unresolved skips')
    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toBe(source)
  })

  it('rejects invalid direct-rule identifiers and module specifiers without a preview change', async () => {
    const source = 'import { X } from \'react-bootstrap-icons\'\n'
    const rootDir = await makeRoot({ 'view.js': source })
    const invalidRules = [
      { id: 'identifier', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'not-valid!', targetSource: 'lucide-react', targetImported: 'X' },
      { id: 'module', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'X', targetSource: 'bad\nmodule', targetImported: 'X' }
    ]

    for (const rule of invalidRules) {
      const preview = await createPreview(options(rootDir, importRuleset([rule]), ['view.js']))
      expect(preview.changes).toEqual([])
      expect(preview.skips).toContainEqual(expect.objectContaining({ reason: 'invalid-import-rule' }))
      await expect(applyPreview({ rootDir, preview, allowlist: ['view.js'] })).rejects.toThrow('unresolved skips')
    }
    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toBe(source)
  })

  it('rejects a syntactically conflicting source and target binding before preview', async () => {
    const source = 'import { X as CloseIcon } from \'react-bootstrap-icons\'\nimport { X as CloseIcon } from \'lucide-react\'\n'
    const rootDir = await makeRoot({ 'view.js': source })
    const rules = importRuleset([
      { id: 'mixed-state', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'CloseIcon', targetSource: 'lucide-react', targetImported: 'X' }
    ])

    await expect(createPreview(options(rootDir, rules, ['view.js']))).rejects.toThrow('already been declared')
    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toBe(source)
  })

  it('aborts chained rules that would rewrite the same import declaration twice', async () => {
    const source = 'import { X as CloseIcon } from \'react-bootstrap-icons\'\nimport { Search as SearchIcon } from \'lucide-react\'\nexport const View = () => [CloseIcon, SearchIcon]\n'
    const rootDir = await makeRoot({ 'view.js': source })
    const rules = importRuleset([
      { id: 'close', kind: 'import-specifier', file: 'view.js', source: 'react-bootstrap-icons', imported: 'X', local: 'CloseIcon', targetSource: 'lucide-react', targetImported: 'X' },
      { id: 'search', kind: 'import-specifier', file: 'view.js', source: 'lucide-react', imported: 'Search', local: 'SearchIcon', targetSource: '@app/icons', targetImported: 'Search' }
    ])
    const preview = await createPreview(options(rootDir, rules, ['view.js']))

    expect(preview.changes).toEqual([])
    expect(preview.skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'overlapping-import-declarations', rule: 'close' }),
      expect.objectContaining({ reason: 'overlapping-import-declarations', rule: 'search' })
    ]))
    await expect(applyPreview({ rootDir, preview, allowlist: ['view.js'] })).rejects.toThrow('unresolved skips')
    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toBe(source)
  })

  it('rolls back import migrations after a mid-transaction failure', async () => {
    const first = 'import { X as CloseIcon } from \'react-bootstrap-icons\'\nexport const A = CloseIcon\n'
    const second = 'import SearchIcon from \'@meronex/icons/go/GoSearch\'\nexport const B = SearchIcon\n'
    const rootDir = await makeRoot({ 'a.js': first, 'b.js': second })
    const rules = importRuleset([
      { id: 'close', kind: 'import-specifier', file: 'a.js', source: 'react-bootstrap-icons', imported: 'X', local: 'CloseIcon', targetSource: 'lucide-react', targetImported: 'X' },
      { id: 'search', kind: 'import-specifier', file: 'b.js', source: '@meronex/icons/go/GoSearch', imported: 'default', local: 'SearchIcon', targetSource: 'lucide-react', targetImported: 'Search' }
    ])
    const preview = await createPreview(options(rootDir, rules, ['a.js', 'b.js']))

    expect(preview.skips).toEqual([])
    await expect(applyPreview({ rootDir, preview, allowlist: ['a.js', 'b.js'], failAfterWrites: 1 })).rejects.toThrow('Injected mid-write failure')
    expect(await fs.readFile(path.join(rootDir, 'a.js'), 'utf8')).toBe(first)
    expect(await fs.readFile(path.join(rootDir, 'b.js'), 'utf8')).toBe(second)
  })

  it('does not emit a partial imports preview when another allowlisted file is unresolved', async () => {
    const first = 'import { X as CloseIcon } from \'react-bootstrap-icons\'\n'
    const second = 'import { Keep } from \'react-bootstrap-icons\'\n'
    const rootDir = await makeRoot({ 'a.js': first, 'b.js': second })
    const rules = importRuleset([
      { id: 'close', kind: 'import-specifier', file: 'a.js', source: 'react-bootstrap-icons', imported: 'X', local: 'CloseIcon', targetSource: 'lucide-react', targetImported: 'X' },
      { id: 'missing', kind: 'import-specifier', file: 'b.js', source: 'react-bootstrap-icons', imported: 'Search', local: 'Search', targetSource: 'lucide-react', targetImported: 'Search' }
    ])
    const preview = await createPreview(options(rootDir, rules, ['a.js', 'b.js']))

    expect(preview.changes).toEqual([])
    expect(preview.outputs).toEqual([])
    expect(preview.skips).toContainEqual(expect.objectContaining({ rule: 'missing', reason: 'import-binding-not-found' }))
    await expect(applyPreview({ rootDir, preview, allowlist: ['a.js', 'b.js'] })).rejects.toThrow('unresolved skips')
    expect(await fs.readFile(path.join(rootDir, 'a.js'), 'utf8')).toBe(first)
    expect(await fs.readFile(path.join(rootDir, 'b.js'), 'utf8')).toBe(second)
  })

  it('fails verification for seeded debt and accepts an exact evidenced preservation', async () => {
    const source = 'import styled from \'styled-components\'\nexport const Chart = styled.div`color: ${p => p.series.color || \'#266DF0\'};`\n'
    const rootDir = await makeRoot({ 'styles.js': source })
    const violation = ruleset([{ id: 'series-wrongly-action', kind: 'styled-expression', file: 'styles.js', component: 'Chart', property: 'color', match: "p => p.series.color || '#266DF0'", replace: 'p => p.theme.ordering.semantic.action.default' }])
    const preserved = ruleset([], [{ id: 'series-data', kind: 'styled-expression', file: 'styles.js', component: 'Chart', property: 'color', match: "p => p.series.color || '#266DF0'", reason: 'Series color represents customer data.', evidence: 'Chart API fixture binds this expression to dataset.color.' }])

    expect((await verifyMigration(options(rootDir, violation, ['styles.js']))).ok).toBe(false)
    const result = await verifyMigration(options(rootDir, preserved, ['styles.js']))
    expect(result.ok).toBe(true)
    expect(result.preservations).toContainEqual(expect.objectContaining({ rule: 'series-data', reason: 'Series color represents customer data.' }))
  })

  it('reports unclassified literal CSS and accepts only an exact local preservation', async () => {
    const rootDir = await makeRoot({ 'styles.js': 'import styled from \'styled-components\'\nexport const Card = styled.div`border-radius: 9px;`\n' })
    const unclassified = ruleset([])
    const preserved = ruleset([], [{ id: 'card-radius', kind: 'static-declaration', file: 'styles.js', component: 'Card', property: 'border-radius', match: '9px', reason: 'Fixture geometry is contractual.', evidence: 'The fixture asserts the exact radius.' }])

    const finding = await verifyMigration(options(rootDir, unclassified, ['styles.js']))
    expect(finding.ok).toBe(false)
    expect(finding.skips).toContainEqual(expect.objectContaining({ reason: 'unclassified-static-declaration', expression: '9px' }))
    expect((await verifyMigration(options(rootDir, preserved, ['styles.js']))).ok).toBe(true)
  })

  it('parses consecutive and commented declarations without skipping alternating values', async () => {
    const rootDir = await makeRoot({ 'styles.js': 'import styled from \'styled-components\'\nexport const Card = styled.div`color:red;/* keep */background:"blue;still";border-radius:9px`\n' })

    const result = await inspectMigration(options(rootDir, ruleset([]), ['styles.js']))

    expect(result.skips.map(item => [item.property, item.expression])).toEqual([
      ['color', 'red'],
      ['background', '"blue;still"'],
      ['border-radius', '9px']
    ])
  })

  it('keeps Babel and PostCSS offsets aligned after Unicode and block interpolations', async () => {
    const source = 'import styled, { css } from \'styled-components\'\n// café 🚀\nexport const Card = styled.div`padding:4px;${p => p.rtl && css`margin: 2px;`}color:${p => p.old};`\n'
    const rootDir = await makeRoot({ 'styles.js': source })
    const rules = ruleset(
      [{ id: 'color', kind: 'styled-expression', file: 'styles.js', component: 'Card', property: 'color', match: 'p => p.old', replace: 'p => p.next' }],
      [
        { id: 'padding', kind: 'static-declaration', file: 'styles.js', component: 'Card', property: 'padding', match: '4px', reason: 'Fixture spacing stays fixed.', evidence: 'Exact fixture contract.' },
        { id: 'rtl-branch', kind: 'styled-expression', file: 'styles.js', component: 'Card', property: null, match: 'p => p.rtl && css`margin: 2px;`', reason: 'RTL condition stays intact.', evidence: 'Nested declaration is inspected independently.' },
        { id: 'rtl-margin', kind: 'static-declaration', file: 'styles.js', component: 'Card', property: 'margin', match: '2px', reason: 'Fixture spacing stays fixed.', evidence: 'Exact fixture contract.' }
      ]
    )
    const preview = await createPreview(options(rootDir, rules, ['styles.js']))

    expect(preview.skips).toEqual([])
    await applyPreview({ rootDir, preview, allowlist: ['styles.js'] })
    expect(await fs.readFile(path.join(rootDir, 'styles.js'), 'utf8')).toBe(source.replace('p => p.old', 'p => p.next'))
  })

  it('blocks protected outputs and symlinks that escape the repository', async () => {
    const outside = await makeRoot({ 'outside.js': 'import styled from \'styled-components\'\nexport const Box = styled.div`color: ${p => p.old};`\n' })
    const rootDir = await makeRoot({ 'dist/bundle.js': 'import styled from \'styled-components\'\nexport const Box = styled.div`color: ${p => p.old};`\n' })
    await fs.symlink(path.join(outside, 'outside.js'), path.join(rootDir, 'escape.js'))
    const rule = { id: 'color', kind: 'styled-expression', component: 'Box', property: 'color', match: 'p => p.old', replace: 'p => p.next' }
    const protectedRules = ruleset([{ ...rule, file: 'dist/bundle.js' }])
    const protectedPreview = await createPreview(options(rootDir, protectedRules, ['dist/bundle.js']))

    await expect(applyPreview({ rootDir, preview: protectedPreview, allowlist: ['dist/bundle.js'] })).rejects.toThrow('Protected path')
    await expect(inspectMigration(options(rootDir, ruleset([{ ...rule, file: 'escape.js' }]), ['escape.js']))).rejects.toThrow('outside the repository')
  })

  it('validates styled CSS before writing any preview output', async () => {
    const source = 'import styled from \'styled-components\'\nexport const Box = styled.div`color:red;`\n'
    const rootDir = await makeRoot({ 'styles.js': source })
    const rules = ruleset([{ id: 'invalid-css', kind: 'static-declaration', file: 'styles.js', component: 'Box', property: 'color', match: 'red', replace: '/*' }])
    const preview = await createPreview(options(rootDir, rules, ['styles.js']))

    await expect(applyPreview({ rootDir, preview, allowlist: ['styles.js'] })).rejects.toThrow('Invalid styled CSS output')
    expect(await fs.readFile(path.join(rootDir, 'styles.js'), 'utf8')).toBe(source)
  })

  it('requires the externally reviewed preview identifier and reproduces its diff', async () => {
    const source = 'import Old from \'legacy-ui\'\nexport const View = Old\n'
    const rootDir = await makeRoot({ 'view.js': source })
    const rules = importRuleset([{
      id: 'move',
      kind: 'import-specifier',
      file: 'view.js',
      source: 'legacy-ui',
      imported: 'default',
      local: 'Old',
      targetSource: 'new-ui',
      targetImported: 'New'
    }])
    const preview = await createPreview(options(rootDir, rules, ['view.js']))

    await expect(applyReviewedPreview({ rootDir, preview, allowlist: ['view.js'] })).rejects.toThrow('reviewed identifier')
    await expect(applyReviewedPreview({ rootDir, preview, previewId: 'not-reviewed', allowlist: ['view.js'] })).rejects.toThrow('reviewed identifier')

    const misleading = structuredClone(preview)
    misleading.outputs[0].diff = misleading.outputs[0].diff.replace('new-ui', 'reviewed-ui')
    const resealed = resealPreview(misleading)
    await expect(applyReviewedPreview({ rootDir, preview: resealed, previewId: resealed.id, allowlist: ['view.js'] })).rejects.toThrow('do not reproduce')
    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toBe(source)
  })

  it('preserves file mode when applying a reviewed preview', async () => {
    const source = 'import Old from \'legacy-ui\'\n'
    const rootDir = await makeRoot({ 'view.js': source })
    const target = path.join(rootDir, 'view.js')
    await fs.chmod(target, 0o755)
    const rules = importRuleset([{
      id: 'move',
      kind: 'import-specifier',
      file: 'view.js',
      source: 'legacy-ui',
      imported: 'default',
      local: 'Old',
      targetSource: 'new-ui',
      targetImported: 'New'
    }])
    const preview = await createPreview(options(rootDir, rules, ['view.js']))

    await applyPreview({ rootDir, preview, allowlist: ['view.js'] })
    expect((await fs.stat(target)).mode & 0o777).toBe(0o755)
  })

  it('rejects TypeScript explicitly instead of advertising an unsupported parser', async () => {
    const rootDir = await makeRoot({
      'view.tsx': 'type Props = { label: string }\nexport const View = ({ label }: Props) => <span>{label}</span>\n'
    })
    const result = await inspectMigration(options(rootDir, ruleset([]), ['view.tsx']))

    expect(result.changes).toEqual([])
    expect(result.skips).toContainEqual(expect.objectContaining({ reason: 'unsupported-format', detail: '.tsx' }))
  })

  it('rejects unsupported preservation kinds instead of silently certifying them', async () => {
    const rootDir = await makeRoot({
      'view.jsx': 'export const View = () => <LegacyIcon />\n',
      'rules.json': JSON.stringify(ruleset([], [{
        id: 'legacy-icon',
        file: 'view.jsx',
        kind: 'jsx-icon',
        reason: 'The fixture keeps this icon.',
        evidence: 'The JSX fixture contains it.'
      }]))
    })

    await expect(loadRules(path.join(rootDir, 'rules.json'))).rejects.toThrow('Unsupported migration preservation kind')
  })

  it('passes exact pilot guards and records a localized dynamic className preservation', async () => {
    const rootDir = await makeRoot({
      'Wrapper.jsx': 'import { Select } from \'@base-ui/react/select\'\nexport const Wrapper = ({ className }) => <Select.Root className={cn(\'od-flex hover:od-bg-action\', className)} />\n',
      'Consumer.jsx': 'import { Select } from \'./Wrapper\'\nexport const Consumer = () => <Select />\n',
      'tailwind.config.cjs': 'const tokens = {}\nmodule.exports = { prefix: \'od-\', content: [\'./Wrapper.jsx\', \'./Consumer.jsx\'], corePlugins: { preflight: false }, theme: { colors: Object.fromEntries([]), spacing: { ...tokens } } }\n',
      'pilot.css': '@tailwind components;\n@tailwind utilities;\n.od-ui { @apply od-flex; }\n'
    })
    const guardRules = ruleset([
      {
        id: 'wrapper',
        kind: 'pilot-guard',
        file: 'Wrapper.jsx',
        allowedBaseUiSources: ['@base-ui/react/select'],
        classNamePolicy: { prefix: 'od-', allow: [] },
        dynamicClassNames: [{ match: "cn('od-flex hover:od-bg-action', className)", reason: 'The wrapper forwards its className.', evidence: 'The wrapper contract test checks the merged class list.' }]
      },
      { id: 'consumer', kind: 'pilot-guard', file: 'Consumer.jsx', allowedBaseUiSources: [] },
      { id: 'config', kind: 'pilot-guard', file: 'tailwind.config.cjs', tailwindConfig: { prefix: 'od-', content: ['./Wrapper.jsx', './Consumer.jsx'], preflight: false } },
      { id: 'css', kind: 'pilot-guard', file: 'pilot.css', forbidTailwindBase: true, tailwindCssPolicy: { prefix: 'od-' } }
    ], [], ['pilot-guards'])

    const result = await verifyMigration(options(rootDir, guardRules, ['Wrapper.jsx', 'Consumer.jsx', 'tailwind.config.cjs', 'pilot.css']))

    expect(result.ok).toBe(true)
    expect(result.preservations).toContainEqual(expect.objectContaining({
      expression: "cn('od-flex hover:od-bg-action', className)",
      reason: 'The wrapper forwards its className.'
    }))
  })

  it('guards operational typography roles across styled, inline and class declarations', async () => {
    const source = `import styled from 'styled-components'
export const Copy = styled.p\`font-size: var(--od-type-content-size);\`
export const IconGeometry = styled.span\`font-size: 16px;\`
export const View = () => <span className='od-text-[15px]' style={{ fontSize: '14px', font: '12px sans-serif' }}>Copy</span>
`
    const rootDir = await makeRoot({ 'surface.jsx': source })
    const policy = {
      roles: ['control', 'content'],
      exceptions: [{
        component: 'IconGeometry',
        property: 'font-size',
        match: '16px',
        context: '<root>',
        count: 1,
        reason: 'The font-size controls an inherited icon glyph box, not readable text.',
        evidence: 'The fixture keeps this exact icon geometry as a negative false-positive case.'
      }]
    }
    const guardRules = ruleset([{ id: 'typography', kind: 'pilot-guard', file: 'surface.jsx', typographyPolicy: policy }], [], ['pilot-guards'])
    const result = await verifyMigration(options(rootDir, guardRules, ['surface.jsx']))

    expect(result.ok).toBe(false)
    expect(result.preservations).toContainEqual(expect.objectContaining({ expression: '16px', reason: policy.exceptions[0].reason }))
    expect(result.skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ component: 'className', expression: 'od-text-[15px]', reason: 'local-typography-size' }),
      expect.objectContaining({ component: 'inline-style', property: 'fontSize', expression: "'14px'", reason: 'local-typography-size' }),
      expect.objectContaining({ component: 'inline-style', property: 'font', expression: "'12px sans-serif'", reason: 'local-typography-size' })
    ]))

    await fs.writeFile(path.join(rootDir, 'surface.jsx'), source
      .replace("className='od-text-[15px]' ", '')
      .replace("fontSize: '14px', font: '12px sans-serif'", "fontSize: 'var(--od-type-control-size)'")
    )
    expect((await verifyMigration(options(rootDir, guardRules, ['surface.jsx']))).ok).toBe(true)
  })

  it('guards typography inside styled intrinsic and component attrs chains', async () => {
    const source = `import styled from 'styled-components'
const Base = props => <button {...props} />
export const Intrinsic = styled.button.attrs({ type: 'button' })\`font-size: 15px;\`
export const Component = styled(Base).attrs({ type: 'button' })\`font-size: 16px;\`
`
    const rootDir = await makeRoot({ 'attrs.jsx': source })
    const guardRules = ruleset([{
      id: 'attrs-typography',
      kind: 'pilot-guard',
      file: 'attrs.jsx',
      typographyPolicy: { roles: ['control'], exceptions: [] }
    }], [], ['pilot-guards'])
    const result = await verifyMigration(options(rootDir, guardRules, ['attrs.jsx']))

    expect(result.skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ component: 'Intrinsic', expression: '15px', reason: 'local-typography-size' }),
      expect.objectContaining({ component: 'Component', expression: '16px', reason: 'local-typography-size' })
    ]))
  })

  it('guards semantic colors while preserving one exact data-driven value', async () => {
    const source = `import styled from 'styled-components'
const recipe = 'color: #ff00ff;'
export const Governed = styled.div\`color: \${props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor};\`
export const Raw = styled.div\`background: #fff;\`
export const Datum = styled.div\`color: \${props => props.data.color};\`
export const Logical = styled.div\`border-inline-start: 1px solid #ff00ff;\`
export const Mixed = styled.div\`background: linear-gradient(var(--od-bg), #ff00ff);\`
export const Branched = styled.div\`color: \${props => props.warning ? '#ff00ff' : props.theme.ordering.semantic.text.default};\`
export const Hidden = styled.div\`\${recipe}\`
export const Inline = () => <span style={{ color: '#000', borderInlineStart: '1px solid #ff00ff', outlineColor: '#ff00ff', borderTopColor: '#ff00ff' }} />
export const Computed = ({ property }) => <><span style={{ ['color']: '#00ffff' }} /><span style={{ [property]: '#ff00ff' }} /></>
export const Prop = () => <Icon color='#ff00ff' fill='none' />
const visualProps = { color: '#bb00bb' }
export const SpreadProp = () => <><Icon {...{ color: '#aa00aa' }} /><Icon {...visualProps} /></>
`
    const rootDir = await makeRoot({ 'colors.jsx': source })
    const dataException = {
      component: 'Datum',
      property: 'color',
      match: 'props => props.data.color',
      context: '<dynamic>',
      count: 1,
      reason: 'The datum color is supplied by operational data.',
      evidence: 'The fixture preserves exactly one data-driven color expression.'
    }
    const governedException = {
      component: 'Governed',
      property: 'color',
      match: 'props => props.theme?.ordering?.semantic?.text?.default ?? props.theme.colors.headingColor',
      context: '<dynamic>',
      count: 1,
      reason: 'The complete expression is an approved semantic role with one legacy-theme fallback.',
      evidence: 'Exact matching keeps additions to any branch fail-closed.'
    }
    const guardRules = ruleset([{
      id: 'semantic-colors',
      kind: 'pilot-guard',
      file: 'colors.jsx',
      semanticColorPolicy: { exceptions: [governedException, dataException] }
    }], [], ['pilot-guards'])
    const result = await verifyMigration(options(rootDir, guardRules, ['colors.jsx']))

    expect(result.preservations).toContainEqual(expect.objectContaining({ expression: dataException.match, reason: dataException.reason }))
    expect(result.skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ component: 'Raw', expression: '#fff', reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'Logical', property: 'border-inline-start', expression: '1px solid #ff00ff', reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'Mixed', expression: 'linear-gradient(var(--od-bg), #ff00ff)', reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'Branched', expression: "props => props.warning ? '#ff00ff' : props.theme.ordering.semantic.text.default", reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'Hidden', expression: 'recipe', reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'inline-style', property: 'color', expression: "'#000'", reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'inline-style', property: 'border-inline-start', expression: "'1px solid #ff00ff'", reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'inline-style', property: 'outline-color', expression: "'#ff00ff'", reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'inline-style', property: 'border-top-color', expression: "'#ff00ff'", reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'inline-style', property: 'color', expression: "'#00ffff'", reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'inline-style', property: 'color-block', expression: "[property]: '#ff00ff'", reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'jsx-prop', property: 'color', expression: "'#ff00ff'", reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'jsx-prop', property: 'color-block', expression: "{ color: '#aa00aa' }", context: 'JSXSpreadAttribute', reason: 'ungoverned-color' }),
      expect.objectContaining({ component: 'jsx-prop', property: 'color-block', expression: expect.stringMatching(/^visualProps \/\* binding-sha256:[a-f0-9]{64} \*\/$/), context: 'JSXSpreadAttribute', reason: 'ungoverned-color' })
    ]))
    expect(result.preservations).toContainEqual(expect.objectContaining({ expression: governedException.match, reason: governedException.reason }))
  })

  it('binds inline style references and spreads to constant initializer changes', async () => {
    const initializer = "{ fontSize: '14px', color: '#555' }"
    const source = `import React from 'react'
const styleRecipe = ${initializer}
export const View = () => <><span style={styleRecipe}>Reference</span><span style={{ ...styleRecipe }}>Spread</span></>
`
    const rootDir = await makeRoot({ 'styles.jsx': source })
    const stamp = sha256(initializer)
    const typographyPolicy = {
      roles: ['content'],
      exceptions: [
        { component: 'inline-style', property: 'font', match: `styleRecipe /* binding-sha256:${stamp} */`, context: 'JSXAttribute:reference', count: 1, reason: 'Reviewed constant style recipe.', evidence: 'The initializer hash must change with the recipe.' },
        { component: 'inline-style', property: 'font', match: `...styleRecipe /* binding-sha256:${stamp} */`, context: 'JSXAttribute:spread', count: 1, reason: 'Reviewed constant style spread.', evidence: 'The initializer hash must change with the recipe.' }
      ]
    }
    const guardRules = ruleset([{ id: 'style-bindings', kind: 'pilot-guard', file: 'styles.jsx', typographyPolicy }], [], ['pilot-guards'])
    expect((await verifyMigration(options(rootDir, guardRules, ['styles.jsx']))).ok).toBe(true)

    await fs.writeFile(path.join(rootDir, 'styles.jsx'), source.replace("fontSize: '14px'", "fontSize: '15px'"))
    const changed = await verifyMigration(options(rootDir, guardRules, ['styles.jsx']))
    expect(changed.skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'local-typography-size', context: 'JSXAttribute:reference' }),
      expect.objectContaining({ reason: 'local-typography-size', context: 'JSXAttribute:spread' }),
      expect.objectContaining({ reason: 'typography-exception-not-found', context: 'JSXAttribute:reference' }),
      expect.objectContaining({ reason: 'typography-exception-not-found', context: 'JSXAttribute:spread' })
    ]))

    const mutableRoot = await makeRoot({ 'mutable.jsx': source.replace('export const View', "styleRecipe.fontSize = '99px'\nexport const View") })
    const mutableRules = ruleset([{ id: 'mutable-style', kind: 'pilot-guard', file: 'mutable.jsx', typographyPolicy }], [], ['pilot-guards'])
    const mutable = await verifyMigration(options(mutableRoot, mutableRules, ['mutable.jsx']))
    expect(mutable.skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'unresolved-inline-style-binding', context: 'JSXAttribute:reference' }),
      expect.objectContaining({ reason: 'unresolved-inline-style-binding', context: 'JSXAttribute:spread' })
    ]))

    for (const [index, mutation] of [
      "Object.assign(styleRecipe, { fontSize: '99px' })",
      "mutateStyle(styleRecipe, { fontSize: '99px' })",
      "const leakedStyle = styleRecipe\nleakedStyle.fontSize = '99px'"
    ].entries()) {
      const file = `mutation-call-${index}.jsx`
      const mutationRoot = await makeRoot({ [file]: source.replace('export const View', `${mutation}\nexport const View`) })
      const mutationRules = ruleset([{ id: `mutation-${index}`, kind: 'pilot-guard', file, typographyPolicy }], [], ['pilot-guards'])
      expect((await verifyMigration(options(mutationRoot, mutationRules, [file]))).skips).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason: 'unresolved-inline-style-binding', context: 'JSXAttribute:reference' }),
        expect.objectContaining({ reason: 'unresolved-inline-style-binding', context: 'JSXAttribute:spread' })
      ]))
    }

    const closureMutation = "const mutate = () => Object.assign(styleRecipe, { fontSize: '99px' })\nmutate()"
    const closureRoot = await makeRoot({ 'closure-mutation.jsx': source.replace('export const View', `${closureMutation}\nexport const View`) })
    const closureRules = ruleset([{ id: 'closure-mutation', kind: 'pilot-guard', file: 'closure-mutation.jsx', typographyPolicy }], [], ['pilot-guards'])
    expect((await verifyMigration(options(closureRoot, closureRules, ['closure-mutation.jsx']))).skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'unresolved-inline-style-binding', context: 'JSXAttribute:reference' }),
      expect.objectContaining({ reason: 'unresolved-inline-style-binding', context: 'JSXAttribute:spread' })
    ]))

    const indirectSource = `import React from 'react'
const baseStyle = ${initializer}
const styleRecipe = baseStyle
export const View = () => <span style={styleRecipe}>Indirect</span>
`
    const indirectRoot = await makeRoot({ 'indirect.jsx': indirectSource })
    const initialIndirectRules = ruleset([{ id: 'indirect-style', kind: 'pilot-guard', file: 'indirect.jsx', typographyPolicy: { roles: ['content'], exceptions: [] } }], [], ['pilot-guards'])
    const indirectMatch = (await verifyMigration(options(indirectRoot, initialIndirectRules, ['indirect.jsx']))).skips.find(item => item.context === 'JSXAttribute:reference').expression
    const indirectRules = ruleset([{ id: 'indirect-style', kind: 'pilot-guard', file: 'indirect.jsx', typographyPolicy: { roles: ['content'], exceptions: [{ component: 'inline-style', property: 'font', match: indirectMatch, context: 'JSXAttribute:reference', count: 1, reason: 'Reviewed recursive style alias.', evidence: 'Every local dependency participates in the digest.' }] } }], [], ['pilot-guards'])
    expect((await verifyMigration(options(indirectRoot, indirectRules, ['indirect.jsx']))).ok).toBe(true)
    await fs.writeFile(path.join(indirectRoot, 'indirect.jsx'), indirectSource.replace("fontSize: '14px'", "fontSize: '15px'"))
    const changedIndirect = await verifyMigration(options(indirectRoot, indirectRules, ['indirect.jsx']))
    expect(changedIndirect.skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'local-typography-size', context: 'JSXAttribute:reference' }),
      expect.objectContaining({ reason: 'typography-exception-not-found', context: 'JSXAttribute:reference' })
    ]))

    const importedRoot = await makeRoot({ 'imported.jsx': "import styleRecipe from './recipe'\nexport const View = () => <span style={styleRecipe}>Imported</span>\n" })
    const importedRules = ruleset([{ id: 'imported-style', kind: 'pilot-guard', file: 'imported.jsx', typographyPolicy: { roles: ['content'], exceptions: [] } }], [], ['pilot-guards'])
    expect((await verifyMigration(options(importedRoot, importedRules, ['imported.jsx']))).skips).toContainEqual(expect.objectContaining({ reason: 'unresolved-inline-style-binding', expression: 'styleRecipe' }))

    const nestedSource = "import React from 'react'\nimport { Icon } from './icon'\nconst visualProps = { color: '#555' }\nexport const View = () => <Icon {...{ ...visualProps }} />\n"
    const nestedRoot = await makeRoot({ 'nested.jsx': nestedSource })
    const emptyNestedRules = ruleset([{ id: 'nested-spread', kind: 'pilot-guard', file: 'nested.jsx', semanticColorPolicy: { exceptions: [] } }], [], ['pilot-guards'])
    const nestedMatch = (await verifyMigration(options(nestedRoot, emptyNestedRules, ['nested.jsx']))).skips.find(item => item.context === 'JSXSpreadAttribute' && item.expression.startsWith('{ ...visualProps }')).expression
    const nestedRules = ruleset([{ id: 'nested-spread', kind: 'pilot-guard', file: 'nested.jsx', semanticColorPolicy: { exceptions: [{ component: 'jsx-prop', property: 'color-block', match: nestedMatch, context: 'JSXSpreadAttribute', count: 1, reason: 'Reviewed nested prop spread.', evidence: 'Nested dependencies participate in the digest.' }] } }], [], ['pilot-guards'])
    expect((await verifyMigration(options(nestedRoot, nestedRules, ['nested.jsx']))).ok).toBe(true)
    await fs.writeFile(path.join(nestedRoot, 'nested.jsx'), nestedSource.replace("color: '#555'", "color: '#ff00ff'"))
    const changedNested = await verifyMigration(options(nestedRoot, nestedRules, ['nested.jsx']))
    expect(changedNested.skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'ungoverned-color', context: 'JSXSpreadAttribute' }),
      expect.objectContaining({ reason: 'semantic-color-exception-not-found', context: 'JSXSpreadAttribute' })
    ]))

    await fs.writeFile(path.join(nestedRoot, 'nested.jsx'), nestedSource.replace('export const View', "Object.assign(visualProps, { color: '#ff00ff' })\nexport const View"))
    const mutatedNested = await verifyMigration(options(nestedRoot, nestedRules, ['nested.jsx']))
    expect(mutatedNested.skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'unresolved-inline-style-binding', context: 'JSXSpreadAttribute' }),
      expect.objectContaining({ reason: 'semantic-color-exception-not-found', context: 'JSXSpreadAttribute' })
    ]))
  })

  it('rejects primitive size bypasses and stale typography exceptions', async () => {
    const source = "import styled from 'styled-components'\nexport const Copy = styled.p`font-size: var(--od-font-size-product-content);`\n"
    const rootDir = await makeRoot({ 'surface.js': source })
    const typographyPolicy = {
      roles: ['content'],
      exceptions: [{
        component: 'MissingIcon',
        property: 'font-size',
        match: '16px',
        context: '<root>',
        count: 1,
        reason: 'Reviewed icon geometry.',
        evidence: 'Fixture exception must remain exact and present.'
      }]
    }
    const guardRules = ruleset([{ id: 'typography', kind: 'pilot-guard', file: 'surface.js', typographyPolicy }], [], ['pilot-guards'])
    const result = await verifyMigration(options(rootDir, guardRules, ['surface.js']))

    expect(result.skips).toEqual(expect.arrayContaining([
      expect.objectContaining({ expression: 'var(--od-font-size-product-content)', reason: 'local-typography-size' }),
      expect.objectContaining({ component: 'MissingIcon', expression: '16px', reason: 'typography-exception-not-found' })
    ]))
  })

  it('rejects dynamic typography blocks, invalid styled CSS and bracketed arbitrary sizes', async () => {
    const cases = [
      {
        source: "import styled from 'styled-components'\nexport const Copy = styled.p`${() => 'font-size: 19px;'}`\n",
        expected: { component: 'Copy', reason: 'local-typography-size' }
      },
      {
        source: "import styled from 'styled-components'\nexport const Copy = styled.p`font-size: 19px; {`\n",
        expected: { reason: 'typography-guard-parse-error' }
      },
      {
        source: "export const Copy = () => <p className='hover:od-text-[length:19px]'>Copy</p>\n",
        expected: { component: 'className', expression: 'hover:od-text-[length:19px]', reason: 'local-typography-size' }
      },
      {
        source: "import styled from 'styled-components'\nconst recipe = 'font-size: 19px;'\nexport const Copy = styled.p`${recipe}`\n",
        expected: { component: 'Copy', expression: 'recipe', reason: 'local-typography-size' }
      },
      {
        source: "import styled from 'styled-components'\nconst recipe = 'font-size: 19px;'\nexport const Copy = styled.p`${() => recipe}`\n",
        expected: { component: 'Copy', expression: '() => recipe', reason: 'local-typography-size' }
      }
    ]
    for (const [index, item] of cases.entries()) {
      const file = `surface-${index}.jsx`
      const rootDir = await makeRoot({ [file]: item.source })
      const guardRules = ruleset([{
        id: `typography-${index}`,
        kind: 'pilot-guard',
        file,
        typographyPolicy: { roles: ['content'], exceptions: [] }
      }], [], ['pilot-guards'])
      const result = await verifyMigration(options(rootDir, guardRules, [file]))
      expect(result.ok).toBe(false)
      expect(result.skips).toContainEqual(expect.objectContaining(item.expected))
    }
  })

  it('binds typography exceptions to exact context and cardinality', async () => {
    const original = "import styled from 'styled-components'\nexport const Ticket = styled.div`@media print { span { font-size: 16px; } }`\n"
    const rootDir = await makeRoot({ 'ticket.js': original })
    const typographyPolicy = {
      roles: ['content'],
      exceptions: [{
        component: 'Ticket',
        property: 'font-size',
        match: '16px',
        context: '@media print > span',
        count: 1,
        reason: 'The print renderer preserves this physical ticket measure.',
        evidence: 'The fixture verifies the exact print-only selector and occurrence.'
      }]
    }
    const guardRules = ruleset([{ id: 'ticket-typography', kind: 'pilot-guard', file: 'ticket.js', typographyPolicy }], [], ['pilot-guards'])
    const verify = () => verifyMigration(options(rootDir, guardRules, ['ticket.js']))
    expect((await verify()).ok).toBe(true)

    await fs.writeFile(path.join(rootDir, 'ticket.js'), original.replace('`@media', '`span { font-size: 16px; } @media'))
    expect((await verify()).skips).toContainEqual(expect.objectContaining({ context: 'span', reason: 'local-typography-size' }))

    await fs.writeFile(path.join(rootDir, 'ticket.js'), original.replace('span { font-size: 16px; }', 'span { font-size: 16px; font-size: 16px; }'))
    expect((await verify()).skips).toContainEqual(expect.objectContaining({ reason: 'typography-exception-count-mismatch', detail: { expected: 1, observed: 2 } }))
  })

  it('allows exact reviewed legacy selector hooks only under their positive owner scope', async () => {
    const scope = '.od-ui:where(.od-standard-field)'
    const selector = `${scope} .select, ${scope} .multi-select`
    const childSelector = `${scope} > .select`
    const rootDir = await makeRoot({
      'standard-field.css': `@tailwind utilities;\n${selector} { width: 100%; }\n${childSelector} { min-width: 0; }\n`
    })
    const selectorContract = {
      scope,
      selector,
      classes: ['select', 'multi-select'],
      reason: 'StandardField preserves the reviewed legacy select hooks.',
      evidence: 'The compatibility contract verifies both direct child selector alternatives.'
    }
    const guardRules = ruleset([{
      id: 'standard-field-css',
      kind: 'pilot-guard',
      file: 'standard-field.css',
      tailwindCssPolicy: {
        prefix: 'od-',
        selectorContracts: [
          selectorContract,
          { ...selectorContract, selector: childSelector, classes: ['select'], reason: 'StandardField preserves the reviewed child hook.' }
        ]
      }
    }], [], ['pilot-guards'])

    const result = await verifyMigration(options(rootDir, guardRules, ['standard-field.css']))

    expect(result.ok).toBe(true)
    expect(result.skips).toEqual([])
    expect(result.preservations).toContainEqual(expect.objectContaining({
      expression: selector,
      reason: selectorContract.reason,
      evidence: selectorContract.evidence
    }))
  })

  it.each([
    {
      name: 'unscoped reviewed class',
      extra: '.select { width: 100%; }',
      reason: 'unprefixed-pilot-class',
      expression: 'select'
    },
    {
      name: 'unknown class under the owner scope',
      extra: '.od-ui:where(.od-standard-field) .unknown-hook { width: 100%; }',
      reason: 'unprefixed-pilot-class',
      expression: 'unknown-hook'
    },
    {
      name: 'legacy class used as an apply utility',
      extra: '.od-ui:where(.od-standard-field) .od-control { @apply select od-flex; }',
      reason: 'unprefixed-pilot-class',
      expression: 'select'
    },
    {
      name: 'non-CSS whitespace in a class identifier',
      extra: '.od-ui:where(.od-standard-field) .select\u00a0, .od-ui:where(.od-standard-field) .multi-select { width: 100%; }',
      reason: 'unprefixed-pilot-class',
      expression: 'select'
    }
  ])('does not broaden selector contracts for $name', async ({ extra, reason, expression }) => {
    const scope = '.od-ui:where(.od-standard-field)'
    const selector = `${scope} .select, ${scope} .multi-select`
    const rootDir = await makeRoot({
      'standard-field.css': `${selector} { width: 100%; }\n${extra}\n`
    })
    const guardRules = ruleset([{
      id: 'standard-field-css',
      kind: 'pilot-guard',
      file: 'standard-field.css',
      tailwindCssPolicy: {
        prefix: 'od-',
        selectorContracts: [{
          scope,
          selector,
          classes: ['select', 'multi-select'],
          reason: 'Reviewed selector hooks.',
          evidence: 'Fixture contract.'
        }]
      }
    }], [], ['pilot-guards'])

    const result = await verifyMigration(options(rootDir, guardRules, ['standard-field.css']))

    expect(result.ok).toBe(false)
    expect(result.skips).toContainEqual(expect.objectContaining({ reason, expression }))
  })

  it('fails a selector contract that is no longer present in the CSS', async () => {
    const scope = '.od-ui:where(.od-standard-field)'
    const selector = `${scope} .select, ${scope} .multi-select`
    const rootDir = await makeRoot({
      'standard-field.css': `${scope} .od-control { width: 100%; }\n`
    })
    const guardRules = ruleset([{
      id: 'standard-field-css',
      kind: 'pilot-guard',
      file: 'standard-field.css',
      tailwindCssPolicy: {
        prefix: 'od-',
        selectorContracts: [{ scope, selector, classes: ['select', 'multi-select'], reason: 'Reviewed hooks.', evidence: 'Fixture contract.' }]
      }
    }], [], ['pilot-guards'])

    const result = await verifyMigration(options(rootDir, guardRules, ['standard-field.css']))

    expect(result.ok).toBe(false)
    expect(result.skips).toContainEqual(expect.objectContaining({ reason: 'selector-contract-not-found', expression: selector }))
  })

  it.each([
    ['missing evidence', contract => ({ ...contract, evidence: undefined })],
    ['blank reason', contract => ({ ...contract, reason: '   ' })],
    ['extra schema key', contract => ({ ...contract, note: 'not reviewed' })],
    ['duplicate classes', contract => ({ ...contract, classes: ['select', 'select'] })],
    ['imprecise classes', contract => ({ ...contract, classes: ['select'] })],
    ['unnormalized selector', contract => ({ ...contract, selector: contract.selector.replace(' .select', '  .select') })],
    ['unscoped selector alternative', contract => ({ ...contract, selector: `${contract.scope} .select, .multi-select` })],
    ['adjacent sibling after scope', contract => ({ ...contract, selector: `${contract.scope} + .select, ${contract.scope} .multi-select` })],
    ['general sibling after scope', contract => ({ ...contract, selector: `${contract.scope} ~ .select, ${contract.scope} .multi-select` })],
    ['column combinator after scope', contract => ({ ...contract, selector: `${contract.scope} || .select, ${contract.scope} .multi-select` })],
    ['compact adjacent sibling', contract => ({ ...contract, selector: `${contract.scope} +.select, ${contract.scope} .multi-select` })],
    ['compact general sibling', contract => ({ ...contract, selector: `${contract.scope} ~.select, ${contract.scope} .multi-select` })],
    ['compact column combinator', contract => ({ ...contract, selector: `${contract.scope} ||.select, ${contract.scope} .multi-select` })],
    ['escaped class identifier', contract => ({ ...contract, selector: `${contract.scope} .select\\32, ${contract.scope} .multi-select` })],
    ['quoted attribute whitespace', contract => ({ ...contract, selector: `${contract.scope} .select[data-label="a b"], ${contract.scope} .multi-select` })],
    ['quoted double attribute whitespace', contract => ({ ...contract, selector: `${contract.scope} .select[data-label="a  b"], ${contract.scope} .multi-select` })],
    ['negative scope', contract => ({ ...contract, scope: '.od-ui:not(.od-standard-field)', selector: '.od-ui:not(.od-standard-field) .select, .od-ui:not(.od-standard-field) .multi-select' })],
    ['sibling scope', contract => ({ ...contract, scope: '.od-ui + .od-standard-field', selector: '.od-ui + .od-standard-field .select, .od-ui + .od-standard-field .multi-select' })],
    ['relational scope', contract => ({ ...contract, scope: '.od-ui:has(.od-standard-field)', selector: '.od-ui:has(.od-standard-field) .select, .od-ui:has(.od-standard-field) .multi-select' })],
    ['selector-list scope', contract => ({ ...contract, scope: '.od-ui, .od-standard-field', selector: '.od-ui .select, .od-standard-field .multi-select' })]
  ])('rejects malformed selector contract schema: %s', async (_name, mutate) => {
    const scope = '.od-ui:where(.od-standard-field)'
    const contract = mutate({
      scope,
      selector: `${scope} .select, ${scope} .multi-select`,
      classes: ['select', 'multi-select'],
      reason: 'Reviewed hooks.',
      evidence: 'Fixture contract.'
    })
    const rootDir = await makeRoot({
      'rules.json': JSON.stringify(ruleset([{
        id: 'standard-field-css',
        kind: 'pilot-guard',
        file: 'standard-field.css',
        tailwindCssPolicy: { prefix: 'od-', selectorContracts: [contract] }
      }], [], ['pilot-guards']))
    })

    await expect(loadRules(path.join(rootDir, 'rules.json'))).rejects.toThrow('Invalid pilot-guard rule')
  })

  it('guards extracted attrs recipes and detects helper changes behind an unchanged call', async () => {
    const recipe = "props => props.outline ? 'od-outline' : 'od-button'"
    const source = `const recipe = ${recipe}\nconst attrs = props => ({ className: recipe(props) })\nexport const Wrapper = styled.button.attrs(attrs)\`\`\n`
    const rootDir = await makeRoot({ 'Wrapper.jsx': source })
    const rule = {
      id: 'recipe',
      kind: 'pilot-guard',
      file: 'Wrapper.jsx',
      classNamePolicy: { prefix: 'od-', allow: [] },
      dynamicClassNames: [{ match: 'recipe(props)', reason: 'Reviewed closed variants.', evidence: 'Contract test.' }],
      classNameBindings: [{ name: 'recipe', sha256: sha256(recipe), reason: 'Exact reviewed local recipe.', evidence: 'Contract test.' }]
    }
    const guardRules = ruleset([rule], [], ['pilot-guards'])
    const verify = () => verifyMigration(options(rootDir, guardRules, ['Wrapper.jsx']))
    expect((await verify()).ok).toBe(true)
    await fs.writeFile(path.join(rootDir, 'Wrapper.jsx'), source.replace("'od-button'", "'bg-red-500'"))
    expect((await verify()).skips).toContainEqual(expect.objectContaining({ reason: 'class-recipe-binding-mismatch', expression: 'recipe' }))
    await fs.writeFile(path.join(rootDir, 'Wrapper.jsx'), source.replace('const recipe', 'let recipe'))
    expect((await verify()).skips).toContainEqual(expect.objectContaining({ reason: 'class-recipe-binding-mismatch' }))
    await fs.writeFile(path.join(rootDir, 'Wrapper.jsx'), source + '\nconst otherAttrs = { className: "bg-red-500" }\n')
    expect((await verify()).skips).toContainEqual(expect.objectContaining({ reason: 'unprefixed-pilot-class', expression: 'bg-red-500' }))
  })

  it('rejects malformed recipe hashes and duplicate binding declarations in rules', async () => {
    const rootDir = await makeRoot({})
    const binding = { name: 'recipe', sha256: '0'.repeat(64), reason: 'Reviewed recipe.', evidence: 'Contract test.' }
    for (const bindings of [[{ ...binding, sha256: 'not-a-hash' }], [binding, binding]]) {
      await fs.writeFile(path.join(rootDir, 'rules.json'), JSON.stringify(ruleset([{
        id: 'recipe', kind: 'pilot-guard', file: 'Wrapper.jsx', classNamePolicy: { prefix: 'od-', allow: [] }, classNameBindings: bindings
      }], [], ['pilot-guards'])))
      await expect(loadRules(path.join(rootDir, 'rules.json'))).rejects.toThrow('Invalid pilot-guard rule')
    }
  })

  it('rejects shadowed recipe calls, map writes and mutable escapes after initialization', async () => {
    const map = "{ primary: 'od-button' }"
    const recipe = 'props => variants[props.variant]'
    const prefix = `const variants = ${map};\nconst recipe = ${recipe};\n`
    const attrs = 'const attrs = props => ({ className: recipe(props) })\nexport const Wrapper = styled.button.attrs(attrs)``\n'
    const rootDir = await makeRoot({ 'Wrapper.jsx': prefix + attrs })
    const guardRules = ruleset([{
      id: 'recipe',
      kind: 'pilot-guard',
      file: 'Wrapper.jsx',
      classNamePolicy: { prefix: 'od-', allow: [] },
      dynamicClassNames: [{ match: 'recipe(props)', reason: 'Closed variants.', evidence: 'Contract test.' }],
      classNameBindings: [['variants', map], ['recipe', recipe]].map(([name, value]) => ({ name, sha256: sha256(value), reason: 'Reviewed recipe.', evidence: 'Contract test.' }))
    }], [], ['pilot-guards'])
    const verify = () => verifyMigration(options(rootDir, guardRules, ['Wrapper.jsx']))
    expect((await verify()).ok).toBe(true)
    for (const [source, reason] of [
      [prefix + "const attrs = props => { const recipe = () => 'bg-red-500'; return { className: recipe(props) } }", 'class-recipe-binding-shadowed'],
      [prefix + "variants.primary = 'bg-red-500'\n" + attrs, 'class-recipe-binding-write'],
      [prefix + "for (variants.primary of ['bg-red-500']) {}\n" + attrs, 'class-recipe-binding-write'],
      [prefix + "for (variants.primary in { 'bg-red-500': true }) {}\n" + attrs, 'class-recipe-binding-write'],
      [prefix + "[variants.primary] = ['bg-red-500']\n" + attrs, 'class-recipe-binding-write'],
      [prefix + "[variants.primary = 'bg-red-500'] = []\n" + attrs, 'class-recipe-binding-write'],
      [prefix + "({ value: variants.primary = 'bg-red-500' } = {})\n" + attrs, 'class-recipe-binding-write'],
      [prefix + "for ([variants.primary] of [['bg-red-500']]) {}\n" + attrs, 'class-recipe-binding-write'],
      [prefix + 'delete variants.primary\n' + attrs, 'class-recipe-binding-write'],
      [prefix + "Object.assign(variants, { primary: 'bg-red-500' })\n" + attrs, 'class-recipe-binding-escape'],
      [prefix + 'const alias = variants\n' + attrs, 'class-recipe-binding-escape'],
      [prefix + 'const alias = variants.primary\n' + attrs, 'class-recipe-binding-escape'],
      [prefix + "const Object = { keys: value => { value.primary = 'bg-red-500' } }; Object.keys(variants)\n" + attrs, 'class-recipe-binding-escape']
    ]) {
      await fs.writeFile(path.join(rootDir, 'Wrapper.jsx'), source)
      expect((await verify()).skips).toContainEqual(expect.objectContaining({ reason }))
    }
  })

  it('rejects mutable nested recipe maps rather than certifying builtin or expression escapes', async () => {
    const map = "{ primary: { base: 'od-button' } }"
    const recipe = 'props => variants[props.variant].base'
    const prefix = `const variants = ${map}\nconst recipe = ${recipe}\n`
    const rootDir = await makeRoot({})
    const guardRules = ruleset([{
      id: 'recipe',
      kind: 'pilot-guard',
      file: 'Wrapper.jsx',
      classNamePolicy: { prefix: 'od-', allow: [] },
      dynamicClassNames: [{ match: 'recipe(props)', reason: 'Reviewed call.', evidence: 'Contract test.' }],
      classNameBindings: [['variants', map], ['recipe', recipe]].map(([name, value]) => ({ name, sha256: sha256(value), reason: 'Reviewed initializer.', evidence: 'Contract test.' }))
    }], [], ['pilot-guards'])
    for (const escape of [
      "const alias = Object.values(variants)[0]; alias.base = 'bg-red-500'",
      "Object.entries(variants).forEach(([, entry]) => { entry.base = 'bg-red-500' })",
      "const alias = variants.primary || {}; alias.base = 'bg-red-500'",
      "const getVariant = () => variants.primary; getVariant().base = 'bg-red-500'"
    ]) {
      await fs.writeFile(path.join(rootDir, 'Wrapper.jsx'), prefix + escape + '\nconst attrs = props => ({ className: recipe(props) })\n')
      const result = await verifyMigration(options(rootDir, guardRules, ['Wrapper.jsx']))
      expect(result.ok).toBe(false)
      expect(result.skips).toContainEqual(expect.objectContaining({ reason: 'class-recipe-binding-unsupported-shape', expression: 'variants' }))
    }
  })

  it('rejects reexports, CommonJS and lazy Base UI imports outside registered owners', async () => {
    const rootDir = await makeRoot({
      'Consumer.jsx': "export { Button } from '@base-ui/react/button'\nconst selector = require('@base-ui/react/select')\nconst dialog = () => import('@base-ui/react/dialog')\nconst popup = () => import(`@base-ui/react/popover`)\n"
    })
    const guardRules = ruleset([{ id: 'consumer', kind: 'pilot-guard', file: 'Consumer.jsx', allowedBaseUiSources: [] }], [], ['pilot-guards'])
    const result = await verifyMigration(options(rootDir, guardRules, ['Consumer.jsx']))
    expect(result.skips.map(item => item.detail)).toEqual(['@base-ui/react/button', '@base-ui/react/select', '@base-ui/react/dialog', '@base-ui/react/popover'])
    expect(result.skips.every(item => item.reason === 'direct-base-ui-import')).toBe(true)
    expect(result.ok).toBe(false)
  })

  it('classifies computed module references instead of silently waiving Base UI ownership', async () => {
    const rootDir = await makeRoot({ 'Consumer.jsx': "const name = '@base-ui/react/button'; const load = () => import(name)\n" })
    const guardRules = ruleset([{ id: 'consumer', kind: 'pilot-guard', file: 'Consumer.jsx', allowedBaseUiSources: [] }], [], ['pilot-guards'])
    const result = await verifyMigration(options(rootDir, guardRules, ['Consumer.jsx']))
    expect(result.skips).toContainEqual(expect.objectContaining({ reason: 'unclassified-base-ui-module-reference' }))
    expect(result.ok).toBe(false)
  })

  it('fails pilot guards for direct Base UI consumers, arbitrary or dynamic classes, and Preflight', async () => {
    const rootDir = await makeRoot({
      'Consumer.jsx': 'import { Select } from \'@base-ui/react/select\'\nexport const Consumer = ({ classes }) => <Select.Root className={classes} />\n',
      'Wrapper.jsx': 'export const Wrapper = () => <div className="od-bg-[#266DF0]" />\n',
      'tailwind.config.cjs': 'module.exports = { prefix: \'od-\', content: [\'./**/*.jsx\'], corePlugins: { preflight: true } }\n',
      'spread.config.cjs': 'const injected = { prefix: \'bad-\' }\nmodule.exports = { prefix: \'od-\', content: [\'./Consumer.jsx\', \'./Wrapper.jsx\'], corePlugins: { preflight: false }, ...injected }\n',
      'duplicate.config.cjs': 'module.exports = { prefix: \'od-\', content: [\'./Consumer.jsx\', \'./Wrapper.jsx\'], corePlugins: { preflight: false, preflight: false } }\n',
      'pilot.css': '@tailwind base;\n@tailwind utilities;\n.legacy { @apply od-bg-[#266DF0]; }\n'
    })
    const guardRules = ruleset([
      { id: 'consumer', kind: 'pilot-guard', file: 'Consumer.jsx', allowedBaseUiSources: [], classNamePolicy: { prefix: 'od-', allow: [] } },
      { id: 'wrapper', kind: 'pilot-guard', file: 'Wrapper.jsx', allowedBaseUiSources: [], classNamePolicy: { prefix: 'od-', allow: [] } },
      { id: 'config', kind: 'pilot-guard', file: 'tailwind.config.cjs', tailwindConfig: { prefix: 'od-', content: ['./Consumer.jsx', './Wrapper.jsx'], preflight: false } },
      { id: 'spread-config', kind: 'pilot-guard', file: 'spread.config.cjs', tailwindConfig: { prefix: 'od-', content: ['./Consumer.jsx', './Wrapper.jsx'], preflight: false } },
      { id: 'duplicate-config', kind: 'pilot-guard', file: 'duplicate.config.cjs', tailwindConfig: { prefix: 'od-', content: ['./Consumer.jsx', './Wrapper.jsx'], preflight: false } },
      { id: 'css', kind: 'pilot-guard', file: 'pilot.css', forbidTailwindBase: true, tailwindCssPolicy: { prefix: 'od-' } }
    ], [], ['pilot-guards'])

    const result = await verifyMigration(options(rootDir, guardRules, ['Consumer.jsx', 'Wrapper.jsx', 'tailwind.config.cjs', 'spread.config.cjs', 'duplicate.config.cjs', 'pilot.css']))

    expect(result.ok).toBe(false)
    expect(result.skips.map(item => item.reason)).toEqual(expect.arrayContaining([
      'direct-base-ui-import',
      'unclassified-dynamic-classname',
      'tailwind-arbitrary-class',
      'tailwind-config-mismatch',
      'tailwind-preflight-enabled'
    ]))
    expect(result.skips.filter(item => item.reason === 'tailwind-config-mismatch')).toHaveLength(3)
  })

  it('applies the real AppBootLoader preview and produces a clean second pass', async () => {
    const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
    const file = 'src/@/components-dashboard/src/ui/src/components/Shared/AppBootLoader/styles.js'
    const current = await fs.readFile(path.join(repositoryRoot, file), 'utf8')
    const loaded = await loadRules(path.join(repositoryRoot, 'scripts/brand-system/migration-rules.json'))
    // Seed the reviewed legacy expressions into a temporary copy of the real
    // component. Keep the production file and canonical manual refinements intact.
    const source = loaded.ruleset.rules.filter(rule => rule.match !== rule.replace)
      .reduce((value, rule) => value.replaceAll(rule.replace, rule.match), current)
    const rootDir = await makeRoot({ [file]: source })
    const migration = { rootDir, ruleset: loaded.ruleset, rulesHash: loaded.hash, allowlist: [file] }
    const preview = await createPreview(migration)

    expect(preview.skips).toEqual([])
    expect(preview.changes).toHaveLength(17)
    await applyPreview({ rootDir, preview, allowlist: [file] })
    const second = await createPreview(migration)
    expect(second).toMatchObject({ changes: [], skips: [], outputs: [] })
    expect((await verifyMigration(migration)).ok).toBe(true)
  })

  it('does not let preview output overwrite a source or arbitrary JSON file', async () => {
    const source = 'import styled from \'styled-components\'\nexport const Box = styled.div`color:${p => p.old};`\n'
    const rootDir = await makeRoot({
      'styles.js': source,
      'rules.json': JSON.stringify(ruleset([{ id: 'color', kind: 'styled-expression', file: 'styles.js', component: 'Box', property: 'color', match: 'p => p.old', replace: 'p => p.next' }])),
      'notes.json': '{"kind":"notes"}\n'
    })
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await expect(run(['preview', '--rules', 'rules.json', '--allowlist', 'styles.js', '--out', 'styles.js'], { rootDir })).rejects.toThrow('Unsafe preview output path')
    await expect(run(['preview', '--rules', 'rules.json', '--allowlist', 'styles.js', '--out', 'notes.json'], { rootDir })).rejects.toThrow('non-preview artifact')
    expect(await fs.readFile(path.join(rootDir, 'styles.js'), 'utf8')).toBe(source)
    expect(await fs.readFile(path.join(rootDir, 'notes.json'), 'utf8')).toBe('{"kind":"notes"}\n')
    output.mockRestore()
  })

  it('binds CLI apply to the identifier printed by a successful preview', async () => {
    const source = 'import Old from \'legacy-ui\'\nexport const View = Old\n'
    const rules = importRuleset([{
      id: 'move',
      kind: 'import-specifier',
      file: 'view.js',
      source: 'legacy-ui',
      imported: 'default',
      local: 'Old',
      targetSource: 'new-ui',
      targetImported: 'New'
    }])
    const rootDir = await makeRoot({ 'view.js': source, 'rules.json': JSON.stringify(rules) })
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await run(['preview', '--rules', 'rules.json', '--allowlist', 'view.js', '--out', 'preview.json', '--json'], { rootDir })
    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toBe(source)
    const preview = JSON.parse(await fs.readFile(path.join(rootDir, 'preview.json'), 'utf8'))
    await expect(run(['apply', '--preview', 'preview.json', '--allowlist', 'view.js'], { rootDir })).rejects.toThrow('Missing required option --id')
    await run(['apply', '--preview', 'preview.json', '--id', preview.id, '--allowlist', 'view.js', '--json'], { rootDir })

    expect(await fs.readFile(path.join(rootDir, 'view.js'), 'utf8')).toContain("from 'new-ui'")
    output.mockRestore()
  })

  it('rejects a tampered preview and an expanded apply allowlist', async () => {
    const rootDir = await makeRoot({
      'styles.js': 'import styled from \'styled-components\'\nexport const Box = styled.div`color: ${p => p.old};`\n',
      'other.js': 'export const other = true\n'
    })
    const rules = ruleset([{ id: 'color', kind: 'styled-expression', file: 'styles.js', component: 'Box', property: 'color', match: 'p => p.old', replace: 'p => p.next' }])
    const preview = await createPreview(options(rootDir, rules, ['styles.js']))

    await expect(applyPreview({ rootDir, preview: { ...preview, ruleset: 'tampered' }, allowlist: ['styles.js'] })).rejects.toThrow('Preview identifier')
    await expect(applyPreview({ rootDir, preview, allowlist: ['styles.js', 'other.js'] })).rejects.toThrow('allowlist')
  })

  it('passes release dry-run as a boolean and rejects misspelled options', async () => {
    const updateRelease = vi.fn(async options => ({ ok: true, dryRun: options.dryRun }))
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    expect(parseArgs(['release-update', '--dry-run'])).toMatchObject({ dryRun: true })
    const result = await run(['release-update', '--dry-run', '--json'], { rootDir: process.cwd(), releaseModule: { updateRelease } })
    expect(updateRelease).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }))
    expect(result.result).toMatchObject({ ok: true, dryRun: true })
    await expect(run(['verify', '--rulse', 'rules.json'], { rootDir: process.cwd() })).rejects.toThrow('Unknown option --rulse')
    await expect(run(['release-check', '--allowlist', 'one.js'], { rootDir: process.cwd() })).rejects.toThrow('Unknown option --allowlist')
    output.mockRestore()
  })
})
