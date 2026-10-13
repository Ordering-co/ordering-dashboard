import React from 'react'
import { Redirect, useLocation } from 'react-router-dom'

import { SETTINGS_HUB_PATH, getSettingsRedirectPath } from '~components/utils/settingsRedirects'

export const SettingsLegacyRedirect = ({ from }) => {
  const location = useLocation()
  return (
    <Redirect
      to={getSettingsRedirectPath(from || location.pathname, location.search) || SETTINGS_HUB_PATH}
    />
  )
}
