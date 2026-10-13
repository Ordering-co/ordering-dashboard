import React, { useEffect, useRef } from 'react'
import { useConfig } from '../../../../../contexts/ConfigContext'
import { useStoreOnboardingLanguage } from '../../../../../utils/useStoreOnboardingLanguage'
import { validLocation } from '../../../../../utils/storeOnboarding'
import { BusinessDetails } from '../BusinessAdd/BusinessDetails'
import { BusinessAddressFrame, Button } from './styles'

export const BusinessAddressEditor = ({ address, location, disabled, onChange }) => {
  const [{ configs, loading, fetchedWithToken }, { refreshConfigs }] = useConfig()
  const [, t] = useStoreOnboardingLanguage()
  const alive = useRef(false)
  const current = useRef({ onChange, disabled })
  current.current = { onChange, disabled }
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const change = patch => { if (alive.current && !current.current.disabled) current.current.onChange(patch) }
  const apiKey = configs?.google_maps_api_key?.value
  const sdkScript = document.getElementById('__googleMapsScriptId')
  const loadedKey = sdkScript?.src ? new URL(sdkScript.src, window.location.href).searchParams.get('key') : null

  const requiresReload = Boolean(loadedKey && loadedKey !== apiKey)
  if (loading) return <p role='status'>{t('LOADING', 'Loading')}…</p>
  if (fetchedWithToken !== true || !apiKey || requiresReload) return <div role='alert'><p>{t('STORE_ONBOARDING_METADATA_ERROR', 'We could not load your project settings. Try again before publishing.')}</p><Button disabled={disabled} onClick={() => requiresReload ? window.location.reload() : refreshConfigs().catch(() => {})}>{t('STORE_ONBOARDING_RETRY', 'Try again')}</Button></div>
  return <BusinessAddressFrame disabled={disabled} inert={disabled ? '' : undefined}>
    <BusinessDetails
      addressOnly
      disabled={disabled}
      formState={{ changes: { address, location: validLocation(location) ? location : null } }}
      handleChangeInput={event => change({ address: event.target.value, location: null })}
      handleChangeAddress={selected => {
        if (typeof selected?.address === 'string' && validLocation(selected.location)) change({ address: selected.address, location: selected.location })
      }}
      handleChangeCenter={point => {
        const location = { lat: point.lat(), lng: point.lng() }
        if (validLocation(location)) change({ location })
      }}
    />
  </BusinessAddressFrame>
}
