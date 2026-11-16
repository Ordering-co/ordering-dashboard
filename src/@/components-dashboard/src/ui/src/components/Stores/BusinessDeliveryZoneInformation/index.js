import React, { useEffect, useRef, useState } from 'react'
import { useConfig, useLanguage, useUtils, ExamineClick, BusinessZoneGoogleMaps } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { isOwnZone } from '../../../../../utils/deliveryZones'
import { useGoogleMapsSdk } from '../../../hooks/useGoogleMapsSdk'
import { RecipientSelect } from '../../Shared'
import { Button, InlineNotice, MapFrame, NumberField, SelectField, TextField, useLeaveGuard, useSectionSplit } from '../../Shared/Product'
import { CircleAlert } from '../../Shared/Icon'
import './zone-information.css'

// redesign stores 5.8 (2.3) · The form of a delivery zone, the body of the detail of P/SectionSplit (which draws the title,
// the X or «‹ Back» and Esc). No react-hook-form: it validates on Save, shows each message in its field and takes the focus to the
// first invalid one. The shape map lives in P/MapFrame (G3-30), the money, the percentage and the distance are P/NumberField (G3-21),
// the errors of the API and the missing shape are one alert notice (G3-20, Z5), and the form registers its leave guard (decision 4).

const MIN_DISTANCE = 1
const MAX_DISTANCE = 99
// money, percentage and distance are typed with decimals and without a thousands separator (main took the text as it was typed)
const DECIMALS = { useGrouping: false, maximumFractionDigits: 4 }

const isBlank = (value) => value == null || String(value).trim() === ''

const toNumber = (value) => {
  if (isBlank(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))

// the messages of the API (a string, or a list of them) in one text, each one translated as the old global Alert did
const errorText = (t, error) => (Array.isArray(error) ? error : [error])
  .map(message => translateApiMessage(t, message, ''))
  .filter(Boolean)
  .join(' ')

// After the errors are drawn (next frame), the first control marked invalid takes the focus and scrolls into view.
const focusFirstInvalid = (rootRef) => {
  requestAnimationFrame(() => {
    const control = rootRef.current?.querySelector('[aria-invalid="true"]')
    control?.focus({ preventScroll: true })
    control?.scrollIntoView?.({ block: 'center' })
  })
}

const near = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-6

// Whether `reported` is the shape the zone was saved with. BusinessZoneGoogleMaps reports the shape it has just drawn (a circle, a
// polygon or a distance) as soon as it loads, with no edit by the user; that must not turn the form dirty (the leave guard would ask
// about a zone nobody touched).
const sameShape = (reported, saved) => {
  if (!reported || !saved) return false
  if (Array.isArray(reported) || Array.isArray(saved)) {
    return Array.isArray(reported) && Array.isArray(saved) && reported.length === saved.length &&
      reported.every((point, index) => near(point?.lat, saved[index]?.lat) && near(point?.lng, saved[index]?.lng))
  }
  if (reported.center || saved.center) {
    return !!reported.center && !!saved.center && near(reported.center.lat, saved.center.lat) &&
      near(reported.center.lng, saved.center.lng) && near(reported.radio, saved.radio)
  }
  if (reported.distance != null || saved.distance != null) {
    return near(reported.distance, saved.distance) && (reported.unit ?? null) === (saved.unit ?? null)
  }
  return false
}

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

export const BusinessDeliveryZoneInformation = (props) => {
  const {
    business,
    zone,
    businessZones,
    formState,
    handleChangeInput,
    handleChangeFormState,
    handleDiscardChanges,
    handleUpdateBusinessDeliveryZone,
    handleAddBusinessDeliveryZone,
    handleUploadKmlFiles,
    kmlData,
    // false while another tab of the detail is in front: the form stays mounted (its pending changes and its leave guard with it) but
    // the map is not drawn in a hidden container
    active = true
  } = props

  const [, t] = useLanguage()
  const [{ parseNumber }] = useUtils()
  const [configState] = useConfig()
  const { registerCloseGuard } = useSectionSplit()
  const [clearState, setClearState] = useState(false)
  const [zoneType, setZoneType] = useState(zone?.type || 2)
  const [zoneData, setZoneData] = useState(zone?.data)
  const [isShowMap, setIsShowMap] = useState(false)
  const [errors, setErrors] = useState({})
  const [missingShape, setMissingShape] = useState(false)
  const rootRef = useRef(null)
  const kmlRef = useRef(null)
  const isMyZone = isOwnZone(zone)
  // G3-19: in BusinessZoneGoogleMaps the prop `disabled` means «editable» (it drives `editable` of the shapes and the drawing tools),
  // not «disabled». It has to be true for a zone of this store and false for one shared by another store.
  const canEditShape = isMyZone

  const changes = formState?.changes || {}
  const type = Number(changes.type || zoneType)
  const requiredLabel = t('REQUIRED', 'Required')

  // the unit of the distance (type 5) is the one of the configuration; without one, km on screen. A circle (type 1) reports its radius in
  // km. review R5.8-04: what goes to the API is the configured unit as main sent it (nothing without one), never a translated word.
  const configuredUnit = configState?.configs?.distance_unit?.value
  const distanceUnit = isBlank(configuredUnit) ? t('KM', 'km') : String(configuredUnit)
  const radiusUnit = type === 5 ? distanceUnit : t('KM', 'km')

  // G3-30: the Google SDK is loaded by the shared hook and only a type with a shape draws on a map
  const mapApiKey = configState?.configs?.google_maps_api_key?.value
  const sdk = useGoogleMapsSdk(type !== 4 ? mapApiKey : undefined)

  const typeOptions = [
    { value: 1, label: t('CIRCLE', 'Circle') },
    { value: 2, label: t('POLYGON', 'Polygon') },
    { value: 4, label: t('EVERYWHERE', 'Everywhere') },
    { value: 5, label: t('DISTANCE_BASED', 'Distance based') }
  ]

  // the text of the window of the map: «Radius 5 km», translated; nothing for a polygon or Everywhere
  const shape = changes.data || zoneData
  const infoContentString = type === 2 || type === 4
    ? ''
    : `<div style="white-space: nowrap"><span>${escapeHtml(t('RADIUS', 'Radius'))}</span> ${escapeHtml(parseNumber(shape?.radio || shape?.distance))} <span>${escapeHtml(radiusUnit)}</span></div>`

  // an edit takes back the notice of the missing shape and the message of the field it touches
  const touch = (key) => {
    setMissingShape(false)
    if (key) {
      setErrors(prev => {
        if (!(key in prev)) return prev
        const { [key]: _removed, ...rest } = prev
        return rest
      })
    }
  }

  const handleChangeType = (nextType) => {
    touch()
    handleChangeFormState({ type: nextType })
    setClearState(true)
    setZoneType(nextType)
  }

  const handleZoneData = (data) => {
    setZoneData(data)
    // the map reports the shape it has drawn when it loads: that is not a change, unless the user already changed the shape
    if (data && !Object.prototype.hasOwnProperty.call(changes, 'data') && sameShape(data, zone?.data)) return
    touch()
    handleChangeFormState({ data })
  }

  const validate = () => {
    const found = {}
    const name = changes.name ?? zone?.name
    if (isBlank(name)) found.name = t('NAME_REQUIRED', 'The name is required.')
    if (isBlank(changes.minimum ?? zone?.minimum)) found.minimum = t('MINIMUN_PURCHASED_REQUIRED', 'The minimum purchase is required.')
    if (isBlank(changes.price ?? zone?.price)) found.price = t('DELIVERY_PRICE_REQUIRED', 'The delivery price is required.')
    if (type === 5) {
      const distance = toNumber(changes.data?.distance ?? zone?.data?.distance)
      // review R5.8-05: from 1, as main's mask allowed and as the message says
      if (distance == null || distance < MIN_DISTANCE || distance > MAX_DISTANCE) {
        found.distance = t('STORE_ZONE_DISTANCE_RANGE', 'Enter a distance between 1 and 99.')
      }
    }
    return found
  }

  // Save and the Save of the leave guard: same validation, same rule to send (a shape from the map, Everywhere or an existing zone).
  // Answers what the controller answered, or { ok: false } when nothing was sent.
  const submit = () => {
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(rootRef)
      return { ok: false }
    }
    if (!(changes.data || type === 4 || zone)) {
      setMissingShape(true)
      return { ok: false }
    }
    setMissingShape(false)
    return zone ? handleUpdateBusinessDeliveryZone() : handleAddBusinessDeliveryZone()
  }

  const discard = () => {
    handleDiscardChanges?.()
    setClearState(false)
    setZoneType(zone?.type || 2)
    setZoneData(zone?.data)
    setErrors({})
    setMissingShape(false)
  }

  const pending = Object.keys(changes).length

  // Closing the detail by any way (X, «‹ Back», Esc, another row) asks first when there is unsaved work.
  useLeaveGuard({
    dirty: pending > 0,
    count: pending,
    save: submit,
    discard,
    registerCloseGuard
  })

  useEffect(() => {
    if (clearState) {
      handleZoneData(null)
    }
  }, [clearState])

  useEffect(() => {
    setClearState(false)
    setZoneType(zone?.type || 2)
    setZoneData(zone?.data)
    setErrors({})
    setMissingShape(false)
    setIsShowMap(false)
    // The map remounts 100ms after the zone changes; clear the timer if the panel closes first, or it sets state after unmount
    const showMapTimer = setTimeout(() => {
      setIsShowMap(true)
    }, 100)
    return () => clearTimeout(showMapTimer)
  }, [zone?.id])

  const message = [
    formState?.error ? errorText(t, formState.error) : '',
    missingShape ? t('REQUIRED_POLYGON_CIRCLE', 'Add a distance based or draw a polygon or circle.') : ''
  ].filter(Boolean).join(' ')

  return (
    <form
      ref={rootRef}
      className='odc-bdzi'
      noValidate
      autoComplete='off'
      onSubmit={event => {
        event.preventDefault()
        submit()
      }}
    >
      <div className='odc-bdzi-row'>
        <TextField
          label={t('NAME', 'Name')}
          required
          requiredLabel={requiredLabel}
          error={errors.name}
          disabled={!isMyZone}
          name='name'
          value={changes.name ?? zone?.name ?? ''}
          onChange={value => {
            touch('name')
            handleChangeInput({ target: { name: 'name', value } })
          }}
        />
        <SelectField
          label={t('TYPE', 'Type')}
          name='type'
          options={typeOptions}
          value={type}
          onValueChange={next => handleChangeType(Number(next))}
          disabled={!isMyZone}
        />
      </div>
      <div className='odc-bdzi-row'>
        <NumberField
          label={t('MINIMUN_PURCHASED', 'Minimum purchase')}
          required
          requiredLabel={requiredLabel}
          error={errors.minimum}
          name='minimum'
          min={0}
          format={DECIMALS}
          value={toNumber(changes.minimum ?? zone?.minimum)}
          onChange={next => {
            touch('minimum')
            handleChangeInput({ target: { name: 'minimum', value: next == null ? '' : String(next) } })
          }}
        />
        <NumberField
          label={t('DELIVERY_FEE', 'Delivery fee')}
          required
          requiredLabel={requiredLabel}
          error={errors.price}
          name='price'
          min={0}
          format={DECIMALS}
          value={toNumber(changes.price ?? zone?.price)}
          onChange={next => {
            touch('price')
            handleChangeInput({ target: { name: 'price', value: next == null ? '' : String(next) } })
          }}
        />
      </div>
      <div className='odc-bdzi-row'>
        <NumberField
          label={t('PRICE_PERCENTAGE', 'Price percentage')}
          name='price_percentage'
          format={DECIMALS}
          value={toNumber(changes.price_percentage ?? zone?.price_percentage)}
          onChange={next => {
            touch()
            // G3-21: a number, as main sent it (an empty field is 0)
            handleChangeFormState({ price_percentage: next == null ? 0 : next })
          }}
        />
      </div>
      {isMyZone && (
        <div className='odc-bdzi-recipient'>
          <RecipientSelect
            value={changes.recipient ?? zone?.recipient ?? 'business'}
            onChange={(val) => {
              touch()
              handleChangeFormState({ recipient: val })
            }}
          />
        </div>
      )}
      {!isMyZone && zone && (
        <div className='odc-bdzi-recipient'>
          <RecipientSelect
            showInherit
            value={changes.recipient ?? zone?.pivot?.recipient ?? null}
            onChange={(val) => {
              touch()
              handleChangeFormState({ recipient: val })
            }}
          />
        </div>
      )}
      {type === 5 && (
        <div className='odc-bdzi-row'>
          <NumberField
            label={`${t('DISTANCE_FROM_STORE', 'Distance from store')} (${distanceUnit})`}
            required
            requiredLabel={requiredLabel}
            error={errors.distance}
            disabled={!isMyZone}
            name='distance'
            format={DECIMALS}
            value={toNumber(changes.data?.distance ?? zone?.data?.distance)}
            onChange={next => {
              touch('distance')
              handleChangeInput({ target: { name: 'distance', value: next == null ? '' : String(next) } }, isBlank(configuredUnit) ? undefined : configuredUnit)
            }}
          />
        </div>
      )}
      <TextField
        label={t('BUSINESS_ADDRESS', 'Business address')}
        name='address'
        readOnly
        value={business?.address ?? ''}
      />
      {type !== 4 && (
        <div className='odc-bdzi-map'>
          <MapFrame
            size='fill'
            label={t('DRIVERS_GROUPS_ZONE_MAP', 'Delivery zone map')}
            apiKey={mapApiKey}
            unavailable={sdk.status === 'error'}
            unavailableTitle={t('MAP_UNAVAILABLE', 'Map unavailable')}
            unavailableDescription={mapApiKey
              ? t('STORE_ZONE_MAP_UNAVAILABLE', 'You can still save the other fields. Shapes can be drawn when the map loads.')
              : t('REQUIRED_GOOGLE_MAP_API_KEY', 'Google Maps api key is required')}
          >
            {sdk.status === 'ready' && isShowMap && active && (
              <div className='odc-bdzi-stage'>
                {type !== 5 && isMyZone && (
                  <Button onClick={() => setClearState(true)}>
                    {t('DRIVERS_GROUPS_CLEAR_SHAPE', 'Clear shape')}
                  </Button>
                )}
                <BusinessZoneGoogleMaps
                  key={`${zone?.id ?? 'new'}:${sdk.generation}`}
                  distance={changes.data?.distance}
                  disabled={canEditShape}
                  apiKey={mapApiKey}
                  mapControls={googleMapsControls}
                  location={business?.location}
                  clearState={clearState}
                  setClearState={setClearState}
                  type={type}
                  data={changes.data || zoneData}
                  handleData={handleZoneData}
                  fillStyle={fillStyle}
                  infoContentString={infoContentString}
                  greenFillStyle={greenFillStyle}
                  isAddMode={!zone}
                  businessZones={businessZones}
                  kmlData={kmlData}
                />
              </div>
            )}
          </MapFrame>
        </div>
      )}
      {message && (
        <InlineNotice tone='danger' icon={CircleAlert} role='alert' className='odc-bdzi-notice'>{message}</InlineNotice>
      )}
      <div className='odc-bdzi-foot'>
        {!zone && type !== 5 && type !== 4 && (
          <>
            <Button onClick={() => kmlRef.current?.click()}>{t('UPLOAD_KML', 'Upload KML')}</Button>
            <ExamineClick
              className='odc-bdzi-kml-input'
              onFiles={files => {
                touch()
                handleUploadKmlFiles(files)
              }}
              childRef={element => { kmlRef.current = element }}
              accept='.kml,.kmz'
            />
          </>
        )}
        <Button
          variant='primary'
          type='submit'
          busy={!!formState?.loading}
          disabled={!!formState?.loading || pending === 0}
        >
          {!zone ? t('ADD', 'Add') : t('SAVE', 'Save')}
        </Button>
      </div>
    </form>
  )
}
