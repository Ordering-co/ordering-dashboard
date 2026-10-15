import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebStrategy } from '../@/components-dashboard/src/webStrategy'
import { getSessionStorageValues } from '../@/components-dashboard/src/contexts/SessionContext'
import { readStoredDashboardAuth, resolveInitialDashboardProject, shouldResolveDashboardProjectAtBoot } from '../utils/bootTheme'

const base = {
  project: 'tenant-a',
  localProjectConfigured: true,
  configurations: { subdomain: 'tenant-a' },
  api: { url: 'https://api.test', version: 'v400', language: 'en' },
  socket: { url: 'https://sockets.test' },
  use_project_domain: true
}

afterEach(() => {
  delete window.__CONFIG__
  localStorage.clear()
  vi.doUnmock('../config.json')
  vi.resetModules()
})

describe('local source configuration', () => {
  it('preserves the explicit local tenant and API over injected runtime settings', async () => {
    vi.resetModules()
    vi.doMock('../config.json', () => ({ default: base }))
    window.__CONFIG__ = { project: 'tenant-b', api: { url: 'https://other.test' } }
    const { default: settings } = await import('../config')
    expect(settings.project).toBe('tenant-a')
    expect(settings.local_project_pin).toBe('tenant-a')
    expect(settings.api.url).toBe('https://api.test')
    expect(settings.use_project_domain).toBe(true)
  })

  it('keeps the existing runtime resolver for the unconfigured template', async () => {
    vi.resetModules()
    vi.doMock('../config.json', () => ({ default: { ...base, project: 'your-project-slug' } }))
    window.__CONFIG__ = { project: 'tenant-b', api: { url: 'https://other.test' } }
    const { default: settings } = await import('../config')
    expect(settings.project).toBe('tenant-b')
    expect(settings.local_project_pin).toBeNull()
    expect(settings.api.url).toBe('https://other.test')
  })
})

it('preserves a historical DEV project and its global identity when no source marker exists', async () => {
  vi.resetModules()
  const { localProjectConfigured, ...historical } = base
  vi.doMock('../config.json', () => ({ default: { ...historical, use_project_domain: false } }))
  localStorage.setItem('project', 'session-tenant')
  localStorage.setItem('token', 'legacy-token')
  localStorage.setItem('user', JSON.stringify({ id: 1, level: 0 }))
  const { default: settings } = await import('../config')
  expect(settings.local_project_pin).toBeNull()
  expect(settings.localProjectConfigured).toBe(false)
  expect(readStoredDashboardAuth(window, settings)).toBe('legacy-token')
  expect(resolveInitialDashboardProject({ settings, auth: 'legacy-token', storedProject: 'session-tenant', isDevelopment: true })).toBe('session-tenant')
  const strategy = new WebStrategy(settings)
  await expect(getSessionStorageValues(strategy, settings.local_project_pin)).resolves.toMatchObject({
    token: 'legacy-token', project: 'session-tenant', user: { id: 1, level: 0 }
  })
  expect(localStorage.length).toBe(3)
  expect(localStorage.getItem('token')).toBe('legacy-token')
})

it('preserves Worker discovery without a source marker and refuses an injected activation marker', async () => {
  vi.resetModules()
  const { localProjectConfigured, ...historical } = base
  vi.doMock('../config.json', () => ({ default: historical }))
  window.__CONFIG__ = {
    project: 'worker-tenant',
    localProjectConfigured: true,
    local_project_pin: 'injected',
    api: { url: 'https://worker.test' },
    theme: { localProjectConfigured: true }
  }
  const { default: settings } = await import('../config')
  expect(settings.project).toBe('worker-tenant')
  expect(settings.api.url).toBe('https://worker.test')
  expect(settings.local_project_pin).toBeNull()
  expect(settings.localProjectConfigured).toBe(false)
  expect(resolveInitialDashboardProject({ settings, auth: null, storedProject: 'old-tenant', isDevelopment: true, isOrderingSubdomain: false })).toBeNull()
  expect(shouldResolveDashboardProjectAtBoot({ auth: null, useProjectDomain: true, isOrderingSubdomain: false, localProjectPin: settings.local_project_pin })).toBe(true)
})
