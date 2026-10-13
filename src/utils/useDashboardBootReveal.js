import { useEffect, useState } from 'react'

import {
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

  useEffect(() => {
    const primary = readDashboardPrimary(configs)
    const action = resolveBootRevealAction({
      canReveal: canRevealDashboard({
        sessionLoading,
        configLoading
      }),
      loaded,
      primary,
      currentPrimary: theme?.colors?.primary
    })

    if (action === 'apply-primary') {
      update(mergeThemePrimary(theme, primary))
      return
    }

    if (action === 'idle' && primary && primary !== theme?.colors?.primary) {
      update(mergeThemePrimary(theme, primary))
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
