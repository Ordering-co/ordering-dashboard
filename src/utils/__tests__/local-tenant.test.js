import { describe, expect, it } from 'vitest'
import { getDashboardStorageKey, getLocalProjectPin } from '../local-tenant'

const settings = { project: 'tenant-a', api: { url: 'https://api.test', version: 'v400' } }

describe('local tenant configuration', () => {
  it('pins configured local projects but leaves the template and hosted discovery alone', () => {
    expect(getLocalProjectPin(settings, true)).toBe('tenant-a')
    expect(getLocalProjectPin(settings, false)).toBeNull()
    expect(getLocalProjectPin({ project: 'your-project-slug' }, true)).toBeNull()
    expect(getLocalProjectPin({ project: '   ' }, true)).toBeNull()
  })

  it('separates identities by project, API host and API version while sharing language', () => {
    const local = { ...settings, local_project_pin: settings.project }
    const key = getDashboardStorageKey(local, 'token')
    for (const other of [
      { ...local, local_project_pin: 'tenant-b' },
      { ...local, api: { ...local.api, url: 'https://other.test' } },
      { ...local, api: { ...local.api, version: 'v500' } }
    ]) expect(getDashboardStorageKey(other, 'token')).not.toBe(key)
    expect(getDashboardStorageKey(local, 'language')).toBe('language')
    expect(getDashboardStorageKey(settings, 'token')).toBe('token')
  })
})
