import React, { useState, useEffect, useId, useRef } from 'react'
import { useForm } from 'react-hook-form'

import {
  AddressForm as AddressFormController,
  GoogleAutocompleteInput,
  useLanguage,
  GoogleMapsMap,
  useSession,
  useOrder,
  useConfig
} from '../../../../../index'

import { GoogleGpsButton } from '../GoogleGpsButton'
import { Button as ProductButton, EmptyState, InlineNotice, SegmentedControl, Skeleton as ProductSkeleton } from '../../Shared/Product'
import { LoaderCircle, MapPin as MapPinIcon, Navigation } from '../../Shared/Icon'
import { StepBoundary } from '../../Shared/Product/Wizard/StepBoundary'
import { useGoogleMapsFailure } from '../../Shared/Product/Wizard/useGoogleMapsFailure'
import '../../Orders/CreateCustomOrder/steps.css'

const inputNames = [
  { name: 'address', code: 'Address' },
  { name: 'internal_number', code: 'Internal number' },
  { name: 'zipcode', code: 'Zipcode' },
  { name: 'address_notes', code: 'Address notes' }
]

// redesign fix-qa: E3. Embedded mode: the GPS button is drawn by GoogleGpsButton without a name; the icon carries one.
const GpsIcon = () => {
  const [, t] = useLanguage()
  return (
    <>
      <Navigation className='odc-icon' aria-hidden='true' />
      <span className='odc-sr-only'>{t('USE_MY_LOCATION', 'Use my location')}</span>
    </>
  )
}
const GpsLoadingIcon = () => {
  const [, t] = useLanguage()
  return (
    <>
      <LoaderCircle className='odc-icon odc-spin' aria-hidden='true' />
      <span className='odc-sr-only'>{t('USE_MY_LOCATION', 'Use my location')}</span>
    </>
  )
}

// redesign fix-qa: E3. What the map area says when Google is missing, in the form too.
// focusable (tabIndex -1) so the boundary can put the focus here when the map fails, instead of <body>
const MapUnavailable = ({ focusTarget = false }) => {
  const [, t] = useLanguage()
  return (
    <EmptyState
      role='status'
      tabIndex={focusTarget ? -1 : undefined}
      data-map-notice={focusTarget ? '' : undefined}
      icon={MapPinIcon}
      title={t('MAP_UNAVAILABLE', 'Map unavailable')}
      description={t('MAP_UNAVAILABLE_TEXT', 'The map could not load. The address and the business are still set.')}
    />
  )
}

const AddressFormUI = (props) => {
  const {
    addressesList,
    googleMapsControls,
    formState,
    addressState,
    isRequiredField,
    showField,
    updateChanges,
    onCancel,
    handleChangeInput,
    saveAddress,
    setIsEdit,
    userCustomerSetup
  } = props

  const [configState] = useConfig()
  const [orderState] = useOrder()
  const [, t] = useLanguage()
  const formMethods = useForm()
  const [{ auth }] = useSession()
  const googleInputRef = useRef(null)
  const titleRef = useRef(null)
  const formBodyRef = useRef(null) //
  const mapsFailed = useGoogleMapsFailure()
  const fieldPrefix = useId().replace(/:/g, '')
  const fieldId = name => `${fieldPrefix}-${name}`

  const [state, setState] = useState({ selectedFromAutocomplete: true })
  const [addressTag, setAddressTag] = useState(addressState?.address?.tag)
  // const [toggleMap, setToggleMap] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [addressValue, setAddressValue] = useState(formState.changes?.address ?? addressState.address?.address ?? '')
  const [firstLocationNoEdit, setFirstLocationNoEdit] = useState({ value: null })
  const isEditing = !!addressState.address?.id

  const [locationChange, setLocationChange] = useState(
    isEditing
      ? addressState?.address?.location
      : formState.changes?.location ?? null
  )

  const maxLimitLocation = parseInt(configState?.configs?.meters_to_change_address?.value)
  const googleMapsApiKey = configState?.configs?.google_maps_api_key?.value
  const isLocationRequired = configState.configs?.google_autocomplete_selection_required?.value === '1' ||
                              configState.configs?.google_autocomplete_selection_required?.value === 'true'

  // redesign UF-B5 (M-UF20): the sentence of ERROR_MAX_LIMIT_LOCATION has its own English default, without the number and the
  // unit, which `setMapErrors` adds after it (a translation of the key has no number either).
  const mapErrors = {
    ERROR_NOT_FOUND_ADDRESS: 'Sorry, we couldn\'t find an address',
    ERROR_MAX_LIMIT_LOCATION: 'Sorry, You can only set the position to'
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  /**
   * Returns true when the user made no changes
   * @param {object} address
   */
  const checkAddress = (address, addressToCompare) => {
    const props = ['address', 'address_notes', 'zipcode', 'location', 'internal_number']
    const values = []
    props.forEach(prop => {
      if (addressToCompare[prop]) {
        if (prop === 'location') {
          values.push(address[prop]?.lat === addressToCompare[prop]?.lat &&
            address[prop]?.lng === addressToCompare[prop]?.lng)
        } else {
          values.push(address[prop] === addressToCompare[prop])
        }
      } else {
        values.push(!address[prop])
      }
    })
    return values.every(value => value)
  }

  const getAddressFormatted = (addressChange) => {
    const data = { address: null, error: null }
    const geocoder = window.google && new window.google.maps.Geocoder()

    geocoder.geocode({ address: addressChange }, (results, status) => {
      let postalCode = null
      if (status === 'OK' && results && results.length > 0) {
        for (const component of results?.[0].address_components) {
          const addressType = component.types?.[0]
          if (addressType === 'postal_code') {
            postalCode = component.short_name
            break
          }
        }
        data.address = {
          address: addressChange,
          location: { lat: results?.[0]?.geometry?.location?.lat?.(), lng: results?.[0]?.geometry?.location?.lng?.() },
          utc_offset: results?.[0].utc_offset_minutes ?? 0,
          map_data: {
            library: 'google',
            place_id: results?.[0].place_id
          }
        }
        if (postalCode) {
          data.address.zipcode = postalCode
        }
        const arrayList = isEditing
          ? addressesList.filter(address => address.id !== addressState.address?.id) || []
          : addressesList || []
        const addressToCompare = isEditing
          ? { ...addressState.address, ...data.address, ...formState?.changes }
          : { ...data.address, ...formState?.changes }

        const isAddressAlreadyExist = arrayList.map(address => checkAddress(address, addressToCompare)).some(value => value) ?? false
        if (!isAddressAlreadyExist) {
          saveAddress(data.address, userCustomerSetup)
          return
        }

        setAlertState({
          open: true,
          content: [t('ADDRESS_ALREADY_EXIST', 'The address already exists')]
        })
      } else {
        setAlertState({
          open: true,
          content: [t('ERROR_NOT_FOUND_ADDRESS', 'Error, address not found')]
        })
      }
    })
  }

  const checkKeyDown = (e) => {
    const keyCode = e.keyCode ? e.keyCode : e.which
    if (keyCode === 13) { e.preventDefault() }
  }

  const onSubmit = async () => {
    if (!auth && formState?.changes?.address === '' && addressState?.address?.address) {
      setAlertState({
        open: true,
        content: [t('VALIDATION_ERROR_ADDRESS_REQUIRED', 'The field Address is required')]
      })
      setLocationChange(null)
      return
    }

    if (formState?.changes?.address && !formState?.changes?.location) {
      if (isLocationRequired) {
        setAlertState({
          open: true,
          content: [t('ADDRESS_REQUIRE_LOCATION', 'The address needs a location, please select one of the suggested')]
        })
        return
      }
      // redesign UF-B5 (M-UF23): without Google there is no geocoder, and the call no longer throws.
      if (window.google?.maps?.Geocoder) {
        getAddressFormatted(formState?.changes?.address)
        return
      }
      // redesign UF-R1 (F2, M-UF23): with Google, an address the geocoder cannot find is refused; without it the typed address
      // would reach the API with no coordinates, which the delivery zones need. It is not saved: same inline error path,
      // the form stays open with what was typed.
      setAlertState({
        open: true,
        content: [t('USER_FORM_ADDRESS_MAPS_UNAVAILABLE', 'We can\'t check this address because the map didn\'t load. Try again in a moment.')]
      })
      return
    }

    // setToggleMap(false)
    const arrayList = isEditing
      ? addressesList?.filter(address => address?.id !== addressState?.address?.id) || []
      : addressesList || []
    const addressToCompare = isEditing
      ? { ...addressState.address, ...formState.changes }
      : formState?.changes

    const isAddressAlreadyExist = arrayList.map(address => checkAddress(address, addressToCompare)).some(value => value) ?? false

    if (!isAddressAlreadyExist) {
      saveAddress({}, userCustomerSetup)
      return
    }

    setAlertState({
      open: true,
      content: [t('ADDRESS_ALREADY_EXIST', 'The address already exists')]
    })
  }

  const handleAddressTag = (tag) => {
    setAddressTag(tag)
    handleChangeInput({
      target: {
        name: 'tag',
        value: tag
      }
    })
  }

  const handleChangeAddress = (address) => {
    setState({
      ...state,
      selectedFromAutocomplete: true
    })
    updateChanges({
      ...address,
      address: googleInputRef?.current?.value || address.address
    })
  }

  const setMapErrors = (errKey) => {
    setAlertState({
      open: true,
      // redesign UF-B5 (M-UF20): always a list, as the alert and the inline notices read it
      content: !(errKey === 'ERROR_MAX_LIMIT_LOCATION')
        ? [t(errKey, mapErrors[errKey])]
        : [`${t(errKey, mapErrors[errKey])} ${maxLimitLocation} ${t('METTERS', 'meters')}`]
    })
  }

  useEffect(() => {
    if (!auth) {
      setLocationChange(formState?.changes?.location ?? orderState?.options?.address?.location ?? '')
      setAddressValue(formState?.changes?.address ?? orderState?.options?.address?.address ?? '')
      inputNames.forEach(field =>
        formMethods.setValue(
          field.name,
          formState?.changes[field.name] ||
            (orderState?.options?.address && orderState?.options?.address[field.name]) ||
            ''
        )
      )
      return
    }

    if (!formState.loading && formState.result?.error) {
      setAlertState({
        open: true,
        content: formState.result?.result || [t('ERROR', 'Error')]
      })
    }

    setAddressValue(formState?.changes?.address ?? addressState.address?.address ?? '')
    formMethods.setValue('address', formState?.changes?.address ?? addressState.address?.address ?? '')
    if (!isEditing) {
      inputNames.forEach(field => formMethods.setValue(field.name, formState?.changes[field.name] || ''))
      formState?.changes?.address && setLocationChange(formState?.changes?.location)
      if (
        formState?.changes?.address &&
        formState?.changes?.address !== firstLocationNoEdit?.address &&
        formState?.changes?.location &&
        formState?.changes?.location?.lat !== firstLocationNoEdit.value?.lat &&
        formState?.changes?.location?.lng !== firstLocationNoEdit.value?.lng
      ) {
        setFirstLocationNoEdit({
          value: formState?.changes?.location,
          address: formState?.changes?.address
        })
      }
    }

    if (isEditing) {
      if (formState?.changes?.location) {
        // redesign UF-B5 (M-UF19): an address saved without a location has no previous one to compare with
        const prevLocation = { lat: Math.trunc(locationChange?.lat), lng: Math.trunc(locationChange?.lng) }
        const newLocation = { lat: Math.trunc(formState?.changes?.location?.lat), lng: Math.trunc(formState?.changes?.location?.lng) }
        if (prevLocation.lat !== newLocation.lat && prevLocation.lng !== newLocation.lng) {
          setLocationChange(formState?.changes?.location)
        }
      }
    }
  }, [formState])

  useEffect(() => {
    if (isEditing) {
      setIsEdit && setIsEdit(true)
      setAddressValue(addressState.address?.address)
    } else {
      setIsEdit && setIsEdit(false)
    }
  }, [addressState])

  useEffect(() => {
    if (!auth) {
      setLocationChange(formState?.changes?.location ?? orderState?.options?.address?.location ?? '')
    }

    return () => {
      setFirstLocationNoEdit({ value: null })
    }
  }, [])

  // The title takes the focus when the form opens.
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  /** Form events control */

  useEffect(() => {
    if (Object.keys(formMethods.errors).length > 0) {
      setAlertState({
        open: true,
        content: Object.values(formMethods.errors).map(error => error.message)
      })
    }
  }, [formMethods.errors])

  useEffect(() => {
    inputNames.forEach(field => {
      formMethods.register(field.name, {
        required: isRequiredField(field.name)
          // redesign UF-B5 (M-UF20): the key is upper case, like every VALIDATION_ERROR_<FIELD>_REQUIRED of the catalog
          ? t(`VALIDATION_ERROR_${field.name.toUpperCase()}_REQUIRED`, `The field ${field.code} is required`)
          : null
      })
    })
  }, [formMethods])

  const loading = configState.loading || addressState.loading
  const isNew = Object.keys(props?.address ?? {}).length === 0
  const fieldClass = (name) => name === 'address_notes' ? 'odc-steps-input odc-addr-notes' : 'odc-steps-input'
  const alertMessages = [].concat(alertState.content).filter(Boolean)
  const tagOptions = [
    // redesign W0-4c (T0-15, decisión 19): address type uses HOME_ADDRESS; HOME is the menu.
    { value: 'home', label: t('HOME_ADDRESS', 'Home') },
    { value: 'office', label: t('OFFICE', 'Office') },
    { value: 'favorite', label: t('ADDRESS_TAG_FAVORITE', 'Favorite') },
    { value: 'other', label: t('MORE', 'More') }
  ]

  return (
    <div className='odc-addr-form'>
      <h4 ref={titleRef} tabIndex={-1} className='odc-steps-heading' data-address-form-title=''>
        {isNew ? t('ADD_ADDRESS', 'Add address') : t('EDIT_ADDRESS', 'Edit address')}
      </h4>

      {loading && (
        <div className='odc-steps-list' aria-busy='true'>
          {[0, 1, 2].map(index => <div key={index} className='odc-steps-skeleton-row'><ProductSkeleton size='60%' /></div>)}
        </div>
      )}

      {!loading && (
        <form
          ref={formBodyRef}
          className='odc-addr-form-body'
          onSubmit={formMethods.handleSubmit(onSubmit)}
          onKeyDown={(e) => checkKeyDown(e)}
          autoComplete='off'
        >
          {locationChange && (
            mapsFailed
              ? <MapUnavailable />
              : (
                <StepBoundary
                  fallback={<MapUnavailable focusTarget />}
                  focusOnError={() => formBodyRef.current?.querySelector('[data-map-notice]')}
                >
                  <div className='odc-addr-map' role='region' aria-label={t('ADDRESS', 'Address')}>
                    <GoogleMapsMap
                      apiKey={googleMapsApiKey}
                      fillContainer
                      location={locationChange}
                      fixedLocation={!isEditing ? firstLocationNoEdit.value : null}
                      mapControls={googleMapsControls}
                      handleChangeAddressMap={handleChangeAddress}
                      setErrors={setMapErrors}
                      maxLimitLocation={maxLimitLocation}
                    />
                  </div>
                </StepBoundary>
                )
          )}

          {inputNames.map(field => showField && showField(field.name) && (
            field.name === 'address'
              ? (
                <div key={field.name} className='odc-addr-field'>
                  <label className='odc-addr-label' htmlFor={fieldId('address')}>{t('ADDRESS', 'Address')}</label>
                  <div className='odc-addr-autocomplete'>
                    <GoogleAutocompleteInput
                      className={fieldClass(field.name)}
                      id={fieldId('address')}
                      aria-invalid={Boolean(formMethods.errors.address)}
                      aria-describedby={formMethods.errors.address ? fieldId('address-error') : undefined}
                      apiKey={googleMapsApiKey}
                      placeholder={t('ADDRESS', 'Address')}
                      onChangeAddress={(e) => {
                        formMethods.setValue('address', e.address)
                        handleChangeAddress(e)
                      }}
                      onChange={(e) => {
                        handleChangeInput({ target: { name: 'address', value: e.target.value } })
                        setAddressValue(e.target.value)
                      }}
                      defaultValue={
                        formState?.result?.result
                          ? formState?.result?.result?.address
                          : formState?.changes?.address ?? addressValue
                      }
                      childRef={(ref) => {
                        googleInputRef.current = ref
                      }}
                      autoComplete='new-password'
                      countryCode={configState?.configs?.country_autocomplete?.value || '*'}
                    />
                    <GoogleGpsButton
                      className='gps-button'
                      apiKey={googleMapsApiKey}
                      onAddress={(e) => {
                        formMethods.setValue('address', e.address)
                        handleChangeAddress(e)
                      }}
                      onError={setMapErrors}
                      IconButton={GpsIcon}
                      IconLoadingButton={GpsLoadingIcon}
                    />
                  </div>
                  {formMethods.errors.address && (
                    <p id={fieldId('address-error')} className='odc-addr-error' role='alert'>{formMethods.errors.address.message}</p>
                  )}
                </div>
                )
              : (
                <div key={field.name} className='odc-addr-field'>
                  <label className='odc-addr-label' htmlFor={fieldId(field.name)}>
                    {field.name === 'address_notes' ? t('ADDRESS_NOTES', 'Address Notes') : t(field.name.toUpperCase(), field.code)}
                  </label>
                  {field.name !== 'address_notes'
                    ? (
                      <input
                        id={fieldId(field.name)}
                        name={field.name}
                        className={fieldClass(field.name)}
                        aria-invalid={Boolean(formMethods.errors[field.name])}
                        aria-describedby={formMethods.errors[field.name] ? fieldId(`${field.name}-error`) : undefined}
                        placeholder={t(field.name.toUpperCase(), field.code)}
                        value={formState.changes?.[field.name] ?? addressState.address?.[field.name] ?? ''}
                        onChange={(e) => {
                          formMethods.setValue(field.name, e.target.value)
                          handleChangeInput({ target: { name: field.name, value: e.target.value } })
                        }}
                        autoComplete='new-field'
                        maxLength={30}
                      />
                      )
                    : (
                      <textarea
                        id={fieldId('address_notes')}
                        name='address_notes'
                        className={fieldClass(field.name)}
                        aria-invalid={Boolean(formMethods.errors.address_notes)}
                        aria-describedby={formMethods.errors.address_notes ? fieldId('address_notes-error') : undefined}
                        rows={4}
                        placeholder={t('ADDRESS_NOTES', 'Address Notes')}
                        value={formState.changes?.address_notes ?? addressState.address.address_notes ?? ''}
                        onChange={(e) => {
                          formMethods.setValue('address_notes', e.target.value)
                          handleChangeInput({ target: { name: 'address_notes', value: e.target.value } })
                        }}
                        autoComplete='new-field'
                        maxLength={250}
                      />
                      )}
                  {formMethods.errors[field.name] && (
                    <p id={fieldId(`${field.name}-error`)} className='odc-addr-error' role='alert'>{formMethods.errors[field.name].message}</p>
                  )}
                </div>
                )
          ))}

          <div className='odc-addr-field'>
            <span className='odc-addr-label'>{t('ADDRESS_TYPE', 'Address type')}</span>
            <SegmentedControl
              label={t('ADDRESS_TYPE', 'Address type')}
              value={addressTag ?? ''}
              onValueChange={handleAddressTag}
              options={tagOptions}
            />
          </div>

          {!formState.loading && formState.error && <InlineNotice tone='danger' role='alert'>{formState.error}</InlineNotice>}
          {alertState.open && alertMessages.length > 0 && alertMessages.map((message, index) => (
            <InlineNotice
              key={`${index}-${message}`}
              tone='danger'
              role='alert'
              action={index === alertMessages.length - 1
                ? <ProductButton variant='link' size='sm' onClick={closeAlert}>{t('ACCEPT', 'Accept')}</ProductButton>
                : undefined}
            >
              {message}
            </InlineNotice>
          ))}

          <div className='odc-addr-actions'>
            <ProductButton onClick={() => onCancel && onCancel()}>{t('CANCEL', 'Cancel')}</ProductButton>
            <ProductButton
              type='submit'
              variant='primary'
              busy={Boolean(formState.loading)}
              disabled={formState.loading || Object.keys(formState?.changes).length === 0}
            >
              {isEditing || (!auth && orderState.options?.address?.address)
                ? t('SAVE', 'Save')
                : t('ADD', 'Add')}
            </ProductButton>
          </div>
        </form>
      )}
    </div>
  )
}

export { AddressFormUI }

export const AddressForm = (props) => {
  const googleMapsControls = {
    defaultZoom: 17,
    zoomControl: true,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeId: 'roadmap', // 'roadmap', 'satellite', 'hybrid', 'terrain'
    mapTypeControl: true,
    mapTypeControlOptions: {
      mapTypeIds: ['roadmap', 'satellite']
    },
    isMarkerDraggable: true
  }
  const addressFormProps = {
    ...props,
    UIComponent: AddressFormUI,
    googleMapsControls,
    isSelectedAfterAdd: true
  }

  return <AddressFormController {...addressFormProps} />
}
