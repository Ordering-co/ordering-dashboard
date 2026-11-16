import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { GoogleMapsMap, GoogleAutocompleteInput, useConfig, useLanguage } from '../../../../../index'
import { timezones } from '../../../config/constants'
import { useGoogleMapsSdk } from '../../../hooks/useGoogleMapsSdk'
import { Button, Field, MapFrame } from '../../Shared/Product'
import { fetchTimezone, reverseGeocode } from '../BusinessLocation/geo'
import './store-add-location.css'

// redesign stores (lote 2.3-A): the «Location» group of the store add page on Product. It is Store details › Location
// (BusinessLocation) without a business, a save bar or a save: everything goes to the add form through `changeFields`.
//  - A suggestion picked holds `{ address, location: { lat, lng, zipcode, zoom } }` (main's shape) and then the time zone of the
//    point. A lookup that fails keeps the zone and the field says so; an answer that arrives after a newer pick or drag is ignored.
//  - Text typed without picking a suggestion IS held, as the address alone (main's add did): the field only says that a suggestion
//    places the pin, until there is a pin. It blocks nothing.
//  - Dragging the pin holds the point and that point's time zone, and offers the address at the pin with one click.
//  - The map lives in P/MapFrame on the shared Maps loader: no key or a failed load says so in the map's slot.
//  - An address filled from outside the group (Google, ) bumps `addressVersion`: the field is drawn again with it and the map
//    moves to its pin.

const text = value => (value == null ? '' : String(value))
const finite = value => typeof value === 'number' && Number.isFinite(value)
const validPoint = point => finite(Number(point?.lat)) && finite(Number(point?.lng)) &&
  !(Number(point.lat) === 0 && Number(point.lng) === 0)

const timezoneLabel = (zone) => {
  const parts = zone.split('/')
  const place = parts.pop().split('_').join(' ')
  return parts.length ? `${place} · ${parts.join('/').split('_').join(' ')}` : place
}

// The city list, as a native select inside the Field frame (the frame links the label and the hint).
const CitySelect = ({ cities, loading, value, onChange, disabled, loadingText, placeholder }) => {
  const known = cities.some(city => String(city.id) === String(value))
  return (
    <select
      className='odc-field-input odc-sadd-loc-select'
      value={text(value)}
      disabled={disabled || loading}
      onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
    >
      {loading && <option value={text(value)}>{loadingText}</option>}
      {!loading && (value == null || !known) && (
        <option value={text(value)} disabled={value == null}>{value == null ? placeholder : text(value)}</option>
      )}
      {!loading && cities.map(city => (
        <option key={city.id} value={city.id}>{city.name}</option>
      ))}
    </select>
  )
}

export const StoreAddLocation = (props) => {
  const {
    form = {},
    changeFields,
    cities = [],
    citiesLoading = false,
    cityId = null,
    onCityChange,
    apiKey,
    addressVersion = 0,
    disabled = false,
    addressInputRef
  } = props
  const [{ configs }] = useConfig()
  const [, t] = useLanguage()
  const titleId = useId()
  const sdk = useGoogleMapsSdk(apiKey)
  const mapsReady = sdk.status === 'ready'

  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const lookup = useRef(0)

  const [mapLocation, setMapLocation] = useState(form.location)
  const [pinAddress, setPinAddress] = useState(null)
  const [timezoneNotice, setTimezoneNotice] = useState(null)
  const [addressKey, setAddressKey] = useState(0)

  // The pin the map was first drawn with is the form's; a pin that arrives later (not from this group) draws it once.
  useEffect(() => {
    if (!validPoint(mapLocation) && validPoint(form.location)) setMapLocation(form.location)
  }, [form.location])

  // An address filled from outside the group: the map follows its pin and a pending pin address no longer applies
  useEffect(() => {
    if (!addressVersion) return
    lookup.current += 1
    setPinAddress(null)
    if (validPoint(form.location)) setMapLocation({ ...form.location, zoom: 15 })
  }, [addressVersion])

  const currentAddress = text(form.address)
  const hasPoint = validPoint(form.location)

  // ---- time zone of a point -------------------------------------------------------------------------------------------------
  const lookUpTimezone = async (point, ticket) => {
    const result = await fetchTimezone(point, apiKey)
    if (!mounted.current || ticket !== lookup.current) return
    if (result.ok) {
      setTimezoneNotice(null)
      changeFields({ timezone: result.timezone })
    } else {
      setTimezoneNotice(t('STORE_LOCATION_TIMEZONE_FAILED', 'We couldn\'t get the time zone of this place. Check it.'))
    }
  }

  // ---- a suggestion picked: address and pin together (main's shape), then the time zone -------------------------------------
  const handlePickAddress = (address = {}) => {
    if (!validPoint(address.location)) return
    const ticket = ++lookup.current
    changeFields({
      address: address.address,
      location: { ...address.location, zipcode: address.zipcode ? address.zipcode : -1, zoom: 15 }
    })
    setPinAddress(null)
    setMapLocation({ ...address.location, zoom: 15 })
    lookUpTimezone(address.location, ticket)
  }

  // ---- the pin dragged ------------------------------------------------------------------------------------------------------
  const handleDragPin = async (latLng) => {
    const point = { lat: latLng?.lat?.(), lng: latLng?.lng?.() }
    if (!validPoint(point)) return
    const ticket = ++lookup.current
    changeFields({ location: { lat: point.lat, lng: point.lng, zipcode: -1, zoom: 15 } })
    setPinAddress(null)
    lookUpTimezone(point, ticket)
    const found = await reverseGeocode(point)
    if (!mounted.current || ticket !== lookup.current) return
    if (found.ok && found.address.trim() !== currentAddress.trim()) setPinAddress({ ...found, location: point })
  }

  // The map's marker listener is registered once per map position: it calls the latest handler through this stable function.
  const dragHandler = useRef(null)
  dragHandler.current = handleDragPin
  const onDragPin = useCallback(latLng => dragHandler.current?.(latLng), [])

  const usePinAddress = () => {
    if (!pinAddress) return
    changeFields({
      address: pinAddress.address,
      location: { lat: pinAddress.location.lat, lng: pinAddress.location.lng, zipcode: pinAddress.zipcode || -1, zoom: 15 }
    })
    setPinAddress(null)
    setAddressKey(key => key + 1)
  }

  const handleTimezone = (event) => {
    lookup.current += 1
    setTimezoneNotice(null)
    changeFields({ timezone: event.target.value })
  }

  // ---- values shown ---------------------------------------------------------------------------------------------------------
  const timezoneValue = text(form.timezone)
  // A native select jumps by the start of the label: the label starts with the city («Bogota · America»), so typing the city finds it
  const timezoneOptions = [...new Set([timezoneValue, ...timezones].filter(Boolean))]
    .map(zone => ({ value: zone, label: timezoneLabel(zone) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const addressHint = sdk.status === 'error'
    ? t('STORE_LOCATION_ADDRESS_NEEDS_MAPS', 'Address search needs Google Maps, which is not available right now.')
    : (!hasPoint ? t('STORE_ADD_ADDRESS_PICK_HINT', 'Choose a suggestion to place the pin.') : undefined)

  const setAddressRef = (ref) => {
    if (addressInputRef) addressInputRef.current = ref
  }

  return (
    <section className='odc-sadd-group' aria-labelledby={titleId}>
      <h2 className='odc-sadd-group-title' id={titleId}>{t('LOCATION', 'Location')}</h2>
      <div className='odc-sadd-loc'>
        <div className='odc-sadd-loc-address' data-loc-field='address'>
          <Field label={t('ADDRESS', 'Address')} hint={addressHint}>
            <GoogleAutocompleteInput
              key={`address-${addressVersion}-${addressKey}`}
              className='odc-field-input odc-sadd-loc-address-input'
              apiKey={apiKey}
              managedLifecycle
              disabled={disabled}
              onChangeAddress={handlePickAddress}
              onChange={event => changeFields({ address: event.target.value })}
              // Enter picks a suggestion in Google's list; it must not submit the page's form as well
              onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
              defaultValue={currentAddress}
              childRef={setAddressRef}
              autoComplete='new-password'
              countryCode={configs?.country_autocomplete?.value || '*'}
            />
          </Field>
        </div>

        <MapFrame
          className='odc-sadd-loc-map'
          size='compact'
          label={t('STORE_LOCATION_MAP', 'Store location map')}
          apiKey={apiKey}
          unavailable={sdk.status === 'error' || (mapsReady && !hasPoint)}
          unavailableTitle={sdk.status === 'error' || !apiKey
            ? t('MAP_UNAVAILABLE', 'Map unavailable')
            : t('STORE_LOCATION_NO_PIN', 'No pin yet')}
          unavailableDescription={!apiKey
            ? t('REQUIRED_GOOGLE_MAP_API_KEY', 'Google Maps api key is required')
            : sdk.status === 'error'
              ? t('STORE_LOCATION_MAP_FAILED', 'The map could not load. You can still edit and save the other fields.')
              : t('STORE_LOCATION_NO_PIN_HINT', 'Choose the address to place the pin.')}
          resetKey={sdk.generation}
        >
          {mapsReady && hasPoint && (
            <GoogleMapsMap
              key={sdk.generation}
              apiKey={apiKey}
              location={mapLocation}
              fillContainer
              mapControls={{
                defaultZoom: 15,
                zoomControl: true,
                streetViewControl: false,
                fullscreenControl: false,
                mapTypeId: 'roadmap',
                mapTypeControl: false,
                mapTypeControlOptions: { mapTypeIds: ['roadmap', 'satellite'] },
                isMarkerDraggable: !disabled
              }}
              handleChangeCenter={disabled ? undefined : onDragPin}
              onlyMarkerChangeCenter
            />
          )}
        </MapFrame>
        {mapsReady && hasPoint && (
          <p className='odc-sadd-loc-map-hint'>{t('STORE_LOCATION_DRAG_HINT', 'Drag the pin to the store\'s entrance.')}</p>
        )}

        {pinAddress && (
          <div className='odc-sadd-loc-pin-address' role='status'>
            <p>
              {t('STORE_LOCATION_PIN_ADDRESS', 'The pin is at:')} <bdi className='odc-sadd-loc-pin-text'>{pinAddress.address}</bdi>
            </p>
            <Button size='sm' disabled={disabled} onClick={usePinAddress}>{t('STORE_LOCATION_USE_PIN_ADDRESS', 'Use this address')}</Button>
          </div>
        )}

        <div className='odc-sadd-loc-row'>
          <div data-loc-field='city'>
            <Field label={t('CITY', 'City')}>
              <CitySelect
                cities={cities}
                loading={citiesLoading}
                value={cityId}
                disabled={disabled}
                loadingText={t('LOADING', 'Loading')}
                placeholder={t('SELECT_CITY', 'Select city')}
                onChange={value => onCityChange?.(value)}
              />
            </Field>
          </div>
          <div data-loc-field='timezone'>
            <Field
              label={t('TIMEZONE', 'Timezone')}
              // review 7: an empty time zone says so (the project may have no default one)
              hint={timezoneNotice || (!timezoneValue ? t('STORE_ADD_TIMEZONE_EMPTY', 'Choose the time zone of the store’s opening hours.') : undefined)}
            >
              <select
                className='odc-field-input odc-sadd-loc-select'
                value={timezoneValue}
                disabled={disabled}
                onChange={handleTimezone}
              >
                {!timezoneValue && <option value='' disabled>{t('SELECT_TIMEZONE', 'Select a timezone')}</option>}
                {timezoneOptions.map(zone => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </div>
    </section>
  )
}
