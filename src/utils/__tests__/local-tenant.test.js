import { describe, expect, it } from 'vitest'
import { applyLocalProjectPin, getDashboardStorageKey, getLocalProjectPin } from '../local-tenant'

const settings = { localProjectConfigured: true, project: 'tenant-a', api: { url: 'https://api.test', version: 'v400' } }

describe('local tenant configuration', () => {
  it('pins configured local projects but leaves the template and hosted discovery alone', () => {
    expect(getLocalProjectPin(settings, true)).toBe('tenant-a')
    expect(getLocalProjectPin(settings, false)).toBeNull()
    expect(applyLocalProjectPin({ ...settings, local_project_pin: getLocalProjectPin(settings, false) }, {
      project: 'hosted-selection', local_project_pin: 'injected'
    })).toEqual({ project: 'hosted-selection', localProjectConfigured: true, local_project_pin: null })
    expect(getLocalProjectPin({ localProjectConfigured: true, project: 'your-project-slug' }, true)).toBeNull()
    expect(getLocalProjectPin({ localProjectConfigured: true, project: '   ' }, true)).toBeNull()
  })

  it('separates identities by project, API host and API version while sharing language', () => {
    const local = { ...settings, localProjectConfigured: true, local_project_pin: settings.project }
    const key = getDashboardStorageKey(local, 'token')
    for (const other of [
      { ...local, localProjectConfigured: true, local_project_pin: 'tenant-b' },
      { ...local, api: { ...local.api, url: 'https://other.test' } },
      { ...local, api: { ...local.api, version: 'v500' } }
    ]) expect(getDashboardStorageKey(other, 'token')).not.toBe(key)
    expect(getDashboardStorageKey(local, 'language')).toBe('language')
    expect(getDashboardStorageKey(settings, 'token')).toBe('token')
  })
})

it('leaves historical development configuration unpinned unless the source marker is exactly true', () => {
  for (const marker of [undefined, false, 'true', 1, null]) {
    expect(getLocalProjectPin({ project: 'historical-project', localProjectConfigured: marker }, true)).toBeNull()
  }
  expect(getDashboardStorageKey({ local_project_pin: 'injected' }, 'token')).toBe('token')
})

it('rejects theme/context activation while preserving ordinary unmarked selections', () => {
  expect(applyLocalProjectPin({ localProjectConfigured: false, local_project_pin: null }, {
    project: 'normal-selection', localProjectConfigured: true, local_project_pin: 'injected'
  })).toEqual({ project: 'normal-selection', localProjectConfigured: false, local_project_pin: null })
  expect(applyLocalProjectPin({ localProjectConfigured: true, local_project_pin: 'tenant-a' }, {
    project: 'other', localProjectConfigured: false, local_project_pin: 'other'
  })).toEqual({ project: 'tenant-a', localProjectConfigured: true, local_project_pin: 'tenant-a' })
})
