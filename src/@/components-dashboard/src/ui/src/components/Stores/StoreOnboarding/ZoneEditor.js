import { useTheme } from 'styled-components'
import dashboardTheme from '~/theme.json'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BusinessZoneGoogleMaps } from '../../../../../components/BusinessZoneGoogleMaps'
import { useStoreOnboardingLanguage } from '../../../../../utils/useStoreOnboardingLanguage'
import { useOnboardingMaps } from './useOnboardingMaps'
import { validLocation } from '../../../../../utils/storeOnboarding'
import { ZoneMapFrame, Field, Button, TextButton, Row } from './styles'

const sameGeometry = (left, right) => {
  if (typeof left === 'number' && typeof right === 'number') return Math.abs(left - right) < 1e-9
  if (left === right) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every(key => sameGeometry(left[key], right[key]))
}

const NativeZone = ({ apiKey, type, data, location, disabled, onChange }) => {
  const theme = useTheme()
  const latest = useRef({ data, disabled, onChange })
  latest.current = { data, disabled, onChange }
  const alive = useRef(true)
  const initialData = useRef(data)
  const hasShape = useRef(type === 1 ? !!data?.center && Number(data.radio) > 0 : Array.isArray(data) && data.length >= 3)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const handleData = useCallback(value => {
    if (alive.current && !latest.current.disabled && !sameGeometry(value, latest.current.data)) latest.current.onChange(value)
  }, [])
  const setClearState = useCallback(() => {}, [])
  const color = theme?.colors?.primary || dashboardTheme.colors.primary
  const fillStyle = useMemo(() => ({ fillColor: color, fillOpacity: 0.15, strokeColor: color, strokeWeight: 2 }), [color])
  const world = type === 4

  const mapLocation = useMemo(() => world ? { lat: 0, lng: 0, zoom: 0 } : location, [world, location?.lat, location?.lng, location?.zoom])
  const mapControls = useMemo(() => ({ defaultZoom: world ? 0 : 13, zoomControl: true, clickableIcons: false, streetViewControl: false, fullscreenControl: false, mapTypeControl: false, isMarkerDraggable: false }), [world])
  return <BusinessZoneGoogleMaps apiKey={apiKey} type={type} data={initialData.current} location={mapLocation} mapControls={mapControls} fillStyle={fillStyle} disabled isDriverGroup={hasShape.current ? false : undefined} handleData={handleData} setClearState={setClearState} clearState={false} managedLifecycle />
}

const Coordinates = ({ disabled, label, onConfirm }) => {
  const [, t] = useStoreOnboardingLanguage()
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const lat = Number(latitude)
  const lng = Number(longitude)
  const valid = latitude.trim() !== '' && longitude.trim() !== '' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  return <><Row><Field>{t('STORE_ONBOARDING_LATITUDE', 'Latitude')}<input type='number' min='-90' max='90' step='any' value={latitude} disabled={disabled} onChange={e => setLatitude(e.target.value)} /></Field><Field>{t('STORE_ONBOARDING_LONGITUDE', 'Longitude')}<input type='number' min='-180' max='180' step='any' value={longitude} disabled={disabled} onChange={e => setLongitude(e.target.value)} /></Field></Row><Button disabled={disabled || !valid} onClick={() => onConfirm({ lat, lng })}>{label}</Button></>
}

export const ZoneEditor = ({ apiKey, type, data, location, disabled, onChange, onRefresh, distanceUnit = 'km' }) => {
  const [, t] = useStoreOnboardingLanguage()
  const sdk = useOnboardingMaps(apiKey)
  const [revision, setRevision] = useState(0)
  const committed = useRef({ type, data })
  const nativeUpdates = useRef([])
  useEffect(() => {
    if (committed.current.type !== type) {
      committed.current = { type, data }
      nativeUpdates.current = []
      return
    }
    if (sameGeometry(committed.current.data, data)) return
    committed.current = { type, data }

    const acknowledged = nativeUpdates.current.findIndex(value => sameGeometry(value, data))
    if (acknowledged >= 0) nativeUpdates.current.splice(0, acknowledged + 1)
    else {
      nativeUpdates.current = []
      setRevision(value => value + 1)
    }
  }, [data, type])
  const nativeChange = value => { nativeUpdates.current.push(value); onChange(value) }
  const miles = distanceUnit === 'mi'
  const factor = miles ? 1.609344 : 1
  const radius = data?.radio == null || data.radio === '' ? '' : Number(data.radio) / factor
  const displayedRadius = radius !== '' && Math.abs(radius) >= 0.1 ? Number(radius.toFixed(2)) : radius
  const points = Array.isArray(data) ? data.filter(validLocation) : []
  const center = type === 1 && validLocation(data?.center) ? data.center : location
  const reset = value => { if (!disabled) onChange(value) }
  const mapKey = `${apiKey}:${type}:${location?.lat}:${location?.lng}:${revision}:${sdk.generation}`
  return <div>
    {type === 1 && <Field>{miles ? t('STORE_ONBOARDING_RADIUS_MI', 'Radius (mi)') : t('STORE_ONBOARDING_RADIUS_KM', 'Radius (km)')}<input type='number' min='0.1' step='any' value={displayedRadius} disabled={disabled} onChange={e => { if (e.target.value !== '' && Number(e.target.value) === displayedRadius) return; reset({ center, radio: e.target.value === '' ? '' : Number(e.target.value) * factor }) }} /></Field>}
    {type === 2 && <><p>{t('STORE_ONBOARDING_POLYGON_HINT', 'Click around your delivery area, then click the first point to close the boundary.')}</p><TextButton disabled={disabled || !points.length} onClick={() => reset([])}>{t('CLEAR', 'Clear')}</TextButton></>}
    <ZoneMapFrame aria-label={t('STORE_ONBOARDING_ZONE_MAP', 'Delivery area map')} aria-disabled={!!disabled} inert={disabled ? '' : undefined}>
      {sdk.status === 'ready' && <NativeZone key={mapKey} apiKey={apiKey} type={type} data={type === 2 ? points : data} location={location} disabled={disabled} onChange={nativeChange} />}
    </ZoneMapFrame>
    {sdk.status === 'error' && <p role='alert'>{t('STORE_ONBOARDING_MAP_ERROR', 'The map could not load. Check your connection or your project map settings.')} <TextButton disabled={disabled} onClick={sdk.retry}>{t('STORE_ONBOARDING_RETRY', 'Try again')}</TextButton>{onRefresh && <TextButton disabled={disabled} onClick={onRefresh}>{t('REFRESH', 'Refresh')}</TextButton>}</p>}
    {sdk.status === 'error' && type === 2 && <div><p>{t('STORE_ONBOARDING_MANUAL_POLYGON', 'Enter each boundary point using its latitude and longitude. Add at least three points.')}</p><Coordinates disabled={disabled} label={t('STORE_ONBOARDING_ADD_POINT', 'Add point')} onConfirm={point => onChange([...points, point])} /><p>{points.map(p => `${p.lat}, ${p.lng}`).join(' · ')}</p></div>}
  </div>
}
