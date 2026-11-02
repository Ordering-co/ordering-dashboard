import { describe, expect, it } from 'vitest'

import * as dashboardFeatureAccess from '../dashboardFeatureAccess'

const {
  BUILDER_ALLOWED_LEVELS,
  DASHBOARD_FEATURE_RULES,
  SCHOOLS_ALLOWED_LEVELS,
  canAccessBuilder,
  canAccessSchoolsPage,
  getConnectVisualAccess,
  isDashboardFeatureEnabled
} = dashboardFeatureAccess

describe('isDashboardFeatureEnabled', () => {
  it('shows cleaned features without plan, PostHog, or project age', () => {
    expect(isDashboardFeatureEnabled({ featureKey: 'campaign' })).toBe(true)
    expect(isDashboardFeatureEnabled({ featureKey: 'connect' })).toBe(true)
    expect(isDashboardFeatureEnabled({ featureKey: 'upselling' })).toBe(true)
  })

  it('keeps unknown features visible by default so new locks are opt-in', () => {
    expect(isDashboardFeatureEnabled({ featureKey: 'reports' })).toBe(true)
  })

  it('keeps school module off until its setting is enabled', () => {
    expect(isDashboardFeatureEnabled({
      featureKey: 'schools',
      configs: {}
    })).toBe(false)
    expect(isDashboardFeatureEnabled({
      featureKey: 'schools',
      configs: { school_module_enabled: { value: '0' } }
    })).toBe(false)
  })

  it('ignores the legacy school_module project feature', () => {
    expect(isDashboardFeatureEnabled({
      featureKey: 'schools',
      configs: { school_module: { value: true } }
    })).toBe(false)
  })

  it('shows school module only when the setting is on', () => {
    expect(isDashboardFeatureEnabled({
      featureKey: 'schools',
      configs: { school_module_enabled: { value: true } }
    })).toBe(true)
    expect(isDashboardFeatureEnabled({
      featureKey: 'schools',
      configs: { school_module_enabled: { value: '1' } }
    })).toBe(true)
  })

  it('lets a later setting lock be added in the rules map', () => {
    expect(DASHBOARD_FEATURE_RULES.schools).toEqual({
      mode: 'setting',
      configKey: 'school_module_enabled'
    })
    expect(isDashboardFeatureEnabled({
      featureKey: 'claude_plugins',
      configs: {},
      rules: {
        ...DASHBOARD_FEATURE_RULES,
        claude_plugins: { mode: 'setting', configKey: 'claude_plugins_module' }
      }
    })).toBe(false)
    expect(isDashboardFeatureEnabled({
      featureKey: 'claude_plugins',
      configs: { claude_plugins_module: { value: true } },
      rules: {
        ...DASHBOARD_FEATURE_RULES,
        claude_plugins: { mode: 'setting', configKey: 'claude_plugins_module' }
      }
    })).toBe(true)
  })
})

describe('Builder access', () => {
  it('is not limited to a list of projects', () => {
    expect(dashboardFeatureAccess.BUILDER_PROJECTS).toBeUndefined()
    expect(dashboardFeatureAccess.isBuilderProject).toBeUndefined()
  })

  it('is for administrators only, like My products', () => {
    expect(BUILDER_ALLOWED_LEVELS).toEqual([0])
    expect(canAccessBuilder(0)).toBe(true)
    expect(canAccessBuilder(2)).toBe(false)
    expect(canAccessBuilder(5)).toBe(false)
    expect(canAccessBuilder(undefined)).toBe(false)
  })
})

describe('SCHOOLS_ALLOWED_LEVELS', () => {
  it('lets administrators and business owners open Schools', () => {
    expect(SCHOOLS_ALLOWED_LEVELS).toEqual([0, 2])
    expect(canAccessSchoolsPage(0)).toBe(true)
    expect(canAccessSchoolsPage(2)).toBe(true)
    expect(canAccessSchoolsPage(5)).toBe(false)
    expect(canAccessSchoolsPage(undefined)).toBe(false)
  })
})

describe('plan gates', () => {
  it('has no plan_modules master key: plan never hides dashboard UI', () => {
    expect(DASHBOARD_FEATURE_RULES.plan_modules).toBeUndefined()
    expect(dashboardFeatureAccess.PLAN_MODULES_FEATURE_KEY).toBeUndefined()
    expect(dashboardFeatureAccess.isPlanModuleEnabled).toBeUndefined()
  })

  it('ignores plan configs entirely', () => {
    const configs = { plan_pro: { value: false }, plan_enterprise: { value: false } }
    expect(isDashboardFeatureEnabled({ featureKey: 'campaign', configs })).toBe(true)
    expect(isDashboardFeatureEnabled({ featureKey: 'reports', configs })).toBe(true)
  })
})

describe('getConnectVisualAccess', () => {
  it('enables Campaign and Connect without PostHog flags or plan configs', () => {
    const access = getConnectVisualAccess()

    expect(access.marketingCampaigns).toBe(true)
    expect(access.showConnectTab).toBe(true)
    expect(access.connectDeliveryServices).toBe(true)
    expect(access.connectPosMenuSync).toBe(true)
    expect(access.connectImporters).toBe(true)
    expect(access.connectSalesChannels).toBe(true)
  })
})
