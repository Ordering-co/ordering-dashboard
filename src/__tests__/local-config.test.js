import { afterEach, describe, expect, it, vi } from 'vitest'

const base = {
  project: 'tenant-a',
  configurations: { subdomain: 'tenant-a' },
  api: { url: 'https://api.test', version: 'v400', language: 'en' },
  socket: { url: 'https://sockets.test' },
  use_project_domain: true
}

afterEach(() => {
  delete window.__CONFIG__
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
