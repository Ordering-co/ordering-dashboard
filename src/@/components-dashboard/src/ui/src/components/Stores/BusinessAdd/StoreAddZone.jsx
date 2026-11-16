import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, BusinessZoneGoogleMaps } from '../../../../../index'
import { useGoogleMapsSdk } from '../../../hooks/useGoogleMapsSdk'
import { Button, Field, MapFrame, NumberField, SegmentedControl, TextField } from '../../Shared/Product'
import { CircleAlert, Plus } from '../../Shared/Icon'
import './store-add-zone.css'

// redesign stores add (2.3-B) · The delivery zone of the new-store form. Presentational: the page (its controller) keeps the
// zone `{ name, type, minimum, price, data }` and decides what is wrong with it (`problems`); this piece draws it and reports each edit
// through `onZoneChange` (a value, or an updater that receives the previous zone). Parity with main: a zone starts as a polygon (type 2),
// a change of type empties the shape, the shape of the map goes to `data` as the map reports it (a circle `{ center, radio }`, a polygon
// `[{ lat, lng }]`), a distance is `{ distance, unit }`, and moving the pin of the store empties the shape. The group title
// («Orders and payments») belongs to the page. G5-28: the old card opened from a div with onClick; «Add a delivery zone» is a button.

const ZONE_TYPE = { CIRCLE: 1, POLYGON: 2, EVERYWHERE: 4, DISTANCE_BASED: 5 }
// the amounts are typed with decimals and without a thousands separator (main kept the text as it was typed)
const DECIMALS = { useGrouping: false, maximumFractionDigits: 4 }
const WHOLE = { useGrouping: false, maximumFractionDigits: 0 }

const googleMapsControls = {
  defaultZoom: 8,
  zoomControl: true,
  streetViewControl: false,
  fullscreenControl: false,
  mapTypeId: 'roadmap', // 'roadmap', 'satellite', 'hybrid', 'terrain'
  mapTypeControl: false,
  mapTypeControlOptions: {
    mapTypeIds: ['roadmap', 'satellite']
  },
  isMarkerDraggable: false,
  defaultPosition: { lat: 40.77473399999999, lng: -73.9653844 }
}

// colours of the shapes drawn on the map (a map overlay, not an interface surface): as they were
const fillStyle = {
  fillColor: '#2C7BE5',
  strokeColor: '#03459E',
  fillOpacity: 0.2,
  strokeWeight: 2,
  editable: true
}

const greenFillStyle = {
  fillColor: '#008000',
  fillOpacity: 0.3,
  strokeColor: '#008000',
  strokeOpacity: 0.8,
  strokeWeight: 2
}

const isBlank = (value) => value == null || String(value).trim() === ''

const toNumber = (value) => {
  if (isBlank(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))

const sameData = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

const locationKey = (location) => (location && location.lat != null && location.lng != null ? `${location.lat},${location.lng}` : '')

export const StoreAddZone = (props) => {
  const {
    zone = null,
    onZoneChange,
    problems,
    showErrors = false,
    disabled = false,
    deliveryAllowed = false,
    apiKey,
    location,
    currency = '',
    distanceUnit
  } = props

  const [, t] = useLanguage()
  const [clearState, setClearState] = useState(false)
  const type = Number(zone?.type || ZONE_TYPE.POLYGON)
  const hasMap = !!zone && type !== ZONE_TYPE.EVERYWHERE
  // the Google SDK is loaded by the shared hook, and only a zone with a shape (or a radius) draws on a map
  const sdk = useGoogleMapsSdk(deliveryAllowed && hasMap ? apiKey : undefined)

  const edit = (patch) => onZoneChange?.(prev => ({ ...(prev ?? zone), ...patch }))

  // Moving the pin of the store empties the shape (main did, on every change of location); the first draw does not.
  const pin = locationKey(location)
  const seenPin = useRef(pin)
  useEffect(() => {
    if (seenPin.current === pin) return
    seenPin.current = pin
    if (!zone || zone.data == null) return
    setClearState(true)
    onZoneChange?.(prev => (prev ? { ...prev, data: null } : prev))
  }, [pin])

  if (!deliveryAllowed) {
    return (
      <div className='odc-sadd-zone'>
        <p className='odc-sadd-zone-notice'>
          {t('DELIVERY_ORDER_TYPE_DISABLED', 'The delivery order type is disabled for your project. Enable it in Settings to create delivery zones.')}
        </p>
      </div>
    )
  }

  if (!zone) {
    return (
      <div className='odc-sadd-zone'>
        <div className='odc-sadd-zone-empty'>
          <div className='odc-sadd-zone-empty-text'>
            <span className='odc-sadd-zone-title'>{t('STORE_ADD_ZONE_TITLE', 'Delivery zone')}</span>
            <span className='odc-sadd-zone-muted'>{t('STORE_ADD_ZONE_OPTIONAL', 'Optional. You can add more later.')}</span>
          </div>
          <Button
            icon={Plus}
            disabled={disabled}
            onClick={() => onZoneChange?.({ name: '', type: ZONE_TYPE.POLYGON, minimum: '', price: '', data: null })}
          >
            {t('STORE_ADD_ZONE_ADD', 'Add a delivery zone')}
          </Button>
        </div>
      </div>
    )
  }

  const requiredLabel = t('REQUIRED', 'Required')
  const shown = (key) => (showErrors && problems?.[key] ? problems[key] : null)
  const amountError = t('STORE_ADD_ZONE_AMOUNT_INVALID', 'Enter an amount of 0 or more')
  const errors = {
    name: shown('zoneName') ? t('STORE_ADD_ZONE_NAME_REQUIRED', 'Enter a name') : undefined,
    type: shown('zoneType') ? t('STORE_ADD_ZONE_TYPE_REQUIRED', 'Choose a type of zone') : undefined,
    minimum: shown('zoneMinimum') ? amountError : undefined,
    price: shown('zonePrice') ? amountError : undefined,
    distance: shown('zoneDistance') ? t('STORE_ADD_ZONE_DISTANCE_INVALID', 'Enter a distance from 1 to 99') : undefined,
    geometry: shown('zoneGeometry') ? t('STORE_ADD_ZONE_GEOMETRY_REQUIRED', 'Draw the delivery area on the map') : undefined
  }

  const unit = isBlank(distanceUnit) ? t('KM', 'km') : String(distanceUnit)
  const radiusUnit = type === ZONE_TYPE.DISTANCE_BASED ? unit : t('KM', 'km')
  const amountHint = isBlank(currency) ? undefined : t('STORE_ADD_ZONE_AMOUNT_IN', 'Amount in _currency_').split('_currency_').join(currency)
  const typeOptions = [
    { value: ZONE_TYPE.CIRCLE, label: t('CIRCLE', 'Circle') },
    { value: ZONE_TYPE.POLYGON, label: t('POLYGON', 'Polygon') },
    { value: ZONE_TYPE.EVERYWHERE, label: t('EVERYWHERE', 'Everywhere') },
    { value: ZONE_TYPE.DISTANCE_BASED, label: t('DISTANCE_BASED', 'Distance based') }
  ]

  // the text of the window of the map: «Radius 5 km», translated; nothing for a polygon
  const shape = zone.data
  const infoContentString = type === ZONE_TYPE.POLYGON
    ? ''
    : `<div style="white-space: nowrap"><span>${escapeHtml(t('RADIUS', 'Radius'))}</span> ${escapeHtml(shape?.radio || shape?.distance || 0)} <span>${escapeHtml(radiusUnit)}</span></div>`

  const handleChangeType = (next) => {
    const nextType = Number(next)
    if (nextType === type) return
    setClearState(true)
    edit({ type: nextType, data: null })
  }

  // what the map reports (its shape, or null when it clears); the same shape again is not a change
  const handleMapData = (data) => {
    onZoneChange?.(prev => {
      const current = prev ?? zone
      return sameData(current.data, data) ? prev : { ...current, data }
    })
  }

  const handleClearShape = () => {
    setClearState(true)
    edit({ data: null })
  }

  const amount = (key, errorKey, label) => (
    <NumberField
      label={label}
      required
      requiredLabel={requiredLabel}
      error={errors[errorKey]}
      hint={amountHint}
      disabled={disabled}
      name={key}
      placeholder='0.00'
      format={DECIMALS}
      value={toNumber(zone[key])}
      onChange={next => edit({ [key]: next == null ? '' : String(next) })}
    />
  )

  return (
    <div className='odc-sadd-zone'>
      <div className='odc-sadd-zone-form'>
        <div className='odc-sadd-zone-head'>
          <span className='odc-sadd-zone-title'>{t('STORE_ADD_ZONE_TITLE', 'Delivery zone')}</span>
          <Button variant='ghost' size='sm' disabled={disabled} onClick={() => onZoneChange?.(null)}>
            {t('STORE_ADD_ZONE_REMOVE', 'Remove zone')}
          </Button>
        </div>
        <TextField
          label={t('NAME', 'Name')}
          required
          requiredLabel={requiredLabel}
          error={errors.name}
          disabled={disabled}
          name='zone_name'
          autoComplete='off'
          value={zone.name ?? ''}
          onChange={value => edit({ name: value })}
        />
        <Field label={t('TYPE', 'Type')} error={errors.type} disabled={disabled}>
          {/* the segmented control has no disabled of its own: a disabled fieldset disables its buttons */}
          <fieldset className='odc-sadd-zone-type' disabled={disabled}>
            <SegmentedControl
              label={t('TYPE', 'Type')}
              value={type}
              onValueChange={handleChangeType}
              options={typeOptions}
            />
          </fieldset>
        </Field>
        <div className='odc-sadd-zone-row'>
          {amount('minimum', 'minimum', t('MINIMUN_PURCHASED', 'Minimum purchase'))}
          {amount('price', 'price', t('DELIVERY_FEE', 'Delivery fee'))}
        </div>
        {type === ZONE_TYPE.DISTANCE_BASED && (
          <div className='odc-sadd-zone-row'>
            <NumberField
              label={`${t('DISTANCE_FROM_STORE', 'Distance from store')} (${unit})`}
              required
              requiredLabel={requiredLabel}
              error={errors.distance}
              disabled={disabled}
              name='distance'
              placeholder='1 - 99'
              format={WHOLE}
              value={toNumber(zone.data?.distance)}
              onChange={next => edit({ data: next == null ? null : { distance: String(next), unit: distanceUnit } })}
            />
          </div>
        )}
        {hasMap && (
          <div className='odc-sadd-zone-map-block'>
            <div className='odc-sadd-zone-map'>
              <MapFrame
                size='fill'
                label={t('DRIVERS_GROUPS_ZONE_MAP', 'Delivery zone map')}
                apiKey={apiKey}
                unavailable={sdk.status === 'error'}
                unavailableTitle={t('MAP_UNAVAILABLE', 'Map unavailable')}
                unavailableDescription={apiKey
                  ? t('STORE_ZONE_MAP_UNAVAILABLE', 'You can still save the other fields. Shapes can be drawn when the map loads.')
                  : t('REQUIRED_GOOGLE_MAP_API_KEY', 'Google Maps api key is required')}
              >
                {sdk.status === 'ready' && (
                  <div className='odc-sadd-zone-stage'>
                    {type !== ZONE_TYPE.DISTANCE_BASED && !disabled && (
                      <Button onClick={handleClearShape}>
                        {t('DRIVERS_GROUPS_CLEAR_SHAPE', 'Clear shape')}
                      </Button>
                    )}
                    <BusinessZoneGoogleMaps
                      key={sdk.generation}
                      distance={zone.data?.distance}
                      // in BusinessZoneGoogleMaps the prop `disabled` means «editable» (it drives the shapes and the drawing tools)
                      disabled={!disabled}
                      apiKey={apiKey}
                      mapControls={googleMapsControls}
                      location={location || undefined}
                      clearState={clearState}
                      setClearState={setClearState}
                      type={type}
                      data={zone.data}
                      handleData={handleMapData}
                      fillStyle={fillStyle}
                      infoContentString={infoContentString}
                      greenFillStyle={greenFillStyle}
                    />
                  </div>
                )}
              </MapFrame>
            </div>
            {errors.geometry && type !== ZONE_TYPE.DISTANCE_BASED && (
              <p className='odc-sadd-zone-error' role='alert'>
                <CircleAlert className='odc-icon odc-sadd-zone-error-icon' aria-hidden='true' />
                <span>{errors.geometry}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
