/** Project config that turns the School module on (`'1'`) or off (`'0'`). */
export const SCHOOL_MODULE_CONFIG_KEY = 'school_module_enabled'

/** User levels that can open the Schools tab and route. Change here when access expands. */
export const SCHOOLS_ALLOWED_LEVELS = [0, 2]

export const canAccessSchoolsPage = (level) => SCHOOLS_ALLOWED_LEVELS.includes(level)

/** Project allowlist for the Builder section. */
export const BUILDER_PROJECTS = ['development', 'luisv4plus']

/** User levels that can open Builder. Same as My products. */
export const BUILDER_ALLOWED_LEVELS = [0]

export const isBuilderProject = (project) => BUILDER_PROJECTS.includes(project)

export const canAccessBuilder = ({ project, level } = {}) => isBuilderProject(project) && BUILDER_ALLOWED_LEVELS.includes(level)

/**
 * Dashboard visual access.
 *
 * Default is visible. Plan, PostHog, and project age are not used.
 * Opt-in modules stay off until a setting is on. Add a `setting` rule to
 * hide a feature again later without scattering conditions.
 */
export const DASHBOARD_FEATURE_RULES = {
  campaign: { mode: 'always' },
  connect: { mode: 'always' },
  connect_overview: { mode: 'always' },
  connect_delivery_services: { mode: 'always' },
  connect_pos_menu: { mode: 'always' },
  connect_importers: { mode: 'always' },
  connect_sales_channels: { mode: 'always' },
  upselling: { mode: 'always' },
  schools: { mode: 'setting', configKey: SCHOOL_MODULE_CONFIG_KEY }
}

const isTruthyConfigValue = (value) => (
  value === true || value === 1 || value === '1' || value === 'true'
)

export const isDashboardFeatureEnabled = ({
  featureKey,
  configs,
  rules = DASHBOARD_FEATURE_RULES
} = {}) => {
  const rule = rules?.[featureKey]
  if (!rule || rule.mode === 'always') return true
  if (rule.mode === 'setting') {
    const config = configs?.[rule.configKey]
    return isTruthyConfigValue(config?.value ?? config)
  }
  return false
}

export const getConnectVisualAccess = ({ configs } = {}) => {
  const enabled = (featureKey) => isDashboardFeatureEnabled({ featureKey, configs })
  const connectPosMenuSync = enabled('connect_pos_menu')

  return {
    showConnectTab: enabled('connect'),
    connectOverview: enabled('connect_overview'),
    connectDeliveryServices: enabled('connect_delivery_services'),
    connectPosMenuSync,
    connectImporters: enabled('connect_importers') || connectPosMenuSync,
    connectSalesChannels: enabled('connect_sales_channels'),
    marketingCampaigns: enabled('campaign')
  }
}
