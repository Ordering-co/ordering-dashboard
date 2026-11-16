import { useEffect, useState } from 'react'

import {
  TENANT_ACCENT_TOKENS,
  applyTenantAccent,
  canRevealDashboard,
  mergeThemePrimary,
  readDashboardPrimary,
  resolveBootRevealAction
} from './bootTheme'

export const useDashboardBootReveal = ({
  sessionLoading,
  configLoading,
  configs,
  theme,
  update
}) => {
  const [loaded, setLoaded] = useState(false)

  // redesign W0-6 (T0-19): the tenant action color also reaches the Product
  // wrappers, through a dedicated token set on :root before the reveal.
  useEffect(() => {
    applyTenantAccent(configs)
    return () => TENANT_ACCENT_TOKENS.forEach(name => document.documentElement.style.removeProperty(name))
  }, [configs])

  useEffect(() => {
    const primary = readDashboardPrimary(configs)
    // A configured legacy-default color is still an explicit tenant override.
    // Compare the migrated visual role as well, before revealing the dashboard.
    const currentPrimary = theme?.ordering ? theme.ordering.actionOverride : theme?.colors?.primary
    const action = resolveBootRevealAction({
      canReveal: canRevealDashboard({
        sessionLoading,
        configLoading
      }),
      loaded,
      primary,
      currentPrimary
    })

    if (action === 'apply-primary') {
      update(currentTheme => mergeThemePrimary(currentTheme, primary))
      return
    }

    if (action === 'idle' && primary && primary !== currentPrimary) {
      update(currentTheme => mergeThemePrimary(currentTheme, primary))
      return
    }

    if (action === 'reveal') {
      setLoaded(true)
    }
  }, [
    sessionLoading,
    configLoading,
    configs,
    theme,
    update,
    loaded
  ])

  return loaded
}
