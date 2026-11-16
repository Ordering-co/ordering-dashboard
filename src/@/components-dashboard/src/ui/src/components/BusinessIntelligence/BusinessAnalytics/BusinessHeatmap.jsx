import React, { useEffect, useRef, useState } from 'react'
import { useTheme } from 'styled-components'

import { GoogleMapsMap, useConfig, useLanguage } from '../../../../../index'
import { MapFrame, SegmentedControl, Skeleton } from '../../Shared/Product'
import { ReportCard } from '../AnalyticsKit'
import './business-analytics.css'

// redesign bi FD (D9, D10; BI-08, BI-09, auditor 12): where the orders come from. The map, its centre, its controls and its data are the
// ones of `AnalyticsMap` of `main` (that file is shared with DriverAnalytics and is not touched); what changes is the frame (the Product
// map frame says «Map unavailable» in the same slot), the switch (a Product segmented control instead of a button that changes its
// text) and the skeleton, which has the box of the frame.

const GOOGLE_MAPS_CONTROLS = {
  defaultZoom: 15,
  zoomControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  mapTypeId: 'roadmap', // 'roadmap', 'satellite', 'hybrid', 'terrain'
  mapTypeControl: false,
  mapTypeControlOptions: {
    mapTypeIds: ['roadmap', 'satellite']
  }
}

const isValidLocation = (location) => Boolean(location) &&
  typeof location.lat !== 'undefined' &&
  typeof location.lng !== 'undefined' &&
  !isNaN(Number(location.lat)) &&
  !isNaN(Number(location.lng))

export const BusinessHeatmap = ({ locationList, onRetry }) => {
  const [configState] = useConfig()
  const [, t] = useLanguage()
  const theme = useTheme()
  const [isHeat, setIsHeat] = useState(false)
  // redesign 'idle' -> 'asked' (the user pressed «Try again») -> 'loading' (the block flagged itself) -> 'idle'
  const [retry, setRetry] = useState('idle')
  const frameRef = useRef(null)

  const apiKey = configState?.configs?.google_maps_api_key?.value
  const defaultCenter = {
    lat: Number(configState?.configs?.location_default_latitude?.value) || 40.77473399999999,
    lng: Number(configState?.configs?.location_default_longitude?.value) || -73.9653844
  }
  const validLocations = locationList?.locations && Array.isArray(locationList.locations)
    ? locationList.locations.filter(isValidLocation)
    : []
  const loading = Boolean(locationList?.loading)
  const disabled = loading || validLocations.length === 0
  const error = locationList?.error
  // redesign without this a failed block was an empty map, which reads as «no orders». With an error (and not loading) the card of
  // the kit says so. While it reloads after «Try again» the same card stays mounted (as a skeleton), so the focus ReportCard put on its title is
  // not lost to <body> when the error state goes away; with the old error and no «Try again» pressed, loading keeps the map's own skeleton
  const showCard = (Boolean(error) && !loading) || (retry !== 'idle' && loading)

  // as `main`: new data, grouped view
  useEffect(() => {
    setIsHeat(false)
  }, [locationList])

  // redesign follow the reload; when it ends with a map, the title that held the focus is gone, so the frame takes it (never <body>)
  // review (low): «asked» only lives until the first answer. If the block never flags itself as loading (the answer arrives in one go) the
  // `locationList` that comes is that answer; without this «asked» stayed, and the next change of period (loading) would show the skeleton of
  // the card, with no Grouped/Heatmap control, instead of the map's own
  const askedList = useRef(null)
  useEffect(() => {
    const answered = retry === 'loading' ? !loading : retry === 'asked' && !loading && locationList !== askedList.current
    if (retry === 'asked' && loading) setRetry('loading')
    if (answered) {
      setRetry('idle')
      const active = document.activeElement
      if (!error && (!active || active === document.body)) frameRef.current?.focus()
    }
  }, [retry, loading, error, locationList])

  const handleRetry = () => {
    askedList.current = locationList
    setRetry('asked')
    onRetry?.()
  }

  if (showCard) {
    return (
      <div className='odc-bi-map'>
        <ReportCard
          title={t('BUSINESS_REPORTS_ORDERS_MAP', 'Orders map')}
          loading={loading}
          error={error}
          onRetry={handleRetry}
          skeleton={<Skeleton size='100%' block='var(--od-x-map-height)' />}
        />
      </div>
    )
  }

  return (
    <div className='odc-bi-map'>
      {/* redesign bi FD (BI-09): the segmented control has no `disabled`; a disabled fieldset disables the native buttons it holds */}
      <fieldset className='odc-bi-map-toggle' disabled={disabled}>
        <SegmentedControl
          label={t('BUSINESS_REPORTS_MAP_VIEW', 'Map view')}
          value={isHeat ? 'heatmap' : 'grouped'}
          onValueChange={(value) => { if (!disabled) setIsHeat(value === 'heatmap') }}
          options={[
            { value: 'grouped', label: t('GROUPED', 'Grouped') },
            { value: 'heatmap', label: t('HEATMAP', 'Heatmap') }
          ]}
        />
      </fieldset>
      {loading
        ? (
          <div className='odc-bi-map-skeleton' aria-busy='true'>
            <Skeleton size='100%' block='var(--od-x-map-height)' />
          </div>
          )
        : (
          <MapFrame
            ref={frameRef}
            label={t('BUSINESS_REPORTS_ORDERS_MAP', 'Orders map')}
            apiKey={apiKey}
            unavailableTitle={t('MAP_UNAVAILABLE', 'Map unavailable')}
            unavailableDescription={t('MAP_UNAVAILABLE_DASHBOARD_TEXT', 'The map could not load. Everything else on this page still works.')}
          >
            {/* redesign bi FD (D9, live check a2): the box that stretches the map to the frame, as main's WrapperMap */}
            <div className='odc-bi-map-canvas'>
              <GoogleMapsMap
                apiKey={apiKey}
                location={defaultCenter}
                locations={validLocations}
                mapControls={GOOGLE_MAPS_CONTROLS}
                isHeatMap
                isHeat={isHeat}
                markerIcon={theme?.images?.icons?.mapMarker}
                onError={(error) => console.error('Google Maps error:', error)}
              />
            </div>
          </MapFrame>
          )}
    </div>
  )
}
