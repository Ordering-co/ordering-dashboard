import React, { useEffect, useRef } from 'react'
import PropTypes, { string } from 'prop-types'
import { WrapperGoogleMaps } from '../WrapperGoogleMaps'

/**
 * Component to make an input with Google Autocomplete
 * @param {object} props Props of AutocompleteInput component
 */
const AutocompleteInput = (props) => {
  props = { ...defaultProps, ...props }
  const {
    googleReady,
    onChangeAddress,
    types,
    fields,
    countryCode,
    childRef,
    managedLifecycle = false
  } = props

  const inputRef = useRef()
  const ownedWidget = useRef(null)
  const current = useRef(props)
  current.current = props

  const inputProps = {}

  Object.entries(props).forEach(([key, value]) => {
    if (['googleReady', 'apiKey', 'onChangeAddress', 'setValue', 'childRef', 'countryCode', 'types', 'fields', 'managedLifecycle'].indexOf(key) === -1) {
      inputProps[key] = value
    }
  })

  const options = {
    types,
    fields
  }

  if (countryCode !== '*') {
    options.componentRestrictions = {
      country: countryCode
    }
  }

  useEffect(() => {
    if (googleReady && onChangeAddress && window.google?.maps?.places?.Autocomplete) {
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, options)
      if (managedLifecycle) ownedWidget.current = autocomplete
      let active = true
      const listener = autocomplete.addListener('place_changed', () => {
        if (managedLifecycle && (!active || current.current.disabled)) return
        const place = autocomplete.getPlace()
        if (managedLifecycle && (!Array.isArray(place?.address_components) || typeof place?.formatted_address !== 'string' ||
          typeof place?.geometry?.location?.lat !== 'function' || typeof place?.geometry?.location?.lng !== 'function')) return
        if (managedLifecycle) {
          const lat = place.geometry.location.lat(); const lng = place.geometry.location.lng()
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return
        }
        const addressObj = {
          street_number: null,
          neighborhood: null,
          route: null,
          city_name: null,
          locality: null,
          sublocality: null,
          country: null,
          country_code: null,
          state: null,
          state_code: null,
          zipcode: null
        }
        const cityFallback = place?.address_components.find(component => component.types.includes('administrative_area_level_2'))
        if (place?.address_components) {
          for (const component of place.address_components) {
            const addressType = component.types[0]
            if (addressType === 'postal_code') {
              addressObj.zipcode = component.short_name
            }
            if (addressType === 'street_number') {
              addressObj.street_number = component.long_name
            }
            if (addressType === 'neighborhood') {
              addressObj.neighborhood = component.long_name
            }
            if (addressType === 'route') {
              addressObj.route = component.long_name
            }
            if (addressType === 'locality') {
              addressObj.city_name = component.long_name || cityFallback?.long_name
              addressObj.locality = component.long_name
            }
            if (component.types?.includes('sublocality')) {
              addressObj.sublocality = component.long_name
            }
            if (addressType === 'country') {
              addressObj.country = component.long_name
              addressObj.country_code = component.short_name
            }
            if (addressType === 'administrative_area_level_1') {
              addressObj.state = component.long_name
              addressObj.state_code = component.short_name
            }
          }
          const address = {
            address: place.formatted_address,
            location: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            },
            utc_offset: place.utc_offset_minutes,
            map_data: {
              library: 'google',
              place_id: place.place_id
            },
            ...addressObj
          }
          if (managedLifecycle) current.current.onChangeAddress?.(address)
          else onChangeAddress(address)
        }
      })
      if (managedLifecycle) return () => { active = false; listener?.remove(); if (ownedWidget.current === autocomplete) ownedWidget.current = null }
    }
  }, [googleReady, managedLifecycle])

  useEffect(() => {
    if (managedLifecycle) ownedWidget.current?.setComponentRestrictions({ country: countryCode === '*' ? [] : countryCode })
  }, [googleReady, managedLifecycle, countryCode])

  useEffect(() => {
    const interval = setInterval(() => {
      if (inputRef.current.attributes.autocomplete &&
        inputRef.current.attributes.autocomplete.value === (props.autoComplete || 'new-field')
      ) clearInterval(interval)
      inputRef.current.setAttribute('autocomplete', (props.autoComplete || 'new-field'))
    }, 100)
    return () => clearInterval(interval)
  })

  return (
    <input
      {...inputProps}
      autoComplete={(props.autoComplete || 'new-field')}
      disabled={!props.googleReady || (managedLifecycle && props.disabled)}
      ref={(e) => {
        inputRef.current = e
        childRef && childRef(e)
      }}
      onFocus={() => inputRef.current.setAttribute('autocomplete', (props.autoComplete || 'new-field'))}
    />
  )
}

AutocompleteInput.propTypes = {
  /**
   * You Google Maps api key
   * @see apiKey What is Api Key ? https://developers.google.com/maps/gmp-get-started
   */
  apiKey: PropTypes.string.isRequired,
  /**
   * Fields for Google autocomplete
   * @see fields https://developers.google.com/maps/documentation/javascript/reference/places-widget#AutocompleteOptions.fields
   */
  fields: PropTypes.arrayOf(string),
  /**
   * types for Google autocomplete
   * @see types https://developers.google.com/maps/documentation/javascript/reference/places-widget#AutocompleteOptions.types
   */
  types: PropTypes.arrayOf(string),
  /**
   * types for Google autocomplete
   * @see countryCode https://developers.google.com/maps/documentation/javascript/reference/places-autocomplete-service#ComponentRestrictions.country
   */
  countryCode: PropTypes.string,
  /**
   * Function to get address when this changed
   * @param {object} address New address
   */
  onChangeAddress: PropTypes.func
}

const defaultProps = {
  types: [],
  fields: ['ALL'],
  countryCode: '*'
}

export const GoogleAutocompleteInput = WrapperGoogleMaps(AutocompleteInput)
