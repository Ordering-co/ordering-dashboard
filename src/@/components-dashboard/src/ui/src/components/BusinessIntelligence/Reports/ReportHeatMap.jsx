import React, { useEffect, useState } from 'react'
import { useTheme } from 'styled-components'

import { GoogleMapsMap, useConfig, useLanguage, useSession } from '../../../../../index'
import { MapFrame, SegmentedControl } from '../../Shared/Product'
import './report-body.css'

// redesign reports FC2 (D12, RP-15; inventory A 9.D1, 9.D4): the heat map of the orders (report 9). The map, its centre, its controls and its data are
// the ones of main (BI/ReportsHeatMap:51-71,152-178); what changes is the frame (the Product map frame says «Map unavailable» in the same slot when the
// project has no key, where main left a blank box) and the switch (a Product segmented control instead of a button that changes its own text). The
// pattern is the one of /intelligence/business (BusinessAnalytics/BusinessHeatmap.jsx), which this file does not change.

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

// New York, where main centres a user that has no location (9.D4)
const DEFAULT_POSITION = { lat: 40.77473399999999, lng: -73.9653844 }

const isValidLocation = location => Boolean(location) &&
  location.lat !== undefined &&
  location.lng !== undefined &&
  !isNaN(Number(location.lat)) &&
  !isNaN(Number(location.lng))

/**
 * The map of report 9. `data` is the answer of the API (`{ locations: [{ lat, lng }], zones }`). Opens as Grouped and goes back to Grouped when the
 * data change, as main. The block above decides the empty state: a report without points does not get here.
 */
export const ReportHeatMap = ({ data }) => {
  const [configState] = useConfig()
  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const theme = useTheme()
  const [isHeat, setIsHeat] = useState(false)

  const apiKey = configState?.configs?.google_maps_api_key?.value
  const locations = Array.isArray(data?.locations) ? data.locations.filter(isValidLocation) : []

  // as main: new data, grouped view
  useEffect(() => {
    setIsHeat(false)
  }, [data?.locations])

  return (
    <div className='odc-rp-map'>
      <div className='odc-rp-map-toggle'>
        <SegmentedControl
          label={t('BUSINESS_REPORTS_MAP_VIEW', 'Map view')}
          value={isHeat ? 'heatmap' : 'grouped'}
          onValueChange={value => setIsHeat(value === 'heatmap')}
          options={[
            { value: 'heatmap', label: t('HEATMAP', 'Heatmap') },
            { value: 'grouped', label: t('GROUPED', 'Grouped') }
          ]}
        />
      </div>
      <MapFrame
        label={t('BUSINESS_REPORTS_ORDERS_MAP', 'Orders map')}
        apiKey={apiKey}
        unavailableTitle={t('MAP_UNAVAILABLE', 'Map unavailable')}
        unavailableDescription={t('MAP_UNAVAILABLE_DASHBOARD_TEXT', 'The map could not load. Everything else on this page still works.')}
      >
        <div className='odc-rp-map-canvas'>
          <GoogleMapsMap
            apiKey={apiKey}
            location={user?.location || DEFAULT_POSITION}
            locations={locations}
            mapControls={GOOGLE_MAPS_CONTROLS}
            isHeatMap
            isHeat={isHeat}
            markerIcon={theme?.images?.icons?.mapMarker}
            onError={error => console.error('Google Maps error:', error)}
          />
        </div>
      </MapFrame>
    </div>
  )
}
