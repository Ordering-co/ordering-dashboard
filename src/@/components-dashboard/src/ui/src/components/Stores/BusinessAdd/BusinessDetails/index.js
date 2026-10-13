import React from 'react'
import { useLanguage, useConfig, GoogleAutocompleteInput, GoogleMapsMap } from '../../../../../../index'
import {
  BusinessDetailsContainer,
  ContentWrapper,
  FormControl,
  WrapperMap,
  GoogleMapContainer
} from './styles'
import { Input, SecondSelect } from '../../../../styles'
import { BUSINESS_VERTICALS } from '../../../../../../constants/school'
import { isDashboardFeatureEnabled, stringToSlug } from '../../../../utils'

export const BusinessDetails = (props) => {
  const {
    formState,
    handleChangeAddress,
    handleChangeInput,
    placeId,
    addressOnly = false,
    disabled,
    handleChangeCenter
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()

  const googleMapsApiKey = configs?.google_maps_api_key?.value
  const googleMapsControls = {
    defaultZoom: 15,
    zoomControl: true,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeId: 'roadmap', // 'roadmap', 'satellite', 'hybrid', 'terrain'
    mapTypeControl: false,
    ...(addressOnly && { isMarkerDraggable: !disabled }),
    mapTypeControlOptions: {
      mapTypeIds: ['roadmap', 'satellite']
    }
  }

  const location = formState?.changes?.location

  const addressMapKey = !location ? 'unconfirmed' : location.lat === 0 || location.lng === 0 ? `${location.lat}:${location.lng}` : 'confirmed'

  const defaultPosition = { lat: 40.77473399999999, lng: -73.9653844 }

  return (
    <BusinessDetailsContainer>
      {!addressOnly && <h2>{t('BUSINESS_DETAILS', 'Business details')}</h2>}
      <ContentWrapper>
        {!addressOnly && <FormControl>
          <label>{t('EXPORT_BUSINESS_NAME', 'Business Name')}<sup>*</sup></label>
          <Input
            name='name'
            placeholder={t('NAME', 'Name')}
            value={formState?.changes?.name ?? ''}
            onChange={e => {
              handleChangeInput([{ name: 'name', value: e.target.value }, { name: 'slug', value: stringToSlug(e.target.value) }], true)
            }}
          />
        </FormControl>}
        {!addressOnly && isDashboardFeatureEnabled({ featureKey: 'schools', configs }) && (
          <FormControl>
            <label>{t('VERTICAL', 'Vertical')}</label>
            <SecondSelect
              defaultValue={formState?.changes?.vertical ?? 'store'}
              options={BUSINESS_VERTICALS.map((vertical) => ({
                value: vertical.value,
                content: t(`BUSINESS_VERTICAL_${vertical.value.toUpperCase()}`, vertical.name)
              }))}
              onChange={(value) => handleChangeInput([{ name: 'vertical', value }], true)}
            />
          </FormControl>
        )}
        <FormControl>
          <label htmlFor={addressOnly ? 'onboarding-business-address' : undefined}>{t('ADDRESS', 'Address')}</label>
          {googleMapsApiKey && (
            <GoogleAutocompleteInput
              id={addressOnly ? 'onboarding-business-address' : undefined}
              managedLifecycle={addressOnly}
              disabled={addressOnly ? disabled : undefined}
              name='address'
              className='input-autocomplete'
              apiKey={googleMapsApiKey}
              placeholder={t('ADDRESS', 'Address')}
              onChangeAddress={(e) => {
                handleChangeAddress(e)
              }}
              onChange={(e) => {
                handleChangeInput(e)
              }}
              {...(addressOnly ? { value: formState?.changes?.address ?? '' } : { defaultValue: formState?.changes?.address ?? '' })}
              autoComplete='new-password'
              countryCode={configs?.country_autocomplete?.value || '*'}
            />
          )}
        </FormControl>
        <GoogleMapContainer>
          {!addressOnly && <><label>{t('GOOGLE_PLACE_ID', 'Google place ID')}</label><p>{placeId ?? googleMapsApiKey}</p></>}
          {configs?.google_maps_api_key?.value && (
            <WrapperMap>
              <GoogleMapsMap
                key={addressOnly ? `${addressMapKey}:${!!disabled}` : undefined}
                apiKey={configs?.google_maps_api_key?.value}
                location={formState?.changes?.location ?? (addressOnly ? { lat: 0, lng: 0 } : defaultPosition)}
                mapControls={addressOnly && !formState?.changes?.location ? { ...googleMapsControls, defaultZoom: 2 } : googleMapsControls}
                handleChangeCenter={addressOnly ? handleChangeCenter : undefined}
                onlyMarkerChangeCenter={addressOnly || undefined}
                isFitCenter={!addressOnly}
              />
            </WrapperMap>
          )}
        </GoogleMapContainer>
        {!addressOnly && <><FormControl>
          <label>{t('SLUG', 'Slug')}</label>
          <Input
            name='slug'
            placeholder={t('SLUG', 'Slug')}
            value={formState?.changes?.slug ?? ''}
            onChange={handleChangeInput}
          />
        </FormControl>
        <FormControl noBottom>
          <label>{t('PHONE_NUMBER', 'Phone number')}</label>
          <Input
            name='cellphone'
            placeholder={t('PHONE_NUMBER', 'Phone number')}
            value={formState?.changes?.cellphone ?? ''}
            onChange={handleChangeInput}
          />
        </FormControl></>}
      </ContentWrapper>
    </BusinessDetailsContainer>
  )
}
