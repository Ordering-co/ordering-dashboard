import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../../../../index'
import { SETTINGS_MAPS_PATH } from '../../../../../utils/settingsExternalEditors'
import { useIsPathHiddenByReadOnly } from '../../../hooks/useIsPathHiddenByReadOnly'
import {
  Container,
  WarningBanner
} from './style'

export const GoogleMapsApiKeySettingButton = () => {
  const [, t] = useLanguage()
  // (R-4): a read-only admin cannot open Settings; it keeps the notice, not the link
  const hideSettingsLink = useIsPathHiddenByReadOnly(SETTINGS_MAPS_PATH)

  return (
    <Container>
      <WarningBanner>
        <span>{t('SETTINGS_MAPS_KEY_MISSING', 'Google Maps API key is missing.')}</span>
        {!hideSettingsLink && (
          <Link to={SETTINGS_MAPS_PATH}>
            {t('SETTINGS_MAPS_KEY_LINK', 'Add it in Settings')}
          </Link>
        )}
      </WarningBanner>
    </Container>
  )
}
