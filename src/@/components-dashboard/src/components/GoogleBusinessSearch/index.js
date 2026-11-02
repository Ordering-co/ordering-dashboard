import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useConfig } from '../../contexts/ConfigContext'
import { fetchGoogleAddress, fetchGoogleBusiness, searchNearbyBusinesses, LEGACY_BUSINESS_FIELDS } from '../GoogleAutocompleteInput/placesApi'
import { isGoogleBusiness, mergePrefill } from '../../utils/googleBusinessPrefill'
import { normalizeTimezone } from '../../utils'

const UNIQUE_PHOTO_ROLES = ['header', 'logo']

const FALLBACK_TIMEZONE = 'America/New_York'

const INITIAL_PHOTO_STATE = { rightsConfirmed: false, loading: false, failed: 0, imported: 0 }

const readAsDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new window.FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

export const downloadPhoto = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`photo_request_${response.status}`)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error('photo_invalid_type')
  return readAsDataUrl(blob)
}

export const GoogleBusinessSearch = (props) => {
  const {
    UIComponent,
    initialBusiness,
    initialPlaceId,
    onConfirm
  } = props

  const [{ configs }] = useConfig()
  const googleMapsApiKey = configs?.google_maps_api_key?.value
  const latest = useRef(props)
  latest.current = props
  const requestRef = useRef(0)
  const retryRef = useRef(null)

  const [searchState, setSearchState] = useState({
    status: initialBusiness || initialPlaceId ? 'loading' : 'idle',
    business: null,
    address: null,
    nearby: [],
    error: null
  })
  const [suggestions, setSuggestions] = useState({})
  const [photoSelection, setPhotoSelection] = useState({})
  const [photoState, setPhotoState] = useState(INITIAL_PHOTO_STATE)

  const run = async (task) => {
    const requestId = ++requestRef.current
    retryRef.current = task
    setSearchState(state => ({ ...state, status: 'loading', error: null }))
    try {
      const next = await task()
      if (requestId === requestRef.current) setSearchState(state => ({ ...state, ...next, error: null }))
    } catch (error) {
      if (requestId === requestRef.current) setSearchState(state => ({ ...state, status: 'error', error: error?.message || 'error' }))
    }
  }

  const fetchTimezone = async (location) => {
    if (!location || !googleMapsApiKey) return null
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const response = await fetch(`https://maps.googleapis.com/maps/api/timezone/json?location=${location.lat},${location.lng}&timestamp=${timestamp}&key=${googleMapsApiKey}`)
      const result = await response.json()
      return normalizeTimezone(result?.timeZoneId) || null
    } catch {
      return null
    }
  }

  const applyBusiness = async (business) => {
    const defaultTimezone = configs?.timezone?.value || configs?.default_timezone?.value || FALLBACK_TIMEZONE
    const timezone = business.location ? (await fetchTimezone(business.location)) || defaultTimezone : null
    const { getFields, values = {}, defaults = {}, applied = {}, onChange, onAppliedChange } = latest.current
    const result = mergePrefill({
      current: values,
      next: getFields({ ...business, timezone }),
      applied,
      defaults
    })
    if (Object.keys(result.changes).length && onChange) onChange(result.changes)
    onAppliedChange && onAppliedChange(result.applied)
    setSuggestions(result.suggestions)
    setPhotoSelection({})
    setPhotoState(INITIAL_PHOTO_STATE)
    return { status: 'applied', business }
  }

  const handleSelectPlace = (selection) => run(async () => {
    if (isGoogleBusiness(selection.types)) {
      return { status: 'confirm', business: await fetchGoogleBusiness(selection), address: null, nearby: [] }
    }
    const address = await fetchGoogleAddress(selection)
    if (!address?.location) throw new Error('address_without_location')
    return { status: 'nearby', address, nearby: await searchNearbyBusinesses(address.location), business: null }
  })

  const handleSelectNearby = (placeId) => run(async () => ({
    status: 'confirm',
    business: await fetchGoogleBusiness({ placeId })
  }))

  const handleConfirm = () => {
    const business = searchState.business
    if (!business) return
    if (onConfirm) {
      onConfirm(business)
      return
    }
    run(() => applyBusiness(business))
  }

  const handleReject = () => {
    requestRef.current += 1
    setSearchState(state => ({ ...state, status: state.address ? 'nearby' : 'idle', business: null, error: null }))
  }

  const handleReset = () => {
    requestRef.current += 1
    setSuggestions({})
    setPhotoSelection({})
    setPhotoState(INITIAL_PHOTO_STATE)
    setSearchState({ status: 'idle', business: null, address: null, nearby: [], error: null })
  }

  const handleRetry = () => {
    if (retryRef.current) run(retryRef.current)
  }

  const handleUseSuggestion = (group) => {
    const values = suggestions[group]
    if (!values) return
    const { applied = {}, onChange, onAppliedChange } = latest.current
    onChange && onChange(values)
    onAppliedChange && onAppliedChange({ ...applied, [group]: values })
    setSuggestions(({ [group]: _, ...rest }) => rest)
  }

  const handleDismissSuggestion = (group) => {
    setSuggestions(({ [group]: _, ...rest }) => rest)
  }

  const handleChangePhotoRole = (photoId, role) => {
    setPhotoSelection(selection => {
      const next = UNIQUE_PHOTO_ROLES.includes(role)
        ? Object.fromEntries(Object.entries(selection).map(([id, value]) => [id, value === role ? 'gallery' : value]))
        : { ...selection }
      if (role) next[photoId] = role
      else delete next[photoId]
      if (!latest.current.photoRoles?.includes('gallery')) {
        Object.keys(next).forEach(id => { if (next[id] === 'gallery') delete next[id] })
      }
      return next
    })
  }

  const handleConfirmRights = (rightsConfirmed) => {
    setPhotoState(state => ({ ...state, rightsConfirmed }))
  }

  const handleImportPhotos = async () => {
    const photos = searchState.business?.canCopyPhotos ? searchState.business.photos : []
    const selected = photos.filter(photo => photoSelection[photo.id])
    if (!selected.length || !photoState.rightsConfirmed) return
    const requestId = requestRef.current
    setPhotoState(state => ({ ...state, loading: true, failed: 0, imported: 0 }))
    const results = await Promise.all(selected.map(async photo => {
      const role = photoSelection[photo.id]
      try {
        return { photoId: photo.id, role, file: await downloadPhoto(role === 'logo' ? photo.logoUrl : photo.url) }
      } catch {
        return { photoId: photo.id, role, file: null }
      }
    }))
    if (requestId !== requestRef.current) return
    const imported = results.filter(result => result.file)
    if (imported.length && latest.current.onPhotos) latest.current.onPhotos(imported.map(({ role, file }) => ({ role, file })))
    setPhotoSelection(selection => Object.fromEntries(Object.entries(selection).filter(([id]) => !imported.some(result => result.photoId === id))))
    setPhotoState(state => ({ ...state, loading: false, failed: results.length - imported.length, imported: imported.length }))
  }

  useEffect(() => {
    if (initialBusiness) run(() => applyBusiness(initialBusiness))
    else if (initialPlaceId) run(async () => applyBusiness(await fetchGoogleBusiness({ placeId: initialPlaceId })))
    return () => { requestRef.current += 1 }
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          googleMapsApiKey={googleMapsApiKey}
          legacyFields={LEGACY_BUSINESS_FIELDS}
          searchState={searchState}
          suggestions={suggestions}
          photoSelection={photoSelection}
          photoState={photoState}
          handleSelectPlace={handleSelectPlace}
          handleSelectNearby={handleSelectNearby}
          handleConfirm={handleConfirm}
          handleReject={handleReject}
          handleReset={handleReset}
          handleRetry={handleRetry}
          handleUseSuggestion={handleUseSuggestion}
          handleDismissSuggestion={handleDismissSuggestion}
          handleChangePhotoRole={handleChangePhotoRole}
          handleConfirmRights={handleConfirmRights}
          handleImportPhotos={handleImportPhotos}
        />
      )}
    </>
  )
}

GoogleBusinessSearch.propTypes = {
  UIComponent: PropTypes.elementType,
  getFields: PropTypes.func,
  values: PropTypes.object,
  defaults: PropTypes.object,
  applied: PropTypes.object,
  onChange: PropTypes.func,
  onAppliedChange: PropTypes.func,
  photoRoles: PropTypes.arrayOf(PropTypes.oneOf(['gallery', 'header', 'logo'])),
  onPhotos: PropTypes.func,
  onConfirm: PropTypes.func,
  initialBusiness: PropTypes.object,
  initialPlaceId: PropTypes.string
}
