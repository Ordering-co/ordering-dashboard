import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { configure, doctor, restore, validateManifest } from './core.mjs'

const manifest = validateManifest(JSON.parse(await fs.readFile(new URL('./product.json', import.meta.url), 'utf8')))
const template = JSON.stringify({
  project: 'your-project-slug',
  configurations: { subdomain: 'your-project-slug', custom: true },
  api: { url: 'https://api.example.test', version: 'v400', language: 'en' },
  socket: { url: 'https://sockets.example.test' },
  billing_url: 'https://billing.example.test',
  app_name: 'Fixture Dashboard',
  custom_setting: { preserved: true },
  use_project_domain: true
}, null, 2) + '\n'

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
    ...original, project: 'fixture-dashboard', localProjectConfigured: true,
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


test('historical project needs explicit configure to activate local mode, repeat is no-op, restore removes marker exactly', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-onboarding-marker-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'src'))
  const initial = JSON.stringify({ ...JSON.parse(template), project: 'fixture-dashboard', configurations: { subdomain: 'fixture-dashboard' } }, null, 4) + '\n'
  const filename = path.join(root, 'src/config.json')
  await fs.writeFile(filename, initial)
  const request = async () => ({ ok: true, json: async () => ({ error: false, result: { code: 'fixture-dashboard' } }) })
  const first = await configure(root, manifest, { project: 'fixture-dashboard' }, request)
  assert.equal(first.changed, true)
  assert.equal(JSON.parse(await fs.readFile(filename, 'utf8')).localProjectConfigured, true)
  const repeat = await configure(root, manifest, { project: 'fixture-dashboard' }, request)
  assert.equal(repeat.changed, false)
  assert.equal(repeat.backup, undefined)
  await restore(root, manifest, first.backup)
  assert.equal(await fs.readFile(filename, 'utf8'), initial)
})
