import React, { useEffect, useRef, useState } from 'react'
import { GoogleMapsMap, GoogleAutocompleteInput, useConfig, useLanguage } from '../../../../../index'
import { CitySelector } from '../../Shared'
import { Button, TextArea, DefaultSelect } from '../../../styles'
import { timezones } from '../../../config/constants'
import { normalizeTimezone } from '../../../../../utils'
import { useBusinessOwnerRestriction } from '../../../hooks/useBusinessOwnerRestriction'

import {
  Container,
  WrapperMap,
  Section,
  WrapperCitySelector,
  WrapperTimezone,
  WrapperGoogleAutoCompleteInput,
  WrapperAddressnotes,
  InputWrapper
} from './styles'

export const BusinessLocation = (props) => {
  const {
    business,
    formState,
    setFormState,
    handleUpdateBusinessClick
  } = props
  const [{ configs }] = useConfig()
  const [, t] = useLanguage()
  const isRestricted = useBusinessOwnerRestriction()

  const [timezonesOptions, setTimezonesOptions] = useState([])
  const [timezoneSearchValue, setTimezoneSearchValue] = useState('')

  const googleMapsApiKey = configs?.google_maps_api_key?.value

  const [location, setLocation] = useState()
  const googleInputRef = useRef(null)

  const googleMapsControls = {
    defaultZoom: 15,
    zoomControl: true,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeId: 'roadmap', // 'roadmap', 'satellite', 'hybrid', 'terrain'
    mapTypeControl: false,
    mapTypeControlOptions: {
      mapTypeIds: ['roadmap', 'satellite']
    },
    isMarkerDraggable: true
  }

  const handleChangeFormState = (value, key) => {
    setFormState(prevState => ({ ...prevState, changes: { ...prevState?.changes, [key]: value } }))
  }

  const handleChangeAddress = (address = {}) => {
    getTimeZone(address)
    setLocation({ ...address.location })
    setFormState(prevState => ({ ...prevState, changes: { ...prevState?.changes, ...address } }))
  }

  const handleChangeTextarea = (value) => {
    setFormState(prevState => ({ ...prevState, changes: { ...prevState?.changes, address_notes: value } }))
  }

  const getTimeZone = async (address) => {
    const date = new Date()
    const timestamp = Math.floor(date.getTime() / 1000)
    const timezoneApiKey = googleMapsApiKey
    const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${address?.location?.lat},${address?.location?.lng}&timestamp=${timestamp}&key=${timezoneApiKey}`
    const response = await fetch(url, {
      method: 'GET'
    })
    const result = await response.json()
    setFormState(prevState => ({
      ...prevState,
      changes: {
        ...prevState?.changes,
        address: googleInputRef?.current?.value || address?.address,
        location: { ...address?.location, zipcode: address?.zipcode ? address.zipcode : -1, zoom: 15 },
        timezone: normalizeTimezone(result?.timeZoneId),
        zipcode: address?.zipcode ?? -1
      }
    }))
  }

  const handleChangeCenter = (address) => {
    setFormState(prevState => ({
      ...prevState,
      changes: {
        ...prevState?.changes,
        location: { ...business?.location, lat: address?.lat(), lng: address?.lng(), zoom: 15 }
      }
    }))
  }

  useEffect(() => {
    setFormState({ ...formState, changes: {} })
  }, [])

  useEffect(() => {
    setLocation({ ...business?.location })
  }, [business?.location])

  useEffect(() => {
    const _timezonesOptions = timezones
      .filter(timezone => timezone.toLocaleLowerCase().includes(timezoneSearchValue.toLocaleLowerCase()))
      .map(timezone => {
        return {
          value: timezone,
          content: timezone
        }
      })
    setTimezonesOptions(_timezonesOptions)
  }, [timezoneSearchValue])

  return (
    <Container>
      {location && (
        <WrapperMap>
          <GoogleMapsMap
            apiKey={configs?.google_maps_api_key?.value}
            location={location}
            mapControls={{ ...googleMapsControls, isMarkerDraggable: isRestricted ? false : googleMapsControls.isMarkerDraggable }}
            handleChangeCenter={isRestricted ? undefined : handleChangeCenter}
            onlyMarkerChangeCenter
          />
        </WrapperMap>
      )}
      <Section>
        {!isRestricted && (
          <WrapperCitySelector>
            <p>{t('CITY', 'City')}</p>
            <CitySelector
              isDefault
              position='left'
              optionInnerMaxHeight='300px'
              defaultValue={business?.city_id}
              handleChangeCity={handleChangeFormState}
            />
          </WrapperCitySelector>
        )}
        {!isRestricted && (
          <WrapperTimezone>
            <p>{t('TIMEZONE', 'Timezone')}</p>
            <InputWrapper>
              <DefaultSelect
                placeholder={t('SELECT_TIMEZONE', 'Select a timezone')}
                defaultValue={formState.changes?.timezone ?? normalizeTimezone(business?.timezone) ?? ''}
                options={timezonesOptions}
                onChange={val => handleChangeFormState(val, 'timezone')}
                optionInnerMaxHeight='300px'
                isShowSearchBar
                searchBarIsCustomLayout
                searchBarIsNotLazyLoad
                searchValue={timezoneSearchValue}
                handleChangeSearch={setTimezoneSearchValue}
              />
            </InputWrapper>
          </WrapperTimezone>
        )}
      </Section>

      {!isRestricted && (
        <WrapperGoogleAutoCompleteInput>
          <label>{t('ADDRESS', 'Address')}</label>
          <GoogleAutocompleteInput
            className='input-autocomplete'
            apiKey={googleMapsApiKey}
            placeholder={t('ADDRESS', 'Address')}
            onChangeAddress={(e) => {
              handleChangeAddress(e)
            }}
            onChange={(e) => {
              handleChangeFormState(e.target.value, 'address')
            }}
            defaultValue={formState?.changes?.address ?? business?.address ?? ''}
            childRef={(ref) => {
              googleInputRef.current = ref
            }}
            autoComplete='new-password'
            countryCode={configs?.country_autocomplete?.value || '*'}
          />
        </WrapperGoogleAutoCompleteInput>
      )}
      <WrapperAddressnotes>
        <label>{t('ADDRESS_NOTES', 'Address notes')}</label>
        <TextArea
          rows={4}
          defaultValue={
            formState?.result?.result
              ? formState?.result?.result?.address_notes
              : formState?.changes?.address_notes ?? business?.address_notes ?? ''
          }
          onChange={(e) => handleChangeTextarea(e.target.value)}
          placeholder={t('MOBILE_FRONT_VISUALS_APT', 'Write an address note')}
        />
      </WrapperAddressnotes>
      <Button
        color='primary'
        borderRadius='5px'
        disabled={formState.loading || Object.keys(formState?.changes).length === 0}
        onClick={handleUpdateBusinessClick}
      >
        {formState.loading ? t('UPDATING', 'Updating') : t('SAVE', 'Save')}
      </Button>
    </Container>
  )
}
