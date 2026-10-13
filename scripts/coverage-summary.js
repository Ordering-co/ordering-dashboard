#!/usr/bin/env node
/**
 * Print Vitest coverage average used by CI:
 * (statements + branches + functions + lines) / 4
 *
 * Usage: pnpm test:coverage:summary
 * (runs vitest coverage first, then prints the summary)
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const coverageFile = path.join(root, 'coverage', 'coverage-final.json')

const runCoverage = process.argv.includes('--no-run') === false
if (runCoverage) {
  const result = spawnSync('pnpm', ['exec', 'vitest', '--coverage', '--run'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

if (!fs.existsSync(coverageFile)) {
  console.error(`Coverage file not found: ${coverageFile}`)
  console.error('Run `pnpm test:coverage` first, or omit --no-run.')
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(coverageFile, 'utf8'))
const total = {
  statements: { total: 0, covered: 0 },
  branches: { total: 0, covered: 0 },
  functions: { total: 0, covered: 0 },
  lines: { total: 0, covered: 0 }
}

Object.values(data).forEach((fileData) => {
  if (fileData?.s) {
    Object.values(fileData.s).forEach((v) => {
      total.statements.total++
      if (v > 0) total.statements.covered++
    })
  }
  if (fileData?.b) {
    Object.values(fileData.b).forEach((branch) => {
      total.branches.total += branch.length
      total.branches.covered += branch.filter((v) => v > 0).length
    })
  }
  if (fileData?.f) {
    Object.values(fileData.f).forEach((v) => {
      total.functions.total++
      if (v > 0) total.functions.covered++
    })
  }
  if (fileData?.l) {
    Object.values(fileData.l).forEach((v) => {
      total.lines.total++
      if (v > 0) total.lines.covered++
    })
  } else if (fileData?.s) {
    Object.values(fileData.s).forEach((v) => {
      total.lines.total++
      if (v > 0) total.lines.covered++
    })
  }
})

const pct = (covered, all) => (all > 0 ? (covered / all) * 100 : 0)
const statements = pct(total.statements.covered, total.statements.total)
const branches = pct(total.branches.covered, total.branches.total)
const functions = pct(total.functions.covered, total.functions.total)
const lines = pct(total.lines.covered, total.lines.total)
const average = (statements + branches + functions + lines) / 4
const round = (n) => Math.round(n * 100) / 100

console.log('')
console.log('Coverage summary (CI formula)')
console.log('-----------------------------')
console.log(`Statements : ${round(statements)}%`)
console.log(`Branches   : ${round(branches)}%`)
console.log(`Functions  : ${round(functions)}%`)
console.log(`Lines      : ${round(lines)}%`)
console.log(`Average    : ${round(average)}%  (threshold: 70%)`)
console.log('')
console.log(average >= 70 ? '✅ Meets 70% gate' : '❌ Below 70% gate')
