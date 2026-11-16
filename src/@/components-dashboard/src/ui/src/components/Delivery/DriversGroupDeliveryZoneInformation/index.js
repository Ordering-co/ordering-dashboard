import React, { useState, useEffect, useRef } from 'react'
import {
  useConfig, useLanguage, useUtils, ExamineClick, BusinessZoneGoogleMaps as DriverGroupZoneGoogleMaps
} from '../../../../../index'
import { Button, Input } from '../../../styles'
import { Alert, RecipientSelect } from '../../Shared'
import { MapFrame, Button as ProductButton, SelectField } from '../../Shared/Product'
import { useGoogleMapsSdk } from '../../../hooks/useGoogleMapsSdk'
import { useForm } from 'react-hook-form'

import {
  FormContainer,
  WrapperMap,
  MapStage,
  FormControl,
  Row,
  KmlButtonWrapper
} from './styles'

export const DriverGroupDeliveryZoneInformation = (props) => {
  const {
    zone,
    driverGroupsZones,
    formState,
    handleChangeInput,
    handleChangeFormState,
    handleUpdateDriverGroupDeliveryZone,
    handleAddDriverGroupDeliveryZone,
    handleUploadKmlFiles,
    kmlData,
    onDirtyChange
  } = props

  const [, t] = useLanguage()
  const { handleSubmit, register, errors } = useForm()
  const [{ parseNumber }] = useUtils()
  const [configState] = useConfig()
  const [clearState, setClearState] = useState(false)
  const [infoContentString, setInfoContentString] = useState('')
  const [zoneType, setZoneType] = useState(zone?.type || 2)
  const [zoneData, setZoneData] = useState(zone?.data)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [isShowMap, setIsShowMap] = useState(false)
  const kmlRef = useRef(null)

  // redesign DG-B2b (M-DG27 | decisión 6): the Google SDK is loaded by the shared hook and only types 1 and 2 draw on a map.
  const mapApiKey = configState?.configs?.google_maps_api_key?.value
  const needsMap = zoneType !== 4 && zoneType !== 5
  const sdk = useGoogleMapsSdk(needsMap ? mapApiKey : undefined)

  // redesign DG-B2b: `onDirtyChange(bool)` tells the owner of the panel whether this form has unsaved changes.
  const isDirty = Object.keys(formState?.changes || {}).length > 0
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  useEffect(() => { onDirtyChangeRef.current?.(isDirty) }, [isDirty])
  useEffect(() => () => { onDirtyChangeRef.current?.(false) }, [])

  const typeOptions = [
    { value: 1, label: t('CIRCLE', 'Circle') },
    { value: 2, label: t('POLYGON', 'Polygon') },
    { value: 4, label: t('EVERYWHERE', 'Everywhere') },
    { value: 5, label: t('DISTANCE_BASED', 'Distance based') }
  ]

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

  const handleChangeType = (type) => {
    handleChangeFormState({ type })
    setClearState(true)
    setZoneType(type)
  }

  const handleZoneData = (data) => {
    setZoneData(data)
    handleChangeFormState({ data })
  }

  const onSubmit = () => {
    // redesign DG-B2b (M-DG39): the map only reports `data` when the user draws or moves the shape, so saving a zone for its name,
    // minimum, fee or recipient has no `changes.data`. An existing zone whose type did not change keeps the shape it was saved with.
    // `changes.data` present but empty means the user cleared the shape: that still has to be drawn again.
    const changes = formState?.changes || {}
    const clearedOrRedrawn = Object.prototype.hasOwnProperty.call(changes, 'data')
    const sameType = changes.type == null || Number(changes.type) === Number(zone?.type)
    const keepsSavedShape = !!zone?.data && !clearedOrRedrawn && sameType
    if (changes.data || zoneType === 4 || keepsSavedShape) {
      if (!zone) handleAddDriverGroupDeliveryZone()
      else handleUpdateDriverGroupDeliveryZone()
    } else {
      setAlertState({
        open: true,
        content: t('REQUIRED_POLYGON_CIRCLE', 'Add a distance based or draw a polygon or circle.')
      })
    }
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  useEffect(() => {
    if (clearState) {
      handleZoneData(null)
    }
  }, [clearState])

  useEffect(() => {
    if (zoneType === 2 || zoneType === 4) return
    let content = '<div style="width: 90px; height: 30px">' + '<span>Radius: </span>'
    content += parseNumber(zoneData?.radio || zoneData?.distance)
    content += `<span>${zoneType === 5 ? configState?.configs?.distance_unit?.value : 'km'}</span>` + '</div>'
    setInfoContentString(content)
  }, [zoneData, zoneType])

  useEffect(() => {
    setClearState(false)
    setZoneType(zone?.type || 2)
    setZoneData(zone?.data)
    setIsShowMap(false)
    // The map remounts 100ms after the zone changes; clear the timer if the panel closes first, or it sets state after unmount
    const showMapTimer = setTimeout(() => {
      setIsShowMap(true)
    }, 100)
    return () => clearTimeout(showMapTimer)
  }, [zone?.id])

  useEffect(() => {
    if (Object?.keys(errors)?.length > 0) {
      setAlertState({
        open: true,
        content: Object?.values(errors)?.map((error) => error?.message)
      })
    }
  }, [errors])

  useEffect(() => {
    if (formState?.error) {
      setAlertState({
        open: true,
        content: formState?.error
      })
    }
  }, [formState])

  return (
    <>
      <FormContainer onSubmit={handleSubmit(onSubmit)} autoComplete='off'>
        <Row>
          <FormControl>
            <label htmlFor='drivers-group-zone-name'>{t('NAME', 'Name')}</label>
            <Input
              placeholder={t('NAME', 'Name')}
              id='drivers-group-zone-name'
              name='name'
              value={formState?.changes?.name ?? zone?.name ?? ''}
              onChange={handleChangeInput}
              ref={register({
                required: t('NAME_REQUIRED', 'The name is required.')
              })}
            />
          </FormControl>
          <FormControl>
            {/* the Product select, the same style as the recipient's below (it was the legacy FirstSelect) */}
            <SelectField
              label={t('TYPE', 'Type')}
              name='type'
              options={typeOptions}
              value={parseInt(formState?.changes?.type || zoneType)}
              onValueChange={next => handleChangeType(Number(next))}
            />
          </FormControl>
        </Row>
        <Row>
          <FormControl>
            <label htmlFor='drivers-group-zone-minimum'>{t('MINIMUN_PURCHASED', 'Minimum purchase')}</label>
            <Input
              placeholder='$0.00'
              id='drivers-group-zone-minimum'
              name='minimum'
              value={formState?.changes?.minimum ?? zone?.minimum ?? ''}
              onChange={handleChangeInput}
              ref={register({
                required: t('MINIMUN_PURCHASED_REQUIRED', 'The minimum purchase is required.')
              })}
            />
          </FormControl>
          <FormControl>
            <label htmlFor='drivers-group-zone-price'>{t('DELIVERY_FEE', 'Delivery fee')}</label>
            <Input
              placeholder='$0.00'
              id='drivers-group-zone-price'
              name='price'
              value={formState?.changes?.price ?? zone?.price ?? ''}
              onChange={handleChangeInput}
              ref={register({
                required: t('DELIVERY_PRICE_REQUIRED', 'The delivery price is required.')
              })}
            />
          </FormControl>
        </Row>
        <Row>
          <FormControl>
            <RecipientSelect
              value={formState.changes?.recipient ?? zone?.recipient ?? 'business'}
              onChange={(val) => handleChangeFormState({ recipient: val })}
            />
          </FormControl>
        </Row>
        {zoneType === 5 &&
          <Row>
            <FormControl>
              <label htmlFor='drivers-group-zone-distance'>{t('DISTANCE_FROM_STORE', 'Distance from store')}</label>
              <Input
                placeholder={`1 - 99 ${configState?.configs?.distance_unit?.value}`}
                id='drivers-group-zone-distance'
                name='distance'
                maxLength={2}
                value={formState.changes?.data?.distance ?? zone?.data?.distance ?? ''}
                onChange={e => handleChangeInput(e, configState?.configs?.distance_unit?.value)}
                ref={register({
                  required: t('DISTANCE_FROM_STORE', 'Distance from store')
                })}
                onKeyPress={(e) => {
                  if (!/^[0-9]$/.test(e.key)) {
                    e.preventDefault()
                  }
                }}
              />
            </FormControl>
          </Row>}
        {needsMap && (
          // redesign DG-B2b (M-DG27 | decisión 6): the map lives in P/MapFrame. No key, or an SDK that fails to load, gives the frame's
          // notice (the other fields still save); the map and its Clear button exist only once the SDK is ready.
          <WrapperMap>
            <MapFrame
              size='fill'
              label={t('DRIVERS_GROUPS_ZONE_MAP', 'Delivery zone map')}
              apiKey={mapApiKey}
              unavailable={sdk.status === 'error'}
              unavailableTitle={t('MAP_UNAVAILABLE', 'Map unavailable')}
              unavailableDescription={mapApiKey
                ? t('DRIVERS_GROUPS_MAP_UNAVAILABLE_ZONE', 'You can still save the other fields. Shapes can be drawn when the map loads.')
                : t('REQUIRED_GOOGLE_MAP_API_KEY', 'Google Maps api key is required')}
            >
              {sdk.status === 'ready' && isShowMap && (
                <MapStage>
                  <ProductButton onClick={() => setClearState(true)}>
                    {t('DRIVERS_GROUPS_CLEAR_SHAPE', 'Clear shape')}
                  </ProductButton>
                  <DriverGroupZoneGoogleMaps
                    key={`${zone?.id ?? 'new'}:${sdk.generation}`}
                    distance={formState?.changes?.data?.distance}
                    apiKey={mapApiKey}
                    mapControls={googleMapsControls}
                    clearState={clearState}
                    setClearState={setClearState}
                    type={zoneType}
                    data={formState?.changes?.data || zoneData}
                    handleData={handleZoneData}
                    fillStyle={fillStyle}
                    infoContentString={infoContentString}
                    greenFillStyle={greenFillStyle}
                    isAddMode={!zone}
                    businessZones={driverGroupsZones}
                    kmlData={kmlData}
                    isDriverGroup
                  />
                </MapStage>
              )}
            </MapFrame>
          </WrapperMap>
        )}
        {!zone && zoneType !== 5 && (
          <KmlButtonWrapper>
            <Button
              color='primary'
              borderRadius='8px'
              type='button'
              onClick={() => kmlRef.current.click()}
            >
              <ExamineClick
                onFiles={files => handleUploadKmlFiles(files)}
                childRef={e => { kmlRef.current = e }}
                accept='.kml,.kmz'
              >
                <span>{t('UPLOAD_KML', 'Upload KML')}</span>
              </ExamineClick>
            </Button>
          </KmlButtonWrapper>
        )}

        <Button
          color='primary'
          borderRadius='8px'
          type='submit'
          disabled={formState?.loading || Object?.keys(formState?.changes)?.length === 0}
        >
          {
            !zone ? t('ADD', 'Add') : t('SAVE', 'Save')
          }
        </Button>
      </FormContainer>
      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState?.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState?.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </>
  )
}
