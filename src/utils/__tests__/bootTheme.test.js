import { describe, expect, it } from 'vitest'

import * as bootTheme from '../bootTheme'

const {
  canRevealDashboard,
  mergeThemePrimary,
  readDashboardPrimary,
  readFirstLoadConfigs,
  readFirstLoadConfigsForProject,
  readStoredDashboardAuth,
  resolveBootRevealAction,
  resolveInitialDashboardProject,
  shouldResolveDashboardProject,
  shouldResolveDashboardProjectAtBoot
} = bootTheme

describe('resolveInitialDashboardProject', () => {
  it('falls back to the configured project for a fresh local origin', () => {
    expect(resolveInitialDashboardProject({
      auth: null,
      storedProject: null,
      settings: { project: 'orderingplus', use_project_domain: false },
      isDevelopment: true
    })).toBe('orderingplus')
  })

  it('preserves the configured project for fixed-project production deployments', () => {
    for (const auth of [null, 'token']) {
      expect(resolveInitialDashboardProject({
        auth,
        storedProject: null,
        settings: { project: 'orderingplus', use_project_domain: false },
        isDevelopment: false
      })).toBe('orderingplus')
    }
  })

  it('prefers the stored project for an authenticated or previously selected tenant', () => {
    expect(resolveInitialDashboardProject({
      auth: 'token',
      storedProject: 'tenant-project',
      settings: { project: 'orderingplus', use_project_domain: false }
    })).toBe('tenant-project')
  })

  it('restores a stored project for a logged-out visitor on an official project-domain host', () => {
    expect(resolveInitialDashboardProject({
      auth: null,
      storedProject: 'tenant-project',
      settings: {
        project: 'orderingplus',
        use_project_domain: true,
        use_project_subdomain: false
      },
      isDevelopment: false,
      isOrderingSubdomain: true
    })).toBe('tenant-project')
  })

  it('keeps custom-domain and project-subdomain discovery ahead of a stored project', () => {
    expect(resolveInitialDashboardProject({
      auth: null,
      storedProject: 'previous-tenant',
      settings: { project: 'orderingplus', use_project_domain: true },
      isDevelopment: false,
      isOrderingSubdomain: false
    })).toBeNull()
    expect(resolveInitialDashboardProject({
      auth: null,
      storedProject: 'previous-tenant',
      settings: {
        project: 'orderingplus',
        use_project_domain: true,
        use_project_subdomain: true
      },
      isDevelopment: false,
      isOrderingSubdomain: true
    })).toBeNull()
  })
})

describe('shouldResolveDashboardProject', () => {
  it('does not replace a typed-project login on an official project-domain host', () => {
    expect(shouldResolveDashboardProject({
      auth: null,
      isOrderingSubdomain: true,
      useProjectDomain: true,
      useProjectSubdomain: false
    })).toBe(false)
  })

  it('keeps custom-domain and configured project-subdomain discovery', () => {
    expect(shouldResolveDashboardProject({
      auth: null,
      isOrderingSubdomain: false,
      useProjectDomain: true,
      useProjectSubdomain: false
    })).toBe(true)
    expect(shouldResolveDashboardProject({
      auth: null,
      isOrderingSubdomain: true,
      useProjectDomain: true,
      useProjectSubdomain: true
    })).toBe(true)
  })

  it('does not discover a project for an authenticated session or when project domains are disabled', () => {
    expect(shouldResolveDashboardProject({
      auth: 'token',
      isOrderingSubdomain: false,
      useProjectDomain: true,
      useProjectSubdomain: false
    })).toBe(false)
    expect(shouldResolveDashboardProject({
      auth: null,
      isOrderingSubdomain: false,
      useProjectDomain: false,
      useProjectSubdomain: false
    })).toBe(false)
  })
})

describe('shouldResolveDashboardProjectAtBoot', () => {
  const officialWorkerState = {
    auth: null,
    isOrderingSubdomain: true,
    useProjectDomain: true,
    useProjectSubdomain: false
  }

  it('recovers with project discovery when an official Worker host has no stored project or first-load configs', () => {
    expect(shouldResolveDashboardProjectAtBoot({
      ...officialWorkerState,
      storedProject: null,
      firstLoadConfigs: null
    })).toBe(true)
  })

  it('does not race a stored project, injected first-load configs, or an authenticated session', () => {
    expect(shouldResolveDashboardProjectAtBoot({
      ...officialWorkerState,
      storedProject: 'tenant-project',
      firstLoadConfigs: null
    })).toBe(false)
    expect(shouldResolveDashboardProjectAtBoot({
      ...officialWorkerState,
      storedProject: null,
      firstLoadConfigs: { dashboard_buttons_colors: { value: '#123456' } }
    })).toBe(false)
    expect(shouldResolveDashboardProjectAtBoot({
      ...officialWorkerState,
      auth: 'token',
      storedProject: null,
      firstLoadConfigs: null
    })).toBe(false)
  })

  it('does not add a new discovery path when project domains are disabled', () => {
    expect(shouldResolveDashboardProjectAtBoot({
      ...officialWorkerState,
      useProjectDomain: false,
      storedProject: null,
      firstLoadConfigs: null
    })).toBe(false)
  })
})

describe('readStoredDashboardAuth', () => {
  const storageWindow = values => ({
    localStorage: {
      getItem: key => values[key] ?? null
    }
  })

  it('returns the token only when the persisted user is a valid object', () => {
    expect(readStoredDashboardAuth(storageWindow({
      token: 'valid-token',
      project: 'tenant-project',
      user: JSON.stringify({ id: 1, level: 0 })
    }))).toBe('valid-token')
  })

  it('treats a missing project or missing, malformed, and scalar users as stale sessions', () => {
    expect(readStoredDashboardAuth(storageWindow({
      token: 'stale-token',
      user: JSON.stringify({ id: 1, level: 0 })
    }))).toBeNull()
    expect(readStoredDashboardAuth(storageWindow({ token: 'stale-token' }))).toBeNull()
    expect(readStoredDashboardAuth(storageWindow({
      token: 'stale-token',
      project: 'tenant-project',
      user: '[object Object]'
    }))).toBeNull()
    expect(readStoredDashboardAuth(storageWindow({
      token: 'stale-token',
      project: 'tenant-project',
      user: JSON.stringify('invalid-user')
    }))).toBeNull()
  })
})

describe('readFirstLoadConfigs', () => {
  it('returns null when first_load is missing', () => {
    expect(readFirstLoadConfigs({})).toBeNull()
    expect(readFirstLoadConfigs({ __FIRST_LOAD__: null })).toBeNull()
  })

  it('reads configs from the worker payload', () => {
    const configs = { dashboard_buttons_colors: { value: '#112233' } }
    expect(readFirstLoadConfigs({ __FIRST_LOAD__: { configs } })).toBe(configs)
  })

  it('reads configs nested under result', () => {
    const configs = { dashboard_buttons_colors: { value: '#445566' } }
    expect(readFirstLoadConfigs({ __FIRST_LOAD__: { result: { configs } } })).toBe(configs)
  })
})

describe('readFirstLoadConfigsForProject', () => {
  const configs = { dashboard_buttons_colors: { value: '' } }
  const workerWindow = (project) => ({
    __CONFIG__: { project },
    __FIRST_LOAD__: { configs }
  })

  it('ignores first_load injected for another project than the session', () => {
    expect(readFirstLoadConfigsForProject('luisv4plus', workerWindow('orderingplus'))).toBeNull()
  })

  it('keeps first_load when the worker resolved the active project', () => {
    expect(readFirstLoadConfigsForProject('mybrand', workerWindow('mybrand'))).toBe(configs)
    expect(readFirstLoadConfigsForProject(' MyBrand ', workerWindow('mybrand'))).toBe(configs)
  })

  it('keeps first_load while the active project is still unresolved', () => {
    expect(readFirstLoadConfigsForProject(null, workerWindow('mybrand'))).toBe(configs)
  })

  it('keeps first_load when the worker project is unknown', () => {
    expect(readFirstLoadConfigsForProject('mybrand', { __FIRST_LOAD__: { configs } })).toBe(configs)
  })

  it('returns null without first_load', () => {
    expect(readFirstLoadConfigsForProject('mybrand', { __CONFIG__: { project: 'mybrand' } })).toBeNull()
  })
})

describe('readDashboardPrimary', () => {
  it('returns null for missing or empty colors', () => {
    expect(readDashboardPrimary(undefined)).toBeNull()
    expect(readDashboardPrimary({})).toBeNull()
    expect(readDashboardPrimary({ dashboard_buttons_colors: { value: '  ' } })).toBeNull()
  })

  it('returns a trimmed custom primary', () => {
    expect(readDashboardPrimary({
      dashboard_buttons_colors: { value: ' #FF5500 ' }
    })).toBe('#FF5500')
  })
})

describe('mergeThemePrimary', () => {
  const theme = {
    colors: {
      primary: '#2C7BE5',
      headingColor: '#344050'
    }
  }

  it('returns the same theme when primary is null', () => {
    expect(mergeThemePrimary(theme, null)).toBe(theme)
  })

  it('sets primary and leaves other colors', () => {
    expect(mergeThemePrimary(theme, '#00AA88')).toEqual({
      colors: {
        primary: '#00AA88',
        headingColor: '#344050'
      }
    })
  })
})

describe('canRevealDashboard', () => {
  it('stays on the skeleton while session or configs are loading', () => {
    expect(canRevealDashboard({ sessionLoading: true, configLoading: false })).toBe(false)
    expect(canRevealDashboard({ sessionLoading: false, configLoading: true })).toBe(false)
  })

  it('reveals after configs fail to load', () => {
    expect(canRevealDashboard({ sessionLoading: false, configLoading: false })).toBe(true)
  })

  it('does not wait on order options for an authenticated user', () => {
    expect(canRevealDashboard({ sessionLoading: false, auth: true, orderLoading: true, configLoading: false })).toBe(true)
  })
})

describe('resolveBootRevealAction', () => {
  it('holds while the dashboard cannot reveal', () => {
    expect(resolveBootRevealAction({
      canReveal: false,
      loaded: false,
      primary: '#FF5500',
      currentPrimary: '#2C7BE5'
    })).toBe('hold')
  })

  it('applies the tenant primary before revealing', () => {
    expect(resolveBootRevealAction({
      canReveal: true,
      loaded: false,
      primary: '#FF5500',
      currentPrimary: '#2C7BE5'
    })).toBe('apply-primary')
  })

  it('reveals when configs settled with no custom primary', () => {
    expect(resolveBootRevealAction({
      canReveal: true,
      loaded: false,
      primary: null,
      currentPrimary: '#2C7BE5'
    })).toBe('reveal')
  })

  it('reveals when the theme already has the tenant primary', () => {
    expect(resolveBootRevealAction({
      canReveal: true,
      loaded: false,
      primary: '#FF5500',
      currentPrimary: '#FF5500'
    })).toBe('reveal')
  })

  it('stays idle after the dashboard is already loaded', () => {
    expect(resolveBootRevealAction({
      canReveal: true,
      loaded: true,
      primary: '#FF5500',
      currentPrimary: '#2C7BE5'
    })).toBe('idle')
  })
})
