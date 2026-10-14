import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { configure, doctor, restore, validateManifest } from './core.mjs'

const manifest = validateManifest(JSON.parse(await fs.readFile(new URL('./product.json', import.meta.url), 'utf8')))
const template = await fs.readFile(new URL('../../src/config.json', import.meta.url), 'utf8')

test('Dashboard manifest configures both real project fields and preserves the shipped configuration', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-onboarding-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'src'))
  const filename = path.join(root, 'src/config.json')
  await fs.writeFile(filename, template)
  const request = async (url, options) => {
    assert.equal(new URL(url).pathname, '/v400/en/fixture-dashboard/current')
    assert.equal(options.headers.Authorization, undefined)
    return { ok: true, json: async () => ({ error: false, result: { code: 'fixture-dashboard' } }) }
  }
  const result = await configure(root, manifest, { project: 'fixture-dashboard', confirmProjectChange: true }, request)
  const original = JSON.parse(template)
  assert.deepEqual(JSON.parse(await fs.readFile(filename, 'utf8')), {
    ...original, project: 'fixture-dashboard',
    configurations: { ...original.configurations, subdomain: 'fixture-dashboard' }
  })
  assert.deepEqual(await doctor(root, manifest, request), {
    project: 'fixture-dashboard', verification: { project: true, authenticated: false }
  })
  await restore(root, manifest, result.backup)
  assert.equal(await fs.readFile(filename, 'utf8'), template)
})

test('cleared Dashboard template fields configure without treating an empty placeholder as another tenant', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-onboarding-empty-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'src'))
  const config = { ...JSON.parse(template), project: '', configurations: { subdomain: '' } }
  await fs.writeFile(path.join(root, 'src/config.json'), JSON.stringify(config))
  const request = async () => ({ ok: true, json: async () => ({ error: false, result: { code: 'fixture-dashboard' } }) })
  const result = await configure(root, manifest, { project: 'fixture-dashboard' }, request)
  assert.equal(result.changed, true)
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'src/config.json'), 'utf8')).configurations.subdomain, 'fixture-dashboard')
})
