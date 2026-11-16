import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseSync, transformFromAstSync, traverse } from '@babel/core'
import postcss from 'postcss'

const SCHEMA_VERSION = 1
const JS_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs'])
const STYLE_RULE_KINDS = new Set(['styled-expression', 'static-declaration'])
const RULE_CATEGORIES = new Set(['imports', 'pilot-guards', 'typography'])
const CONSUMER_USAGE_KINDS = new Set(['call-argument', 'jsx-element', 'member-access', 'other', 're-export', 'styled-component', 'template-interpolation'])
const IMPORT_IDENTIFIER = /^[$A-Z_a-z][$\w]*$/
const MODULE_SPECIFIER = /^[^\0\r\n]+$/
const CSS_CLASS_IDENTIFIER = /^[_a-zA-Z][\w-]*$/
const SIMPLE_CSS_SELECTOR = /^[A-Za-z0-9_.:(), >\t\r\n\f-]+$/
const TAILWIND_CSS_POLICY_KEYS = new Set(['prefix', 'selectorContracts'])
const SELECTOR_CONTRACT_KEYS = new Set(['scope', 'selector', 'classes', 'reason', 'evidence'])
const TYPOGRAPHY_POLICY_KEYS = new Set(['roles', 'exceptions'])
const TYPOGRAPHY_EXCEPTION_KEYS = new Set(['component', 'property', 'match', 'context', 'count', 'reason', 'evidence'])
const TYPOGRAPHY_PROPERTIES = new Set(['font-size', 'fontSize', 'font'])
const SEMANTIC_COLOR_POLICY_KEYS = new Set(['exceptions'])
const COLOR_PROPERTIES = new Set([
  'background', 'background-color',
  'border', 'border-color', 'border-bottom', 'border-bottom-color', 'border-left', 'border-left-color', 'border-right', 'border-right-color', 'border-top', 'border-top-color',
  'border-block', 'border-block-color', 'border-block-end', 'border-block-end-color', 'border-block-start', 'border-block-start-color',
  'border-inline', 'border-inline-color', 'border-inline-end', 'border-inline-end-color', 'border-inline-start', 'border-inline-start-color',
  'box-shadow', 'color', 'fill', 'outline', 'outline-color', 'stroke', 'text-decoration-color'
])
const STATIC_VISUAL_PROPERTIES = new Set([
  'animation', 'background', 'background-color', 'border', 'border-color',
  'border-radius', 'border-bottom', 'border-bottom-color', 'border-left', 'border-left-color', 'border-right', 'border-right-color', 'border-top', 'border-top-color',
  'border-block', 'border-block-color', 'border-block-end', 'border-block-end-color', 'border-block-start', 'border-block-start-color',
  'border-inline', 'border-inline-color', 'border-inline-end', 'border-inline-end-color', 'border-inline-start', 'border-inline-start-color',
  'box-shadow', 'color', 'column-gap', 'fill', 'font', 'font-family', 'font-size', 'font-weight',
  'gap', 'height', 'line-height', 'margin', 'margin-bottom', 'margin-left',
  'margin-right', 'margin-top', 'max-height', 'max-width', 'min-height',
  'min-width', 'padding', 'padding-bottom', 'padding-left', 'padding-right',
  'outline', 'outline-color', 'padding-top', 'row-gap', 'stroke', 'text-decoration-color', 'transition', 'width'
])
const PROTECTED_PREFIXES = ['node_modules/', 'dist/', 'build/', 'coverage/', 'public/', 'src/assets/', 'src/brand/sources/', 'docs/brand-system-evidence/']
const PROTECTED_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'dashboard-translations.json'])
const isProtectedPath = file => PROTECTED_PREFIXES.some(prefix => file.startsWith(prefix)) || PROTECTED_FILES.has(file) || path.basename(file).includes('.generated.') || path.basename(file).includes('.lock.')

export const previewArtifactPath = (rootDir, file, inputs = []) => {
  const normalized = relativePath(rootDir, file)
  if (path.extname(normalized) !== '.json' || isProtectedPath(normalized) || inputs.includes(normalized)) {
    throw new Error(`Unsafe preview output path: ${normalized}`)
  }
  return normalized
}

export const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
  }
  return value
}

const stableJson = (value) => JSON.stringify(stable(value))

const relativePath = (rootDir, file) => {
  const absolute = path.resolve(rootDir, file)
  const relative = path.relative(rootDir, absolute)
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`File is outside the repository allowlist boundary: ${file}`)
  }
  const normalized = relative.split(path.sep).join('/')
  return normalized
}

export const normalizeAllowlist = (rootDir, files, { forWrite = false } = {}) => {
  const normalized = [...new Set(files.map(file => relativePath(rootDir, file)))].sort()
  if (forWrite) {
    const protectedPath = normalized.find(isProtectedPath)
    if (protectedPath) throw new Error(`Protected path cannot be migrated: ${protectedPath}`)
  }
  return normalized
}

export const loadRules = async (rulesPath) => {
  const source = await fs.readFile(rulesPath, 'utf8')
  const ruleset = JSON.parse(source)
  if (ruleset.schemaVersion !== SCHEMA_VERSION || !ruleset.id || !Array.isArray(ruleset.rules)) {
    throw new Error(`Invalid migration ruleset: ${rulesPath}`)
  }
  const allRules = [...ruleset.rules, ...(ruleset.preservations ?? [])]
  if (ruleset.categories !== undefined && (!Array.isArray(ruleset.categories) || ruleset.categories.length !== 1 || ruleset.categories.some(category => !RULE_CATEGORIES.has(category)))) {
    throw new Error(`Invalid migration rule categories in ${rulesPath}`)
  }
  for (const rule of allRules) {
    if (!rule.id || !rule.file || !rule.kind) throw new Error(`Invalid migration rule in ${rulesPath}`)
  }
  if (new Set(allRules.map(rule => rule.id)).size !== allRules.length) throw new Error(`Duplicate migration rule identifier in ${rulesPath}`)
  if (ruleset.rules.some(rule => STYLE_RULE_KINDS.has(rule.kind) && typeof rule.replace !== 'string')) {
    throw new Error(`Migration rule is missing a replacement in ${rulesPath}`)
  }
  const importRules = ruleset.rules.filter(rule => rule.kind === 'import-specifier')
  if (importRules.length > 0 && !ruleset.categories?.includes('imports')) {
    throw new Error(`Import migration rules require the imports category in ${rulesPath}`)
  }
  if (ruleset.categories?.includes('imports') && (ruleset.rules.some(rule => rule.kind !== 'import-specifier') || (ruleset.preservations ?? []).length > 0)) {
    throw new Error(`Imports category accepts only import-specifier rules in ${rulesPath}`)
  }
  if (ruleset.rules.some(rule => rule.kind === 'pilot-guard') && !ruleset.categories?.includes('pilot-guards')) {
    throw new Error(`Pilot guard rules require the pilot-guards category in ${rulesPath}`)
  }
  if (ruleset.categories?.includes('pilot-guards') && (ruleset.rules.some(rule => rule.kind !== 'pilot-guard') || (ruleset.preservations ?? []).length > 0)) {
    throw new Error(`Pilot guards category accepts only pilot-guard rules in ${rulesPath}`)
  }
  // TYPOGRAPHY_PROPERTIES is the set this file already uses everywhere else to decide
  // what counts as typography, and it includes `fontSize` because that is what the
  // engine emits for a JSX inline style. This check used to hardcode a narrower list,
  // so a ruleset holding a perfectly ordinary inline-style entry could be written,
  // pass `verify`, and then fail to LOAD. Two rulesets shipped in that state before a
  // per-wave check ran and found them.
  // A `styled-expression` whose interpolation returns whole `css` blocks has NO
  // single property -- the engine reports the candidate with `property: null` --
  // so demanding a typography property name would make such a site impossible to
  // preserve in a typography ruleset. It is still required to BE typography: the
  // expression itself has to mention a typography property, which is checked here
  // rather than taken on the ruleset's word.
  const isTypographyRule = rule => TYPOGRAPHY_PROPERTIES.has(rule.property) || (
    rule.kind === 'styled-expression' &&
    (rule.property === null || rule.property === undefined) &&
    typeof rule.match === 'string' &&
    /font-size|fontSize|font\s*:/.test(rule.match)
  )
  if (ruleset.categories?.includes('typography') && allRules.some(rule => !STYLE_RULE_KINDS.has(rule.kind) || !isTypographyRule(rule))) {
    throw new Error(`Typography category accepts only font-size or font style rules in ${rulesPath}`)
  }
  if (importRules.some(rule => !validImportRule(rule))) {
    throw new Error(`Invalid import-specifier migration rule in ${rulesPath}`)
  }
  if (ruleset.rules.some(rule => rule.kind === 'pilot-guard' && !validPilotGuardRule(rule))) {
    throw new Error(`Invalid pilot-guard rule in ${rulesPath}`)
  }
  if ((ruleset.preservations ?? []).some(rule => !STYLE_RULE_KINDS.has(rule.kind))) {
    throw new Error(`Unsupported migration preservation kind in ${rulesPath}`)
  }
  if ((ruleset.preservations ?? []).some(rule => !rule.reason || !rule.evidence)) {
    throw new Error(`Migration preservation is missing reason or evidence in ${rulesPath}`)
  }
  return { ruleset, hash: sha256(stableJson(ruleset)) }
}

const parseJavaScript = (source, filename) => parseSync(source, {
  babelrc: false,
  configFile: false,
  filename,
  sourceType: 'unambiguous',
  parserOpts: {
    errorRecovery: false,
    plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator']
  }
})

const validImportRule = rule => (
  [rule.source, rule.imported, rule.local, rule.targetSource, rule.targetImported].every(value => typeof value === 'string' && value.length > 0) &&
  MODULE_SPECIFIER.test(rule.source) &&
  MODULE_SPECIFIER.test(rule.targetSource) &&
  (rule.imported === 'default' || IMPORT_IDENTIFIER.test(rule.imported)) &&
  IMPORT_IDENTIFIER.test(rule.local) &&
  IMPORT_IDENTIFIER.test(rule.targetImported) &&
  rule.targetImported !== 'default' &&
  rule.source !== rule.targetSource &&
  validConsumerUsage(rule.consumerUsage)
)

const normalizeCssSelector = selector => postcss.list.comma(selector)
  .map(alternative => alternative.trim().replace(/\s+/g, ' '))
  .join(', ')

const selectorClasses = selector => [...selector.matchAll(/\.([_a-zA-Z][\w-]*)/g)].map(match => match[1])

const validSelectorContract = (contract, prefix) => {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) return false
  if (Object.keys(contract).some(key => !SELECTOR_CONTRACT_KEYS.has(key)) || Object.keys(contract).length !== SELECTOR_CONTRACT_KEYS.size) return false
  if ([contract.scope, contract.selector, contract.reason, contract.evidence].some(value => typeof value !== 'string' || value.trim().length === 0)) return false
  // Contracts support simple descendant/child hooks only. Escapes, attributes,
  // quoted values and sibling combinators need a separately reviewed grammar.
  if (!SIMPLE_CSS_SELECTOR.test(contract.selector)) return false
  if (!Array.isArray(contract.classes) || contract.classes.length === 0 || new Set(contract.classes).size !== contract.classes.length) return false
  if (contract.classes.some(className => !CSS_CLASS_IDENTIFIER.test(className) || className.startsWith(prefix))) return false
  const scope = normalizeCssSelector(contract.scope)
  const selector = normalizeCssSelector(contract.selector)
  if (contract.scope !== scope || contract.selector !== selector || postcss.list.comma(scope).length !== 1) return false
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const prefixedClass = `${escapedPrefix}[_a-zA-Z][\\w-]*`
  const positiveScope = new RegExp(`^(?:\\.${prefixedClass}|\\.${escapedPrefix}ui:where\\(\\.${prefixedClass}\\))$`)
  if (!positiveScope.test(scope)) return false
  const scopeClasses = selectorClasses(scope)
  if (scopeClasses.length === 0 || scopeClasses.some(className => !className.startsWith(prefix))) return false
  const alternatives = postcss.list.comma(selector).map(value => value.trim())
  if (alternatives.length === 0 || alternatives.some(alternative => !alternative.startsWith(`${scope} `))) return false
  const observedClasses = [...new Set(selectorClasses(selector).filter(className => !className.startsWith(prefix)))].sort()
  return stableJson(observedClasses) === stableJson([...contract.classes].sort())
}

const validTypographyPolicy = policy => {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return false
  if (Object.keys(policy).some(key => !TYPOGRAPHY_POLICY_KEYS.has(key))) return false
  if (!Array.isArray(policy.roles) || policy.roles.length === 0 || new Set(policy.roles).size !== policy.roles.length) return false
  if (policy.roles.some(role => typeof role !== 'string' || !/^[a-z][A-Za-z0-9]*$/.test(role))) return false
  if (policy.exceptions !== undefined && (
    !Array.isArray(policy.exceptions) ||
    new Set(policy.exceptions.map(item => `${item?.component}\0${item?.property}\0${item?.match}\0${item?.context}`)).size !== policy.exceptions.length ||
    policy.exceptions.some(item => (
      !item || typeof item !== 'object' || Array.isArray(item) ||
      Object.keys(item).some(key => !TYPOGRAPHY_EXCEPTION_KEYS.has(key)) ||
      Object.keys(item).length !== TYPOGRAPHY_EXCEPTION_KEYS.size ||
      [item.component, item.property, item.match, item.context, item.reason, item.evidence].some(value => typeof value !== 'string' || value.trim().length === 0) ||
      !Number.isInteger(item.count) || item.count < 1 ||
      !TYPOGRAPHY_PROPERTIES.has(item.property)
    ))
  )) return false
  return true
}

const validSemanticColorPolicy = policy => {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return false
  if (Object.keys(policy).some(key => !SEMANTIC_COLOR_POLICY_KEYS.has(key))) return false
  if (!Array.isArray(policy.exceptions)) return false
  if (new Set(policy.exceptions.map(item => `${item?.component}\0${item?.property}\0${item?.match}\0${item?.context}`)).size !== policy.exceptions.length) return false
  return policy.exceptions.every(item => (
    item && typeof item === 'object' && !Array.isArray(item) &&
    Object.keys(item).length === TYPOGRAPHY_EXCEPTION_KEYS.size &&
    Object.keys(item).every(key => TYPOGRAPHY_EXCEPTION_KEYS.has(key)) &&
    [item.component, item.property, item.match, item.context, item.reason, item.evidence].every(value => typeof value === 'string' && value.trim().length > 0) &&
    Number.isInteger(item.count) && item.count > 0 &&
    (COLOR_PROPERTIES.has(item.property) || item.property === 'color-block')
  ))
}

const validPilotGuardRule = rule => {
  if (rule.kind !== 'pilot-guard') return false
  const baseUi = rule.allowedBaseUiSources
  const classNames = rule.classNamePolicy
  const cssClasses = rule.tailwindCssPolicy
  const config = rule.tailwindConfig
  const dynamic = rule.dynamicClassNames
  const bindings = rule.classNameBindings
  const typography = rule.typographyPolicy
  const semanticColor = rule.semanticColorPolicy
  if (baseUi !== undefined && (!Array.isArray(baseUi) || new Set(baseUi).size !== baseUi.length || baseUi.some(source => typeof source !== 'string' || (source !== '@base-ui/react' && !source.startsWith('@base-ui/react/'))))) return false
  if (classNames !== undefined && (
    !classNames || typeof classNames !== 'object' ||
    typeof classNames.prefix !== 'string' || classNames.prefix.length === 0 ||
    !Array.isArray(classNames.allow) || classNames.allow.some(value => typeof value !== 'string')
  )) return false
  if (cssClasses !== undefined && (
    !cssClasses || typeof cssClasses !== 'object' ||
    Object.keys(cssClasses).some(key => !TAILWIND_CSS_POLICY_KEYS.has(key)) ||
    typeof cssClasses.prefix !== 'string' || cssClasses.prefix.length === 0 ||
    (cssClasses.selectorContracts !== undefined && (
      !Array.isArray(cssClasses.selectorContracts) ||
      new Set(cssClasses.selectorContracts.map(contract => contract?.selector)).size !== cssClasses.selectorContracts.length ||
      cssClasses.selectorContracts.some(contract => !validSelectorContract(contract, cssClasses.prefix))
    ))
  )) return false
  if (dynamic !== undefined && (!classNames || !Array.isArray(dynamic) || new Set(dynamic.map(item => item?.match)).size !== dynamic.length || dynamic.some(item => !item?.match || !item.reason || !item.evidence))) return false
  if (bindings !== undefined && (!classNames || !Array.isArray(bindings) || bindings.length === 0 || new Set(bindings.map(item => item?.name)).size !== bindings.length || bindings.some(item => !/^[A-Za-z_$][\w$]*$/.test(item?.name ?? '') || !/^[a-f0-9]{64}$/.test(item?.sha256 ?? '') || !item.reason || !item.evidence))) return false
  if (typography !== undefined && !validTypographyPolicy(typography)) return false
  if (semanticColor !== undefined && !validSemanticColorPolicy(semanticColor)) return false
  if (config !== undefined && (
    !config || typeof config !== 'object' ||
    typeof config.prefix !== 'string' || config.prefix.length === 0 ||
    !Array.isArray(config.content) || config.content.some(value => typeof value !== 'string') ||
    config.preflight !== false
  )) return false
  return baseUi !== undefined || classNames !== undefined || cssClasses !== undefined || config !== undefined || typography !== undefined || semanticColor !== undefined || rule.forbidTailwindBase === true
}

const validConsumerUsage = value => {
  if (value === undefined) return true
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (!Array.isArray(value.allowed) || value.allowed.length === 0 || new Set(value.allowed).size !== value.allowed.length || value.allowed.some(kind => !CONSUMER_USAGE_KINDS.has(kind))) return false
  if (value.min !== undefined && (!Number.isInteger(value.min) || value.min < 0)) return false
  if (value.max !== undefined && (!Number.isInteger(value.max) || value.max < 0)) return false
  return value.min === undefined || value.max === undefined || value.min <= value.max
}

const moduleLiteral = value => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`

const walk = (node, visit, state = {}) => {
  if (!node || typeof node !== 'object') return
  const nextState = visit(node, state) ?? state
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue
    if (Array.isArray(value)) value.forEach(child => walk(child, visit, nextState))
    else if (value && typeof value.type === 'string') walk(value, visit, nextState)
  }
}

const importedBindings = (ast) => {
  const bindings = { styled: new Set(), css: new Set(), keyframes: new Set() }
  for (const statement of ast.program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== 'styled-components') continue
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportDefaultSpecifier') bindings.styled.add(specifier.local.name)
      if (specifier.type === 'ImportSpecifier' && bindings[specifier.imported.name]) {
        bindings[specifier.imported.name].add(specifier.local.name)
      }
    }
  }
  return bindings
}

const tagKind = (tag, bindings) => {
  if (tag.type === 'Identifier') {
    if (bindings.css.has(tag.name)) return 'css'
    if (bindings.keyframes.has(tag.name)) return 'keyframes'
  }
  if (tag.type === 'MemberExpression' && tag.object.type === 'Identifier' && bindings.styled.has(tag.object.name)) return 'styled'
  if (tag.type === 'CallExpression' && tag.callee.type === 'Identifier' && bindings.styled.has(tag.callee.name)) return 'styled'
  if (tag.type === 'CallExpression' && tag.callee.type === 'MemberExpression' && !tag.callee.computed && tag.callee.property.type === 'Identifier' && tag.callee.property.name === 'attrs' && tagKind(tag.callee.object, bindings) === 'styled') return 'styled'
  return null
}

const expressionStructure = (node, bindings) => {
  if (!node) return 'none'
  if (node.type === 'ArrowFunctionExpression') return `arrow:${expressionStructure(node.body, bindings)}`
  if (node.type === 'LogicalExpression' || node.type === 'BinaryExpression') return `${node.type}:${node.operator}:${expressionStructure(node.left, bindings)}:${expressionStructure(node.right, bindings)}`
  if (node.type === 'TaggedTemplateExpression') return `tagged:${tagKind(node.tag, bindings) ?? 'unknown'}`
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') return node.type
  if (node.type === 'Identifier') return 'identifier'
  return node.type
}

const cssPropertyBefore = (source, template, expressionIndex) => {
  const expression = template.expressions[expressionIndex]
  const prefix = source.slice(template.start + 1, expression.start - 2)
  const match = prefix.match(/(?:^|[;{}])\s*([a-zA-Z-]+)\s*:[^;{}]*$/)
  return match?.[1] ?? null
}

const cssNodeContext = node => {
  const context = []
  let current = node?.parent
  while (current && current.type !== 'root') {
    if (current.type === 'rule') context.push(current.selector)
    if (current.type === 'atrule') context.push(`@${current.name}${current.params ? ` ${current.params}` : ''}`)
    current = current.parent
  }
  return context.reverse().join(' > ') || '<root>'
}

// PostCSS parses the complete AST-delimited template. Interpolations are masked
// without changing offsets, so partly dynamic values are never called static.
const collectStaticDeclarations = (source, template, component, kind, filename) => {
  const start = template.start + 1
  const end = template.end - 1
  // The mask has to end at the interpolation's closing `}`, and `expression.end + 1`
  // is only that when the brace sits flush against the expression. Written across
  // lines -- `${({ x }) => x ? css`...` : css`...`\n  }` -- the expression ends at the
  // last backtick and the `}` is several characters later, so it survived the mask and
  // postcss met a stray brace: "Unexpected }". The template's own quasi boundary is the
  // exact end, because the next quasi starts immediately after that `}`.
  //
  // Measured blast radius before changing this, WITHOUT using the parser: the whole
  // components tree holds 4 templates the engine could not parse, and they contain 0
  // `font-size` declarations between them, so no count anywhere moves. The bug was
  // fail-CLOSED -- the engine reported the skip and `apply` refused the preview -- which
  // is why it cost friction and not correctness.
  const dynamicRanges = template.expressions.map((expression, index) => ({
    start: expression.start - 2,
    end: template.quasis[index + 1].start
  }))
  const masked = source.slice(start, end).split('')
  for (const range of dynamicRanges) {
    for (let offset = range.start; offset < range.end; offset += 1) {
      if (source[offset] !== '\n' && source[offset] !== '\r') masked[offset - start] = ' '
    }
  }
  const declarations = []
  let root
  try {
    root = postcss.parse(masked.join(''), { from: filename })
  } catch (error) {
    return [{ kind: 'css-parse-error', component, detail: error.reason ?? error.message, start, end, tagKind: kind }]
  }
  root.walkDecls(declaration => {
    if (!STATIC_VISUAL_PROPERTIES.has(declaration.prop)) return
    const relativeStart = declaration.source.start.offset
    const valueStart = start + relativeStart + declaration.prop.length + declaration.raws.between.length
    const rawValue = declaration.raws.value?.raw ?? declaration.value
    const valueEnd = valueStart + rawValue.length
    if (dynamicRanges.some(range => range.start < valueEnd && range.end > valueStart)) return
    declarations.push({
      kind: 'static-declaration',
      component,
      property: declaration.prop,
      expression: source.slice(valueStart, valueEnd),
      context: cssNodeContext(declaration),
      start: valueStart,
      end: valueEnd,
      tagKind: kind
    })
  })
  return declarations
}

const collectStyledCandidates = (source, filename) => {
  const ast = parseJavaScript(source, filename)
  const bindings = importedBindings(ast)
  const expressions = []
  walk(ast, (node, state) => {
    let component = state.component
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') component = node.id.name
    if (node.type !== 'TaggedTemplateExpression') return { ...state, component }
    const kind = tagKind(node.tag, bindings)
    if (!kind) return { ...state, component }
    node.quasi.expressions.forEach((expression, index) => {
      expressions.push({
        kind: 'styled-expression',
        component,
        property: cssPropertyBefore(source, node.quasi, index),
        expression: source.slice(expression.start, expression.end),
        context: '<dynamic>',
        structure: expressionStructure(expression, bindings),
        start: expression.start,
        end: expression.end,
        tagKind: kind
      })
    })
    expressions.push(...collectStaticDeclarations(source, node.quasi, component, kind, filename))
    return { ...state, component }
  })
  return expressions.sort((a, b) => a.start - b.start)
}

const importSpecifierValue = (specifier, source) => ({
  type: specifier.type,
  imported: specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier' ? specifier.imported.name : 'default',
  supported: specifier.type !== 'ImportSpecifier' || specifier.imported.type === 'Identifier',
  local: specifier.local.name,
  start: specifier.start,
  end: specifier.end,
  localStart: specifier.local.start,
  localEnd: specifier.local.end,
  leadingComments: (specifier.leadingComments ?? []).map(comment => ({ type: comment.type, start: comment.start, end: comment.end, text: source.slice(comment.start, comment.end) })),
  trailingComments: (specifier.trailingComments ?? []).map(comment => ({ type: comment.type, start: comment.start, end: comment.end, text: source.slice(comment.start, comment.end) }))
})

const collectImports = (source, filename) => {
  const ast = parseJavaScript(source, filename)
  const declarations = ast.program.body
    .filter(statement => statement.type === 'ImportDeclaration')
    .map(statement => {
      const specifiers = statement.specifiers.map(specifier => importSpecifierValue(specifier, source))
      const coveredComments = new Set(specifiers.flatMap(specifier => [...specifier.leadingComments, ...specifier.trailingComments]).map(comment => `${comment.start}:${comment.end}`))
      const internalComments = (ast.comments ?? []).filter(comment => comment.start >= statement.start && comment.end <= statement.end)
      const followingLineBreak = source.slice(statement.end).match(/^[\t ]*(?:\r\n|\n|\r)/)?.[0] ?? ''
      const lineTail = source.slice(statement.end).match(/^[^\r\n]*(?:(\r\n|\n|\r)|$)/)
      const lineEnding = lineTail?.[1] ?? ''
      const lineTailContent = lineEnding ? (lineTail?.[0] ?? '').slice(0, -lineEnding.length) : (lineTail?.[0] ?? '')
      return {
        start: statement.start,
        end: statement.end,
        removalEnd: statement.end + followingLineBreak.length,
        source: statement.source.value,
        rawSource: source.slice(statement.source.start, statement.source.end),
        semicolon: source.slice(statement.start, statement.end).trimEnd().endsWith(';'),
        specifiers,
        unsupportedMetadata: (statement.attributes?.length ?? 0) > 0 || (statement.assertions?.length ?? 0) > 0 || Boolean(statement.phase) || (statement.importKind && statement.importKind !== 'value'),
        unsupportedSpecifiers: specifiers.some(specifier => !specifier.supported),
        unsupportedComments: internalComments.filter(comment => comment.type === 'CommentLine' || !coveredComments.has(`${comment.start}:${comment.end}`)).map(comment => source.slice(comment.start, comment.end)),
        insertionEnd: statement.end + (lineTail?.[0].length ?? 0),
        insertionLineEnding: lineEnding,
        safeInsertionAnchor: /^(?:\s|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)*$/.test(lineTailContent)
      }
    })
  return { ast, declarations }
}

const classifyConsumerReference = reference => {
  const parent = reference.parentPath
  if (parent?.isJSXOpeningElement() || parent?.isJSXClosingElement()) return 'jsx-element'
  if (parent?.isExportSpecifier()) return 're-export'
  if (parent?.isMemberExpression() || parent?.isOptionalMemberExpression()) return 'member-access'
  if (parent?.isCallExpression()) {
    if (parent.get('callee').isIdentifier({ name: 'styled' })) return 'styled-component'
    return 'call-argument'
  }
  if (reference.findParent(candidate => candidate.isTaggedTemplateExpression())) return 'template-interpolation'
  return 'other'
}

const collectConsumerUsage = ({ ast, source, specifier, rule }) => {
  if (!rule.consumerUsage) return null
  let referenceKinds = []
  transformFromAstSync(ast, source, {
    ast: false,
    babelrc: false,
    cloneInputAst: false,
    code: false,
    configFile: false,
    plugins: [() => ({
      visitor: {
        Program (programPath) {
          const binding = programPath.scope.getBinding(specifier.local)
          if (!binding || binding.identifier.start !== specifier.localStart || binding.identifier.end !== specifier.localEnd) return
          referenceKinds = binding.referencePaths.map(classifyConsumerReference)
        }
      }
    })]
  })
  const counts = Object.fromEntries([...new Set(referenceKinds)].sort().map(kind => [kind, referenceKinds.filter(value => value === kind).length]))
  return {
    file: rule.file,
    rule: rule.id,
    local: specifier.local,
    total: referenceKinds.length,
    kinds: counts
  }
}

const consumerUsageError = (rule, usage) => {
  if (!usage) return null
  const disallowed = Object.keys(usage.kinds).filter(kind => !rule.consumerUsage.allowed.includes(kind))
  const minimum = rule.consumerUsage.min ?? 0
  const maximum = rule.consumerUsage.max ?? Infinity
  if (disallowed.length === 0 && usage.total >= minimum && usage.total <= maximum) return null
  return {
    file: rule.file,
    rule: rule.id,
    reason: 'consumer-usage-mismatch',
    detail: {
      allowed: rule.consumerUsage.allowed,
      min: minimum,
      max: Number.isFinite(maximum) ? maximum : null,
      observed: usage
    }
  }
}

const formatSpecifier = (specifier, value) => [
  ...specifier.leadingComments.map(comment => comment.text),
  value,
  ...specifier.trailingComments.map(comment => comment.text)
].join(' ')

const formatImport = (declaration, specifiers) => {
  if (specifiers.length === 0) return ''
  const defaultSpecifier = specifiers.find(specifier => specifier.type === 'ImportDefaultSpecifier')
  const namespaceSpecifier = specifiers.find(specifier => specifier.type === 'ImportNamespaceSpecifier')
  const named = specifiers
    .filter(specifier => specifier.type === 'ImportSpecifier')
    .map(specifier => formatSpecifier(specifier, specifier.imported === specifier.local ? specifier.imported : `${specifier.imported} as ${specifier.local}`))
  const groups = []
  if (defaultSpecifier) groups.push(formatSpecifier(defaultSpecifier, defaultSpecifier.local))
  if (namespaceSpecifier) groups.push(formatSpecifier(namespaceSpecifier, `* as ${namespaceSpecifier.local}`))
  if (named.length > 0) groups.push(`{ ${named.join(', ')} }`)
  return `import ${groups.join(', ')} from ${declaration.rawSource}${declaration.semicolon ? ';' : ''}`
}

const importRuleMatch = (specifier, rule) => (
  specifier.local === rule.local &&
  (rule.imported === 'default'
    ? specifier.type === 'ImportDefaultSpecifier'
    : specifier.type === 'ImportSpecifier' && specifier.imported === rule.imported)
)

const targetRuleMatch = (specifier, rule) => (
  specifier.type === 'ImportSpecifier' &&
  specifier.imported === rule.targetImported &&
  specifier.local === rule.local
)

const analyzeImportFile = ({ file, source, ruleset }) => {
  const { ast, declarations } = collectImports(source, file)
  const fileRules = ruleset.rules.filter(rule => rule.file === file)
  const changes = []
  const skips = []
  const consumerUsages = []
  const selectedByDeclaration = new Map()
  const targetBySource = new Map()

  for (const rule of fileRules) {
    if (rule.kind !== 'import-specifier') {
      skips.push({ file, rule: rule.id, reason: 'unsupported-rule-kind', detail: rule.kind })
      continue
    }
    if (!validImportRule(rule)) {
      skips.push({ file, rule: rule.id, reason: 'invalid-import-rule' })
      continue
    }

    const sourceDeclarations = declarations.filter(declaration => declaration.source === rule.source)
    const targetDeclarations = declarations.filter(declaration => declaration.source === rule.targetSource)
    if ([...sourceDeclarations, ...targetDeclarations].some(declaration => declaration.unsupportedMetadata)) {
      skips.push({ file, rule: rule.id, reason: 'unsupported-import-metadata' })
      continue
    }
    if ([...sourceDeclarations, ...targetDeclarations].some(declaration => declaration.unsupportedSpecifiers)) {
      skips.push({ file, rule: rule.id, reason: 'unsupported-import-specifier' })
      continue
    }
    if ([...sourceDeclarations, ...targetDeclarations].some(declaration => declaration.unsupportedComments.length > 0)) {
      skips.push({ file, rule: rule.id, reason: 'unsupported-import-comments' })
      continue
    }
    if (sourceDeclarations.some(declaration => declaration.specifiers.some(specifier => specifier.type === 'ImportNamespaceSpecifier')) || targetDeclarations.some(declaration => declaration.specifiers.some(specifier => specifier.type === 'ImportNamespaceSpecifier'))) {
      skips.push({ file, rule: rule.id, reason: 'namespace-import-unsupported' })
      continue
    }
    if (targetDeclarations.length > 1) {
      skips.push({ file, rule: rule.id, reason: 'ambiguous-target-import', detail: rule.targetSource })
      continue
    }

    const sourceMatches = sourceDeclarations.flatMap(declaration => declaration.specifiers.filter(specifier => importRuleMatch(specifier, rule)).map(specifier => ({ declaration, specifier })))
    const targetMatches = targetDeclarations.flatMap(declaration => declaration.specifiers.filter(specifier => targetRuleMatch(specifier, rule)))
    const targetLocalCollisions = targetDeclarations.flatMap(declaration => declaration.specifiers.filter(specifier => specifier.local === rule.local && !targetRuleMatch(specifier, rule)))

    if (sourceMatches.length > 1) {
      skips.push({ file, rule: rule.id, reason: 'ambiguous-import-binding' })
    } else if (sourceMatches.length === 0 && targetMatches.length === 1) {
      const usage = collectConsumerUsage({ ast, source, specifier: targetMatches[0], rule })
      if (usage) consumerUsages.push(usage)
      const usageError = consumerUsageError(rule, usage)
      if (usageError) skips.push(usageError)
      continue
    } else if (sourceMatches.length === 0) {
      skips.push({ file, rule: rule.id, reason: 'import-binding-not-found' })
    } else if (targetMatches.length > 0) {
      skips.push({ file, rule: rule.id, reason: 'source-and-target-binding-present' })
    } else if (targetLocalCollisions.length > 0) {
      skips.push({ file, rule: rule.id, reason: 'target-import-collision' })
    } else {
      const { declaration, specifier } = sourceMatches[0]
      const usage = collectConsumerUsage({ ast, source, specifier, rule })
      if (usage) consumerUsages.push(usage)
      const usageError = consumerUsageError(rule, usage)
      if (usageError) {
        skips.push(usageError)
        continue
      }
      if (!selectedByDeclaration.has(declaration)) selectedByDeclaration.set(declaration, [])
      if (selectedByDeclaration.get(declaration).some(selection => selection.specifier.local === specifier.local)) {
        skips.push({ file, rule: rule.id, reason: 'conflicting-import-rules' })
        continue
      }
      selectedByDeclaration.get(declaration).push({ rule, specifier })
      if (!targetBySource.has(rule.targetSource)) targetBySource.set(rule.targetSource, [])
      targetBySource.get(rule.targetSource).push(rule)
    }
  }

  if (skips.length > 0) return { changes: [], skips, preservations: [], consumerUsages }

  for (const [declaration, selections] of selectedByDeclaration) {
    const selected = new Set(selections.map(selection => selection.specifier))
    const after = formatImport(declaration, declaration.specifiers.filter(specifier => !selected.has(specifier)))
    const end = after === '' ? declaration.removalEnd : declaration.end
    changes.push({
      file,
      rule: selections.map(selection => selection.rule.id).sort().join(','),
      rules: selections.map(selection => selection.rule.id).sort(),
      start: declaration.start,
      end,
      before: source.slice(declaration.start, end),
      after
    })
  }

  for (const [targetSource, rules] of targetBySource) {
    const uniqueTargets = new Set(rules.map(rule => `${rule.targetImported}\0${rule.local}`))
    if (uniqueTargets.size !== rules.length) {
      return { changes: [], skips: rules.map(rule => ({ file, rule: rule.id, reason: 'conflicting-import-rules' })), preservations: [], consumerUsages }
    }
    const existing = declarations.find(declaration => declaration.source === targetSource)
    const additions = rules
      .map(rule => {
        const selection = [...selectedByDeclaration.values()].flat().find(item => item.rule === rule)
        return {
          type: 'ImportSpecifier',
          imported: rule.targetImported,
          local: rule.local,
          leadingComments: selection.specifier.leadingComments,
          trailingComments: selection.specifier.trailingComments
        }
      })
      .sort((a, b) => a.imported.localeCompare(b.imported) || a.local.localeCompare(b.local))
    if (existing) {
      changes.push({
        file,
        rule: rules.map(rule => rule.id).sort().join(','),
        rules: rules.map(rule => rule.id).sort(),
        start: existing.start,
        end: existing.end,
        before: source.slice(existing.start, existing.end),
        after: formatImport(existing, [...existing.specifiers, ...additions])
      })
    } else {
      const anchor = declarations.at(-1)
      const declaration = { rawSource: moduleLiteral(targetSource), semicolon: false }
      const emptySourceChange = changes.find(change => change.after === '' && selectedByDeclaration.has(declarations.find(item => item.start === change.start && item.removalEnd === change.end)))
      if (emptySourceChange) {
        const sourceDeclaration = declarations.find(item => item.start === emptySourceChange.start && item.removalEnd === emptySourceChange.end)
        const mergedRules = [...new Set([...emptySourceChange.rules, ...rules.map(rule => rule.id)])].sort()
        emptySourceChange.rule = mergedRules.join(',')
        emptySourceChange.rules = mergedRules
        emptySourceChange.after = formatImport(declaration, additions) + source.slice(sourceDeclaration.end, sourceDeclaration.removalEnd)
      } else {
        if (!anchor.safeInsertionAnchor) {
          return { changes: [], skips: rules.map(rule => ({ file, rule: rule.id, reason: 'unsupported-import-insertion-anchor' })), preservations: [], consumerUsages }
        }
        const after = anchor.insertionLineEnding
          ? `${formatImport(declaration, additions)}${anchor.insertionLineEnding}`
          : `\n${formatImport(declaration, additions)}`
        changes.push({
          file,
          rule: rules.map(rule => rule.id).sort().join(','),
          rules: rules.map(rule => rule.id).sort(),
          start: anchor.insertionEnd,
          end: anchor.insertionEnd,
          before: '',
          after
        })
      }
    }
  }
  const ordered = [...changes].sort((a, b) => a.start - b.start || a.end - b.end)
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index - 1].end > ordered[index].start || (ordered[index - 1].start === ordered[index].start && ordered[index - 1].end === ordered[index].end)) {
      const rules = [...new Set([...ordered[index - 1].rules, ...ordered[index].rules])].sort()
      return { changes: [], skips: rules.map(rule => ({ file, rule, reason: 'overlapping-import-declarations' })), preservations: [], consumerUsages }
    }
  }
  return { changes, skips: [], preservations: [], consumerUsages }
}

const sameLocation = (rule, candidate) => (
  rule.kind === candidate.kind &&
  (!rule.component || rule.component === candidate.component) &&
  (!rule.property || rule.property === candidate.property) &&
  (!rule.context || rule.context === candidate.context) &&
  (!rule.tagKind || rule.tagKind === candidate.tagKind)
)

const matchesCandidate = (rule, candidate) => (
  sameLocation(rule, candidate) &&
  (typeof rule.match === 'string' ? rule.match === candidate.expression : rule.structure === candidate.structure)
)

const propertyName = node => {
  if (!node || node.computed) return null
  if (node.key?.type === 'Identifier') return node.key.name
  if (node.key?.type === 'StringLiteral') return node.key.value
  return null
}

const staticNodeValue = node => {
  if (!node) return undefined
  if (node.type === 'StringLiteral' || node.type === 'BooleanLiteral' || node.type === 'NumericLiteral') return node.value
  if (node.type === 'ArrayExpression') {
    const values = node.elements.map(staticNodeValue)
    return values.some(value => value === undefined) ? undefined : values
  }
  if (node.type === 'ObjectExpression') {
    const entries = []
    const keys = new Set()
    for (const property of node.properties) {
      if (property.type !== 'ObjectProperty') return undefined
      const key = propertyName(property)
      const value = staticNodeValue(property.value)
      if (key === null || keys.has(key) || value === undefined) return undefined
      keys.add(key)
      entries.push([key, value])
    }
    return Object.fromEntries(entries)
  }
  return undefined
}

const findTailwindConfig = ast => {
  let configNode
  for (const statement of ast.program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      configNode = statement.declaration
      break
    }
    if (statement.type !== 'ExpressionStatement' || statement.expression.type !== 'AssignmentExpression') continue
    const left = statement.expression.left
    if (left.type === 'MemberExpression' && !left.computed && left.object.type === 'Identifier' && left.object.name === 'module' && left.property.type === 'Identifier' && left.property.name === 'exports') {
      configNode = statement.expression.right
      break
    }
  }
  if (configNode?.type !== 'ObjectExpression') return undefined
  if (configNode.properties.some(property => property.type === 'SpreadElement' || property.computed)) return undefined
  const readProperty = name => {
    const matches = configNode.properties.filter(item => item.type === 'ObjectProperty' && propertyName(item) === name)
    if (matches.length !== 1) return undefined
    const [property] = matches
    return staticNodeValue(property?.value)
  }
  return {
    content: readProperty('content'),
    corePlugins: readProperty('corePlugins'),
    prefix: readProperty('prefix')
  }
}

const classNameCandidates = (source, ast) => {
  const candidates = []
  const addCandidate = (value, expression = value) => {
    if (!value || !expression) return
    if (value.type === 'StringLiteral') {
      candidates.push({ expression: source.slice(expression.start, expression.end), dynamic: false, values: [value.value] })
      return
    }
    const strings = []
    let dynamic = false
    const collect = value => {
      if (!value || typeof value !== 'object') return
      if (value.type === 'StringLiteral') {
        strings.push(value.value)
        return
      }
      if (value.type === 'TemplateLiteral') {
        strings.push(...value.quasis.map(quasi => quasi.value.cooked ?? quasi.value.raw))
        if (value.expressions.length > 0) {
          dynamic = true
          value.expressions.forEach(collect)
        }
        return
      }
      if (value.type === 'ConditionalExpression') {
        dynamic = true
        collect(value.consequent)
        collect(value.alternate)
        return
      }
      if (value.type === 'LogicalExpression') {
        dynamic = true
        collect(value.right)
        return
      }
      if (value.type === 'BinaryExpression' && value.operator === '+') {
        dynamic = true
        collect(value.left)
        collect(value.right)
        return
      }
      if (value.type === 'CallExpression') {
        if (value.callee.type !== 'Identifier' || !['cn', 'cva', 'clsx', 'classNames'].includes(value.callee.name)) dynamic = true
        value.arguments.forEach(collect)
        return
      }
      if (value.type === 'ArrayExpression') {
        value.elements.forEach(collect)
        return
      }
      if (value.type === 'ObjectExpression') {
        dynamic = true
        for (const property of value.properties) {
          if (property.type !== 'ObjectProperty') continue
          if (property.key.type === 'StringLiteral') strings.push(property.key.value)
          else if (property.key.type === 'Identifier' && !property.computed) strings.push(property.key.name)
        }
        return
      }
      dynamic = true
    }
    collect(value)
    candidates.push({
      expression: source.slice(expression.start, expression.end),
      dynamic,
      values: strings
    })
  }
  walk(ast, (node, { parent }) => {
    if (node.type === 'JSXAttribute' && node.name?.name === 'className' && node.value) {
      const value = node.value.type === 'JSXExpressionContainer' ? node.value.expression : node.value
      addCandidate(value)
    } else if (node.type === 'ObjectProperty' && parent?.type === 'ObjectExpression' && propertyName(node) === 'className') {
      addCandidate(node.value)
    }
    return { parent: node }
  })
  return candidates
}

const typographyRoleVariable = role => `var(--od-type-${role.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}-size)`

const unwrapStaticString = expression => {
  const quote = expression[0]
  return (quote === '"' || quote === "'") && expression.at(-1) === quote ? expression.slice(1, -1) : expression
}

const classUtility = token => {
  let bracketDepth = 0
  let variantEnd = -1
  for (let index = 0; index < token.length; index += 1) {
    if (token[index] === '[') bracketDepth += 1
    else if (token[index] === ']') bracketDepth = Math.max(0, bracketDepth - 1)
    else if (token[index] === ':' && bracketDepth === 0) variantEnd = index
  }
  return token.slice(variantEnd + 1).replace(/^!/, '').replace(/^-/, '')
}

const typographyClassSize = token => {
  const utility = classUtility(token)
  return /^(?:od-)?text-(?:\[[^\]]+\]|(?:xs|sm|base|lg|xl|[2-9]xl)|\d+(?:\.\d+)?)$/.test(utility)
}

const staticStylePropertyName = property => {
  if (!property.computed) return propertyName(property)
  if (property.key.type === 'StringLiteral') return property.key.value
  if (property.key.type === 'TemplateLiteral' && property.key.expressions.length === 0) return property.key.quasis[0].value.cooked
  return null
}

const referenceRootName = node => {
  let current = node
  while (current?.type === 'MemberExpression' || current?.type === 'OptionalMemberExpression') current = current.object
  return current?.type === 'Identifier' ? current.name : null
}

const bindingMemberWritePaths = binding => [...new Set(binding.referencePaths.map(reference => reference.findParent(ancestor => {
  const node = ancestor.node
  const destination = ancestor.isAssignmentExpression() || ancestor.isForOfStatement() || ancestor.isForInStatement()
    ? node.left
    : ancestor.isUpdateExpression() || (ancestor.isUnaryExpression() && node.operator === 'delete') ? node.argument : null
  return destination && reference.node.start >= destination.start && reference.node.end <= destination.end
})).filter(Boolean))]

const bindingHasMemberWrite = binding => bindingMemberWritePaths(binding).length > 0

const referenceIsProvenInitializerEdge = (reference, graph) => {
  const declarator = reference.findParent(ancestor => ancestor.isVariableDeclarator())
  if (!declarator?.node.init || reference.node.start < declarator.node.init.start || reference.node.end > declarator.node.init.end) return false
  let current = reference.parentPath
  while (current && current !== declarator) {
    if (current.isFunction() || current.isCallExpression() || current.isNewExpression() || current.isTaggedTemplateExpression()) return false
    current = current.parentPath
  }
  if (current !== declarator || declarator.node.id.type !== 'Identifier') return false
  const owner = declarator.scope.getBinding(declarator.node.id.name)
  return Boolean(owner && graph.has(owner))
}

const bindingHasUnsafeStyleEscape = (binding, graph) => binding.referencePaths.some(reference => {
  let target = reference
  while ((target.parentPath?.isMemberExpression() || target.parentPath?.isOptionalMemberExpression()) && target.parentPath.node.object === target.node) target = target.parentPath
  const parent = target.parentPath
  if (parent?.isJSXExpressionContainer() && parent.parentPath?.isJSXAttribute() && parent.parentPath.node.name?.name === 'style') return false
  if (parent?.isSpreadElement()) {
    const object = parent.parentPath
    const container = object?.parentPath
    if (object?.isObjectExpression() && container?.isJSXExpressionContainer() && container.parentPath?.isJSXAttribute() && container.parentPath.node.name?.name === 'style') return false
  }
  if (referenceIsProvenInitializerEdge(reference, graph)) return false
  return true
})

const bindingHasUnsafeJsxSpreadEscape = (binding, graph) => binding.referencePaths.some(reference => {
  let target = reference
  while ((target.parentPath?.isMemberExpression() || target.parentPath?.isOptionalMemberExpression()) && target.parentPath.node.object === target.node) target = target.parentPath
  if (target.parentPath?.isJSXSpreadAttribute()) return false
  if (target.parentPath?.isSpreadElement()) {
    const object = target.parentPath.parentPath
    if (object?.isObjectExpression() && object.parentPath?.isJSXSpreadAttribute()) return false
  }
  if (referenceIsProvenInitializerEdge(reference, graph)) return false
  return true
})

const externalStyleBinding = binding => binding.kind === 'param'

const bindingDependencyDigest = (source, binding) => {
  const seen = new Set()
  const parts = []
  const collect = current => {
    if (externalStyleBinding(current)) return true
    if (seen.has(current)) return false
    seen.add(current)
    if (!current.constant || bindingHasMemberWrite(current)) return false
    const initializer = current.path.get?.('init')
    if (!initializer?.node) return false
    parts.push({ name: current.identifier.name, source: source.slice(initializer.node.start, initializer.node.end) })
    const dependencies = new Set()
    const addDependency = reference => {
      if (!reference.isReferencedIdentifier()) return
      const dependency = reference.scope.getBinding(reference.node.name)
      if (dependency && dependency !== current) dependencies.add(dependency)
    }
    addDependency(initializer)
    initializer.traverse({ ReferencedIdentifier: addDependency })
    return [...dependencies].every(collect)
  }
  if (!collect(binding) || [...seen].some(current => bindingHasUnsafeStyleEscape(current, seen))) return null
  parts.sort((a, b) => a.name.localeCompare(b.name))
  return parts.length === 1 ? sha256(parts[0].source) : sha256(stableJson(parts))
}

const jsxSpreadBindingDigest = (source, binding) => {
  const seen = new Set()
  const parts = []
  const collect = current => {
    if (externalStyleBinding(current)) return true
    if (seen.has(current)) return false
    seen.add(current)
    const initializer = current.path.get?.('init')
    if (!initializer?.node || !current.constant || bindingHasMemberWrite(current)) return false
    parts.push({ name: current.identifier.name, source: source.slice(initializer.node.start, initializer.node.end) })
    const dependencies = new Set()
    if (initializer.isReferencedIdentifier()) {
      const dependency = initializer.scope.getBinding(initializer.node.name)
      if (dependency && dependency !== current) dependencies.add(dependency)
    } else if (initializer.isObjectExpression()) {
      for (const property of initializer.get('properties')) {
        if (!property.isSpreadElement()) continue
        const name = referenceRootName(property.node.argument)
        const dependency = name ? property.scope.getBinding(name) : null
        if (dependency && dependency !== current) dependencies.add(dependency)
      }
    } else if (initializer.isConditionalExpression() || initializer.isLogicalExpression()) {
      for (const branch of initializer.isConditionalExpression() ? [initializer.get('consequent'), initializer.get('alternate')] : [initializer.get('left'), initializer.get('right')]) {
        const name = referenceRootName(branch.node)
        const dependency = name ? branch.scope.getBinding(name) : null
        if (dependency && dependency !== current) dependencies.add(dependency)
      }
    } else {
      return false
    }
    return [...dependencies].every(collect)
  }
  if (!collect(binding) || [...seen].some(current => bindingHasUnsafeJsxSpreadEscape(current, seen))) return null
  parts.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
  return sha256(stableJson(parts))
}

const bindingStampedExpression = (source, scope, node) => {
  const expression = source.slice(node.start, node.end)
  const name = referenceRootName(node)
  if (!name) return { expression, unresolvedBinding: false }
  const binding = scope.getBinding(name)
  if (!binding) return { expression, unresolvedBinding: false }
  if (externalStyleBinding(binding)) return { expression, unresolvedBinding: false }
  const digest = bindingDependencyDigest(source, binding)
  if (!digest) return { expression, unresolvedBinding: true }
  return { expression: `${expression} /* binding-sha256:${digest} */`, unresolvedBinding: false }
}

const jsxSpreadStampedExpression = (source, scope, node) => {
  const expression = source.slice(node.start, node.end)
  const name = referenceRootName(node)
  if (!name) return { expression, unresolvedBinding: false }
  const binding = scope.getBinding(name)
  if (!binding || externalStyleBinding(binding)) return { expression, unresolvedBinding: false }
  const digest = jsxSpreadBindingDigest(source, binding)
  if (!digest) return { expression, unresolvedBinding: true }
  return { expression: `${expression} /* binding-sha256:${digest} */`, unresolvedBinding: false }
}

const jsxSpreadObjectExpression = (source, scope, node) => {
  const expression = source.slice(node.start, node.end)
  const dependencies = []
  for (const property of node.properties) {
    if (property.type !== 'SpreadElement') continue
    const stamped = property.argument.type === 'ObjectExpression'
      ? jsxSpreadObjectExpression(source, scope, property.argument)
      : jsxSpreadStampedExpression(source, scope, property.argument)
    if (stamped.unresolvedBinding) return { expression, unresolvedBinding: true }
    if (stamped.expression.includes('binding-sha256:')) dependencies.push(stamped.expression)
  }
  if (dependencies.length === 0) return { expression, unresolvedBinding: false }
  return { expression: `${expression} /* binding-sha256:${sha256(stableJson([expression, ...dependencies.sort()]))} */`, unresolvedBinding: false }
}

const inlineStyleEntries = (source, ast) => {
  const entries = []
  traverse(ast, {
    JSXAttribute (attribute) {
      if (attribute.node.name?.name !== 'style' || !attribute.node.value) return
      const value = attribute.node.value.type === 'JSXExpressionContainer' ? attribute.node.value.expression : attribute.node.value
      if (value.type !== 'ObjectExpression') {
        entries.push({ property: null, ...bindingStampedExpression(source, attribute.scope, value), context: 'JSXAttribute:reference' })
        return
      }
      for (const property of value.properties) {
        if (property.type === 'SpreadElement') {
          const stamped = bindingStampedExpression(source, attribute.scope, property.argument)
          entries.push({ property: null, expression: `...${stamped.expression}`, unresolvedBinding: stamped.unresolvedBinding, context: 'JSXAttribute:spread' })
          continue
        }
        if (property.type !== 'ObjectProperty') {
          entries.push({ property: null, expression: source.slice(property.start, property.end), context: 'JSXAttribute:unknown' })
          continue
        }
        const propertyName = staticStylePropertyName(property)
        entries.push({
          property: propertyName,
          expression: propertyName === null ? source.slice(property.start, property.end) : source.slice(property.value.start, property.value.end),
          context: propertyName === null ? 'JSXAttribute:computed' : 'JSXAttribute:ObjectExpression'
        })
      }
    }
  })
  return entries
}

const jsxColorEntries = (source, ast) => {
  const entries = []
  traverse(ast, {
    JSXAttribute (attribute) {
      if (attribute.node.name?.type !== 'JSXIdentifier' || attribute.node.name.name === 'style' || !attribute.node.value) return
      const property = inlineColorProperty(attribute.node.name.name)
      if (!property) return
      const value = attribute.node.value.type === 'JSXExpressionContainer' ? attribute.node.value.expression : attribute.node.value
      entries.push({
        component: 'jsx-prop',
        property,
        expression: source.slice(value.start, value.end),
        context: 'JSXAttribute'
      })
    },
    JSXSpreadAttribute (attribute) {
      const stamped = attribute.node.argument.type === 'ObjectExpression'
        ? jsxSpreadObjectExpression(source, attribute.scope, attribute.node.argument)
        : jsxSpreadStampedExpression(source, attribute.scope, attribute.node.argument)
      entries.push({
        component: 'jsx-prop',
        property: 'color-block',
        expression: stamped.expression,
        context: 'JSXSpreadAttribute',
        unresolvedBinding: stamped.unresolvedBinding
      })
    }
  })
  return entries
}

const typographyCandidates = ({ file, source, ast }) => {
  const candidates = []
  const add = candidate => candidates.push(candidate)
  if (JS_EXTENSIONS.has(path.extname(file))) {
    for (const candidate of collectStyledCandidates(source, file)) {
      if (candidate.kind === 'css-parse-error') throw new Error(candidate.detail)
      if (TYPOGRAPHY_PROPERTIES.has(candidate.property)) add({ component: candidate.component, property: candidate.property, expression: candidate.expression, context: candidate.context ?? '<dynamic>' })
      else if (candidate.property === null) add({ component: candidate.component, property: 'font', expression: candidate.expression, context: candidate.context ?? '<dynamic>' })
    }
    for (const candidate of inlineStyleEntries(source, ast)) {
      if (candidate.property === 'fontSize' || candidate.property === 'font') add({ component: 'inline-style', ...candidate })
      else if (candidate.property === null) add({ component: 'inline-style', property: 'font', expression: candidate.expression, context: candidate.context, unresolvedBinding: candidate.unresolvedBinding })
    }
    for (const candidate of classNameCandidates(source, ast)) {
      for (const token of candidate.values.flatMap(value => value.split(/\s+/)).filter(typographyClassSize)) {
        add({ component: 'className', property: 'font-size', expression: token, context: 'className' })
      }
    }
    return candidates
  }
  if (path.extname(file) === '.css') {
    const css = postcss.parse(source, { from: file })
    css.walkDecls(declaration => {
      if (declaration.prop === 'font-size' || declaration.prop === 'font') {
        add({ component: declaration.parent?.selector ?? '<css>', property: declaration.prop, expression: declaration.value, context: cssNodeContext(declaration) })
      }
    })
    return candidates
  }
  throw new Error(`Unsupported typography guard format: ${path.extname(file) || 'no extension'}`)
}

const inlineColorProperty = property => {
  if (typeof property !== 'string') return null
  const normalized = property.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`)
  return COLOR_PROPERTIES.has(normalized) ? normalized : null
}

const semanticColorCandidates = ({ file, source, ast }) => {
  const candidates = []
  const add = candidate => candidates.push(candidate)
  if (JS_EXTENSIONS.has(path.extname(file))) {
    for (const candidate of collectStyledCandidates(source, file)) {
      if (candidate.kind === 'css-parse-error') throw new Error(candidate.detail)
      if (COLOR_PROPERTIES.has(candidate.property)) add({ component: candidate.component, property: candidate.property, expression: candidate.expression, context: candidate.context ?? '<dynamic>' })
      else if (candidate.property === null) add({ component: candidate.component, property: 'color-block', expression: candidate.expression, context: candidate.context ?? '<dynamic>' })
    }
    for (const candidate of inlineStyleEntries(source, ast)) {
      const property = inlineColorProperty(candidate.property)
      if (property) add({ component: 'inline-style', property, expression: candidate.expression, context: candidate.context, unresolvedBinding: candidate.unresolvedBinding })
      else if (candidate.property === null) add({ component: 'inline-style', property: 'color-block', expression: candidate.expression, context: candidate.context, unresolvedBinding: candidate.unresolvedBinding })
    }
    for (const candidate of jsxColorEntries(source, ast)) add(candidate)
    return candidates
  }
  if (path.extname(file) === '.css') {
    const css = postcss.parse(source, { from: file })
    css.walkDecls(declaration => {
      if (COLOR_PROPERTIES.has(declaration.prop)) add({ component: declaration.parent?.selector ?? '<css>', property: declaration.prop, expression: declaration.value, context: cssNodeContext(declaration) })
    })
    return candidates
  }
  throw new Error(`Unsupported semantic color guard format: ${path.extname(file) || 'no extension'}`)
}

const semanticColorExpression = expression => {
  const value = unwrapStaticString(expression).trim()
  if (/^(?:transparent|currentColor|inherit|initial|none|unset)$/i.test(value)) return true
  if (/^(?:0|(?:\d*\.?\d+(?:px|rem|em))\s+(?:solid|dashed|dotted|double))$/i.test(value)) return true
  const governedVariable = String.raw`var\(--od-[a-z0-9-]+\)`
  return new RegExp(`^(?:(?:\\d*\\.?\\d+(?:px|rem|em)\\s+(?:solid|dashed|dotted|double)\\s+)?${governedVariable})$`, 'i').test(value)
}

const primitiveRecipeValue = node => ['StringLiteral', 'NumericLiteral', 'BooleanLiteral', 'NullLiteral'].includes(node?.type)
const flatRecipeMap = node => node?.type === 'ObjectExpression' && node.properties.every(property => property.type === 'ObjectProperty' && !property.computed && primitiveRecipeValue(property.value))
const supportedRecipeInitializer = node => ['ArrowFunctionExpression', 'FunctionExpression'].includes(node?.type) || primitiveRecipeValue(node) || flatRecipeMap(node)

const recipeBindingViolations = (ast, requested) => {
  if (requested.length === 0) return []
  const names = new Set(requested.map(binding => binding.name))
  const bindings = new Map()
  const violations = new Map()
  const fail = (name, reason) => violations.set(`${name}:${reason}`, { expression: name, reason })
  traverse(ast, {
    Program (program) {
      for (const name of names) {
        const binding = program.scope.getBinding(name)
        bindings.set(name, binding)
        if (binding && !binding.constant) fail(name, 'class-recipe-binding-write')
      }
    },
    BindingIdentifier (identifier) {
      const name = identifier.node.name
      if (names.has(name) && identifier.node !== bindings.get(name)?.identifier) fail(name, 'class-recipe-binding-shadowed')
    },
    ReferencedIdentifier (reference) {
      const name = reference.node.name
      if (!names.has(name)) return
      const binding = bindings.get(name)
      if (!binding || reference.scope.getBinding(name) !== binding) {
        fail(name, 'class-recipe-binding-shadowed')
        return
      }
      let target = reference
      while (target.parentPath?.isMemberExpression() && target.parentPath.node.object === target.node) target = target.parentPath
      const parent = target.parentPath
      const write = reference.findParent(ancestor => {
        const node = ancestor.node
        const destination = ancestor.isAssignmentExpression() || ancestor.isForOfStatement() || ancestor.isForInStatement()
          ? node.left
          : ancestor.isUpdateExpression() || (ancestor.isUnaryExpression() && node.operator === 'delete') ? node.argument : null
        return destination && reference.node.start >= destination.start && reference.node.end <= destination.end
      })
      if (write) {
        fail(name, 'class-recipe-binding-write')
        return
      }
      // Only flat literal maps expose proven immutable property values. Nested
      // maps, function properties and other shapes are unsupported, not waived.
      if (target !== reference && !flatRecipeMap(binding.path.node.init)) {
        fail(name, 'class-recipe-binding-escape')
        return
      }
      if (parent.isVariableDeclarator() || parent.isAssignmentExpression() || parent.isObjectProperty() || parent.isArrayExpression()) {
        fail(name, 'class-recipe-binding-escape')
        return
      }
      if (parent.isCallExpression()) {
        if (target === reference && parent.node.callee === target.node) return
        const callee = parent.get('callee')
        const readOnlyObjectCall = !callee.scope.getBinding('Object') && (callee.matchesPattern('Object.keys') || callee.matchesPattern('Object.values') || callee.matchesPattern('Object.entries') || callee.matchesPattern('Object.hasOwn') || callee.matchesPattern('Object.freeze') || callee.matchesPattern('Object.prototype.hasOwnProperty.call'))
        const attrsCallback = target === reference && callee.isMemberExpression() && !callee.node.computed && callee.node.property.name === 'attrs' && ['ArrowFunctionExpression', 'FunctionExpression'].includes(binding.path.node.init?.type)
        if (!readOnlyObjectCall && !attrsCallback) fail(name, 'class-recipe-binding-escape')
        return
      }
      // Property reads are supported; handing the whole mutable recipe to an
      // alias, callback or object requires a separately reviewed pattern.
      if (target === reference && !(parent.isUnaryExpression() && parent.node.operator === 'typeof')) fail(name, 'class-recipe-binding-escape')
    }
  })
  return [...violations.values()]
}

const analyzePilotGuardFile = ({ file, source, ruleset }) => {
  const fileRules = ruleset.rules.filter(rule => rule.file === file)
  const skips = []
  const preservations = []
  let ast
  const needsJavaScript = fileRules.some(rule => rule.allowedBaseUiSources !== undefined || rule.classNamePolicy || rule.tailwindConfig || ((rule.typographyPolicy || rule.semanticColorPolicy) && JS_EXTENSIONS.has(path.extname(file))))
  if (needsJavaScript) {
    if (!JS_EXTENSIONS.has(path.extname(file))) {
      return { changes: [], skips: [{ file, reason: 'unsupported-pilot-guard-format', detail: path.extname(file) || 'no extension' }], preservations }
    }
    ast = parseJavaScript(source, file)
  }

  for (const rule of fileRules) {
    if (!validPilotGuardRule(rule)) {
      skips.push({ file, rule: rule.id, reason: 'invalid-pilot-guard-rule' })
      continue
    }
    if (rule.allowedBaseUiSources !== undefined) {
      const allowed = new Set(rule.allowedBaseUiSources)
      walk(ast, statement => {
        let reference
        let isModuleReference = false
        if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(statement.type) && statement.source) {
          reference = statement.source
          isModuleReference = true
        }
        if (statement.type === 'CallExpression' && (statement.callee.type === 'Import' || (statement.callee.type === 'Identifier' && statement.callee.name === 'require'))) {
          reference = statement.arguments[0]
          isModuleReference = true
        }
        const imported = reference?.type === 'StringLiteral' ? reference.value : reference?.type === 'TemplateLiteral' && reference.expressions.length === 0 ? reference.quasis[0].value.cooked : undefined
        if (isModuleReference && typeof imported !== 'string' && source.includes('@base-ui')) skips.push({ file, rule: rule.id, reason: 'unclassified-base-ui-module-reference', expression: source.slice(statement.start, statement.end) })
        if (typeof imported !== 'string') return
        if ((imported === '@base-ui/react' || imported.startsWith('@base-ui/react/')) && !allowed.has(imported)) {
          skips.push({ file, rule: rule.id, reason: 'direct-base-ui-import', detail: imported })
        }
      })
    }
    if (rule.tailwindConfig) {
      const config = findTailwindConfig(ast)
      if (!config || config.prefix !== rule.tailwindConfig.prefix || config.corePlugins?.preflight !== false || stableJson(config.content) !== stableJson(rule.tailwindConfig.content)) {
        skips.push({ file, rule: rule.id, reason: 'tailwind-config-mismatch', detail: { expected: rule.tailwindConfig, observed: config ?? null } })
      }
    }
    if (rule.classNamePolicy) {
      for (const violation of recipeBindingViolations(ast, rule.classNameBindings ?? [])) skips.push({ file, rule: rule.id, ...violation })
      // Class recipes may live outside .attrs(...). Pin the reviewed local
      // helper/map initializers so an unchanged call cannot hide a new class.
      for (const binding of rule.classNameBindings ?? []) {
        const declarations = ast.program.body.flatMap(statement => {
          const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
          return declaration?.type === 'VariableDeclaration' && declaration.kind === 'const'
            ? declaration.declarations.filter(node => node.id.type === 'Identifier' && node.id.name === binding.name)
            : []
        })
        const initializer = declarations.length === 1 ? declarations[0].init : null
        if (!initializer || sha256(source.slice(initializer.start, initializer.end)) !== binding.sha256) {
          skips.push({ file, rule: rule.id, reason: 'class-recipe-binding-mismatch', expression: binding.name })
        } else if (!supportedRecipeInitializer(initializer)) {
          skips.push({ file, rule: rule.id, reason: 'class-recipe-binding-unsupported-shape', expression: binding.name })
        } else {
          preservations.push({ file, rule: rule.id, expression: binding.name, reason: binding.reason, evidence: binding.evidence })
        }
      }
      const allowed = new Set(rule.classNamePolicy.allow)
      const dynamicPreservations = new Map((rule.dynamicClassNames ?? []).map(item => [item.match, item]))
      const matchedDynamicPreservations = new Set()
      for (const candidate of classNameCandidates(source, ast)) {
        if (candidate.dynamic) {
          const preservation = dynamicPreservations.get(candidate.expression)
          if (preservation) {
            matchedDynamicPreservations.add(candidate.expression)
            preservations.push({ file, rule: rule.id, expression: candidate.expression, reason: preservation.reason, evidence: preservation.evidence })
          } else {
            skips.push({ file, rule: rule.id, reason: 'unclassified-dynamic-classname', expression: candidate.expression })
          }
        }
        for (const token of candidate.values.flatMap(value => value.split(/\s+/)).filter(Boolean)) {
          if (allowed.has(token)) continue
          if (token.includes('[') || token.includes(']')) {
            skips.push({ file, rule: rule.id, reason: 'tailwind-arbitrary-class', expression: token })
            continue
          }
          const utility = token.split(':').at(-1).replace(/^!/, '').replace(/^-/, '')
          if (!utility.startsWith(rule.classNamePolicy.prefix)) {
            skips.push({ file, rule: rule.id, reason: 'unprefixed-pilot-class', expression: token })
          }
        }
      }
      for (const expression of dynamicPreservations.keys()) {
        if (!matchedDynamicPreservations.has(expression)) skips.push({ file, rule: rule.id, reason: 'dynamic-classname-preservation-not-found', expression })
      }
    }
    if (rule.typographyPolicy) {
      try {
        const allowed = new Set(rule.typographyPolicy.roles.map(typographyRoleVariable))
        const exceptions = new Map((rule.typographyPolicy.exceptions ?? []).map(item => [`${item.component}\0${item.property}\0${item.match}\0${item.context}`, item]))
        const matchedExceptions = new Set()
        const candidates = typographyCandidates({ file, source, ast })
        const candidateCounts = new Map()
        for (const candidate of candidates) {
          const key = `${candidate.component}\0${candidate.property}\0${candidate.expression}\0${candidate.context}`
          candidateCounts.set(key, (candidateCounts.get(key) ?? 0) + 1)
        }
        for (const candidate of candidates) {
          if (candidate.unresolvedBinding) {
            skips.push({ file, rule: rule.id, component: candidate.component, property: candidate.property, expression: candidate.expression, context: candidate.context, reason: 'unresolved-inline-style-binding' })
            continue
          }
          const expression = unwrapStaticString(candidate.expression)
          if (allowed.has(expression)) continue
          const key = `${candidate.component}\0${candidate.property}\0${candidate.expression}\0${candidate.context}`
          const exception = exceptions.get(key)
          if (exception) {
            matchedExceptions.add(key)
            if (candidateCounts.get(key) !== exception.count) {
              skips.push({ file, rule: rule.id, component: candidate.component, property: candidate.property, expression: candidate.expression, context: candidate.context, reason: 'typography-exception-count-mismatch', detail: { expected: exception.count, observed: candidateCounts.get(key) } })
            } else if (!preservations.some(item => item.rule === rule.id && item.expression === candidate.expression && item.context === candidate.context)) {
              preservations.push({ file, rule: rule.id, expression: candidate.expression, context: candidate.context, count: exception.count, reason: exception.reason, evidence: exception.evidence })
            }
          } else {
            skips.push({ file, rule: rule.id, component: candidate.component, property: candidate.property, expression: candidate.expression, context: candidate.context, reason: 'local-typography-size' })
          }
        }
        for (const [key, exception] of exceptions) {
          if (!matchedExceptions.has(key)) skips.push({ file, rule: rule.id, component: exception.component, property: exception.property, expression: exception.match, context: exception.context, reason: 'typography-exception-not-found' })
        }
      } catch (error) {
        skips.push({ file, rule: rule.id, reason: 'typography-guard-parse-error', detail: error.reason ?? error.message })
      }
    }
    if (rule.semanticColorPolicy) {
      try {
        const exceptions = new Map(rule.semanticColorPolicy.exceptions.map(item => [`${item.component}\0${item.property}\0${item.match}\0${item.context}`, item]))
        const matchedExceptions = new Set()
        const candidates = semanticColorCandidates({ file, source, ast })
        const candidateCounts = new Map()
        for (const candidate of candidates) {
          const key = `${candidate.component}\0${candidate.property}\0${candidate.expression}\0${candidate.context}`
          candidateCounts.set(key, (candidateCounts.get(key) ?? 0) + 1)
        }
        for (const candidate of candidates) {
          if (candidate.unresolvedBinding) {
            skips.push({ file, rule: rule.id, component: candidate.component, property: candidate.property, expression: candidate.expression, context: candidate.context, reason: 'unresolved-inline-style-binding' })
            continue
          }
          if (semanticColorExpression(candidate.expression)) continue
          const key = `${candidate.component}\0${candidate.property}\0${candidate.expression}\0${candidate.context}`
          const exception = exceptions.get(key)
          if (!exception) {
            skips.push({ file, rule: rule.id, component: candidate.component, property: candidate.property, expression: candidate.expression, context: candidate.context, reason: 'ungoverned-color' })
            continue
          }
          matchedExceptions.add(key)
          if (candidateCounts.get(key) !== exception.count) {
            skips.push({ file, rule: rule.id, component: candidate.component, property: candidate.property, expression: candidate.expression, context: candidate.context, reason: 'semantic-color-exception-count-mismatch', detail: { expected: exception.count, observed: candidateCounts.get(key) } })
          } else if (!preservations.some(item => item.rule === rule.id && item.expression === candidate.expression && item.context === candidate.context && item.reason === exception.reason)) {
            preservations.push({ file, rule: rule.id, expression: candidate.expression, context: candidate.context, count: exception.count, reason: exception.reason, evidence: exception.evidence })
          }
        }
        for (const [key, exception] of exceptions) {
          if (!matchedExceptions.has(key)) skips.push({ file, rule: rule.id, component: exception.component, property: exception.property, expression: exception.match, context: exception.context, reason: 'semantic-color-exception-not-found' })
        }
      } catch (error) {
        skips.push({ file, rule: rule.id, reason: 'semantic-color-guard-parse-error', detail: error.reason ?? error.message })
      }
    }
    if (rule.forbidTailwindBase === true) {
      try {
        const css = postcss.parse(source, { from: file })
        css.walkAtRules('tailwind', atRule => {
          if (atRule.params.trim() === 'base') skips.push({ file, rule: rule.id, reason: 'tailwind-preflight-enabled' })
        })
      } catch (error) {
        skips.push({ file, rule: rule.id, reason: 'css-parse-error', detail: error.reason ?? error.message })
      }
    }
    if (rule.tailwindCssPolicy) {
      try {
        const css = postcss.parse(source, { from: file })
        const selectorContracts = new Map((rule.tailwindCssPolicy.selectorContracts ?? []).map(contract => [contract.selector, contract]))
        const matchedSelectorContracts = new Set()
        const inspectToken = (token, contract) => {
          if (contract?.classes.includes(token)) return
          if (token.includes('[') || token.includes(']')) {
            skips.push({ file, rule: rule.id, reason: 'tailwind-arbitrary-class', expression: token })
            return
          }
          const utility = token.split(':').at(-1).replace(/^!/, '').replace(/^-/, '')
          if (!utility.startsWith(rule.tailwindCssPolicy.prefix)) skips.push({ file, rule: rule.id, reason: 'unprefixed-pilot-class', expression: token })
        }
        css.walkRules(cssRule => {
          const selector = normalizeCssSelector(cssRule.selector)
          // Validate raw syntax before normalization, which otherwise could
          // collapse non-CSS whitespace inside an identifier into a match.
          const contract = SIMPLE_CSS_SELECTOR.test(cssRule.selector) ? selectorContracts.get(selector) : undefined
          if (contract) matchedSelectorContracts.add(selector)
          for (const token of selectorClasses(cssRule.selector)) inspectToken(token, contract)
        })
        css.walkAtRules('apply', atRule => {
          for (const token of atRule.params.split(/\s+/).filter(Boolean)) inspectToken(token)
        })
        for (const contract of selectorContracts.values()) {
          if (matchedSelectorContracts.has(contract.selector)) {
            preservations.push({ file, rule: rule.id, expression: contract.selector, reason: contract.reason, evidence: contract.evidence })
          } else {
            skips.push({ file, rule: rule.id, reason: 'selector-contract-not-found', expression: contract.selector })
          }
        }
      } catch (error) {
        skips.push({ file, rule: rule.id, reason: 'css-parse-error', detail: error.reason ?? error.message })
      }
    }
  }
  return { changes: [], skips, preservations }
}

const analyzeFile = ({ file, source, ruleset }) => {
  if (ruleset.categories?.includes('pilot-guards')) return analyzePilotGuardFile({ file, source, ruleset })
  if (!JS_EXTENSIONS.has(path.extname(file))) {
    return { changes: [], skips: [{ file, reason: 'unsupported-format', detail: path.extname(file) || 'no extension' }], preservations: [] }
  }
  if (ruleset.categories?.includes('imports')) return analyzeImportFile({ file, source, ruleset })
  const collectedCandidates = collectStyledCandidates(source, file)
  const candidates = ruleset.categories?.includes('typography')
    ? collectedCandidates.filter(candidate => candidate.kind === 'css-parse-error' || ['font-size', 'font'].includes(candidate.property) || (candidate.property === null && !candidate.structure?.includes('tagged:css') && /(?:font-size|fontSize|typograph[^;{}]*size|(?:^|\W)size(?:\W|$))/i.test(candidate.expression)))
    : collectedCandidates
  const fileRules = ruleset.rules.filter(rule => rule.file === file)
  const filePreservations = (ruleset.preservations ?? []).filter(rule => rule.file === file)
  const changes = []
  const skips = []
  const preservations = []

  for (const rule of fileRules.filter(rule => !STYLE_RULE_KINDS.has(rule.kind))) {
    skips.push({ file, rule: rule.id, reason: 'unsupported-rule-kind', detail: rule.kind })
  }

  for (const candidate of candidates) {
    if (candidate.kind === 'css-parse-error') {
      skips.push({ file, component: candidate.component, reason: 'css-parse-error', detail: candidate.detail })
      continue
    }
    const locationRules = fileRules.filter(rule => STYLE_RULE_KINDS.has(rule.kind) && sameLocation(rule, candidate))
    const matches = locationRules.filter(rule => matchesCandidate(rule, candidate))
    const preserveMatches = filePreservations.filter(rule => STYLE_RULE_KINDS.has(rule.kind) && matchesCandidate(rule, candidate))

    if (matches.length > 0 && preserveMatches.length > 0) {
      skips.push({ file, component: candidate.component, property: candidate.property, expression: candidate.expression, rules: [...matches, ...preserveMatches].map(rule => rule.id).sort(), reason: 'conflicting-rule-and-preservation' })
    } else if (matches.length > 1 || preserveMatches.length > 1) {
      skips.push({ file, component: candidate.component, property: candidate.property, expression: candidate.expression, rules: [...matches, ...preserveMatches].map(rule => rule.id).sort(), reason: 'conflicting-rules' })
    } else if (matches.length === 1) {
      const rule = matches[0]
      if (rule.replace === candidate.expression) continue
      changes.push({ file, component: candidate.component, property: candidate.property, rule: rule.id, start: candidate.start, end: candidate.end, before: candidate.expression, after: rule.replace })
    } else if (locationRules.some(rule => rule.replace === candidate.expression)) {
      continue
    } else if (preserveMatches.length === 1) {
      const preserve = preserveMatches[0]
      preservations.push({ file, component: candidate.component, property: candidate.property, rule: preserve.id, reason: preserve.reason, evidence: preserve.evidence })
    } else if (locationRules.length > 0) {
      skips.push({ file, component: candidate.component, property: candidate.property, expression: candidate.expression, rules: locationRules.map(rule => rule.id).sort(), reason: 'expression-mismatch' })
    } else {
      skips.push({ file, component: candidate.component, property: candidate.property, expression: candidate.expression, reason: candidate.kind === 'static-declaration' ? 'unclassified-static-declaration' : 'unclassified-expression' })
    }
  }

  for (const rule of fileRules.filter(rule => STYLE_RULE_KINDS.has(rule.kind))) {
    if (!candidates.some(candidate => matchesCandidate(rule, candidate))) {
      const alreadyApplied = candidates.some(candidate => sameLocation(rule, candidate) && candidate.expression === rule.replace)
      if (!alreadyApplied) skips.push({ file, rule: rule.id, reason: 'rule-not-found' })
    }
  }
  for (const preservation of filePreservations.filter(rule => STYLE_RULE_KINDS.has(rule.kind))) {
    if (!candidates.some(candidate => matchesCandidate(preservation, candidate))) {
      skips.push({ file, rule: preservation.id, reason: 'preservation-not-found' })
    }
  }
  return { changes, skips, preservations }
}

const applyReplacements = (source, replacements) => {
  let output = source
  for (const item of [...replacements].sort((a, b) => b.start - a.start)) {
    output = `${output.slice(0, item.start)}${item.after}${output.slice(item.end)}`
  }
  return output
}

const lineNumber = (source, offset) => source.slice(0, offset).split('\n').length

const conciseDiff = (file, source, changes) => {
  if (changes.length === 0) return ''
  const lines = [`--- a/${file}`, `+++ b/${file}`]
  for (const change of changes) {
    const line = lineNumber(source, change.start)
    lines.push(`@@ -${line},1 +${line},1 @@ ${change.rule}`, `-${change.before}`, `+${change.after}`)
  }
  return `${lines.join('\n')}\n`
}

const readInputs = async (rootDir, allowlist) => {
  const entries = []
  const realRoot = await fs.realpath(rootDir)
  for (const file of allowlist) {
    const target = path.join(rootDir, file)
    const realTarget = await fs.realpath(target)
    if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${path.sep}`)) {
      throw new Error(`Allowlisted file resolves outside the repository: ${file}`)
    }
    const source = await fs.readFile(realTarget, 'utf8')
    const metadata = await fs.stat(realTarget)
    entries.push({ file, source, sha256: sha256(source), mode: metadata.mode & 0o7777 })
  }
  return entries
}

export const inspectMigration = async ({ rootDir = process.cwd(), ruleset, rulesHash, allowlist }) => {
  const files = normalizeAllowlist(rootDir, allowlist)
  const inputs = await readInputs(rootDir, files)
  const result = { schemaVersion: SCHEMA_VERSION, ruleset: ruleset.id, rulesHash, ...(ruleset.categories && { categories: ruleset.categories }), files: [], changes: [], skips: [], preservations: [], consumerUsages: [] }
  for (const input of inputs) {
    const analysis = analyzeFile({ file: input.file, source: input.source, ruleset })
    result.files.push({ path: input.file, sha256: input.sha256 })
    result.changes.push(...analysis.changes)
    result.skips.push(...analysis.skips)
    result.preservations.push(...analysis.preservations)
    result.consumerUsages.push(...(analysis.consumerUsages ?? []))
  }
  if (ruleset.categories?.includes('imports') && result.skips.length > 0) result.changes = []
  return result
}

export const createPreview = async (options) => {
  const inspection = await inspectMigration(options)
  const inputs = await readInputs(options.rootDir ?? process.cwd(), inspection.files.map(file => file.path))
  const byFile = new Map(inspection.changes.map(change => [change.file, []]))
  inspection.changes.forEach(change => byFile.get(change.file).push(change))
  const outputs = inputs.flatMap(input => {
    const changes = byFile.get(input.file) ?? []
    if (changes.length === 0) return []
    const output = applyReplacements(input.source, changes)
    return [{ path: input.file, beforeSha256: input.sha256, afterSha256: sha256(output), diff: conciseDiff(input.file, input.source, changes) }]
  })
  const payload = { ...inspection, outputs }
  return { ...payload, id: sha256(stableJson(payload)) }
}

export const validatePreviewDocument = (preview) => {
  if (preview?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(preview.files) || !Array.isArray(preview.changes) || !Array.isArray(preview.skips) || !Array.isArray(preview.outputs)) {
    throw new Error('Invalid preview document')
  }
  const { id, ...payload } = preview
  if (!id || sha256(stableJson(payload)) !== id) throw new Error('Preview identifier does not match its contents')
}

const validateOutputs = (outputs, { validateStyledCss = true } = {}) => {
  for (const output of outputs) {
    if (JS_EXTENSIONS.has(path.extname(output.file))) {
      parseJavaScript(output.source, output.file)
      if (validateStyledCss) {
        const parseError = collectStyledCandidates(output.source, output.file).find(candidate => candidate.kind === 'css-parse-error')
        if (parseError) throw new Error(`Invalid styled CSS output in ${output.file}: ${parseError.detail}`)
      }
    }
  }
}

export const applyPreview = async ({ rootDir = process.cwd(), preview, previewId, allowlist, failAfterWrites = Infinity }) => {
  validatePreviewDocument(preview)
  if (!previewId || previewId !== preview.id) throw new Error('Apply preview identifier does not match the reviewed identifier')
  if (preview.categories?.includes('pilot-guards')) throw new Error('Pilot guard previews are read-only and cannot be applied')
  if (preview.skips.length > 0) throw new Error('Preview contains unresolved skips and cannot be applied')
  const normalized = normalizeAllowlist(rootDir, allowlist, { forWrite: true })
  const previewFiles = preview.files.map(file => file.path).sort()
  if (stableJson(normalized) !== stableJson(previewFiles)) throw new Error('Apply allowlist does not match preview allowlist')
  const current = await readInputs(rootDir, normalized)
  for (const input of current) {
    const expected = preview.files.find(file => file.path === input.file)
    if (!expected || expected.sha256 !== input.sha256) throw new Error(`Stale preview input: ${input.file}`)
  }
  const changesByFile = new Map()
  preview.changes.forEach(change => {
    if (!normalized.includes(change.file)) throw new Error(`Preview change is outside its allowlist: ${change.file}`)
    if (!changesByFile.has(change.file)) changesByFile.set(change.file, [])
    changesByFile.get(change.file).push(change)
  })
  const outputs = current.flatMap(input => {
    const changes = changesByFile.get(input.file) ?? []
    if (changes.length === 0) return []
    const ordered = [...changes].sort((a, b) => a.start - b.start)
    for (let index = 0; index < ordered.length; index += 1) {
      const change = ordered[index]
      if (!Number.isInteger(change.start) || !Number.isInteger(change.end) || change.start < 0 || change.end < change.start || input.source.slice(change.start, change.end) !== change.before) {
        throw new Error(`Preview range no longer matches source: ${input.file}`)
      }
      if (index > 0 && ordered[index - 1].end > change.start) throw new Error(`Preview contains overlapping changes: ${input.file}`)
    }
    return [{ file: input.file, source: applyReplacements(input.source, changes), mode: input.mode, input, changes }]
  })
  validateOutputs(outputs, { validateStyledCss: !preview.categories?.includes('imports') })
  const expectedOutputs = outputs.map(output => ({
    path: output.file,
    beforeSha256: output.input.sha256,
    afterSha256: sha256(output.source),
    diff: conciseDiff(output.file, output.input.source, output.changes)
  }))
  if (stableJson(expectedOutputs) !== stableJson(preview.outputs)) throw new Error('Preview outputs do not reproduce from the reviewed changes')

  const transactionId = `${process.pid}-${randomUUID()}`
  const staged = []
  const promoted = []
  try {
    for (const output of outputs) {
      const target = path.join(rootDir, output.file)
      const temp = `${target}.brand-system-${transactionId}.tmp`
      const backup = `${target}.brand-system-${transactionId}.bak`
      await fs.writeFile(temp, output.source, { encoding: 'utf8', mode: output.mode })
      await fs.chmod(temp, output.mode)
      staged.push({ target, temp, backup })
    }
    for (const item of staged) {
      await fs.rename(item.target, item.backup)
      try {
        await fs.rename(item.temp, item.target)
      } catch (error) {
        await fs.rename(item.backup, item.target)
        throw error
      }
      promoted.push(item)
      if (promoted.length >= failAfterWrites) throw new Error('Injected mid-write failure')
    }
    await Promise.all(promoted.map(item => fs.unlink(item.backup).catch(() => {})))
  } catch (error) {
    for (const item of [...promoted].reverse()) {
      await fs.unlink(item.target).catch(() => {})
      await fs.rename(item.backup, item.target).catch(() => {})
    }
    await Promise.all(staged.map(item => fs.unlink(item.temp).catch(() => {})))
    throw error
  }
  return { applied: outputs.map(output => output.file), previewId: preview.id }
}

export const verifyMigration = async (options) => {
  const inspection = await inspectMigration(options)
  return { ...inspection, ok: inspection.changes.length === 0 && inspection.skips.length === 0 }
}
