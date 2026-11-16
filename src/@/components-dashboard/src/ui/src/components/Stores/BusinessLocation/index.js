import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CityList as CityListController,
  GoogleMapsMap,
  GoogleAutocompleteInput,
  useConfig,
  useLanguage
} from '../../../../../index'
import { normalizeTimezone } from '../../../../../utils'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { timezones } from '../../../config/constants'
import { useGoogleMapsSdk } from '../../../hooks/useGoogleMapsSdk'
import { Button, Field, MapFrame, SaveBar, TextArea } from '../../Shared/Product'
import { fetchTimezone, reverseGeocode } from './geo'
import './business-location.css'

// redesign stores 5.3 (; decision 4; G2-01, G2-03, G2-13, G2-14 in Location): the store's place on Product. The fields
// are held in the editor's shared form (the shell's leave guard already watches it, 2.A) until «Save» in the save bar, which counts
// and names what changed, discards it, says why a save failed and «Saved» after it. Same request and same keys as before.
//  - The map lives in P/MapFrame on the shared Maps loader: no key or a failed load says so in the map's slot.
//  - Address, pin, postal code and time zone agree (G2-13): picking a suggestion holds the four together. Text typed without
//    picking one is a normal pending change of `address` (as in main; R-02 reverses D1): it counts, saves and discards like any
//    field and never blocks the others, and the field only hints, without an error, to pick a suggestion.
//    Dragging the pin holds the point and that point's time zone and offers the address at the pin with one click (D2).
//  - The time zone lookup handles its failures and never runs without a key: the zone stays as it was and the field says so (D3).
//    An answer that arrives after a newer pick or drag is ignored.
//  - Entering Location no longer empties what the shared form holds (G2-03): the guard asks before any way out instead.

const SAVED_NOTICE_MS = 4000
const ADDRESS_EXTRA_KEYS = ['street_number', 'neighborhood', 'route', 'city_name', 'locality', 'sublocality', 'country',
  'country_code', 'state', 'state_code', 'utc_offset', 'map_data']
const FIELDS = [
  { id: 'city', keys: ['city_id'] },
  { id: 'timezone', keys: ['timezone'] },
  { id: 'address', keys: ['address', 'zipcode', ...ADDRESS_EXTRA_KEYS] },
  { id: 'pin', keys: ['location'] },
  { id: 'notes', keys: ['address_notes'] }
]
const ALL_KEYS = FIELDS.flatMap(field => field.keys)

const text = value => (value == null ? '' : String(value))
const timezoneLabel = (zone) => {
  const parts = zone.split('/')
  const place = parts.pop().split('_').join(' ')
  return parts.length ? `${place} · ${parts.join('/').split('_').join(' ')}` : place
}
const finite = value => typeof value === 'number' && Number.isFinite(value)
const validPoint = point => finite(Number(point?.lat)) && finite(Number(point?.lng)) &&
  !(Number(point.lat) === 0 && Number(point.lng) === 0)

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const withCount = (template, values) => Object.entries(values)
  .reduce((result, [key, value]) => result.split(`_${key}_`).join(String(value)), template)

// The city list, as a native select inside the Field frame (the frame links the label and the hint).
const CitySelectUI = ({ citiesList, value, onChange, disabled, loadingText, placeholder }) => {
  const cities = citiesList?.cities || []
  const known = cities.some(city => String(city.id) === String(value))
  return (
    <select
      className='odc-field-input odc-loc-select'
      value={text(value)}
      disabled={disabled || citiesList?.loading}
      onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
    >
      {citiesList?.loading && <option value={text(value)}>{loadingText}</option>}
      {!citiesList?.loading && (value == null || !known) && (
        <option value={text(value)} disabled={value == null}>{value == null ? placeholder : text(value)}</option>
      )}
      {!citiesList?.loading && cities.map(city => (
        <option key={city.id} value={city.id}>{city.name}</option>
      ))}
    </select>
  )
}

export const BusinessLocation = (props) => {
  const {
    business,
    formState,
    setFormState,
    handleUpdateBusinessClick
  } = props
  const [{ configs }] = useConfig()
  const [, t] = useLanguage()
  const apiKey = configs?.google_maps_api_key?.value
  const sdk = useGoogleMapsSdk(apiKey)
  const mapsReady = sdk.status === 'ready'

  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const addressInputRef = useRef(null)
  const lookup = useRef(0)

  const changes = formState?.changes || {}
  const loading = !!formState?.loading

  const [mapLocation, setMapLocation] = useState(() => changes.location || business?.location)
  const [mapKey, setMapKey] = useState(0)
  // true while the address text was typed and no suggestion was picked after (it only drives the hint)
  const [typed, setTyped] = useState(false)
  const [addressKey, setAddressKey] = useState(0)
  const [pinAddress, setPinAddress] = useState(null)
  const [timezoneNotice, setTimezoneNotice] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!changes.location) setMapLocation(business?.location)
  }, [business?.location])

  // ---- what is held -------------------------------------------------------------------------------------------------------
  const storedAddress = text(business?.address)
  const currentAddress = 'address' in changes ? text(changes.address) : storedAddress
  const pickHintShown = typed && 'address' in changes

  const labels = {
    city: t('CITY', 'City'),
    timezone: t('TIMEZONE', 'Timezone'),
    address: t('ADDRESS', 'Address'),
    pin: t('STORE_LOCATION_PIN', 'Pin on the map'),
    notes: t('ADDRESS_NOTES', 'Address Notes')
  }
  const changedFields = FIELDS.filter(field => field.keys.some(key => key in changes)).map(field => field.id)
  const count = changedFields.length
  const dirty = count > 0

  const resetFeedback = () => {
    setSaved(false)
    setSaveError(null)
  }

  // A simple field back to its stored value is no change at all.
  const holdField = (key, value, stored) => {
    resetFeedback()
    setFormState(prev => {
      const next = { ...prev?.changes }
      if (text(value) === text(stored)) delete next[key]
      else next[key] = value
      return { ...prev, changes: next }
    })
  }

  const hold = (patch) => {
    resetFeedback()
    setFormState(prev => ({ ...prev, changes: { ...prev?.changes, ...patch } }))
  }

  // The pin keeps the stored location's other keys and whatever a pick already held (its postal code), as before.
  const holdPoint = (point, extra = {}, locationExtra = {}) => {
    resetFeedback()
    setFormState(prev => ({
      ...prev,
      changes: {
        ...prev?.changes,
        ...extra,
        location: { ...business?.location, ...prev?.changes?.location, ...locationExtra, lat: point.lat, lng: point.lng, zoom: 15 }
      }
    }))
  }

  // ---- time zone of a point (D3) --------------------------------------------------------------------------------------------
  const lookUpTimezone = async (point, ticket) => {
    const result = await fetchTimezone(point, apiKey)
    if (!mounted.current || ticket !== lookup.current) return
    if (result.ok) {
      setTimezoneNotice(null)
      holdField('timezone', result.timezone, normalizeTimezone(business?.timezone))
    } else {
      setTimezoneNotice(t('STORE_LOCATION_TIMEZONE_FAILED', 'We couldn\'t get the time zone of this place. Check it.'))
    }
  }

  // ---- a suggestion picked: address, pin, postal code and time zone together ------------------------------------------------
  const handlePickAddress = (address = {}) => {
    if (!validPoint(address.location)) return
    const ticket = ++lookup.current
    const shown = addressInputRef.current?.value || address.address
    const zipcode = address.zipcode ?? -1
    hold({
      ...address,
      address: shown,
      location: { ...address.location, zipcode: address.zipcode ? address.zipcode : -1, zoom: 15 },
      zipcode
    })
    setTyped(false)
    setPinAddress(null)
    setMapLocation({ ...address.location, zoom: 15 })
    lookUpTimezone(address.location, ticket)
  }

  // ---- the pin dragged (D2) -------------------------------------------------------------------------------------------------
  const handleDragPin = async (latLng) => {
    const point = { lat: latLng?.lat?.(), lng: latLng?.lng?.() }
    if (!validPoint(point)) return
    const ticket = ++lookup.current
    holdPoint(point)
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
    // the parts of an earlier pick (route, locality, place id…) do not describe this address (review 7)
    setFormState(prev => {
      const next = { ...prev?.changes }
      ADDRESS_EXTRA_KEYS.forEach(key => { delete next[key] })
      return { ...prev, changes: next }
    })
    holdPoint(pinAddress.location, {
      address: pinAddress.address,
      zipcode: pinAddress.zipcode ?? -1
    }, { zipcode: pinAddress.zipcode || -1 })
    setPinAddress(null)
    setTyped(false)
    setAddressKey(key => key + 1)
  }

  // ---- save, discard --------------------------------------------------------------------------------------------------------
  // text typed by hand is held as `address` like main did (handleChangeFormState(value, 'address'))
  const handleTypeAddress = (value) => {
    setTyped(true)
    holdField('address', value, storedAddress)
  }

  const save = async () => {
    if (loading || submitting) return { ok: false }
    if (changedFields.length === 0) return { ok: true }
    setSaved(false)
    setSaveError(null)
    setSubmitting(true)
    // a time zone still on its way belongs to what is being saved now, not to the next edit (review 5)
    lookup.current += 1
    // redesign bugs F row 12: a failure is said in the save bar below; no «Loading» or error toast on top of it
    const result = await handleUpdateBusinessClick({}, { inlineError: true })
    if (!mounted.current) return result
    setSubmitting(false)
    if (result?.ok) {
      setSaved(true)
      setTyped(false)
      setTimezoneNotice(null)
      setPinAddress(null)
    } else if (result?.ok === false) {
      setSaveError(translateApiMessage(t, firstMessage(result?.error), t('STORE_LOCATION_SAVE_FAILED', 'The location could not be saved.')))
    }
    return result
  }

  const discard = () => {
    lookup.current += 1
    setFormState(prev => {
      const next = { ...prev?.changes }
      ALL_KEYS.forEach(key => { delete next[key] })
      return { ...prev, changes: next }
    })
    setTyped(false)
    setAddressKey(key => key + 1)
    setPinAddress(null)
    setTimezoneNotice(null)
    setSaveError(null)
    setMapLocation(business?.location)
    setMapKey(key => key + 1)
  }

  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [saved])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (dirty) save()
  }

  // ---- values shown ---------------------------------------------------------------------------------------------------------
  const timezoneValue = 'timezone' in changes ? text(changes.timezone) : text(normalizeTimezone(business?.timezone))
  // A native select jumps by the start of the label: the label starts with the city («Bogota · America»), so typing the city
  // finds it, as the old searchable list did (review 4)
  const timezoneOptions = [...new Set([timezoneValue, ...timezones].filter(Boolean))]
    .map(zone => ({ value: zone, label: timezoneLabel(zone) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const cityValue = 'city_id' in changes ? changes.city_id : business?.city_id ?? null
  const notesValue = 'address_notes' in changes ? text(changes.address_notes) : text(business?.address_notes)
  const hasPoint = validPoint(mapLocation)
  const busy = loading || submitting

  const mapsHint = sdk.status === 'error'
    ? t('STORE_LOCATION_ADDRESS_NEEDS_MAPS', 'Address search needs Google Maps, which is not available right now.')
    : null
  // a guide, not a validation: the typed address is saved as it is, a pick also places the pin, postal code and time zone
  const pickHint = pickHintShown
    ? t('STORE_LOCATION_PICK_ADDRESS', 'Choose an address from the suggestions, so the pin, postal code and time zone match it.')
    : null

  return (
    <form className='odc-loc-form' tabIndex={-1} noValidate onSubmit={handleSubmit}>
      <MapFrame
        className='odc-loc-map'
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
            key={`${sdk.generation}:${mapKey}`}
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
              isMarkerDraggable: true
            }}
            handleChangeCenter={onDragPin}
            onlyMarkerChangeCenter
          />
        )}
      </MapFrame>
      {mapsReady && hasPoint && (
        <p className='odc-loc-map-hint'>{t('STORE_LOCATION_DRAG_HINT', 'Drag the pin to the store\'s entrance.')}</p>
      )}

      <div className='odc-loc-address' data-loc-field='address'>
        <Field
          label={labels.address}
          hint={mapsHint || pickHint || undefined}
        >
          <GoogleAutocompleteInput
            key={`address-${addressKey}`}
            className='odc-field-input odc-loc-address-input'
            apiKey={apiKey}
            managedLifecycle
            disabled={busy}
            onChangeAddress={handlePickAddress}
            onChange={(event) => handleTypeAddress(event.target.value)}
            // Enter picks a suggestion in Google's list; it must not submit the form as well
            onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
            defaultValue={currentAddress}
            childRef={(ref) => { addressInputRef.current = ref }}
            autoComplete='new-password'
            countryCode={configs?.country_autocomplete?.value || '*'}
          />
        </Field>
        {pinAddress && (
          <div className='odc-loc-pin-address' role='status'>
            <p>
              {t('STORE_LOCATION_PIN_ADDRESS', 'The pin is at:')} <bdi className='odc-loc-pin-text'>{pinAddress.address}</bdi>
            </p>
            <Button size='sm' onClick={usePinAddress}>{t('STORE_LOCATION_USE_PIN_ADDRESS', 'Use this address')}</Button>
          </div>
        )}
      </div>

      <div className='odc-loc-row'>
        <div data-loc-field='city'>
          <Field label={labels.city}>
            <CityListController
              UIComponent={CitySelectUI}
              value={cityValue}
              disabled={busy}
              loadingText={t('LOADING', 'Loading')}
              placeholder={t('SELECT_CITY', 'Select city')}
              onChange={(value) => holdField('city_id', value, business?.city_id)}
            />
          </Field>
        </div>
        <div data-loc-field='timezone'>
          <Field label={labels.timezone} hint={timezoneNotice || undefined}>
            <select
              className='odc-field-input odc-loc-select'
              value={timezoneValue}
              disabled={busy}
              onChange={event => {
                lookup.current += 1
                setTimezoneNotice(null)
                holdField('timezone', event.target.value, normalizeTimezone(business?.timezone))
              }}
            >
              {!timezoneValue && <option value='' disabled>{t('SELECT_TIMEZONE', 'Select a timezone')}</option>}
              {timezoneOptions.map(zone => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div data-loc-field='notes'>
        <TextArea
          label={labels.notes}
          rows={3}
          value={notesValue}
          disabled={busy}
          placeholder={t('STORE_ADDRESS_NOTES_PLACEHOLDER', 'For example, the entrance or the floor')}
          onChange={(next) => holdField('address_notes', next ?? '', business?.address_notes)}
        />
      </div>

      <SaveBar
        className='odc-loc-savebar'
        formSelector='.odc-loc-form'
        label={t('SAVE_CHANGES', 'Save changes')}
        count={count}
        countText={withCount(count === 1
          ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
          : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), { count })}
        names={changedFields.map(id => labels[id])}
        moreText={(n) => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), { count: n })}
        saving={busy}
        errorText={saveError}
        onRetry={saveError && dirty ? () => save() : undefined}
        retryLabel={t('TRY_AGAIN', 'Try again')}
        saved={saved}
        savedText={t('SAVED', 'Saved')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={t('SAVE_CHANGES', 'Save changes')}
        saveType='submit'
        onDiscard={discard}
      />
    </form>
  )
}
