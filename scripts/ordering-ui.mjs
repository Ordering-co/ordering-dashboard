import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import eslintPackage from 'eslint'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = readFileSync(`${root}brand/ordering-button.registry.json`, 'utf8')
const lock = JSON.parse(readFileSync(`${root}brand/ordering-ui.lock.json`, 'utf8'))
if (createHash('sha256').update(source).digest('hex') !== lock.sha256) throw new Error('Ordering.co registry checksum mismatch')
const registry = JSON.parse(source)
const eslint = new eslintPackage.ESLint({ fix: true })
const destination = `${root}src/@/components-dashboard/src/ui/src/styles/OrderingUi/`
const adapt = content => content
  .replace('import { cva, type VariantProps }', 'import { cva }')
  .replace('import { clsx, type ClassValue }', 'import { clsx }')
  .replace('"@/lib/utils"', '"./utils"')
  .replace('...inputs: ClassValue[]', '...inputs')
  .replace('}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>', '}')
  .replace(/"([^"\n]+)"/g, (literal, value) => /\s/.test(value) || /^size-\d+$/.test(value)
    ? `"${value.split(/\s+/).map(token => `mia:${token}`).join(' ')}"`
    : literal)
for (const file of registry.files) {
  const name = file.path.endsWith('button.tsx') ? 'button.jsx' : 'utils.js'
  const candidate = `// Generated from the locked Ordering.co registry; run pnpm ui:sync.\n${name.endsWith('.jsx') ? "import React from 'react'\n" : ''}${adapt(file.content)}`
  const [linted] = await eslint.lintText(candidate, { filePath: `${destination}${name}` })
  const generated = linted.output || candidate
  if (process.argv.includes('--write')) writeFileSync(`${destination}${name}`, generated)
  else if (readFileSync(`${destination}${name}`, 'utf8') !== generated) throw new Error(`Outdated governed wrapper: ${name}`)
}
console.log('Ordering.co button provenance and adapter verified')
